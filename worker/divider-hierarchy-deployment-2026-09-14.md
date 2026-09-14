# Divider hierarchy deployment

Date: 2026-09-14 (Asia/Shanghai)

## Published artifact

- Client commit: `64ea04d` (`Refine divider hierarchy`).
- Cloudflare Worker: `anke-sports-web`.
- Worker version: `f3caa0f1-8a43-43cc-9172-ff4d749d096d`.
- Custom domain: <https://sports.anke-ai.com>.
- Existing Azure development API origin was retained; no backend deployment or resource mutation occurred.

## Checks and readback

- TypeScript typecheck and the standard Next.js production build passed before commit.
- Production-shaped static export passed after commit; Wrangler dry-run read 76 assets.
- Deployment uploaded 37 changed assets and reused 26 existing assets.
- `/calendar`, `/settings`, `/subscription`, `/creators`, and `/following` returned HTTP 200.
- Public `/api/v1/status` returned HTTP 200 three consecutive times.
- The deployed CSS contains `--color-shell-divider` and `--color-content-divider`.
- A production browser confirmed that settings rows use the content-divider token, the creators review section has no top border, and the 1280 px viewport has no horizontal overflow.

## Boundary

This proves deployment to the existing public Web surface and anonymous browser rendering. It does not prove signed-in account behavior, external calendar refresh, or formal v1 release. No Git push was performed.
