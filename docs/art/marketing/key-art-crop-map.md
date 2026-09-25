# Key-art crop map (ART-0313)

Every store and social image is cut from the one layered key-art master (ART-0312,
**6000×3375**, 16:9). This page fixes each crop's rectangle on the master, where the logo goes and
what must stay clear, so the painter composes once and every crop still works. Coordinates are in
master pixels, origin top-left: `x, y, width×height`.

## Composition anchors on the master

The painter keeps these where they are listed. The crops below depend on them.

| Anchor | Master position | Why |
| --- | --- | --- |
| Malison eye (centre) | 3000, 850 | Community icon and avatar crop to it; it sits inside the library-hero band |
| Kreuzer's head | 2500, 1300 | Inside every crop except the icon and avatar |
| Wound-Man patient (torso centre) | 3000, 1900 | Inside the core box |
| Ilse's head | 3650, 1450 | Inside the core box, clear of the library capsule's right edge (3925) |
| Stroh in shadow | 900, 1500 | Wide crops only. He may be cropped out of the tall ones |

**Core box** (x 1675–3925, y 631–2141): the area inside every crop except the icon and avatar.
Faces and the eye must sit in it. Nothing important goes within 150 px of any crop edge.

## Crops

| Deliverable | Size (px) | Crop on master | Scale | Logo | Keep clear |
| --- | --- | --- | --- | --- | --- |
| Header capsule (ART-0316) | 920×430 | 0, 98, 6000×2804 | 0.153 | Centre-left, ≥ 60 % of the height of the band y 150–330, over Stroh's shadow side | Kreuzer's face and the eye |
| Small capsule (ART-0316) | 462×174 | 800, 559, 4200×1582 | 0.110 | Logo fills ≥ 70 % of the width. Legible at 50 % downscale (test at 231×87) | The logo only: the art is texture here |
| Main capsule (ART-0317) | 1232×706 | 55, 0, 5890×3375 | 0.209 | Lower third, centred | The eye (top) and the patient |
| Vertical capsule (ART-0317) | 748×896 | 1391, 0, 2818×3375 | 0.265 | Top 25 %, above the eye | Kreuzer, Ilse and the patient |
| Library capsule (ART-0318) | 600×900 | 1675, 0, 2250×3375 | 0.267 | Bottom 30 % | The eye and Kreuzer. Ilse may touch the right edge |
| Library hero (ART-0318) | 3840×1240 | 0, 631, 6000×1938 | 0.640 | **None** (logo-free; Steam overlays the library logo at the left third) | Left third (x < 2000 on the master) kept dark and quiet for the overlaid logo |
| Library logo (ART-0318) | ≤ 1280×720, transparent | — (logo layer only) | — | The whole image | — |
| Page background (ART-0319) | 1438×810 | 4, 0, 5992×3375 | 0.240 | None | Darkened by 60 %; Steam's page column covers the centre 940 px |
| Community icon (ART-0319) | 184×184 | 2550, 400, 900×900 | 0.204 | None | The eye fills the middle 60 % |
| Demo capsules (ART-0320) | as header and main | as header and main | — | As above, plus the "FREE DEMO" band along the bottom 18 % | The band never covers a face |
| X / Bluesky banner (ART-0328) | 1500×500 | 0, 400, 6000×2000 | 0.250 | Right half | Bottom-left 400×200 px of the banner (the avatar overlaps it) |
| YouTube banner (ART-0328) | 2560×1440 | 0, 0, 6000×3375 | 0.427 | Inside the centre 1546×423 safe area | Everything outside the safe area is decoration (TV only) |
| Discord banner (ART-0328) | 960×540 | 0, 0, 6000×3375 | 0.160 | None | Top-left 300×120 px (the server name) |
| Social avatar (ART-0328) | 400×400 | 2550, 400, 900×900 | 0.444 | None | Circle-masked: the eye stays within the inner 80 % |

## Rules

- Crops are exported from the layered master with the logo as a separate layer placed per crop.
  The logo is never baked into the master.
- Every crop is a downscale (scale < 1). Nothing is upscaled from the master.
- Base capsules carry no review quotes, laurels or discount text (ART-0321). Sale overlays come from
  the template (ART-0327) and are applied only to sale-period copies.
- Check each export at 100 % and at 50 %. The logo must read at 50 % on the header and small
  capsules (ART-0316).
