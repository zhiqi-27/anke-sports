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

## P2 visual-system deployment

Time: 2026-09-13 21:27–21:30 (Asia/Shanghai)

- P2 client commit: `5d26a0a` (`Apply P2 visual system`).
- Cloudflare Worker version: `e2628970-f7a3-4661-a935-ad474b1750c7`.
- Production-shaped build and Wrangler dry run passed; 76 assets were read.
- Deployment uploaded 40 changed assets and reused 23.
- `/calendar`, `/subscription`, `/creators` and `/settings` returned HTTP 200.
- Public `/api/v1/status` returned HTTP 200 three consecutive times; anonymous `/api/v1/me/calendar` returned the expected HTTP 401.
- Public bundles contained the new task headings, compact Apple/Google guide copy and external-Agent connection copy.
- A real browser rendered the subscription page with two new guide rows, zero old guide cards and no horizontal overflow at 1440×900. The calendar rendered 19 visible September event elements without an application error at 1280×800.

This deployment changed the Web client only. It did not mutate Azure/Firebase resources, use a signed-in account, confirm external calendar refresh or constitute formal v1 release. No Git push was performed.
