# Anke Sports · 客户端状态

2026-09-11 最新：Cloudflare Web 已发布到 https://sports.anke-ai.com/calendar，Worker 版本 83295a47-3110-45d3-8125-a992cd7bf72d。Firebase 已添加 sports.anke-ai.com 授权域名并读回。公网 calendar=200、status=200/no-store、匿名个人日历=401/no-store；Chrome 页面实际显示20场F1，登录对话框可打开。真实Google用户登录、个人ICS和手机同步仍待验收。此状态取代下方未发布/等待解锁的历史记录。

2026-09-11 当前发布进度：sports.anke-ai.com 已写入 Wrangler custom_domain，Azure API origin 已配置。尚未部署或修改 DNS。Wrangler 本机未登录，OAuth 授权页已打开，但 CUA 检测 Mac 锁定，遵照用户要求暂停电脑授权操作。解锁后重新运行 wrangler login（旧会话可能超时），完成发布、域名 HTTPS 和 Firebase authorizedDomains 验证。下文部署准备为历史过程。

更新：2026-09-10。本地MVP可试用，尚未云端公测。用户已解锁，继续只修实际体验阻塞。[总进度与下一步](../STATE.md)。

## 已实现与验证

桌面月/周/日程、关注预览、比赛抽屉、原链接管理、创作者/待确认、个人订阅与设置、配置导入导出、应用连接。Apple Sports视觉语言，仍为桌面日历信息架构。

最新代码7e4d2cf：仅将`DOCUMENT_FEATURE_UNAVAILABLE`的公共订阅区改为明确提示与个人订阅引导。普通503仍可重试，SQL公共订阅仍可读取。构建（含类型）、格式检查及1440/1280/1024布局通过。实际下载ICS为12事件/12唯一UID，带合成复盘链接。见[验收记录与截图](output/playwright/lean-check-2026-09-10.md)。

3008演示账号固定了9月8日既有复盘；新增关注预览取消，未保存。复制仅验证页面反馈，未读取剪贴板；未声称手机同步或真实视频可播放。

## 当前运行

本次只读核验：3000/PID53698、3002/PID13957、3003/PID38482可达。3002启动session59568，服务3007/3008的前端资源；3008后端仍为创作者批次。主API与独立演示数据分开，详见工作区STATE。未重启服务。

[主日历](http://127.0.0.1:3000/calendar)；[创作者演示](http://localhost:3008/creators)；[订阅演示](http://localhost:3008/subscription)。

## 未完成

Chrome已有本地MV3包和合成弹窗/协议测试，实际安装、identity/activeTab/休眠尚未验收。MCP本地实际Codex调用已验证，云端组合未完成。Firebase真实Google登录在Chrome有历史证据；用户已取消IAB登录排查，继续保持取消。

文档存储的公共Feed/直播/OAuth/MCP等未完整适配；3008并非全功能云版。真实视频到手机、具体App直达、Azure部署与发布仍待完成。Google直连和其他扩展工作暂后置。

## 本轮文档刷新

重写当前入口、删除旧STATE流水，未改业务源码/依赖/契约。原未跟踪`.playwright-cli/`和`lean-drawer-*`诊断截图保留；安全检查曾拒绝递归清理。本次不删除、不push、不部署。按需开发，不扩展通用基础设施。
# 2026-09-11 部署准备

已从独立 Firebase Web 配置在进程内注入 NEXT_PUBLIC 登录参数后重新静态构建，构建/类型通过；未写入 Git 环境文件或输出配置值。产物仍未部署，sports.anke-ai.com 的 Firebase 授权域名与公网登录尚未验证。

Wrangler 4.131.0 已精确锁定。deploy --dry-run 成功读取 76 个资产，Worker 2.03 KiB；未上传。真实本地 workerd 在 3012 核验 calendar/following/connect 为 200，未知路径 404，未配置后端的 API 为 503 + no-store。session 15381，workerd PID 25901，为本地无业务数据的部署检查服务；用户真实体验仍在 3009。

已新增 Cloudflare 静态资源配置与同源 API Worker。3 项 Node 转发测试通过，包含身份/Origin/请求体保留、错误透传和禁缓存；不是 Workers 运行时或云端验收。尚未设置 AZURE_API_ORIGIN、部署或绑定 DNS。

新增可选静态导出模式及页面路径枚举，构建和 TypeScript 通过。静态产物 .next-cloudflare/；未改视觉，构建仍使用 Next 默认缓存，不声明现有进程已重新验收。sports.anke-ai.com 的 Cloudflare 托管/API 转发、DNS 与 Firebase 公网登录仍未完成。
