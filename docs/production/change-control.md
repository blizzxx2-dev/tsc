# Change control

Decision D-0021 · Owner: Producer.

## Locks
| Lock | Date | After the lock, only… |
|---|---|---|
| **Demo feature lock** (OPS-0017) | 11 Dec 2026 | content, polish and bug fixes merge; no new systems or options |
| **Demo content lock** (OPS-0018) | 11 Dec 2026 (same day as the NAR demo script lock and the loc string freeze) | triage-approved bug fixes to Ch1–2 operation data and English strings |
| Full-game script lock / UI string freeze (LOC-0098) | 30 Jul 2027 | triage-approved fixes |
| Gold master | 8 Oct 2027 | day-one patch items already listed in [release/launch-checklist.md#day-one-patch-plan-ops-0137](release/launch-checklist.md#day-one-patch-plan-ops-0137) |

## Exception procedure (after a lock)
1. The requester opens an issue labelled `change-request` naming the addition, its size (S/M/L) and why it
   cannot wait for the next phase.
2. It must name an **equal-or-larger cut** (same size points or more) from the same phase.
3. The producer and the owner approve or reject within two working days; approval is a decision-log
   entry (`D-xxxx`), and the cut item is moved into [cut-list.md](cut-list.md) with the phase it moves to.
4. A string change after the string freeze also needs the loc lead's approval and is batched into the
   next translation handoff (`npm run i18n:wordcount` shows the delta).

## Scope reviews
Triggered by: a SCOPE REVIEW flag in the burn-up, the sustainable-pace rule (two weeks > 45 h), or a
risk crossing to critical. The producer brings a cut proposal ranked by the MoSCoW list
([moscow.md](moscow.md)) to the next planning; cuts go to [cut-list.md](cut-list.md).

## Beta cut-line review (OPS-0033)
At Beta start (5 Jul 2027) all remaining open Alpha/Beta features are ranked by value/cost; everything
below the line moves to `Post`, is recorded in [cut-list.md](cut-list.md), and the public roadmap is
updated in the same week.
