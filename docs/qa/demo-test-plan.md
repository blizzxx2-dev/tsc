# Demo test plan — Chapters I–II Steam demo (QAT-0128)

Owner: QA lead. Build under test: the demo release candidate (RC) and every build promoted to the Steam `qa` branch.

## 1. Scope

| Area | In scope | Suites / automation |
|---|---|---|
| Front end | title, new game / continue, chapter select, Operating Theatre (op replay), options entry/exit, credits, quit, demo ribbon, owned-full-game title state | TC-FE; E2E `flows.e2e.ts` |
| Story | 12 story scenes (prologue … s2-end): advance, skip, auto, backlog, choices/flags, speaker plates, END OF CHAPTER cards | TC-STORY; `tests/unit/content/story-data.test.ts` |
| Operations | op1-1 … op1-5, op2-1 … op2-5: win, loss by vitals, loss by timer, retry, quit, alt-tab, Litany, hotkeys, ranks | TC-OP ×10; sim bots, balance, invariants, characterisation, E2E parity, smoke |
| Bosses | Malison of Matins (op1-5), Malison of Lauds (op2-5) | TC-OP-op1-5/op2-5, charters; `matins/lauds` snapshots |
| Tutorials | every tool tutorial (UIX) | TC-TUT |
| Save / Cloud | autosave boundaries, corruption, Steam Cloud | TC-SAVE; E2E continue/resume |
| Options | audio buses, display, render scale, frame cap, shake, flashing, text size, gore, assists, language, bindings | TC-OPT; E2E options persistence |
| Audio & focus | buses, mute on focus loss, device changes, overlay | TC-AUD |
| Results | ranks XS–C, NEW BEST, assisted marker | TC-OP; `tests/fixtures/rank-table.ts` |
| Demo end | demo-complete screen, wishlist, no route to Chapter III | TC-END |
| Steam / Deck | offline, launch outside Steam, overlay, Big Picture / gaming mode, Cloud conflict, Deck verified items | TC-STEAM; cert checklist |
| Localisation | functional pass per demo language (LOC owns linguistic quality) | QAT-0145 (blocked on LOC) |
| Compatibility & perf | `docs/qa/compat-matrix.md`, budgets on Deck and min-spec | lab sweep, `perf-protocol.md` |

Out of scope: Chapters III–V, challenge mode, other disciplines (Alpha/Beta plans).

## 2. Platforms

Windows 10/11 (min-spec and recommended PCs), Steam Deck (SteamOS gaming mode), Linux (Ubuntu 24.04). macOS only if the
demo ships there. Every configuration in the compatibility matrix gets at least the smoke subset.

## 3. Test levels

1. **Automated, every PR** (`qa-ci.yml`): lint/types, unit + characterisation, sim (bots, balance, fuzz), release/QA
   builds with the debug-strip gate, smoke, sharded E2E.
2. **Automated, nightly** (`qa-nightly.yml`): deep fuzz (200 runs/op), E2E + visual, smoke, benchmarks, localised and
   pseudo-loc captures and replay re-sims when present.
3. **Manual suites** (`docs/qa/cases/`): tagged `smoke` (≈ 30 min), `regression` (≤ 4 h, one tester), `full`.
4. **Exploratory charters** (`docs/qa/charters.md`) — 90-minute time-boxed sessions.
5. **Soak** — idle soaks (`docs/qa/charters.md` § Soak, `scripts/qa/soak.mjs`).
6. **Playtests** — three demo rounds plus RC round (`docs/handoff/QAT/playtest/`).

## 4. Entry criteria (a build enters QA when)

- CI is green on the commit (all `qa-ci` jobs, secret scan, policy);
- the build id, changelog and known-issues delta are posted;
- no S1 from the previous build remains unverified without an owner.

## 5. Exit criteria for the demo RC (QAT-0129)

The RC can be set live only when **all** of these hold, recorded in `docs/qa/signoff/demo-rc.md`:

1. **0 open S1 and 0 open S2** bugs against the demo.
2. **≤ 15 open S3**, each with an owner and a signed-off "ship with" decision (producer + area lead).
3. **Crash-free sessions ≥ 99.5 %** in the RC playtest round (QAT-0122), from crash reporting / telemetry.
4. **Performance budgets met** on Steam Deck and the min-spec PC under `docs/qa/perf-protocol.md`
   (ENG budget: p95 frame time within budget in every capture scenario, no hitch > 50 ms).
5. **Every suite executed on the RC build**: automated (CI + nightly on the RC commit), `regression` manual set, the
   demo-end, save, Steam edge-case and localisation functional suites, and the certification checklist
   (`docs/qa/cert-demo.md`) all green.

## 6. Schedule (relative to the RC date R)

| When | Activity |
|---|---|
| R − 6 weeks | Playtest round 1 (fresh players, tutorials) |
| R − 4 weeks | Playtest round 2 (boss gates, rank validation); compatibility lab sweep |
| R − 3 weeks | Content lock; full manual pass; localisation functional pass |
| R − 2 weeks | Playtest round 3 (Steam Playtest, unmoderated); Deck round; accessibility round |
| R − 1 week | RC build; regression set; cert checklist; RC playtest round (30 players) |
| R | Go/no-go with the sign-off; set live |
| R + Next Fest | Daily crash/forum sweep and hotfix verification (rota) |

## 7. Suites

See `docs/qa/cases/README.md` for the case index and ids; charters in `docs/qa/charters.md`; certification in
`docs/qa/cert-demo.md`; patch checklist in `docs/qa/patch-regression.md`.

## 8. Reporting

Bugs through the issue forms (`docs/qa/bug-process.md`); daily build status in the QA channel; weekly metrics from
`scripts/qa/bug-metrics.mjs`; the RC sign-off generated by `node scripts/qa/signoff.mjs`.
