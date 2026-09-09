# Anke Sports 客户端状态

更新：2026-09-10。主 Web：http://127.0.0.1:3000/calendar ，session 43940。

桌面日历（月/周/日程）、关注、事件抽屉、链接/固定/屏蔽、订阅、创作者管理与人工确认、配置导入导出、应用授权与连接撤销已实现本地流程。Apple Sports 视觉语言，桌面日历信息架构；无原生手机 App。

新增 `/maintenance` 维护者直播审核界面，身份由后端认证和白名单控制。草稿保存、地区/观看条件、审核发布、撤回、巡检请求、设备观察和公共抽屉证据展示已在独立合成环境操作验证。已修复地区输入、日期提交与窄桌面长标题；1440/1280/1024布局检查通过。Web类型和构建通过，后端68项测试通过。详情：../anke-sports-cloud/evidence/local-2026-09-10.md。

供用户检查：http://localhost:3001/maintenance ，临时 API session29715/PID92350 + 客户端 production server 3002 session62441。该库为合成夹具，HEAD返回值和设备表单均合成，实际设备三层结论均未测试。停止 API 会删临时库。主库无这些直播记录；默认本机账号不是公共维护者。

MV3 Chrome 扩展：380×560弹窗、PKCE、近期赛程、明确读取当前YouTube视频、比赛/类型确认和幂等保存已生成ZIP。30项扩展测试、类型通过。合成预览 http://127.0.0.1:18792 （session25462/PID86801）不具备Chrome权限或API能力。实际安装 chrome://extensions 曾被浏览器URL安全策略拒绝，未绕过；identity/activeTab/休眠未验收。详见 extension/evidence.md。

MCP/网页授权已完成本地HTTP与官方SDK流程，真实外部目标客户端未验收。Firebase真实登录、YouTube实际更新、平台/手机日历与App直达、Azure及公测发布仍未完成；Google直连属M6。没有push或云部署。

用户确认先完成本地；之后授权托管Chrome创建配置独立Firebase/Azure/YouTube资源，账号登录由用户完成。不重复询问工作方式，具体计费/云目标在依赖处确认。完整产品目标仍保留，任务跟踪以父工作区STATE和执行状态JSON为准。

## 任务状态与恢复批次

设置页显示Provider处理中、等待重试、失败和最早重试时间；处理时2秒轮询，等待时30秒。来源列表仅在实际完成/数据切换时刷新；账号对象刷新不会取消正在读取的Provider状态。契约已从后端重新生成。

NBA/足球缺key路径已在主预览读回，足球自动从处理中切换为失败，无需重载；真实赛程总数仍163。1440×1000、1280×800与1024宽度无横向溢出。Hook变更过程产生的Fast Refresh依赖长度警告经完整加载不再新增。Web/扩展类型和最终production build通过；后端83项测试通过。后台恢复证据见../anke-sports-cloud/evidence/recovery-2026-09-10.md。

## 公共订阅批次

新增游客公共球队/赛事选择、公开地址复制、一次性下载、待发布/失败/空状态和迁移提示。个人日历继续要求账号。真实游客页面 http://localhost:3000/subscription 保留标签12；原体验会话未退出。选择湖人、实际快捷键粘贴、浏览器下载文件与HTTP快照hash一致、Tab/Enter复制通过；1440/1280/1024无横向溢出，控制台无error。临时标签13已关闭。

Web/扩展类型和production build通过，后端92项测试通过；.next/types四份相同重复生成文件已逐项比对后清理。详情../anke-sports-cloud/evidence/public-feeds-2026-09-10.md。公共订阅仍是本机地址，不代表手机或来源公开分发已验收；T25/QA-15继续。
