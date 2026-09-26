# 03 — QA & Tooling, Localisation, Production & Release · Suture & Steel: The Malison Hours

Workstreams: **`QAT`** QA, testing & tooling · **`LOC`** localisation · **`OPS`** production, legal & release.

Scope follows `_brief.md`: `Demo` = everything the free Chapters 1–2 Steam demo (op1-1…op1-5, op2-1…op2-5; the Malison
of Matins and of Lauds) needs at release quality; `Alpha`/`Beta`/`Release` = Chapters 3–5 and the full game; `Post` =
after launch.

Baseline this file builds on:
- Tests: `tests/gesture.test.ts` (star recogniser), `tests/bot.ts` (generator-based bot surgeon driving the `Pointer`
  API), `tests/operations.test.ts` (every campaign op winnable by the bot) and `tests/balance.test.ts` (steady/novice
  paces; `CALIBRATE=1` prints rank thresholds). No `vitest.config.ts`, no lint/format config, no CI workflow; the
  operation tests `console.log` a summary line per op.
- `scripts/smoke.mjs` (Playwright 1.55, SwiftShader WebGL2) steps the sim through `page.evaluate`, stitches op1-1 with
  real mouse drags, skips op1-5 to the Malison by killing entities, and always exits 0 (`process.exit(0)` in `finally`);
  `scripts/.one.mjs` is a one-off screenshot helper with hard-coded `/home/user/tsc` and `/opt/pw-browsers` paths.
- All player-facing text is inline English in `src/content/*.ts`, `src/surgery/*.ts` (`say`/`sayOnce` lines, `rate()`
  labels such as "Barbs freed", popups, loss reasons) and `src/scenes/*.ts`; fonts are Latin-only OFL faces
  (IM Fell English, UnifrakturMaguntia) in one 2048² glyph atlas.

Cross-file dependencies are named by prefix. Work other files already own is **not** repeated here: ENG (replay recorder,
golden runs, perf benchmark, dev console, visual harness), PLT (PR pipeline, lint/format, coverage gate, crash
reporting, F8 bug capture, SteamPipe, save v2, demo app, carry-over), INP (bot assist profiles, device matrix),
UIX (accessibility audit, tutorials, demo-complete scene, pseudo-loc build), AUD (VO, composer and performer contracts),
GAM/BOS (bot skill profiles, balance sweeps, per-op tuning, boss tests), NAR/CON (name register and blocklist, English
style guide, script locks, op schema, softlock tests), ART (capsules, key art, art outsourcing, art QA).
Tasks below add the QA, localisation and production/legal work around them.

---

## QAT-A · Test & CI foundation (Demo)

### Test infrastructure
- [x] QAT-0001 · Demo · P0 · S · Vitest projects config — `vitest.config.ts` with projects `unit` (node, `src/surgery`, `src/core`, `src/content`), `sim` (bot runs, 60 s timeout) and `e2e` (Playwright); npm scripts `test:unit`, `test:sim`, `test:e2e`, `test:visual` documented in CONTRIBUTING.md
- [x] QAT-0002 · Demo · P0 · S · Shared sim helpers `tests/helpers/sim.ts` extracted from `tests/bot.ts` — `makeOp(def)`, `step(op, seconds)`, `press/drag/release` `Pointer` builders, `strokePath(op, tool, points)`, `zigzag(a, b, amplitude, crossings)`; bot.ts and every entity test import them (no duplicated `DT`/pointer code)
- [x] QAT-0003 · Demo · P1 · S · Isolated-entity factory `defWith(spawn, overrides)` — single-phase `OperationDef` with `baseDrain: 0`, `timeLimit: 999`, all eight tools, so each entity is exercised without neighbours
- [x] QAT-0004 · Demo · P1 · S · Test-code lint via `@vitest/eslint-plugin` (added to the PLT ESLint config) — no focused tests (`.only`), no `.skip` without an issue link, every test asserts; CI fails on violations
- [x] QAT-0005 · Demo · P1 · S · Quiet test output — `operations.test.ts`/`balance.test.ts` stop printing a `console.log` line per op; summaries go to assertion messages and a `sim-report.json` artefact; CI log for the unit project ≤ 200 lines
- [x] QAT-0006 · Demo · P2 · S · Pre-commit hooks (simple-git-hooks + lint-staged) — staged `*.ts` run Prettier and ESLint `--fix`; pre-push runs `tsc --noEmit` and `vitest related --run` on changed files
- [x] QAT-0007 · Demo · P2 · S · Commit-message lint — commitlint (conventional commits) as a `commit-msg` hook and a PR check, so the PLT changelog/patch-notes generator always receives typed commits
- [x] QAT-0008 · Demo · P1 · S · Secret scanning — gitleaks on every PR and push blocks Steamworks builder credentials, crash-reporter and telemetry tokens and signing material; allow-list reviewed each milestone
- [x] QAT-0009 · Demo · P1 · S · Test reporting — Vitest and Playwright emit JUnit XML; CI publishes a per-run summary (passed/failed/flaky, slowest 10 tests); any unit test slower than 2 s is flagged

### Smoke & helper scripts
- [x] QAT-0010 · Demo · P0 · S · Smoke exit code — `scripts/smoke.mjs` exits 1 when a `pageerror` or console error was captured (today `process.exit(0)` runs unconditionally in `finally`) and enforces a 90 s global timeout
- [x] QAT-0011 · Demo · P1 · S · Replace fixed `waitForTimeout` sleeps with waits on game state (active scene, `op.status`, `op.phase`) — smoke passes 20/20 consecutive runs and is ≥ 30 % faster
- [x] QAT-0012 · Demo · P1 · S · Smoke covers Chapter 2 by default — op2-1…op2-5 and the Lauds fight are in the fixed run list instead of the optional `EXTRA_OPS` env var
- [x] QAT-0013 · Demo · P2 · S · Portable scripts — `CHROMIUM` falls back to Playwright's bundled browser; `scripts/.one.mjs` becomes `npm run shot -- <op> <seconds> <out.png>` without hard-coded `/home/user/tsc` or `/opt/pw-browsers` paths

### QA-owned pipelines
- [x] QAT-0015 · Demo · P1 · S · Flaky-test policy — Playwright `retries: 2` in CI; a test that passes only on retry auto-files a `flaky` issue; quarantined tests listed in `tests/QUARANTINE.md` with a 2-week fix deadline
- [x] QAT-0016 · Demo · P2 · S · Playwright sharding — suites run with `--shard=i/4` across parallel jobs once E2E + visual exceed 5 minutes; one merged HTML report uploaded per run

## OPS-A · Production cadence & tracking (Demo)

### Cadence
- [x] OPS-0001 · Demo · P0 · S · Two-week sprint cadence — planning, mid-sprint check, review on a playable build, retro; sprint goal and committed tasks recorded on the GitHub Project before day 1 of each sprint
- [x] OPS-0002 · Demo · P1 · S · Sprint-review build — every sprint ends with a tagged build on the Steam `qa` branch and a 1-page "what changed / what to test" note linked from the review
- [x] OPS-0003 · Demo · P1 · S · Weekly status note — Friday update (burn-up vs forecast, risks that moved, decisions needed, next week's focus) posted to the production channel and archived in `docs/production/status/`
- [x] OPS-0004 · Demo · P1 · S · Decision log `docs/production/decisions.md` — date, decision, alternatives, owner, link; every scope, legal, pricing and vendor decision in this file points to an entry
- [x] OPS-0005 · Demo · P1 · S · Sustainable-pace policy — planned load ≤ 40 h/week per person; two consecutive weeks above 45 h trigger a scope review in the next status note instead of crunch
- [x] OPS-0006 · Demo · P2 · S · Milestone retrospectives — after every gate (M0, Demo, Alpha, Beta, Release) a retro with ≤ 5 actions, each assigned and tracked to closure on the board

### Tracking
- [x] OPS-0007 · Demo · P0 · M · Roadmap → issue sync — script parses every `docs/roadmap/*.md` task line (id, phase, priority, size, title) into GitHub issues with labels and writes closed issues back as `[x]`; idempotent (a second run changes nothing)
- [x] OPS-0009 · Demo · P1 · S · Milestone burn-up — points S = 1, M = 3, L = 8; weekly burn-up per phase with a forecast finish date; a forecast slipping > 2 weeks past a gate triggers a scope review
- [x] OPS-0010 · Demo · P0 · M · Master schedule — dated plan from today (late September 2026) to Next Fest and 1.0 with lead times for art, music, localisation, rating, Valve store/build review and trademark filing; 15 % buffer on every external dependency
- [x] OPS-0012 · Demo · P2 · S · Contractor onboarding pack — access checklist (GitHub, Drive, Discord, Steamworks role), bibles, file-naming rules, review slots; a new contractor ships a first deliverable in week 1

## OPS-B · Milestone gates & definitions of done

- [x] OPS-0014 · Demo · P0 · S · Task-level Definition of Done — reviewed, tests or golden replay updated, strings in the string table, no new lint errors, changelog line, verified in a build by someone other than the author; linked from the PR template
- [x] OPS-0016 · Demo · P0 · M · Demo Definition of Done — Ch1–2 (10 operations, Matins + Lauds) with tutorials, options, save/Cloud, controller and Deck basics, the demo languages, opt-in telemetry and the wishlist screen; 0 open S1/S2; perf budgets met; Valve build and store review passed
- [x] OPS-0017 · Demo · P0 · S · Demo feature lock — dated; afterwards only content, polish and fixes merge; any exception needs an equal-size cut recorded in the decision log
- [x] OPS-0018 · Demo · P0 · S · Demo content lock — Ch1–2 operation data and English strings locked on the same date as the NAR demo script lock; later changes are triage-approved bug fixes only

## OPS-C · Risk register & scope management

- [x] OPS-0024 · Demo · P0 · S · Risk register `docs/production/risks.md` — probability × impact, owner, trigger, mitigation, status; seeded with IP similarity (Atlus/SEGA *Trauma Center* expression, Games Workshop tone), Deck/low-end GPU performance, Next Fest slip, art throughput, key-person bandwidth, gore/occult rating limits, CJK/Cyrillic font cost, VO budget; reviewed each sprint
- [x] OPS-0026 · Demo · P1 · S · Change control — after feature lock every addition names an equal-sized cut; `docs/production/cut-list.md` keeps cut items with the phase they move to
- [x] OPS-0030 · Alpha · P1 · S · Chapter III content milestones dated — outline lock, ops playable with placeholder art, story first draft, art lock, loc handoff
- [x] OPS-0031 · Alpha · P1 · S · Chapter IV content milestones dated — outline lock, ops playable with placeholder art, story first draft, art lock, loc handoff
- [x] OPS-0032 · Alpha · P1 · S · Chapter V content milestones dated — outline lock, ops playable with placeholder art, story first draft, art lock, loc handoff (finale Compline boss first)

## OPS-D · Budget, hiring & contracts (Demo → Alpha)

### Budget & business model
- [x] OPS-0034 · Demo · P0 · M · Studio budget model — one spreadsheet rolling up the ART and AUD budgets plus writing/editing, localisation, legal/trademark, ratings, marketing, QA contractors, hardware, software, Steam Direct fee and 15 % contingency, for Demo and 1.0; monthly actuals vs plan
- [x] OPS-0036 · Demo · P1 · M · Revenue forecast — conservative/base/optimistic scenarios from wishlists-at-launch, conversion, price and regional mix; break-even point and the wishlist target it implies, reviewed after Next Fest

### Contracts
- [x] OPS-0040 · Demo · P1 · S · Credit obligations register — each contract's credit wording and placement recorded in one sheet that feeds the in-game credits and the store page
- [x] OPS-0041 · Demo · P1 · S · Milestone payments — every statement of work lists deliverables and acceptance criteria; invoices are paid only against accepted milestones, tracked in the budget model

## OPS-F · Age ratings & content compliance (Demo → Beta)

- [x] OPS-0074 · Demo · P0 · S · Rating dry run — IARC questionnaire answered in draft for Ch1–2 content to preview PEGI/USK/ESRB-equivalent outcomes; result fed to the ART gore-tone target and UIX gore-level defaults
- [x] OPS-0076 · Demo · P1 · S · Territory rating table — whether Germany (USK), Australia, Brazil (ClassInd) and South Korea (GRAC) require or display a rating for a Steam release; path and cost per territory recorded
- [x] OPS-0078 · Demo · P2 · S · Occult-imagery market check — pentagram gesture, curse sigils and witch-hunt themes reviewed for storefront/territory sensitivities; mitigations (e.g. alternate icon art) logged

## LOC-A · Demo language scope & i18n runtime (Demo)

### Scope decisions
- [x] LOC-0001 · Demo · P0 · S · Demo language subset — core set EN + DE, FR, ES (Spain), PL, PT-BR (Latin script, matching the ART glyph audit and ENG Latin Extended-A subsetting); stretch RU + ZH-Hans with a go/no-go at demo feature lock based on the ENG Cyrillic/CJK font pages; IT, JA, KO (and any stretch language not taken) at Beta; recorded in the decision log
- [x] LOC-0005 · Demo · P2 · S · RTL out of scope — documented decision that Arabic/Hebrew are not planned for 1.0, so layout code needs no bidi support; revisited in the post-launch language review

### Runtime
- [x] LOC-0006 · Demo · P0 · M · `src/i18n/` runtime — `t(key, params?)` over `strings/<lang>.json` with ICU MessageFormat (plural, select, number); unit tests cover PL plural categories (one/few/many/other) and FR treating 0 as singular
- [x] LOC-0007 · Demo · P0 · S · Key conventions `docs/loc/keys.md` — `ui.*`, `tool.<id>.name|hint`, `rating.<r>`, `rank.<r>`, `label.<entity>.<event>`, `popup.*`, `loss.*`; speakable and story lines reuse the AUD/NAR line ids (`s1-2.014`, `op1-2.p0.1`, `bark.flooded`) so VO, subtitles and text share one id
- [x] LOC-0008 · Demo · P0 · S · Locale loading & fallback — locales lazy-loaded as Vite chunks; fallback chain (pt-BR → en, es-ES → en); a missing key renders English, warns once in dev and increments a `loc_missing_key` telemetry counter
- [x] LOC-0009 · Demo · P1 · S · Number & time formatting — score, combo, vitals and timer through `Intl.NumberFormat` and a locale mm:ss formatter (FR narrow no-break-space grouping, DE/PL period/space grouping); U+00A0 and U+202F present in every baked body glyph set
- [x] LOC-0010 · Demo · P1 · S · Rank-letter policy — XS/S/A/B/C stay Latin capitals in every language (translator note); rating words follow the OPS wording decision and the termbase

### Simulation text not covered by NAR/CON/UIX extraction
- [x] LOC-0011 · Demo · P0 · M · Rating labels to keys — every `rate(…, label)` literal in `src/surgery/*.ts` ('Incision', 'Off the line', 'Closed', 'Drained', 'Stitched', 'Sealed', 'Nick', 'Barbs freed', 'Torn', 'Debrided', 'Burn dressed', 'Lanced', 'Cleansed', 'Rot purged', 'Antidote', 'Seared', 'Plucked', 'Curse broken', 'Wounded', 'Malison unmade', 'It rejoined', 'Cast out', 'Silenced', 'Hatched') becomes a key; the sim stores keys, the HUD resolves text
- [x] LOC-0012 · Demo · P0 · S · Popups, loss reasons and object labels to keys — 'THE LITANY OF STILLNESS', 'The curse lashes out!', 'It burst!', 'Found it!', 'Found!', '-N'/'+N' vitals popups, 'The patient has died.', 'Time has run out.' and the `Embedded` spec labels (Arrow, Bolt, Lead shot, Fang, Shard, Glass, Hexstone) resolved through `t()`
- [x] LOC-0013 · Demo · P0 · S · No runtime sentence assembly — the `${label} ${RATING_TEXT}` and `x${combo}` popups rebuilt as ICU patterns (`{label} {rating}`, `×{combo}`) so each language can reorder; audit script flags template literals that feed text draws
- [x] LOC-0014 · Demo · P1 · S · Patient grammatical gender — `OperationDef.patientGender` (m/f/unknown) passed to callouts as an ICU `select` so FR/DE/ES/PL/PT lines like "his pulse is weak" agree; all ten demo ops annotated

### Tooling & validation
- [x] LOC-0015 · Demo · P0 · M · Key-usage scanner `npm run i18n:check` — TypeScript compiler API collects every `t()`/line-id reference; reports keys missing from `en.json`, unused keys and non-literal keys; runs in CI
- [x] LOC-0016 · Demo · P0 · S · Locale file validation in CI — every locale parses, ICU syntax compiles, placeholder names match English exactly, no leading/trailing whitespace drift, no untranslated key unless flagged `fallback: true`
- [x] LOC-0017 · Demo · P1 · S · Context metadata `strings/en.meta.json` — per key: speaker, scene, max width px, character limit, screenshot link and the NAR translator note; exported to the TMS as key context
- [x] LOC-0018 · Demo · P1 · S · Reading time per locale — the callout display time (`max(2.4 s, 0.055 s × length)` in `Operation.update`) takes a per-locale reading-speed factor and counts CJK characters × 2.5; unit tests keep every line ≥ 2.4 s and ≤ 1.3 × the English duration
- [x] LOC-0020 · Beta · P1 · S · Korean particle selection — ICU helper picks 은/는, 이/가, 을/를, 으로/로 from the final consonant of an inserted name or term; unit tests over every proper noun in the termbase

## LOC-B · Fonts & glyph coverage (Demo → Beta)

- [x] LOC-0022 · Demo · P0 · S · Coverage check in CI `npm run i18n:glyphs` — opentype.js reads each shipped font's cmap and reports, per locale and font role (body, italic, display), code points used in `strings/<lang>.json` that the font lacks; fails when no fallback covers them (automates the one-off ART glyph audit)
- [x] LOC-0023 · Demo · P0 · S · Glyph lists for baking — script emits the exact code-point set per locale (strings + digits + UI punctuation, plus a 500-character safety set for ZH) as input to the ENG subsetting/MSDF build; regenerated on every translation import
- [x] LOC-0024 · Demo · P1 · S · Per-locale font-role map `src/i18n/fonts.ts` — body/italic/display face per language (e.g. PL display falls back to the ART-approved Latin-extended blackletter; CJK `italic` maps to a Kai/Mincho face because CJK has no italics); unit test that every shipped locale resolves all three roles
- [x] LOC-0025 · Demo · P1 · S · Fallback-glyph highlighter — LQA builds tint any glyph drawn from a fallback face or the dynamic rasteriser magenta, so reviewers see mixed fonts and missing coverage on screen

## LOC-C · Pseudo-localisation & text expansion (Demo)

- [x] LOC-0029 · Demo · P0 · S · Pseudo-locale data generator — `qps.json` built from `en.json`: accented substitutes (e.g. "Ŧĥë Ŀïŧàñÿ"), +40 % padding, `⟦ ⟧` brackets; ICU placeholders preserved (unit test); consumed by the UIX pseudo-loc build
- [x] LOC-0030 · Demo · P1 · S · `qps-long` variant — strings under 12 characters expanded by 100 % to mimic German/Polish single-word growth in tool names, rating words and buttons
- [x] LOC-0031 · Demo · P1 · S · `qps-cjk` variant — full-width characters and no spaces, to exercise CJK wrapping, the size floor and atlas pressure before real Chinese arrives
- [x] LOC-0032 · Demo · P1 · M · Width budgets in CI — each key's max px width (from `en.meta.json`) checked against every translation using advance widths read from the font files; failures list key, locale and overflow in px
- [x] LOC-0033 · Demo · P1 · S · HUD text budgets — rating popups ≤ 220 px at popup size, callout banner ≤ 2 lines, tool-tray names on one line at the 88 px tray width (`TRAY.w`); violations reported per locale to the UIX owner

## LOC-D · Termbase & localisation style guide (Demo)

- [x] LOC-0040 · Demo · P1 · S · Translator sensitivity notes — the church, saints and heresy are fictional: no real saints, deities or scripture substituted; pentagram and witch-hunt terms kept neutral; follows the NAR sensitivity brief
- [x] LOC-0041 · Demo · P1 · S · Period-medicine reference per language — Galenic terms for humours, black bile, buboes, gangrene, cautery and leeching; modern clinical terms listed as banned for translators
- [x] LOC-0042 · Demo · P1 · S · Termbase consistency check — script flags translations where the English source contains a termbase entry but the approved target term is absent; report per locale in CI

## LOC-E · Vendor, pipeline & process (Demo)

- [x] LOC-0048 · Demo · P0 · S · Word counts `npm run i18n:wordcount` — per chapter and scope (UI, callouts, barks, story, store, legal) plus new/changed words since the last handoff, for incremental quotes
- [x] LOC-0049 · Demo · P0 · S · Demo loc schedule — handoff on the NAR script-lock date, translation 3 weeks, LQA 2 weeks, fixes 1 week, all complete 1 week before the Next Fest press preview; dates in the master schedule
- [x] LOC-0052 · Demo · P1 · S · LQA checklist & bug template — truncation, overlap, termbase, grammar/agreement, register, fallback glyphs, untranslated text, placeholder errors; severity mapped to the QA taxonomy; `loc` + language labels

## QAT-B · Rule tests & characterisation suites (Demo)

### Operation rules (current behaviour; tables switch to the GAM scoring spec when it lands)
- [x] QAT-0017 · Demo · P0 · S · Combo multiplier table — `rate()` awards `round(points × (1 + min(combo, 20) × 0.05))`: first COOL = 105, 20th consecutive COOL = 200, 25th still 200; GOOD at combo 1 = 63
- [x] QAT-0018 · Demo · P0 · S · Combo break — BAD and MISS reset `combo` to 0, keep `maxCombo`, award 15 and 0 points, and push the matching cue; `counts` tallies every rating exactly once
- [x] QAT-0019 · Demo · P0 · S · Rank boundary table — `rank()` inclusive at exactly the S/A/B thresholds; XS only with score ≥ S and `bad + miss === 0`; one BAD turns an XS run into S; driven by one table shared with the results screen
- [x] QAT-0020 · Demo · P0 · S · Victory bonus — clearing the last phase adds `round(vitals) × 20 + round(timeLeft) × 10` exactly once; further `update()` calls leave score, vitals and timer unchanged
- [x] QAT-0021 · Demo · P0 · S · Loss states — vitals reaching 0 → `lost` with 'The patient has died.'; timer reaching 0 → `timeLeft` clamped to 0 with 'Time has run out.'; the flatline cue fires once and later updates are no-ops
- [x] QAT-0022 · Demo · P0 · S · Litany clock — during the 8 s Litany `timeLeft` does not decrease, `elapsed` does, and entity updates receive dt × 0.15 (`LITANY_SCALE`)
- [x] QAT-0023 · Demo · P0 · S · Litany gating — `invokeLitany()` succeeds once per operation, fails when `def.litany === false` or status ≠ running, and emits exactly one 'litany' cue
- [x] QAT-0024 · Demo · P0 · S · Tincture — a 0.7 s hold on the body heals 25 (capped at 99) and starts a 6 s cooldown; releasing early resets progress; off-body or cooling-down holds heal nothing
- [x] QAT-0025 · Demo · P1 · S · Empty lancet press — a press on bare body rates MISS, costs 3 vitals and pushes the 'cut' cue; a press outside the `FIELD` ellipse does nothing
- [x] QAT-0026 · Demo · P1 · S · Brand on healthy flesh — holding the brand on bare body drains 4 vitals/s and says 'brand-flesh' once; holding it on a grub, sigil, Choir Voice or open Malison drains nothing
- [x] QAT-0027 · Demo · P0 · S · Phase flow — intro waits 1.2 s, the next phase spawns 0.8 s after the last required entity dies, non-required entities never block, clearing the final phase wins
- [x] QAT-0028 · Demo · P1 · S · Damage feedback — `hurt()` ignored unless running; shake capped at 12 and decaying 30/s; hits ≥ 1 create a red `-N` popup; popups expire after 1.1 s
- [x] QAT-0029 · Demo · P1 · S · Callout queue — each line shows for `max(2.4 s, 0.055 s × length)`; `sayOnce` never repeats a flag; the low-vitals line fires once when vitals drop below 30
- [x] QAT-0030 · Demo · P1 · S · Tool selection — `setTool` ignores tools not in `def.tools`, `cycleTool(±1)` wraps both ways, switching tools releases the captured entity and cancels a tincture hold
- [x] QAT-0031 · Demo · P1 · S · Input priority — presses go to the highest-`layer` entity first (Malison layer 4 over a laceration beneath it); hidden entities never receive presses or sweeps

### Characterisation suites (lock today's behaviour before the GAM/BOS refactors)
- [x] QAT-0032 · Demo · P0 · M · Characterisation harness — scripted interactions per entity record an event trace (ratings with labels, hurt amounts, spawns, callout flags, cues) to snapshot files; the GAM tuning extraction and sim/draw split must keep snapshots identical unless the PR carries a `behaviour-change` label
- [x] QAT-0033 · Demo · P0 · S · Incision & StitchLine snapshots — on-line trace ratings by mean deviation (< 6 px COOL, < 13 px GOOD, else BAD), off-line BAD + 2 vitals, one-stroke close COOL 'Closed' vs multi-stroke GOOD
- [x] QAT-0034 · Demo · P0 · S · BloodPool snapshots — leech drain for blood, pus and black bile; 'Drained' GOOD only when the starting radius was ≥ 20
- [x] QAT-0035 · Demo · P0 · S · Laceration snapshots — stitching while flooded says 'flooded' and makes no progress; one-stroke stitch COOL 'Stitched'; nicks ≤ `SALVE_MAX` (46) sealed by salve GOOD 'Sealed'; claw-rake triples from `chapter2.ts`
- [x] QAT-0036 · Demo · P0 · S · Barbed-arrow snapshots — two lancet nicks rate 'Nick' then 'Barbs freed'; pulling more than 18 px with fewer nicks rates BAD 'Torn', costs 8 vitals, spawns a laceration of spec wound + 30 px bleeding at 1.6 and says 'barbs' once
- [x] QAT-0037 · Demo · P0 · S · Clean-extraction snapshots — bolt, lead shot, fang, shard and glass pulled clear in < 0.9 s rate COOL, slower GOOD, each with its spec label
- [x] QAT-0038 · Demo · P1 · S · Hexstone & hidden-object snapshots — hexstone drain and 'hexstone' callout while lodged; hidden shards ignore presses until the Scrying Lens reveals them (op2-2 `hiddenShard` layout)
- [x] QAT-0039 · Demo · P0 · S · Burn snapshots (fire, acid, hexfire) — salve before debriding says 'burn-eschar'; each pluck GOOD 'Debrided'; last flake says 'burn-salve'; full salve COOL 'Burn dressed'
- [x] QAT-0040 · Demo · P0 · S · Bubo snapshots — lance COOL below 75 % of max radius else GOOD 'Lanced'; a burst costs 10 vitals, pops 'It burst!' and spawns a pus pool plus a 40 px laceration; salving undrained pus says 'pus'; drained + salved GOOD 'Cleansed'
- [x] QAT-0041 · Demo · P0 · S · Rot & Coverage snapshots — spread rate, partial salve regrowth, 'Rot purged'; `Coverage` cell counts for radii 0/12/46/100, `brush` counts only new cells, `contains(p, pad)` edges
- [x] QAT-0042 · Demo · P0 · S · Venom snapshots — tincture 'Antidote' COOL while spread radius < 50 else GOOD; untreated drain rises monotonically at the op's `rate`
- [x] QAT-0043 · Demo · P0 · S · Grub & SpiderlingGrub snapshots — brand hold COOL 'Seared', tongs pluck GOOD 'Plucked'; grubs never leave the `FIELD` ellipse in 60 s of wandering
- [x] QAT-0044 · Demo · P0 · S · Sigil snapshots — eye, trident, crown and hourglass glyphs; 'Curse broken' COOL within 4 s of spawn else GOOD; a lash costs 4 vitals every `lashEvery` seconds (5 default, 4.5 in op2-4) with its popup
- [x] QAT-0045 · Demo · P0 · S · EggSac snapshots — lance COOL when more than 8 s remain before hatching else GOOD 'Lanced'; hatching rates MISS 'Hatched', costs 6 vitals and releases spiderlings; 5 s warning line said once per sac
- [x] QAT-0046 · Demo · P0 · M · Matins snapshots — shroud open/veiled rhythm, brand while veiled says 'malison-veiled' with no damage, 'Wounded' spawns hexlings, rend lacerations while moving, 'Malison unmade' splits into shards; shard rejoin MISS + 10 vitals, cast-out COOL
- [x] QAT-0047 · Demo · P0 · M · Lauds snapshots — Voices shield the heart ('lauds-shielded'), each Voice silenced by a brand hold (COOL 'Silenced', silence decays at 0.35/s when released), Hymn lacerations, submerge → Lens hunt, 'Malison unmade' → hexstone shards
- [ ] QAT-0048 · Alpha · P1 · M · Ch3–5 characterisation snapshots — every Chapter 3–5 entity and Malison hour snapshotted as it lands (GAM-E ailments, BOS bosses), before its first tuning pass

### Cross-cutting
- [x] QAT-0049 · Demo · P1 · M · Tool × entity matrix — one table-driven test pressing/holding/dragging each of the 8 tools on each entity type; asserts the documented response (ignored, hint callout or penalty) and that no pair throws
- [x] QAT-0050 · Demo · P0 · S · Save helper tests — `fresh()` defaults, `recordBest` rank order XS > S > A > B > C with equal-rank higher-score rule and return value, `advance` never regressing progress
- [x] QAT-0051 · Demo · P1 · M · Scoring invariants (fast-check) — random pointer/tool streams on every demo op: vitals ∈ [0, 99], score never decreases, `combo ≤ counts.cool + counts.good`, status only moves intro → running → won|lost (crash/NaN fuzzing stays with INP)
- [x] QAT-0052 · Demo · P2 · M · Mutation testing (StrykerJS) on `src/surgery/operation.ts` and `entities.ts` — baseline mutation score recorded; ≥ 75 % on `operation.ts` by the demo RC; surviving mutants in scoring code filed as test gaps
- [x] QAT-0053 · Demo · P1 · S · Story data checks — every line's speaker exists in `CAST`, no empty lines, every chapter ends with a story step carrying its END OF CHAPTER narration, story ids unique across chapters

## QAT-C · Replay-based QA (Demo; builds on the ENG/GAM recorder and golden runs)

- [x] QAT-0054 · Demo · P0 · M · Failure-path goldens — per demo op a loss-by-vitals and a loss-by-timer replay, plus a last-second-Litany replay for Matins and Lauds, added to the golden suite so loss handling and results are regression-tested
- [ ] QAT-0056 · Demo · P1 · S · Runtime parity — the same replays re-simulated in Node (Vitest), Chromium (Playwright) and the packaged desktop build produce identical state hashes; any divergence blocks the build
- [x] QAT-0057 · Demo · P1 · S · Golden-update review — PRs that change golden hashes need the `behaviour-change` label and a GAM reviewer via CODEOWNERS; bot-only changes never rewrite goldens
- [x] QAT-0058 · Demo · P1 · S · Replay-first bug workflow — S1/S2 gameplay bugs carry the PLT/INP F8 replay or a note why not; triage re-simulates it to confirm the repro before assignment

## QAT-D · End-to-end flows (Demo)

- [x] QAT-0059 · Demo · P0 · M · Playwright E2E project — `tests/e2e/` on the built preview (SwiftShader) using the stable debug API; traces and screenshots kept on failure
- [x] QAT-0060 · Demo · P0 · M · New-game flow — title → prologue → op1-1 won with bot-planned *real* mouse events → results → s1-2; the save's progress is asserted after each step
- [x] QAT-0061 · Demo · P0 · S · Continue/resume flow — reload mid-chapter and Continue lands on the saved step; quitting mid-operation resumes at that operation's briefing (PLT autosave rule)
- [x] QAT-0062 · Demo · P1 · S · Retry & quit flows — loss → results → Retry restarts with the same seed; pause → Quit to title → Continue; ENG GL-object counters unchanged after 10 loops
- [x] QAT-0063 · Demo · P1 · S · Options persistence — each option changed, page reloaded, value retained and applied (e.g. volume reaches the master gain, reduce-flashing reaches the post-process uniforms)
- [x] QAT-0064 · Demo · P1 · M · Input-path parity — a bot plan executed through Playwright mouse events and directly through `handlePointer` yields the same rating counts (±1) on op1-1 and op1-2, validating the `Input` → `Pointer` conversion

## QAT-E · Visual & performance QA (Demo; builds on the ENG/ART/UIX screenshot suites)

- [ ] QAT-0066 · Demo · P1 · S · One baseline environment — every Playwright screenshot suite (ENG, ART, UIX, QAT) regenerates baselines only inside the Playwright 1.55 Docker image via `npm run visual:update`; locally generated baselines rejected by CI
- [ ] QAT-0067 · Demo · P1 · S · Baseline approval rule — `CODEOWNERS` on screenshot folders: ART approves art scenes, UIX approves UI, QAT approves flows; baseline PRs show before/after diffs in the description
- [ ] QAT-0070 · Demo · P1 · S · Context-loss visual test — `WEBGL_lose_context` lose/restore mid-operation; the first frame after restore matches the pre-loss capture within tolerance and the sim resumes
- [ ] QAT-0071 · Demo · P2 · S · No-WebGL2 path — the browser build shows the `#fatal` text and the desktop build shows the ENG fatal screen with GPU info when WebGL2 is disabled (screenshot tests)
- [x] QAT-0072 · Demo · P1 · S · Sim micro-benchmarks (`vitest bench`) — `Operation.update` + `handlePointer` with 150 live entities tracked nightly; a > 20 % regression opens an issue
- [x] QAT-0073 · Demo · P2 · S · Perf-run protocol `docs/qa/perf-protocol.md` — fixed driver versions, power plan, SteamOS version, warm-up, median of 3 runs; applied to every ENG benchmark capture on reference machines

## QAT-F · Debug & test tooling (Demo; extends the ENG dev console and GAM cheats)

- [x] QAT-0074 · Demo · P0 · M · Stable automation API `window.__game.debug` (versioned) — `state()`, `skipPhase()`, `setVitals()`, `waitFor(status)`, `goto(chapter, step)`; smoke and E2E stop reading `scene.op.entities` internals; stripped from release with the other dev code
- [x] QAT-0075 · Demo · P1 · S · Test-state presets — saves for fresh, mid-Ch1 (before op1-3), pre-Matins, Ch2 start, pre-Lauds, demo complete and all-XS; loadable via `preset <name>` and `?preset=`
- [x] QAT-0076 · Demo · P1 · S · Cheat menu overlay (F1) — controller- and Deck-navigable list mirroring the common console commands, for testers without a keyboard
- [x] QAT-0077 · Demo · P1 · S · Content-navigation commands — `chapter <n> <step>`, `story <id> [line]`, `unlockall`, `results <rank>`, `flag <name> <value>`, `demoend` added to the ENG console
- [ ] QAT-0078 · Demo · P2 · S · Console history in bug reports — commands used in the session are included in the PLT F8 bundle so cheated states are visible in repro data

## QAT-G · Operation editor with live preview (Alpha; on the CON operation schema)

- [ ] QAT-0079 · Alpha · P1 · L · Editor MVP (`?editor=1`, dev builds) — phase list, entity palette, drag-to-place on the operating field, property inspector (radius, angle, kind, barbed, hidden, hp), saving through a Vite dev-server endpoint to the CON operation JSON
- [ ] QAT-0080 · Alpha · P1 · M · Live preview — "Play from phase N" runs the real `Operation` with the unsaved data; edits hot-reload in ≤ 1 s without losing editor state
- [ ] QAT-0081 · Alpha · P1 · S · Inline validation — CON schema and tool-requirement errors shown as red markers on the offending entity and phase
- [ ] QAT-0082 · Alpha · P2 · M · Inline bot runs — "Simulate ×50" runs the GAM bot profiles in a Web Worker and shows win rate, median rank and par beside the op
- [ ] QAT-0083 · Alpha · P2 · S · Callout picker — callouts chosen or created as string keys (with English text written to `en.json`), never raw strings in operation data
- [ ] QAT-0084 · Alpha · P2 · S · Editor comforts — undo/redo (≥ 50 steps), copy/paste of phases and entities, duplicate-op command
- [ ] QAT-0085 · Alpha · P2 · S · Deterministic output — stable key order and 2-space indentation so an editor save produces a minimal PR diff (test: load + save without edits = no diff)

## QAT-H · Bug process & triage (Demo)

- [x] QAT-0086 · Demo · P0 · S · Severity taxonomy — S1 crash/save loss/progression block, S2 major feature broken without workaround, S3 workaround exists or clearly visible, S4 cosmetic; each with examples from this game
- [x] QAT-0088 · Demo · P1 · S · Issue templates — bug (build id, OS, GPU, steps, expected/actual, F8 bundle), crash, loc/text, perf, feature request; required fields enforced by issue forms
- [x] QAT-0090 · Demo · P1 · S · Regression policy — every fixed S1/S2 gains an automated test, snapshot or golden replay before it can move to Verified
- [x] QAT-0092 · Demo · P2 · S · QA metrics — open bugs by severity and area, find vs fix rate, reopen rate and escaped defects (first reported by players) per build, shown in the weekly status note

## QAT-I · Telemetry, funnels & dashboards (Demo; extends the PLT opt-in telemetry)

### Pipeline
- [x] QAT-0094 · Demo · P0 · M · Event schema v1 (versioned JSON Schema) extending the PLT event set — `session_start` (build, OS, GPU family, locale, edition, install id), `op_start`, `op_end` (op, result, rank, score, duration, min vitals, rating counts, max combo, Litany used, tinctures, assists), `op_fail` (reason, phase, live entity kinds), `rating` (tool, entity kind, rating, x/y quantised to 32 px), `tool_select`, `story_skip`, `settings_changed`, `wishlist_click`, `quit`
- [x] QAT-0095 · Demo · P0 · S · Schema tests — every event the game emits validates against the schema in unit tests; unknown fields or missing required fields fail CI
- [x] QAT-0097 · Demo · P1 · S · Client batching — flush every 60 s and on quit, offline queue capped at 1 MB, exponential backoff; telemetry adds < 0.1 ms per frame (measured)

### Analysis
- [x] QAT-0101 · Demo · P0 · S · Demo funnel definition — launch → consent answered → title → new game → op1-1 started → op1-1 won → … → Matins won → Ch2 started → Lauds won → demo-end shown → wishlist clicked; each step one event

## QAT-J · Compatibility & platform QA (Demo)

- [x] QAT-0111 · Demo · P0 · S · Compatibility matrix `docs/qa/compat-matrix.md` — aggregates the ENG GPU/ANGLE, PLT OS/display and INP device matrices into one board with owner, status and evidence link per cell
- [x] QAT-0113 · Demo · P1 · S · OS-locale edge cases — Windows display/format set to tr-TR, de-DE, pl-PL and pt-BR: no key-casing bugs (Turkish dotted/dotless i), no decimal-comma breakage in settings or saves

## OPS-G · Steam store & demo pages (Demo)

- [x] OPS-0081 · Demo · P0 · M · Store copy — short description ≤ 300 characters, About This Game using the ART section banners and GIFs, 5 feature bullets; checked against the marketing-reference rules before submission
- [x] OPS-0082 · Demo · P0 · S · Tags & genre — 20 tags chosen from 10 comparable titles (surgery, dark fantasy, medieval, gore, story rich, visual novel…); revisited after the first 1,000 wishlists
- [x] OPS-0088 · Demo · P1 · S · Weekly store-traffic review — Steamworks impressions → visits → wishlists; if visit rate stays below the genre median for 3 weeks, test a new capsule or short description

## OPS-H · Trailers, press kit & marketing (Demo → Release)

- [x] OPS-0097 · Demo · P1 · S · Announce day — trailer premiere, press release, store page public, Discord open and social posts on one date, run from a checklist
- [x] OPS-0098 · Demo · P1 · S · Wishlist targets — monthly wishlist targets to Next Fest and launch derived from the revenue forecast; tracked weekly with the actions taken when below target

## OPS-I · Steam Next Fest (Demo)

- [x] OPS-0107 · Demo · P0 · S · Marketing calendar — T-10 weeks store assets final, T-8 string freeze/loc handoff, T-6 demo RC, T-4 Valve demo review (PLT checklist), T-2 press preview, T-0 festival; owners per line
- [x] OPS-0109 · Demo · P1 · S · Demo public-release timing — release the demo publicly before the festival (early wishlists and reviews) or at its start; decision logged with the reasoning
- [x] OPS-0111 · Demo · P0 · S · Festival-week operations — daily funnel dashboard review, Steam discussions and Discord sweep, known-issues update, daily summary posted

## OPS-J · Community, press & creators (Demo → Post)

- [x] OPS-0122 · Demo · P1 · S · Key policy — every Steamworks key request logged (purpose, recipient, batch); leaked or unused keys revoked; no keys to unverified requesters
- [x] OPS-0126 · Release · P1 · S · Launch-week community plan — Discord launch event, dev AMA, and a Steam review-response rule (reply to bug-related negative reviews within 48 h with the fix status)

## QAT-L · Demo test plan, test suites & certification (Demo)

### Plan & cases
- [x] QAT-0128 · Demo · P0 · M · Demo test plan `docs/qa/demo-test-plan.md` — scope (front end, options, tutorials, 10 ops, 2 bosses, story, save/Cloud, results, demo end), platforms, entry/exit criteria, schedule and the suites below
- [x] QAT-0129 · Demo · P0 · S · Exit criteria — 0 open S1/S2, ≤ 15 S3 with owner sign-off, crash-free sessions ≥ 99.5 % in the RC playtest round, perf budgets met on Deck and min-spec, every suite executed on the RC
- [x] QAT-0130 · Demo · P1 · S · Test-case repository `docs/qa/cases/` — cases with stable ids (e.g. `TC-SAVE-004`), priority and `smoke`/`regression`/`full` tags; the regression set runs in ≤ 4 h by one tester

### Suites (written and executed on the RC)
- [x] QAT-0131 · Demo · P0 · S · Front-end suite — new game, continue, chapter select, options entry/exit, credits, quit, demo ribbon, owned-full-game title state
- [x] QAT-0132 · Demo · P0 · S · Story suite — advance, skip, auto, backlog, choices and flags, speaker plates, END OF CHAPTER cards for s1-end and s2-end
- [x] QAT-0133 · Demo · P0 · M · Per-operation suite × 10 — win, loss by vitals, loss by timer, retry, quit mid-op, alt-tab mid-op, Litany used/unused, every hotkey and wheel switch, rank seal and NEW BEST on results
- [x] QAT-0134 · Demo · P0 · S · Tutorial suite — each tool tutorial completes, can be failed and retried, can be skipped on replay, and shows mouse or gamepad glyphs to match the last device
- [x] QAT-0135 · Demo · P0 · S · Save suite — quit at every story/op boundary and relaunch to the right step; kill during save; corrupted and deleted save; Steam Cloud round trip between two PCs
- [x] QAT-0136 · Demo · P0 · S · Options suite — every option applies immediately and survives restart (audio buses, display mode, render scale, frame cap, shake, flashing, text size, gore level, assists, language, bindings)
- [x] QAT-0137 · Demo · P1 · S · Audio & focus suite — bus volumes, mute when unfocused, headphone unplug mid-op, overlay open during an op, minimise/restore
- [x] QAT-0138 · Demo · P0 · S · Demo-end suite — after s2-end the demo-complete scene appears, the wishlist button works with the Steam overlay on and off, no route reaches Chapter 3, replaying ops from the summary works
- [x] QAT-0139 · Demo · P1 · S · Steam edge-case suite — Steam offline mode, launch outside Steam (restart via Steam), overlay disabled, Big Picture/Deck gaming mode, Cloud conflict dialog

### Exploratory charters (session reports in `docs/qa/charters/`)
- [x] QAT-0140 · Demo · P1 · S · Charter: tool switching and capture — switching tools, pausing and opening the overlay mid-drag, mid-hold and mid-pull on every entity type
- [x] QAT-0141 · Demo · P1 · S · Charter: Litany edge cases — star drawn during phase transitions, at 1 vitals, while paused, while a Voice or shard is grabbed, and on the last second of the timer
- [x] QAT-0142 · Demo · P1 · S · Charter: window and display chaos — alt-tab spam, monitor unplug, display sleep, DPI change while moving the window, fullscreen toggles during a boss
- [x] QAT-0143 · Demo · P1 · S · Charter: entity pressure — Lauds Hymn plus spiderlings plus pools at maximum; frame time, readability and input priority observed and logged

### Soak, localisation & sign-off
- [x] QAT-0146 · Demo · P0 · S · Certification master checklist `docs/qa/cert-demo.md` — Steamworks, Deck, legal-screen and accessibility items from PLT, INP, UIX and OPS aggregated with evidence links; every item green before the go/no-go gate
- [x] QAT-0148 · Demo · P1 · S · Demo patch regression checklist — 60-minute smoke (boot, op1-1, Matins, Lauds, save/resume, demo end, language switch) run on every demo hotfix before it goes live

## OPS-K · Demo release (Demo)

- [x] OPS-0128 · Demo · P0 · S · Demo launch comms checklist — build live, "Download Demo" visible, localised descriptions, announcement posted in all demo languages, Discord ping, press and creator emails, dashboards watched; ticked and archived
- [x] OPS-0129 · Demo · P1 · S · Demo hotfix policy — S1 fixed within 24 h and S2 within 72 h for the first two weeks after release and during Next Fest; patch notes posted on Steam for each update
- [x] OPS-0131 · Demo · P1 · S · Demo lifecycle decision — the demo stays available after 1.0 (with carry-over messaging) or is retired; logged with the reasoning

## QAT-M · Full-game QA: Alpha → Release → Post

### Alpha
- [x] QAT-0151 · Alpha · P0 · S · Alpha test plan — Ch1–5 playable end to end with placeholder art, all core systems feature-complete; entry/exit criteria and new suites for Ch3–5 listed
- [x] QAT-0152 · Alpha · P1 · M · Chapter III functional pass — every op (Prime and Terce included) won, lost by vitals and by timer, retried; story scenes and flags checked; results filed per op
- [x] QAT-0153 · Alpha · P1 · M · Chapter IV functional pass — every op (Sext and None included) won, lost by vitals and by timer, retried; story scenes and flags checked
- [x] QAT-0154 · Alpha · P1 · M · Chapter V functional pass — every op (Vespers and Compline included) won, lost by vitals and by timer, retried; endings and credits reached
- [x] QAT-0155 · Alpha · P1 · S · Campaign graph checks for five chapters — every chapter reachable, unlocks chain correctly, challenge-mode entries reference existing ops, demo carry-over lands on Ch3

### Beta
- [x] QAT-0156 · Beta · P0 · S · Beta test plan — content complete, all shipped languages, full compatibility matrix, accessibility and performance; exit criteria for the RC
- [ ] QAT-0158 · Beta · P1 · M · Field-triage discipline suite — patient queue, switching patients, simultaneous timers, scoring; win/loss paths
- [ ] QAT-0159 · Beta · P1 · M · Diagnosis discipline suite — symptom inspection, wrong-diagnosis penalties, case completion and scoring
- [ ] QAT-0160 · Beta · P1 · M · Forensic/inquisition discipline suite — evidence collection, deduction steps, story flags written, scoring
- [ ] QAT-0161 · Beta · P1 · M · Bone-setting discipline suite — alignment gestures, fracture variants, splinting, scoring
- [ ] QAT-0162 · Beta · P1 · M · Challenge-mode suite — every challenge op, leaderboard upload and download, ties, offline queueing; plausibility bound (score > 1.1 × expert-bot par) flagged before the replay check
- [ ] QAT-0163 · Beta · P1 · M · Full-campaign renderer run — bots play Ch1–5 back to back in the real game loop (≈5 h) with no crash, leak or save corruption; run weekly

### Release
- [x] QAT-0165 · Release · P0 · S · Full-game certification checklist `docs/qa/cert-1.0.md` — demo checklist extended with achievements, leaderboards, Cloud, Deck and store items; evidence links for every row

## LOC-H · Full-game localisation (Beta → Post)

### Full-game text & process
- [x] LOC-0098 · Beta · P0 · S · Full-game loc schedule — handoff on the NAR full-game script lock, UI string freeze on the same date, translation and LQA windows ending 3 weeks before the RC gate
- [x] LOC-0104 · Release · P1 · S · Patch-notes template — day-one and hotfix notes published in every shipped language within 48 h of the English notes

## OPS-L · Full-game release (Beta → Release)

- [x] OPS-0135 · Beta · P1 · S · Launch marketing plan — dated beats (release-date reveal, launch trailer, preview coverage, review embargo, launch streams) tied to wishlist targets
- [x] OPS-0136 · Release · P0 · M · Commercial & comms launch checklist — price and discount live, page approved, press embargo scheduled, social posts queued, Discord event, review-copy wave confirmed, dashboards open (technical launch items stay in the PLT release checklist)
- [x] OPS-0137 · Release · P0 · S · Day-one patch plan — patch branch cut from the RC, contents frozen 5 days before launch, notes drafted and translated, QA verification scheduled before launch hour
