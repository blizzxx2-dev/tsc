# BOS — boss framework (work in progress, not merged)

`wip-boss-framework.patch` is a plain diff against the current game branch (`git apply` it). It has
already been merged forward onto the current code, with conflicts resolved.

What it contains:

- `src/surgery/bosses/base.ts` — `MalisonBase`:
  - HP-threshold phases, one per blow, with a frozen 1.2 s beat;
  - cinematic skip on repeat attempts, music intensity per phase, death dissolve;
  - a drain budget for adds (measured at spawn), checkpoint resume, capped boss-add ratings.
- `src/surgery/bosses/signals.ts` — declared tells (≥ 0.8 s) and cadences for every attack.
- `src/surgery/bosses/hud.ts`, `codex.ts`, `elites.ts` — the boss HUD, codex entries, and the demo elites
  (brood-cluster, cantor's knot, fang-nest, Matins herald).
- The elites are wired into the op data via new schema ids: `elite-broodcluster`, `elite-cantor`,
  `elite-fangnest`, `herald`.
- The reworks:
  - Matins "Night Vigil": Vigil → Watchfire → The Eye;
  - Lauds "Antiphon": Call → Response → Dawn;
  - `src/scenes/bossAudio.ts`.
- Tests: `tests/hours.test.ts` and `tests/hours-later.test.ts` pass. The Matins/Lauds/EggSac
  characterisation tests are rewritten for the new fights, and the tool-matrix doc is regenerated.

Still failing before it can merge. These are balance and bot-tuning issues, not framework bugs:

1. **Rank recalibration:** `CALIBRATE=1 npx vitest run tests/balance.test.ts -t calibrate`, then copy the
   demo rows into `src/surgery/ranks.ts`. The op1-4 herald bonus makes steady reach XS.
2. **X2 (Lauds remix) on Master:** the steady bot loses in the Response phase. The patch already eases
   X2 (hp 1.15, drain 0.85). Next step: shorten `antiphon(l, 20)` bouts in `tests/bot-hours.ts` so the bot
   heals between strikes.
3. **Regenerate goldens and baselines once balance holds:**
   - `UPDATE_GOLDEN=1` for `golden-ops`;
   - the sweep CSV baseline;
   - the scoring farm tests;
   - the audio-director and offline-replay tests;
   - telemetry.
4. **i18n:** key the new `sayOnce`/`say` lines (`npm run i18n:check`). Also run the IP-name scan.
