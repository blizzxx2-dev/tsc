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

## Atlases and flipbooks (ART-0036/0038)

`scripts/pack-atlas.ts` packs every `assets/sprites/<sheet>/` folder (MaxRects, pages ≤ 2048²,
2 px extrude). A flipbook is a run of frames named `<anim>-<n>.png` plus an `anims` entry in the
sheet's `_sheet.json`:
`{ "anims": { "splash": { "frames": ["splash-1", "splash-2"], "ms": 60, "mode": "once" } } }`.
Frame order is explicit. `ms` is per frame (a number or a list), and `mode` is `loop`, `once` or
`pingpong` (`src/render/sprites.ts`).
