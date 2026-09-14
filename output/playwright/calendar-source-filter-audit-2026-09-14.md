# 游客与公共日历二级筛选验收

日期：2026-09-14

## 边界

- 本地 Next.js 客户端通过同源代理读取已部署的 Azure 开发 API。
- 游客日历使用开发 API 的真实 `real` 数据集进行验证。
- 当前开发环境的公共 Feed 能力未开放；公共日历选择器使用 Playwright 仅 mock Feed 响应来验证客户端交互与请求参数，不作为公共 Feed 已部署或可订阅的证据。
- 浏览器中的 `/me/calendar` 401 是匿名访问预期结果。

## 结果

- 游客日历首次进入默认选择 F1，第一层只有 F1、NBA、英超。
- 选择 NBA 后才出现第二层球队选择，共 30 支；未选择球队时旧 F1 赛程立即清空，并提示先选择球队。
- 选择 San Antonio Spurs 后，日历按 `source_id=balldontlie:team:27` 加载，没有读取整个 NBA。
- 公共日历默认选择 F1；选择英超后才出现第二层球队选择，共 20 支。
- 选择 Liverpool FC 后发出的请求为 `/public-feed?source_key=football-data%3Ateam%3A64`，没有请求整个英超。
- 两处使用同一个 `ScheduleSourcePicker`，第一层与第二层规则一致。

## 截图

- `guest-calendar-default-filter.png`：游客日历默认 F1。
- `public-calendar-two-level-filter.png`：公共日历选择英超后的球队二级筛选（Feed 响应为本地 mock）。

## 静态检查

- `npm run typecheck`：通过。
- `npm run build`：通过。
- `git diff --check`：通过。
