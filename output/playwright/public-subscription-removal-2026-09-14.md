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
