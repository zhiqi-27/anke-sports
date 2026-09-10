# Anke Sports client

Use the parent workspace agreement when present. This repository owns the desktop Web, Chrome extension, UI and generated API client. Product scope: sports calendar and original viewing links, Apple Sports-inspired desktop design; no native mobile app, AI content or player.

- Backend contract authority is `anke-sports-cloud/contracts/openapi.json`. Consume API results through services/hooks; personal matching and ICS rendering stay on the server.
- Early-stage priority (2026-09-10): make the existing core flow directly usable and easy for the owner to inspect. Fix observed user-facing blockers before adding scope, abstractions or exhaustive variants. Later phases are backlog, not prerequisites for the first usable version; wait on blocked GUI/login work without inventing unrelated engineering tasks.
- Support month/week/agenda, timezone, all/followed filtering and event drawer. Filtering must never mutate subscriptions. Official event times are read-only.
- Inspect UI at 1440×1000, 1280×800 and 1024 desktop width. Verify overflow, empty/error/loading states and keyboard focus. A working build alone does not prove layout quality.
- Firebase client identity authenticates API calls. Never embed Admin credentials or provider keys. Local preview mode must be visibly labeled and unavailable in production.
- Preserve user changes and check this repository independently. Make routine authorized local fixes autonomously. Inspect deployment triggers before any push; report preview, deployed and real-device evidence separately.
- Keep `README.md` commands current and `STATE.md` factual. Explain significant tradeoffs in concise Chinese; do not stop at a plan when implementation is authorized.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
