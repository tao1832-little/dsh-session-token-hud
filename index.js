/**
 * Token HUD — Host half.
 *
 * Serves one same-origin JSON route that reports, for a single session:
 * session token usage (input / output / cache), context pressure against the
 * route's context window, and the tokens-per-second of the latest response.
 *
 * The route is authenticated through the composed `connection` service and
 * reads only logged session events, so it never invents numbers the session
 * log does not carry.
 */

/** Exact route the browser half polls. */
const ROUTE_PATH = '/token-hud/state';

/** Upper bound of cached per-session folds. */
const CACHE_LIMIT = 64;

/**
 * Empty usage accumulator.
 * @returns {{input: number, output: number, cacheRead: number, cacheWrite: number, reasoning: number, total: number, prompt: number, responses: number}}
 */
function emptyTotals() {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, total: 0, prompt: 0, responses: 0 };
}

/**
 * Fresh fold state for one session.
 * @returns {object} fold state.
 */
function emptyFold() {
  return {
    seq: 0,
    totals: emptyTotals(),
    running: false,
    last: null,
    lastTime: 0,
  };
}

/**
 * Sum a stream record's inter-chunk delays.
 * @param {readonly number[] | undefined} deltas inter-chunk delays in ms.
 * @returns {number} total milliseconds.
 */
function sumDeltas(deltas) {
  let total = 0;
  if (Array.isArray(deltas)) {
    for (const delta of deltas) {
      if (typeof delta === 'number' && Number.isFinite(delta)) total += delta;
    }
  }
  return total;
}

/**
 * Measure the wall-clock span one assistant message spent streaming.
 * @param {readonly object[] | undefined} stream logged stream records.
 * @returns {{start: number, end: number} | null} span in epoch ms, when known.
 */
function streamSpan(stream) {
  let start = Infinity;
  let end = -Infinity;
  if (Array.isArray(stream)) {
    for (const record of stream) {
      if (record === null || typeof record !== 'object') continue;
      if (record.type === 'chunk') {
        const time = record.time;
        if (typeof time === 'number' && Number.isFinite(time)) {
          if (time < start) start = time;
          if (time > end) end = time;
        }
        continue;
      }
      const time0 = record.time0;
      if (typeof time0 !== 'number' || !Number.isFinite(time0)) continue;
      const stop = time0 + sumDeltas(record.dt);
      if (time0 < start) start = time0;
      if (stop > end) end = stop;
    }
  }
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : null;
}

/**
 * Fold one logged session event into the per-session cache entry.
 * @param {object} fold mutable fold state.
 * @param {object} event logged session event.
 * @returns {void}
 */
function applyEvent(fold, event) {
  const data = event.data ?? {};
  switch (event.type) {
    case 'turn/start':
      fold.running = true;
      return;
    case 'turn/end':
      fold.running = false;
      return;
    case 'assistant/message': {
      const usage = data.usage;
      const totals = fold.totals;
      if (usage !== undefined && usage !== null) {
        const input = Number(usage.inputTokens ?? 0) || 0;
        const output = Number(usage.outputTokens ?? 0) || 0;
        const cacheRead = Number(usage.cacheReadTokens ?? 0) || 0;
        const cacheWrite = Number(usage.cacheWriteTokens ?? 0) || 0;
        const reasoning = Number(usage.reasoningTokens ?? 0) || 0;
        totals.responses += 1;
        totals.input += input;
        totals.output += output;
        totals.cacheRead += cacheRead;
        totals.cacheWrite += cacheWrite;
        totals.reasoning += reasoning;
        totals.total += Number(usage.totalTokens ?? input + output + cacheRead + cacheWrite) || 0;
        const prompt = input + cacheRead + cacheWrite;
        if (prompt > 0) totals.prompt = prompt;
      }
      const span = streamSpan(data.stream);
      const output = Number(usage?.outputTokens ?? 0) || 0;
      const seconds = span === null ? 0 : (span.end - span.start) / 1000;
      fold.last = {
        outputTokens: output,
        seconds: Math.round(seconds * 100) / 100,
        tokensPerSecond: seconds > 0.05 && output > 0 ? Math.round((output / seconds) * 10) / 10 : null,
        time: typeof event.time === 'number' ? event.time : 0,
        interrupted: data.interrupted === true,
      };
      if (typeof event.time === 'number') fold.lastTime = event.time;
      return;
    }
    default:
      return;
  }
}

/**
 * Read a session's context window and route identity.
 * @param {object} session live session.
 * @returns {{contextWindow: number | undefined, provider: string | undefined, model: string | undefined}} route facts.
 */
function routeFacts(session) {
  let context;
  try {
    context = session.requestContext();
  } catch {
    context = undefined;
  }
  return {
    contextWindow: typeof context?.contextWindow === 'number' ? context.contextWindow : undefined,
    provider: typeof context?.provider === 'string' ? context.provider : undefined,
    model: typeof context?.model === 'string' ? context.model : undefined,
  };
}

/**
 * Build one session's HUD payload.
 * @param {object} ctx plugin context.
 * @param {Map<string, object>} cache per-session fold cache.
 * @param {string} sessionId target session.
 * @returns {object} JSON payload.
 */
function buildPayload(ctx, cache, sessionId) {
  const sessions = ctx.get('sessions');
  const session = sessions?.get?.(sessionId);
  if (session === undefined || session === null) {
    return { ok: false, error: { code: 'session/missing', message: 'no live session with that id' } };
  }
  const seq = Number(session.seq ?? 0);
  let fold = cache.get(sessionId);
  if (fold === undefined || seq < fold.seq) {
    fold = emptyFold();
    cache.set(sessionId, fold);
  }
  if (seq > fold.seq) {
    let events = [];
    try {
      events = session.snapshotEvents(fold.seq);
    } catch {
      events = [];
    }
    for (const event of events) {
      if (Number(event.seq) < fold.seq) continue;
      applyEvent(fold, event);
    }
    fold.seq = seq;
    while (cache.size > CACHE_LIMIT) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  }
  const facts = routeFacts(session);
  let pressure;
  try {
    pressure = ctx.get('tokenMeter')?.contextPressure?.(session);
  } catch {
    pressure = undefined;
  }
  const window = Number(pressure?.contextWindow ?? facts.contextWindow ?? 0) || undefined;
  const promptTokens = Number(pressure?.pressureTokens ?? fold.totals.prompt) || undefined;
  const percent = window !== undefined && promptTokens !== undefined && window > 0 ? (promptTokens / window) * 100 : undefined;
  return {
    ok: true,
    sessionId,
    running: fold.running,
    updatedAt: Date.now(),
    totals: fold.totals,
    last: fold.last,
    context: {
      pressureTokens: promptTokens,
      projectedTokens: Number(pressure?.projectedTokens ?? 0) || undefined,
      contextWindow: window,
      percent,
    },
    model: { provider: facts.provider, model: facts.model },
  };
}

/**
 * Write one JSON response.
 * @param {import('node:http').ServerResponse} response response.
 * @param {number} status HTTP status.
 * @param {unknown} payload JSON payload.
 * @returns {void}
 */
function respondJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  });
  response.end(body);
}

/**
 * Serve one HUD snapshot for the session named in the query string.
 * @param {object} ctx plugin context.
 * @param {Map<string, object>} cache per-session fold cache.
 * @param {import('node:http').IncomingMessage} request request.
 * @param {import('node:http').ServerResponse} response response.
 * @returns {void}
 */
function handleRoute(ctx, cache, request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    respondJson(response, 405, { ok: false, error: { code: 'route/method', message: 'use GET' } });
    return;
  }
  const connection = ctx.get('connection');
  if (connection !== undefined) {
    const admission = connection.admit({ headers: request.headers });
    if (admission.rejection !== undefined) {
      response.writeHead(admission.rejection);
      response.end();
      return;
    }
  }
  let sessionId = '';
  try {
    sessionId = new URL(request.url ?? '/', 'http://localhost').searchParams.get('session') ?? '';
  } catch {
    sessionId = '';
  }
  if (sessionId === '') {
    respondJson(response, 400, { ok: false, error: { code: 'route/session', message: 'missing ?session=' } });
    return;
  }
  try {
    respondJson(response, 200, buildPayload(ctx, cache, sessionId));
  } catch (error) {
    respondJson(response, 500, { ok: false, error: { code: 'route/failed', message: String(error?.message ?? error) } });
  }
}

/**
 * Pure helpers exposed for tests.
 */
export const __test = { emptyFold, emptyTotals, streamSpan, applyEvent, buildPayload, handleRoute, respondJson };

/**
 * Mount the HUD snapshot route.
 * @param {import('@deepseek-ai/cordis').Context} ctx plugin context.
 * @returns {void}
 */
export function apply(ctx) {
  const cache = new Map();
  ctx.effect(() => () => cache.clear(), 'token-hud: snapshot cache');
  ctx.inject(['webServer'], (webCtx) => {
    webCtx.effect(
      () => webCtx.webServer.register({
        kind: 'exact',
        path: ROUTE_PATH,
        handler: (request, response) => handleRoute(ctx, cache, request, response),
      }),
      'token-hud: state route',
    );
  });
}
