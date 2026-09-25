# Performance targets

These are the frame-time and memory budgets for the Chapters 1–2 demo and the full game. The
profiler overlay (F3) draws its budget lines and colours from the same numbers
(`src/render/profiler.ts`, `src/render/registry.ts`).

## Frame rate by hardware

| Hardware | Resolution | Tier preset | Target |
| --- | --- | --- | --- |
| Intel UHD 620 / Iris Xe laptop | 1920×1080 | Medium | 60 fps sustained in every Ch1–2 operation |
| Steam Deck (LCD/OLED) | 1280×800 | Medium | 60 fps; the 40 fps preset must hold with ≥25% lower APU power |
| GTX 1060 / RX 580 desktop | 1920×1080 | High | ≥144 fps |
| Intel HD 520 (minimum spec) | 1280×720 | Low | ≥30 fps |

Frame pacing: with a frame cap below the display refresh, frame-to-frame jitter stays under 1 ms.
No frame may exceed 50 ms during an operation (shader first use, atlas upload, GC, save write).
The profiler counts frames over `HITCH_MS` (50) and keeps the worst frame (`Profiler.hitchReport()`,
shown on the F3 overlay as `worst … hitches>50 …`); `scripts/qa/soak.mjs` records both per minute and
fails on any hitch with `--assert-hitch` (ENG-0224). The assertion is opt-in because the CI software
rasteriser (SwiftShader) cannot hold 50 ms frames; run it on real hardware.

The flesh field samples baked 512² tiling noise textures (fbm + gradient, voronoi distances; ENG-0081)
instead of evaluating fbm per pixel. Measured in SwiftShader at 1080p (relative only): 3.3–3.7 s per
pass before, 1.2–1.5 s after (≈2.5–3×). Baking costs ~0.3–0.7 s of CPU once at boot, before any scene.

## CPU budget (per frame, main thread)

Total CPU frame time ≤ **6 ms** on the reference laptop.

| System | Budget |
| --- | --- |
| Simulation (all fixed 120 Hz ticks in the frame) | 1.5 ms |
| Batching (shape tessellation, text layout, vertex upload) | 2.0 ms |
| Everything else (input, audio scheduling, scene logic) | 2.5 ms |

## GPU budget (per frame, 1080p, Intel UHD 620, Medium)

| Pass | Budget |
| --- | --- |
| Flesh field (`FLESH_FS`) | 3.0 ms |
| Particles | 2.0 ms |
| Post chain (bloom, grade, vignette, grain, Litany) | 2.0 ms |
| Data layers + world primitives + UI | 2.0 ms |

Headroom to 16.7 ms covers driver overhead and compositor cost.

## Memory

| Resource | Low | Medium | High |
| --- | --- | --- | --- |
| VRAM (tracked by the GL resource registry) | 384 MB | 576 MB | 768 MB |
| JS heap | 300 MB | 300 MB | 300 MB |

Exceeding a budget logs one warning listing the ten largest GPU consumers. A 2-hour soak must
keep heap growth under 5% and the GL object count stable. Steady-state allocation in an operation
stays under 50 KB/s.

## Load times

Cold start to the title screen ≤ 5 s on a SATA SSD (the boot log prints `boot to title: N ms`).
Demo install ≤ 150 MB of game assets; `npm run assets` fails past that.

## How to measure

- **In game:** F3 toggles the profiler overlay: CPU scopes, GPU pass timings when
  `EXT_disjoint_timer_query_webgl2` exists (CPU-only otherwise), draw calls, vertices, texture MB,
  JS heap, and a frame-time graph with the 16.7 ms and 6 ms lines. In dev/QA builds, F4 saves the
  last 600 frames as CSV.
- **Headless:** `node scripts/boot-log.mjs` prints boot timing, caps and tier. `node scripts/fps.mjs`
  measures relative frame rate under SwiftShader. Use these numbers only to compare builds; they are
  not representative of real GPUs.
