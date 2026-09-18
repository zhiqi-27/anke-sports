# 赛果标题与防剧透 Web 开发部署记录

日期：2026-09-18（Asia/Shanghai）

## 已发布

- Git 提交：`330a885`（`feat: finalize calendar result experience`），已推送 `main`。
- 设置页保留最短操作说明：“隐藏关注球队最近一场完赛结果”。
- 结果隐藏由服务端按关注球队和最近一场已结束比赛计算，客户端不复制业务规则。

## 构建与部署

- `npm run typecheck`、生产构建、Wrangler dry-run、`git diff --check` 通过。
- Worker：`anke-sports-web`。
- 当前版本：`8aab3517-1c70-43de-887d-b7f91aad679b`。
- 自定义域名：`sports.anke-ai.com`。
- 构建所需开发 Firebase Web 配置仅通过进程环境注入，未写入 `.env`、未提交凭据。

## 线上回读

- `/`、`/calendar`、`/following`、`/settings` 均返回 HTTP 200。
- 代理 `/api/v1/health`、`/api/v1/status` 返回 HTTP 200；未认证个人单场写入返回 HTTP 401。
- 本轮只做路由、公开 API 和未认证边界回读；未修改真实账号资料或个人日历数据。

## 边界

- 本次只部署开发 Web，正式环境未变更。
- 未在本轮重新执行完整登录态浏览器交互、设备 ICS 刷新或移动端播放验收。
