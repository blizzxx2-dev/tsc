# Releasing Suture & Steel

## Git branches and tags (PLT-0147)

| Branch / tag | Purpose | Rules |
|---|---|---|
| `main` | development | PRs only; required checks `ci / web` and `ci / desktop-linux`; 1 review |
| `release/demo-1.x` | demo hotfixes after demo 1.0 | cut from the `demo-v1.0.0` tag; **cherry-picks from `main` only**, no direct feature work; 1 review + platform lead |
| `release/1.x` | full game after the Release Candidate (PLT-0152) | same rules as the demo branch, plus code freeze |
| `demo-vX.Y.Z`, `full-vX.Y.Z` | annotated release tags | created only by the `release` workflow |

Versions: `versions.json` (demo `1.0.x` after launch, full `0.x` until 1.0). Build id `version+sha.date` appears on the
title screen, in logs and in crash reports.

## Steam branches (PLT-0053)

| Steam branch | Password | Fed by | Audience |
|---|---|---|---|
| `qa` | yes (rotated per milestone, in the team vault) | `nightly` workflow, every night | team + QA |
| `beta` | yes for demo; public opt-in for full after launch | `release` workflow (release candidates) | QA, press, trusted testers |
| `default` | — | **manual promotion only** in Steamworks | everyone |

Scripts never set `default` live (`scripts/steam-config.mjs` refuses `--branch=default`).

## Cutting a release

1. Actions → **release** → edition `demo`, bump `patch|minor|major|x.y.z`. Run it from `release/demo-1.x` for hotfixes.
2. The workflow bumps `versions.json`, tags `demo-vX.Y.Z`, builds the Windows/macOS/Linux matrix (signed, notarised,
   symbols + source maps uploaded), uploads to Steam `beta`, and opens an issue containing the checklist below and a
   patch-notes draft (`scripts/changelog.mjs`).

## Smoke on each OS

Install from the Steam client on clean machines (no dev tools), branch `beta`:

- [ ] Windows 11 — launches, title shows the new build id, play op I-1 to results, Steam overlay (Shift+Tab) opens, achievement pops
- [ ] Windows 10 1809+ — launches, no SmartScreen warning (signed), op I-1
- [ ] macOS 14 arm64 — launches without Gatekeeper prompt, native (not Rosetta), op I-1, Cmd+Q mid-op asks to confirm
- [ ] Ubuntu 22.04 — launches (X11 and Wayland), op I-1
- [ ] Steam Deck — launches in Game Mode at 1280×800, trackpad cursor works, suspend/resume mid-operation
- [ ] Cloud: quit on one machine, launch on another → same progress
- [ ] Crash dashboard shows the new release and no new crash signatures after 30 minutes of play

## Promote

1. Steamworks → SteamPipe → Builds → set the build live on `default` (demo app and/or full app).
2. Publish the patch notes (Steam event) from the draft in the release issue.
3. Watch the crash dashboard for 2 hours; demo launch gate: ≥99.5 % crash-free sessions on `beta` before promotion.

**Rollback:** Steamworks → Builds → select the previous build → *Set build live* on `default`. Takes effect within
minutes; no re-upload needed. Then fix forward on the release branch.

## Festival hotfix pipeline (target ≤ 4 h, PLT-0071)

| Step | Owner | Target |
|---|---|---|
| Fix on `release/demo-1.x` (cherry-pick if already on `main`), PR reviewed | dev | 1 h |
| `release` workflow (build, sign, notarise, upload to `beta`) | CI | 45 min |
| Smoke on Windows, macOS, Linux + Deck (checklist above, op I-1 + the fixed path) | QA | 1 h |
| Promote to `default`, post patch note | platform lead | 15 min |

Rehearse once before each festival and record the timings in the release issue.
