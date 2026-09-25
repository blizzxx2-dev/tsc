# Assets — source layout and pipeline

Source art lives in `assets/`; `npm run assets` (`node scripts/build-assets.ts`) turns it into
content-hashed files under `public/assets/` plus the typed manifest `src/assets/manifest.gen.ts`.
Both outputs are committed so a plain `vite build` works; `npm run build` runs the script with
`--check` and fails if they are stale or invalid.

## Layout

| Folder | Contents | Manifest type |
| --- | --- | --- |
| `assets/sprites/<sheet>/` | One PNG per frame + optional `_sheet.json` (`pivots`, `anims`). Packed into atlas pages. | `sheet` (id `sprites/<sheet>`) |
| `assets/backdrops/` | Painted story backdrops (PNG/WebP). | `image` |
| `assets/portraits/` | VN portrait layers. | `image` |
| `assets/luts/` | 32³ colour LUTs as 1024×32 PNG strips. | `lut` |
| `assets/fonts/` | WOFF2 faces; each needs a `fonts` entry in `bundles.json` (family/style/weight). OFL licence texts sit beside them. | `font` |
| `assets/particles/` | Emitter definitions (JSON). | `json` |
| `assets/shaders/` | GLSL sources (reserved for ENG-0206). | `shader` |
| `assets/audio/` | OGG/MP3/WAV cues and music. | `audio` |

Files starting with `.` or `_`, and `README`/`OFL`/`LICENSE` files, are not shipped.

## Ids and naming

- An asset id is its path under `assets/` without the extension: `backdrops/hospice`, `fonts/im-fell-english-latin-400-normal`.
- Sprite frames are `<sheet>/<file name>`: `fx/soft-round`. Draw them with `gfx.sprite('fx/soft-round', x, y, opts)`.
- Use lowercase kebab-case. Chapter-specific art is prefixed `ch1-`/`ch2-` so the bundle rules route it.
- `AssetId` is a generated union type: loading an id that does not exist is a compile error.

## Bundles

`assets/bundles.json` maps ids to bundles with ordered regex rules (the first match wins):
`boot`, `title`, `story-common`, `ops-common`, `chapter1`, `chapter2`. The boot sequence loads
`boot` (fonts) behind the DOM splash, then prefetches `title` and `ops-common`. The campaign flow
prefetches the next chapter during story scenes and unloads chapters left behind
(`src/scenes/flow.ts`). Loading is reference-counted (`assets.load(id)` / `assets.release(id)`).

## Validation (build fails on any of these)

- a texture over 4096 px, or an atlas page that is not a power of two;
- a LUT that is not 1024×32;
- a `gfx.sprite('…')` / `assets.load('…')` literal that names a missing frame or asset;
- an asset over 50 KB that nothing in `src/` references (fonts, LUTs and sheets are consumed automatically);
- a font without a face entry, or an unknown bundle;

The script prints a per-bundle size report on every run. There is no size budget: assets ship at full authored quality.

## Atlases

`scripts/pack-atlas.ts` (also run by the asset build) packs each sprite folder with MaxRects
(best short side fit) into pages of at most 2048², each shrunk to the smallest power of two that
fits, with 2 px extruded borders against bilinear bleeding. Output depends only on frame names and
pixels, so identical input yields byte-identical pages and JSON.

`scripts/gen-brushes.ts` regenerates the procedural effect brushes in `assets/sprites/fx/`.

## Runtime fallbacks

A missing or failed image draws as a magenta checker, audio falls back to silence, JSON to `{}`
and fonts to the system serif stack. Each logs a warning; none throws.
