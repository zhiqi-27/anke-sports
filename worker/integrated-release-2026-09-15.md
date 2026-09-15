# Integrated Web release · 2026-09-15

Commit `e228cdf` integrates the new brand assets, Gemini v4 video labels/review UI, official-broadcast maintenance hints, mobile HTTPS handoff, and the “直播和创作者内容” settings page. Broadcast choice is saved by region plus competition; event details contain no preference control, and each personal-calendar event receives one broadcast link.

Validation passed: OpenAPI client generation, Next route type generation, TypeScript, production static build, Worker proxy tests `3/3`, Wrangler `4.131.0` authentication and dry-run. The static build contains 99 assets.

Cloudflare Worker version `5db1f3c0-9142-4377-86b1-a4fbd80001ab` is active on `sports.anke-ai.com`; 55 changed assets were uploaded and 29 reused. Public asset readback contains the new page title, region-plus-competition selector, single-calendar-link copy and AI content copy. Rendered browser readback visibly confirmed the page, all supported region options and the disabled save state for an anonymous user.

No user preference, calendar, external account or broadcast publication was changed during release verification.
