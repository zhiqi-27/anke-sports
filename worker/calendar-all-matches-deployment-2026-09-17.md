# 登录日历全部比赛发布证据 · 2026-09-17

日期：2026-09-17（Asia/Shanghai）
状态：已发布到开发 Web；正式环境未变更。

## 发布

- Worker：`anke-sports-web`
- 版本：`3c8ab1b6-c0fe-4657-afa5-5a06309c8ae0`
- 域名：`https://sports.anke-ai.com`
- API origin：`anke-sports-dev-mtcflttk.azurewebsites.net`（开发 Function App）
- 构建：静态导出、Firebase Web 配置校验、Wrangler dry-run 均通过。
- 资源：dry-run 读取 93 个资源；本次上传 34 个新或修改资源。

## 公网回读

- `/calendar`：HTTP 200。
- `/api/v1/health`：`ok` / `staging` / `cosmos`。
- `/api/v1/status`：Firebase 已配置，存储为 Cosmos。
- 已登录浏览器回读：显示“我的关注／全部比赛”；全部模式显示 52 场赛事。
- 选择 NBA 后显示 1 场；球队菜单显示“搜索球队”，可查询其他球队。
- 打开 Miami Heat @ Toronto Raptors 详情：显示“手动加入个人日历”和“只加入这一场比赛，不会关注整支球队”。

## 边界

- 本次没有点击手动加入，不改变测试账号的个人日历数据。
- 没有 push Git；客户端和后端既有未提交改动均保留。
- 以上是开发环境与浏览器回读证据，不代表真实账号写入、设备 ICS、正式发布或公开发布验收。
