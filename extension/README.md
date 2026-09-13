# Anke Sports Chrome 扩展（已退出产品范围）

> 用户于2026-09-13决定不做Chrome扩展，只保留公网MCP。本目录仅保存此前本地实现与验证证据，不再继续实装、构建发布、支持或商店提交；除非用户明确要求，不删除历史文件。

本地 MV3 实现：380×560 弹窗、未来 7 天赛程、打开完整日历、明确读取当前 YouTube 视频、选择比赛与链接类型后保存。安装运行和真实 Chrome 授权仍待验收，详见 `evidence.md`。界面没有播放器或持续监听器；自动视频发现继续由服务端承担。

## 构建与本地运行

在客户端仓库根目录，Node 24：

```sh
npm ci
npm run extension:typecheck
npm run extension:test
npm run extension:build
```

生成 `extension/dist-local/` 与 `extension/packages/anke-sports-0.1.0-local.zip`。开发扩展 ID 为 `cknffelkhjfbeicfaoajmjpjiphhlnck`；公共开发 key 只固定 ID，不是签名私钥。产物中没有配置密钥或测试夹具。测试命令会重建并检查本地包。

本地 API：`http://localhost:8787`；Web：`http://localhost:3000`。先按两个仓库 README 启动 API、worker 和 Web。后端 `PUBLIC_URL` 必须与扩展 API 一致，`WEB_URL` 与扩展网页一致；不要混用 `localhost` 和 `127.0.0.1` 的登录 Cookie 或 issuer。

手动安装入口：Chrome 扩展管理页的「加载已解压的扩展程序」，选择生成的 `dist-local` 文件夹。当前自动浏览器策略不允许代理打开扩展管理页，代理未安装此包，也不会以其他入口绕过限制。

安装后在工具栏打开扩展，选择「连接 Anke Sports」，在网页确认账号和权限，再重新打开弹窗。读取日历为必需权限，管理链接可单独允许；扩展不申请私人 Feed 地址权限。

在具体 YouTube 视频页面点击工具栏扩展图标，再按「读取当前视频」。确认标题、比赛和前瞻/复盘/直播/陪看类型后保存。标题和链接先成为本次浏览器会话的草稿，只有保存时才发送到服务端。链接不会被标记为官方，也不代表具备观看权限。

## 独立界面预览

```sh
npm run extension:preview
```

打开 `http://127.0.0.1:18792`。这是载入实际 popup.js/CSS 的合成界面夹具，所有账号、比赛、视频与结果均为合成。它没有 Chrome 权限、登录、网络/API 或日历写入能力，不进入 ZIP。可检查未连接、只读、空列表、断网、视频选择与保存反馈，不能替代扩展验收。

## 会话与失败处理

- PKCE、state、issuer、回调 URL、API resource 必须匹配。使用 `chrome.identity.launchWebAuthFlow`，不是 Google 身份令牌充当应用授权。
- 凭证、账号赛程缓存和草稿仅存 `chrome.storage.session`；服务 worker 重启可恢复，关闭整个浏览器/停用/重载扩展会清除。草稿另有 24 小时有效期。公共 client 注册和筛选设置留在 `storage.local`；不使用浏览器同步存储。
- 退出会撤销本连接并清除本机账号数据；服务端撤销失败会明确提示到网页设置撤销。关闭浏览器或卸载只清除本机数据，已有服务端连接需在网页撤销或等待过期。
- 刷新令牌只兑换一次，响应丢失后重新连接；不重试已可能被消耗的令牌。读到401立即清除身份缓存。
- 保存前持久化幂等键；同一草稿、比赛、标题和类型的重试复用该键，变更内容生成新键。服务端仍执行权限、链接去重、屏蔽和 outbox 事务。
- 查询最多读取500场，超过上限明确要求缩小范围；失败保留上一次有效列表与读取时间，不把缓存称为已更新。选择日期时查该日附近以兼顾跨时区比赛，最终以账号时区显示供用户确认。

## 权限与正式包

仅申请 `activeTab`、`storage`、`identity`，以及实际 API 域名的 host permission。没有 `tabs`、历史、所有网站、内容脚本、YouTube 常驻权限或远程代码。用户点工具栏 action 获得临时 activeTab 权限，再按明确按钮时才查询该标签 URL/标题；这符合 [Chrome 官方 activeTab 说明](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)。不采用旧技能中「读取 URL 必须申请 tabs」的过宽建议。

Chrome match pattern 无法限定端口，因此本地 host permission 为 `http://localhost/*`；实际 fetch 与 CSP 固定为构建配置的 API origin。`storage.session` 的清除行为以 [官方存储文档](https://developer.chrome.com/docs/extensions/reference/api/storage)为准；授权回调遵循 [identity 文档](https://developer.chrome.com/docs/extensions/reference/api/identity)。

正式包使用已经核实的独立 Anke Sports HTTPS 地址：

```sh
ANKE_EXTENSION_API_URL="$ANKE_VERIFIED_API_ORIGIN" \
ANKE_EXTENSION_WEB_URL="$ANKE_VERIFIED_WEB_ORIGIN" \
npm run extension:build -- --production
```

未配置公共 HTTPS 会直接失败。正式环境不提供演示筛选，不内置本地开发 key。商店分配扩展 ID 后，用其公开 key 固定发布构建，重新验收该 ID 的回调与服务器授权；生产域名和商店 ID 尚未创建，不能沿用开发 ID 的验收结论。可用 `ANKE_EXTENSION_PUBLIC_KEY` 指定正式公钥。发布元数据及隐私草案在仓库根 `CHROMEWEBSTORE.md`，尚未上传或提交商店。
