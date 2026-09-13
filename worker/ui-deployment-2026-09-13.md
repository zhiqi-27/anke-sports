# P0/P1 UI deployment

Time: 2026-09-13 21:03–21:08 (Asia/Shanghai)

## Published artifact

- Client commit: `b671d05` (`Complete P0 and P1 web experience`).
- Cloudflare Worker: `anke-sports-web`.
- Worker version: `7566f3a1-8a9c-4a69-b4b2-b0bfe2743bc2`.
- Custom domain: <https://sports.anke-ai.com/calendar>.
- Existing Azure development API origin was retained; no backend deployment or resource mutation occurred.

## Checks and readback

- Production-shaped static build passed with the existing public Firebase Web configuration.
- `npx wrangler deploy --dry-run` read 76 assets and passed.
- Deployment uploaded 38 changed assets and reused 25.
- `/calendar` returned HTTP 200; the deployed bundle contained the P0/P1 loading, MCP naming, batch-review and temporary-timezone copy.
- Anonymous `/api/v1/me/calendar` returned the expected HTTP 401 with `no-store`.
- `/api/v1/status` had one transient HTTP 503 during cold start, then returned HTTP 200 three consecutive times through the public Worker and three consecutive times from the Azure origin.
- A real production browser rendered 52 public matches; week view opened at `scrollTop=0`. Console output was limited to expected anonymous 401 requests and the existing favicon 404.

## Boundary

This proves deployment to the existing public development Web surface, not formal v1 production release, signed-in account acceptance or external calendar refresh. No Git push was performed.
