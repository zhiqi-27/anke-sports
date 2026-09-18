# 手动链接类型契约 · 开发环境联合发布

日期：2026-09-18（Asia/Shanghai）

## 发布结果

- 后端个人链接安全范围与人工类型契约发布到 Azure 开发 Function App `anke-sports-dev-mtcflttk`；OneDeploy：`777d3cf6-424d-4849-b17f-07e95d04ce1e`。
- Web 发布到 `https://sports.anke-ai.com` 的 Cloudflare Worker `anke-sports-web`；版本：`a84c5e18-ebc3-4302-9846-0d57edea1df3`。
- 正式环境、Git push、基础设施、RBAC、配置和用户数据均未修改。

## 发布前验证

- 后端全量测试：`252 passed, 2 skipped`；Ruff、OpenAPI 导出、客户端合同生成、Web typecheck、生产构建和 diff check 通过。
- 后端包：`anke-sports-manual-link-type-20260918.zip`，85 个运行时文件、192248 字节，SHA-256 `d237272f3348ff24d62987f1443e6e78c7c51670cbcf43eac66595f2d2ddc06a`。
- Wrangler 4.131.0 认证、Firebase Web 配置检查和 `wrangler deploy --dry-run` 通过。

## 线上回读

- Azure Function App 回读为 Running；直连 health/status 均 HTTP 200，运行时为 `staging/cosmos`。
- 直连 `/openapi.json` 的 `AddLink` 只含 `url` 和 `title`，线上没有人工 `kind` 输入字段。
- `https://sports.anke-ai.com/calendar` HTTP 200，API 代理 `/api/v1/health` HTTP 200。
- 已发布人工添加表单脚本不含 `name="link-kind"`；官方维护页面的历史内容类型文案仍属于内部维护契约，不是用户手动添加字段。

本次没有用真实账号提交/删除链接，因此不把部署成功等同于真实账号写入、个人 ICS 刷新或设备播放验收。
