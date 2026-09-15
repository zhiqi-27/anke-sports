# Official broadcast Web deployment · 2026-09-15

The release was built in a detached worktree from client HEAD, with only the official-broadcast manager, region selector, mobile navigation behavior and the OpenAPI client generated from the exact deployed backend overlay. Existing uncommitted AI-video and brand work was not included.

Validation passed: OpenAPI generation, Next route type generation, TypeScript, production-shaped static export, Worker proxy tests (3/3), and Wrangler dry-run. The dry-run and deployment each read 76 assets.

Worker version `2dc16c25-96ff-4688-b1a9-25682aa5ef96` is deployed on `sports.anke-ai.com`. Public asset readback contains the new European region choices, rights-holder helper and mobile App Link/web-handoff copy. A rendered `/settings` readback visibly showed Japan and the 15 supported European country choices. Unauthenticated maintenance access still returns HTTP 401.

No user preference, calendar, broadcast record or external account was changed during Web verification.
