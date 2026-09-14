# 公共订阅入口移除发布 · 2026-09-14

## 发布内容

- 客户端提交：`722edc7`。
- Cloudflare Worker：`anke-sports-web`。
- 当前版本：`bb25fee6-1592-4095-82b6-90203f505269`。
- 回滚版本：`a87681cd-476e-41b3-9e08-c287e8d25bc4`。
- 地址：<https://sports.anke-ai.com/subscription>。

正式静态构建使用现有 Firebase Web 公开配置。Wrangler 4.131.0 dry-run 与发布均读取 76 个静态资源；发布上传 38 个变化资源并复用 25 个资源。Azure 开发 API origin、自定义域名和后端部署均未修改。

## 公网回读

- `/subscription` 返回 HTTP 200，匿名浏览器只显示个人日历登录/创建状态和个人订阅管理，不显示公共订阅入口。
- 页面网络请求没有 `/api/v1/public-feed`；`/api/v1/status` 为 200，匿名 `/api/v1/me/calendar` 为预期的 401。
- Azure `PUBLIC_FEED_SOURCE_ALLOWLIST` 仍为 `[]`；公网公共 Feed 路由仍存在，以 `jolpica:f1` 查询返回 HTTP 200 / `unavailable`。

这证明现有开发环境 Web 已移除公共订阅入口，并且保留的公共 Feed 后端仍处于关闭状态。本次未修改 Azure 代码、白名单、真实账号、关注或个人日历。
