# 公共订阅入口移除验收 · 2026-09-14

## 本地构建与浏览器

- `npm run typecheck` 通过。
- `npm run build` 通过。
- Playwright CLI 打开 `/subscription` 后，页面仅展示“你的个人体育日历”、个人订阅地址和 Apple/Google 日历说明。
- 页面请求包含 `/api/v1/status` 与 `/api/v1/me/calendar`，没有请求 `/api/v1/public-feed`。
- 本地浏览器未启动 API 服务，因此上述两个个人接口返回代理连接失败；该检查只证明前端入口和请求已移除，不作为账号或云端个人日历验收。

## 后端边界

- 云端公共 Feed 代码未删除，Azure 开发环境 `PUBLIC_FEED_SOURCE_ALLOWLIST` 读回为空数组。
- 官方转播仍通过赛事内容选择链路进入公开赛事详情和个人 Feed，不依赖 Web 公共订阅组件。
- 后端转播与内容定向回归：`55 passed`，另有 2 条依赖弃用警告。

## 开发环境回读

- Cloudflare Worker `bb25fee6-1592-4095-82b6-90203f505269` 已发布，上一版本 `a87681cd-476e-41b3-9e08-c287e8d25bc4` 可用于回滚。
- 公网 `/subscription` HTTP 200；匿名浏览器只显示个人日历登录/创建状态、个人订阅管理及 Apple/Google 日历说明。
- 网络请求中没有 `/api/v1/public-feed`；匿名 `/api/v1/me/calendar` 返回预期的 401。
- 公网以 `jolpica:f1` 查询保留的公共 Feed 路由，HTTP 200 且业务状态为 `unavailable`，与空白名单一致。
