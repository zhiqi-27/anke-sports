# A 范围清理与契约 · Web 开发环境发布证据

日期：2026-09-17（Asia/Shanghai）  
状态：`anke-sports-web` 已发布到开发域名；生产、设备验收和正式公开发布未宣称完成。

## 发布

- 提交：`dc15b05a66bc808fbc0cbaf2965af19dd8f8336b`，已推送到 `origin/main`。
- 构建：静态导出成功，Firebase Web public 配置校验通过；Worker dry-run 读取 93 个资源。
- Wrangler 发布：上传 34 个新/修改资源，Worker 版本 `1910dc1e-75f0-4498-8028-2d942a59ef7a`，绑定 `sports.anke-ai.com`。
- API origin：仍指向开发 Azure Function App `anke-sports-dev-mtcflttk`。

## 公网回读

- `https://sports.anke-ai.com/`：HTTP 200，`text/html`。
- `https://sports.anke-ai.com/connect`：HTTP 200，`text/html`。
- `/api/v1/health`：返回 `ok` / `staging` / `cosmos`。
- `/api/v1/status`：Firebase 已配置，现行 Provider 状态正常。

## 范围与限制

视频导航、创作者入口、旧单场 `selection` 调用和相关展示已随本次客户端提交移除；直播与陪看链接仍保留。手动单场增删 UI、MCP 对等写入、设备 ICS/播放、全新登录和正式发布仍未完成或验收。
