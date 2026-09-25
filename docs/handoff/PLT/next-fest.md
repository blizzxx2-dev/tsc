# Steam Next Fest readiness checklist (PLT-0070)

Fill in the festival dates (Valve publishes them ~6 months ahead on the Steamworks "Upcoming Events" page and
opens registration ~2 months before). Every date below is relative to **F = festival start**.

| When | Item | Owner | Done |
|---|---|---|---|
| F − 8 weeks | Register the demo for the festival in Steamworks (Marketing → Upcoming Events) | producer | |
| F − 6 weeks | Demo feature-complete on `beta`; `release/demo-1.x` branch cut; demo save format frozen (see README, PLT-0069) | platform | |
| F − 5 weeks | Signed/notarised build passes the clean-machine pass (`hardware-qa.md` §6) | QA | |
| F − 4 weeks | Store page demo section live (demo app linked, "Download demo" button), trailer + screenshots | marketing | |
| **F − 2 weeks** | **Demo build set live on `default` and reviewed by Valve** (build review can take 3–5 business days) | platform | |
| F − 2 weeks | Press/broadcast build: `npm run build:demo -- --watermark` web build + desktop build with `VITE_WATERMARK=1`, keys distributed | marketing | |
| F − 2 weeks | Known-issues list published (Steam discussion pinned post) | QA | |
| F − 10 days | Hotfix pipeline rehearsed ≤ 4 h (`docs/release.md`) and timings recorded | platform | |
| F − 1 week | Crash dashboard alert armed; on-call rota for the festival week | platform | |
| F − 1 week | Livestream/broadcast slot booked, streamer build verified | marketing | |
| F | Monitor crash-free sessions, wishlists, reviews twice daily | all | |
| F + 1 week | Post-festival patch notes and retrospective | producer | |
