/**
 * Token HUD — Client half.
 *
 * A frame-wide floating card that reports the current session's token usage,
 * context pressure, and tokens per second. It reads one same-origin JSON route
 * owned by this package's Host half; the session id comes from the
 * session-scoped composer dock entry, which exists only while a conversation
 * is open.
 */

window.__ModuleLoader__.load({
	id: 'dsh-session-token-hud',
	factory(require) {
		const React = require('react');
		const h = React.createElement;

		/** Locale namespace of this package. */
		const NS = 'dsh-session-token-hud';

		/** Host route that serves one snapshot. */
		const ROUTE = '/token-hud/state';

		/** Poll cadence while the page is visible. */
		const POLL_MS = 1000;

		/** Collapsed-state storage key. */
		const COLLAPSED_KEY = 'dsh-session-token-hud:collapsed';

		/** Dragged-position storage key. */
		const POS_KEY = 'dsh-session-token-hud:pos';

		/** Display-settings storage key. */
		const SETTINGS_KEY = 'dsh-session-token-hud:settings';

		/**
		 * Display defaults. Edit these to change the shipped look; every field is
		 * also adjustable at runtime from the card's gear button, which persists
		 * the override in localStorage.
		 */
		const DEFAULTS = {
			/** Card width in px (also the collapsed-independent base). */
			width: 232,
			/** Backdrop blur radius in px; 0 turns the frosting off. */
			blur: 18,
			/** Background opacity in percent; lower shows more of the page behind. */
			alpha: 55,
			/** Show the "usage" row (input + output totals). */
			showUsage: true,
			/** Show the context row and its pressure bar. */
			showContext: true,
			/** Show the tokens-per-second row. */
			showSpeed: true,
			/** Show the input/output/cache detail row. */
			showSplit: true,
		};

		/** Accepted range per numeric field. */
		const RANGES = {
			width: { min: 170, max: 380, step: 4 },
			blur: { min: 0, max: 40, step: 1 },
			alpha: { min: 25, max: 95, step: 1 },
		};

		const en = {
			'hud.title': 'Token HUD',
			'hud.usage': 'Usage',
			'hud.responses': 'responses',
			'hud.context': 'Context',
			'hud.speed': 'Speed',
			'hud.perSecond': 'tok/s',
			'hud.input': 'In',
			'hud.output': 'Out',
			'hud.cache': 'Cache',
			'hud.idle': 'idle',
			'hud.running': 'generating',
			'hud.noSession': 'No open session',
			'hud.collapse': 'Collapse',
			'hud.expand': 'Expand',
			'hud.unavailable': 'Unavailable',
			'hud.lastResponse': 'last response',
			'hud.settings': 'Display settings',
			'hud.showUsage': 'usage',
			'hud.showContext': 'context',
			'hud.showSpeed': 'speed',
			'hud.showSplit': 'detail',
			'hud.width': 'Width',
			'hud.blur': 'Blur',
			'hud.alpha': 'Opacity',
			'hud.reset': 'Reset',
		};

		const zh = {
			'hud.title': 'Token 用量',
			'hud.usage': '用量',
			'hud.responses': '次响应',
			'hud.context': '上下文',
			'hud.speed': '速度',
			'hud.perSecond': 'tok/s',
			'hud.input': '输入',
			'hud.output': '输出',
			'hud.cache': '缓存',
			'hud.idle': '空闲',
			'hud.running': '生成中',
			'hud.noSession': '未打开会话',
			'hud.collapse': '收起',
			'hud.expand': '展开',
			'hud.unavailable': '不可用',
			'hud.lastResponse': '上次响应',
			'hud.settings': '显示设置',
			'hud.showUsage': '用量',
			'hud.showContext': '上下文',
			'hud.showSpeed': '速度',
			'hud.showSplit': '明细',
			'hud.width': '宽度',
			'hud.blur': '模糊',
			'hud.alpha': '不透明',
			'hud.reset': '重置',
		};

		/** Styles inserted for the page lifetime. */
		const CSS = `
.token-hud-card {
	position: fixed;
	top: 14px;
	right: 18px;
	z-index: 60;
	width: var(--token-hud-width, 232px);
	box-sizing: border-box;
	padding: 10px 12px 11px;
	border-radius: 12px;
	border: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.28));
	background: rgba(24, 24, 27, 0.52);
	background: color-mix(in srgb, var(--dsw-alias-bg-overlay, rgba(24, 24, 27, 0.92)) var(--token-hud-alpha, 55%), transparent);
	-webkit-backdrop-filter: blur(var(--token-hud-blur, 18px)) saturate(180%);
	backdrop-filter: blur(var(--token-hud-blur, 18px)) saturate(180%);
	color: var(--dsw-alias-label-primary, #f4f4f5);
	font-family: inherit;
	font-size: 11px;
	line-height: 1.45;
	box-shadow: 0 12px 32px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.06);
	pointer-events: auto;
	user-select: none;
	cursor: grab;
	touch-action: none;
}
.token-hud-card[data-collapsed='true'] { width: auto; min-width: 132px; padding: 8px 10px; }
.token-hud-card[data-dragging='true'] { cursor: grabbing; }
.token-hud-head {
	display: flex;
	align-items: center;
	gap: 6px;
}
.token-hud-dot {
	width: 7px;
	height: 7px;
	border-radius: 50%;
	flex: 0 0 auto;
	background: var(--dsw-alias-state-idle-primary, #71717a);
}
.token-hud-dot[data-running='true'] {
	background: var(--dsw-alias-state-success-primary, #22c55e);
	box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.55);
	animation: token-hud-pulse 1.4s ease-out infinite;
}
@keyframes token-hud-pulse {
	0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5); }
	70% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
	100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
}
.token-hud-title {
	font-weight: 600;
	letter-spacing: 0.02em;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.token-hud-head-right { margin-left: auto; display: flex; align-items: center; gap: 6px; }
.token-hud-toggle {
	border: 0;
	padding: 0 2px;
	background: transparent;
	color: var(--dsw-alias-label-secondary, #a1a1aa);
	font: inherit;
	cursor: pointer;
	line-height: 1;
}
.token-hud-toggle:hover { color: var(--dsw-alias-label-primary, #f4f4f5); }
.token-hud-toggle[data-on='true'] { color: var(--dsw-alias-brand-primary, #3b82f6); }
.token-hud-pct {
	font-variant-numeric: tabular-nums;
	font-weight: 600;
}
.token-hud-row {
	display: flex;
	align-items: baseline;
	gap: 6px;
	margin-top: 8px;
}
.token-hud-label {
	color: var(--dsw-alias-label-secondary, #a1a1aa);
	white-space: nowrap;
}
.token-hud-value { margin-left: auto; font-variant-numeric: tabular-nums; }
.token-hud-bar {
	margin-top: 5px;
	height: 4px;
	border-radius: 999px;
	overflow: hidden;
	background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.24));
}
.token-hud-fill {
	height: 100%;
	border-radius: inherit;
	background: var(--dsw-alias-brand-primary, #3b82f6);
	transition: width 320ms ease, background-color 320ms ease;
}
.token-hud-fill[data-level='warn'] { background: var(--dsw-alias-state-warn-primary, #f59e0b); }
.token-hud-fill[data-level='error'] { background: var(--dsw-alias-state-error-primary, #ef4444); }
.token-hud-sub {
	margin-top: 5px;
	color: var(--dsw-alias-label-secondary, #a1a1aa);
	font-variant-numeric: tabular-nums;
}
.token-hud-split {
	margin-top: 8px;
	padding-top: 7px;
	border-top: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.22));
	display: flex;
	gap: 10px;
	font-variant-numeric: tabular-nums;
}
.token-hud-chip { display: flex; align-items: baseline; gap: 4px; }
.token-hud-speed {
	font-variant-numeric: tabular-nums;
	font-weight: 600;
}
.token-hud-muted {
	color: var(--dsw-alias-label-secondary, #a1a1aa);
	font-weight: 400;
	margin-left: 3px;
}
.token-hud-settings {
	margin-top: 8px;
	padding-top: 7px;
	border-top: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.22));
	display: flex;
	flex-direction: column;
	gap: 7px;
}
.token-hud-field {
	display: flex;
	align-items: center;
	gap: 8px;
	color: var(--dsw-alias-label-secondary, #a1a1aa);
}
.token-hud-field > span { flex: 0 0 46px; }
.token-hud-field > em {
	flex: 0 0 34px;
	font-style: normal;
	text-align: right;
	font-variant-numeric: tabular-nums;
	color: var(--dsw-alias-label-primary, #f4f4f5);
}
.token-hud-field input[type='range'] {
	flex: 1;
	min-width: 0;
	height: 14px;
	margin: 0;
	accent-color: var(--dsw-alias-brand-primary, #3b82f6);
	cursor: pointer;
}
.token-hud-checks {
	display: flex;
	flex-wrap: wrap;
	gap: 4px 10px;
	color: var(--dsw-alias-label-secondary, #a1a1aa);
}
.token-hud-checks label {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	cursor: pointer;
}
.token-hud-checks input {
	margin: 0;
	accent-color: var(--dsw-alias-brand-primary, #3b82f6);
	cursor: pointer;
}
.token-hud-reset {
	align-self: flex-start;
	border: 0;
	padding: 0;
	background: transparent;
	color: var(--dsw-alias-label-secondary, #a1a1aa);
	font: inherit;
	text-decoration: underline;
	cursor: pointer;
}
.token-hud-reset:hover { color: var(--dsw-alias-label-primary, #f4f4f5); }
`;

		/** Current session id, published by the composer dock registrar. */
		const hub = { sessionId: null, listeners: new Set() };

		/**
		 * Publish the session currently mounted in the conversation.
		 * @param {string | null | undefined} sessionId mounted session id.
		 * @returns {void}
		 */
		function publishSession(sessionId) {
			const next = typeof sessionId === 'string' && sessionId !== '' ? sessionId : null;
			if (hub.sessionId === next) return;
			hub.sessionId = next;
			for (const listener of [...hub.listeners]) listener();
		}

		/**
		 * Subscribe to the published session id.
		 * @param {() => void} listener change callback.
		 * @returns {() => void} unsubscribe.
		 */
		function subscribeSession(listener) {
			hub.listeners.add(listener);
			return () => {
				hub.listeners.delete(listener);
			};
		}

		/**
		 * Read the published session id and rerender on change.
		 * @returns {string | null} current session id.
		 */
		function useSessionId() {
			const [sessionId, setId] = React.useState(hub.sessionId);
			React.useEffect(() => {
				setId(hub.sessionId);
				return subscribeSession(() => setId(hub.sessionId));
			}, []);
			return sessionId;
		}

		/**
		 * Poll the Host snapshot for one session.
		 * @param {string | null} sessionId target session.
		 * @returns {{snapshot: object | null, failure: string | null}} latest polling outcome.
		 */
		function useSnapshot(sessionId) {
			const [snapshot, setSnapshot] = React.useState(null);
			const [failure, setFailure] = React.useState(null);
			React.useEffect(() => {
				if (sessionId === null) {
					setSnapshot(null);
					setFailure(null);
					return undefined;
				}
				let cancelled = false;
				let timer = 0;
				const tick = async () => {
					if (document.visibilityState === 'visible') {
						try {
							const response = await fetch(`${ROUTE}?session=${encodeURIComponent(sessionId)}`, {
								method: 'GET',
								credentials: 'same-origin',
								cache: 'no-store',
							});
							const payload = await response.json();
							if (!cancelled) {
								if (payload !== null && typeof payload === 'object' && payload.ok === true) {
									setSnapshot(payload);
									setFailure(null);
								} else {
									setFailure(typeof payload?.error?.message === 'string' ? payload.error.message : String(response.status));
								}
							}
						} catch (error) {
							if (!cancelled) setFailure(String(error?.message ?? error));
						}
					}
					if (!cancelled) timer = window.setTimeout(tick, POLL_MS);
				};
				tick();
				return () => {
					cancelled = true;
					window.clearTimeout(timer);
				};
			}, [sessionId]);
			return { snapshot, failure };
		}

		/**
		 * Compact token count for narrow UI.
		 * @param {number} value raw token count.
		 * @returns {string} display form.
		 */
		function formatTokens(value) {
			const number = Number(value);
			if (!Number.isFinite(number) || number <= 0) return '0';
			if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(number >= 10_000_000 ? 0 : 1)}M`;
			if (number >= 1_000) return `${(number / 1_000).toFixed(number >= 100_000 ? 0 : 1)}k`;
			return String(Math.round(number));
		}

		/**
		 * Bar level for a context percentage.
		 * @param {number} percent used share.
		 * @returns {'normal' | 'warn' | 'error'} level.
		 */
		function levelOf(percent) {
			if (!Number.isFinite(percent)) return 'normal';
			if (percent >= 95) return 'error';
			if (percent >= 80) return 'warn';
			return 'normal';
		}

		/**
		 * Read the persisted collapsed flag.
		 * @returns {boolean} whether the card starts collapsed.
		 */
		function readCollapsed() {
			try {
				return window.localStorage.getItem(COLLAPSED_KEY) === '1';
			} catch {
				return false;
			}
		}

		/**
		 * Persist the collapsed flag.
		 * @param {boolean} collapsed next state.
		 * @returns {void}
		 */
		function writeCollapsed(collapsed) {
			try {
				window.localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
			} catch {
				/* storage may be unavailable; the card still toggles for this run */
			}
		}

		/**
		 * Read the dragged card position.
		 * @returns {{top: number, left: number} | null} stored position, or null for the default corner.
		 */
		function readPos() {
			try {
				const raw = window.localStorage.getItem(POS_KEY);
				if (raw === null) return null;
				const parsed = JSON.parse(raw);
				if (Number.isFinite(parsed?.top) && Number.isFinite(parsed?.left)) {
					return { top: parsed.top, left: parsed.left };
				}
			} catch {
				/* ignore malformed or unavailable storage */
			}
			return null;
		}

		/**
		 * Persist the dragged card position.
		 * @param {{top: number, left: number} | null} pos next position.
		 * @returns {void}
		 */
		function writePos(pos) {
			try {
				if (pos === null) window.localStorage.removeItem(POS_KEY);
				else window.localStorage.setItem(POS_KEY, JSON.stringify(pos));
			} catch {
				/* storage may be unavailable; the card still drags for this run */
			}
		}

		/**
		 * Keep a coordinate inside the viewport.
		 * @param {number} value wanted coordinate.
		 * @param {number} min lower bound.
		 * @param {number} max upper bound.
		 * @returns {number} clamped coordinate.
		 */
		function clamp(value, min, max) {
			return Math.min(Math.max(value, min), Math.max(min, max));
		}

		/**
		 * Coerce a stored settings blob onto the shipped defaults.
		 * @param {unknown} raw whatever storage returned.
		 * @returns {typeof DEFAULTS} complete settings, every numeric field in range.
		 */
		function normalizeSettings(raw) {
			const source = raw !== null && typeof raw === 'object' ? raw : {};
			const next = { ...DEFAULTS };
			for (const [key, range] of Object.entries(RANGES)) {
				const value = Number(source[key]);
				next[key] = Number.isFinite(value) ? clamp(Math.round(value), range.min, range.max) : DEFAULTS[key];
			}
			for (const key of ['showUsage', 'showContext', 'showSpeed', 'showSplit']) {
				if (typeof source[key] === 'boolean') next[key] = source[key];
			}
			return next;
		}

		/**
		 * Read the persisted display settings.
		 * @returns {typeof DEFAULTS} effective settings.
		 */
		function readSettings() {
			try {
				const raw = window.localStorage.getItem(SETTINGS_KEY);
				return normalizeSettings(raw === null ? null : JSON.parse(raw));
			} catch {
				return { ...DEFAULTS };
			}
		}

		/**
		 * Persist display settings.
		 * @param {typeof DEFAULTS} settings next settings.
		 * @returns {void}
		 */
		function writeSettings(settings) {
			try {
				window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
			} catch {
				/* storage may be unavailable; the card still follows the change for this run */
			}
		}

		/**
		 * Session-less registrar that publishes the mounted conversation's id.
		 * @returns {null} renders nothing.
		 */
		function ComposerSessionBridge(props) {
			const sessionId = props === null || props === undefined ? undefined : props.sessionId;
			React.useEffect(() => {
				publishSession(sessionId);
			}, [sessionId]);
			React.useEffect(() => () => publishSession(null), []);
			return null;
		}

		/**
		 * The floating HUD card.
		 * @param {object} props slot props (carries `t` through the locale registration).
		 * @returns {object} rendered card.
		 */
		function TokenHudCard(props) {
			const t = typeof props?.t === 'function' ? props.t : (key) => key;
			const sessionId = useSessionId();
			const { snapshot, failure } = useSnapshot(sessionId);
			const [collapsed, setCollapsed] = React.useState(readCollapsed);
			const [settings, setSettings] = React.useState(readSettings);
			const [showSettings, setShowSettings] = React.useState(false);
			const [pos, setPos] = React.useState(readPos);
			const [dragging, setDragging] = React.useState(false);
			const dragRef = React.useRef(null);
			const movedRef = React.useRef(false);
			const posRef = React.useRef(pos);
			posRef.current = pos;

			const toggle = React.useCallback(() => {
				setCollapsed((previous) => {
					writeCollapsed(!previous);
					return !previous;
				});
			}, []);

			const startDrag = (event) => {
				if (event.button !== 0) return;
				if (typeof event.target?.closest === 'function' && event.target.closest('button, a, input, select, textarea') !== null) return;
				const card = event.currentTarget;
				if (card === null || card === undefined || typeof card.getBoundingClientRect !== 'function') return;
				const rect = card.getBoundingClientRect();
				movedRef.current = false;
				dragRef.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top, width: rect.width, x0: event.clientX, y0: event.clientY };
				event.currentTarget.setPointerCapture?.(event.pointerId);
				setDragging(true);
			};

			const moveDrag = (event) => {
				const drag = dragRef.current;
				if (drag === null) return;
				if (Math.abs(event.clientX - drag.x0) > 3 || Math.abs(event.clientY - drag.y0) > 3) movedRef.current = true;
				setPos({
					top: clamp(event.clientY - drag.dy, 4, window.innerHeight - 36),
					left: clamp(event.clientX - drag.dx, 4, window.innerWidth - drag.width - 4),
				});
			};

			const endDrag = () => {
				if (dragRef.current === null) return;
				dragRef.current = null;
				setDragging(false);
				writePos(posRef.current);
				/* A click follows pointerup in the same task; drop the flag after it. */
				window.setTimeout(() => {
					movedRef.current = false;
				}, 0);
			};

			const onHeadClick = () => {
				if (movedRef.current) return;
				toggle();
			};

			const updateSetting = React.useCallback((key, value) => {
				setSettings((previous) => {
					const next = normalizeSettings({ ...previous, [key]: value });
					writeSettings(next);
					return next;
				});
			}, []);

			const resetSettings = React.useCallback(() => {
				const next = { ...DEFAULTS };
				writeSettings(next);
				setSettings(next);
			}, []);

			const context = snapshot?.context ?? null;
			const running = snapshot?.running === true;
			const percent = typeof context?.percent === 'number' && Number.isFinite(context.percent) ? context.percent : null;

			const head = h(
				'div',
				{
					className: 'token-hud-head',
					onClick: onHeadClick,
					role: 'button',
					tabIndex: 0,
					title: collapsed ? t('hud.expand') : t('hud.collapse'),
				},
				h('span', { className: 'token-hud-dot', 'data-running': running ? 'true' : 'false' }),
				h('span', { className: 'token-hud-title' }, t('hud.title')),
				h(
					'span',
					{ className: 'token-hud-head-right' },
					percent === null
						? h('span', { className: 'token-hud-pct' }, running ? t('hud.running') : t('hud.idle'))
						: h('span', { className: 'token-hud-pct' }, `${percent.toFixed(1)}%`),
					h(
						'button',
						{
							type: 'button',
							className: 'token-hud-toggle',
							'data-on': showSettings ? 'true' : 'false',
							'aria-label': t('hud.settings'),
							title: t('hud.settings'),
							onClick: (event) => {
								event.stopPropagation();
								setShowSettings((value) => !value);
							},
						},
						'⚙',
					),
					h('button', { type: 'button', className: 'token-hud-toggle', onClick: (event) => { event.stopPropagation(); toggle(); }, 'aria-label': collapsed ? t('hud.expand') : t('hud.collapse') }, collapsed ? '▸' : '▾'),
				),
			);

			const panel = showSettings
				? h(
						'div',
						{ className: 'token-hud-settings' },
						...Object.entries(RANGES).map(([key, range]) =>
							h(
								'label',
								{ className: 'token-hud-field', key },
								h('span', null, t(`hud.${key}`)),
								h('input', {
									type: 'range',
									min: range.min,
									max: range.max,
									step: range.step,
									value: settings[key],
									onChange: (event) => updateSetting(key, Number(event.target.value)),
								}),
								h('em', null, key === 'alpha' ? `${settings[key]}%` : `${settings[key]}px`),
							),
						),
						h(
							'div',
							{ className: 'token-hud-checks' },
							...['showUsage', 'showContext', 'showSpeed', 'showSplit'].map((key) =>
								h(
									'label',
									{ key },
									h('input', {
										type: 'checkbox',
										checked: settings[key],
										onChange: (event) => updateSetting(key, event.target.checked),
									}),
									t(`hud.${key}`),
								),
							),
						),
						h('button', { type: 'button', className: 'token-hud-reset', onClick: resetSettings }, t('hud.reset')),
					)
				: null;

			const cardStyle = {
				...(pos === null ? null : { top: `${pos.top}px`, left: `${pos.left}px`, right: 'auto' }),
				'--token-hud-width': `${settings.width}px`,
				'--token-hud-blur': `${settings.blur}px`,
				'--token-hud-alpha': `${settings.alpha}%`,
			};

			const cardProps = {
				className: 'token-hud-card',
				style: cardStyle,
				onPointerDown: startDrag,
				onPointerMove: moveDrag,
				onPointerUp: endDrag,
				onPointerCancel: endDrag,
			};

			if (collapsed) {
				return h('div', { ...cardProps, 'data-collapsed': 'true', 'data-dragging': dragging ? 'true' : 'false' }, head);
			}

			return h(
				'div',
				{ ...cardProps, 'data-collapsed': 'false', 'data-dragging': dragging ? 'true' : 'false' },
				head,
				...renderBody(t, sessionId, snapshot, failure, settings),
				panel,
			);
		}

		/**
		 * Card body for one snapshot; pure so it can be rendered in tests.
		 * @param {(key: string) => string} t translator.
		 * @param {string | null} sessionId conversation id, or null when none is open.
		 * @param {object | null} snapshot latest Host snapshot.
		 * @param {string | null} failure latest polling failure.
		 * @param {typeof DEFAULTS} [settings] which rows to render.
		 * @returns {object[]} body nodes.
		 */
		function renderBody(t, sessionId, snapshot, failure, settings) {
			const options = settings ?? DEFAULTS;
			const context = snapshot?.context ?? null;
			const totals = snapshot?.totals ?? null;
			const last = snapshot?.last ?? null;
			const running = snapshot?.running === true;
			const percent = typeof context?.percent === 'number' && Number.isFinite(context.percent) ? context.percent : null;
			const level = levelOf(percent);
			const speed = typeof last?.tokensPerSecond === 'number' ? last.tokensPerSecond : null;
			const used = (Number(totals?.input ?? 0) || 0) + (Number(totals?.output ?? 0) || 0);
			const responses = Number(totals?.responses ?? 0) || 0;

			const body = [];
			if (sessionId === null) {
				body.push(h('div', { className: 'token-hud-sub', key: 'empty' }, t('hud.noSession')));
			} else if (snapshot === null) {
				body.push(h('div', { className: 'token-hud-sub', key: 'pending' }, failure === null ? '…' : t('hud.unavailable')));
			} else {
				if (options.showUsage) {
					body.push(
						h(
							'div',
							{ className: 'token-hud-row', key: 'usage' },
							h('span', { className: 'token-hud-label' }, t('hud.usage')),
							h(
								'span',
								{ className: 'token-hud-value' },
								h('span', { className: 'token-hud-speed' }, formatTokens(used)),
								responses > 0 ? h('span', { className: 'token-hud-muted' }, `${responses} ${t('hud.responses')}`) : null,
							),
						),
					);
				}
				if (options.showContext) {
					body.push(
						h(
							'div',
							{ className: 'token-hud-row', key: 'context' },
							h('span', { className: 'token-hud-label' }, t('hud.context')),
							h(
								'span',
								{ className: 'token-hud-value' },
								context?.pressureTokens !== undefined && context?.contextWindow !== undefined
									? `${formatTokens(context.pressureTokens)} / ${formatTokens(context.contextWindow)}`
									: '—',
							),
						),
						h(
							'div',
							{ className: 'token-hud-bar', key: 'bar' },
							h('div', {
								className: 'token-hud-fill',
								'data-level': level,
								style: { width: `${Math.max(0, Math.min(100, percent ?? 0))}%` },
							}),
						),
					);
				}
				if (options.showSpeed) {
					body.push(
						h(
							'div',
							{ className: 'token-hud-row', key: 'speed' },
							h('span', { className: 'token-hud-label' }, t('hud.speed')),
							h(
								'span',
								{ className: 'token-hud-value' },
								speed === null
									? running
										? t('hud.running')
										: '—'
									: h(
										'span',
										null,
										h('span', { className: 'token-hud-speed' }, `${speed.toFixed(1)} ${t('hud.perSecond')}`),
										h('span', { className: 'token-hud-muted' }, t('hud.lastResponse')),
									),
							),
						),
					);
				}
				if (options.showSplit) {
					body.push(
						h(
							'div',
							{ className: 'token-hud-split', key: 'split' },
							h('span', { className: 'token-hud-chip' }, h('span', { className: 'token-hud-label' }, t('hud.input')), formatTokens(totals?.input ?? 0)),
							h('span', { className: 'token-hud-chip' }, h('span', { className: 'token-hud-label' }, t('hud.output')), formatTokens(totals?.output ?? 0)),
							h('span', { className: 'token-hud-chip' }, h('span', { className: 'token-hud-label' }, t('hud.cache')), formatTokens((totals?.cacheRead ?? 0) + (totals?.cacheWrite ?? 0))),
						),
					);
				}
			}

			return body;
		}

		return {
			inject: ['slots', 'locale'],
			__test: {
				renderBody,
				levelOf,
				formatTokens,
				readPos,
				writePos,
				clamp,
				readSettings,
				writeSettings,
				normalizeSettings,
				DEFAULTS,
				RANGES,
				TokenHudCard,
				ComposerSessionBridge,
			},
			apply(ctx) {
				ctx.effect(() => ctx.locale.register(NS, 'en', en), 'token-hud: en dictionary');
				ctx.effect(() => ctx.locale.register(NS, 'zh', zh), 'token-hud: zh dictionary');
				ctx.effect(() => {
					const style = document.createElement('style');
					style.dataset.plugin = 'dsh-session-token-hud';
					style.textContent = CSS;
					document.head.appendChild(style);
					return () => {
						style.remove();
					};
				}, 'token-hud: card styles');
				ctx.slots.inject('conversation.composer.dock', () =>
					ctx.slots.register(
						{
							name: 'conversation.composer.dock',
							id: 'token-hud.session-bridge',
							order: 900,
						},
						ComposerSessionBridge,
					),
				);
				ctx.slots.inject('shell.overlay', () =>
					ctx.slots.register(
						{
							name: 'shell.overlay',
							id: 'token-hud.card',
							order: 80,
							locale: NS,
						},
						TokenHudCard,
					),
				);
			},
		};
	},
});
