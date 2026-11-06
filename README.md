# Token HUD

给 DeepSeek Harness Web 界面加一块可拖动的悬浮卡片，实时显示当前会话的：

- **用量** —— 输入 + 输出 token 累计，以及"多少次响应"
- **上下文占用** —— 最近一次请求的 prompt 大小 / 模型上下文窗口，带进度条（≥80% 变黄，≥95% 变红）
- **速度** —— 最近一次响应实测的 tok/s（`outputTokens / 生成时长`）
- **明细** —— 输入 / 输出 / 缓存 token

数据全部来自会话日志和 `tokenMeter` 服务，不估算、不编造。

## 安装

三种方式，任选其一。安装后在设置里能看到 `Token 用量`，刷新页面即可看到卡片。

### 1. 从 npm 安装（发布后）

```text
设置 → 插件 → 添加插件 → dsh-session-token-hud
```

### 2. 从本地目录安装

把本目录放到本机任意位置，然后在同一对话框里填**绝对路径**：

```text
C:\Users\you\plugins\dsh-session-token-hud
```

### 3. 从压缩包 / Git 地址安装

对话框同样接受 tarball 地址和 Git 仓库：

```text
https://example.com/dsh-session-token-hud-1.0.0.tgz
https://github.com/you/dsh-session-token-hud
```

也可以让 Harness 里的 agent 代劳，例如让它执行"用 plugin_manager 安装 C:\Users\you\plugins\dsh-session-token-hud"。

详见 [install-guide.md](install-guide.md)。

## 使用

- 卡片默认在右上角，按住卡片任意位置拖动（按钮除外），位置会记住。
- 点标题行或 ▾ 折叠成小胶囊。
- 点 ⚙ 调整宽度、模糊半径、背景不透明度，以及四行内容的显示开关；设置即时生效并记住。
- 中英文跟随界面语言。

## 原理

Host 半边注册一个同源路由 `GET /token-hud/state?session=<id>`（经 `connection.admit` 鉴权），按 `session.seq` 增量折叠会话事件：`assistant/message` 的 `usage` 累加出用量，`stream` 的 `time0 + Σdt` 算出生成时长，`turn/start`…`turn/end` 判断是否在生成；上下文占用取自 `tokenMeter.contextPressure`。Client 半边每秒轮询一次，用 `shell.overlay` 渲染卡片，并用 `composer.dock` 里的一个零宽条目拿到当前会话 id。

## 开发

```powershell
node test/hud.test.mjs
node test/client.test.mjs
```

改动 Client 半边后需要重新加载页面；重新安装前先卸载同名包。

## License

MIT
