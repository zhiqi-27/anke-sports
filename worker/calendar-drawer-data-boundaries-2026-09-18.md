# 日历事件抽屉数据边界与本地修正 · 2026-09-18

状态：已完成本地候选，尚未部署；正式环境未变更。

## 本地修正

- 手动加入比赛的移除动作改为低对比度纯文本“移除这场比赛”，移除前置叉号。
- 直播空状态补充说明：当前赛程来源不包含直播入口，公共链接需先完成核验。
- 场馆空值改为“场馆信息未提供”，不再暗示上游已经公布但页面没有显示。

## 数据核对

- 公网事件 `f83925675b8a7a275043b0c81f16043f` 返回 `provider=balldontlie`、`source_key=balldontlie:game:21717900`、`venue=""`、`links=[]`。
- `anke-sports-cloud/app/provider_adapters.py` 的 BALLDONTLIE 适配器当前将 NBA `venue` 设为空；该来源的 Games 响应契约包含比赛时间、状态和主客队，但不包含场馆或直播字段，不能据此推断本场官方观看入口。
- 直播仍走独立的公共入口审核与手动附加链路；本轮没有新增未经核验的 NBA、League Pass 或其他播放链接，也没有猜测场馆。

## 本地验证

- `npm run typecheck`：通过。
- `npm run build`：通过。
- `git diff --check`：通过。

## 发布边界

- 当前开发 Web 仍为 Worker `3c8ab1b6-c0fe-4657-afa5-5a06309c8ae0`；本轮修正尚未推送或部署。
- 未改动 `anke-sports-cloud`，保留其既有未提交登录修复工作。
- 未点击移除或手动加入，不改变测试账号的个人日历数据。
- 参考：[BALLDONTLIE NBA API](https://docs.balldontlie.io/)。
