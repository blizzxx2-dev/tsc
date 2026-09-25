# Milestone gates

Every gate is a 60-minute meeting with a written record appended to this file (date, attendees,
evidence, **go / go with conditions / no-go**, carry-over list). Criteria come from
[definition-of-done.md](definition-of-done.md); dates from [schedule.md](schedule.md). Each gate is
followed by a milestone retrospective ([cadence.md](cadence.md#milestone-retrospectives-ops-0006)).

---

## M0

**Date:** Friday 9 October 2026 · **Decides:** Owner · **Criteria (OPS-0015):** Chapter 1 (op1-1…op1-5
+ Matins) playable from the title; bot winnability tests and smoke green; prototype retro held;
go/no-go and carry-over list recorded.

### Evidence collected 2026-09-25 (pre-read)

| Criterion | Evidence | State |
|---|---|---|
| Chapter I playable from the title | `src/content/campaign.ts` runs Prologue → op1-1 … op1-5 (The Hour of Matins) → Chapter II; title → *Take the Oath* reaches op1-1 | met |
| Bot winnability | `npx vitest run`: `tests/operations.test.ts` (10 ops) and `tests/balance.test.ts` (steady + novice) pass — 64 tests passed, 1 skipped | met |
| Type check | `npx tsc --noEmit` clean | met |
| Smoke | `node scripts/smoke.mjs` does not complete in this environment (hard-coded preview port; also always exits 0 — owned by QAT-A tasks) | **open — QAT** |
| Prototype retro | not yet held | **open — schedule 9 Oct** |

### Record (to complete at the gate)
- Attendees: …
- Outcome: go / go with conditions / no-go
- Carry-over list: smoke script fixed and green (QAT); …

---

## Demo go/no-go

**Date:** Monday 18 January 2027 (three weeks before the 8 Feb press preview) · **Decides:** Owner with
QA lead, Loc lead, Marketing lead · **Criteria (OPS-0019):**

| Area | Go condition | Evidence |
|---|---|---|
| QA | RC1 on `qa` since 11 Jan; 0 open S1; S2 trend falling with fixes scheduled before 5 Feb | Bug dashboard, QA sign-off draft |
| Legal | Counsel clearance on file: title/trademark opinion, name register, trade-dress memo actions closed; privacy notice live | `docs/legal/` |
| Store | Store page live since 17 Nov; demo page drafted with screenshots; content survey and AI disclosure answered | Steamworks |
| Content survey | Steamworks mature-content survey matches the demo build | [ratings/steam-content-survey.md](ratings/steam-content-survey.md) |
| Next Fest | Registration confirmed; press/creator lists ready; trailer locked | [nextfest/plan.md](nextfest/plan.md) |
| Localisation | Every core language in LQA with no open S1; sign-off expected by 1 Feb | [docs/loc/process.md](../loc/process.md) |

**No-go** triggers the fallback edition plan ([nextfest/plan.md § fallback](nextfest/plan.md#fallback-plan-ops-0027)).
The outcome and the chosen edition are recorded here and in the decision log.

---

## Alpha

**Date:** 2 July 2027 · Criteria in [definition-of-done.md § Alpha](definition-of-done.md#alpha-ops-0020).

## Beta

**Date:** 27 August 2027 · Criteria in [definition-of-done.md § Beta](definition-of-done.md#beta-ops-0021).

## Release candidate

**Date:** 24 September 2027 · **Criteria (OPS-0022):** 0 open S1/S2; certification checklist (PLT)
passed; rating certificates on file for every territory that requires one
([ratings/territories.md](ratings/territories.md)); store page approved; launch communications
scheduled ([release/launch-checklist.md](release/launch-checklist.md)); **RC build SHA recorded here**.

## Gold master

**Date:** 8 October 2027 · **Criteria (OPS-0023):** build locked; day-one patch contents frozen
([release/launch-checklist.md#day-one-patch-plan-ops-0137](release/launch-checklist.md#day-one-patch-plan-ops-0137)); rollback build identified (previous RC on the
`rollback` branch); launch rota staffed for launch day +7; **signed by the Owner and the QA lead** in
this file.
