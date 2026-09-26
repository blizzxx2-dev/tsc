# Surface textures (CC0)

Real-world detail maps fed into the procedural shaders. Colour stays shader-driven (species tints,
wounds, curse) — these add micro-surface: pores, weave, grain.

| File | Packing | Source (CC0) |
|---|---|---|
| `skin-detail.jpg` | R,G normal xy (×2.5 gain), B roughness | Julio Sillet, Material Pack Skin 01 — Skin 03 (CC-BY) — https://juliosillet.gumroad.com/l/IbCT |
| `skin-mottle.jpg` | colour normalised to its mean (0.5 grey = mean tone) | same, Skin 03 base colour |
| `hide-detail.jpg`, `hide-mottle.jpg` | as skin-detail / skin-mottle (orc, hornfolk, giant) | same pack — Skin 09 (CC-BY) |
| `rot-mottle.jpg` | as skin-mottle (the forensic corpse) | same pack — Skin 05 (CC-BY) |
| `linen-detail.jpg` | R,G normal xy, B weave shading | Poly Haven rough_linen — https://polyhaven.com/a/rough_linen |
| `wood-table.jpg` | colour | Poly Haven dark_wood — https://polyhaven.com/a/dark_wood |

The skin maps are **CC-BY** (Julio Sillet 3D Art — credit required; commercial use allowed, no reselling of the textures). The rest are CC0 1.0 (Poly Haven — https://polyhaven.com/license).
Resized to 512² (the low-frequency mottle maps 256²) and repacked with `PIL`; no other changes.
