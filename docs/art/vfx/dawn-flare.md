# Lauds dawn flare (ART-0238)

In Lauds's third phase ("Dawn") the sun breaks over the horizon every `flareEvery` seconds and
blinds the Scrying Lens for `flareFor` seconds. The flare is a full-screen gold bloom burst. It is
foretold by a horizon glow, and while it lasts the lens disc is washed out to white-gold, so the
player *sees* why the Lens shows nothing.

Code: `dawnFlare()` and `flareIntensity()` in `src/art/bossVfx.ts`, called from
`LaudsMalison.drawDawn()` (`src/surgery/lauds.ts`). Timing comes from `LAUDS_DEFAULT` and the
signal lead (`leadFor(op, 'lauds', 'flare')`).

## Beats

| Beat | Time | Look |
| --- | --- | --- |
| Tell | the `lead` seconds before the flare | A warm glow (radius 520 px) swells at the top edge of the field (the horizon), from 0 to `tellGlow` |
| Attack | 0 → 0.12 s | Intensity ease-out to 1: a gold wash over the whole view, a bloom disc from the horizon and nine low sun rays |
| Hold | 0.12 → 0.35 s | Full intensity. The Lens disc is white-gold (`lensWhiteout`) |
| Decay | 0.35 s → `flareFor` | Quadratic fall to 0: `(1 − (t − 0.35) / (flareFor − 0.35))²` |

## ENG parameter table

| Parameter | Value | Where | Notes |
| --- | --- | --- | --- |
| `flareEvery` | 12 s | `LAUDS_DEFAULT` | Cadence between flares |
| `flareFor` | 2 s | `LAUDS_DEFAULT` | Blind duration, the whole curve |
| Tell lead | `leadFor(op, 'lauds', 'flare')` | `src/surgery/bosses/signals.ts` | Longer on assisted difficulty |
| `FLARE.attack` | 0.12 s | `src/art/bossVfx.ts` | Ease `outCubic` |
| `FLARE.hold` | 0.35 s | `src/art/bossVfx.ts` | End of full intensity |
| `FLARE.peak` | 0.85 | `src/art/bossVfx.ts` | Scales the view wash (×0.45) and the horizon bloom (×0.6), additive |
| `FLARE.lensWhiteout` | 0.95 | `src/art/bossVfx.ts` | Alpha of the lens disc wash at full intensity |
| `FLARE.tellGlow` | 0.35 | `src/art/bossVfx.ts` | Peak alpha of the horizon glow |
| Wash colour | `#ffe0a0` | `dawnFlare` | Gilt-warm. The bloom core is `#fff0c0` fading to `#ffc860` |
| Reduced flashing | ×0.35 on every alpha | `settings.reduceFlashing` (ART-0295) | The Lens still whites out enough to read as blinded |
| Blend | additive | | Drawn in the world pass, so the post bloom and LUT grade it |

## Accessibility

The flare never exceeds three flashes per second (it is a single 2 s event every 12 s), and the
reduced-flashing variant scales it to 35 %. The Lens-blind state is also shown as a HUD flag
(`lens-blind`) and a spoken line, so no information rides on the flash alone.
