# Matins — concept, sprites and VFX spec (ART-0230 – ART-0232)

The first Malison Hour: **a shrouded vigil-mass of candle-wax cloth with one great lidded eye**.
Everything is procedural (`matins()` in `src/render/shaders/creature.ts`, drawn by
`Gfx.creature(0, …)` from `Malison.draw()` in `src/surgery/malison.ts`). The callout sheet is live:
`?scene=woundlab&page=4` (freeze time with `&t=0.4`).

## Callouts (ART-0230)

| Part | Read | Notes |
| --- | --- | --- |
| Hood and shroud | Tallow-ivory cloth, grimed at the folds | Folds fan from the hood and loosen toward the hem; creases narrow, cloth broad |
| Wax drips | Raised runs from the hood with bulbous heads | Longer as it degrades |
| Woven seams | Curse-violet threads showing through thin cloth | The only violet on the body (curse-violet rule, bible §5) |
| Hem and threads | Scalloped hem; five loose threads trail beneath | The Malisons' shared "woven-thread body" |
| The eye — **closed** | A lid seam, cross-stitched shut with gut thread | u_open = 0 |
| The eye — **opening** | Waxen lids part; the iris a dull ember | u_open ≈ 0.45 |
| The eye — **open** | Yellowed sclera, iris blazing red-gold, a thin vertical slit pupil | u_open = 1 |

## Sprites and states (ART-0231)

- **Idle breathing:** 12 held frames over 2.4 s (the shroud rises and narrows on the in-breath).
- **Eye open/close:** 10 frames; `u_open` is quantised to tenths, so every in-between is a held frame.
- **Hurt flash:** `u_flash` whitens the whole body toward candle-orange.
- **Phase degradation** (by health): **intact** (> 66 %), **torn** (holes open onto the living ink
  within, drips lengthen), **shredded** (< 33 %: the hem hangs in strips, the sclera bloodshot).
- Death keeps the shared ash dissolve (`u_dissolve`).

## VFX spec (ART-0232)

| Effect | Where | Parameter | Value |
| --- | --- | --- | --- |
| Shroud cloth distortion | `matins()` domain warp (the fragment-shader stand-in for a vertex wobble) | amplitude | 0.012 of the sprite, ×1.6 torn, ×2.2 shredded; frequencies 13/11 per unit at 1.9/1.6 rad/s |
| Iris glow ramp | `matins()` | `u_open` 0.2 → 1 | iris lerps ember `(0.35, 0.05, 0.06)` → red-gold `(1.0, 0.55, 0.15)` plus a core glow; the pupil narrows from 0.03 to 0.009 |
| Darkness-vignette pulse | post pass `spot.k` (the lamp surround), fed by `Malison.watching()` | 0.62 + 0.25 × watching | watching = 0.35 + 0.65·e^(−5·t) on each beat while the eye is out, 0.4 while open, a slow 0.1 breath otherwise; scaled by the reduced-flashing setting |
