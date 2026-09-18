# 直播优先入口与场馆隐藏 · 2026-09-18

状态：已部署到开发环境；正式环境未变更。

## 客户端行为

- 事件抽屉沿用服务端返回顺序，将第一条符合地区和赛事条件的入口标为“优先入口”。服务端已有用户首选直播方排序，客户端不重复实现业务选择规则。
- 已核验 `verified_https_app_link` 的链接在移动端点击时继续使用 HTTPS App Link 跳转，未安装对应 App 时回退到网页；设置页和详情页都明确这条边界。
- 日历事件抽屉和日程列表均不再显示场馆信息。后端 `venue` 契约保留给现有数据和日历投递，不在 Web 界面呈现。

## 验证

- `npm run typecheck`：通过。
- `npm run build`：通过。
- `uv run pytest -q tests/test_document_broadcasts.py tests/test_video_retirement.py`：10 passed，2 warnings。
- `git diff --check`：通过。

## 发布边界

- 最终开发 Web 为 Worker `6075003c-4f4c-4bfd-8d91-f69790c39a55`；本轮未 push Git。
- 后端同步发布了精简日历描述，最终 OneDeploy 为 `66aa80f1-3fa0-4cf3-9055-c98b23d6ba0c`；既有未提交登录修复工作保持不变。
