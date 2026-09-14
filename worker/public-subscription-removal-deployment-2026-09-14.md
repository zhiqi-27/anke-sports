# 公共订阅入口移除发布 · 2026-09-14

## 发布内容

- 客户端提交：`722edc7`。
- Cloudflare Worker：`anke-sports-web`。
- 当前版本：`5c7c9bc3-6585-4601-9b88-703e806ca926`。
- 回滚版本：`a87681cd-476e-41b3-9e08-c287e8d25bc4`。
- 地址：<https://sports.anke-ai.com/subscription>。

正式静态构建使用现有 Firebase Web 公开配置。Wrangler 4.131.0 dry-run 与最终发布均读取 76 个静态资源；最终发布上传 36 个变化资源并复用 27 个资源。Azure 开发 API origin、自定义域名和后端部署均未修改。

首次版本 `bb25fee6-1592-4095-82b6-90203f505269` 在构建期间可能带入工作区并行出现的两行未提交视觉 Token 修改，随后立即被干净提交 `ff37f9d` 的独立 worktree 构建覆盖。最终公网 CSS 与该干净构建 SHA-256 一致；并行修改仍只保留在原工作区。

## 公网回读

- `/subscription` 返回 HTTP 200，匿名浏览器只显示个人日历登录/创建状态和个人订阅管理，不显示公共订阅入口。
- 页面网络请求没有 `/api/v1/public-feed`；`/api/v1/status` 为 200，匿名 `/api/v1/me/calendar` 为预期的 401。
- Azure `PUBLIC_FEED_SOURCE_ALLOWLIST` 仍为 `[]`；公网公共 Feed 路由仍存在，以 `jolpica:f1` 查询返回 HTTP 200 / `unavailable`。
- 最终公网 CSS 与干净构建产物 SHA-256 均为 `456f2083a0a4ee5671dbc892c2294ca391de078d6ee2562bc3923c602f02a1fa`。

这证明现有开发环境 Web 已移除公共订阅入口，并且保留的公共 Feed 后端仍处于关闭状态。本次未修改 Azure 代码、白名单、真实账号、关注或个人日历。
