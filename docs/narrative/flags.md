# Campaign flags (CON-0008, CON-0093, NAR-0116/0131/0145)

Named values the story writes and reads back later. They live on the save profile (`Profile.flags`,
schema v3, `src/core/save/schema.ts`): persisted with every autosave, **cleared by New Game**, and
**carried from the demo into the full game** verbatim by the demo import (`src/platform/carryover.ts`).
Code: `src/content/flags.ts` (`flags.get / set / has / truthy / count`), conditions on lines and steps
(`src/content/story.ts`, `src/content/campaign.ts`), audit test `tests/unit/content/flags.test.ts`.

## Rules
- Keys are stable content ids, like op and scene ids: never rename a shipped flag (the demo save carries it).
- Values: `boolean`, finite `number` or `string` ≤ 200 chars; keys ≤ 64 chars; ≤ 500 flags. Anything else is dropped on load.
- Every choice line also records its pick as `choice.<sceneId>` (the option's `id`), `choice.<sceneId>.2` for a
  second choice in the same scene. Reserved prefix: `choice.`.
- Each chapter declares `flags: { reads, writes }`. The audit test checks that declared writes match what the
  chapter's choices and operations actually write, that declared reads cover every declarative `if` in the chapter,
  and that **every read is written somewhere** (a chapter, or the engine).
- Line conditions (`onlyIf`) are evaluated live in the scene, so a choice earlier in the same scene counts;
  step conditions (`if` on a campaign step, CON-0007) are evaluated when the step would start, and a closed step is
  skipped without changing later step indices (save positions and the content-id table are unaffected).

## Flags

| Flag | Type | Written by | Read by |
|---|---|---|---|
| `cantorMercy` | boolean | s2-4 choice (NAR-0062): `true` — Kreuzer treats the cantor as a patient, poppy for the pain; `false` — keeps him alive *and awake* for Stroh | s2-4 (Stroh's reply), s3-1 (the cantor's fate), Ch5 |
| `litanySeenCount` | number | **engine** (`src/scenes/flow.ts`): +1 for every campaign operation *won* with the Litany spoken | s3-1 (Stroh's candles, ≥ 2), Ch5 |
| `guildMarks`, `guildOps` | number | **engine** (`src/scenes/flow.ts`, `noteGuildRank`): each Chapter I–III campaign win adds its rank points (XS 4, S 3, A 2, B 1, C 0) and 1 | s3-9 licence vote (NAR-0126): average ≥ 2 (A) keeps the licence, below suspends it |
| `ch1Marks`…`ch5Marks`, `ch1Ops`…`ch5Ops` | number | **engine** (`noteGuildRank`): each chapter's campaign wins, rank points and count | Ilse's side scenes (NAR-0097): the end of s3-end and s4-end, and s5-9b, on an A average for that chapter |
| `hornchildFinding` | `'turned' \| 'natural'` | the Liesl interview's conclusion (CON-0233) | s3-2 (what the bone showed) |
| `foundersVerdict` | `'lead' \| 'curse'` | the Founders' Guild inquiry (CON-0234) | op3-3 (`vitals` 75 on `'curse'`) |
| `trialRebuttals` | number | the trial's cross-examination (CON-0235): charges rebutted | `trialEvidence` (−1 each) |
| `predecessorFinding` | `'prime' \| 'natural'` | the Registrar's predecessor examination (CON-0244) | — (record) |
| `coachmanFinding` | `'choir' \| 'robbery'` | the Widow's coachman examination (CON-0245) | s4-8 (Stroh names the carriage) |
| `kilnrowsSaved` | number | the Kilnrows blast triage (CON-0228, tr3-kilnrows): patients saved, of 8 | s3-4 (Ilse's day-book, 7+) |
| `fordSaved` | number | the ford triage (CON-0228, tr4-ford): patients saved, of 8 | s4-2 (Mauer's count, 7+) |
| `hollowSaved` | number | the Penny Stair triage (CON-0228, tr5-hollow): patients saved, of 8 | s5-5 (the Stair behind them, 7+) |
| `choice.s2-4` | `'mercy' \| 'awake'` | s2-4 pick record | tools, tests |
| `hornchildCertificate` | `'natural' \| 'turned'` | s3-2 choice (NAR-0119): the kind lie or the true sentence | s3-2 (the rest of the scene), Ch4, Ch5 |
| `choice.s3-2` | `'natural' \| 'turned'` | s3-2 pick record | tools, tests |
| `strohTooth` | boolean | winning op3-9 (CON-0129, `OP_FLAG_WRITES` in `src/content/flags.ts`) | Ch5 |
| `hallerFate` | `'hands' \| 'scarred'` (`'lost'` only in old saves) | winning op3-11 by rank: XS/S/A → `hands` (he keeps them, advises by letter), B/C → `scarred` (maimed and bitter); never a death (CON-0136, NAR-0100) | Ch4, Ch5 |
| `thirstChoice` | `'salve' \| 'brand'` | s4-6 choice (NAR-0137) | Ch5 |
| `strohToothFine` | boolean | winning op3-9 at XS/S (NAR-0102) | Ch5 (Stroh's trust) |
| `mauerFate` | `'hale' \| 'maimed'` | winning op4-7 by rank: C → `maimed`, else `hale` (NAR-0105) | Ch5 (ending matrix) |
| `deadManVerdict` | `'entranced' \| 'dead'` | s4-5 choice (NAR-0136): restart von Salm's heart, or certify him dead for the Tribunal; a dead verdict is examined by candle (fo4-salm, CON-0243), which can overturn it | op4-5 step (closed on `'dead'`), Stroh's trust |
| `choice.s4-5` | `'entranced' \| 'dead'` | s4-5 pick record | tools, tests |
| `trialAnswer` | `'confess' \| 'deny'` | s5-2 choice (NAR-0147): owning the Litany under oath, or denying it | s5-2 (the prosecutor's reply), Stroh's trust (+1 on confess), the trial evidence and verdict (s5-3, the pardon ending) |
| `choice.s5-2` | `'confess' \| 'deny'` | s5-2 pick record | tools, tests |
| `choice.s4-6` | `'salve' \| 'brand'` | s4-6 pick record | tools, tests |

Derived, not stored (src/content/whisper.ts, src/content/endings.ts):
- **Whisper band** (NAR-0093): `litanySeenCount` + 2 for `hornchildCertificate` = `'natural'`; 0 Unremarked, 1–2 Noted, 3–4 Suspected, 5+ Accused.
- **`strohTrust`** (NAR-0104): `cantorMercy` false +1; certificate `'turned'` +1 / `'natural'` −2; `strohTooth` +1; `strohToothFine` +1; `deadManVerdict` = `'dead'` +1; −1 per 2 of `litanySeenCount`. Read by the ending and, at ≥ 1, by s4-8 (the charter lapse) and s4-end (Stroh's own protective warrant instead of the council's).
- **Ending** (NAR-0158), for a won finale: *pardon* if trust ≥ 2, or trust ≥ 1 with the Whisper short of Accused and no lie on the certificate; else *pyre refused* if the Whisper is short of Accused and `mauerFate` is `hale` or `hallerFate` is `hands`; else *exile*. Losing the finale plays *the Perfect End*.

Derived, not stored: the **demo total rank** Chapter III cares about (NAR-0116) is computed from `Profile.best`
over `op1-1`…`op2-5`, which the demo import already carries.

## Not yet written (declared nowhere, so no chapter may read them yet)
`charterRevealed` and `deadManVerdict` (Chapter IV beats, NAR-0131). Add each to the writing chapter's `writes` when
its scene or operation is authored; the audit test fails on a read without a writer. `strohTrust`, the Whisper band
and the ending are derived (above), never stored.

## Carry-over contract (CON-0093)
The demo profile's `flags` object is copied as is into the fresh full-game profile (`importDemoProfile`); the report
lists the carried keys. Together with `best` (per-op best rank/score mapped through the content-id table) this is
the whole carry-over: `cantorMercy`, `choice.s2-4`, `litanySeenCount`, per-op best rank.

## The trial (NAR-0147, NAR-0148)

`trialEvidence` (`src/content/endings.ts`): min(`litanySeenCount`, 3); certificate `'natural'` +2, `'turned'` +1
(Liesl's mother testifies for the prosecution); denying under oath +1 if anyone saw the Litany, −1 if nobody did;
Stroh's trust ≤ 0 +2 (he enters his ledger), ≥ 2 −2 (he testifies for the defence); `mauerFate` `'hale'` −1;
`hallerFate` `'hands'` −1. `trialVerdict`: **acquitted** when trust ≥ 2 and evidence ≤ 1 (always the pardon
ending; the council holds him under the court anyway, and Stroh lets Orsa's tunnel take him); otherwise
convicted and **rescued** by Mauer's Watch if the captain is hale, else **tunnelled** out by Orsa.

## Compline's host (NAR-0155, CON-0199)

`complineHost`: **Stroh**, unless his trust is ≤ 0 — he prosecuted, and sits with the council drafting the
sentence — then **the Burgomaster**. s5-9b, s5-10 and s5-12 name the host; op5-8's patient string follows it
(the fight is unchanged). With the Burgomaster on the table, Stroh comes down the crypt stair afterwards to
arrest the Precentor. The pardon needs trust ≥ 1, so it always has Stroh as the host.

