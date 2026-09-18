# Anke Sports · 客户端状态

> 2026-09-17范围覆盖：不做微信、YouTube视频/AI匹配；新增手动单场增删，关注自动比赛不可单删，MCP同等支持。无需兼容1.0前版本。A 范围清理与生成客户端契约已部署到开发环境；B 后端已部署并完成线上回读，客户端已同步生成类型；Web 日历范围切换与单场入口已部署到开发环境，MCP 对等行为尚未实现或验收。见[1.0定义](<../anke-sports 文档/Anke_Sports_1.0定义.md>)。

更新：2026-09-18。当前入口：[工作区STATE](../STATE.md)、[实施计划](<../anke-sports 文档/Anke_Sports_实施计划.md>)。

2026-09-18 赛果标题前端契约已同步到本地代码，尚未部署：设置页文案改为“隐藏关注球队最近一场完赛结果”，显示逻辑由服务端按关注球队分别计算；OpenAPI 生成类型已更新，Web `typecheck` 与生产构建通过。

2026-09-18 球队日历已发布到开发 Worker：侧栏关注球队可打开 `/calendar?team=<source_id>`，球队页隐藏范围切换并显示该球队跨赛事赛程；事件参与者支持直接携带队徽。Worker `5353ebbd-ce13-4514-ad16-4edd049b2003`，构建、dry-run、公网代理和已登录 Liverpool 球队日历入口回读通过；正式环境未变更。见[球队日历 Web 部署记录](worker/team-calendar-deployment-2026-09-18.md)。

2026-09-18 直播产品语义已发布到开发 Worker：默认入口由服务端按地区、联赛版权矩阵与直播偏好生成，手动附加链接覆盖官方产品；客户端同步“官方产品”标识和设置说明。Worker 版本 `6075003c-4f4c-4bfd-8d91-f69790c39a55`，已完成 dry-run、上传和登录态赛事回读。见[直播产品选择记录](worker/calendar-broadcast-product-selection-2026-09-18.md)。

2026-09-18 事件抽屉的手动移除文案、淡色纯文本样式、直播空状态说明和场馆隐藏已随本轮 Worker 发布；登录态赛事回读确认场馆字段不显示。`npm run typecheck`、生产构建、`git diff --check` 已通过。见[抽屉数据边界与本地修正](worker/calendar-drawer-data-boundaries-2026-09-18.md)。

同日追加：设置页说明保存的赛事直播方会在详情中优先打开；详情第一条入口标为“优先入口”，已核验的移动端 App Link 保持直接跳转；日历抽屉与日程列表不再显示场馆。客户端构建与类型检查通过，服务端现有广播排序回归 10 passed，并随本轮开发 Worker 发布。见[直播优先入口与场馆隐藏](worker/calendar-broadcast-priority-2026-09-18.md)。

2026-09-18 手动附加链接表单与后端个人链接契约已联合发布到开发环境：错误提示不再暗示平台白名单，且不再要求选择“直播/同步解说”；实际 URL 是否安全由服务端统一校验。后端 OneDeploy `777d3cf6-424d-4849-b17f-07e95d04ce1e`，前端 Worker `a84c5e18-ebc3-4302-9846-0d57edea1df3`；线上脚本回读不含 `name="link-kind"`。见[联合发布记录](worker/manual-link-type-deployment-2026-09-18.md)。

2026-09-18 日历与账号入口修正已发布到开发 Web：登录态“全部比赛”默认按 `jolpica:f1` 查询并移除“全部赛事”空筛选；筛选器字号与侧栏导航均为 13px。Google 登录资料默认读取 Firebase 的头像和姓名，账号面板支持选择、预览并保存压缩头像文件；文案已精简，保存与退出位于底部同一行。Worker `ffc7dae9-f5e4-48f4-963a-ee86d53dee25`，构建、dry-run 与线上已登录回读通过；未修改后端或正式环境，未在本轮提交资料保存变更。

2026-09-18 日程视图已发布到开发 Web：F1/赛车卡片显示具体赛事名，不再列出全部车队；NBA、英超等球队赛事显示球队图标与队名。Worker `582475b1-a9d5-408e-a1b8-ad7f1ffa898a`，typecheck、构建、dry-run 与线上日程回读通过。

2026-09-18 我的关注页已发布到开发 Web：移除重复说明和非操作性的“已接入赛事”，F1、NBA、英超赛事卡显示真实赛事图标。Worker `e53e3c86-8eac-4cd7-8a48-d5ae5924fb47`，构建、dry-run 和线上回读通过。见[关注页修正记录](worker/following-copy-and-competition-logos-2026-09-18.md)。

2026-09-18 日历订阅页侧栏空状态已移除“添加你喜欢的球队”入口，保留侧栏标题右侧“添加关注”。Worker `6aaf037b-4878-4a1d-8f69-46089abb5243`，构建、dry-run 和已登录订阅页回读通过；后端、正式环境与 Git 未变更。见[订阅页侧栏入口发布记录](worker/subscription-sidebar-empty-state-deployment-2026-09-18.md)。

本轮未 push Git；最新开发发布为 Worker `5353ebbd-ce13-4514-ad16-4edd049b2003`。此前删除视频产品能力与登录日历范围改动已部署。

当前开发环境已经移除视频导航、页面、设置关联项和事件抽屉中的视频展示，也移除旧单场 `selection` 调用；普通直播与陪看链接继续保留。公共订阅、Chrome、Skill均不在范围。

客户端已补齐登录日历的“我的关注／全部比赛”范围切换；全部模式修正为默认 F1、联赛内全部球队及具体球队筛选，并可在比赛详情手动加入或移除单场。单场写入沿用后端 revision、权限与幂等契约；Worker `61f292e1-21a1-4f9a-9b53-551303945894` 已部署到开发 Web，并完成匿名脚本与已登录浏览器回读，正式环境未变更。

本地不再提供创作者关注、待确认视频或自动视频挂入入口；`/creators`不再是有效页面。历史视频数据不在客户端展示。

F1关注已部署为只能选择具体车队，F1赛事本身仅作目录分组；访客赛程选择同样要求具体车队。选择不同F1车队得到相同的大奖赛/session日程，车队选择用于官方频道及内容范围。云端Jolpica快照尚未到六小时刷新窗口，当前公网目录仍为0支F1车队；代码和页面已上线，但选择器要等刷新成功后才有条目。

既有视频发布记录仅作历史证据，不再代表当前产品范围。微信仍只有方案。

剩余：MCP 对等工具属于后续 C；等待并回读Jolpica车队目录刷新；全新登录、真实账号手动增删、真实偏好保存/Feed更新、直播链接设备验证及正式发布回归仍待完成。双仓本地回归已通过：服务端248 passed / 2 skipped，Web typecheck、生产构建与合同生成通过。发布记录见[worker/calendar-all-matches-deployment-2026-09-17.md](worker/calendar-all-matches-deployment-2026-09-17.md)、[worker/a-scope-deployment-2026-09-17.md](worker/a-scope-deployment-2026-09-17.md)及云仓[B 候选与开发部署证据](../anke-sports-cloud/evidence/manual-calendar-backend-2026-09-17.md)。
