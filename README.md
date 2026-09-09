# Anke Sports

选择球队与赛事，以个人日历订阅交付赛程和原始观看链接。原产品名 SportsCal。

本仓拥有桌面 Web、Chrome 扩展本地实现与生成的 API 契约。后端独立仓库为 `anke-sports-cloud`，权威业务使用 Firebase Authentication、FastAPI、Azure Functions/MySQL/Storage Queue。

## 本机检查

Node.js 24，先按后端 README 启动 API 与 worker。

```sh
npm ci
npm run dev
```

打开 http://127.0.0.1:3000/calendar 。首次通过「进入本地体验」保存关注。合成 NBA/足球/F1 赛程标记为演示；真实赛程独立切换，当前已接入 Jolpica F1 样本。浏览时区与筛选不修改持久关注。

可检查：月/周/日程切换，比赛抽屉，关注保存，手动链接，个人 Feed 复制/下载/暂停/轮换，设置与导入预览。下载 ICS 为单次快照；持续订阅需要 URL，手机订阅需要正式可达的 HTTPS 环境。

Apple Sports 作为视觉语言参考；信息架构仍是桌面日历，不包含原生手机 App 或体育资讯门户。

## 检查与契约

```sh
npm run typecheck
npm run build
```

类型由后端 OpenAPI 生成，已生成文件随仓库保存，独立 checkout 可构建。两仓并列开发、后端契约更新后执行：

```sh
npm run contracts
```

依赖精确解析结果在 `package-lock.json`；`js-yaml` override 使用已修复版本，当前安装审计为 0 vulnerabilities。

## Chrome 扩展

运行 `npm run extension:build` 生成本地 MV3 安装目录与 ZIP；`npm run extension:test` 执行边界与打包检查。运行 `npm run extension:preview` 后可在 http://127.0.0.1:18792 检查380×560合成界面。账号、当前视频和保存结果在这个预览中均为合成，不会访问真实数据。安装、权限与会话说明见 [extension/README.md](extension/README.md)，证据见 [extension/evidence.md](extension/evidence.md)。

## 当前边界

本地体验身份与 SQLite 只用于本机检查。Firebase 真实登录、YouTube 自动通知/匹配、官方直播审核、Chrome 扩展、目标 MCP 客户端、手机日历刷新、Azure 环境尚未完成验收。

`/connect` 与设置中的「已连接的应用」已接入共用授权服务。支持逐项权限确认、独立私人地址权限、到期显示与撤销；官方 SDK 的本地 HTTP 授权流程已验证。复现命令和 MCP 入口见相邻服务仓的 `docs/mcp-and-connections.md`。

`AGENTS.md` 定义结果、不变量和工作边界，避免重复许可与僵硬步骤。`STATE.md` 记录当前证据与下一步。CI 只检查，不部署；两个仓库分别提交和发布。

创作者管理已接入频道预览确认、范围和内容偏好、暂停/恢复、检查更新、删除影响、待确认视频与固定链接。本地合成端到端验证见 `../anke-sports-cloud/docs/content-pipeline.md`；主预览不会伪造 YouTube 结果。

维护者可在 `/maintenance` 保存直播草稿、审核来源与地区/观看条件、发布、撤回及记录设备观察。身份由后端白名单控制，默认不授予本机账号。隔离合成验收页面为 http://localhost:3001/maintenance ，复现说明与证据见相邻服务仓的 `docs/broadcasts.md`、`evidence/local-2026-09-10.md`；主体验库不插入合成官方入口。

设置中的数据源状态会随后台任务更新，显示处理中、等待、失败与最早重试；无需手动刷新。后台来源更新不代表手机日历已显示。缺少配置时保留最后有效赛程，恢复说明见相邻服务仓的 `docs/job-recovery.md`。

订阅页新增无需登录的公共球队/赛事日历：选择来源、复制公开地址、下载一次性ICS。切换到个人日历时提示在系统日历移除旧公共订阅。真实游客操作与下载文件校验见 `../anke-sports-cloud/evidence/public-feeds-2026-09-10.md`。
