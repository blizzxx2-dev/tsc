# Per-operation suite × 10 (QAT-0133)

Run the parameterised cases below for **each** demo operation: op1-1 *A Tavern Knife*, op1-2 *The Barbed Shaft*,
op1-3 *Powder Burns*, op1-4 *Pestilent Humours*, op1-5 *The Hour of Matins* (boss), op2-1 *Gravehound*, op2-2 *The
Black Seam*, op2-3 (egg sacs), op2-4 *The Silenced Cantor*, op2-5 *The Hour of Lauds* (boss). Quick access:
console `op <id> go`; loss setups with `vitals 5` / `time 5`.

Record one row per op per case in the run sheet. Minutes are per operation (the regression total counts ×10).

<!-- multiplier: 10 -->

| ID | Title | Pri | Tags | Min | Steps → Expected | Auto |
|---|---|---|---|---|---|---|
| TC-OP-001 | Win | P0 | regression | 6 | Play the op to the end → "The operation is complete.", bell, results show "The patient lives.", score = ratings + vitals×20 + time×10 | sim bots (every op), smoke |
| TC-OP-002 | Loss by vitals | P0 | full | 2 | `vitals 5`, keep working → flatline once, results "The patient was lost.", no bonus, Try Again offered | rule tests (loss states) |
| TC-OP-003 | Loss by timer | P0 | full | 2 | `time 5` → at 0:00 "Time has run out.", timer shows 0:00 not negative | rule tests (loss states) |
| TC-OP-004 | Retry | P0 | full | 2 | After a loss, Try Again → the op restarts from the intro with the same layout (same seed), full vitals, timer reset | e2e retry flow |
| TC-OP-005 | Quit mid-op | P0 | full | 2 | Esc → Abandon the Patient → title; Continue → this op's briefing; no partial result recorded | e2e continue/resume |
| TC-OP-006 | Alt-tab mid-op | P1 | full | 2 | Alt-tab away mid-drag and back → no stuck button, the op is paused (or the drag released), no penalty for the lost frames | |
| TC-OP-007 | Litany used / unused | P0 | regression | 3 | Ops with the Litany: draw the star (right mouse) → 8 s of slowed world, timer frozen, once only; second star says "The Litany is spent."; ops without it (op1-1…op1-4) never trigger it | rule tests (Litany) |
| TC-OP-008 | Every hotkey and wheel switch | P0 | full | 2 | Keys 1–8, Q/E, mouse wheel and Tab quick-swap select only this op's tools; tray highlights the selection; switching mid-drag releases the grip | rule tests (tool selection), e2e locale |
| TC-OP-009 | Rank seal and NEW BEST | P0 | full | 2 | Win twice, the second better → results stamp the rank seal and "A new best!"; a worse result does not overwrite the best in the Operating Theatre | save helper tests |
| TC-OP-010 | Tutorial callouts and hints | P1 | full | 2 | Phase callouts appear in order and stay readable (≥ 2.4 s); misuse hints (e.g. brand on flesh, stitching through blood) appear once | rule tests (callouts), tool matrix |
| TC-OP-011 | Boss-specific checks (op1-5, op2-5 only) | P0 | regression | 5 ×2 | Matins: shroud rhythm, veiled brand does nothing, hexlings at 75/50/25 %, shards must be cast out before they rejoin. Lauds: Voices shield the heart, Hymn cuts, submerge → Lens hunt, hexstone shards | matins/lauds snapshots |
| TC-OP-012 | Smoke win: op1-1, op1-5 (Matins), op2-5 (Lauds) | P0 | smoke | 6 ×3 | Play each to a win with default settings → results screen, rank recorded, no errors | smoke script |

Op-specific notes: op1-2 barbed arrow must be nicked twice before pulling (tearing it is BAD, −8, big wound); op2-2
shards are hidden until the Scrying Lens lingers; op2-3 egg sacs hatch if left (MISS, −6, spiderlings); op2-4 sigils
lash every 4.5 s; op1-3 starts at 70 vitals.
