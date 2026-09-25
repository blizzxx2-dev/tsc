# Colour-blind pass (ART-0357)

The signals a player must tell apart by colour, checked under simulated protanopia, deuteranopia
and tritanopia. The simulation uses Machado, Oliveira and Fernandes (2009) at full severity in
linear sRGB (`src/art/cvd.ts`). Values are CIE76 ΔE between the two colours as the viewer sees
them. **A pair passes at ΔE ≥ 12** (`MIN_DE`). ⚠ marks a failure.

- *default*: the normal palette. The rating stamps use `RATING_INK`.
- *filter*: the matching Options → Accessibility → Colour filter palette (`src/ui/theme.ts`).

Regenerate the table with `npx vite-node scripts/art/cvd-report.ts`.
`tests/unit/art/cvd.test.ts` fails if any pair drops under 12 with its filter on, or if sigils or
curse motes stop standing apart from veins and blood without one.

| Pair | Normal | protanopia (default) | protanopia (filter) | deuteranopia (default) | deuteranopia (filter) | tritanopia (default) | tritanopia (filter) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| COOL / GOOD | 50.0 | 47.1 | 71.2 | 48.5 | 72.8 | 36.7 | 23.6 |
| COOL / BAD | 33.2 | 27.1 | 18.9 | 20.2 | 17.0 | 30.6 | 34.0 |
| COOL / MISS | 83.6 | 64.5 | 59.2 | 39.7 | 56.2 | 74.9 | 69.5 |
| GOOD / BAD | 56.0 | 36.9 | 85.8 | 41.0 | 86.1 | 63.9 | 56.2 |
| GOOD / MISS | 93.9 | 46.3 | 16.5 | 39.9 | 21.5 | 109.0 | 92.5 |
| BAD / MISS | 51.0 | 37.6 | 75.6 | 19.6 | 71.3 | 45.6 | 36.8 |
| vitals good / warn | 53.9 | 26.4 | 115.6 | 33.4 | 112.9 | 60.5 | 85.0 |
| vitals good / danger | 108.2 | 35.1 | 102.4 | 36.2 | 111.4 | 120.0 | 133.6 |
| vitals warn / danger | 62.5 | 35.4 | 23.4 | 17.4 | 16.9 | 61.7 | 53.2 |
| sigil / flesh vein | 79.8 | 72.4 | 72.4 | 74.8 | 74.8 | 50.1 | 59.1 |
| sigil / heart vein | 78.2 | 70.3 | 70.3 | 71.5 | 71.5 | 50.6 | 67.8 |
| sigil / lung vein | 75.8 | 67.9 | 67.9 | 70.5 | 70.5 | 43.9 | 56.1 |
| sigil / gut vein | 83.2 | 75.6 | 75.6 | 78.7 | 78.7 | 44.7 | 48.5 |
| sigil / liver vein | 97.2 | 85.5 | 85.5 | 85.0 | 85.0 | 57.5 | 80.7 |
| sigil / brain vein | 89.9 | 83.0 | 83.0 | 91.4 | 91.4 | 60.5 | 29.2 |
| sigil / bone vein | 92.8 | 85.3 | 85.3 | 89.2 | 89.2 | 52.3 | 50.4 |
| curse motes / blood | 103.3 | 96.8 | 104.3 | 104.4 | 104.4 | 68.5 | 32.0 |

## Findings

1. **With the matching filter on, every pair passes.** The lowest is GOOD / MISS under protanopia
   at 16.5.
2. **Sigils against veins, and the curse violet against blood, pass for every type even without a
   filter.** The lowest is 43.9 (a sigil on a lung vein under tritanopia). No fix is needed.
3. **Found and fixed: the BAD and MISS stamps without a filter.** With the old MISS ink `#ff6a5a`,
   the pair was ΔE 2.8 under deuteranopia (and a borderline 15.2 under protanopia). The two stamps
   read as the same orange, and only the words ("BAD" / "MISS") and stamp treatment (UIX-0147)
   told them apart. MISS is now crimson `#e03050` (`RATING_INK`, src/art/kit.ts), which puts the
   pair at 19.6 (deuteranopia), 37.6 (protanopia) and 45.6 (tritanopia), while MISS stays the hottest stamp for everyone else. The test now
   also checks the default stamps.
4. Tritanopia with its filter narrows curse / blood (32.0) and sigil / brain vein (29.2), because the
   filter moves curse toward rose. Both still pass comfortably.
