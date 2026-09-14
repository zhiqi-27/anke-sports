# Calendar and following Web deployment · 2026-09-14

## Published artifact

- Client commits: `2cdfd4d`, `f216427`, and `b774ca8`.
- Cloudflare Worker: `anke-sports-web`.
- Worker version: `a87681cd-476e-41b3-9e08-c287e8d25bc4`.
- URL: <https://sports.anke-ai.com/calendar>.
- Rollback version: `3676cf53-3ac8-47ed-abee-f9dec91533cb`.

The production-shaped static build used the existing public Firebase Web configuration. Wrangler 4.131.0 dry-run and deployment each read 76 assets; deployment uploaded 38 changed assets and reused 25. The existing Azure development API origin and custom domain were retained.

## Public readback

- `/calendar`, `/following`, Azure-direct health, routed health, and public status returned HTTP 200.
- Signed-in following page renders F1 as a direct event follow and NBA/EPL as two-level team directories. The current account remained unchanged and displayed Liverpool FC and San Antonio Spurs as saved follows.
- NBA displays 30 selectable teams after the backend catalogue correction; the preseason guest opponent is absent.
- Signed-in main calendar has no all-events scope control and loaded the account's followed schedule. September showed three Liverpool fixtures and no F1 events.

This proves the existing public development Web surface and the currently signed-in browser readback. It is not a Git push, formal v1 production release, external calendar refresh, or mutation of the user's follows.
