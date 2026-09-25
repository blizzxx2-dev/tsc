# 03 — QA & Tooling, Localisation, Production & Release · Suture & Steel: The Malison Hours

Workstreams: **`QAT`** QA, testing & tooling · **`LOC`** localisation · **`OPS`** production, legal & release.

Scope follows `_brief.md`: `Demo` = everything the free Chapters 1–2 Steam demo (op1-1…op1-5, op2-1…op2-5; the Malison
of Matins and of Lauds) needs at release quality; `Alpha`/`Beta`/`Release` = Chapters 3–5 and the full game; `Post` =
after launch. `[x]` = already in the repository.

Baseline this file builds on:
- Tests: one Vitest file (`tests/gesture.test.ts`); no `vitest.config.ts`, no lint/format config, no CI workflow.
- `scripts/smoke.mjs` (Playwright 1.55, SwiftShader WebGL2) screenshots title → story → briefing → operations and the
  Matins fight, but only *logs* page errors (always exits 0) and uses fixed `waitForTimeout` sleeps.
- `src/main.ts` exposes `?op=<id>` deep links and `window.__game`; the smoke script mutates `scene.op.entities` directly.
- All player-facing text is inline English: `src/content/chapter1.ts`/`chapter2.ts` (titles, diagnoses, callouts, story),
  `src/surgery/*.ts` (`say`/`sayOnce` lines, `rate()` labels such as "Barbs freed", popups, loss reasons), `src/scenes/*.ts`.
- Fonts are Latin-only OFL faces (IM Fell English, UnifrakturMaguntia) rasterised into one 2048² glyph atlas.
- The hexstone `EmbeddedKind` is still named `warpshard` internally (`src/surgery/entities.ts`, `src/content/chapter2.ts`).

Cross-file dependencies are named by workstream (ENG, PLT, INP, UIX, AUD). Work those files already own — the ENG
replay recorder/golden-run suite/perf benchmark/dev console, the PLT CI pipeline/crash reporting/SteamPipe/save v2, the
UIX accessibility audit/tutorials/pseudo-loc build, the AUD VO and composer contracts — is not repeated here; tasks
below add the QA, localisation and production work around it.

---

## QAT-A · Test & CI foundation (M0 → Demo)

### Already in place
- [x] QAT-#### · M0 · P1 · S · Star-gesture recogniser unit tests — `tests/gesture.test.ts` accepts clean and sloppy pentagrams and rejects a circle, a zig-zag and a tiny scribble
- [x] QAT-#### · M0 · P1 · M · Playwright smoke script — `scripts/smoke.mjs` boots `vite preview` in headless Chromium (SwiftShader), walks title → story → briefing → op1-1/op1-3/op1-4/op1-5 and the Matins fight, saves screenshots
- [x] QAT-#### · M0 · P2 · S · Automation hooks — `?op=<id>` jumps straight into any operation and `window.__game` exposes the running game to scripts

### Test infrastructure
- [ ] QAT-#### · Demo · P0 · S · `vitest.config.ts` with projects `unit` (node environment, `src/surgery`, `src/core`, `src/content`) and `sim` (long bot runs, 60 s timeout); npm scripts `test:unit`, `test:sim`, `test:visual`, `test:perf` documented in CONTRIBUTING.md
- [ ] QAT-#### · Demo · P0 · S · Sim test helpers `tests/helpers/sim.ts` — `makeOp(def)`, `press/drag/release` `Pointer` builders, `step(op, seconds, dt = 1/60)`, `strokePath(op, tool, points)`, `zigzag(a, b, amplitude, crossings)`; used by every entity test
- [ ] QAT-#### · Demo · P1 · S · Isolated-entity factory `defWith(spawn, overrides)` — single-phase `OperationDef` with `baseDrain: 0`, `timeLimit: 999`, all eight tools, so each entity is tested without neighbours
- [ ] QAT-#### · Demo · P1 · S · Test-code lint rules via `@vitest/eslint-plugin` — no focused tests (`.only`), no `.skip` without an issue link, every test contains an assertion; CI fails on violations
- [ ] QAT-#### · Demo · P2 · S · Pre-commit hooks (simple-git-hooks + lint-staged) — staged `*.ts` run Prettier + ESLint `--fix`; pre-push runs `tsc --noEmit` and `vitest related --run` on changed files; bypass documented for emergencies only
- [ ] QAT-#### · Demo · P2 · S · Commit-message lint (commitlint, conventional commits) in a pre-commit `commit-msg` hook and as a PR check, so the PLT changelog/patch-notes generator always has typed commits
- [ ] QAT-#### · Demo · P1 · S · Secret scanning — gitleaks action on every PR and push blocks Steamworks builder credentials, crash-reporter tokens, telemetry keys and signing material; allow-list file reviewed quarterly
- [ ] QAT-#### · Demo · P1 · S · Test reporting — Vitest and Playwright emit JUnit XML; CI publishes a per-run summary (passed/failed/flaky, slowest 10 tests); any unit test slower than 2 s is flagged in the summary

### Smoke script hardening
- [ ] QAT-#### · Demo · P0 · S · `scripts/smoke.mjs` exits 1 when any `pageerror` or console error is captured, kills `vite preview` in a `finally` block, and enforces a 90 s global timeout
- [ ] QAT-#### · Demo · P1 · S · Replace fixed `waitForTimeout` sleeps with waits on game state (`__game.scene` class name, `op.status`, `op.phase`) — smoke passes 20/20 consecutive runs and is ≥ 30 % faster
- [ ] QAT-#### · Demo · P1 · S · Smoke covers Chapter 2 — `op2-1`…`op2-5` deep links, the Lauds fight (Voices silenced via the debug API) and the story scenes `s2-1`…`s2-end`, each screenshotted
- [ ] QAT-#### · Demo · P1 · S · `CHROMIUM` env var optional — smoke falls back to Playwright's bundled Chromium (`npx playwright install chromium`) so it runs on any dev machine and CI image

### Pipelines owned by QA
- [ ] QAT-#### · Demo · P1 · M · Nightly QA workflow — balance sims, full visual suite, entity galleries, soak and bot-completion runs on `main`; summary table posted to the job summary and the team Discord webhook; failures open an issue labelled `nightly`
- [ ] QAT-#### · Demo · P1 · S · Flaky-test policy — Playwright `retries: 2` in CI; a test that passes only on retry auto-files a `flaky` issue; quarantined tests listed in `tests/QUARANTINE.md` with a 2-week fix deadline
- [ ] QAT-#### · Demo · P2 · S · Shard the Playwright suites (`--shard=i/4`) across parallel CI jobs once visual + E2E exceed 5 minutes; merged HTML report uploaded as one artefact

## OPS-A · Production cadence & tracking (M0 → Demo)

### Cadence
- [ ] OPS-#### · Demo · P0 · S · Two-week sprint cadence — planning, mid-sprint check, review on a playable build, retro; sprint goal and committed tasks recorded on the GitHub Project before day 1 of each sprint
- [ ] OPS-#### · Demo · P1 · S · Sprint-review build — every sprint ends with a tagged build on the Steam `qa` branch and a 1-page "what changed / what to test" note linked from the review
- [ ] OPS-#### · Demo · P1 · S · Weekly status note — Friday update (burn-up vs forecast, risks that moved, decisions needed, next week's focus) posted to the production channel and archived in `docs/production/status/`
- [ ] OPS-#### · Demo · P1 · S · Decision log — `docs/production/decisions.md` (date, decision, alternatives, owner, link); every scope, legal, pricing and vendor decision in this file points to an entry

### Tracking
- [ ] OPS-#### · Demo · P0 · M · Roadmap → issue sync — script parses every `docs/roadmap/*.md` task line (id, phase, priority, size, title) into GitHub issues with labels, and writes closed issues back as `[x]`; idempotent (second run makes no changes)
- [ ] OPS-#### · Demo · P0 · S · GitHub Project views — by phase, by workstream, by priority and a "Demo critical path" view filtered to `Demo` + `P0`; saved views linked from the README
- [ ] OPS-#### · Demo · P1 · S · Milestone burn-up — points S = 1, M = 3, L = 8; weekly burn-up per phase with a forecast finish date; a forecast slipping > 2 weeks past a gate triggers a scope review
- [ ] OPS-#### · Demo · P0 · M · Master schedule — dated plan from today (Sept 2026) to Next Fest and 1.0 with lead times for art, music, localisation, rating, Valve store/build review and trademark filing; 15 % buffer on every external dependency
- [ ] OPS-#### · Demo · P2 · S · Contractor onboarding pack — access checklist (GitHub, Drive, Discord, Steamworks role), style bibles, file-naming rules, review slots; new contractor productive on day 1 (checked at first review)
- [ ] OPS-#### · Demo · P0 · S · Account security — 2FA on GitHub, Steamworks, domain registrar, email and social accounts; shared credentials only in a team password manager; two admins on every critical account

## OPS-B · Milestone gates & definitions of done

- [ ] OPS-#### · Demo · P0 · S · Task-level Definition of Done — reviewed, tests or golden replay updated, strings in the string table, no new lint errors, changelog line, verified in a build by someone other than the author; linked from the PR template
- [ ] OPS-#### · M0 · P0 · S · M0 gate review — Chapter 1 (op1-1…op1-5 + Matins) playable start to finish from the title, smoke green, prototype retro held; go/no-go and carry-over list recorded in the decision log
- [ ] OPS-#### · Demo · P0 · M · Demo Definition of Done — Ch1–2 (10 operations, Matins + Lauds) with tutorials, options, save/Cloud, controller and Deck basics, demo languages, opt-in telemetry, wishlist screen; 0 open S1/S2; perf budgets met; Valve build and store review passed
- [ ] OPS-#### · Demo · P0 · S · Demo feature lock — dated; after it only content, polish and fixes merge; any exception needs an equal-size cut recorded in the decision log
- [ ] OPS-#### · Demo · P0 · S · Demo content lock — Ch1–2 operation data, story and English strings locked (aligned with the LOC string freeze); later changes are bug fixes approved in triage
- [ ] OPS-#### · Demo · P0 · S · Demo go/no-go gate — QA sign-off, legal/IP clearance, store page readiness, rating/content survey and Next Fest registration reviewed 3 weeks before the press preview; outcome and fallback edition recorded
- [ ] OPS-#### · Alpha · P0 · S · Alpha Definition of Done & gate — all core systems feature-complete, Ch1–5 playable end-to-end with placeholder art/audio, every operation has a golden replay and a par score; gate review recorded
- [ ] OPS-#### · Beta · P0 · S · Beta Definition of Done & gate — content complete, final art/audio/VO in, all 11 languages in, balancing signed off, achievements/Cloud/Deck integrated, 0 open S1
- [ ] OPS-#### · Release · P0 · S · Release-candidate gate — 0 open S1/S2, compliance checklists passed, rating certificates on file, store page approved, launch comms scheduled; RC build SHA recorded
- [ ] OPS-#### · Release · P0 · S · Gold-master go/no-go — build locked, day-one patch contents frozen, rollback build identified, launch rota staffed; signed off by owner and QA lead

## OPS-C · Risk register & scope management

- [ ] OPS-#### · Demo · P0 · S · Risk register `docs/production/risks.md` — probability × impact, owner, trigger, mitigation, status; seeded with IP similarity (Atlus/SEGA *Trauma Center*, Games Workshop tone), Deck/low-end GPU performance, Next Fest slip, art pipeline throughput, key-person/bandwidth, gore/occult rating limits, CJK/Cyrillic font cost, VO budget; reviewed each sprint
- [ ] OPS-#### · Demo · P0 · S · Demo MoSCoW — Must/Should/Could/Won't list for demo features (e.g. challenge mode, alternate disciplines, full VN VO default to Won't) published to the team and mirrored as labels on the board
- [ ] OPS-#### · Demo · P1 · S · Change control — after feature lock every addition names an equal-sized cut; `docs/production/cut-list.md` keeps cut items with the phase they move to
- [ ] OPS-#### · Demo · P1 · S · Next Fest fallback plan — criteria for moving to the following Next Fest edition, pre-written team/community messaging, and what the extra time is spent on; approved before the go/no-go gate
- [ ] OPS-#### · Alpha · P0 · S · Chapters 3–5 scope lock — ≈5 operations per chapter, the six remaining Malison hours (Prime, Terce, Sext, None, Vespers, Compline) assigned two per chapter, and which disciplines ship at 1.0; recorded before Alpha kickoff
- [ ] OPS-#### · Alpha · P1 · S · Post-demo re-plan — demo telemetry, wishlists and playtest findings used to re-estimate Ch3–5; schedule and budget re-baselined and the burn-up reset
- [ ] OPS-#### · Beta · P1 · S · Cut-line review — at Beta start remaining features are ranked; everything below the line moves to `Post` with a public-roadmap decision

## OPS-D · Budget, hiring & contracts (Demo → Alpha)

### Budget
- [ ] OPS-#### · Demo · P0 · M · Budget model — spreadsheet by category (art, music, SFX, writing/editing, VO, localisation, legal/trademark, ratings, marketing, QA contractors, hardware, software, Steam Direct fee, contingency 15 %) for Demo and 1.0; monthly actuals vs plan reviewed
- [ ] OPS-#### · Demo · P0 · S · Demo asset count for quotes — character portraits (Kreuzer, Ilse, Stroh, Haller, Mauer, 10 patients) × expressions, story backgrounds, UI screens, capsule set, trailer; each line mapped to a vendor quote
- [ ] OPS-#### · Demo · P1 · S · Localisation budget — word counts per scope (Ch1–2 story, callouts, UI, store) × per-language vendor rates + 20 % LQA; approved before vendor contracts are signed
- [ ] OPS-#### · Demo · P1 · S · Test hardware — Steam Deck (LCD + OLED), Intel UHD 620 laptop, AMD RDNA and older NVIDIA GTX cards, one macOS Apple-silicon machine if a Mac build is greenlit; inventory with owner and location
- [ ] OPS-#### · Demo · P2 · S · Funding decision — self-funding vs publisher pitch vs regional games funds; pitch deck with the demo, wishlist data and budget; decision and deadlines in the decision log

### Contracts
- [ ] OPS-#### · Demo · P0 · M · Contractor agreement template (counsel-reviewed) — work-for-hire/IP assignment, moral-rights waiver where lawful, confidentiality, credit terms, portfolio-use clause, warranty of originality (no third-party IP), generative-AI use disclosure
- [ ] OPS-#### · Demo · P1 · S · Credit obligations register — every contract's credit wording and placement recorded; feeds the in-game credits and store page
- [ ] OPS-#### · Demo · P1 · S · Invoice & milestone payments — contractor deliverables paid per accepted milestone; acceptance criteria written in each statement of work

### Hiring (roles not already owned by the AUD voice/music plan)
- [ ] OPS-#### · Demo · P0 · M · Character-portrait artist — brief (Dürer/Holbein woodcut and oil tone, original designs), paid test piece (Sister Ilse, 3 expressions), contract signed; delivery schedule for demo cast
- [ ] OPS-#### · Demo · P0 · M · Story-background illustrator — Bruegel/Bosch-inspired Kessendorf scenes; paid test piece (hospice ward); demo list of backgrounds scheduled
- [ ] OPS-#### · Demo · P1 · M · UI/graphic designer — HUD, menus, iconography for the eight instruments and the logo wordmark; brief includes the IP trade-dress rules (no *Trauma Center* HUD likeness)
- [ ] OPS-#### · Demo · P0 · S · Composer sourcing — shortlist of 5, paid 60-s test cue in the period-consort brief, selection recorded; the chosen composer then goes through the AUD music contract
- [ ] OPS-#### · Demo · P1 · M · Narrative editor — archaic-register English editor for Ch1–2 (sample edit of the prologue) and Ch3–5 writer or co-writer decided; rates and schedule agreed
- [ ] OPS-#### · Demo · P1 · S · Trailer editor and capsule artist — portfolio review, quotes, dates aligned with store-page launch and the Next Fest trailer
- [ ] OPS-#### · Demo · P2 · S · PR/marketing support — freelance PR vs self-run decision with cost; if hired, scope covers press list, outreach waves and Next Fest campaign
- [ ] OPS-#### · Demo · P1 · S · QA contractors — quote from a compatibility lab or freelance tester pool for the demo matrix; booked 6 weeks before the demo RC
- [ ] OPS-#### · Alpha · P1 · S · Ch3–5 capacity booking — art, music, writing and loc vendor capacity for Alpha→Beta booked against the re-baselined schedule; gaps flagged as risks

## OPS-E · IP & legal clearance (Demo, re-checked at Alpha and Release)

### Games Workshop / *Trauma Center* distance
- [ ] OPS-#### · Demo · P0 · M · IP clearance register `docs/legal/ip-clearance.csv` — every proper noun (Kreuzer, Ilse, Stroh, Haller, Mauer, Kessendorf, Saint Ildra, Merciful Order, Order of the Pyre, Hollow Choir, Malison, hexstone, hexfire, hexlings, Choir Voices…) checked against Warhammer Fantasy/Old World/Age of Sigmar lexicons, *Trauma Center*/*Trauma Team* terms and trademark databases; status and reviewer per row
- [ ] OPS-#### · Demo · P0 · S · Banned-terms list `docs/legal/banned-terms.txt` — GW-specific words (Warhammer, warp/warpstone, Sigmar, Skaven, Chaos-god names, Old World place names) and *Trauma Center*-specific terms (Healing Touch, GUILT, Caduceus, Derek Stiles, Angie Thompson); consumed by the QAT IP lint
- [ ] OPS-#### · Demo · P0 · S · Rename `warpshard` → `hexstone` — `EmbeddedKind`, `SPECS`, `chapter2.ts` `hiddenShard`, tests, save and replay ids migrated; `grep -ri warp src tests` returns nothing
- [ ] OPS-#### · Demo · P0 · M · Visual iconography review — curse sigils (`SIGILS` eye, trident, crown, hourglass and every new one), Hollow Choir heraldry, Order of the Pyre insignia and Malison designs checked against GW marks (eight-pointed Chaos star, Chaos-god runes, twin-tailed comet, Sigmarite hammer, Skaven horned-rat sign); per-asset sign-off
- [ ] OPS-#### · Demo · P0 · M · *Trauma Center* trade-dress review — HUD layout, vitals meter, tool tray, COOL/GOOD/BAD/MISS words, XS rank label, star-gesture presentation and assistant-portrait framing compared side by side with Atlus DS/Wii screens; counsel memo lists required changes
- [ ] OPS-#### · Demo · P0 · S · Rating & rank wording decision — keep or replace COOL/GOOD/BAD/MISS and "XS" per the counsel memo (e.g. period words); decision logged, LOC glossary and UIX HUD tasks updated
- [ ] OPS-#### · Demo · P0 · S · Character-design likeness check — portraits and silhouettes of Kreuzer, Ilse, Stroh and the Choir reviewed against GW Witch Hunter iconography and the *Trauma Center* cast; sign-off before final art
- [ ] OPS-#### · Demo · P0 · S · Marketing-reference rules — counsel-approved guidance: no GW or Atlus names, logos, footage or screenshots in store copy, trailers or press kit; whether "for fans of surgery-action games" style phrasing may name *Trauma Center* in press only

### Title & brand
- [ ] OPS-#### · Demo · P0 · M · Title trademark knock-out search — "Suture & Steel", "Suture and Steel" and "The Malison Hours" in USPTO Trademark Search, EUIPO eSearch, UKIPO, WIPO Global Brand Database, J-PlatPat and KIPRIS (Nice classes 9, 28, 41) plus Steam, itch.io, console and app stores; counsel clearance opinion on file
- [ ] OPS-#### · Demo · P1 · S · Fallback title shortlist — 3 alternates pre-screened with the same knock-out search, so a late conflict does not stall the announce
- [ ] OPS-#### · Demo · P1 · M · Trademark filings — "Suture & Steel" word mark (and the logo if distinctive) filed with EUIPO and USPTO in classes 9 and 41 before the public announce; filing receipts in `docs/legal/`
- [ ] OPS-#### · Demo · P1 · S · Domains & handles — suture-and-steel domains (.com and the chosen ccTLDs), Steam developer/publisher names, X, Bluesky, YouTube, TikTok, Reddit and Discord vanity URL registered to the company account
- [ ] OPS-#### · Demo · P0 · S · Rebrand audit outside code — every document, store draft, press asset and social bio uses "Suture & Steel — The Malison Hours"; no "Grim Apothecary" or "grim-surgeon" left in public-facing material (code identifiers are handled by PLT)

### Provenance & licences
- [ ] OPS-#### · Demo · P0 · S · Asset provenance policy — every art/audio/font/video asset logged in `docs/legal/asset-provenance.csv` (author, licence, contract id, source URL, AI-use flag) before merge; enforced by the QAT manifest check
- [ ] OPS-#### · Demo · P0 · S · Public-domain reference rule — Dürer, Bruegel and Bosch references only from sources marked CC0/public domain (e.g. Met Open Access, Rijksmuseum, National Gallery of Art) with the URL logged; no tracing from rights-reserved photographs
- [ ] OPS-#### · Demo · P0 · S · Steam AI-content disclosure — Steamworks content survey answered from the provenance log (pre-generated and live-generated content); re-checked at every milestone gate
- [ ] OPS-#### · Demo · P1 · S · Open-source notices legal review — the PLT-generated third-party notices (runtime, npm, OFL fonts) checked by counsel for completeness before the demo RC

### Company & policies
- [ ] OPS-#### · Demo · P0 · S · Legal entity & Steamworks onboarding — company entity confirmed, Steamworks partner agreement signed, tax interview and bank verified, Steam Direct fee paid for the full-game app; ownership of all IP assigned to the entity
- [ ] OPS-#### · Demo · P1 · S · NDA template — mutual NDA for playtesters, contractors and press previews with an e-signature workflow; signed NDAs stored per person
- [ ] OPS-#### · Demo · P0 · M · EULA decision — Steam Subscriber Agreement only vs custom EULA (telemetry, conduct, future mods); if custom, drafted by counsel, shown on first launch and linked on the store page
- [ ] OPS-#### · Demo · P0 · M · Privacy policy — GDPR/UK GDPR/CCPA: opt-in telemetry, crash reports, newsletter, Discord; controller identity, processors, 90-day raw retention, deletion by install id, contact address; hosted at a stable URL
- [ ] OPS-#### · Demo · P1 · S · Data processing agreements — DPAs signed with telemetry, crash-reporting and newsletter processors; record of processing activities kept in `docs/legal/`
- [ ] OPS-#### · Demo · P1 · S · Website consent — no analytics or tracking cookies without consent; Steam wishlist widget and newsletter form reviewed against the privacy policy
- [ ] OPS-#### · Alpha · P1 · S · IP re-review for Chapters 3–5 — new names, the remaining Malison hours, factions, creature and sigil designs pass the clearance register before Beta art lock
- [ ] OPS-#### · Release · P0 · S · Final IP audit — full string table and asset gallery re-checked against the banned-terms list and clearance register; counsel sign-off attached to the RC gate

## LOC-A · Demo language scope & i18n framework (Demo)

### Scope decisions
- [ ] LOC-#### · Demo · P0 · S · Demo language subset — proposed EN + ZH-Hans, RU, ES (Spain), PT-BR, DE, FR (the largest Steam client languages after English); IT, PL, JA, KO join at Beta; Latin-only fallback set (EN, DE, FR, ES, PT-BR) if the Cyrillic/CJK font work cannot make the demo; decision and rationale in the decision log
- [ ] LOC-#### · Demo · P0 · S · Re-phase sibling localisation tasks to Demo — UIX string extraction, pseudo-localisation build and runtime language switch, PLT string tables, and (for RU/ZH-Hans) the UIX CJK/blackletter fallbacks and ENG Cyrillic/CJK font pages; ENG font subsetting widened beyond Latin Extended-A; owners' sign-off on the board
- [ ] LOC-#### · Demo · P1 · S · Spanish variant decision — Spain vs Latin-American Spanish for the demo, based on Steam traffic by country for the coming-soon page; second variant listed as a Post option
- [ ] LOC-#### · Demo · P2 · S · RTL out of scope — documented decision that Arabic/Hebrew are not planned for 1.0, so layout code needs no bidi support; revisited only in the post-launch language review

### Runtime
- [ ] LOC-#### · Demo · P0 · M · `src/i18n/` runtime — `t(key, params?)` over `strings/<lang>.json` with ICU MessageFormat (plural, select, number); unit tests cover PL and RU plural categories (one/few/many/other) and FR treating 0 as singular
- [ ] LOC-#### · Demo · P0 · S · Key conventions `docs/loc/keys.md` — `ui.*`, `tool.<id>.name|hint`, `rating.<r>`, `rank.<r>`, `op.<id>.title|patient|diagnosis`, `label.<entity>.<event>`, `cast.<id>.name|title`; speakable lines reuse the AUD line ids (`s1-2.014`, `op1-2.p0.1`, `bark.flooded`) so VO, subtitles and text share one id
- [ ] LOC-#### · Demo · P0 · S · Locale loading & fallback — locales lazy-loaded as Vite chunks; fallback chain (pt-BR → en, es-ES → en); a missing key renders English, warns once in dev and increments a `loc_missing_key` telemetry counter
- [ ] LOC-#### · Demo · P1 · S · Number & time formatting — score, combo, vitals and timer formatted through `Intl.NumberFormat`/mm:ss per locale (FR narrow no-break-space grouping, DE period grouping); U+00A0 and U+202F glyphs present in every body font page
- [ ] LOC-#### · Demo · P1 · S · Rank-letter policy — XS/S/A/B/C stay Latin capitals in every language (documented for translators); the rating words follow the OPS wording decision and the glossary

### Externalising simulation & content text
- [ ] LOC-#### · Demo · P0 · M · Rating labels to keys — every `rate(…, label)` literal in `src/surgery/*.ts` ('Incision', 'Closed', 'Drained', 'Stitched', 'Sealed', 'Nick', 'Barbs freed', 'Torn', 'Debrided', 'Burn dressed', 'Lanced', 'Cleansed', 'Rot purged', 'Antidote', 'Seared', 'Plucked', 'Curse broken', 'Wounded', 'Malison unmade', 'It rejoined', 'Cast out', 'Silenced', 'Hatched') becomes a key; the sim stores keys, the HUD resolves text
- [ ] LOC-#### · Demo · P0 · S · Popups & loss reasons to keys — 'THE LITANY OF STILLNESS', 'The curse lashes out!', '-N'/'+N' vitals popups, 'The patient has died.', 'Time has run out.' and `Embedded` `SPECS` labels (Arrow, Bolt, Lead shot, Fang, Shard, Glass, Hexstone) resolved through `t()`
- [ ] LOC-#### · Demo · P0 · M · Content text to keys — `OperationDef` `title`/`patient`/`diagnosis`, chapter titles and numerals, "END OF CHAPTER …" narration and `CAST` names/titles for Ch1–2 moved into `strings/en.json`; content files keep ids only; golden replays unaffected
- [ ] LOC-#### · Demo · P0 · S · No runtime sentence assembly — `${label} ${RATING_TEXT}` and `x${combo}` popups rebuilt as ICU patterns (`{label} {rating}`, `×{combo}`) so each language can reorder; audit script finds template literals feeding text draws
- [ ] LOC-#### · Demo · P1 · S · Patient grammatical gender — `OperationDef.patientGender` (m/f/unknown) passed to callouts as an ICU `select`, so FR/DE/ES/IT/PT/PL/RU lines like "his pulse is weak" agree; all Ch1–2 ops annotated

### Tooling & validation
- [ ] LOC-#### · Demo · P0 · M · Key-usage scanner `npm run i18n:check` — TypeScript compiler API collects every `t()`/line-id reference; reports keys missing from `en.json`, unused keys and dynamic keys; runs in CI
- [ ] LOC-#### · Demo · P0 · S · Locale file validation in CI — every locale parses, ICU syntax compiles, placeholder names match English exactly, no leading/trailing whitespace drift, no untranslated key unless flagged `fallback: true`
- [ ] LOC-#### · Demo · P1 · S · Translator context `strings/en.meta.json` — per key: speaker, scene, max width in px, character limit, notes, screenshot link; exported to the TMS as key context
- [ ] LOC-#### · Demo · P1 · S · Reading time per locale — callout display time (`max(2.4 s, 0.055 s × length)` in `Operation.update`) counts CJK characters × 2.5 and applies a per-locale factor; unit tests keep JA/ZH lines ≥ 2.4 s and ≤ the English duration × 1.3
- [ ] LOC-#### · Demo · P1 · S · CJK line-break rules on top of UIX character breaking — no line starts with 、。，」）！？ or ends with 「（; Korean wraps between eojeol only; test strings per language
- [ ] LOC-#### · Demo · P2 · S · Readable-font option per script — the UIX Atkinson Hyperlegible option has no Cyrillic/CJK; map RU to a Cyrillic sans (e.g. Noto Sans) and ZH/JA/KO to the matching Noto Sans CJK subset

## LOC-B · Fonts & glyph coverage (Demo → Beta)

- [ ] LOC-#### · Demo · P0 · S · Coverage audit `npm run i18n:glyphs` — opentype.js reads each shipped font's cmap and reports, per locale and font role (body, italic, display), code points used in `strings/<lang>.json` that the font lacks; CI fails when an uncovered code point has no fallback face
- [ ] LOC-#### · Demo · P0 · M · Latin-extended body coverage — IM Fell English regular/italic checked for PL (ą ć ę ł ń ó ś ź ż), DE (ß ẞ), FR (œ Œ « » ÿ), ES (ñ ¿ ¡), PT (ã õ ç); gaps filled by a matched OFL fallback (e.g. EB Garamond) or a renamed derivative that respects the OFL Reserved Font Name rule
- [ ] LOC-#### · Demo · P0 · S · Per-script display-face selection — Latin-extended, Cyrillic and CJK title faces chosen to sit with UnifrakturMaguntia (side-by-side capture approved by the art lead); the choice is the input to the UIX blackletter/CJK fallback tasks
- [ ] LOC-#### · Demo · P0 · M · Cyrillic body & italic faces — OFL serif with early-modern character (candidates Old Standard TT, EB Garamond Cyrillic, Cormorant) chosen after an RU reader test of the Ch1 prologue at 1280×800; provenance row and OFL text recorded
- [ ] LOC-#### · Demo · P0 · M · Simplified Chinese faces — Source Han Serif SC / Noto Serif SC body, a Kai-style face mapped to the `italic` role (CJK has no italics), and a heavy display face; OFL recorded
- [ ] LOC-#### · Demo · P0 · S · Glyph lists for baking — script emits the exact code-point set per locale (strings + digits + UI punctuation + a 500-character safety set for ZH) for the ENG subsetting/MSDF build; regenerated on every translation import
- [ ] LOC-#### · Demo · P1 · S · Fallback-glyph highlighter — LQA builds tint any glyph drawn from a fallback face or the dynamic rasteriser magenta, so reviewers spot mixed fonts and missing coverage on screen
- [ ] LOC-#### · Demo · P1 · S · CJK size floor — Chinese body text ≥ 20 px and callouts ≥ 22 px at 1280×800 (Latin floor stays with PLT legibility); enforced by per-locale layout constants and checked in the localised screenshots
- [ ] LOC-#### · Beta · P0 · M · Japanese faces — Source Han Serif JP / Noto Serif JP body, a Mincho display face (e.g. Shippori Mincho B1), `italic` role mapped; glyph list covers kana, used kanji and JIS punctuation
- [ ] LOC-#### · Beta · P0 · M · Korean faces — Noto Serif KR body and a heavy display weight; glyph list covers every Hangul syllable used plus a 2,350-syllable KS X 1001 safety set

## LOC-C · Pseudo-localisation & text expansion (Demo)

- [ ] LOC-#### · Demo · P0 · S · Pseudo-locale generator — `qps.json` built from `en.json`: accented substitutes (e.g. "Ŧĥë Ŀïŧàñÿ"), +40 % padding, `⟦ ⟧` brackets; ICU placeholders and line-id markup preserved (unit test); consumed by the UIX pseudo-loc build
- [ ] LOC-#### · Demo · P1 · S · `qps-long` variant — strings under 12 characters expanded by 100 % (German/Russian single-word labels such as tool names and rating words) to stress buttons and the tool tray
- [ ] LOC-#### · Demo · P1 · S · `qps-cjk` variant — full-width characters and no spaces to exercise CJK wrapping, the size floor and atlas pressure before real Chinese arrives
- [ ] LOC-#### · Demo · P1 · M · Width budgets in CI — each key's max px width (from `en.meta.json`) checked against every translation using advance widths read from the font files; failures list key, locale and overflow in px
- [ ] LOC-#### · Demo · P1 · S · HUD text budgets — rating popups ≤ 220 px at popup size, callout banner ≤ 2 lines, tool-tray names ≤ 1 line at 88 px tray width (`TRAY.w`); violations reported per locale to the UIX owner

## LOC-D · Glossary, style guide & voice (Demo)

- [ ] LOC-#### · Demo · P0 · M · Setting glossary `docs/loc/glossary.csv` — Kessendorf, Hospice of Saint Ildra, Merciful Order, Order of the Pyre, Hollow Choir, the Malison, Choir Voices, Litany of Stillness, hexstone, hexfire, hexlings, black bile, eschar, bubo, brood-mother, gravehound; definition, part of speech, do-not-translate flag, approved term per language
- [ ] LOC-#### · Demo · P0 · S · Instrument glossary — Lancet, Tongs, Leech-Pipe, Gut Thread, Saint's Salve, Tincture, Cautery Brand, Scrying Lens with function notes, hotkey, and a tray-width character limit per language
- [ ] LOC-#### · Demo · P0 · S · Canonical-hours glossary — Matins, Lauds, Prime, Terce, Sext, None, Vespers, Compline mapped to each language's established liturgical terms (FR Matines … Complies, DE Matutin … Komplet, ES Maitines … Completas, RU полунощница/утреня …), noting each is also a boss name and a chapter title
- [ ] LOC-#### · Demo · P0 · S · Proper-name policy — names untranslated in Latin-script languages; approved transliterations for RU/ZH/JA/KO (e.g. Kreuzer → Кройцер / 克罗伊策 / クロイツァー / 크로이처) recorded once and reused everywhere including the store page
- [ ] LOC-#### · Demo · P0 · M · English archaic-register style guide `docs/loc/style-en.md` — Early-Modern flavour without pastiche: allowed archaisms, banned anachronisms (okay, germs, bacteria, adrenaline, antibiotic), forms of address (Doctor, Sister, Inquisitor), oaths ("Saints preserve us"), humoral vocabulary, black-humour guidance, 20 before/after examples
- [ ] LOC-#### · Demo · P0 · S · Callout rules — Sister Ilse's operation callouts are imperative, ≤ 110 English characters, name the instrument before the target and gesture; translators keep instruction order (tool → target → gesture)
- [ ] LOC-#### · Demo · P1 · S · Character voice sheets — Kreuzer (dry, exact), Sister Ilse (pious, practical, urgent in surgery), Inquisitor Stroh (silken menace), Master Haller (coarse veteran), Captain Mauer (blunt soldier), the Choir (liturgical, wrong): 10 reference lines each
- [ ] LOC-#### · Demo · P1 · M · Per-language register addenda — how each target language carries the archaic tone (FR vouvoiement throughout, DE Ihr-forms for Stroh, RU Church-Slavonic colour for the Choir only, ZH 半文半白 narration), written by the lead translator and approved before bulk translation
- [ ] LOC-#### · Demo · P1 · S · Religion & occult sensitivity notes — the church, saints and heresy are fictional: translators must not substitute real saints, deities or scripture; pentagram and witch-hunt terms kept neutral; reviewed per language
- [ ] LOC-#### · Demo · P1 · S · Period-medicine reference — per-language Galenic terms for humours, bile, buboes, gangrene, cautery and leeching; modern clinical terms listed as banned
- [ ] LOC-#### · Demo · P1 · S · Glossary consistency check — script flags translations where the English source contains a glossary term but the approved target term is absent; report per locale in CI
- [ ] LOC-#### · Alpha · P1 · S · Glossary extension for Chapters 3–5 — new characters, places, the remaining Malison hours' gimmicks, disciplines and ailments (petrification, dragon-breath, claw rakes) added before Ch3–5 translation starts

## LOC-E · Vendor, pipeline & process (Demo)

- [ ] LOC-#### · Demo · P0 · M · Localisation vendor selection — RFP to 3 games-specialised LSPs; paid 500-word test (prologue + op1-2 callouts) per demo language scored blind by independent native reviewers; contract with NDA, IP assignment and LQA scope
- [ ] LOC-#### · Demo · P0 · M · TMS setup (Crowdin or Lokalise) — GitHub integration syncs `strings/en.json` + `en.meta.json`; translations return as PRs; glossary, style guides and screenshots attached; reviewer roles per language
- [ ] LOC-#### · Demo · P1 · S · Context screenshots in the TMS — QAT localised captures uploaded automatically and linked to the keys visible in each capture
- [ ] LOC-#### · Demo · P0 · S · Word counts `npm run i18n:wordcount` — per chapter and scope (UI, callouts, barks, story, store, legal); new/changed words since the last handoff for incremental quotes
- [ ] LOC-#### · Demo · P0 · M · English edit pass — the narrative editor proofreads all Ch1–2 English (story, callouts, labels, store copy) against the style guide before the first handoff
- [ ] LOC-#### · Demo · P0 · S · Demo string freeze — Ch1–2 English locked 8 weeks before the Next Fest press preview; later changes need producer approval and are logged in `docs/loc/string-changes.md` with affected languages
- [ ] LOC-#### · Demo · P1 · S · Translator query sheet — Q&A in the TMS with a 48 h answer SLA; answers promoted into key notes so the question is not asked twice
- [ ] LOC-#### · Demo · P1 · S · Continuous loc builds — nightly build with the latest approved translations pushed to a password-protected Steam `loc` branch for reviewers
- [ ] LOC-#### · Demo · P1 · S · LQA bug template & checklist — truncation, overlap, glossary, grammar/agreement, register, fallback glyphs, untranslated text, placeholder errors; severity mapped to the QA taxonomy; `loc` + language labels
- [ ] LOC-#### · Demo · P1 · S · LQA navigation — debug commands `lang <code>`, `story <id>`, `op <id>`, `phase <n>` and a pause-menu language switch let a reviewer reach any Ch1–2 line in ≤ 30 s (timed on 10 random keys)
