# 首次开发环境发布

2026-09-11 最新：Cloudflare Web 已发布到 https://sports.anke-ai.com/calendar，Worker 版本 83295a47-3110-45d3-8125-a992cd7bf72d。Firebase 已添加 sports.anke-ai.com 授权域名并读回。公网 calendar=200、status=200/no-store、匿名个人日历=401/no-store；Chrome 页面实际显示20场F1，登录对话框可打开。真实Google用户登录、个人ICS和手机同步仍待验收。此状态取代下方未发布/等待解锁的历史记录。

未执行 Git push。使用现有独立 Azure 开发环境，未建立生产环境。保留原 Firebase 四个授权域名，仅追加指定域名。Cloudflare deploy 成功注册 custom domain，实际 HTTPS 响应已验证。
