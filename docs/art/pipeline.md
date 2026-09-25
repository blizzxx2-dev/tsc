# Art pipeline

How art gets from idea to screen, for both procedural looks (shaders, `src/art/*`) and painted
assets (`assets/`). The art bible (`docs/art/bible/README.md`) defines what it should look like.
This page defines how it is made, named, stored and approved.

## Review cadence (ART-0028)

- **Weekly art review**, 45 minutes: art director, the ENG render owner and whoever has work in
  review. Each asset in review gets a row in `docs/art/reviews/<yyyy>-<ww>.md`, copied from
  `docs/art/reviews/_template.md`.
- The row records asset, stage, feedback, owner, due date, and the IP checklist box (bible §3).
- Procedural looks are reviewed from `?scene=artview` / `?scene=fleshlab` captures and in-game
  screenshots (`npm run shot`, `scripts/qa/shot-settings.mjs` for comfort options).

## Approval stages (ART-0029)

Every asset class goes **thumbnail → rough → line → colour → in-engine**. A stage is approved in the
weekly review and no stage is skipped without the director's sign-off, which is recorded in the
review row. Procedural looks go **reference board → shader prototype → tuned in look-dev →
in-engine at all tiers (low/medium/high) → comfort variants** (gore levels, colour filters,
reduced motion).

## Naming (ART-0031)

The project convention is lowercase kebab-case, `subject-variant-state[@2x].ext`, inside a
category folder. The folder carries the category:

| Folder (category) | Example |
| --- | --- |
| `assets/backdrops/` | `ch1-hospice-ward-night.webp` |
| `assets/portraits/` | `ilse-worried@2x.webp` |
| `assets/sprites/<sheet>/` | `fx/splatter-3.png` |
| `assets/luts/` | `candle.png` |

Chapter art is prefixed `ch1-`/`ch2-` so the bundle rules route it (`assets/bundles.json`).
`npm run assets` (`scripts/build-assets.ts`) fails on any file that does not match
`^[a-z0-9]+(-[a-z0-9]+)*(@[1-4]x)?\.[a-z0-9]+$`. Metadata files (`_sheet.json`) and licence texts
are exempt. This replaces the original `cat_subject_variant_state@scale` proposal, because ids
are paths and the folder already names the category.

## Source storage (ART-0032)

Layered sources (PSD, KRA, BLEND, ASEPRITE, TIFF masters) live in `art-src/`, tracked by Git LFS
(`.gitattributes`). Only exports go in `assets/`. Contributors need `git lfs install` once.

## Export spec (ART-0033)

| Class | Ship format | Master |
| --- | --- | --- |
| UI art, icons, sprites (atlased) | PNG, lossless, premultiplied at load | PNG 2× |
| Story backgrounds | WebP q90 | PNG / PSD 3840×2160 |
| Portrait layers | WebP lossless (alpha) | PSD 2048 px tall |
| Flesh detail textures | KTX2/Basis (if used; the flesh is procedural today) | PNG 16-bit |
| LUTs | PNG 1024×32 strip | — |

## Authoring resolution (ART-0034)

Backgrounds are painted at 3840×2160 and shipped at 1920×1080. Portraits are painted 2048 px tall
and shipped at 1024 px. UI art is drawn at 2× the 1280×720 virtual space (2560×1440), and HUD
elements are checked at 1280×800 (Steam Deck).

## Export tools and `npm run art:export` (ART-0035, ART-0037, ART-0042)

Every artist exports the same way: the shared scripts in `art-src/tools/`
(`krita_export.py` for Krita's Scripter, `photoshop-export.jsx` for File ▸ Scripts) write a flattened
8-bit sRGB PNG at master resolution into `art-src/export/<category>/…` — documents are named
`<category>--<name>` (sprites `sprites-<sheet>--<name>`), and top-level layers named `frame: <name>`
export as separate sprite frames.

`npm run art:export` (`scripts/art/export.ts`) then makes the ship files in `assets/`: resized to the
ship resolution (backdrops, portraits and sprites ×0.5 from their 2× masters; UI and LUTs as
authored), transparent borders trimmed (portraits, sprites, UI), compressed per the export spec
(WebP q90 backdrops, lossless WebP portraits, PNG otherwise), and recorded in
`assets/manifest.json` with size, byte count, content hash, trim box and each sprite's atlas page.
It never upscales and refuses an export smaller than the one it would replace (a master below
spec). `npm run art:export -- --check` fails when an export is stale.

Atlas pages are written **premultiplied** (ART-0037): colour is scaled by coverage, the page JSON
says `"premultiplied": true`, and the batch shader filters those pages premultiplied and
un-premultiplies, so no dark (or bright) fringe appears at any mip level. Check edges on
parchment and on flesh at `?scene=woundlab&page=6`.

## Atlases and flipbooks (ART-0036/0038)

`scripts/pack-atlas.ts` packs every `assets/sprites/<sheet>/` folder (MaxRects, pages ≤ 2048²,
2 px extrude). A flipbook is a run of frames named `<anim>-<n>.png` plus an `anims` entry in the
sheet's `_sheet.json`:
`{ "anims": { "splash": { "frames": ["splash-1", "splash-2"], "ms": 60, "mode": "once" } } }`.
Frame order is explicit. `ms` is per frame (a number or a list), and `mode` is `loop`, `once` or
`pingpong` (`src/render/sprites.ts`).

## Hot reload (ART-0039)

With `npm run dev` running, saving any file under `assets/` rebuilds the hashed outputs and
manifest in about 200 ms (the `assets-hot-reload` plugin in `vite.config.ts`). The page then
swaps every changed asset that is already loaded without reloading (`AssetLoader.hotSwap`).
Backdrop layers and 9-slice frames pick up the new hash the next time they draw. The console
logs `[assets] hot-swapped N asset(s)`.

## Art metadata: status, 9-slice, pivots, layers (ART-0041/0045/0047/0048)

`assets/_meta.json` holds ordered `{ match, … }` rules, each with a regex matched against the
asset id. Every matching rule merges its fields onto the manifest entry, so broad rules go
first and narrow ones after.

| Field | Meaning |
| --- | --- |
| `status` | `placeholder`, `wip` or `final`. Every asset must have one. The build prints a count per status and **fails if any asset in a demo bundle is `placeholder`**. |
| `nine` | 9-slice margins `[left, top, right, bottom]` in source px. `nineSlice()` (`src/ui/nineSlice.ts`) keeps the corners native and stretches the rest. `panel()` uses `ui/panel-oak` and `parchment()` uses `ui/parchment-frame` when they exist, and fall back to the procedural kit otherwise. |
| `pivot` | `[x, y]` in 0..1 of the image. For ailment sprites this is the wound centre. |
| `angle0` | The embed direction the sprite was painted at, in radians (0 = pointing right, clockwise positive in screen space). `Embedded` entities are procedural today. When painted shafts replace them, they draw rotated by `entity.angle - angle0`, so paint them in whatever direction reads best. |
| `layer`, `parallax` | Backdrop layers. Name files `backdrops/<key>-far|mid|near|fx.png`, where `<key>` is a `Backdrop` id (`hospice`, `street`…). The build sets `layer` from the name, and default parallax factors are 0.1 / 0.35 / 0.7 / 1. When any layer exists for a key, `drawBackdrop` draws the layers far to near in place of the procedural scene. |

## Per-chapter bundles (ART-0043)

Art prefixed `ch1-` … `ch5-` routes to the `chapter1` … `chapter5` bundles (`assets/bundles.json`).
The campaign flow holds the current chapter, prefetches the next during story scenes and unloads
chapters left behind. The demo build ships the manifest ids but never requests the Chapter 3–5
bundles, and `npm run check:demo-bundle` guards the code side.

## Flesh texture input spec (ART-0046, agreed with ENG)

The operating-field flesh is procedural (`FLESH_FS`). Painted detail textures, if added, layer
over it with this packing, per organ kind, at 1024² and tileable:

| Map | Space | Channels |
| --- | --- | --- |
| Albedo | sRGB | RGB. Alpha unused |
| Normal | linear, tangent space, OpenGL +Y (green up) | RGB |
| Mask | linear | R wet/spec, G vein mask, B cavity/AO, A height |

Name them `sprites/flesh/<organ>-albedo|normal|mask.png`. This is the contract for the
shader hookup: the albedo is a multiplier around mid-grey (0.5 = no change), so the procedural
species tint and gore level still apply. The normal map adds to the procedural bumps. Mask R
scales the wet specular, G scales the vein glow and pulse, B darkens creases and A feeds the
parallax offset. Author at 2048² and export at 1024².

## Colour management (ART-0049)

- Author and export everything in **sRGB** (no embedded wide-gamut profiles; strip ICC on
  export). Normal maps and masks are linear data and must be exported without colour
  conversion.
- Check previews on a display calibrated to sRGB, D65, gamma 2.2, 120 cd/m² (ΔE00 < 3 on a
  test chart). Record the calibration date in the review sheet.
- Flesh albedo is judged **through the grade**: open `?scene=fleshlab`, which shows the flesh
  under every grade LUT including candlelit, and approve it there, never in the painting app.
- Palette matches use the master swatches (`src/render/palette.ts`, `docs/art/palette.gpl`).
  `nearestSwatch()` and the ΔE test enforce UI tokens, and the same ΔE 6 tolerance is the
  review bar for painted UI.

## 3D assets (scripted Blender pipeline)

Models are built from code: `art-src/blender/models/*.py` run headless under Blender's Python
module (`pip install bpy==4.2.0` into Python 3.11; set `BLENDER_PY` to that interpreter) via
`npm run art:models [-- <script>]`. Each script writes `assets/models/<name>.glb` and a Cycles
review render into `docs/art/renders/`. Shared helpers (turned profiles, swept tubes, world-scale
UVs, PBR materials, glTF export) live in `art-src/blender/lib/common.py`.

- **Textures** are CC0 Poly Haven sets listed in `art-src/textures.json`, fetched at full 4K into
  `art-src/.cache/textures` (colour maps JPEG, normal and AO/rough/metal maps lossless PNG). Colour
  grades are baked into the colour map at full resolution; nothing is downscaled.
- **Anchors**: empties named `cam`, `cam.target`, `key`, `key.target`, `candle.*` place the camera
  and lights; their custom properties (fov, colour, intensity, cone, range) export as glTF extras
  and drive `src/scenes/sets.ts`.
- **Materials** may carry custom properties `sss` (skin/wax/cloth scattering) and `flicker`
  (candle-flame emissive), read by the renderer (`src/render/renderer3d.ts`).
- **Storage**: generated models are not committed (`assets/models/` is git-ignored, files exceed
  GitHub's 100 MB limit). Run `npm run art:models` then `npm run assets` after cloning; until
  then the game shows the procedural backdrops.
