# 球队日历 Web 开发部署证据

日期：2026-09-18（Asia/Shanghai）

- Worker：`anke-sports-web`，版本 `5353ebbd-ce13-4514-ad16-4edd049b2003`，域名 `sports.anke-ai.com`。
- `npm run deploy:web` 完成生产形状构建、Firebase 配置检查、Wrangler dry-run 和正式上传；构建读取 93 个静态资源，上传 34 个变化资源。
- 公网 `/`、`/calendar`、`/api/v1/health`、`/api/v1/status` 均回读成功；API 代理运行时为 `staging/cosmos`。
- 当前登录态点击 Liverpool 关注项后进入 `/calendar?team=football-data%3Ateam%3A64`，显示 `Liverpool FC 日历`、球队赛程和 `返回我的日历`；本次未修改账号数据。
- 本次未 push Git，未发布正式环境；球队页当前数据是否包含其他赛事仍取决于服务端上游快照刷新。
