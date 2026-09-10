# Anke Sports

选择球队与赛事，以个人日历订阅交付赛程和原始观看链接。原产品名 SportsCal。

本仓拥有桌面 Web、Chrome 扩展本地实现与生成的 API 契约。后端独立仓库为 `anke-sports-cloud`，开发、生产目标均为 Firebase Authentication、FastAPI、Azure Functions、Cosmos Serverless + Periodic 与 Storage Queue；文档日历接口、后台投递和 Feed 发布已通过独立本地流程，主预览仍保留 SQL，完整 Cosmos 迁移尚未完成。

新存储验收：[日历](http://localhost:3007/calendar) / [我的关注](http://localhost:3007/following)，独立临时文档库、12条演示比赛与单独 worker。已覆盖日历/关注/私人 ICS、个人链接/屏蔽/固定、单场选择与配置导入；创作者/直播/OAuth 等功能尚未迁移。见 [服务端证据](../anke-sports-cloud/evidence/document-content-2026-09-10.md)。

## 本机检查

Node.js 24，先按后端 README 启动 API 与 worker。

```sh
npm ci
npm run dev
```

打开 http://127.0.0.1:3000/calendar 。首次通过「进入本地体验」保存关注。合成 NBA/足球/F1 赛程标记为演示；真实赛程独立切换，当前已接入 Jolpica F1 样本。浏览时区与筛选不修改持久关注。

可检查：月/周/日程切换，比赛抽屉，关注变更预览与确认保存，手动链接，个人 Feed 复制/下载/暂停/轮换，设置与导入预览。关注预览显示新增、移除、重叠保留和历史比赛，赛程变化后要求重新预览。下载 ICS 为单次快照；持续订阅需要 URL，手机订阅需要正式可达的 HTTPS 环境。

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

本地体验身份与 SQLite 只用于本机检查。Chrome 真实 Firebase 登录、专用真实 Firebase 测试身份的撤销/删除清理，以及独立合成环境的 Codex MCP 业务调用已验证。本机隔离 API/worker 已读取 69 条真实 YouTube 视频，尚未自动附入日历；Hub、官方直播、Chrome 扩展安装、手机刷新与 Azure 环境仍待验收。Cosmos 模板已通过 Azure validate，资源尚未创建；后续按实测负载评估原地转 Provisioned → Autoscale。各项证据与剩余范围见 `STATE.md` 及相邻服务仓 `docs/cosmos-storage-design.md`。

`/connect` 与设置中的「已连接的应用」已接入共用授权服务。支持逐项权限确认、独立私人地址权限、到期显示与撤销；官方 SDK 的本地 HTTP 授权流程已验证。安装的 Codex CLI 0.153.4 已完成本地只读授权、私人11个/公共3个工具发现，Web撤销后私人工具为0；后续独立合成环境已完成实际Codex查询/关注与链接写入/幂等/权限拒绝/导入导出/模拟到期刷新/撤销、HTTP ICS稳定UID与200/304共25项检查；自然时间过期、Firebase与MCP组合及云端仍待验收。复现命令和 MCP 入口见相邻服务仓的 `docs/mcp-and-connections.md`。

服务端赛程查询已改为按日期筛选、分页后批量读取链接；本机两万场活动数据的HTTP实测与边界见相邻服务仓 `evidence/schedule-queries-2026-09-10.md`。本批接口和客户端源码未变，当前月历及事件抽屉已在运行页面检查。

`AGENTS.md` 定义结果、不变量和工作边界，避免重复许可与僵硬步骤。`STATE.md` 记录当前证据与下一步。CI 只检查，不部署；两个仓库分别提交和发布。

创作者管理已接入频道预览确认、范围和内容偏好、暂停/恢复、检查更新、删除影响、待确认视频与固定链接。本地合成端到端验证见 `../anke-sports-cloud/docs/content-pipeline.md`；主预览不会伪造 YouTube 结果。

维护者可在 `/maintenance` 保存直播草稿、审核来源与地区/观看条件、发布、撤回及记录设备观察。身份由后端白名单控制，默认不授予本机账号。隔离合成验收页面为 http://localhost:3001/maintenance ，复现说明与证据见相邻服务仓的 `docs/broadcasts.md`、`evidence/local-2026-09-10.md`；主体验库不插入合成官方入口。

设置中的数据源状态会随后台任务更新，显示处理中、等待、失败与最早重试；无需手动刷新。后台来源更新不代表手机日历已显示。缺少配置时保留最后有效赛程，恢复说明见相邻服务仓的 `docs/job-recovery.md`。

订阅页新增无需登录的公共球队/赛事日历：选择来源、复制公开地址、下载一次性ICS。切换到个人日历时提示在系统日历移除旧公共订阅。真实游客操作与下载文件校验见 `../anke-sports-cloud/evidence/public-feeds-2026-09-10.md`。

账号删除包含确认、SDK退出及游客提示，账号失效时清空个人界面；本地共享体验账号的删除按钮保持禁用。隔离合成账号网页与并发验收见 [删除验收](../anke-sports-cloud/evidence/privacy-2026-09-10.md)，真实Firebase删除及设备缓存仍待测试。

后台已完成本机20k比赛、1,000账号的共享视频通知到Feed容量实验，UI与API契约保持一致。完整数据、重复发布和云端限制见 [内容容量验收](../anke-sports-cloud/evidence/content-capacity-2026-09-10.md)。

创作者页已接入共享YouTube等待状态与自动恢复提示；独立项目/Key 已创建并在 Cloud Shell 完成三次真实公共读取，本机安全下载和应用联调仍待完成，见 [接入进度](../anke-sports-cloud/docs/youtube-development.md)。状态由后端提供，界面不计算配额或匹配规则。详见 [本地验收](../anke-sports-cloud/evidence/youtube-budget-2026-09-10.md)。
