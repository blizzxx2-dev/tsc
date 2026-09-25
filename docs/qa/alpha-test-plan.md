# Alpha test plan — full campaign, placeholder art (QAT-0151)

Alpha goal (brief): every core system feature-complete; Chapters I–V playable end to end with placeholder art/audio.

## Scope

| Area | New for Alpha | Suites |
|---|---|---|
| Chapters III–V | ops, stories and the Malisons of Prime, Terce, Sext, None, Vespers, Compline | Chapter functional passes (QAT-0152 … 0154); characterisation snapshots per new entity and hour (QAT-0048) |
| Campaign graph | five chapters, unlocks, demo carry-over landing on Chapter III, challenge-mode entries | campaign graph checks (QAT-0155) |
| Operation editor | `?editor=1` dev tool | editor suites (QAT-0079 … 0085) |
| Everything from the demo | — | demo suites re-run as regression (`docs/qa/cases`, `regression` tag) |

Out of scope: final art/audio/VO, localisation beyond pseudo-loc, platform certification.

## Entry criteria

- All five chapters reachable in a debug build (`chapter <n>` in the console) and every op winnable by the sim bot
  (`tests/operations.test.ts` extended to all chapters, green).
- Characterisation snapshots exist for every Chapter III–V entity and Malison hour before its first tuning pass.
- No open S1 from the demo.

## New suites for Chapters III–V

For each chapter: every op won, lost by vitals, lost by timer and retried (TC-OP-001…005 parameterised per op);
story scenes read through with flags checked; the chapter's Malison boss checks written as TC-OP-011 rows (phases,
gimmick, failure modes); END OF CHAPTER card; save/resume at every step boundary sampled.

Campaign graph checks (automated): every chapter reachable from the previous one; unlocks chain (a chapter's first
step follows the previous chapter's last); challenge-mode entries reference existing op ids; a demo-complete save
lands on Chapter III step 0 in the full game.

## Exit criteria

- Every op of Chapters I–V won by the bot and by a human tester at least once; no S1 open; S2 ≤ 10 with owners.
- Alpha playtest round (QAT-0126) completed: chapter completion and session length per chapter measured.
- Characterisation snapshots for all entities; tool × entity matrix regenerated and reviewed with GAM.
