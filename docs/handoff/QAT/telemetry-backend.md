# Telemetry backend and dashboards — hand-off spec (QAT-0096, 0098, 0099, 0100, 0102 … 0110)

The client side is built and tested (`src/telemetry/`, schema v1 in `docs/qa/telemetry/`). Everything below needs
accounts, hosting, a data-protection review and real data, so it is a human hand-off.

## Ingest (QAT-0096)

- Host: a Cloudflare Worker + D1/R2 (or self-hosted PostHog) with **EU data residency**.
- Endpoint `POST /v1/events` accepting a JSON array of schema-v1 envelopes (max 500 per batch, ≤ 256 KB).
  Validate each event against `docs/qa/telemetry/events.v1.schema.json` (reject invalid ones, count rejections).
- **Never store the IP address** (do not log `CF-Connecting-IP`; disable Worker request logging).
- Rate limit per `install` id: 20 batches/min, 5,000 events/day; excess → 429 (the client backs off exponentially).
- Deletion: `DELETE /v1/installs/:id` removes every event for an install id (the player resets the id in Options;
  support can action requests) — test end to end (QAT-0100).
- Client switch-over: build with `VITE_TELEMETRY_CONFIG_URL` and add a fetch transport next to `LocalTransport`.

## Kill switch endpoint (QAT-0098)

`GET /v1/config` → `{ "enabled": true, "disabledEvents": [] }` with `Cache-Control: max-age=300`. The client already
reads it once per session start (`readConfig`) and falls back to "enabled" on errors — flipping `enabled:false` or
listing events disables them without a build.

## Staging dataset (QAT-0099)

Route events whose `flavour` is `dev`, `qa` or `playtest` to a separate dataset/table; dashboards read only `release`.

## Retention (QAT-0100)

A scheduled job (daily cron trigger) deletes raw events older than **90 days** after rolling them into daily aggregates
(funnel counts, op outcomes, rank histograms, frame-time buckets), which are kept.

## Dashboards (QAT-0102 … 0108, 0109, 0110)

| Dashboard | Source events | Spec |
|---|---|---|
| Demo funnel (0102) | funnel in `docs/qa/telemetry/README.md` | drop-off per step; daily cohorts by build, OS, locale; Next Fest daily snapshot exported to the production channel |
| Fail points (0103) | `op_end`, `op_fail` | per op: loss reason split, phase of loss, live entity kinds at loss, retries before first win; top-3 fail phases highlighted for GAM |
| Tool-usage heatmaps (0104) | `rating` (x, y on a 32 px grid) | per op and tool, density of COOL/GOOD/BAD/MISS over a capture of that op's field (`npm run shot -- <op> 3 field.png`) |
| Ranks vs bot (0105) | `op_end.rank` + `reports/sim-report.json` | per-op histogram beside steady/novice bot ranks; > 1 band deviation → tuning ticket |
| Performance buckets (0106) | frame-time event (PLT/ENG to add) + `session_start.gpuFamily` | p50/p95 by GPU family, resolution, quality tier |
| Wishlist attribution (0107) | `wishlist_click` + Steamworks wishlist export + UTM visits | daily correlation |
| Settings & assists (0108) | `settings_changed`, `op_start.assists` | share per assist, gore, reduced flashing, language; monthly to UIX/LOC |
| Full-game funnel (0109, Beta) | `chapter_start`, `op_end` for Ch1–5 | chapter start/complete, challenge-mode entry, discipline usage, Ch3–5 fail points |
| Post-launch KPIs (0110, Post) | crash reporting + Steamworks exports | crash-free sessions, completion per chapter, median playtime, challenge participation, refund-window playtime buckets |
