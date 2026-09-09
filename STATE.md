# Anke Sports 客户端状态

更新：2026-09-10。主 Web：http://127.0.0.1:3000/calendar ，session 43940。

桌面日历（月/周/日程）、关注、事件抽屉、链接/固定/屏蔽、订阅、创作者管理与人工确认、配置导入导出、应用授权与连接撤销已实现本地流程。Apple Sports 视觉语言，桌面日历信息架构；无原生手机 App。

新增 `/maintenance` 维护者直播审核界面，身份由后端认证和白名单控制。草稿保存、地区/观看条件、审核发布、撤回、巡检请求、设备观察和公共抽屉证据展示已在独立合成环境操作验证。已修复地区输入、日期提交与窄桌面长标题；1440/1280/1024布局检查通过。Web类型和构建通过，后端68项测试通过。详情：../anke-sports-cloud/evidence/local-2026-09-10.md。

供用户检查：http://localhost:3001/maintenance ，临时 API session29715/PID92350 + 客户端 production server 3002 session12042/PID17719。该库为合成夹具，HEAD返回值和设备表单均合成，实际设备三层结论均未测试。停止 API 会删临时库。主库无这些直播记录；默认本机账号不是公共维护者。

MV3 Chrome 扩展：380×560弹窗、PKCE、近期赛程、明确读取当前YouTube视频、比赛/类型确认和幂等保存已生成ZIP。30项扩展测试、类型通过。合成预览 http://127.0.0.1:18792 （session25462/PID86801）不具备Chrome权限或API能力。实际安装 chrome://extensions 曾被浏览器URL安全策略拒绝，未绕过；identity/activeTab/休眠未验收。详见 extension/evidence.md。

MCP/网页授权已完成本地HTTP与官方SDK流程，真实外部目标客户端未验收。Firebase真实登录、YouTube实际更新、平台/手机日历与App直达、Azure及公测发布仍未完成；Google直连属M6。没有push或云部署。

用户确认先完成本地；之后授权托管Chrome创建配置独立Firebase/Azure/YouTube资源，账号登录由用户完成。不重复询问工作方式，具体计费/云目标在依赖处确认。完整产品目标仍保留，任务跟踪以父工作区STATE和执行状态JSON为准。

## 任务状态与恢复批次

设置页显示Provider处理中、等待重试、失败和最早重试时间；处理时2秒轮询，等待时30秒。来源列表仅在实际完成/数据切换时刷新；账号对象刷新不会取消正在读取的Provider状态。契约已从后端重新生成。

NBA/足球缺key路径已在主预览读回，足球自动从处理中切换为失败，无需重载；真实赛程总数仍163。1440×1000、1280×800与1024宽度无横向溢出。Hook变更过程产生的Fast Refresh依赖长度警告经完整加载不再新增。Web/扩展类型和最终production build通过；后端83项测试通过。后台恢复证据见../anke-sports-cloud/evidence/recovery-2026-09-10.md。

## 公共订阅批次

新增游客公共球队/赛事选择、公开地址复制、一次性下载、待发布/失败/空状态和迁移提示。个人日历继续要求账号。真实游客页面 http://localhost:3000/subscription 保留标签12；原体验会话未退出。选择湖人、实际快捷键粘贴、浏览器下载文件与HTTP快照hash一致、Tab/Enter复制通过；1440/1280/1024无横向溢出，控制台无error。临时标签13已关闭。

Web/扩展类型和production build通过，后端92项测试通过；.next/types四份相同重复生成文件已逐项比对后清理。详情../anke-sports-cloud/evidence/public-feeds-2026-09-10.md。公共订阅仍是本机地址，不代表手机或来源公开分发已验收；T25/QA-15继续。


## 最新批次：关注变更预览（T11 / T23）

“我的关注”先预览再确认，由后端共用投影筛选规则计算新增、移除、重叠保留和历史保留；支持无日期、暂停、待发布提示。Web提交绑定确认摘要和幂等键，赛程变化要求重新预览，配置版本变化重新读取关注。旧HTTP/MCP无摘要调用继续兼容。

后端98项pytest/ruff、Web/扩展类型和最终production build通过；新增6项针对所有权、只读、并集/屏蔽、历史/日期、摘要截断、冲突和幂等的测试。隔离浏览器确认：16条原订阅变为10条有效比赛+6条原UID移除通知，全部UID不变；取消预览不写配置，过期预览拒绝写入。修复长弹窗底部提交后看不到顶部错误的问题，错误会获得焦点并滚入视口。1440/1280/1024均无横向溢出，键盘打开/关闭/操作和实际HTTP发布通过。

主API session88286/PID23809、worker session89692/PID23829运行本批代码；主Web3000 session43940，验收production Web3002 session12042/PID17719。无需迁移，users/feeds/events/projections/sources五表完整行哈希保持相同，163条比赛保留。主API /api/v1/health=local/ok，匿名预览401。

主页面 http://127.0.0.1:3000/following 标签16保留新增NBA的待确认预览（新增8，含历史3，结果20），未保存，原关注不变。原公共订阅标签12、维护标签10保留。关注夹具3003/标签15已关闭，临时库已删除；experiments/follows_ui.py可重新创建。viewport已重置。3001仍是旧版独立合成维护API，不用于新功能验收。

说明：../anke-sports-cloud/docs/follow-changes.md；证据：../anke-sports-cloud/evidence/follow-preview-2026-09-10.md 和同名JSON。T11/T23保持in_progress，真实Firebase多端、MySQL并发/规模、外部日历移除/刷新仍待验收。下一步继续原完整目标：YouTube跨任务并发、隐私脱敏、目标MCP客户端与规模；后续托管Chrome云资源创建授权保留。无push、部署或云资源变更。


## 最新批次：YouTube 并发与恢复（T13 / T15–T18）

新增频道data/hub执行租约与条件提交，旧任务内容/错误不能覆盖新任务。通知与调度并发去重；Hub待验证意图受Claim保护，同一挑战重试不延长订阅。网络限流与本地重新匹配分开处理，连续崩溃耗尽次数后明确失败。匹配/人工审核/手动附加先锁用户并重读个人选择；过期清理以updated_at条件更新，防止误删刚刷新的元数据。

完整后端116项pytest、ruff通过，新增18项频道用例；最终挑战摘要编码调整后相关35项再次通过。真实独立SQLite连接验证旧响应/错误、个人选择、清理竞争、通知/调度去重；ASGI签名通知→共享Worker→ICS保持UID，重复通知不改变版本。真实Hub、Firebase、MySQL、Azure和设备仍未验收。Web/扩展typecheck通过，OpenAPI完全相同；客户端本批仅更新状态文档，没有新UI源码或重复构建。

本机迁移a8c502e7d134新增channel_work和验证摘要，0600备份data/before-channel-work-20260910-021321.db；原23表既有列/行在迁移与最终重启后逐项相同，163场保留，channel_work=0，未往主库加入合成频道/视频。临时SQLite空库/旧数据升级、回退、再升级、模型check通过；MySQL仅离线DDL，未发现可用本机MySQL/Docker命令。

主API session88286/PID23809、worker session89692/PID23829运行最终代码，健康local/ok；带时区9月演示赛程查询返回47条。主Web3000、production演示Web3002、旧合成维护API3001、扩展预览18792保持运行；原关注预览标签16、公共订阅12、维护10保留，未确认NBA草稿。

说明：../anke-sports-cloud/docs/channel-concurrency.md；证据：../anke-sports-cloud/evidence/channel-concurrency-2026-09-10.md及JSON。T13/T15–T18保持in_progress。下一步：实际目标MCP客户端、项目级API配额/规模、隐私脱敏和后续独立云资源与设备验收。托管Chrome授权继续保留。无push、部署或云资源变更，完整目标继续。
