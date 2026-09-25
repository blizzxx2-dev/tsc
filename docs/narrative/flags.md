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
| `choice.s2-4` | `'mercy' \| 'awake'` | s2-4 pick record | tools, tests |
| `hornchildCertificate` | `'natural' \| 'turned'` | s3-2 choice (NAR-0119): the kind lie or the true sentence | s3-2 (the rest of the scene), Ch4, Ch5 |
| `choice.s3-2` | `'natural' \| 'turned'` | s3-2 pick record | tools, tests |
| `strohTooth` | boolean | winning op3-9 (CON-0129, `OP_FLAG_WRITES` in `src/content/flags.ts`) | Ch5 |
| `hallerFate` | `'hands' \| 'scarred' \| 'lost'` | winning op3-11 by rank: XS/S → `hands`, A/B → `scarred`, C → `lost` (CON-0136) | Ch4, Ch5 |
| `thirstChoice` | `'salve' \| 'brand'` | s4-6 choice (NAR-0137) | Ch5 |
| `choice.s4-6` | `'salve' \| 'brand'` | s4-6 pick record | tools, tests |

Derived, not stored: the **demo total rank** Chapter III cares about (NAR-0116) is computed from `Profile.best`
over `op1-1`…`op2-5`, which the demo import already carries.

## Not yet written (declared nowhere, so no chapter may read them yet)
`strohTrust`, `mauerFate`, `charterRevealed`, `deadManVerdict` (Chapter IV beats, NAR-0131) and the Chapter V
`ending` enum (NAR-0145). Add each to the writing chapter's `writes` when its scene or operation is authored; the
audit test fails on a read without a writer. The "Whisper" meter that NAR-0119 mentions is not a flag yet; when it
exists it should be a numeric flag (`whisper`) incremented by the choices that feed it.

## Carry-over contract (CON-0093)
The demo profile's `flags` object is copied as is into the fresh full-game profile (`importDemoProfile`); the report
lists the carried keys. Together with `best` (per-op best rank/score mapped through the content-id table) this is
the whole carry-over: `cantorMercy`, `choice.s2-4`, `litanySeenCount`, per-op best rank.
