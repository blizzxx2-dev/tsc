# Compline VFX spec (ART-0258)

Compline, the last Hour, fights with silence. Three effects carry it. The code is
`src/art/complineLook.ts` (state) plus the `u_silence` term in `POST_FS` (`src/render/shaders/post.ts`),
wired in `src/scenes/operation.ts`.

## 1. The Great Silence (audio-mute visual)

While Compline's silence window holds (`ComplineMalison.muteT > 0`, when every sound cue is muted),
the picture tells the player why they hear nothing:

| Parameter | Value | Notes |
| --- | --- | --- |
| Trigger | `muteT > 0` on the live boss | The silence tell (1 s) stays in colour: the audio sting is the tell |
| Ease in / out | rate 5/s in, 2/s out (exponential) | Out is slower, so colour returns gently |
| Desaturation | 92 % toward luminance, tinted cold (`0.94, 0.96, 1.0`) | Post pass `damage` (off with that pass) |
| Chalk hatching | 1 px diagonal lines every 7 px, plus a cross-hatch every 9 px in the deepest shadows (lum < 0.18) | Opacity 30 % × shadow mask (lum 0.05–0.45): chalk on slate, not a screen door |
| Hatch colour | `0.82, 0.82, 0.80` | Chalk white |
| Reduced flashing | unaffected (no flashes) | Reduced motion: the hatching is static and screen-anchored anyway |

## 2. The inverted Litany ripple

When Compline steals the Litany (`litanyStolen` turns true), the Litany's sepia ripple plays **in
reverse**. The ring starts at the edge of the view and closes on the centre over 1.2 s, as if the
star were being drawn back out of the world.

| Parameter | Value |
| --- | --- |
| Duration | `INVERT_S` = 1.2 s |
| Strength (`u_litany`) | `0.8 · sin(π·k)`, k = 0..1 (×0.35 under reduced flashing) |
| Ripple age (`u_litanyAge`) | `1.1 · (1 − k)`: POST_FS draws the front at age × 0.9 of the view height, so the ring contracts |
| HUD | the reliquary shows the torn-star glyph (`drawLitanyTheft`) |

## 3. Death restores colour

When Compline dies, the silence lifts over **2.5 s** (`RESTORE_S`). The desaturation is capped
at `1 − t/2.5`, and the post pass's victory warmth (`u_outcome.y`) swells to 0.8 and back
(`sin(π·t/2.5)`). The world comes back warmer than it left. This is the game's last colour beat.

## Test

`tests/unit/art/complineLook.test.ts` covers the ease, the inverted-ripple curve and the restore.
