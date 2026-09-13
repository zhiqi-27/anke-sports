# Team logo Web deployment · 2026-09-13

## Published artifact

- Client commits: `a5f5cf7` and `85f0af4`.
- Cloudflare Worker: `anke-sports-web`.
- Final Worker version: `3676cf53-3ac8-47ed-abee-f9dec91533cb`.
- URL: <https://sports.anke-ai.com/calendar>.

An initial Worker version `2cb8fecf-a7c0-4efa-bff4-b7a2983567b8` reused the previous static assets because the ordinary Next build did not regenerate `.next-cloudflare`; it was immediately superseded and is not the accepted release. The final production-shaped static build used the existing public Firebase Web configuration, passed Wrangler dry-run, and uploaded 38 changed assets while reusing 25.

## Public readback

- Deployed JavaScript and CSS contain `logo_url` and `team-mark-logo`.
- `/calendar` and `/following` returned HTTP 200.
- In the existing signed-in browser session, the following page visibly rendered official NBA and football team logos, including followed Liverpool FC and San Antonio Spurs.
- Opening Liverpool FC vs AFC Bournemouth visibly rendered both team logos in the match detail drawer.
- Calendar event cells remained logo-free. Missing/unverified logos fall back to the existing short-name mark.

This proves the current development Web surface and signed-in browser rendering. It is not a Git push, formal v1 production release, native Apple Calendar logo capability or device acceptance.
