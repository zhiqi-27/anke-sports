# Official-channel scope and F1 team-only Web deployment · 2026-09-16

Worker `269a483f-2c19-4006-8e5b-6da40cd96e57` is active on `https://sports.anke-ai.com`. The clean deployment build produced 99 assets, verified the existing public Firebase Web configuration, and passed Wrangler dry-run before upload. The immediately previous Worker version is `3d2f44ff-e62b-4d6c-a875-a54ead104ee7`.

No-cache public readback returned HTTP 200 and fetched the 11 scripts referenced by the live calendar page. The deployed assets contain “选择球队或车队” and “F1、英超和NBA均选择具体球队或车队。” They do not contain “视频搜索时间”, “最多选择两个时间” or the retired per-event YouTube-search explanation.

The backend code is deployed and healthy, but the live Jolpica source snapshot has not yet passed its next six-hour refresh. Until that refresh succeeds, the F1 directory has no constructor rows and the deployed team-only picker is empty. No user account, follow selection or personal Feed was changed during deployment.
