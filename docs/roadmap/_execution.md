# Roadmap execution rules (for every agent working the roadmap)

You are completing tasks from `docs/roadmap/0*.md` for **Suture & Steel: The Malison Hours**
(TypeScript 5.9 + Vite 6 + WebGL2, Vitest). Read `docs/roadmap/_brief.md` first.

## Scope discipline
- Work **only** on the prefixes and file areas you were assigned. Other agents are editing other areas
  in parallel; touching their files causes merge conflicts. If a task needs a small hook in a shared
  file (e.g. `src/main.ts`, `src/scenes/operation.ts`, `src/surgery/operation.ts`), keep that edit
  minimal and additive (new import + one call), never reformat or reorder shared files.
- Work in **priority-tier order** (`docs/roadmap/priorities.json`, rendered in `docs/ROADMAP.md#priorities`),
  not by phase tag. Tasks in `09-parked.md` are out of scope until moved back to their workstream file.

## Definition of done for a task
1. The acceptance criterion in the task line is actually met in code/content/tests/docs.
2. `npx tsc --noEmit` passes and `npx vitest run` passes (including `tests/balance.test.ts`, which
   plays every operation with a bot — gameplay changes must keep every op winnable at steady and
   novice pace).
3. Mark it done by changing `- [ ]` to `- [x]` on that task line (do not change IDs or wording).
4. Commit in small batches with clear messages, ending with:
   ```
   Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
   Claude-Session: https://claude.ai/code/session_01NN8csWWB6zAHS5UJRFUWL8
   ```

## Tasks that need a human
Some tasks cannot be done by software alone (hiring, contracts, legal counsel, trademark filing,
age-rating submission, VO casting/recording, human playtests, store submission, payments).
Do NOT mark those `[x]`. Instead do everything that *can* be prepared (drafts, checklists, scripts,
templates, specs, email text, tooling) under `docs/handoff/<PREFIX>/`, and append a line to
`docs/handoff/<PREFIX>/README.md`: `- <TASK-ID> — what a human must do, and where the prepared material is`.

## Quality bar
- No stubs or TODO placeholders presented as done. No filler tests.
- Deterministic simulation: cosmetic randomness uses `Math.random`, never `op.rng`.
- Rendering is WebGL2 via `src/render/gfx.ts`; avoid reversed-edge `smoothstep` in GLSL (use `rsmooth`).
- Visual changes: build (`npx vite build`) and check with `node scripts/shoot.mjs <dir> <shots…>`.
- Final message to the coordinator: counts of tasks completed, tasks handed off to humans, and anything
  that blocked you.
