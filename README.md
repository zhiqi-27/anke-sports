# Anke Sports

选择球队、赛事和YouTube创作者，通过持续更新的日历交付赛程与原始观看链接。原名SportsCal。桌面Web采用Apple Sports视觉语言；不开发原生手机App或播放器。

当前为**公网核心日历链路可用，持续更新待验收**。已连通 Google 登录、F1/NBA/英超目录、个人关注和 Mac Apple 日历订阅；最近公网只读证据为马刺、利物浦，无F1；视频与手机验收边界见 STATE，尚未完成公测签收。最新进度见[STATE](STATE.md)，总体顺序见[实施计划](<../anke-sports 文档/Anke_Sports_实施计划.md>)。本仓拥有桌面Web和生成的客户端契约；权威业务与公网MCP在独立仓`anke-sports-cloud`。

## 本地启动

需要Node.js 24。先按服务端README启动API和worker，然后：

```sh
npm ci
npm run dev
```

打开[日历](http://127.0.0.1:3000/calendar)，进入明确标注的本地体验。默认通过同源`/api/`转发到127.0.0.1:8787；`ANKE_SPORTS_BACKEND_URL`可指定独立实例。本地配置不要用于公网。

可检查月/周/日程、关注预览、事件抽屉、手动链接、创作者/待确认、订阅与配置。合成数据明确标示，真实F1样本单独选择。下载ICS是一次性快照；手机持续订阅需要可达的正式地址与客户端验证。

## 现有检查入口

- [3000主日历](http://127.0.0.1:3000/calendar)：SQL本地基线。
- [3008创作者](http://localhost:3008/creators)与[个人订阅](http://localhost:3008/subscription)：文档模式合成预览，不是全功能云端版。订阅页只提供登录后的个人日历。
- [3007 F1样本](http://localhost:3007/calendar)：独立Provider批次后端；进入本地体验并选择真实赛程。

3000已于2026-09-13重新启动并完成P0本地验收，验收后停止；3007/3008仍是历史入口，当前存活状态须重新检查。最新[P0日历证据](output/playwright/p0-calendar-experience-2026-09-13.md)覆盖默认筛选、空状态、冲突重算与三种桌面尺寸；既有[UI/ICS证据](output/playwright/lean-check-2026-09-10.md)包含12条唯一事件下载。

## 检查与契约

```sh
npm run typecheck
npm run build
npm run contracts
```

最后一条在相邻服务仓更新`contracts/openapi.json`后运行；不要在没有契约变化时重复生成。依赖解析锁定于`package-lock.json`。CI只检查不部署，当前远端运行结果未在本次刷新中查询。

## MCP

MCP在服务端实现，已有本地Codex实际调用证据；[连接说明](../anke-sports-cloud/docs/mcp-and-connections.md)。文档模式OAuth/MCP与Firebase/HTTPS组合尚未闭环。

Chrome扩展已于2026-09-13退出产品与发布范围。`extension/`及`CHROMEWEBSTORE.md`保留既有本地实现和证据，默认检查、发布和支持均不包含它们；只有用户明确要求删除时才清理这些历史文件。

## 当前范围

公网 Google 登录、F1 关注和 Mac Apple 日历订阅已验证。真实视频自动附到手机、官方场次直播及持续刷新仍待验收，详见 STATE。

服务端目标是Firebase、FastAPI/Azure Functions、Cosmos **Serverless + Periodic**及Storage Queue；公网开发环境已使用 Cosmos；SQL 仅作本地基线，各模块云端验收范围见 STATE。早期只修实际主流程阻塞，后续模块按需要推进。下一步只以当前STATE和任务表为准。

## Cloudflare 静态构建与部署

`wrangler.jsonc` 使用静态资源绑定和 `/api/*` Worker 转发。部署时须配置 `AZURE_API_ORIGIN` 为已验证的 Azure HTTPS origin；未配置返回 503。Worker 保留身份、请求体和 Origin，禁用 API 缓存及自动跟随重定向。`node --test worker/index.test.mjs` 验证转发契约；公网登录、关注和订阅路径已有联调证据，完整转发边界仍按对应测试与验收记录判断。配置参考：https://developers.cloudflare.com/workers/static-assets/binding/

桌面域名：`https://sports.anke-ai.com`。`ANKE_SPORTS_STATIC_EXPORT=true npm run build` 可生成 `.next-cloudflare/` 静态产物；默认仍支持本地 Next 服务。静态模式不执行 Next rewrites，部署端必须将 `/api/*` 转发至已验证的 Azure 后端，并禁止缓存认证响应。Cloudflare、域名和公网登录已完成；当前验收记录见 STATE。Firebase Web 配置须在正式构建时注入，不能用缺失配置的本地构建冒充生产包。
