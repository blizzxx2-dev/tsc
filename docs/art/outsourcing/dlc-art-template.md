# DLC chapter art package — template and cost estimate (ART-0378)

Copy this page for each DLC chapter. It lists every art deliverable in one chapter-sized package
(**1 new location set, 4 portraits, 1 Malison variant, 6 ailments**) with its spec, owner, stage
plan and cost. Unit costs match the demo budget
([budget-schedule.md](budget-schedule.md), [budget-model.csv](../../production/budget/budget-model.csv)).
Procedural pieces are costed as in-house time.

## Deliverables

| # | Deliverable | Spec | Who | Stages (pipeline.md) |
| --- | --- | --- | --- | --- |
| 1 | Location set: 3 story backgrounds (e.g. exterior day, exterior night, interior) | Shader scene per backdrop key (`SCENE_FS` KIND) with day/dusk/night lighting, **or** painted layers `backdrops/<key>-far/mid/near/fx.png` at 3840×2160 → 1920×1080 WebP | In-house (shader) or Vendor B (painted) | reference → prototype → look-dev → in-engine (all tiers) |
| 2 | Ambient loops for the location | 2 flicker or sway loops (12 fps), 1 weather or dust overlay | In-house | as above |
| 3 | 4 portraits (1 principal, 3 supporting) | 3 expressions each + blink + lip-flap; raymarched bust profile (PORTRAIT_FS style, cloth/skin/hair) or painted layers 2048 px tall → 1024 | Vendor A (painted) / in-house (rig) | thumbnail → rough → line → colour → in-engine |
| 4 | Malison variant | Callout sheet (3 states), `CREATURE_FS` mode or sprite flipbooks (idle, attack tell, hurt, death 24 frames), VFX spec rows (docs/art/vfx/README.md template) | Vendor B (callout) + in-house (shader, VFX) | callout → shader prototype → in-engine |
| 5 | 6 ailments | Per ailment: surface decal, sprite states (fresh / worked / cleared), a VFX row, a readability check on each flesh set it appears on | In-house + Vendor B paint-ups | rough → in-engine |
| 6 | Codex and Book-of-Hours card for the Malison | Illuminated miniature 1024², parchment frame | Vendor C | rough → colour |
| 7 | Store and trailer art | Update capsule overlay, 5 screenshots, trailer from the update template (update-trailer-template.md) | Marketing + in-house capture | — |

## Cost estimate (USD)

| Line | Basis | Qty | Unit | Cost |
| --- | --- | --- | --- | --- |
| Portraits (painted) | per expression | 12 | 1,000 | 12,000 |
| Background paint-overs (if painted layers are used) | per background | 3 | 600 | 1,800 |
| Malison variant callout + paint-ups | lump sum | 1 | 3,000 | 3,000 |
| Ailment paint-ups | per ailment | 6 | 400 | 2,400 |
| Book-of-Hours card | per card | 1 | 800 | 800 |
| Store art (capsule overlay, banner) | lump sum | 1 | 1,500 | 1,500 |
| **Subtotal (vendors)** | | | | **21,500** |
| **Contingency 15 %** | | | | **3,225** |
| **Total cash** | | | | **24,725** |

In-house time (not cash): about 3 weeks of render engineering for the shader location, the
Malison mode and the VFX, and 1 week of the art lead's time for QA, budgets and tracking.

## Schedule (10 weeks)

| Weeks | Work |
| --- | --- |
| 1–2 | Brief, reference boards, Malison callout, portrait thumbnails |
| 3–5 | Location look-dev, portrait batch (rough → colour), ailment prototypes |
| 6–8 | Malison in-engine, ailments in-engine, portraits in-engine, VFX rows |
| 9 | Art QA, budgets re-run (`scripts/art/budget-report.mjs`), colour-blind pass (`scripts/art/cvd-report.ts`) |
| 10 | Store art, screenshots, trailer capture; buffer |

## Budgets to re-check

Per-chapter memory (ART-0375), atlas pages (≤ 6), particle caps, the draw budget, and the
download size (`npm run assets`) all get re-run with the new chapter's operations added to the
budget report's scene list.
