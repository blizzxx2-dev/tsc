# Demo release (OPS-0128 … OPS-0132)

## Demo launch comms checklist (OPS-0128) — Monday 15 Feb 2027
Ticked in the release issue and archived as `docs/production/release/demo-launch-<date>.md`.
- [ ] Demo build live on the default branch of the demo app (build id: ______); smoke-tested from a clean Steam install on Windows and Deck
- [ ] "Download Demo" button visible on the full-game page (logged-out browser check)
- [ ] Localised demo descriptions live in every signed-off language (LOC-0071)
- [ ] Steam announcement "The free demo is live" posted in all demo languages (LOC-0077)
- [ ] Discord `@everyone` ping in #announcements; socials posted with UTM links
- [ ] Press and creator emails sent (embargo lifts 15:00 UTC); key platform campaign switched to public
- [ ] Newsletter send
- [ ] Dashboards open and watched: Steamworks (installs, players, wishlists), crash reporting, Discord #bug-reports
- [ ] Hotfix rota staffed for the first 72 h (below)

## Demo hotfix policy (OPS-0129)
Decision D-0016. For the **first two weeks after release and throughout Next Fest**:
| Severity | Definition (QA taxonomy) | Fix shipped within |
|---|---|---|
| S1 | Crash, progression blocker, save loss, legal/rating problem | **24 h** |
| S2 | Major feature broken, severe visual/audio/loc defect on a common path | **72 h** |
| S3/S4 | Everything else | batched into the post-fest update |
Every update gets **patch notes on Steam** (English + demo languages within 48 h, LOC-0104 template)
and a line in the known-issues thread. A rollback build (previous public build) stays on a hidden
branch for instant revert.

## Two-week demo review (OPS-0130) — 1 Mar 2027
Compare against targets and record actions in the decision log:
| Metric | Target | Actual |
|---|---|---|
| Demo players (unique) | 15,000 | |
| Median playtime | ≥ 45 min | |
| Completion (reached demo-end screen) | ≥ 35 % of players | |
| Wishlist conversion (demo players who wishlisted) | ≥ 20 % | |
| Wishlists gained during fest | ≥ 16,000 (Feb target 25,000 total) | |
| Steam demo reviews / sentiment | ≥ 85 % positive | |

## Demo lifecycle (OPS-0131)
Decision D-0010: the demo stays available after 1.0, updated to the 1.0 build of Chapters I–II, with
carry-over messaging on the demo-end screen; retired only if telemetry shows demo players converting
worse than store visitors.

## Steam Playtest vs demo (OPS-0132)
Decision D-0011: Beta testing of Chapters III–V uses a **separate Steam Playtest app**. Access waves:
wave 1 — 200 invited (Discord *Playtester* role, NDA), June 2027; wave 2 — 1,000 by signup, July; wave 3 —
open signup capped at 5,000, August. Feedback through a pinned form and the bug template.
