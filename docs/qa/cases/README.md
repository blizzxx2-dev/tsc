# Test-case repository (QAT-0130)

Manual test cases for the demo, one file per suite. Every case has a **stable id** (`TC-<SUITE>-<NNN>`, never
reused or renumbered — retire a case by marking it `retired`), a priority, tags and an estimate in minutes.

| Tag | Meaning | Budget |
|---|---|---|
| `smoke` | build acceptance / hotfix check | ≈ 60 min (see `docs/qa/patch-regression.md`) |
| `regression` | every RC and every build promoted to `qa` | **≤ 4 h for one tester** (checked by `tests/unit/qa/cases.test.ts`) |
| `full` | milestone passes (content lock, RC) | everything |

Every case is implicitly `full`. `Auto` names the automated test that already covers it (the manual run then only
spot-checks presentation).

Table columns (parsed by the test): `| ID | Title | Pri | Tags | Min | Steps → Expected | Auto |`.

| Suite | File | Task |
|---|---|---|
| Front end | [front-end.md](front-end.md) | QAT-0131 |
| Story | [story.md](story.md) | QAT-0132 |
| Operations (×10) | [operations.md](operations.md) | QAT-0133 |
| Tutorials | [tutorials.md](tutorials.md) | QAT-0134 |
| Save / Cloud | [save.md](save.md) | QAT-0135 |
| Options | [options.md](options.md) | QAT-0136 |
| Audio & focus | [audio-focus.md](audio-focus.md) | QAT-0137 |
| Demo end | [demo-end.md](demo-end.md) | QAT-0138 |
| Steam edge cases | [steam.md](steam.md) | QAT-0139 |

Useful shortcuts in QA builds: the ` console (`preset pre-matins`, `op op2-5 go`, `skip`, `lose time`, `results XS`)
and the F1 cheat menu. Record results in the run sheet generated for the build (copy the tables, add Pass/Fail/Bug).
