# 日历订阅侧栏空状态入口移除

更新时间：2026-09-18（Asia/Shanghai）

## 变更

移除侧栏“我的关注”空状态中的“添加你喜欢的球队”链接；保留侧栏标题右侧的“添加关注”入口。

## 验证

- `npm run typecheck`：通过。
- `git diff --check`：通过。
- `npm run build:deploy`：通过，Firebase Web 配置校验通过。
- Wrangler dry-run：通过。
- 开发 Worker 发布版本：`6aaf037b-4878-4a1d-8f69-46089abb5243`。
- 已登录订阅页刷新回读：侧栏没有“添加你喜欢的球队”，页面主流程和顶部“添加关注”仍正常。

正式环境未变更，未 push Git。
