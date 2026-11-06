# 发布到 npm

## 现状（已确认）

| 项 | 结果 |
| --- | --- |
| 包名 `dsh-token-hud` | ❌ 已被 `chy007-fun` 占用（0.1.0 / 0.1.1 / 0.2.0，另一个全局聚合版 HUD） |
| 本包新名 | ✅ `dsh-session-token-hud@1.0.0`，已重新打包并从 `.tgz` 安装验证（槽位 active、路由 401/404 正常） |
| npm 凭据 | ❌ `C:\Users\tao\.npmrc` 只有 `registry=https://mirrors.huaweicloud.com/repository/npm/`，无 `_authToken`；无 `NPM_TOKEN`/`NODE_AUTH_TOKEN` |
| 官方源连通性 | ❌ `curl https://registry.npmjs.org/...` 超时（HTTP 000），无系统代理；`registry.npmmirror.com` 亦不通；只有华为云镜像可达（只读，不能发布） |
| 工具 | node `C:\Users\tao\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe`，pnpm `...\dependencies\pnpm\bin\pnpm.mjs`（v11.28.5，可 `publish`）；无 npm CLI |

所以「发布」这一步卡在两件事：**网络到 registry.npmjs.org 不通**，以及**没有 npm 认证 token**。拿到 token 也必须先能连上官方源。

## 路线 A：本机发布（需要能访问 registry.npmjs.org 的网络）

1. 在 npmjs.com 生成 Granular Access Token（Read/Write，限定本包或全部公开包）。
2. 写进用户级 `.npmrc`（只用于发布，镜像源配置保留）：

   ```ini
   //registry.npmjs.org/:_authToken=NPM_TOKEN_HERE
   ```

3. 发布（`--registry` 覆盖镜像源）：

   ```powershell
   cd C:\Users\tao\Documents\deepseek-harness\default-workspace\token-hud-publish
   & 'C:\Users\tao\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe' `
     'C:\Users\tao\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs' `
     publish --registry https://registry.npmjs.org --no-git-checks --access public
   ```

4. 验证：`curl https://registry.npmjs.org/dsh-session-token-hud` 返回 200，`dist-tags.latest = 1.0.0`。

## 路线 B：GitHub Actions 发布（本机网络不通时推荐）

仓库里已放 `.github/workflows/publish.yml`（打 `v*` tag 或手动触发即发布，用 `secrets.NPM_TOKEN`）。

```powershell
cd C:\Users\tao\Documents\deepseek-harness\default-workspace\token-hud-publish
git init; git add -A; git commit -m "dsh-session-token-hud 1.0.0"
# 建好 GitHub 仓库后
git remote add origin https://github.com/<你>/dsh-session-token-hud.git
git push -u origin main
git tag v1.0.0; git push origin v1.0.0
```

在仓库 Settings → Secrets and variables → Actions 添加 `NPM_TOKEN`。GitHub 的 runner 能直连 npm，不依赖本机网络。

## 发布之后，别人怎么装

DSH Web → 设置 → 插件 →「添加插件」，填 `dsh-session-token-hud`（或 `dsh-session-token-hud@1.0.0`），确认后刷新页面。
