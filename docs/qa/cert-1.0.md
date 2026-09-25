# 1.0 certification checklist (QAT-0165)

Extends `docs/qa/cert-demo.md`: **every row of the demo checklist applies again to the full game** (re-verify with
1.0 evidence — do not carry demo evidence over), plus the rows below. Every row needs ✅ and an evidence link
before the 1.0 RC sign-off (`node scripts/qa/signoff.mjs 1.0-rc`).

## Achievements (PLT)

| # | Requirement | Owner | Status | Evidence |
|---|---|---|---|---|
| F-01 | Every achievement unlocks through normal play exactly once, including offline (queued) | PLT | ⏳ | |
| F-02 | Achievement names/descriptions/icons localised for every shipped language | LOC | ⏳ | |
| F-03 | No achievement requires cheats, the console or a specific hardware device | GAM | ⏳ | |
| F-04 | Demo progress never unlocks full-game achievements unintentionally on import | PLT | ⏳ | |

## Leaderboards (PLT, GAM)

| # | Requirement | Owner | Status | Evidence |
|---|---|---|---|---|
| F-05 | Every challenge op uploads to its leaderboard; ties and personal bests handled | PLT | ⏳ | QAT-0162 suite |
| F-06 | Offline scores queue and upload later | PLT | ⏳ | |
| F-07 | Implausible scores (> 1.1 × expert-bot par) flagged before the replay check | GAM | ⏳ | |

## Cloud and saves (PLT)

| # | Requirement | Owner | Status | Evidence |
|---|---|---|---|---|
| F-08 | Cloud round trip across two PCs and a Deck for every chapter | PLT | ⏳ | |
| F-09 | Demo carry-over save imports into the full game (Chapter III starts, demo bests kept) | PLT | ⏳ | TC-SAVE-007 |
| F-10 | Saves from every public beta/Playtest build upgrade without loss | PLT | ⏳ | |

## Steam Deck (INP)

| # | Requirement | Owner | Status | Evidence |
|---|---|---|---|---|
| F-11 | Deck Verified checks for all five chapters, all disciplines and challenge mode | INP | ⏳ | |
| F-12 | Performance budget met on the worst scene of every chapter | ENG | ⏳ | perf captures |

## Store (OPS)

| # | Requirement | Owner | Status | Evidence |
|---|---|---|---|---|
| F-13 | Store page: release date, price, regional pricing, languages table matches the build | OPS | ⏳ | |
| F-14 | Screenshots/trailer from the 1.0 build; system requirements verified on the matrix | OPS/QA | ⏳ | |
| F-15 | Age ratings (IARC etc.) obtained and shown where required | OPS | ⏳ | |
| F-16 | Demo updated or retired consistently with 1.0 (carry-over prompt, store link) | OPS | ⏳ | |
| F-17 | Launch-day patch plan and known-issues list ready | QA | ⏳ | `docs/qa/patch-regression.md`, `docs/qa/known-issues.md` |
