# Update / DLC test plan — template (QAT-0169)

Copy this file to `docs/qa/plans/<release>.md` for every post-launch content update or DLC, fill it in, and link it
from the release's patch-notes PR.

## 1. Release

| | |
|---|---|
| Release | _e.g. 1.2 "The Office of Prime" free update / DLC "The Lazar-House"_ |
| Type | free update · paid DLC · both |
| Steam app / depot ids | |
| Build ids under test | |
| Owner (QA) | |

## 2. New content suites

For every new operation: TC-OP-001 … 011 rows (win, losses, retry, quit, Litany, hotkeys, rank seal, boss checks);
new story scenes: TC-STORY rows; new entities or Malison hours: characterisation snapshots + tool × entity matrix rows
added **before** tuning; new options/UI: TC-OPT/TC-FE rows; new achievements/leaderboards: cert-1.0 F-rows.

| New item | Suite rows (ids) | Automated coverage | Owner |
|---|---|---|---|
| | | | |

## 3. Saves with and without the DLC

| # | Scenario | Expected |
|---|---|---|
| 1 | Save from the previous version, DLC not owned | Loads; base campaign unchanged; DLC entry points show the store prompt |
| 2 | Same save, DLC owned | Loads; DLC content available at its intended entry point |
| 3 | Save made with the DLC, then DLC removed (refund / family sharing ended) | Loads without crash; DLC progress kept but inaccessible; base progress intact |
| 4 | Save made with the DLC on PC A, Cloud to PC B without the DLC | As 3, and re-owning restores access |

## 4. Ownership checks

| # | Scenario | Expected |
|---|---|---|
| 1 | Online, owned | Content unlocked |
| 2 | Offline mode, owned (previously verified online) | Content unlocked |
| 3 | Offline, never verified | Handled per PLT rule (grace or prompt) — no crash |
| 4 | Not owned, store link | Opens the DLC store page in the overlay |

## 5. Leaderboards unaffected

Existing leaderboards keep their entries and accept new scores; DLC ops get their own boards; no base-game score is
invalidated by the update (compare top-100 before/after on the staging branch).

## 6. Regression

Post-launch patch checklist (`docs/qa/patch-regression.md`) + qa-ci / qa-nightly green on the release commit.

## 7. Exit

0 open S1/S2 for the release; S3 list with owner sign-off; results attached to the patch-notes PR.
