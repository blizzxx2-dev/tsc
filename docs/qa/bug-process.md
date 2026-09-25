# Bug process — Suture & Steel

Owner: QA. Applies to the demo (Chapters I–II) and the full game. Automation lives in
`.github/workflows/qa-*.yml` and `scripts/qa/`; issue forms in `.github/ISSUE_TEMPLATE/`.

## 1. Severity (QAT-0086)

Severity describes the damage to the player, not the effort to fix. Priority (P0–P3) is set at triage.

| Sev | Definition | Examples from this game |
|---|---|---|
| **S1** | Crash or hang, save loss or corruption, progression block, or a legal/compliance breach | Game closes when the Matins shards rejoin; the save resets after quitting mid-operation; op2-2's hidden shards never surface under the Lens so the phase never ends; Continue lands on a step that no longer exists after an update; the fatal "needs WebGL2" screen on a supported GPU; the demo reaches Chapter III content |
| **S2** | A major feature is broken and there is no workaround | The Litany star is never recognised; Gut Thread stitches never count on a laceration; a tool hotkey selects the wrong tool; the results screen shows the wrong rank for the score (see `tests/fixtures/rank-table.ts`); Options do not persist after restart; the wishlist button does nothing with the Steam overlay on |
| **S3** | A workaround exists, or the defect is clearly visible to most players | "Searing healthy flesh" warning fires the frame a grub dies under the brand; a callout overlaps the tool tray at 1280×720; a burst bubo's MISS is not shown as a popup; the Lauds Hymn ring draws over the HUD; retrying an operation keeps the previous attempt's blood stains |
| **S4** | Cosmetic, no effect on play | A typo in a story line; a sigil glow one pixel off its stroke; a slightly late stitch sound; misaligned drop shadow on the case record |

Rules of thumb: anything that loses the player's time (progress, a won operation, settings) is at least S2;
anything that can make an operation unwinnable is S1; accessibility options that fail are S2.

## 2. Labels and board (QAT-0087)

Labels are defined in `.github/labels.json` and synced by the *QA triage* workflow on every change.

- Severity: `S1` `S2` `S3` `S4`
- Area: `area:sim` `area:render` `area:audio` `area:ui` `area:story` `area:loc` `area:input` `area:save` `area:platform` `area:perf` `area:legal`
- Build: `found-in` / `fixed-in` (the build id itself goes in the issue form / closing comment, e.g. `0.3.1+a1b2c3d4`)
- Reproduction: `repro:always` `repro:often` `repro:rare` `repro:once`
- Source: `playtest` `community` · Kind: `regression` `flaky` `nightly` `perf-regression`
- Process: `triaged` `verified` `sla-breach` `needs-replay` `known-issue` `behaviour-change`

Board (GitHub Project "Suture & Steel bugs"), one column per state:

| Column | Enters when | Leaves when |
|---|---|---|
| **New** | Issue filed (form) | Triage sets severity, area, repro and owner, adds `triaged` |
| **Triaged** | `triaged` | The owner starts work |
| **In progress** | Branch/PR open | The fix is merged |
| **Fixed** | PR merged (`fixed-in` set) | QA verifies in the fixed-in build |
| **Verified** | QA confirms in a build, adds `verified` | Closed |

## 3. Triage (QAT-0089)

- Twice weekly (Tuesday and Friday), 30 minutes: QA lead, one engineer, the producer; GAM joins for `area:sim`.
- Every New issue leaves triage with severity, area, repro rate, owner and milestone — or is closed with a reason.
- **SLA:** S1 acknowledged within **24 h**, S2 within **72 h** (acknowledged = `triaged` label, an assignee, or a
  maintainer comment). The hourly *QA triage* job labels breaches `sla-breach` and comments once.
- The weekly metrics job (Mondays) writes `reports/qa-metrics.md` with the find-vs-fix trend chart for the sprint review.

## 4. Replay-first for gameplay bugs (QAT-0058)

S1/S2 gameplay bugs carry the PLT/INP **F8 bundle** (log, settings, build id and the input replay) or a sentence
starting "No replay because …". Triage re-simulates the replay to confirm the repro before assigning it. The
*QA policy* PR check refuses a fix PR that closes an `area:sim` S1/S2 issue without one.

## 5. Regression policy (QAT-0090)

Every fixed **S1/S2** gains an automated test, characterisation snapshot or golden replay before it can move to
**Verified**. The *QA policy* check fails a PR that closes an S1/S2 issue without touching `tests/`.
Changes to characterisation snapshots, `docs/qa/tool-entity-matrix.md` or golden replays need the
`behaviour-change` label and a GAM review (CODEOWNERS).

## 6. Known issues (QAT-0091)

`docs/qa/known-issues.md` is regenerated for each public build from open issues labelled `known-issue`
(player-facing wording, workaround, fixed-in once known). The producer pins it in the Steam discussions and
the Discord #known-issues channel whenever a build goes live (see the hand-off).

## 7. QA metrics (QAT-0092)

Weekly, from `scripts/qa/bug-metrics.mjs` (job *QA triage → metrics*): open bugs by severity and area, found vs
fixed per week, reopen rate, escaped defects (first reported by players, `community`) per build. Pasted into the
weekly status note.

## 8. Community bug intake (QAT-0093)

Weekly (Wednesday), the community manager and QA sweep Discord **#bug-reports** and the Steam **Bug Reports**
forum: each distinct report becomes a GitHub issue through the bug form with the `community` label, the original
post linked, and severity set at the next triage. The reporter gets a reply linking the public known-issues entry
and, when it ships, the fix version. Reply template:

> Thanks — we've logged this as a bug and it's on our list (ref #123). We'll post here when a fix ships; until
> then, the known-issues page has any workaround.
