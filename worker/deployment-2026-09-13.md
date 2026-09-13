# P0 日历体验发布

时间：2026-09-13 08:34–08:36（Asia/Shanghai）

## 发布对象

- 客户端源代码基线：`13ca8b75cb6d2ff4edf097617a682c9d65e2771e`
- Cloudflare Worker：`anke-sports-web`
- 自定义域名：<https://sports.anke-ai.com/calendar>
- Worker 版本：`a4580a3e-3781-40be-b270-1dc80ee28a95`
- Azure API 仍为开发环境 `anke-sports-dev-mtcflttk`，本次没有重发后端。

## 发布前检查

- 使用线上公开 Firebase Web 配置完成 `ANKE_SPORTS_STATIC_EXPORT=true npm run build`，Next.js 生产构建和 TypeScript 检查通过。
- `npx wrangler deploy --dry-run` 读取 76 个静态文件并完成打包，未上传。
- 当前后端源包 SHA-256 为 `540961d4c13f32db9866a46703652ed91794e34d47522b6110822dfdb5a2bf46`，与已有 Azure 部署归档一致，因此没有制造内容相同的新部署。
- Azure 资源读回为 `Running`、`httpsOnly=true`；直连 `/api/v1/status` 为 HTTP 200、`Cache-Control: no-store`。

## 发布与公网读回

- `npx wrangler deploy` 成功上传 37 个新增或变化的静态资产，26 个资产复用；自定义域名触发器发布成功。
- 公网 `/calendar` 为 HTTP 200，真实浏览器渲染标题、日历控件和 51 场公开比赛。
- 公网静态 JS 已读到本次新增的“我的关注”“全部赛事”“这个时间段还没有关注的比赛”和“已检查随后 180 天的已接入赛程”等文案。
- 公网 `/api/v1/status` 为 HTTP 200，Cloudflare 到 Azure 代理正常，`firebase_configured=true`、`local_preview=false`、storage=`cosmos`，三个 Provider 均 enabled/idle 且 error 为空。
- 公网匿名 `/api/v1/me/calendar` 为 HTTP 401，响应与 CDN 均为 `no-store`。
- 浏览器控制台的两个个人日历 401 是未登录探测的预期结果；另有既有 `/favicon.ico` 404。没有前端运行崩溃。

## 证据边界

本次确认开发环境 Web 已部署并可公开读取，不等于正式生产发布或完整 v1 上线。登录后默认“我的关注”、保存冲突重算和取消 F1 后个人赛车为 0 场已在本地真实端到端流程验证；本次没有使用公网用户账号重新修改关注。系统日历是否移除未来 F1 仍需个人 Feed 发布后由日历客户端刷新读回，历史比赛继续保留是既定行为。

没有执行 Git push，也没有新建 Azure/Cloudflare/Firebase 资源或修改私人 Feed 地址。
