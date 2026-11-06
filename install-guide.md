# 安装 dsh-session-token-hud

前提：你已经有能打开 Web 界面的 DeepSeek Harness（桌面端或 `dsh web`），并且能进入 **设置 → 插件**。

## 最快的一条路（对方把包给你）

1. 拿到 `dsh-session-token-hud-1.0.0.tgz`（或整个 `dsh-session-token-hud` 目录），解压/放到本机任意位置，例如 `C:\Users\you\plugins\dsh-session-token-hud-1.0.0.tgz`。
2. 打开 Harness 的 **设置 → 插件**，点 **添加插件**。
3. 在"包名或地址"里粘贴**绝对路径**：

   ```text
   C:\Users\you\plugins\dsh-session-token-hud-1.0.0.tgz
   ```

   解压成目录的话就填目录：

   ```text
   C:\Users\you\plugins\dsh-session-token-hud
   ```

4. 等安装完成，刷新页面（Ctrl+R）。右侧出现悬浮卡片即成功。

> 弹出"这个包已经安装"时，先在同一个页面卸载同名插件，再装。

## 从 npm 装（发布之后）

**设置 → 插件 → 添加插件**，填：

```text
dsh-session-token-hud
```

需要指定版本就写 `dsh-session-token-hud@1.0.0`。

## 从 Git 仓库装

同一个输入框接受仓库地址，例如：

```text
https://github.com/<you>/dsh-session-token-hud
```

## 让 agent 代装

把下面这句话发给 Harness 里的 agent（它调用的 `plugin_manager` 工具与此对话框等价）：

```text
用 plugin_manager 给这个 profile 安装 dsh-session-token-hud，目标地址是 <绝对路径或包名>
```

## 卸载

**设置 → 插件** 里找到 `Token 用量`（包名 `dsh-session-token-hud`）→ 卸载 → 刷新页面。

## 排错

- **卡片没出现**：先 Ctrl+R 强刷；仍没有就打开开发者工具 Console 看有没有加载报错。
- **卡片显示"暂无会话"**：当前页面还没绑定会话，切到一个对话即可。
- **数字一直不动**：卡片每秒轮询一次；如果界面在后台标签页，浏览器的定时器会被节流，切回前台即恢复。
- **速度显示"—"**：说明这一轮还没有完成的响应；生成中会显示"生成中"。

## 维护者：更新一版并发给别人

```powershell
# 1. 改 package.json 的 version
# 2. 重新打包（在包目录里）
node C:\Users\tao\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs pack
# 3. 本机先卸载旧版再装新版
```

产出新的 `dsh-session-token-hud-<version>.tgz`，直接发这一个文件即可。`pnpm pack` 只打 `files` 白名单里的文件，所以新增文件记得写进 `package.json` 的 `files`。

## 安全

插件以你的权限在本机运行，只信任你确实看过的源码。本插件的 Host 半边只注册一个只读路由，不写文件、不发起外部请求。
