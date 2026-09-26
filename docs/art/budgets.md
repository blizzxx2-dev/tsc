# Art performance budgets (ART-R)

Measured with `npm run build:qa && node scripts/art/budget-report.mjs` (ART-0365/0366/0368). The
script opens each scene type in the QA build at **1920×1080**, starts operations through the
automation API, and reads the GL resource registry (tracked GPU memory by label) and the
batcher's last-frame counters (the numbers the F3 profiler overlay shows). The operation rows are
measured twice: steady, and at **peak VFX** (Litany running, with blood, sparks, motes, gold,
smoke and dust bursts all at their particle caps). Measured 2026-09-25 under SwiftShader. Byte
counts don't depend on the GPU, and vertex and draw counts don't either.

## Texture memory — ≤ 256 MB in any scene on min-spec (ART-0365)

| Scene type | Tracked GPU memory (all textures + render targets) | Art textures only | Largest allocations |
| --- | --- | --- | --- |
| Title | 159.8 MB | 55.6 MB | MSAA world colour 63.3, MSAA depth 31.6, glyph atlas 21.3, scene target 15.8 |
| Story (hospice, camp) | 159.8 MB | 55.6 MB | same |
| Operation (op1-2) | 159.8 MB | 55.6 MB | same |
| Operation, boss (Matins, Lauds) | 159.8 MB | 55.6 MB | same |

**Within budget: 160 MB of 256 MB at 1920×1080, in every scene type.** The minimum spec (Intel
HD 520) runs the Low tier at 1280×720, and the integrated target (UHD 620) runs Medium at
1920×1080 (docs/perf-targets.md). Both are at or below the measured case, and the render targets,
which dominate, shrink with resolution. The shader-drawn art (flesh, sets, portraits, bosses)
holds no textures of its own. The art textures are the 2048² glyph atlas, the `fx` sheet and the
two baked noise textures. At 4K output the render targets alone go past 256 MB. That is the
High-tier, discrete-GPU case, governed by ENG's VRAM budget (docs/perf-targets.md: 384/576/768 MB)
rather than this one.

Budget rule for new art: painted textures an operation keeps resident may add at most **96 MB**
(the art share left under 256 MB at 1080p). Check with the report after adding a sheet.

## Atlas pages — ≤ 6 pages of 2048² resident in an operation (ART-0366)

| Scene | Atlas pages resident |
| --- | --- |
| Every operation measured | **2**: the glyph atlas (UI and HUD text) and the `fx` sprite sheet (packed ≤ 2048² by `scripts/pack-atlas.ts`) |

**Within budget (2 of 6).** Reserve: tools, ailments, VFX, boss and portrait callouts may take at
most one page each, as the roadmap line splits them.

## Draw budget — ≤ 3 texture binds and ≤ 20k batched vertices at peak VFX (ART-0368) — NOT MET

| Operation | Steady: draw calls / texture flushes / vertices | Peak VFX: draw calls / texture flushes / vertices |
| --- | --- | --- |
| op1-2 | 53 / 0 / 24,693 | 57 / 0 / 49,095 |
| Matins | 71 / 0 / 47,049 | 73 / 0 / 67,947 |
| Lauds | 81 / 0 / 42,342 | 83 / 0 / 64,716 |

Texture binds are within budget: the batcher never flushed for a texture change. The **vertex
count is over** already at steady state (24.7k–47k), and doubles at peak VFX. It comes from
tessellated procedural primitives (circles, gradient discs, polylines) in the entities, the HUD
and the VFX layer. The effects stay under their particle caps (ART-0373). The fix belongs to ENG
and ART together: lower per-circle segment counts for small radii, draw soft discs as one quad
with a radial falloff in the batch shader, and cache static HUD geometry. Until that lands this
budget stays open.

## Other rules in this section

| Task | Status | Notes |
| --- | --- | --- |
| ART-0367 flesh texture budget | Met | One surface set is resident at a time: skin detail and linen/wood at 512², the low-frequency tone mottle at 256², **4.5 MB** with mips against a 5.3 MB cap. Entering an operation with another species' set releases the maps it doesn't share (`SurfaceSetCache`, src/render/surfaceSets.ts). The Low tier loads no maps and keeps the procedural detail. Tested in tests/unit/art/surfaceSets.test.ts. |
| ART-0369 overdraw ≤ 4× | Needs a Steam Deck | Measure on the Deck with the GPU overdraw view while the Litany, motes and sparks are all active. |
| ART-0370 download size | Met | `npm run assets` prints demo art MB against the 400 MB budget and lists the 20 largest assets. |
| ART-0371 background layers | Not applicable today | Story backgrounds are shader scenes with no WebP layers. The rule applies when painted layers are added. |
| ART-0372 portraits | Not applicable today | Portraits are raymarched busts (PORTRAIT_FS) with no texture pages. |
| ART-0373 particle caps | Met | `PARTICLE_CAPS` in src/render/particles.ts, tested in tests/unit/art/vfx.test.ts. |

## Asset lint (ART-0354)

`npm run assets:lint` (`build-assets --check`, a CI step) fails on: non-kebab-case names; images over
4096 px; sprite pages and tiling surface maps that aren't square powers of two; loose PNGs stored with
straight alpha (colour above coverage); LUTs that aren't 1024×32; files over their type's byte budget
(image 4 MB, sheet 8 MB, font 256 KB, JSON 1 MB, shader 64 KB, LUT 256 KB, audio 8 MB, text 256 KB,
surface maps 512 KB); and **orphaned manifest entries**, that is, any asset not loaded wholesale by type
(fonts, LUTs, sheets, models) whose id is never named in src/. Models are built locally, uncommitted,
and governed by `art:compress-models` and the download budget.

