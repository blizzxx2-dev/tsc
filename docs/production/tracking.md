# Tracking: roadmap, issues, board and burn-up

Owner: Producer.

## Source of truth
`docs/roadmap/0*.md` holds every task (id, phase, priority, size, title — acceptance). GitHub issues
mirror it for assignment and discussion; the roadmap file wins on wording, GitHub wins on "closed".

## Roadmap → issue sync (OPS-0007)
`scripts/ops/roadmap-sync.mjs` (tested in `tests/ops.test.ts`):

```
node scripts/ops/roadmap-sync.mjs                                   # dry run, prints the plan
GITHUB_TOKEN=… node scripts/ops/roadmap-sync.mjs --repo <owner>/<repo> --apply
GITHUB_TOKEN=… node scripts/ops/roadmap-sync.mjs --repo <owner>/<repo> --apply --only DEMO   # M0+Demo only
```

- One issue per task, titled `<ID> · <title>`, body = acceptance criterion and source file, labels
  `roadmap`, `ws:<PREFIX>`, `phase:<Phase>`, `P0…P3`, `size:S|M|L`. Non-roadmap labels on an issue are kept.
- Changed task lines update the issue title/labels; issues are matched by the id at the start of the
  title, so renames never duplicate.
- `[x]` in the roadmap closes the issue; an issue closed as *completed* on GitHub writes `[x]` back into
  the roadmap file (issues closed as *not planned* are left for a human to re-scope).
- Idempotent: after `--apply`, a second run plans zero actions (unit-tested).
- Recommended: run it from a scheduled CI job nightly with a fine-grained token limited to issues on
  this repository (PLT owns the workflow file).

## GitHub Project views (OPS-0008)
Specification for the Projects (v2) board — creating saved views is a manual step in the GitHub UI
(handoff OPS-0008):

| View | Layout | Filter | Group / sort |
|---|---|---|---|
| By phase | Board | `label:roadmap` | Column = `phase:*` label; sort by priority |
| By workstream | Table | `label:roadmap` | Group by `ws:*`; sort phase, priority |
| By priority | Table | `label:roadmap is:open` | Group by `P0…P3`; sort by phase |
| **Demo critical path** | Table | `label:roadmap label:phase:Demo label:P0 is:open` | Sort by size desc; fields: assignee, iteration |
| Current sprint | Board | `iteration:@current` | Status columns Todo / In progress / In review / Done |
| Retro actions | Table | `label:retro:*` is:open | Sort by due date |

Links to the saved views go in the repository README's *Project* section once created.

## Burn-up (OPS-0009)
`node scripts/ops/burnup.mjs --write` regenerates [burnup.md](burnup.md): points S = 1, M = 3, L = 8,
scope and done per phase sampled weekly from git history, velocity over the last four weeks and a
forecast finish date per phase against [gates.json](gates.json). A forecast more than **two weeks past
a gate** (or no velocity) is flagged **SCOPE REVIEW**; the Friday status note must then open a scope
review under [change-control.md](change-control.md). Run it every Friday before writing the status note.
