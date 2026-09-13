# Chrome 本地实现与证据

> 范围更新（2026-09-13）：Chrome扩展已取消。本文件只记录取消前的历史证据，不再列为v1缺口或发布验收。

2026-09-09记录时T26/T27为`in_progress`，代码、安装包和隔离证据完成当批检查，实际Chrome验收未完成。2026-09-13范围变更后，两项已转为`deferred`且`launch_required=false`。

## 本批结果

- `npm run extension:test`：30项通过。覆盖PKCE、state/issuer/回调/过期拒绝、最小权限和授权撤销、刷新响应丢失、worker重新载入后的状态恢复、不同账号隔离、明确操作才读取标签、单次保存幂等键、用户屏蔽保留、分页失败保留有效缓存，以及实际ZIP/PNG/manifest边界。
- `npm run extension:typecheck`、Web `npm run typecheck` 和 `npm run build` 通过。新增依赖锁定，安装时npm audit为0 vulnerabilities。
- 后端 `uv run ruff check .`、`uv run pytest -q`：47项通过，2项原有第三方弃用警告。新增2项隔离协议测试：登记的chromiumapp.org回调绑定扩展Origin；无Cookie的Bearer写入；不同来源拒绝；重复保存同结果；不同动作复用幂等键409；移除后重新附加仍隐藏；撤销后401。它们是TestClient协议证据，不是实际Chrome请求。
- 本地包：`extension/packages/anke-sports-0.1.0-local.zip`，21557 bytes，本次SHA256 `990483ca4716c422f2a0258d2a37bff0fdae013d16953024fbaf2a59d76dc108`。ZIP只含9个生成客户端文件；重新构建会改变ZIP时间戳和哈希。
- 扩展ID `cknffelkhjfbeicfaoajmjpjiphhlnck`，开发API `http://localhost:8787`，Web `http://localhost:3000`。这是构建配置与公钥推导结果，不是商店分配身份。

## 浏览器界面检查

独立合成预览 `http://127.0.0.1:18792`，exec session25462，PID86801。实际加载生成的popup.js/CSS，界面尺寸380×560；所有账号、赛程、视频和保存结果均为合成，适配器禁止API连接、没有Chrome权限且不进入安装包。

通过可访问树和截图检查：未连接→合成连接→立即加载赛程；演示标记、账号时区、只读提示；视频草稿→查找→明确比赛→明确类型→保存反馈；未选择时保存禁用；空列表的关注入口；断网后结束加载并保留重试；赛程列表独立滚动，底部读取当前视频和完整日历入口保持可见。保存文案只承诺后台更新订阅源，不表示手机已同步。

本批修复了连接成功后嵌套busy状态吞掉首次刷新、断网后仍显示加载中，以及读取视频入口被赛程挤出可视区的问题。没有将合成保存写进主预览数据库。

## 明确未验证

自动浏览器工具拒绝访问`chrome://extensions`，理由是浏览器URL安全策略禁止该页面，且禁止改用间接执行或其他浏览器入口绕过。因此没有安装扩展，没有实际Chrome identity/activeTab或service worker休眠验证。原生UI同时报告Mac锁定；没有绕过。

待实际环境完成：加载安装包、真正的Chrome授权窗口及关闭/取消/重开、真实YouTube页面读URL/title、非视频页面错误、关闭弹窗后草稿继续、service worker休眠/唤醒、浏览器重启清除会话、主Web比赛抽屉读回保存链接、扩展退出/网页撤销后旧凭证失效。手机ICS刷新、Firebase真实登录、Azure环境、生产HTTPS/商店ID与发布也未验收。

## 状态与复现

源码/命令见`extension/README.md`，隐私与发布准备见`CHROMEWEBSTORE.md`。Web3000、API8787与worker继续运行；本批只新增无网络合成预览18792。两个仓库分别本地提交，无push、云资源创建、部署、数据迁移或商店上传。
