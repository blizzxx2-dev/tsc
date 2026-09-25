# Operation acceptance checklist

Every operation must pass these before it ships. Items marked **(auto)** are enforced by the test
suite; the rest are a reviewer's sign-off in the op's pull request.

| # | Check | How |
|---|---|---|
| 1 | Winnable with a perfect player | **(auto)** the steady bot wins — `tests/demo-checklist.test.ts`, `tests/balance.test.ts` |
| 2 | Loseable by a poor player; no softlock | **(auto)** a surgeon who does nothing loses before `timeLimit + 5 s` — `tests/demo-checklist.test.ts` (CON-0020) |
| 3 | Deterministic | **(auto)** two bot runs on one seed give identical score, vitals and time — `tests/demo-checklist.test.ts` (CON-0021) |
| 4 | Briefing present | **(auto)** `diagnosis` of more than 20 characters (shown on the chart) |
| 5 | Case note present | **(auto)** an aftermath scene for the op in `src/content/aftermath.ts`, or a story step straight after it |
| 6 | Rank thresholds from simulation | **(auto)** a row in `src/surgery/ranks.ts`, produced by `CALIBRATE=1 npx vitest run tests/balance.test.ts -t calibrate` |
| 7 | Callouts fit | **(auto)** callout labels ≤ 28 characters (`tests/narrative.test.ts`, NAR-0004); callout lines ≤ 180 characters so the panel wraps to at most three lines |
| 8 | Only introduced instruments | **(auto)** the tool schedule in `tests/demo-checklist.test.ts` (GAM-0205) |
| 9 | Every spawn is valid | **(auto)** `validateOp` in `src/content/schema.ts`: known entity ids, parameters in range, anchors on the field, each entity's instruments provided |
| 10 | Novice can finish | **(auto)** the novice-pace bot wins in `tests/balance.test.ts` |
| 11 | Readable at a glance | reviewer: a first-time player can name each target's instrument from the art and the target cursor |
| 12 | IP clean | **(auto)** the blocklist scan in `tests/ops.test.ts`; reviewer: the art bible's IP checklist |
