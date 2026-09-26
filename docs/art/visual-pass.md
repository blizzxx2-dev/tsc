# Visual pass — Trauma Center clarity, grim palette (in progress)

Direction: Trauma Center-style readability (clean painted shapes, bold outlined ailments, a well-lit
field) in a grim palette. Not PBR realism. Source textures: Julio Sillet Material Pack Skin 01
(CC-BY, credited) and CC0 Poly Haven maps — see `assets/textures/README.md`.

## Done
- Flesh base calmed (fewer veins/cells), skin scan as fine grain, wetter speculars, brighter hospice lamp.
- Wound cuts (`woundStrip`, `src/render/shaders/ailment.ts`): ray-traced trench under the cut with an
  oblique eye (`VV`), strata down the walls (skin → dermis → fat → muscle), lamp-side lip shadow,
  depth falloff, blood pooling from the floor on the heartbeat, ink rim + outer lip line. Cuts widened
  (`Laceration` 4.5/7/10, incision 8).
- Gut stitches (`gutStitch`): lit twisted tube, ink outline, pucker dimples, blood bead at the bite.
- Surface blood: dark glossy pools, thin films dry brown with a darker edge.
- Species hide (Skin 09) for orc/hornfolk/giant; rot marbling (Skin 05) for the forensic corpse.

## Still to do
- Look at the wound trench in-game at 2× and tune: fibre noise, fat band width, floor darkness,
  how far the oblique eye shifts (`Vs` in the ailment shader `main`).
- Live parallax: feed the eye offset from the pointer/camera instead of the fixed `Vs`.
- Check the stitch tube, orc hide and corpse rot in-game (never screenshotted).
- The rope scan (ambientCG Rope001) was dropped as unused; the thread twist is procedural in `gutStitch`.
- Unused pack skins: Skin 06 (gangrene) for rot ailments, Skin 08 (abrasions) for road rash / drag wounds.
- Wounds are small at 1280×720 compared with Trauma Center — layout/scale change, not a shader one.
- Grim grade pass on the post chain (per-chapter tint) once the field is final.
