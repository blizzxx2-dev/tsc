# Wet-map authoring guide (ART-0162)

How to paint the **wet/spec mask** (the R channel of a flesh texture set, see the input spec in
`pipeline.md`, ART-0046) so every organ answers the surgeon's lamp the way the procedural shader
already does. Read this with the flesh look-dev page open (`?scene=fleshlab`), where each organ and
people can be checked under the three-light rig.

## How the shader uses it

`FLESH_FS` (`src/render/shaders/flesh.ts`) turns a per-organ base roughness into the final lobe:

```
wet   = clamp(0.35 + 0.35·fbm + cut·0.8 + blood·0.6 + swelling·0.3, 0, 1)   // procedural today
rough = mix(base + sheen + 0.25,  base + sheen − 0.15,  wet)                  // dry → wet
rough = clamp(rough + specAA, 0.12, 0.9)
```

A painted wet map **replaces the `0.35 + 0.35·fbm` term**: white is freshly wet, black is dried
out. The wound, blood and swelling terms are added on top at runtime, so do not paint wounds into
the map — paint the organ's own surface.

- `base` is the organ's roughness from `ROUGH` in `src/render/organs.ts`.
- `sheen` is the people's skin-sheen offset from `src/surgery/species.ts` (orc hide is duller, elf
  skin finer): never compensate for species in the map.
- Energy-normalised Blinn-Phong: exponent `2/rough² − 2`. Roughness 0.25 is a tight glint, 0.6 a
  broad dull sheen.

## Targets per organ

| Organ (`OrganKind`) | Base rough | Painted wet map (mean / range) | Resulting rough (dry → wet) | Read |
| --- | --- | --- | --- | --- |
| `heart` | 0.38 | 0.75 / 0.6–0.95 | 0.63 → **0.23** | **Glossy**: epicardium is a wet film; tight, bright glints that ride the beat. Keep dry patches only over fat streaks. |
| `gut` | 0.35 | 0.7 / 0.5–0.9 | 0.60 → **0.20** | Glossy serosa; highlights run along each loop's crown. Mesenteric fat 0.4. |
| `liver` | 0.40 | 0.5 / 0.4–0.6 | 0.65 → **0.30** | **Satin**: an even, soft sheen over the capsule; no pin glints. Keep the range narrow. |
| `lung` | 0.45 | 0.55 / 0.3–0.8 | 0.70 → **0.35** | Pleural sheen on the lobule crowns, dry in the anthracotic speckle (0.2). |
| `brain` | 0.50 | 0.6 / 0.45–0.75 | 0.75 → **0.45** | Meningeal veil: a moist but diffuse sheen; sulci darker (0.45), gyri crowns 0.75. |
| `flesh` (skin/muscle) | 0.55 | 0.4 / 0.2–0.7 | 0.80 → **0.40** | Skin mostly matte; muscle fascia in wounds wetter (0.7). |
| `bone` | 0.60 | 0.2 / 0.05–0.35 | 0.85 → **0.45** | **Dry**: cortical bone is chalky; only the periosteum film near the cut takes 0.35. |

Values are 0–1 in linear space (the R channel is **not** sRGB-encoded).

## Painting rules

1. **Big shapes first.** Wetness follows the organ's form (crowns and convex swells catch fluid),
   not its detail texture. Paint at 1/8 resolution, then add fine breakup at ±0.1 only.
2. **Never pure black or white.** Stay inside the organ's range above; the wound terms push to 1.
3. **No baked highlights in the albedo.** Specular is the shader's job; a painted highlight doubles.
4. **Tile it.** Wet maps tile like the albedo; run `npm run art:tileable` (ART-0160) before export.
5. **Check at every tier.** Low quality drops spec AA; a map that sparkles there is too noisy.
6. **Gore levels.** At reduced gore the wound colours brown and at minimal gore wounds are matte
   ink: the organ's own wet map is unchanged, so no alternate maps are needed.

## Checklist before handing in

- [ ] Mean and range match the table (sample in the paint tool's histogram).
- [ ] Viewed in `?scene=fleshlab` with the organ selected, lamp swept through 360°.
- [ ] Compared side by side with the procedural baseline (Tab in fleshlab).
- [ ] Seam check passes (`npm run art:tileable`).
