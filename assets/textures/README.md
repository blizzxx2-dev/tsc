# Surface textures (CC0)

Real-world detail maps fed into the procedural shaders. Colour stays shader-driven (species tints,
wounds, curse) — these add micro-surface: pores, weave, grain.

| File | Packing | Source (CC0) |
|---|---|---|
| `skin-detail.jpg` | R,G normal xy (×3 gain), B roughness | ambientCG Leather039 — https://ambientcg.com/view?id=Leather039 |
| `linen-detail.jpg` | R,G normal xy, B weave shading | Poly Haven rough_linen — https://polyhaven.com/a/rough_linen |
| `wood-table.jpg` | colour | Poly Haven dark_wood — https://polyhaven.com/a/dark_wood |
| `suture-rope.jpg` | colour | ambientCG Rope001 — https://ambientcg.com/view?id=Rope001 |

Both libraries publish under CC0 1.0 (https://docs.ambientcg.com/license/, https://polyhaven.com/license).
Resized to 512² (rope 256²) and repacked with `PIL`; no other changes.
