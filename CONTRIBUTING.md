# Contributing to Suture & Steel

## Setup

```sh
npm ci
npm run dev            # Vite dev server (debug console and cheat menu included)
npm run hooks:install  # optional: pre-commit (Prettier + ESLint on staged files), commit-msg (commitlint), pre-push (tsc + related tests)
```

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat(sim): …`, `fix(ui): …`,
`test(qa): …`; extra types `content`, `art`, `audio`, `loc`). The commit-msg hook and the PR check enforce it so the
changelog / patch-notes generator always gets typed commits.

## Tests

Vitest runs everything; projects are defined in `vitest.config.ts`.

| Command | What runs | When |
|---|---|---|
| `npm test` | `unit` + `sim` | before every push (CI runs both) |
| `npm run test:unit` | rule tests (`tests/unit`), characterisation snapshots (`tests/characterisation`), telemetry/debug unit tests, the star recogniser | seconds; every change |
| `npm run test:sim` | bot playthroughs of every operation, balance guard-rails, fast-check scoring invariants (60 s timeout); writes `reports/sim-report.json` | gameplay changes |
| `npm run test:e2e` | Playwright (Chromium + SwiftShader) against the QA build: new game, continue/resume, retry/quit, options, input and runtime parity, no-WebGL2, OS locales | UI/flow changes; CI shards it 4 ways |
| `npm run test:visual` | screenshot comparisons against Docker-generated baselines | visual changes |
| `npm run bench` | simulation micro-benchmarks (tracked nightly) | performance work |
| `npm run test:mutation` | StrykerJS on `src/surgery/operation.ts` (`MUTATE=src/surgery/entities.ts` for entities) | before the demo RC |
| `npm run smoke` | end-to-end smoke of every Chapter 1–2 operation and both bosses, with screenshots | CI; before handing a build over |
| `npm run shot -- <op> <seconds> <out.png>` | one screenshot of an operation at a sim time | visual review |

E2E, visual, smoke and shot use the **QA build** (`npm run build:qa` → `dist-qa/`, built automatically if
missing), which includes the automation API `window.__game.debug`. The release build (`npm run build`) strips it;
CI checks that with `scripts/qa/check-debug-stripped.mjs`.

Browser: `$CHROMIUM` if set, otherwise Playwright's bundled Chromium (`npx playwright install chromium`).

### Writing tests

- Share helpers from `tests/helpers/sim.ts` (`makeOp`, `step`, `press/drag/release`, `strokePath`, `zigzag`,
  `defWith` for an isolated entity with no drain, all eight tools and a 999 s clock). Don't redefine `DT` or pointers.
- Every test asserts (`vitest/expect-expect`), no `.only`, and `.skip` only with an issue link on the line above
  (see `tests/QUARANTINE.md`).
- Behaviour changes to entities or scoring update the characterisation snapshots
  (`npx vitest run tests/characterisation -u`) and need the `behaviour-change` PR label plus a GAM review.
- Unit tests must stay under 2 s each (CI flags slower ones); long bot runs belong in `tests/sim`.

## Debug console and cheats (dev and QA builds)

- **`** (backquote) opens the console: `help`, `state`, `preset <name>`, `chapter <n> [step]`, `story <id> [line]`,
  `op <id> [go]`, `results <rank>`, `demoend`, `unlockall`, `flag <name> <value>`, `skip`, `win`, `lose [time]`,
  `vitals <n>`, `time <s>`, `tool <id>`, `litany`, `freeze`/`step`/`thaw`, `telemetry on|off|dump`.
- **F1** (or the gamepad View/Back button) opens the cheat menu — navigable with arrows/Enter/Esc, the d-pad/A/B or the mouse.
- `?preset=<fresh|mid-ch1|pre-matins|ch2-start|pre-lauds|demo-complete|all-xs>` on the URL loads a save preset;
  `?op=<id>` jumps into an operation.

## Formatting and lint

`npm run lint` (ESLint) and `npm run format:check` (Prettier). Prettier owns QA tooling, tests and new modules; the
original engine and game code under `src/` keeps its hand formatting and reports lint findings as warnings only —
don't mass-reformat it.

## Bugs

File bugs with the issue forms; process, severities and SLAs are in `docs/qa/bug-process.md`.
