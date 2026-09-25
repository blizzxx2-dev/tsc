# Patch regression checklists

## Demo hotfix — 60-minute smoke (QAT-0148)

Run on **every demo hotfix** on the packaged build from the Steam `qa` branch, before it goes live, on one Windows PC
and one Steam Deck (the second device can run in parallel). Automated CI (qa-ci) must already be green on the commit.
Tick every row; any failure blocks the hotfix.

| # | Check | Min | How |
|---|---|---:|---|
| 1 | **Boot**: cold launch from Steam, title appears, no error dialog, build id on screen matches the hotfix | 3 | Steam library → Play |
| 2 | **The fix itself**: the reported bug no longer reproduces with its original steps / F8 replay | 10 | the issue's steps |
| 3 | **op1-1**: new game → prologue → op1-1 won → results → s1-2 | 8 | real play |
| 4 | **Matins**: `pre-matins` save (or console on the qa build) → op1-5 won including the shards phase | 12 | real play |
| 5 | **Lauds**: `pre-lauds` save → op2-5 won including the Lens hunt | 12 | real play |
| 6 | **Save/resume**: quit mid-op1-3 and mid-story; relaunch → Continue lands on the op's briefing / the story step | 5 | TC-SAVE-001 sample |
| 7 | **Demo end**: finish op2-5 → s2-end → demo-complete; wishlist opens the store in the overlay | 5 | TC-END-001/002 |
| 8 | **Language switch**: switch to each shipped language on title and in a story line; no missing text | 5 | TC-OPT-010 |
| | **Total** | **60** | |

Record: build id, tester, device, pass/fail per row, and the time taken, in the hotfix PR.

## Post-launch patch — automated suites + 2-hour manual checklist (QAT-0168)

For every 1.x patch and hotfix of the full game. Attach the results to the patch-notes PR.

**Automated (must be green on the release commit):** qa-ci (lint, unit + characterisation, sim bots/balance/fuzz,
builds + debug-strip gate, smoke, E2E), the latest qa-nightly (E2E + visual, benchmarks), secret scan.

**Manual (≈ 2 h, one tester, packaged build from the `qa` branch):**

| # | Check | Min |
|---|---|---:|
| 1 | Boot, title, build id; options persist from the previous version | 5 |
| 2 | Every fixed issue in the patch notes verified with its original steps / replay | 25 |
| 3 | Save upgrade: a save from the previous live version (all chapters in progress) loads, Continue lands correctly | 10 |
| 4 | Demo carry-over save still imports | 5 |
| 5 | One operation per chapter won (5 ops), incl. one Malison fight | 35 |
| 6 | One challenge-mode run with leaderboard upload | 10 |
| 7 | Achievements unlock (one per chapter), Cloud sync between two machines | 10 |
| 8 | Language switch across all shipped languages on one story scene | 10 |
| 9 | Steam Deck: boot, one op, suspend/resume | 10 |
| | **Total** | **120** |
