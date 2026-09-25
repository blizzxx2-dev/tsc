# Animation timing sheet (ART-0297)

One clock for every flipbook and effect in the demo. The constants live in `src/art/timing.ts`,
and code reads them from there, so the sheet and the game cannot drift.

## Frame rates

| Use | fps | Where |
| --- | --- | --- |
| Woodcut flipbooks: seals, stamps, ribbons, page turns, the Litany's falling leaf, rank seals | **12** | `FPS.woodcut`. `FLIPBOOK_FPS` and `frameAt` in `src/art/kit.ts` use it, so every kit flipbook runs at it |
| VFX: sparks, glows, rings, decals, crackle, smoke | **24** | `FPS.vfx`, the `fps` column of every row in [README.md](README.md) |
| Shader-driven motion (flesh pulse, the creature shader, post ripples) | continuous | driven by time, never stepped |

Frames are picked with `frameOf(t, fps, frames)` (held on the last frame) or `loopFrame` (wraps).
Frame order is explicit, and atlas flipbooks carry `ms` per frame in `_sheet.json`: 83 ms at 12 fps, 42 ms at 24 fps.

## Ease curves (`EASE`)

| Curve | Use |
| --- | --- |
| `outCubic` | Arrivals: a stamp landing, rings and ripples expanding, the Litany star growing |
| `inCubic` | Departures: pieces falling away |
| `inOutSine` | Breathing, sways, candle swells, idle loops |
| `outBack` | Ribbons and banners unfurling, with a small overshoot |
| `linear` | Fades that must read as time running out (the Litany marginalia, cooldowns) |

## Hit-pause (`HIT_PAUSE_FRAMES`, in frames at 60 fps)

| Event | Frames | ms (`HITSTOP_MS` in `src/core/clock.ts`) |
| --- | --- | --- |
| Harm ≥ 5 vitals (`impact`) | 3 | 50 |
| Object pulled free (`extract`) | 2.4 | 40 |
| A blow on the Malison (`malisonHit`, at most once per 0.6 s) | 3.6 | 60 |

Hit-pause is capped at 120 ms and is off under Reduced Motion. `tests/unit/art/vfx.test.ts`
checks that `HITSTOP_MS` matches these frame counts.

## Standard lengths

| Beat | Length |
| --- | --- |
| Rating stamp slam | 6 frames at 12 fps, then a 0.6 s hold |
| Phase banner in and out | 0.35 s each way, 1.5 s hold |
| Litany | star burn-in 0.3 s, then the ripple front for 1 s; 8 s active; leaf 12 frames at 12 fps |
| Sear glow cool-down | 2 s (orange → red → char) |
| Boss death dissolve | 1.2 s |
