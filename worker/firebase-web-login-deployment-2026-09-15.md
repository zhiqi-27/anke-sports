# Firebase Web login corrective release · 2026-09-15

The production bundle behind Worker `51c0058f-f24a-4b60-9863-ab2259e7799d` did not contain the Firebase Web App configuration. The earlier browser check had retained an older authenticated client bundle and therefore did not prove the newly uploaded assets were configured.

The cause was a reused Next/Turbopack build cache. The corrective build removed `.next` and `.next-cloudflare` before rebuilding with the existing public Firebase Web configuration. The generated JavaScript was checked for the API key, authentication domain and project ID before upload.

Worker `56940da4-084f-462b-b175-9cdd60595b9d` is active on `sports.anke-ai.com`. A no-cache readback fetched the scripts referenced by the live `/calendar` HTML and confirmed all three Firebase values are present.

The repository now provides `npm run build:deploy`, which clears build caches and verifies the resulting bundle. Wrangler also runs `scripts/verify-deployment-build.mjs` as a custom build step, so dry-runs and direct deployments stop before upload when the Firebase configuration is absent.

No account, preference, calendar or external application was changed during this correction. A fresh logged-out provider completion was not performed.
