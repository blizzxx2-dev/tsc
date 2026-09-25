# Mutation testing (QAT-0052)

StrykerJS (`stryker.config.mjs`) mutates the scoring core and runs the fast unit tests
(`vitest.mutation.config.ts`: rule tests, characterisation snapshots, tool × entity matrix) against every mutant.

```sh
npm run test:mutation                                   # src/surgery/operation.ts
MUTATE=src/surgery/entities.ts npm run test:mutation    # entities
```

Reports: `reports/mutation/index.html` and `mutation.json`. Target: **≥ 75 % on `operation.ts` by the demo RC**.

## Baseline (2026-09-25)

| File | Mutants | Killed | Timeout | Survived | No coverage | Score | Score of covered |
|---|---:|---:|---:|---:|---:|---:|---:|
| `operation.ts` — first run | 435 | 384 | 3 | 42 | 6 | 88.97 % | 90.21 % |
| `operation.ts` — after the gap tests below | 435 | 413 | 6 | 15 | 1 | **96.32 %** | 96.54 % |
| `entities.ts` | 1625 | 857 | 20 | 179 | 569 | 53.97 % | 83.05 % |

The `entities.ts` "no coverage" mutants are almost all in `draw()` / `drawSurface()` / `drawFluid()` (rendering, which
the headless suites deliberately do not run); the visual suite covers those. The score of covered code (83 %) is the
number to track for entities.

## Surviving mutants in scoring code → test gaps

The first `operation.ts` run exposed real gaps; each got a test in `tests/unit/surgery/operation-rules.test.ts`
(describe *QAT-0052 mutation-testing gaps*) or the rank table:

| Survivor | Gap | Test added |
|---|---|---|
| `bad + miss === 0` → `bad - miss === 0` in `rank()` | an XS run with one BAD **and** one MISS was not tested | rank table row "on the XS line, one BAD and one MISS → S" |
| `injectCooldown` `Math.max` → `Math.min` | cooldown expiry never exercised | "the tincture cooldown expires after 6 s of play" |
| `status !== 'running'` guard in `handlePointer` removed | input during intro / after the end untested | "pointer input is ignored unless the operation is running" |
| `timeLeft <= 0` → `< 0` | exact-zero timer boundary | "the timer reaching exactly 0 ends the operation" |
| rating texts/colours, Litany banner, phase callouts, "The operation is complete." | presentation contract untested | popups/callouts tests |
| `quickSwap` (no coverage), shake × 1.5, stains cap 160, `low-vitals` flag name | untested helpers | one test each |

Remaining `operation.ts` survivors are equivalent or presentation-only: initial values that are overwritten before
use (`lostReason`, `cues`, `fx`, `bonus`), `pressId--` (ids stay unique), `>`/`>=` on floating timers that never hit
exactly zero (`phaseDelay`, `litanyTime`), the tincture popup text/colour, and the unused `clampVitals` export.

Next for entities: review the 179 covered survivors by class (start with `Embedded`, `Burn`, `Bubo` ratings) and add
characterisation scenarios for the ones that change ratings or damage.
