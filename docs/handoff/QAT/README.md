# QAT hand-offs — what a human must do

Everything that software could prepare is in the repository; these steps need people, accounts, hardware or
players. Material is linked on each line.

- QAT-0014 — Add the `QA_DISCORD_WEBHOOK` repository secret (team Discord → channel → Integrations → Webhooks) so the nightly QA summary reaches Discord; the workflow already skips Discord without it (`.github/workflows/qa-nightly.yml`).
- QAT-0066 — Generate the first screenshot baselines inside the Playwright image: run the **Visual baselines** workflow (Actions → Run workflow) or `npm run visual:update` on a machine with Docker, review the PNGs, merge the PR. Until then `npm run test:visual` and the nightly visual step fail with "No baselines yet" (`tests/e2e/visual/flows.visual.ts`, `scripts/qa/visual-update.mjs`).
- QAT-0067 — Create the GitHub teams `@suture-and-steel/qa`, `/art`, `/uix`, `/gam` (or edit `.github/CODEOWNERS` to the real team slugs) and enable "Require review from Code Owners" on `main`.
- QAT-0087 — Create the GitHub Project "Suture & Steel bugs" with the columns New → Triaged → In progress → Fixed → Verified (`docs/qa/bug-process.md` § 2); labels sync automatically from `.github/labels.json`.
- QAT-0089 — Book the twice-weekly triage (Tue/Fri, 30 min) and add the weekly metrics artefact to the sprint review; SLA enforcement and the trend chart are automated (`docs/qa/bug-process.md` § 3, `scripts/qa/bug-metrics.mjs`).
- QAT-0091 — For each public build run `node scripts/qa/known-issues.mjs <build-id>` and pin `docs/qa/known-issues.md` in the Steam discussions and Discord (`docs/handoff/QAT/release-checks.md`).
- QAT-0093 — Community manager + QA: weekly Discord/Steam-forum sweep into `community` issues with the reply template (`docs/qa/bug-process.md` § 8).
- QAT-0096 — Stand up the EU-hosted ingest backend (no IP storage, per-install rate limit, deletion endpoint) (`docs/handoff/QAT/telemetry-backend.md`; client in `src/telemetry/`).
- QAT-0098 — Serve the kill-switch config endpoint and build with `VITE_TELEMETRY_CONFIG_URL`; the client reads it at session start (`docs/handoff/QAT/telemetry-backend.md`, `src/telemetry/config.ts`).
- QAT-0099 — Route `dev`/`qa`/`playtest` flavours to a staging dataset in the backend (events already carry `flavour`) (`docs/handoff/QAT/telemetry-backend.md`).
- QAT-0100 — Schedule the 90-day raw-event deletion job and test deletion by install id end to end (`docs/handoff/QAT/telemetry-backend.md`).
- QAT-0102 — Build the demo funnel dashboard with daily cohorts and the Next Fest snapshot (funnel: `docs/qa/telemetry/README.md`; spec: `docs/handoff/QAT/telemetry-backend.md`).
- QAT-0103 — Build the fail-point dashboard (`docs/handoff/QAT/telemetry-backend.md`).
- QAT-0104 — Build the tool-usage heatmaps over op captures from `npm run shot` (`docs/handoff/QAT/telemetry-backend.md`).
- QAT-0105 — Build the rank-distribution vs bot dashboard from `op_end` and `reports/sim-report.json` (`docs/handoff/QAT/telemetry-backend.md`).
- QAT-0106 — Build the performance-bucket dashboard once ENG/PLT emit frame-time events (`docs/handoff/QAT/telemetry-backend.md`).
- QAT-0107 — Correlate `wishlist_click` with Steamworks wishlist exports and UTM visits daily (`docs/handoff/QAT/telemetry-backend.md`).
- QAT-0108 — Monthly settings & assists report to UIX and LOC (`docs/handoff/QAT/telemetry-backend.md`).
- QAT-0109 — Full-game funnel dashboard at Beta (`docs/handoff/QAT/telemetry-backend.md`).
- QAT-0110 — Post-launch KPI dashboard from crash reporting and Steamworks exports (`docs/handoff/QAT/telemetry-backend.md`).
- QAT-0112 — Book the compatibility lab sweep on ≥ 15 GPU configs and merge results into `docs/qa/compat-matrix.md` (`docs/handoff/QAT/release-checks.md`).
- QAT-0114 — VirusTotal each RC, vendor false-positive submissions, clean re-scan (`docs/handoff/QAT/release-checks.md`).
- QAT-0115 — Run Electronegativity and the hardening checklist on PLT's packaged demo (`docs/handoff/QAT/release-checks.md`).
- QAT-0116 — Build the screener form, recruit ≥ 60 testers, collect NDAs (`docs/handoff/QAT/playtest/screener.md`).
- QAT-0117 — Set up the private `playtest` branch and the Steam Playtest app; issue/revoke access per wave (`docs/handoff/QAT/playtest/round-plan.md`).
- QAT-0118 — Put the three demo rounds on the calendar with CON/UIX/BOS/GAM (`docs/handoff/QAT/playtest/round-plan.md`).
- QAT-0119 — Create the shared session survey (SUS, wishlist intent, length, most confusing moment) (`docs/handoff/QAT/playtest/round-plan.md`).
- QAT-0120 — Record consented OBS sessions with the input overlay and tag confusion timestamps within 48 h (`docs/handoff/QAT/playtest/round-plan.md`).
- QAT-0121 — File findings with `playtest` + n/N and write each round report (`docs/handoff/QAT/playtest/round-report-template.md`).
- QAT-0122 — Run the 30-player RC round and check the gates (≥ 85 % reach Lauds, median ≥ 40 min, ≥ 60 % wishlist intent, 0 crashes) (`docs/handoff/QAT/playtest/round-plan.md`).
- QAT-0123 — Run the 5-player Steam Deck round (`docs/handoff/QAT/playtest/round-plan.md`).
- QAT-0124 — Run the accessibility round (one-handed, trackball, colour-vision deficiency) (`docs/handoff/QAT/playtest/round-plan.md`).
- QAT-0125 — Run the localisation round, 2 natives per language, via the LOC LQA template (`docs/handoff/QAT/playtest/round-plan.md`).
- QAT-0126 — Run the Alpha round (10 players, Ch1–5) (`docs/qa/alpha-test-plan.md`, round plan format).
- QAT-0127 — Run the Beta round (50+ via Steam Playtest, all languages) (`docs/qa/beta-test-plan.md`).
- QAT-0144 — Run the 8-hour idle soaks on the reference PCs and Deck (`scripts/qa/soak.mjs`, `docs/handoff/QAT/release-checks.md`).
- QAT-0147 — Generate and sign `docs/qa/signoff/demo-rc.md` on the RC commit (`node scripts/qa/signoff.mjs demo-rc`, `docs/handoff/QAT/release-checks.md`).
- QAT-0149 — Staff the Next Fest daily crash/forum rota (`docs/handoff/QAT/release-checks.md`).
- QAT-0150 — Review every community-reported demo bug before the Alpha gate (`docs/handoff/QAT/release-checks.md`).
- QAT-0166 — Run the full 1.0 RC regression on every matrix OS and sign `docs/qa/signoff/1.0-rc.md` (`node scripts/qa/signoff.mjs 1.0-rc`, `docs/qa/beta-test-plan.md`).
- QAT-0170 — Bi-weekly top-10 crash-signature review for the first three months after launch (`docs/handoff/QAT/release-checks.md`).
