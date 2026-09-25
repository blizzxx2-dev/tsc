# Demo certification master checklist (QAT-0146)

Aggregates the Steamworks, Steam Deck, legal-screen and accessibility requirements owned by PLT, INP, UIX and OPS
into one list for the go/no-go gate. **Every row must be ✅ with an evidence link** (issue, CI run, screenshot, capture,
signed document) before the demo RC is set live; the sign-off (`docs/qa/signoff/demo-rc.md`) links this file.

Status: ✅ done · ❌ failing (link the bug) · ⏳ not verified yet. Owner = who provides the evidence; QA verifies.

## Steamworks (PLT, OPS)

| # | Requirement | Owner | Status | Evidence |
|---|---|---|---|---|
| S-01 | Demo app id set up as a separate free demo linked to the main app; store page shows "Download demo" | OPS | ⏳ | |
| S-02 | Build uploaded through SteamPipe to the default branch only after this checklist; `qa` branch used for testing | PLT | ⏳ | |
| S-03 | Launches through Steam; direct launch restarts via Steam (`SteamAPI_RestartAppIfNecessary`) | PLT | ⏳ | TC-STEAM-002 |
| S-04 | Steam overlay works in every scene (Shift+Tab), including over fullscreen | PLT | ⏳ | TC-AUD-004 |
| S-05 | Steam Cloud: save + settings in the Auto-Cloud/ISteamRemoteStorage paths, conflict dialog handled | PLT | ⏳ | TC-SAVE-006, TC-STEAM-006 |
| S-06 | Offline mode works | PLT | ⏳ | TC-STEAM-001 |
| S-07 | Wishlist button opens the full game's store page via the overlay (and the client when the overlay is off) | UIX | ⏳ | TC-END-002/003 |
| S-08 | Store assets: capsules, screenshots of the demo build, short description, "Demo" label, system requirements | OPS/ART | ⏳ | |
| S-09 | Content survey / mature content descriptors filled (gore, violence) and matching the build | OPS | ⏳ | |
| S-10 | No Chapter III–V content reachable or shipped in the demo depot | PLT | ⏳ | TC-END-004, demo bundle check |
| S-11 | Release build contains no debug API, console or cheat menu | QA | ✅ | CI `build` job: `scripts/qa/check-debug-stripped.mjs` |
| S-12 | Crash reporting enabled and consented as documented; symbols uploaded for the RC | PLT | ⏳ | |

## Steam Deck (INP, PLT) — aiming for "Verified"

| # | Requirement | Owner | Status | Evidence |
|---|---|---|---|---|
| D-01 | Default controller configuration covers every action (menus, all 8 tools, stitching, star gesture, pause) | INP | ⏳ | TC-STEAM-005 |
| D-02 | Controller glyphs shown (never keyboard/mouse prompts) when playing with Deck controls | UIX | ⏳ | TC-TUT-004 |
| D-03 | Native resolution 1280×800 supported; text ≥ 9 px at that resolution (UIX legibility table) | UIX | ⏳ | |
| D-04 | Never requires the on-screen keyboard or a mouse/touch-only interaction | INP | ⏳ | |
| D-05 | Launches with no launcher/compat errors in gaming mode; suspend/resume mid-op is safe | PLT | ⏳ | TC-STEAM-005 |
| D-06 | Performance budget met on Deck (`docs/qa/perf-protocol.md`) | ENG | ⏳ | |

## Legal screens and disclosures (OPS)

| # | Requirement | Owner | Status | Evidence |
|---|---|---|---|---|
| L-01 | Copyright and trademark notice on the title/credits; "Suture & Steel" name cleared | OPS | ⏳ | |
| L-02 | Third-party licences (OFL fonts, npm dependencies) listed in credits and shipped as a notices file | OPS | ⏳ | TC-FE-007 |
| L-03 | EULA / privacy policy accessible; telemetry is opt-in and matches the privacy policy (`docs/qa/telemetry/README.md`) | OPS | ⏳ | |
| L-04 | Photosensitivity warning shown before the first story scene; reduce-flashing option present | UIX | ⏳ | TC-OPT-006 |
| L-05 | Age-rating / content descriptors consistent with the store and the build | OPS | ⏳ | |
| L-06 | No Games Workshop or Atlus/SEGA names, marks or assets (OPS distance review) | OPS | ⏳ | |

## Accessibility (UIX)

| # | Requirement | Owner | Status | Evidence |
|---|---|---|---|---|
| A-01 | Assists: time allowed ×1.5/×2, Litany on Space; results marked "(assisted)" | UIX | ✅ | e2e options persistence (timer assist), TC-OPT-009 |
| A-02 | Screen shake off, reduced flashing | UIX | ⏳ | TC-OPT-005/006 |
| A-03 | Text size options without clipping | UIX | ⏳ | TC-OPT-007 |
| A-04 | Full remapping of keys and controller | INP | ⏳ | TC-OPT-011 |
| A-05 | Colour is never the only cue for ratings/state (COOL/GOOD/BAD/MISS text + shape) | UIX | ⏳ | |
| A-06 | Subtitles/callouts for all voiced lines, readable for ≥ 2.4 s | UIX | ✅ | rule test QAT-0029 (callout timing) |
| A-07 | Accessibility round findings triaged (QAT-0124) | QA | ⏳ | |

## QA gates

| # | Requirement | Owner | Status | Evidence |
|---|---|---|---|---|
| Q-01 | Exit criteria met (`docs/qa/demo-test-plan.md` § 5) | QA | ⏳ | sign-off |
| Q-02 | Secret scan clean on the RC commit; allow-list reviewed (`docs/qa/secret-scanning.md`) | QA | ⏳ | |
| Q-03 | Antivirus scan clean on the RC executables (QAT-0114) | QA | ⏳ | |
| Q-04 | Known-issues list published for the build (`docs/qa/known-issues.md`) | QA | ⏳ | |
