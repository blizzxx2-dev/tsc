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
- [ ] QAT-0014 · Demo · P1 · M · Nightly QA workflow — sim/characterisation suites, E2E flows, localised and pseudo-loc captures, playtest-replay re-sims; summary posted to the job summary and the team Discord webhook; failures open an issue labelled `nightly`
- [x] QAT-0015 · Demo · P1 · S · Flaky-test policy — Playwright `retries: 2` in CI; a test that passes only on retry auto-files a `flaky` issue; quarantined tests listed in `tests/QUARANTINE.md` with a 2-week fix deadline
- [x] QAT-0016 · Demo · P2 · S · Playwright sharding — suites run with `--shard=i/4` across parallel jobs once E2E + visual exceed 5 minutes; one merged HTML report uploaded per run

## OPS-A · Production cadence & tracking (Demo)

### Cadence
- [ ] OPS-0001 · Demo · P0 · S · Two-week sprint cadence — planning, mid-sprint check, review on a playable build, retro; sprint goal and committed tasks recorded on the GitHub Project before day 1 of each sprint
- [ ] OPS-0002 · Demo · P1 · S · Sprint-review build — every sprint ends with a tagged build on the Steam `qa` branch and a 1-page "what changed / what to test" note linked from the review
- [ ] OPS-0003 · Demo · P1 · S · Weekly status note — Friday update (burn-up vs forecast, risks that moved, decisions needed, next week's focus) posted to the production channel and archived in `docs/production/status/`
- [ ] OPS-0004 · Demo · P1 · S · Decision log `docs/production/decisions.md` — date, decision, alternatives, owner, link; every scope, legal, pricing and vendor decision in this file points to an entry
- [ ] OPS-0005 · Demo · P1 · S · Sustainable-pace policy — planned load ≤ 40 h/week per person; two consecutive weeks above 45 h trigger a scope review in the next status note instead of crunch
- [ ] OPS-0006 · Demo · P2 · S · Milestone retrospectives — after every gate (M0, Demo, Alpha, Beta, Release) a retro with ≤ 5 actions, each assigned and tracked to closure on the board

### Tracking
- [ ] OPS-0007 · Demo · P0 · M · Roadmap → issue sync — script parses every `docs/roadmap/*.md` task line (id, phase, priority, size, title) into GitHub issues with labels and writes closed issues back as `[x]`; idempotent (a second run changes nothing)
- [ ] OPS-0008 · Demo · P0 · S · GitHub Project views — by phase, by workstream, by priority, and a "Demo critical path" view filtered to `Demo` + `P0`; saved views linked from the README
- [ ] OPS-0009 · Demo · P1 · S · Milestone burn-up — points S = 1, M = 3, L = 8; weekly burn-up per phase with a forecast finish date; a forecast slipping > 2 weeks past a gate triggers a scope review
- [ ] OPS-0010 · Demo · P0 · M · Master schedule — dated plan from today (late September 2026) to Next Fest and 1.0 with lead times for art, music, localisation, rating, Valve store/build review and trademark filing; 15 % buffer on every external dependency
- [ ] OPS-0011 · Demo · P0 · S · Cross-file dependency map — every cross-workstream dependency in the roadmap files (e.g. LOC needs the UIX string extraction and PLT string tables at Demo, not Beta) listed with both owners; phase conflicts resolved and the source tasks re-tagged
- [ ] OPS-0012 · Demo · P2 · S · Contractor onboarding pack — access checklist (GitHub, Drive, Discord, Steamworks role), bibles, file-naming rules, review slots; a new contractor ships a first deliverable in week 1
- [ ] OPS-0013 · Demo · P0 · S · Account security — 2FA on GitHub, Steamworks, domain registrar, email and social accounts; shared credentials only in a team password manager; two admins on every critical account

## OPS-B · Milestone gates & definitions of done

- [ ] OPS-0014 · Demo · P0 · S · Task-level Definition of Done — reviewed, tests or golden replay updated, strings in the string table, no new lint errors, changelog line, verified in a build by someone other than the author; linked from the PR template
- [ ] OPS-0015 · M0 · P0 · S · M0 gate review — Chapter 1 (op1-1…op1-5 + Matins) playable from the title, bot winnability tests and smoke green, prototype retro held; go/no-go and carry-over list recorded
- [ ] OPS-0016 · Demo · P0 · M · Demo Definition of Done — Ch1–2 (10 operations, Matins + Lauds) with tutorials, options, save/Cloud, controller and Deck basics, the demo languages, opt-in telemetry and the wishlist screen; 0 open S1/S2; perf budgets met; Valve build and store review passed
- [ ] OPS-0017 · Demo · P0 · S · Demo feature lock — dated; afterwards only content, polish and fixes merge; any exception needs an equal-size cut recorded in the decision log
- [ ] OPS-0018 · Demo · P0 · S · Demo content lock — Ch1–2 operation data and English strings locked on the same date as the NAR demo script lock; later changes are triage-approved bug fixes only
- [ ] OPS-0019 · Demo · P0 · S · Demo go/no-go gate — QA sign-off, legal clearance, store readiness, content survey and Next Fest registration reviewed 3 weeks before the press preview; outcome and fallback edition recorded
- [ ] OPS-0020 · Alpha · P0 · S · Alpha Definition of Done & gate — all core systems feature-complete, Ch1–5 playable end-to-end with placeholder art/audio, every operation has a golden replay and calibrated ranks; gate review recorded
- [ ] OPS-0021 · Beta · P0 · S · Beta Definition of Done & gate — content complete, final art/audio/VO in, all shipped languages in, balance signed off, achievements/Cloud/Deck integrated, 0 open S1
- [ ] OPS-0022 · Release · P0 · S · Release-candidate gate — 0 open S1/S2, certification checklist passed, rating certificates on file, store page approved, launch comms scheduled; RC build SHA recorded
- [ ] OPS-0023 · Release · P0 · S · Gold-master go/no-go — build locked, day-one patch contents frozen, rollback build identified, launch rota staffed; signed by the owner and the QA lead

## OPS-C · Risk register & scope management

- [ ] OPS-0024 · Demo · P0 · S · Risk register `docs/production/risks.md` — probability × impact, owner, trigger, mitigation, status; seeded with IP similarity (Atlus/SEGA *Trauma Center* expression, Games Workshop tone), Deck/low-end GPU performance, Next Fest slip, art throughput, key-person bandwidth, gore/occult rating limits, CJK/Cyrillic font cost, VO budget; reviewed each sprint
- [ ] OPS-0025 · Demo · P0 · S · Demo MoSCoW — Must/Should/Could/Won't list for demo features (challenge mode, alternate disciplines and full VN VO default to Won't) published to the team and mirrored as board labels
- [ ] OPS-0026 · Demo · P1 · S · Change control — after feature lock every addition names an equal-sized cut; `docs/production/cut-list.md` keeps cut items with the phase they move to
- [ ] OPS-0027 · Demo · P1 · S · Next Fest fallback plan — criteria for moving to the following Next Fest edition, pre-written team and community messaging, and what the extra weeks are spent on; approved before the go/no-go gate
- [ ] OPS-0028 · Alpha · P0 · S · Chapters 3–5 scope lock — ≈5 operations per chapter, the six remaining Malison hours (Prime, Terce, Sext, None, Vespers, Compline) two per chapter, and which disciplines ship at 1.0; recorded before Alpha kickoff
- [ ] OPS-0029 · Alpha · P1 · S · Post-demo re-plan — demo telemetry, wishlists and playtest findings used to re-estimate Ch3–5; schedule and budget re-baselined and the burn-up reset
- [ ] OPS-0030 · Alpha · P1 · S · Chapter III content milestones dated — outline lock, ops playable with placeholder art, story first draft, art lock, loc handoff
- [ ] OPS-0031 · Alpha · P1 · S · Chapter IV content milestones dated — outline lock, ops playable with placeholder art, story first draft, art lock, loc handoff
- [ ] OPS-0032 · Alpha · P1 · S · Chapter V content milestones dated — outline lock, ops playable with placeholder art, story first draft, art lock, loc handoff (finale Compline boss first)
- [ ] OPS-0033 · Beta · P1 · S · Cut-line review — at Beta start remaining features are ranked; everything below the line moves to `Post` and is reflected in the public roadmap

## OPS-D · Budget, hiring & contracts (Demo → Alpha)

### Budget & business model
- [ ] OPS-0034 · Demo · P0 · M · Studio budget model — one spreadsheet rolling up the ART and AUD budgets plus writing/editing, localisation, legal/trademark, ratings, marketing, QA contractors, hardware, software, Steam Direct fee and 15 % contingency, for Demo and 1.0; monthly actuals vs plan
- [ ] OPS-0035 · Demo · P1 · S · Localisation budget — word counts per scope (Ch1–2 story, callouts, UI, store, legal) × per-language vendor rates + 20 % for LQA and late changes; approved before vendor contracts
- [ ] OPS-0036 · Demo · P1 · M · Revenue forecast — conservative/base/optimistic scenarios from wishlists-at-launch, conversion, price and regional mix; break-even point and the wishlist target it implies, reviewed after Next Fest
- [ ] OPS-0037 · Demo · P1 · S · Test hardware — Steam Deck (LCD + OLED), Intel UHD 620 laptop, a hybrid-graphics laptop, an older NVIDIA GTX and an AMD RDNA card, plus an Apple-silicon Mac if a Mac build is greenlit; inventory with owner and location
- [ ] OPS-0038 · Demo · P2 · S · Funding route — self-funding vs publisher vs regional games funds; pitch deck with the demo, wishlist data and budget; decision and application deadlines in the decision log

### Contracts
- [ ] OPS-0039 · Demo · P0 · M · Company-wide contractor agreement (counsel-reviewed) — work-for-hire/IP assignment, moral-rights waiver where lawful, confidentiality, originality warranty (no third-party IP), generative-AI disclosure; the ART and AUD contract checklists become schedules to it
- [ ] OPS-0040 · Demo · P1 · S · Credit obligations register — each contract's credit wording and placement recorded in one sheet that feeds the in-game credits and the store page
- [ ] OPS-0041 · Demo · P1 · S · Milestone payments — every statement of work lists deliverables and acceptance criteria; invoices are paid only against accepted milestones, tracked in the budget model

### Hiring (roles not owned by the ART outsourcing or AUD casting plans)
- [ ] OPS-0042 · Demo · P0 · S · Composer sourcing — shortlist of 5 from the AUD music brief, paid 60 s test cue, selection recorded; the chosen composer then goes through the AUD music contract
- [ ] OPS-0043 · Demo · P1 · M · Narrative editor — archaic-register English editor contracted for the NAR proofread/continuity passes on Ch1–2 (paid sample edit of the prologue); Ch3–5 availability agreed
- [ ] OPS-0044 · Demo · P1 · S · Trailer editor — portfolio review and quote; cuts the announce and Next Fest trailers from the ART storyboards; delivery dates tied to the store-page launch
- [ ] OPS-0045 · Demo · P2 · S · PR/marketing support — freelance PR vs self-run decision with cost; if hired, scope covers the press list, outreach waves and the Next Fest campaign
- [ ] OPS-0046 · Demo · P1 · S · QA contractors — quote from a compatibility lab or freelance tester pool for the demo matrix; booked 6 weeks before the demo RC
- [ ] OPS-0047 · Alpha · P1 · S · Ch3–5 capacity booking — writing, music, loc vendor and QA capacity for Alpha→Beta booked against the re-baselined schedule; gaps logged as risks

## OPS-E · IP & legal clearance (Demo, re-checked at Alpha and Release)

### Distance from Games Workshop and Atlus/SEGA
- [ ] OPS-0048 · Demo · P0 · S · Games-IP counsel retained — engagement letter covering title clearance, the *Trauma Center* expression memo, contract template, EULA and privacy policy; budget line in the studio model
- [ ] OPS-0049 · Demo · P0 · M · *Trauma Center* expression & trade-dress review — HUD layout, vitals meter, tool tray, COOL/GOOD/BAD/MISS words, "XS" rank label, star-gesture presentation, assistant-portrait framing and story beats compared side by side with the Atlus DS/Wii games; counsel memo lists required changes as tickets
- [ ] OPS-0050 · Demo · P0 · S · Rating & rank wording decision — keep or replace COOL/GOOD/BAD/MISS and "XS" per the counsel memo; decision logged and pushed to the GAM scoring spec, the UIX HUD and the LOC termbase
- [ ] OPS-0051 · Demo · P0 · S · Marketing-reference rules — counsel-approved guidance: never "Warhammer" or GW names, logos or art; no Atlus footage, screenshots or logos; whether "for fans of surgery-action games" copy may name *Trauma Center* in press only; checklist attached to every store/press/trailer review
- [ ] OPS-0052 · Demo · P0 · S · Counsel review of the NAR name register — every character, faction, place, saint and boss name in the NAR register and blocklist reviewed by counsel against GW and Atlus/SEGA marks; written sign-off before the announce
- [ ] OPS-0053 · Demo · P0 · S · Character-likeness sign-off — final portraits of Kreuzer, Ilse, Stroh, Haller, Mauer and the Choir compared with the *Trauma Center* cast (e.g. Derek Stiles, Angie Thompson) and GW characters; producer and counsel sign-off recorded before the portraits ship
- [ ] OPS-0054 · Demo · P0 · S · Resolve the `warpshard` rename conflict — GAM proposes id `hexstone`, NAR proposes `hexshard`; one id and display name chosen, both tasks updated, save/replay migration owner named
- [ ] OPS-0055 · Demo · P1 · S · Independent-creation archive — dated design docs, `docs/research/`, sketches, story drafts and commit history snapshotted at each milestone into write-once storage, to rebut copying claims
- [ ] OPS-0056 · Demo · P1 · S · IP-claim response procedure — who receives notices, counsel contact, response SLA, takedown handling; DMCA designated agent registered before any user-generated content ships
- [ ] OPS-0057 · Demo · P2 · S · Errors-and-omissions insurance — quotes for IP-infringement cover obtained and a buy/no-buy decision logged before the announce

### Title & brand
- [ ] OPS-0058 · Demo · P0 · M · Counsel trademark clearance — "Suture & Steel", "Suture and Steel" and "The Malison Hours" searched in USPTO Trademark Search, EUIPO eSearch, UKIPO, WIPO Global Brand Database, J-PlatPat and KIPRIS (Nice classes 9, 28, 41) plus Steam, itch.io and console stores; written clearance opinion on file (the NAR title search is the first pass)
- [ ] OPS-0059 · Demo · P1 · S · Fallback title shortlist — 3 alternates pre-screened with the same knock-out search so a late conflict does not stall the announce
- [ ] OPS-0060 · Demo · P1 · M · Trademark filings — "Suture & Steel" word mark (and the ART logo if distinctive) filed with EUIPO and USPTO in classes 9 and 41 before the public announce; receipts in `docs/legal/`
- [ ] OPS-0061 · Demo · P1 · S · Domains & handles — suture-and-steel domains (.com plus chosen ccTLDs), Steam developer/publisher names, X, Bluesky, YouTube, TikTok, Reddit and a Discord vanity URL registered to the company account
- [ ] OPS-0062 · Demo · P0 · S · Rebrand audit outside code — documents, store drafts, press assets, social bios and the Steamworks app name all read "Suture & Steel — The Malison Hours"; no "Grim Apothecary" or "grim-surgeon" in public material (code identifiers are PLT's task)

### Licences, disclosures & company
- [ ] OPS-0063 · Demo · P0 · S · Steam AI-content disclosure — Steamworks content survey answered from the ART and AUD provenance logs (pre-generated and live-generated content); re-checked at every milestone gate
- [ ] OPS-0064 · Demo · P1 · S · Open-source & font notices legal review — the PLT-generated third-party notices (runtime, npm, OFL fonts) checked by counsel before the demo RC; gaps filed to PLT
- [ ] OPS-0065 · Demo · P0 · S · Legal entity & Steamworks onboarding — company entity confirmed, Steamworks partner agreement signed, tax interview and bank verified, Steam Direct fee paid for the full-game app; all IP assigned to the entity
- [ ] OPS-0066 · Demo · P1 · S · NDA template — mutual NDA for playtesters, contractors and press previews with e-signature; signed copies stored per person
- [ ] OPS-0067 · Demo · P0 · M · EULA decision — Steam Subscriber Agreement only vs custom EULA (telemetry, conduct, future mods); if custom, drafted by counsel, shown on first launch and linked on the store page
- [ ] OPS-0068 · Demo · P0 · M · Privacy policy — GDPR/UK GDPR/CCPA: opt-in telemetry, crash reports, newsletter and Discord; controller identity, processors, 90-day raw-event retention, deletion by install id, contact address; hosted at a stable URL that PLT links in-game
- [ ] OPS-0069 · Demo · P1 · S · Data processing agreements — DPAs signed with the telemetry, crash-reporting and newsletter processors; record of processing activities kept in `docs/legal/`
- [ ] OPS-0070 · Demo · P1 · S · Website consent — no analytics or tracking cookies without consent; Steam wishlist widget and newsletter form checked against the privacy policy
- [ ] OPS-0071 · Demo · P1 · S · Streaming & monetisation policy — public statement that creators may stream and monetise videos; composer and SFX-library licences confirmed to allow it (no Content ID claims on gameplay music)
- [ ] OPS-0072 · Alpha · P1 · S · Trade-dress re-review for new UI — challenge mode, discipline screens and the Ch3–5 HUD additions checked against the counsel memo before Beta art lock
- [ ] OPS-0073 · Release · P0 · S · Counsel sign-off letter for 1.0 — title, trade dress, EULA/privacy and store copy; filed with the NAR name-register sign-off and the ART asset IP audit before the RC gate

## OPS-F · Age ratings & content compliance (Demo → Beta)

- [ ] OPS-0074 · Demo · P0 · S · Rating dry run — IARC questionnaire answered in draft for Ch1–2 content to preview PEGI/USK/ESRB-equivalent outcomes; result fed to the ART gore-tone target and UIX gore-level defaults
- [ ] OPS-0075 · Demo · P0 · S · Steamworks mature-content survey — completed for the demo and full-game apps (surgical gore, frequent violence, occult themes, no sexual content) using the NAR descriptor text; matches what the demo shows
- [ ] OPS-0076 · Demo · P1 · S · Territory rating table — whether Germany (USK), Australia, Brazil (ClassInd) and South Korea (GRAC) require or display a rating for a Steam release; path and cost per territory recorded
- [ ] OPS-0077 · Demo · P1 · S · Germany rating path — USK/IARC rating obtained if required for store visibility in Germany before the demo goes public; occult and violence content checked against indexing risk
- [ ] OPS-0078 · Demo · P2 · S · Occult-imagery market check — pentagram gesture, curse sigils and witch-hunt themes reviewed for storefront/territory sensitivities; mitigations (e.g. alternate icon art) logged
- [ ] OPS-0079 · Beta · P1 · S · Korea rating — GRAC path completed before Korean-language release or Korean store visibility
- [ ] OPS-0080 · Beta · P0 · S · Full-game rating update — questionnaires re-answered with Ch3–5 content (inquisition trial, obstetric operation, later Malison forms) and certificates updated before release

## LOC-A · Demo language scope & i18n runtime (Demo)

### Scope decisions
- [ ] LOC-0001 · Demo · P0 · S · Demo language subset — core set EN + DE, FR, ES (Spain), PL, PT-BR (Latin script, matching the ART glyph audit and ENG Latin Extended-A subsetting); stretch RU + ZH-Hans with a go/no-go at demo feature lock based on the ENG Cyrillic/CJK font pages; IT, JA, KO (and any stretch language not taken) at Beta; recorded in the decision log
- [ ] LOC-0002 · Demo · P0 · S · Re-phase sibling localisation tasks to Demo — UIX string extraction, pseudo-localisation build and runtime language switch plus PLT string tables move from Alpha/Beta to Demo (the demo ships localised); owners' sign-off on the board
- [ ] LOC-0003 · Demo · P1 · S · Spanish variant — Spain vs Latin-American Spanish chosen from Steam traffic by country on the coming-soon page; the other variant listed as a Post option
- [ ] LOC-0004 · Demo · P1 · S · Supported-languages matrix — Interface/Subtitles per language, Full Audio English only (AUD VO plan); mirrored exactly in Steamworks for the demo and full-game apps
- [ ] LOC-0005 · Demo · P2 · S · RTL out of scope — documented decision that Arabic/Hebrew are not planned for 1.0, so layout code needs no bidi support; revisited in the post-launch language review

### Runtime
- [ ] LOC-0006 · Demo · P0 · M · `src/i18n/` runtime — `t(key, params?)` over `strings/<lang>.json` with ICU MessageFormat (plural, select, number); unit tests cover PL plural categories (one/few/many/other) and FR treating 0 as singular
- [ ] LOC-0007 · Demo · P0 · S · Key conventions `docs/loc/keys.md` — `ui.*`, `tool.<id>.name|hint`, `rating.<r>`, `rank.<r>`, `label.<entity>.<event>`, `popup.*`, `loss.*`; speakable and story lines reuse the AUD/NAR line ids (`s1-2.014`, `op1-2.p0.1`, `bark.flooded`) so VO, subtitles and text share one id
- [ ] LOC-0008 · Demo · P0 · S · Locale loading & fallback — locales lazy-loaded as Vite chunks; fallback chain (pt-BR → en, es-ES → en); a missing key renders English, warns once in dev and increments a `loc_missing_key` telemetry counter
- [ ] LOC-0009 · Demo · P1 · S · Number & time formatting — score, combo, vitals and timer through `Intl.NumberFormat` and a locale mm:ss formatter (FR narrow no-break-space grouping, DE/PL period/space grouping); U+00A0 and U+202F present in every baked body glyph set
- [ ] LOC-0010 · Demo · P1 · S · Rank-letter policy — XS/S/A/B/C stay Latin capitals in every language (translator note); rating words follow the OPS wording decision and the termbase

### Simulation text not covered by NAR/CON/UIX extraction
- [ ] LOC-0011 · Demo · P0 · M · Rating labels to keys — every `rate(…, label)` literal in `src/surgery/*.ts` ('Incision', 'Off the line', 'Closed', 'Drained', 'Stitched', 'Sealed', 'Nick', 'Barbs freed', 'Torn', 'Debrided', 'Burn dressed', 'Lanced', 'Cleansed', 'Rot purged', 'Antidote', 'Seared', 'Plucked', 'Curse broken', 'Wounded', 'Malison unmade', 'It rejoined', 'Cast out', 'Silenced', 'Hatched') becomes a key; the sim stores keys, the HUD resolves text
- [ ] LOC-0012 · Demo · P0 · S · Popups, loss reasons and object labels to keys — 'THE LITANY OF STILLNESS', 'The curse lashes out!', 'It burst!', 'Found it!', 'Found!', '-N'/'+N' vitals popups, 'The patient has died.', 'Time has run out.' and the `Embedded` spec labels (Arrow, Bolt, Lead shot, Fang, Shard, Glass, Hexstone) resolved through `t()`
- [ ] LOC-0013 · Demo · P0 · S · No runtime sentence assembly — the `${label} ${RATING_TEXT}` and `x${combo}` popups rebuilt as ICU patterns (`{label} {rating}`, `×{combo}`) so each language can reorder; audit script flags template literals that feed text draws
- [ ] LOC-0014 · Demo · P1 · S · Patient grammatical gender — `OperationDef.patientGender` (m/f/unknown) passed to callouts as an ICU `select` so FR/DE/ES/PL/PT lines like "his pulse is weak" agree; all ten demo ops annotated

### Tooling & validation
- [ ] LOC-0015 · Demo · P0 · M · Key-usage scanner `npm run i18n:check` — TypeScript compiler API collects every `t()`/line-id reference; reports keys missing from `en.json`, unused keys and non-literal keys; runs in CI
- [ ] LOC-0016 · Demo · P0 · S · Locale file validation in CI — every locale parses, ICU syntax compiles, placeholder names match English exactly, no leading/trailing whitespace drift, no untranslated key unless flagged `fallback: true`
- [ ] LOC-0017 · Demo · P1 · S · Context metadata `strings/en.meta.json` — per key: speaker, scene, max width px, character limit, screenshot link and the NAR translator note; exported to the TMS as key context
- [ ] LOC-0018 · Demo · P1 · S · Reading time per locale — the callout display time (`max(2.4 s, 0.055 s × length)` in `Operation.update`) takes a per-locale reading-speed factor and counts CJK characters × 2.5; unit tests keep every line ≥ 2.4 s and ≤ 1.3 × the English duration
- [ ] LOC-0019 · Beta · P1 · S · CJK line-break rules on top of the UIX character breaking — no line starts with 、。，」）！？ or ends with 「（; Korean wraps between eojeol only; test strings per language
- [ ] LOC-0020 · Beta · P1 · S · Korean particle selection — ICU helper picks 은/는, 이/가, 을/를, 으로/로 from the final consonant of an inserted name or term; unit tests over every proper noun in the termbase
- [ ] LOC-0021 · Beta · P2 · S · Readable-font option per script — the UIX readable-font option (Latin-only face) maps RU to a Cyrillic sans and ZH/JA/KO to the matching Noto Sans CJK subset

## LOC-B · Fonts & glyph coverage (Demo → Beta)

- [ ] LOC-0022 · Demo · P0 · S · Coverage check in CI `npm run i18n:glyphs` — opentype.js reads each shipped font's cmap and reports, per locale and font role (body, italic, display), code points used in `strings/<lang>.json` that the font lacks; fails when no fallback covers them (automates the one-off ART glyph audit)
- [ ] LOC-0023 · Demo · P0 · S · Glyph lists for baking — script emits the exact code-point set per locale (strings + digits + UI punctuation, plus a 500-character safety set for ZH) as input to the ENG subsetting/MSDF build; regenerated on every translation import
- [ ] LOC-0024 · Demo · P1 · S · Per-locale font-role map `src/i18n/fonts.ts` — body/italic/display face per language (e.g. PL display falls back to the ART-approved Latin-extended blackletter; CJK `italic` maps to a Kai/Mincho face because CJK has no italics); unit test that every shipped locale resolves all three roles
- [ ] LOC-0025 · Demo · P1 · S · Fallback-glyph highlighter — LQA builds tint any glyph drawn from a fallback face or the dynamic rasteriser magenta, so reviewers see mixed fonts and missing coverage on screen
- [ ] LOC-0026 · Beta · P1 · S · CJK size floor — Chinese/Japanese/Korean body text ≥ 20 px and callouts ≥ 22 px at 1280×800 (the Latin floor stays with the PLT legibility check); enforced by per-locale layout constants and verified in localised captures
- [ ] LOC-0027 · Beta · P0 · S · Japanese glyph set — kana, every kanji used, JIS punctuation and a 1,000-kanji safety set for the Source Han Serif JP/Noto Serif JP subset; size reported
- [ ] LOC-0028 · Beta · P0 · S · Korean glyph set — every Hangul syllable used plus the 2,350-syllable KS X 1001 safety set for the Noto Serif KR subset; size reported

## LOC-C · Pseudo-localisation & text expansion (Demo)

- [ ] LOC-0029 · Demo · P0 · S · Pseudo-locale data generator — `qps.json` built from `en.json`: accented substitutes (e.g. "Ŧĥë Ŀïŧàñÿ"), +40 % padding, `⟦ ⟧` brackets; ICU placeholders preserved (unit test); consumed by the UIX pseudo-loc build
- [ ] LOC-0030 · Demo · P1 · S · `qps-long` variant — strings under 12 characters expanded by 100 % to mimic German/Polish single-word growth in tool names, rating words and buttons
- [ ] LOC-0031 · Demo · P1 · S · `qps-cjk` variant — full-width characters and no spaces, to exercise CJK wrapping, the size floor and atlas pressure before real Chinese arrives
- [ ] LOC-0032 · Demo · P1 · M · Width budgets in CI — each key's max px width (from `en.meta.json`) checked against every translation using advance widths read from the font files; failures list key, locale and overflow in px
- [ ] LOC-0033 · Demo · P1 · S · HUD text budgets — rating popups ≤ 220 px at popup size, callout banner ≤ 2 lines, tool-tray names on one line at the 88 px tray width (`TRAY.w`); violations reported per locale to the UIX owner

## LOC-D · Termbase & localisation style guide (Demo)

- [ ] LOC-0034 · Demo · P0 · M · Multilingual termbase in the TMS — seeded from the NAR translator glossary (80 locked terms): approved target term, part of speech, grammatical gender, plural forms and do-not-translate flag per language
- [ ] LOC-0035 · Demo · P0 · S · Canonical-hours equivalents — Matins, Lauds, Prime, Terce, Sext, None, Vespers, Compline mapped to each language's established liturgical term (FR Matines…Complies, DE Matutin…Komplet, ES Maitines…Completas; PL/PT-BR/IT/RU/JA/KO supplied by the lead translators), noting each is also a boss name and chapter title
- [ ] LOC-0036 · Demo · P0 · S · Instrument names per language — Lancet, Tongs, Leech-Pipe, Gut Thread, Saint's Salve, Tincture, Cautery Brand, Scrying Lens translated within the tool-tray width, keeping the period flavour; approved by each lead translator
- [ ] LOC-0037 · Demo · P0 · S · Rating-word translations — COOL/GOOD/BAD/MISS (or their replacements after the OPS wording decision) and the combo "×N" pattern approved per language; must stay ≤ 6 characters where possible for popup legibility
- [ ] LOC-0038 · Demo · P0 · M · Archaic-register localisation style guide `docs/loc/style-guide.md` — translator-facing summary of the NAR English diction rules plus per-language register targets with 15 approved sample lines each for DE, FR, ES, PL, PT-BR (e.g. FR vouvoiement throughout, DE Ihr-forms for Stroh)
- [ ] LOC-0039 · Demo · P1 · S · Proper-name policy — names untranslated in Latin-script languages; approved transliterations for RU/ZH/JA/KO (e.g. Kreuzer → Кройцер / 克罗伊策 / クロイツァー / 크로이처) recorded once in the termbase and reused on store pages
- [ ] LOC-0040 · Demo · P1 · S · Translator sensitivity notes — the church, saints and heresy are fictional: no real saints, deities or scripture substituted; pentagram and witch-hunt terms kept neutral; follows the NAR sensitivity brief
- [ ] LOC-0041 · Demo · P1 · S · Period-medicine reference per language — Galenic terms for humours, black bile, buboes, gangrene, cautery and leeching; modern clinical terms listed as banned for translators
- [ ] LOC-0042 · Demo · P1 · S · Termbase consistency check — script flags translations where the English source contains a termbase entry but the approved target term is absent; report per locale in CI
- [ ] LOC-0043 · Alpha · P1 · S · Termbase extension for Chapters 3–5 — new characters, places, the remaining Malison hours, disciplines and ailments added before Ch3–5 translation starts
- [ ] LOC-0044 · Beta · P1 · M · Register sections for RU, ZH-Hans, JA, KO and IT — added to the style guide (e.g. RU Church-Slavonic colour for the Choir only, ZH 半文半白 narration, JA 時代劇 speech, KO 사극체) with 15 approved sample lines each

## LOC-E · Vendor, pipeline & process (Demo)

- [ ] LOC-0045 · Demo · P0 · M · Localisation vendor selection — RFP to 3 games-specialised LSPs; paid 500-word test (prologue + op1-2 callouts) per demo language scored blind by independent native reviewers; contract with NDA, IP assignment and LQA scope
- [ ] LOC-0046 · Demo · P0 · M · TMS setup (Crowdin or Lokalise) — GitHub integration syncs `strings/en.json` + `en.meta.json`; translations return as PRs; termbase, style guide and screenshots attached; reviewer role per language
- [ ] LOC-0047 · Demo · P1 · S · Context screenshots in the TMS — QAT localised captures uploaded automatically and linked to the keys visible in each capture
- [ ] LOC-0048 · Demo · P0 · S · Word counts `npm run i18n:wordcount` — per chapter and scope (UI, callouts, barks, story, store, legal) plus new/changed words since the last handoff, for incremental quotes
- [ ] LOC-0049 · Demo · P0 · S · Demo loc schedule — handoff on the NAR script-lock date, translation 3 weeks, LQA 2 weeks, fixes 1 week, all complete 1 week before the Next Fest press preview; dates in the master schedule
- [ ] LOC-0050 · Demo · P1 · S · Translator query sheet — Q&A in the TMS with a 48 h answer SLA; answers promoted into key notes so the question is not asked twice
- [ ] LOC-0051 · Demo · P1 · S · Continuous loc builds — nightly build with the latest approved translations pushed to a password-protected Steam `loc` branch for reviewers
- [ ] LOC-0052 · Demo · P1 · S · LQA checklist & bug template — truncation, overlap, termbase, grammar/agreement, register, fallback glyphs, untranslated text, placeholder errors; severity mapped to the QA taxonomy; `loc` + language labels
- [ ] LOC-0053 · Demo · P1 · S · LQA navigation — console commands (`lang <code>`, `story <id>`, `op <id>`, `phase <n>`) and the pause-menu language switch let a reviewer reach any Ch1–2 line in ≤ 30 s (timed on 10 random keys)
- [ ] LOC-0054 · Demo · P0 · S · Per-language demo sign-off — lead reviewer signs `docs/loc/signoff/<lang>-demo.md`; languages without sign-off are hidden from the language menu and the Steamworks language list
- [ ] LOC-0055 · Demo · P2 · S · Translation-memory ownership — TM and termbase exported monthly from the TMS into the repo (TMX/TBX) so the studio owns them regardless of vendor

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

- [ ] QAT-0054 · Demo · P0 · M · Failure-path goldens — per demo op a loss-by-vitals and a loss-by-timer replay, plus a last-second-Litany replay for Matins and Lauds, added to the golden suite so loss handling and results are regression-tested
- [ ] QAT-0055 · Demo · P1 · M · Human replay corpus — playtest builds record replays (with consent); one human run per op per playtest round is added to `tests/replays/human/` and re-simulated every nightly
- [ ] QAT-0056 · Demo · P1 · S · Runtime parity — the same replays re-simulated in Node (Vitest), Chromium (Playwright) and the packaged desktop build produce identical state hashes; any divergence blocks the build
- [x] QAT-0057 · Demo · P1 · S · Golden-update review — PRs that change golden hashes need the `behaviour-change` label and a GAM reviewer via CODEOWNERS; bot-only changes never rewrite goldens
- [ ] QAT-0058 · Demo · P1 · S · Replay-first bug workflow — S1/S2 gameplay bugs carry the PLT/INP F8 replay or a note why not; triage re-simulates it to confirm the repro before assignment

## QAT-D · End-to-end flows (Demo)

- [x] QAT-0059 · Demo · P0 · M · Playwright E2E project — `tests/e2e/` on the built preview (SwiftShader) using the stable debug API; traces and screenshots kept on failure
- [x] QAT-0060 · Demo · P0 · M · New-game flow — title → prologue → op1-1 won with bot-planned *real* mouse events → results → s1-2; the save's progress is asserted after each step
- [x] QAT-0061 · Demo · P0 · S · Continue/resume flow — reload mid-chapter and Continue lands on the saved step; quitting mid-operation resumes at that operation's briefing (PLT autosave rule)
- [x] QAT-0062 · Demo · P1 · S · Retry & quit flows — loss → results → Retry restarts with the same seed; pause → Quit to title → Continue; ENG GL-object counters unchanged after 10 loops
- [x] QAT-0063 · Demo · P1 · S · Options persistence — each option changed, page reloaded, value retained and applied (e.g. volume reaches the master gain, reduce-flashing reaches the post-process uniforms)
- [x] QAT-0064 · Demo · P1 · M · Input-path parity — a bot plan executed through Playwright mouse events and directly through `handlePointer` yields the same rating counts (±1) on op1-1 and op1-2, validating the `Input` → `Pointer` conversion
- [ ] QAT-0065 · Demo · P1 · S · Language-switch flow — each demo language selected mid-story; text re-lays out, no missing-key markers, the same line stays on screen

## QAT-E · Visual & performance QA (Demo; builds on the ENG/ART/UIX screenshot suites)

- [ ] QAT-0066 · Demo · P1 · S · One baseline environment — every Playwright screenshot suite (ENG, ART, UIX, QAT) regenerates baselines only inside the Playwright 1.55 Docker image via `npm run visual:update`; locally generated baselines rejected by CI
- [ ] QAT-0067 · Demo · P1 · S · Baseline approval rule — `CODEOWNERS` on screenshot folders: ART approves art scenes, UIX approves UI, QAT approves flows; baseline PRs show before/after diffs in the description
- [ ] QAT-0068 · Demo · P1 · S · Localised capture set — each demo language × title, options, briefing, HUD, results and demo-end captured nightly and on every LOC PR; uploaded to the TMS for translator context
- [ ] QAT-0069 · Demo · P1 · S · Pseudo-loc capture set — `qps` and `qps-long` captures of every demo screen nightly, compared against the previous night to catch new overflow
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
- [ ] QAT-0087 · Demo · P0 · S · Labels & board — severity, area (sim, render, audio, ui, story, loc, input, save, platform, perf, legal), `found-in`, `fixed-in`, `repro-rate`, `playtest`, `community`, `regression`; columns New → Triaged → In progress → Fixed → Verified
- [x] QAT-0088 · Demo · P1 · S · Issue templates — bug (build id, OS, GPU, steps, expected/actual, F8 bundle), crash, loc/text, perf, feature request; required fields enforced by issue forms
- [ ] QAT-0089 · Demo · P1 · S · Triage cadence — twice-weekly triage; S1 acknowledged within 24 h and S2 within 72 h; weekly bug trend chart in the sprint review
- [x] QAT-0090 · Demo · P1 · S · Regression policy — every fixed S1/S2 gains an automated test, snapshot or golden replay before it can move to Verified
- [ ] QAT-0091 · Demo · P1 · S · Known-issues list — maintained for each public build and pinned in the Steam discussions and Discord
- [x] QAT-0092 · Demo · P2 · S · QA metrics — open bugs by severity and area, find vs fix rate, reopen rate and escaped defects (first reported by players) per build, shown in the weekly status note
- [ ] QAT-0093 · Demo · P1 · S · Community bug intake — Discord #bug-reports and Steam forum reports triaged weekly into GitHub issues with the `community` label and a reply linking the fix version

## QAT-I · Telemetry, funnels & dashboards (Demo; extends the PLT opt-in telemetry)

### Pipeline
- [x] QAT-0094 · Demo · P0 · M · Event schema v1 (versioned JSON Schema) extending the PLT event set — `session_start` (build, OS, GPU family, locale, edition, install id), `op_start`, `op_end` (op, result, rank, score, duration, min vitals, rating counts, max combo, Litany used, tinctures, assists), `op_fail` (reason, phase, live entity kinds), `rating` (tool, entity kind, rating, x/y quantised to 32 px), `tool_select`, `story_skip`, `settings_changed`, `wishlist_click`, `quit`
- [x] QAT-0095 · Demo · P0 · S · Schema tests — every event the game emits validates against the schema in unit tests; unknown fields or missing required fields fail CI
- [ ] QAT-0096 · Demo · P0 · M · Ingest backend — Cloudflare Worker + database (or self-hosted PostHog) with EU storage, per-install rate limiting, no IP address stored, install id resettable from Options
- [x] QAT-0097 · Demo · P1 · S · Client batching — flush every 60 s and on quit, offline queue capped at 1 MB, exponential backoff; telemetry adds < 0.1 ms per frame (measured)
- [ ] QAT-0098 · Demo · P1 · S · Remote kill switch — a config endpoint disables all telemetry or single events without a new build; the client re-reads it at session start
- [ ] QAT-0099 · Demo · P1 · S · Staging dataset — dev, QA and playtest builds report to a separate dataset; dashboards exclude them by build flavour
- [ ] QAT-0100 · Demo · P1 · S · Retention job — raw events deleted after 90 days by a scheduled job, aggregates kept; deletion-by-install-id endpoint tested end to end

### Analysis
- [x] QAT-0101 · Demo · P0 · S · Demo funnel definition — launch → consent answered → title → new game → op1-1 started → op1-1 won → … → Matins won → Ch2 started → Lauds won → demo-end shown → wishlist clicked; each step one event
- [ ] QAT-0102 · Demo · P0 · M · Demo funnel dashboard — drop-off per step with daily cohorts by build, OS and locale; a Next Fest daily snapshot exported to the production channel
- [ ] QAT-0103 · Demo · P1 · M · Fail-point dashboard — per op: loss reason split (vitals/timer), phase of loss, live entity kinds at loss, retries before first win; top-3 fail phases highlighted for GAM tuning
- [ ] QAT-0104 · Demo · P1 · M · Tool-usage heatmaps — per op and tool, density of COOL/GOOD/BAD/MISS positions drawn over a capture of that op's operating field
- [ ] QAT-0105 · Demo · P1 · S · Rank distribution vs bot prediction — per op rank histogram from players beside the GAM steady/novice bot results; ops deviating > 1 rank band filed as tuning tickets
- [ ] QAT-0106 · Demo · P1 · S · Performance buckets — p50/p95 frame time by GPU family, resolution and quality tier; hardware below budget listed for ENG
- [ ] QAT-0107 · Demo · P1 · S · Wishlist attribution — demo wishlist clicks correlated daily with Steamworks wishlist additions and UTM-tagged store visits
- [ ] QAT-0108 · Demo · P2 · S · Settings & assists report — share of players using each assist, gore level, reduced flashing and language; sent to UIX and LOC monthly
- [ ] QAT-0109 · Beta · P1 · S · Full-game funnel — chapter start/complete for Ch1–5, challenge-mode entry, discipline-mode usage and Ch3–5 fail points
- [ ] QAT-0110 · Post · P1 · S · Post-launch KPI dashboard — crash-free sessions, completion per chapter, median playtime, challenge participation and refund-window playtime buckets (from Steamworks exports)

## QAT-J · Compatibility & platform QA (Demo)

- [x] QAT-0111 · Demo · P0 · S · Compatibility matrix `docs/qa/compat-matrix.md` — aggregates the ENG GPU/ANGLE, PLT OS/display and INP device matrices into one board with owner, status and evidence link per cell
- [ ] QAT-0112 · Demo · P1 · M · Demo lab sweep — contracted lab or tester pool runs the demo smoke + one boss on ≥ 15 configs (NVIDIA GTX 900–RTX 40, AMD Polaris–RDNA3, Intel UHD/Iris Xe/Arc, hybrid-graphics laptops); results merged into the matrix
- [x] QAT-0113 · Demo · P1 · S · OS-locale edge cases — Windows display/format set to tr-TR, de-DE, pl-PL and pt-BR: no key-casing bugs (Turkish dotted/dotless i), no decimal-comma breakage in settings or saves
- [ ] QAT-0114 · Demo · P1 · S · Antivirus false positives — each RC scanned on VirusTotal; any detection gets a vendor submission (e.g. Microsoft Defender portal) and a clean re-scan before release
- [ ] QAT-0115 · Demo · P1 · S · Desktop security verification — Electronegativity scan and a checklist confirming the PLT hardening (context isolation, no Node integration, CSP, devtools off) in the packaged demo; no high findings

## QAT-K · Playtest programme (Demo → Beta)

- [ ] QAT-0116 · Demo · P0 · S · Tester pool & screener — form captures genre familiarity, prior *Trauma Center* experience, hardware, language and accessibility needs; ≥ 60 opted-in testers with signed NDAs (OPS template)
- [ ] QAT-0117 · Demo · P0 · S · Access channels — private Steam branch for moderated rounds and a Steam Playtest app for unmoderated waves; access waves and revocation documented
- [ ] QAT-0118 · Demo · P0 · S · Round plan — the CON external rounds, UIX fresh-player study, BOS boss gates and GAM rank validation scheduled as 3 dated demo rounds sharing one build and one survey (no duplicate sessions)
- [ ] QAT-0119 · Demo · P1 · S · Session survey — SUS score, "would you wishlist" intent, session length and "most confusing moment", complementing the CON per-op survey; identical across rounds for comparison
- [ ] QAT-0120 · Demo · P1 · S · Session recordings — consented OBS captures with an input overlay; confusion timestamps tagged in a shared sheet within 48 h of each session
- [ ] QAT-0121 · Demo · P1 · S · Findings pipeline — each finding filed with the `playtest` label, round and frequency (n/N); round report lists what changed since the previous round
- [ ] QAT-0122 · Demo · P0 · M · Release-candidate round — 30 unmoderated players on the demo RC; gates ≥ 85 % reach Lauds, median session ≥ 40 min, wishlist intent ≥ 60 %, 0 crashes
- [ ] QAT-0123 · Demo · P1 · S · Steam Deck round — 5 Deck owners play Ch1–2 on default controls; stitching precision and star-gesture success recorded per op
- [ ] QAT-0124 · Demo · P1 · S · Accessibility round — ≥ 3 players using a one-handed setup, trackball or with colour-vision deficiency; findings fed to the UIX accessibility table
- [ ] QAT-0125 · Demo · P1 · S · Localisation round — 2 native players per demo language play Ch1 and report tone and clarity issues through the LQA template
- [ ] QAT-0126 · Alpha · P1 · M · Alpha round — 10 players play Ch1–5 end to end with placeholder art; chapter completion and session length per chapter measured
- [ ] QAT-0127 · Beta · P1 · M · Beta round — 50+ players via Steam Playtest across every shipped language; content-complete survey and fail-point review for the Ch3–5 bosses

## LOC-F · Demo languages: Chapters 1–2 (Demo)

### Core set
- [ ] LOC-0056 · Demo · P0 · M · French, Chapters 1–2 — Ch1–2 story, callouts, barks, UI and codex translated; renderer post-processor applies French spacing (U+202F before ; ! ?, U+00A0 before : and inside « ») so translators type plain spaces
- [ ] LOC-0057 · Demo · P0 · M · French demo LQA — native reviewer plays every demo op and story scene in the `loc` build; 0 open S1/S2 loc bugs, termbase score 100 %
- [ ] LOC-0058 · Demo · P0 · M · German, Chapters 1–2 — Ch1–2 translated; soft hyphens (U+00AD) placed in compounds longer than 14 letters and honoured by the text wrapper; ß/ẞ verified in every font role
- [ ] LOC-0059 · Demo · P0 · M · German demo LQA — native reviewer pass on every demo screen, op and scene; Ihr/Sie register checked against the style guide; 0 open S1/S2
- [ ] LOC-0060 · Demo · P0 · M · Spanish (Spain), Chapters 1–2 — Ch1–2 translated; opening ¿ ¡ present, gendered agreement for patients via `patientGender`
- [ ] LOC-0061 · Demo · P0 · M · Spanish demo LQA — native reviewer pass on every demo screen, op and scene; 0 open S1/S2
- [ ] LOC-0062 · Demo · P0 · M · Polish, Chapters 1–2 — Ch1–2 translated; plural forms one/few/many/other verified for every counted string (stitches, shards, seconds)
- [ ] LOC-0063 · Demo · P0 · M · Polish demo LQA — native reviewer pass including the Latin-extended display-font fallback on titles; 0 open S1/S2
- [ ] LOC-0064 · Demo · P0 · M · Brazilian Portuguese, Chapters 1–2 — Ch1–2 translated; register and gendered agreement per the style guide
- [ ] LOC-0065 · Demo · P0 · M · Brazilian Portuguese demo LQA — native reviewer pass on every demo screen, op and scene; gendered agreement spot-checked on all patient callouts; 0 open S1/S2

### Stretch set (only after a "go" at demo feature lock)
- [ ] LOC-0066 · Demo · P2 · M · Russian, Chapters 1–2 — Ch1–2 translated; one/few/many/other plurals; Cyrillic body, italic and display roles resolved through the font-role map
- [ ] LOC-0067 · Demo · P2 · M · Russian demo LQA — native reviewer pass including Cyrillic font legibility at 1280×800; 0 open S1/S2
- [ ] LOC-0068 · Demo · P2 · L · Simplified Chinese, Chapters 1–2 — Ch1–2 translated; full-width punctuation, Kai/Mincho face for the italic role, glyph list regenerated for baking
- [ ] LOC-0069 · Demo · P2 · M · Simplified Chinese demo LQA — native reviewer pass including line breaks, CJK size floor and fallback-glyph highlighter review; 0 open S1/S2

## LOC-G · Store, marketing & legal text (Demo)

- [ ] LOC-0070 · Demo · P0 · M · Localised full-game store page — short description, About This Game, feature bullets and content-descriptor text in every demo language, reviewed by the same LQA reviewer
- [ ] LOC-0071 · Demo · P0 · S · Localised demo store page — demo description ("Chapters I–II, 10 operations, two Malison hours") and the full-game wishlist call to action in every demo language
- [ ] LOC-0072 · Demo · P1 · S · Localised "FREE DEMO" capsule banner text — per-language strings with length limits delivered to ART for the localised capsule variants Steam supports
- [ ] LOC-0073 · Demo · P1 · S · Trailer subtitles — SRT files for the announce and Next Fest trailers in every demo language, uploaded where Steam/YouTube support per-language captions
- [ ] LOC-0074 · Demo · P1 · S · Localised press releases — announce and Next Fest releases in DE, FR, ES, PL and PT-BR
- [ ] LOC-0075 · Demo · P0 · S · Legal text translation — EULA (if custom), privacy notice, telemetry consent and content warnings translated by a legal translator for every demo language
- [ ] LOC-0076 · Demo · P1 · S · Steam rich-presence tokens — the PLT rich-presence token file translated for every demo language; checked in a friends list per language
- [ ] LOC-0077 · Demo · P2 · S · Steam event and announcement posts — Next Fest, demo-live and patch-note posts published in every demo language from one template

## OPS-G · Steam store & demo pages (Demo)

- [ ] OPS-0081 · Demo · P0 · M · Store copy — short description ≤ 300 characters, About This Game using the ART section banners and GIFs, 5 feature bullets; checked against the marketing-reference rules before submission
- [ ] OPS-0082 · Demo · P0 · S · Tags & genre — 20 tags chosen from 10 comparable titles (surgery, dark fantasy, medieval, gore, story rich, visual novel…); revisited after the first 1,000 wishlists
- [ ] OPS-0083 · Demo · P0 · S · Coming-soon page live ≥ 3 months before Next Fest — release window "2027", UTM-tagged links used in every channel from day one
- [ ] OPS-0084 · Demo · P0 · S · Demo system requirements — minimum/recommended OS, CPU, GPU (WebGL2/D3D11 class), RAM and disk from the ENG perf targets and the QAT lab sweep; Windows and Linux (macOS only if shipped)
- [ ] OPS-0085 · Demo · P0 · S · Store settings — supported languages (LOC matrix), content descriptors (OPS survey), controller support and Deck status fields set for both apps
- [ ] OPS-0086 · Demo · P0 · S · Demo page publishing — demo description and screenshots uploaded, "Download Demo" button visible on the main page, demo release date set, both pages pass Valve store review
- [ ] OPS-0087 · Demo · P1 · S · Capsule people test — 30 people shown the ART small capsule for 3 s among 8 competitor capsules; ≥ 70 % name "surgery" or "dark fantasy"; iterate with ART otherwise
- [ ] OPS-0088 · Demo · P1 · S · Weekly store-traffic review — Steamworks impressions → visits → wishlists; if visit rate stays below the genre median for 3 weeks, test a new capsule or short description
- [ ] OPS-0089 · Demo · P2 · S · Curator Connect — ~50 curators (horror, indie, medical sim, dark fantasy) sent demo access and later full-game keys; coverage tracked
- [ ] OPS-0090 · Release · P0 · S · 1.0 page update — price, release date, launch trailer, refreshed ART screenshots, achievements count, Deck status; submitted for review ≥ 2 weeks before launch

## OPS-H · Trailers, press kit & marketing (Demo → Release)

- [ ] OPS-0091 · Demo · P0 · M · Announce trailer (60–75 s) — edited from the ART storyboard and deterministic replay captures, cleared music, 1080p60 and 4K masters, uploaded to YouTube and the Steam page
- [ ] OPS-0092 · Demo · P0 · M · Next Fest demo trailer (45–60 s) — Ch1–2 highlights, Lauds reveal, "Play the free demo" end slate; subtitles from LOC; live on the page before the press preview
- [ ] OPS-0093 · Demo · P0 · M · Press kit page — presskit()-style: fact sheet, description, features, trailers, ART press folder, team, contact, one-click zip; linked from Steam, website and Discord
- [ ] OPS-0094 · Demo · P1 · S · Website — landing page with Steam wishlist widget, trailer, newsletter signup, press kit and privacy policy; Lighthouse performance and accessibility ≥ 90
- [ ] OPS-0095 · Demo · P1 · S · Newsletter — provider with double opt-in; welcome email; sends at announce, Next Fest and launch; subscriber count in the weekly note
- [ ] OPS-0096 · Demo · P1 · S · Social cadence — 3 posts a week (operation GIF, lore snippet, dev note) using the ART social kit; #screenshotsaturday weekly; scheduled 2 weeks ahead
- [ ] OPS-0097 · Demo · P1 · S · Announce day — trailer premiere, press release, store page public, Discord open and social posts on one date, run from a checklist
- [ ] OPS-0098 · Demo · P1 · S · Wishlist targets — monthly wishlist targets to Next Fest and launch derived from the revenue forecast; tracked weekly with the actions taken when below target
- [ ] OPS-0099 · Demo · P2 · S · Showcase applications — ≥ 5 digital showcases/festivals fitting dark fantasy, horror or indie; deadlines in the master schedule, outcomes logged
- [ ] OPS-0100 · Demo · P2 · S · Steam themed events — join fitting Steam events (e.g. horror-themed festivals) with the demo when dates allow; participation rules checked per event
- [ ] OPS-0101 · Demo · P1 · S · Press preview builds — watermarked PLT press build distributed by key with an embargo date; recipients tracked
- [ ] OPS-0102 · Release · P0 · M · Launch trailer (≈90 s) — edited from the ART launch storyboard with final art and VO, release-date card, LOC subtitles
- [ ] OPS-0103 · Release · P1 · S · Launch press release — written and counsel-checked, translated by LOC, embargoed to launch hour and sent from the press CRM at launch

## OPS-I · Steam Next Fest (Demo)

- [ ] OPS-0104 · Demo · P0 · S · Choose the edition — target Next Fest picked from Valve's published dates against the master schedule (with the following edition as fallback); registration deadline and press-preview date added
- [ ] OPS-0105 · Demo · P0 · S · Confirm current rules — eligibility (unreleased game, one Next Fest per game, public store page, demo availability) read from Steamworks docs and recorded
- [ ] OPS-0106 · Demo · P0 · S · Next Fest registration — completed in Steamworks before the deadline; confirmation and listing stored in `docs/production/`
- [ ] OPS-0107 · Demo · P0 · S · Marketing calendar — T-10 weeks store assets final, T-8 string freeze/loc handoff, T-6 demo RC, T-4 Valve demo review (PLT checklist), T-2 press preview, T-0 festival; owners per line
- [ ] OPS-0108 · Demo · P0 · S · Press & creator preview — outreach sent 10 days before the press preview with access to the demo; follow-ups on day 3
- [ ] OPS-0109 · Demo · P1 · S · Demo public-release timing — release the demo publicly before the festival (early wishlists and reviews) or at its start; decision logged with the reasoning
- [ ] OPS-0110 · Demo · P1 · M · Festival livestreams — a pre-recorded 20–30 min dev playthrough plus 2 live sessions scheduled via Steam broadcasting; moderators assigned
- [ ] OPS-0111 · Demo · P0 · S · Festival-week operations — daily funnel dashboard review, Steam discussions and Discord sweep, known-issues update, daily summary posted
- [ ] OPS-0112 · Demo · P1 · S · Festival event posts — demo-live, livestream and thank-you events scheduled in Steamworks in every demo language
- [ ] OPS-0113 · Demo · P1 · S · Post-fest retrospective — wishlist delta, demo players, median playtime, funnel conversion and top feedback; decisions for Ch3–5 and a demo update within 2 weeks
- [ ] OPS-0114 · Demo · P2 · S · Post-fest demo update — patch addressing the top 5 feedback items plus a thank-you announcement

## OPS-J · Community, press & creators (Demo → Post)

- [ ] OPS-0115 · Demo · P0 · M · Discord server — #announcements, #demo-feedback, #bug-reports, #screenshots, #lore, #loc-feedback; roles, AutoMod and spam bot, verification gate, rules; linked from game, website and Steam
- [ ] OPS-0116 · Demo · P1 · S · Moderation policy & team — community guidelines, escalation for harassment and NSFW posts, 2 volunteer moderators with documented permissions and a weekly sync
- [ ] OPS-0117 · Demo · P1 · S · Steam discussions — pinned FAQ, bug-report template, known-issues thread and moderators assigned for both apps
- [ ] OPS-0118 · Demo · P1 · S · Community FAQ — platforms, Deck, languages, release window, demo carry-over, accessibility, content warnings; kept on the website and Steam
- [ ] OPS-0119 · Demo · P0 · M · Press list — 120 outlets and journalists covering PC indie, horror and dark fantasy in EN, DE, FR, ES, PL and PT-BR; CRM sheet with contact status
- [ ] OPS-0120 · Demo · P0 · M · Creator list — 200 YouTube/Twitch/TikTok creators (horror, indie showcases, handheld-era nostalgia, medical sim) segmented by size and language
- [ ] OPS-0121 · Demo · P1 · S · Key platform — Keymailer, Lurkit or Woovit campaign that verifies creators; demo and full-game access tracked per recipient
- [ ] OPS-0122 · Demo · P1 · S · Key policy — every Steamworks key request logged (purpose, recipient, batch); leaked or unused keys revoked; no keys to unverified requesters
- [ ] OPS-0123 · Demo · P1 · S · Outreach templates — pitch, follow-up and embargo notice, localised for the demo languages
- [ ] OPS-0124 · Demo · P2 · S · Community events — screenshot and fan-art contests with written rules, prize terms and IP licence for submissions
- [ ] OPS-0125 · Release · P0 · M · Review-copy wave — full-game keys to press 2 weeks before launch and to creators 1 week before, under embargo
- [ ] OPS-0126 · Release · P1 · S · Launch-week community plan — Discord launch event, dev AMA, and a Steam review-response rule (reply to bug-related negative reviews within 48 h with the fix status)
- [ ] OPS-0127 · Post · P1 · S · Public roadmap — post-launch roadmap (patches, free updates, DLC) published within 2 weeks of launch and updated quarterly

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
- [ ] QAT-0144 · Demo · P1 · S · Idle soak — 8 h each on the title, a paused operation and the demo-end summary; no crash, memory growth < 50 MB, audio still plays
- [ ] QAT-0145 · Demo · P0 · S · Localisation functional pass — per demo language: switching, fonts, no missing keys or fallback glyphs, no clipped text on any demo screen (linguistic quality stays with LOC LQA)
- [x] QAT-0146 · Demo · P0 · S · Certification master checklist `docs/qa/cert-demo.md` — Steamworks, Deck, legal-screen and accessibility items from PLT, INP, UIX and OPS aggregated with evidence links; every item green before the go/no-go gate
- [ ] QAT-0147 · Demo · P0 · S · Demo RC sign-off — `docs/qa/signoff/demo-rc.md` with build SHA, suite results, exit-criteria status and the open-issue list; required before the build is set live
- [x] QAT-0148 · Demo · P1 · S · Demo patch regression checklist — 60-minute smoke (boot, op1-1, Matins, Lauds, save/resume, demo end, language switch) run on every demo hotfix before it goes live
- [ ] QAT-0149 · Demo · P1 · S · Next Fest QA rota — daily crash and forum sweep during the festival week; each hotfix verified inside the PLT 4-hour pipeline
- [ ] QAT-0150 · Alpha · P1 · S · Post-demo bug review — every community-reported demo bug fixed or deferred with a reason before the Alpha gate

## OPS-K · Demo release (Demo)

- [ ] OPS-0128 · Demo · P0 · S · Demo launch comms checklist — build live, "Download Demo" visible, localised descriptions, announcement posted in all demo languages, Discord ping, press and creator emails, dashboards watched; ticked and archived
- [ ] OPS-0129 · Demo · P1 · S · Demo hotfix policy — S1 fixed within 24 h and S2 within 72 h for the first two weeks after release and during Next Fest; patch notes posted on Steam for each update
- [ ] OPS-0130 · Demo · P1 · S · Two-week demo review — players, median playtime, completion, wishlist conversion and demo reviews compared to targets; actions recorded in the decision log
- [ ] OPS-0131 · Demo · P1 · S · Demo lifecycle decision — the demo stays available after 1.0 (with carry-over messaging) or is retired; logged with the reasoning
- [ ] OPS-0132 · Demo · P2 · S · Steam Playtest vs demo — decide whether Beta testing uses a Steam Playtest app separate from the demo; access waves configured if yes

## QAT-M · Full-game QA: Alpha → Release → Post

### Alpha
- [x] QAT-0151 · Alpha · P0 · S · Alpha test plan — Ch1–5 playable end to end with placeholder art, all core systems feature-complete; entry/exit criteria and new suites for Ch3–5 listed
- [ ] QAT-0152 · Alpha · P1 · M · Chapter III functional pass — every op (Prime and Terce included) won, lost by vitals and by timer, retried; story scenes and flags checked; results filed per op
- [ ] QAT-0153 · Alpha · P1 · M · Chapter IV functional pass — every op (Sext and None included) won, lost by vitals and by timer, retried; story scenes and flags checked
- [ ] QAT-0154 · Alpha · P1 · M · Chapter V functional pass — every op (Vespers and Compline included) won, lost by vitals and by timer, retried; endings and credits reached
- [ ] QAT-0155 · Alpha · P1 · S · Campaign graph checks for five chapters — every chapter reachable, unlocks chain correctly, challenge-mode entries reference existing ops, demo carry-over lands on Ch3

### Beta
- [x] QAT-0156 · Beta · P0 · S · Beta test plan — content complete, all shipped languages, full compatibility matrix, accessibility and performance; exit criteria for the RC
- [ ] QAT-0157 · Beta · P1 · M · Final-content regression — Ch3–5 re-run with final art, audio and VO against the Alpha suites; visual/readability regressions filed to ART/ENG
- [ ] QAT-0158 · Beta · P1 · M · Field-triage discipline suite — patient queue, switching patients, simultaneous timers, scoring; win/loss paths
- [ ] QAT-0159 · Beta · P1 · M · Diagnosis discipline suite — symptom inspection, wrong-diagnosis penalties, case completion and scoring
- [ ] QAT-0160 · Beta · P1 · M · Forensic/inquisition discipline suite — evidence collection, deduction steps, story flags written, scoring
- [ ] QAT-0161 · Beta · P1 · M · Bone-setting discipline suite — alignment gestures, fracture variants, splinting, scoring
- [ ] QAT-0162 · Beta · P1 · M · Challenge-mode suite — every challenge op, leaderboard upload and download, ties, offline queueing; plausibility bound (score > 1.1 × expert-bot par) flagged before the replay check
- [ ] QAT-0163 · Beta · P1 · M · Full-campaign renderer run — bots play Ch1–5 back to back in the real game loop (≈5 h) with no crash, leak or save corruption; run weekly
- [ ] QAT-0164 · Beta · P0 · M · Full-game localisation functional pass — every shipped language across all chapters, disciplines and challenge mode; fonts, keys, clipping

### Release
- [x] QAT-0165 · Release · P0 · S · Full-game certification checklist `docs/qa/cert-1.0.md` — demo checklist extended with achievements, leaderboards, Cloud, Deck and store items; evidence links for every row
- [ ] QAT-0166 · Release · P0 · M · Release-candidate regression — full test plan on every matrix OS; results in `docs/qa/signoff/1.0-rc.md` with build SHA
- [ ] QAT-0167 · Release · P0 · S · Day-one patch verification — patch build passes the RC regression subset and upgrades a 1.0 save and a demo carry-over save without loss

### Post-launch
- [x] QAT-0168 · Post · P1 · S · Patch regression suite — automated suites plus a 2-hour manual checklist for every post-launch patch; results attached to the patch notes PR
- [x] QAT-0169 · Post · P1 · M · Update and DLC test plans — per release: new content suites, saves with and without the DLC, DLC ownership checks online and offline, leaderboards unaffected
- [ ] QAT-0170 · Post · P2 · S · Player-reported crash review — top 10 crash signatures reviewed every two weeks for the first three months; each fixed or explained in the known-issues list

## LOC-H · Full-game localisation (Beta → Post)

### Demo languages, Chapters 3–5
- [ ] LOC-0078 · Beta · P0 · L · French, Chapters 3–5 — Ch3–5 story, callouts, barks, codex, challenge mode and discipline UI translated
- [ ] LOC-0079 · Beta · P0 · M · French full-game LQA — in-context pass over Ch3–5 and a regression pass over Ch1–2; 0 open S1/S2
- [ ] LOC-0080 · Beta · P0 · L · German, Chapters 3–5 — Ch3–5 translated
- [ ] LOC-0081 · Beta · P0 · M · German full-game LQA — Ch3–5 in context plus Ch1–2 regression; 0 open S1/S2
- [ ] LOC-0082 · Beta · P0 · L · Spanish (Spain), Chapters 3–5 — Ch3–5 translated
- [ ] LOC-0083 · Beta · P0 · M · Spanish full-game LQA — Ch3–5 in context plus Ch1–2 regression; 0 open S1/S2
- [ ] LOC-0084 · Beta · P0 · L · Polish, Chapters 3–5 — Ch3–5 translated
- [ ] LOC-0085 · Beta · P0 · M · Polish full-game LQA — Ch3–5 in context plus Ch1–2 regression; 0 open S1/S2
- [ ] LOC-0086 · Beta · P0 · L · Brazilian Portuguese, Chapters 3–5 — Ch3–5 translated
- [ ] LOC-0087 · Beta · P0 · M · Brazilian Portuguese full-game LQA — Ch3–5 in context plus Ch1–2 regression; 0 open S1/S2

### Languages added for 1.0
- [ ] LOC-0088 · Beta · P0 · L · Italian, full game — full game (Ch1–5, UI, challenge mode, disciplines, achievements) translated
- [ ] LOC-0089 · Beta · P0 · M · Italian full-game LQA — full in-context pass; 0 open S1/S2
- [ ] LOC-0090 · Beta · P0 · L · Russian, full game — full game translated (Ch3–5 only if the demo stretch shipped Ch1–2)
- [ ] LOC-0091 · Beta · P0 · M · Russian full-game LQA — full in-context pass; 0 open S1/S2
- [ ] LOC-0092 · Beta · P0 · L · Simplified Chinese, full game — full game translated (Ch3–5 only if the demo stretch shipped Ch1–2)
- [ ] LOC-0093 · Beta · P0 · M · Simplified Chinese full-game LQA — full in-context pass including line breaking and glyph coverage; 0 open S1/S2
- [ ] LOC-0094 · Beta · P0 · L · Japanese, full game — full game translated; name katakana from the termbase, Mincho display face
- [ ] LOC-0095 · Beta · P0 · M · Japanese full-game LQA — full in-context pass including kinsoku line breaks and size floor; 0 open S1/S2
- [ ] LOC-0096 · Beta · P0 · L · Korean, full game — full game translated with the particle helper for inserted names
- [ ] LOC-0097 · Beta · P0 · M · Korean full-game LQA — full in-context pass including eojeol wrapping and particles; 0 open S1/S2

### Full-game text & process
- [ ] LOC-0098 · Beta · P0 · S · Full-game loc schedule — handoff on the NAR full-game script lock, UI string freeze on the same date, translation and LQA windows ending 3 weeks before the RC gate
- [ ] LOC-0099 · Beta · P1 · S · Achievement text — names and descriptions translated for every shipped language and entered in Steamworks; length-checked in the Steam overlay
- [ ] LOC-0100 · Beta · P1 · S · Credits localisation — role headings translated; translator and LSP credits added per the credit obligations register
- [ ] LOC-0101 · Beta · P1 · S · Rich-presence tokens for the new languages — IT, RU, ZH-Hans, JA, KO token files checked in a friends list
- [ ] LOC-0102 · Release · P0 · S · Full-game store page localisation — every shipped language, with ART screenshots showing localised UI for DE, FR, RU, ZH-Hans and JA
- [ ] LOC-0103 · Release · P1 · S · Launch press text — launch press release and launch-trailer subtitles in every shipped language
- [ ] LOC-0104 · Release · P1 · S · Patch-notes template — day-one and hotfix notes published in every shipped language within 48 h of the English notes
- [ ] LOC-0105 · Post · P1 · S · Post-launch string pipeline — patch and update strings batched weekly; new content is localised before release, never after
- [ ] LOC-0106 · Post · P1 · S · LQA regression for updates — each patch touching text gets a spot-check per language on the changed keys before it goes live
- [ ] LOC-0107 · Post · P2 · M · Community translations — public TMS project for fan languages (e.g. UK, TR, CS, HU) with a contributor licence agreement; shipped as "community" languages after moderator review
- [ ] LOC-0108 · Post · P2 · S · Post-launch language review — sales and wishlist share by language after 3 months decide on new languages (e.g. Latin-American Spanish, Traditional Chinese)
- [ ] LOC-0109 · Post · P2 · M · DLC and free-update localisation — every update ships in all 1.0 languages on day one; budget and schedule added per update

## OPS-L · Full-game release (Beta → Release)

- [ ] OPS-0133 · Beta · P0 · S · Release date — chosen to avoid major genre launches and Steam sale conflicts; set in Steamworks with the page live as "coming soon" for at least the 2 weeks Valve requires (target ≥ 8 weeks)
- [ ] OPS-0134 · Beta · P0 · S · Pricing — comparables research (surgery-action and dark-fantasy indies), base USD price, regional prices from Valve's recommended table, launch-discount (10–20 %) decision
- [ ] OPS-0135 · Beta · P1 · S · Launch marketing plan — dated beats (release-date reveal, launch trailer, preview coverage, review embargo, launch streams) tied to wishlist targets
- [ ] OPS-0136 · Release · P0 · M · Commercial & comms launch checklist — price and discount live, page approved, press embargo scheduled, social posts queued, Discord event, review-copy wave confirmed, dashboards open (technical launch items stay in the PLT release checklist)
- [ ] OPS-0137 · Release · P0 · S · Day-one patch plan — patch branch cut from the RC, contents frozen 5 days before launch, notes drafted and translated, QA verification scheduled before launch hour
- [ ] OPS-0138 · Release · P1 · S · Launch-week analytics review — daily sales, refunds, review score, wishlist conversion and top issues; a day-7 report with actions
- [ ] OPS-0139 · Release · P2 · S · Launch streams — co-stream schedule with creators and two dev streams in launch week
- [ ] OPS-0140 · Release · P1 · S · Final credits check — in-game credits compared line by line with the credit obligations register and every contract
- [ ] OPS-0141 · Release · P2 · S · First payout reconciliation — first Steam payout matched against sales reports and the revenue forecast; variances explained in the monthly review

## OPS-M · Post-launch (Post)

- [ ] OPS-0142 · Post · P0 · S · Patch cadence — hotfixes within 72 h in week 1, patch 1.1 at about 4 weeks with QoL and balance, then monthly until stable; each patch's scope set in triage
- [ ] OPS-0143 · Post · P1 · M · Free update 1 — challenge pack built around the NAR/ART "Unsung Hour" secret operation plus remixed Ch1–5 challenges with leaderboards; scoped, scheduled and announced
- [ ] OPS-0144 · Post · P1 · M · Free update 2 — boss rush (working title "Office of Hours") of all eight Malison hours with its own leaderboard; go/no-go on month-2 engagement data
- [ ] OPS-0145 · Post · P1 · M · Paid DLC business case — the NAR "Ninth Office" chapter outline costed (ART DLC template, loc, VO), with price, attach-rate assumption and a go/no-go after 3 months of sales
- [ ] OPS-0146 · Post · P1 · S · Mod policy — content rules (no third-party IP, no hateful content), takedown handling via the IP-claim procedure, EULA mod clause, moderation owner for Workshop items (tech per PLT)
- [ ] OPS-0147 · Post · P1 · S · Sales calendar — Steam seasonal sales and Daily Deal requests; discount ladder (e.g. 20 → 30 → 40 %) tied to months since launch; ART sale capsules scheduled
- [ ] OPS-0148 · Post · P1 · S · Monthly business review — revenue, wishlists, conversion, refunds, review trend, playtime and completion (Steamworks + telemetry); decisions logged
- [ ] OPS-0149 · Post · P1 · S · Refund & review watch — refund rate and review score checked weekly for 3 months; a refund rate above 10 % or score drop of 5 points triggers an investigation ticket
- [ ] OPS-0150 · Post · P2 · S · Bundles & cross-promotion — a Steam bundle or cross-promo with a complementary indie after 6 months; partner and terms logged
- [ ] OPS-0151 · Post · P2 · S · End-of-support plan — when telemetry, Discord support and patches wind down; retention and shutdown notice drafted in line with the privacy policy
- [ ] OPS-0152 · Post · P1 · S · Project post-mortem — after 3 months: schedule vs plan, budget vs actual, what to keep and change; published internally
