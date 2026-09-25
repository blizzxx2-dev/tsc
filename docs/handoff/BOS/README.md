# BOS — boss framework (work in progress, not merged)

`wip-boss-framework.patch` holds the uncommitted work of the bosses workstream, salvaged when its agent
was stopped. It is **not merged**: it reworks the two demo Malisons, and 9 of its 35 new tests
(`tests/hours.test.ts`) still fail on its own base, so merging it would put the demo boss fights at risk.

What it contains (applies to commit `33931c1`, "Merge input & controls (INP)"):

- `src/surgery/bosses/base.ts` — a `MalisonBase` framework: HP-threshold phases with a frozen 1.2 s
  beat, repeat-attempt skip of the cinematic beat, music intensity per phase, death dissolve, a drain
  budget for adds, checkpoint resume, capped boss-add ratings, `clampToField`.
- `src/surgery/bosses/signals.ts` — declared tells (≥ 0.8 s) and cadences for every attack.
- `src/surgery/bosses/hud.ts`, `codex.ts`, `elites.ts` — boss HUD (veiled later phases, compact
  elite bar), boss codex entries, demo elites (egg-cluster, cantor's knot, fang-nest, Matins herald).
- Matins "Night Vigil" and Lauds "Antiphon" reworked onto the framework; `src/scenes/bossAudio.ts`.
- `tests/hours.test.ts`, `tests/hours-later.test.ts`, `tests/bot-hours.ts`.

Failing on its own base (to fix before merging):

1. MalisonBase — phases follow HP thresholds one at a time, with a frozen 1.2 s beat
2. MalisonBase — music intensity follows the phases and falls silent on death
3. Matins — The Eye: only the third beat bites, for double damage; off-beat brands rend
4. Matins — the gaze lash: off the line it misses, on the line it cuts
5. Lauds — Dawn: the flare blinds the Lens for 2 s after a 1 s horizon-glow tell
6. Lauds — submerged rot trail stays at 3 patches and scores as a boss add
7. Brood-Mother sacs — hatch at 10 s with a 3 s swell; never more than 6 live spiderlings
8. Demo elites — cantor's knot re-ties one stroke per hum, after a hum tell
9. Demo elites — the Matins herald flees the lens and pays 300 when seared

To resume: `git checkout -b bos-wip 33931c1 && git am docs/handoff/BOS/wip-boss-framework.patch`, fix
the tests above, then merge into the current branch. Expect conflicts with the GAM merge, which since
changed `Operation` (op.journal, scoring spec, difficulty) and the bot.
