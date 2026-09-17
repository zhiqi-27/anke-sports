# Settings interaction redesign deployment

Date: 2026-09-15 (Asia/Shanghai)

## Published artifact

- Cloudflare Worker: `anke-sports-web`.
- Worker version: `3d2f44ff-e62b-4d6c-a875-a54ead104ee7`.
- Custom domain: <https://sports.anke-ai.com/settings>.
- Existing Azure development API origin was retained; no backend deployment or resource mutation occurred.

## Checks and readback

- TypeScript typecheck and the standard Next.js production build passed.
- Production-shaped static export passed Firebase Web configuration verification.
- Wrangler 4.131.0 dry-run read 99 assets.
- Deployment uploaded 39 changed assets and reused 45 existing assets.
- `/settings` returned HTTP 200; `/api/v1/status` reported `local_preview: false` and `storage: cosmos`.
- Public assets contain the new settings sections, constrained video-window feedback, import dialog and dirty-state save bar.
- A signed-in production browser confirmed the new heading hierarchy and data-source status rows.
- Toggling a preference displayed `1 项设置尚未保存`; `取消修改` restored the saved value without a server mutation.
- Invalid JSON displayed a localized field-level error inside the import dialog. No valid import was submitted.

## Boundary

This proves deployment to the existing public Web surface and the inspected signed-in client-side interactions. It does not prove a saved preference mutation, a valid configuration import, external calendar refresh, Azure redeployment, or formal v1 release. No Git commit or push was performed.
