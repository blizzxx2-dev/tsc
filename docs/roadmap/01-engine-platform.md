# 01 — Engine & Platform · Suture & Steel: The Malison Hours

Workstreams: **`ENG`** Engine & Rendering (WebGL2) · **`PLT`** Platform, Build & Systems.

Baseline this roadmap builds on (as of the M0 prototype):
- `src/render/gfx.ts` — one batched WebGL2 renderer: a single dynamic VBO (60k verts, `x,y,u,v` + packed RGBA),
  CPU-side affine transform stack, alpha/additive blend, one texture (the 2048² glyph atlas with a white texel for shapes).
  World drawing goes to an RGBA8 offscreen target (no MSAA) → quarter-res bloom → one monolithic `POST_FS`;
  UI draws straight to the backbuffer. `fleshField()` is a fullscreen procedural pass (`FLESH_FS`).
- `src/render/text.ts` — glyphs rasterised on demand via a 2D canvas at 56 px, the whole atlas re-uploaded + re-mipped on every new glyph.
- `src/main.ts` — variable-step rAF loop (dt clamped to 50 ms), `Game.go()` swaps scenes with no lifecycle, 16:9 letterbox, DPR capped at 2.
- `src/surgery/*` — DOM-free seeded sim, but entities own their `draw(g, op)`, IDs come from a module-level counter, and the op scene
  still uses `Math.random` for shake/ECG jitter.
- `src/core/save.ts` — localStorage JSON, `version: 1`; any version mismatch silently returns a fresh save.

Phase tags: `Demo` = required for the release-quality Chapters 1–2 Steam demo; `Alpha`/`Beta`/`Release` = Chapters 3–5 and the full game; `Post` = after launch.

---

## ENG-A · Engine foundation (M0 prototype — shipped)

### Core loop, math & input
- [x] ENG-0001 · M0 · P0 · S · Vite 6 + TypeScript 5.9 strict + Vitest 3 scaffold — `npm run build` = `tsc --noEmit && vite build`, `npm test` runs Vitest
- [x] ENG-0002 · M0 · P0 · S · Seeded mulberry32 `Rng` and Vec helpers — `pointSegment`, `segmentsIntersect`, `side` in `src/core/math.ts`
- [x] ENG-0003 · M0 · P0 · S · rAF main loop — dt clamped to 50 ms, dispatches `scene.update(dt)` / `scene.render(gfx)` (`src/main.ts`)
- [x] ENG-0004 · M0 · P0 · S · Minimal scene model — `Scene` interface (`enter/update/render`) and `Game.go()` replacement (`src/core/scene.ts`)
- [x] ENG-0005 · M0 · P0 · S · Input — pointer mapped from CSS px to 1280×720 virtual space, left/right buttons, wheel, per-frame key latching
- [x] ENG-0006 · M0 · P1 · S · Coalesced pointer sampling — per-frame `Input.path` (≤64 samples) so fast strokes survive low frame rates
- [x] ENG-0007 · M0 · P0 · M · DOM-free, seeded operation simulation drivable headlessly (`Operation`, `Entity`) — covered by the star-gesture unit tests

### Renderer
- [x] ENG-0008 · M0 · P0 · L · Batched WebGL2 2D renderer `Gfx` — single dynamic VBO, packed-ABGR vertex colour, transform stack, alpha/additive blend
- [x] ENG-0009 · M0 · P0 · M · Shape primitives — rect, gradient rect, ellipse, radial gradient, additive glow, poly fan, line, polyline, dashed, arc, quad curve
- [x] ENG-0010 · M0 · P0 · M · Glyph-atlas text (IM Fell English regular/italic, UnifrakturMaguntia) batched with shapes — `warm()` pre-rasterises ASCII + typographic marks
- [x] ENG-0011 · M0 · P0 · M · World/UI split — world layer rendered offscreen and post-processed, UI drawn to the backbuffer afterwards
- [x] ENG-0012 · M0 · P0 · L · Procedural flesh shader — fbm/voronoi surface, ridged veins, wet specular, linen drape, curse corruption, 7 organ kinds, species tint via `organPalette`
- [x] ENG-0013 · M0 · P0 · M · Post chain — bright-pass + separable-blur bloom, candlelit grade, vignette, grain, candle flicker, Litany ripple/sepia, low-vitals red pulse, shake offset
- [x] ENG-0014 · M0 · P1 · S · Letterboxed 16:9 canvas — device-resolution backbuffer (DPR capped at 2) resized with the window
- [x] ENG-0015 · M0 · P1 · S · WebGL2 fatal fallback — friendly message instead of a blank page when WebGL2 is unavailable
- [x] ENG-0016 · M0 · P1 · M · Headless smoke test `scripts/smoke.mjs` — Playwright + SwiftShader boots the build, walks title → story → briefing → operations, saves screenshots, collects console errors
- [x] ENG-0017 · M0 · P2 · S · Dev hooks — `?op=<id>` jumps straight into an operation; `window.__game` exposes the game for automation

## ENG-B · Renderer core architecture (Demo)

### Render state & batching
- [ ] ENG-0018 · Demo · P1 · M · Split `Gfx` into `GlDevice` (programs, targets, state), `Batcher` (vertex building) and `Painter` (shape/text API) modules with no behaviour change — smoke screenshots differ by <0.5% of pixels
- [ ] ENG-0019 · Demo · P1 · M · Batch key = (program, texture set, blend, layer); `flush()` fires only when the key changes — unit test with a mock `WebGL2RenderingContext` asserts ≤6 draw calls for the op1-5 HUD frame
- [x] ENG-0020 · Demo · P2 · M · Add a static quad index buffer so rects/glyphs/sprites cost 4 vertices instead of 6 — vertex count on the results screen drops ≥30% (`gfx.stats`)
- [ ] ENG-0021 · Demo · P2 · M · Replace full-range `bufferSubData` each flush with a 3-segment orphaned ring buffer — Chrome GPU trace shows no implicit sync stalls during an operation
- [x] ENG-0022 · Demo · P1 · S · Guard against `MAX_VERTS` overflow for single primitives larger than the buffer (split or grow) — drawing a 200k-vertex polyline renders correctly in a test
- [x] ENG-0023 · Demo · P2 · S · Precomputed unit-circle cos/sin tables per segment count for `ellipse`/`arc`/`circleGrad` — micro-benchmark shows ≥2× faster tessellation
- [x] ENG-0024 · Demo · P1 · S · `gfx.stats` per frame — draw calls, vertices, flushes by reason (blend/texture/program/overflow), texture uploads
- [ ] ENG-0025 · Demo · P1 · M · Premultiplied-alpha pipeline (colour packing, atlas, blend `ONE, ONE_MINUS_SRC_ALPHA`) — golden image shows no dark fringes around `glow()` and glyph edges on light parchment
- [x] ENG-0026 · Demo · P2 · S · `multiply` and `screen` blend modes — plus `withBlend(mode, fn)` that restores the previous mode even if `fn` throws
- [x] ENG-0027 · Demo · P1 · S · Scissor clip stack `pushClip(rect)`/`popClip()` — virtual coords converted to device px (unit test for letterbox + DPR) for scrolling text panels
- [ ] ENG-0028 · Demo · P1 · M · Stencil mask API (`beginMask`/`endMask`/`clearMask`) on the world target (depth-stencil attachment) — entities inside an incision are clipped to the opening outline
- [x] ENG-0029 · Demo · P2 · S · GL state cache (program, VAO, bound textures per unit, blend, framebuffer) — WebGL inspector reports 0 redundant state calls in a steady-state operation frame

### Textures & sprite sheets
- [x] ENG-0030 · Demo · P0 · M · `Texture` wrapper — load from `ImageBitmap` (`createImageBitmap`, premultiply option), filtering/wrap/mip settings, byte size tracked for the VRAM budget
- [x] ENG-0031 · Demo · P0 · M · Multi-texture batching: `PRIM_FS` samples up to 8 units selected by a per-vertex texture index — text + 3 sprite pages render in one draw call (draw-call counter test)
- [x] ENG-0032 · Demo · P0 · M · Sprite API — `sprite(frameId, x, y, {rot, scale, tint, flipX, pivot, alpha})` renders atlas sub-rects from a frame table; golden image test
- [x] ENG-0033 · Demo · P0 · M · Build-time atlas packer `scripts/pack-atlas.ts` — MaxRects packing of `assets/sprites/<sheet>/*.png` into 2048² pages with 2 px extruded borders + JSON frame table; byte-identical output for identical input
- [x] ENG-0034 · Demo · P1 · M · Sprite-sheet animation — frame sequences with per-frame durations from JSON; `AnimPlayer` supports loop/once/ping-pong and completion callbacks (unit tests)
- [x] ENG-0035 · Demo · P1 · S · `nineSlice(frame, rect, insets)` for parchment panels, buttons and dialogue boxes — corners unscaled at any rect size
- [x] ENG-0036 · Demo · P2 · S · Texture filtering — mipmapped trilinear sampling for downscaled art, anisotropic filtering when `EXT_texture_filter_anisotropic` exists
- [ ] ENG-0037 · Demo · P2 · M · Spike: KTX2/Basis Universal (wasm transcoder) vs PNG for sprite pages — report VRAM, load time and artefacts on organ art; adopt only if VRAM saving ≥50% with art sign-off
- [ ] ENG-0038 · Demo · P2 · M · Lit sprites — optional normal-map page per sprite sheet sampled in a lit sprite shader using the same light rig as the flesh field (tools, embedded objects, organs)
- [x] ENG-0039 · Demo · P1 · M · Textured mesh draw — `mesh(verts, uvs, indices, tex)` for deformable organ sprites, draped cloth strips and suture thread
- [ ] ENG-0040 · Demo · P2 · M · Deformable sprite grid — N×M mesh with per-vertex offsets for heartbeat squash/stretch, grub bulges and Malison flinches

### Render layers & ordering
- [x] ENG-0041 · Demo · P1 · M · Explicit render layers — enum (Backdrop, Field, Decals, Entities, Particles, WorldFX, WorldUI, UI, Overlay, Debug) with per-layer command lists submitted in order regardless of call order
- [x] ENG-0042 · Demo · P1 · S · Stable sort of the Entities layer by `Entity.layer` then spawn order — replaces the implicit array draw order in `OperationScene.render`
- [x] ENG-0043 · Demo · P1 · S · Documented layer contract + test — UI and Overlay layers never receive grain, vignette, LUT or shake
- [x] ENG-0044 · Demo · P2 · S · WorldUI layer — callouts/popups anchored to world positions drawn after post but through the camera transform (stay attached when zoomed)

### Camera & close-ups
- [x] ENG-0045 · Demo · P0 · M · `Camera2D` view matrix — position/zoom/rotation applied as a uniform in `PRIM_VS` instead of CPU vertex transforms, so zooming does not re-tessellate or rebuild batches
- [x] ENG-0046 · Demo · P0 · S · Pointer → world mapping through the camera inverse (`camera.toWorld(input.pos)`); entity hit tests use world coords — test clicks land on the right entity at 2× zoom and offset pan
- [x] ENG-0047 · Demo · P1 · M · Close-up camera tweens — `camera.focus(target, zoom, seconds, ease)` for Malison reveals, fine suturing and lens scrying; easing curves unit-tested
- [ ] ENG-0048 · Demo · P1 · M · Flesh shader and decal maps take the camera transform so procedural detail is resampled at zoom — screenshot at 2.5× shows sharp veins, not a magnified blur
- [x] ENG-0049 · Demo · P1 · S · Camera bounds clamp — zoomed view never reveals beyond the drape edge or the virtual safe area
- [x] ENG-0050 · Demo · P1 · S · Tessellation LOD from on-screen radius (after camera zoom and DPR) — circles stay smooth at 2.5× zoom and cheap at 1×
- [x] ENG-0051 · Demo · P1 · M · Camera shake moved from post UV offset (`u_shake`) to a trauma-based camera offset/rotation using smooth noise, scaled by the screen-shake setting — `op.shake` jitter no longer uses `Math.random`
- [x] ENG-0052 · Demo · P1 · M · Anti-aliasing for the world layer: 4× MSAA renderbuffer resolved with `blitFramebuffer` into the post input; fall back to an FXAA pass when `MAX_SAMPLES < 4` — edge crawl on lancet lines eliminated in capture

## ENG-C · Frame loop, timing & scene state machine (Demo)

### Frame loop & clocks
- [x] ENG-0053 · Demo · P0 · M · Fixed-step simulation: 120 Hz accumulator calling `update(FIXED_DT)` up to 8×/frame, then `render(alpha)`; excess time dropped (no spiral of death) — op outcomes identical at 30/60/144 fps render rates (test)
- [x] ENG-0054 · Demo · P1 · M · Render interpolation — entities keep `prevPos`/`prevAngle`, views lerp by `alpha`; helper for interpolated scalars (tool heat, Malison orbit)
- [x] ENG-0055 · Demo · P1 · S · Sub-step input distribution — `Input.path` samples spread across a frame's fixed steps by timestamp, so lancet strokes sample identically at any frame rate (test at 30/60/144)
- [x] ENG-0056 · Demo · P0 · M · Single `Clock` service — `real`, `sim` (stops on pause/hitstop) and `world` (Litany-scaled) times replace `gfx.time += dt` and scene-local timers
- [x] ENG-0057 · Demo · P1 · S · Pause semantics: sim and world clocks stop, UI animation and audio ducking continue — unit test that vitals/time do not change across a 10 s pause
- [x] ENG-0058 · Demo · P2 · S · Hitstop — `clock.hitstop(ms)` freezes world time on impacts (Malison hit, barb tear, chain milestone), capped at 120 ms, disabled by reduce-motion
- [x] ENG-0059 · Demo · P1 · S · Hidden-window handling — on `visibilitychange` (minimised/occluded) the loop stops ticking and the audio context suspends; returning resumes with no dt spike (dt clamp test)
- [x] ENG-0060 · Demo · P1 · M · Frame limiter (30/40/60/90/120/144/uncapped) in the loop using rAF skipping aligned to measured refresh — frame pacing jitter <1 ms at a 60 cap on a 144 Hz display
- [x] ENG-0061 · Demo · P2 · S · Display refresh estimator (median of rAF deltas) exposed to settings/profiler — handles 59.94/75/120/144/165 Hz

### Scene state machine
- [x] ENG-0062 · Demo · P0 · M · Scene lifecycle `enter/exit/pause/resume/dispose`; `go()` disposes the outgoing scene — 50 operation restarts leave GL object and listener counts unchanged (leak test)
- [x] ENG-0063 · Demo · P0 · M · Scene stack — push/pop overlays (pause, options, confirm dialog, glossary) over a live scene that stops updating but keeps rendering underneath
- [x] ENG-0064 · Demo · P1 · M · Transition system — fade, iris and ink-bleed wipes rendered on the Overlay layer; `go(scene, {transition:'ink', ms:600})`; input blocked during transitions
- [x] ENG-0065 · Demo · P1 · M · Async scene loading — `LoadingScene` awaits the next scene's asset bundle with a progress quill; skipped when already resident, never flashes for <300 ms
- [x] ENG-0066 · Demo · P1 · S · Global overlay host — toasts, autosave quill, achievement popups, FPS counter and Steam-overlay pause veil render independently of the active scene
- [ ] ENG-0067 · Demo · P1 · M · Typed scene router — routes for title, story, briefing, operation, results, options, chapterSelect, credits, demoEnd with `?scene=` dev deep links, replacing ad-hoc constructors in `flow.ts`
- [ ] ENG-0068 · Demo · P1 · M · Service container — replace the module-level `save` singleton in `scenes/flow.ts` with injected `game.services` (save, settings, audio, platform, assets) so scenes run in tests with fakes
- [x] ENG-0069 · Demo · P0 · M · Error boundary — exceptions in `update`/`render` are caught, logged with scene + frame context, and routed to an in-fiction "The ink has run" screen with Return to Title, instead of killing the rAF loop

## ENG-D · Flesh shader overhaul & Chapter 1–2 shader library (Demo)

### Known issue: sparkly specular and harsh voronoi edges
- [x] ENG-0070 · Demo · P0 · S · Shader lab dev route `?shaderlab` — all organ kinds × species side by side, light sweep, zoom 1×/2.5×, frozen time; baseline screenshots checked in for review
- [x] ENG-0071 · Demo · P0 · S · First-pass de-sparkle — finite-difference normal from a low-frequency height field replaces screen-space `dFdx/dFdy`×40; spec exponent 40→18 and intensity 0.55→0.22
- [x] ENG-0072 · Demo · P0 · M · Energy-normalised Blinn-Phong/GGX specular with per-organ roughness (0.35–0.6) and intensity clamp — temporal flicker metric (mean |Δluma| between consecutive frames of a static scene) <1% and art sign-off in the shader lab
- [x] ENG-0073 · Demo · P0 · M · Specular anti-aliasing — fade noise octaves by pixel footprint (`fwidth`) and widen roughness from normal variance (Toksvig) so sparkle does not return at 4K, 2.5× zoom or 0.5× render scale
- [x] ENG-0074 · Demo · P0 · M · Smooth voronoi — replace `cells()` hard `d2 - d1` edges with a smooth-minimum voronoi (k uniform) plus per-kind edge-softness uniform; lung, liver and flesh edges signed off as membranes, not cracks
- [x] ENG-0075 · Demo · P1 · S · Irregular voronoi cells — domain-warp input with low-frequency fbm and randomised jitter so the grid regularity disappears (shader lab A/B)
- [x] ENG-0076 · Demo · P1 · S · Wetness-masked glints — replace the sparse "wet glint" noise term so glints appear only on wet tissue and never shimmer when the light rig flickers

### Surface model & performance tiers
- [ ] ENG-0077 · Demo · P1 · M · Split `FLESH_FS` into composable GLSL chunks (noise, lighting, per-organ surface, corruption, drape) assembled with defines per variant — variants compiled and cached at load
- [x] ENG-0078 · Demo · P1 · M · Wetness field — specular and gloss modulated by a low-frequency wetness map plus the blood/salve decal maps so dry tissue reads matte and fresh blood glistens
- [x] ENG-0079 · Demo · P1 · M · Subsurface-scattering approximation (wrap diffuse + red-shifted translucency) for flesh, lung and gut so tissue reads as meat, not plastic — art sign-off
- [x] ENG-0080 · Demo · P2 · S · Cavity depth cues — Fresnel rim toward the opening edge plus ambient-occlusion falloff under the retractor rim
- [x] ENG-0081 · Demo · P0 · M · Bake static fbm/voronoi into 512² tiling noise textures at load; `FLESH_FS` samples textures instead of evaluating 5-octave fbm up to 6× per pixel — flesh pass ≤1.5 ms at 1080p on Intel UHD 620 (GPU timer)
- [x] ENG-0082 · Demo · P1 · M · Shader quality tiers High/Medium/Low (octaves, SSS, spec AA, baked vs live noise) chosen by GPU tier and overridable in settings — Low renders the field at 0.75× internal resolution
- [x] ENG-0083 · Demo · P0 · S · CI shader compile check — every shader variant × tier compiled and linked in headless Chromium (SwiftShader) during `npm test`; any error fails the build with the variant name
- [x] ENG-0084 · Demo · P1 · M · Light rig — up to 3 lights (surgeon's lamp, 2 candles) with colour, radius and flicker uniforms shared by flesh, lit sprites, particles and backdrops

### Organs, species & anatomy variants
- [x] ENG-0085 · Demo · P0 · M · Heartbeat deformation — heart surface contracts 4–6% in systole with ease-in/ease-out driven by an ECG phase uniform from the sim (replaces uniform `u_pulse` swell); flesh around it pulses subtly
- [x] ENG-0086 · Demo · P1 · S · Heartbeat sync: shader phase, ECG trace and heartbeat audio cue share one sim-driven beat clock — measured offset ≤1 frame
- [x] ENG-0087 · Demo · P1 · M · Heart surface — coronary vessel pattern following warped ridges, epicardial fat streaks, darker myocardium in diastole
- [x] ENG-0088 · Demo · P1 · M · Lung surface — alveolar lobules with a breathing cycle (`u_breath`) at the patient's respiration rate, inflating lobule scale ±3%
- [x] ENG-0089 · Demo · P1 · M · Gut surface — peristaltic wave travelling along warped loop coordinates, mesenteric fat and serosa sheen
- [x] ENG-0090 · Demo · P2 · S · Liver surface — glossy capsule, lobular pattern, optional bile-stain tint uniform
- [x] ENG-0091 · Demo · P2 · S · Brain surface — gyri/sulci from warped ridged noise, translucent meningeal veil layer, faint pulse
- [x] ENG-0092 · Demo · P2 · S · Bone surface — cortical/cancellous texture, periosteum film, dry low specular
- [ ] ENG-0093 · Demo · P1 · M · New organ kinds for Ch1–2 briefs — `muscle` (striated fibres along a direction uniform) and `skin` (pores, fine hair, sweat sheen) wired through `OrganKind`/`organPalette`
- [x] ENG-0094 · Demo · P1 · M · Data-driven `SpeciesProfile` (human, dwarf, elf, halfling, orc): base/deep/vein tints, fat ratio, surface scale, spec gain — replaces `RACE_TINT`, which currently never tints veins
- [ ] ENG-0095 · Demo · P2 · M · Species details: orc thick green-grey dermis and dark blood, dwarf dense fibrous tissue with higher gloss, elf pale translucent vessels — art sign-off in shader lab
- [x] ENG-0096 · Demo · P1 · S · Species blood colour source of truth — one table consumed by BloodPool, particles and decal maps (no hard-coded reds left; grep check)
- [ ] ENG-0097 · Demo · P1 · M · Drape as its own pass — linen weave texture, fold normal map, blood soak from the decal map (moved out of `FLESH_FS`), species-independent
- [ ] ENG-0098 · Demo · P1 · M · Opening shape from a mask texture instead of the fixed `FIELD` ellipse, with retractor/clamp sprites around the rim — supports irregular openings per operation def

### Wound, curse & boss surfaces needed by Chapters 1–2
- [x] ENG-0099 · Demo · P0 · M · Curse corruption v2 — per-pixel corruption map (render target) painted by `Sigil`/Malison entities instead of the uniform rim-in `u_corrupt`; veins blacken along the corruption front
- [x] ENG-0100 · Demo · P0 · M · Hexfire burn shader — violet-green emissive flame tongues over char, flickering with world time, bloom-friendly HDR emissive, dims as it is treated
- [x] ENG-0101 · Demo · P1 · M · Fire and acid burn surfaces: blistered char with ember speckle (fire), yellow-green etched froth (acid) — replace flat `circleGrad` burns
- [x] ENG-0102 · Demo · P1 · M · Bubo, rot and venom surfaces — taut glossy bubo dome with pus shadow; necrotic rot ramp red→purple→black with wetness loss; green-black venom tracking along veins
- [x] ENG-0103 · Demo · P1 · M · Scrying Lens view shader — sepia scry-glass disc with lens distortion, scan sweep and edge chromatic fringe revealing hidden entities; matches the lens reveal radius in sim
- [x] ENG-0104 · Demo · P0 · L · Malison of Matins render set — living-ink body shader (flowing noise, gold-leaf sigil glints), hit flash, phase-change swell, dissolve-to-ash on defeat
- [ ] ENG-0105 · Demo · P0 · L · Malison of Lauds render set — chorister core with orbiting Voices (emissive rings), Hymn ring distortion wave, submerged silhouette visible only through the Scrying Lens, hexstone shatter
- [x] ENG-0106 · Demo · P1 · S · Hexstone shard material — emissive rune glow plus refraction offset of the flesh behind it, shared by `Embedded(hexstone)` and Lauds shatter

## ENG-E · Render-to-texture: cut masks & persistent wound/blood maps (Demo)

### Render-target infrastructure
- [x] ENG-0107 · Demo · P0 · M · `RenderTargetPool`: create/resize/release targets by key with format (RGBA8, R8, RG8, RGBA16F), optional depth-stencil, and byte accounting — replaces private `makeTarget`/`freeTarget`
- [x] ENG-0108 · Demo · P0 · S · Field-space UV convention — decal/mask maps cover the field bounding rect independent of camera zoom and window size (2048×1152 High, 1024×576 Low)
- [x] ENG-0109 · Demo · P0 · M · Batched `stampDecal(map, brush, pos, rot, scale, color, mode)` API — all stamps to one map per frame go out in a single draw; 500 stamps ≤0.5 ms
- [x] ENG-0110 · Demo · P1 · S · Brush textures in the effects atlas — soft round, splatter ×4, drag streak, scorch, stitch mark, erase

### Cut masks
- [x] ENG-0111 · Demo · P0 · M · Cut mask map (R8) — `Incision`/`Laceration` stamp open width along their path; flesh shader renders parted tissue with inner-wall shading and depth darkening
- [x] ENG-0112 · Demo · P1 · M · Suture closure — completing a `StitchLine` erodes the cut mask along the thread over 0.4 s and leaves stitch-mark decals
- [x] ENG-0113 · Demo · P1 · S · Cut edge bleed — mask edges feed the blood decal map so fresh cuts weep along their length until sutured

### Blood & wound decal maps
- [x] ENG-0114 · Demo · P0 · M · Blood decal map (RGBA: colour, wetness, age) — pools, spurts and droplets stamp persistent blood that darkens and dries over ~20 s of world time
- [x] ENG-0115 · Demo · P0 · S · Leech-Pipe drain erases the blood map under the pipe — visible field cleaning matches `BloodPool` removal in sim
- [x] ENG-0116 · Demo · P1 · S · Low-res readback (64×36) of blood coverage for tests and the debug overlay — draining a pool reduces coverage within tolerance (Playwright test)
- [x] ENG-0117 · Demo · P1 · M · Scorch/sear decals from Cautery Brand and burns — hexfire leaves violet-ringed scars that persist to the results snapshot
- [x] ENG-0118 · Demo · P1 · S · Saint's Salve film layer — glossy translucent gel decal with high specular that fades as the sim marks the wound set
- [x] ENG-0119 · Demo · P2 · M · 10 Hz decal update pass (ping-pong) for time-based effects: blood drying, pus spreading, corruption creep — cost ≤0.3 ms
- [x] ENG-0120 · Demo · P0 · M · Rebuildable decal maps — maps regenerate from a recorded stamp log (sim events) so context loss or render-scale changes restore identical fields
- [x] ENG-0121 · Demo · P1 · S · Decal lifecycle — mask/decal maps reset on operation restart and released on exit; VRAM counter returns to baseline
- [x] ENG-0122 · Demo · P2 · S · Results "field snapshot" — final world target copied to a 480×270 texture shown on the results screen and saved as the slot thumbnail

## ENG-F · GPU particle system (Demo)

### Core system
- [ ] ENG-0123 · Demo · P0 · M · Spike — CPU-simulated instanced particles vs WebGL2 transform-feedback simulation at 20k particles on Intel UHD 620 and Steam Deck; pick one and record the decision (ADR) with measurements
- [x] ENG-0124 · Demo · P0 · L · Instanced particle renderer — per-instance position, velocity, life, size, rotation, colour, frame; quad expanded in the vertex shader; alpha and additive batches; one draw per blend per layer
- [ ] ENG-0125 · Demo · P1 · L · Transform-feedback simulation path — ping-pong buffers, gravity, drag, curl-noise turbulence (if chosen by the spike), CPU fallback when the capability probe fails
- [x] ENG-0126 · Demo · P0 · M · Emitter definitions as data (JSON) — rate/burst, spawn shape (point, line, arc, ellipse, path), velocity cone, gravity, drag, size/colour/alpha-over-life curves, frame sequence, blend, layer
- [x] ENG-0127 · Demo · P1 · S · Curve/gradient utilities — baked 64-sample LUTs uploaded as a texture; unit tests for curve sampling
- [x] ENG-0128 · Demo · P0 · S · Particle budget per quality tier (High 16k, Medium 8k, Low 4k) with priority classes — gameplay-readable effects never culled before ambient ones
- [x] ENG-0129 · Demo · P1 · M · Collision against the field — blood droplets that land stamp the blood decal map (splat size ∝ velocity); sparks bounce once off the field plane
- [x] ENG-0130 · Demo · P0 · S · Particles in world time slow to 0.15× during the Litany — UI particles run on real time (unit test on clock routing)
- [x] ENG-0131 · Demo · P1 · S · Deterministic spawn — emitter RNG seeded from operation seed + emitter id so replays and golden screenshots are reproducible
- [ ] ENG-0132 · Demo · P2 · M · Dev particle panel — live-tweak emitter parameters on a running operation, preview in isolation, copy JSON to clipboard

### Effects for Chapters 1–2
- [x] ENG-0133 · Demo · P0 · M · Arterial spray — pulsing jet synced to the heartbeat clock from severe lacerations, strength ∝ bleed rate, droplets stamping decals
- [x] ENG-0134 · Demo · P0 · S · Cut spatter — lancet strokes and barb tears emit a directional burst scaled by severity (MISS cut on healthy flesh is visibly worse)
- [x] ENG-0135 · Demo · P0 · M · Cautery — white-hot sparks, rising smoke wisps and ember glow while the Brand touches tissue; smoke drifts toward the light rig
- [x] ENG-0136 · Demo · P1 · M · Hexfire flames — violet/green flame and spark emitters, with curse motes drifting toward live Sigils
- [x] ENG-0137 · Demo · P0 · M · Malison motes and ash — dark motes orbit Matins/Lauds, bursts on hit, shard dissolve into ash on defeat
- [x] ENG-0138 · Demo · P1 · S · Bubo lancing splash — pus or black-bile burst coloured from the pool type
- [x] ENG-0139 · Demo · P1 · S · Venom mist rising from `Venom` entities — stops when neutralised
- [x] ENG-0140 · Demo · P1 · S · Grub extraction gore — squish burst and twitching segment particles on extraction
- [x] ENG-0141 · Demo · P2 · S · Tincture and Salve VFX — injection shimmer at the needle, droplets along the salve stroke
- [x] ENG-0142 · Demo · P1 · S · Litany dust — gold motes along the star trail, suspended "held time" motes drifting at 0.15× until the Litany ends
- [ ] ENG-0143 · Demo · P2 · S · Ambient backdrop particles — candle flames, dust in light shafts, chapel incense (story scenes)
- [x] ENG-0144 · Demo · P2 · S · UI particles — COOL rating sparkle, rank-reveal ink splash, chain-milestone flare
- [ ] ENG-0145 · Demo · P1 · S · Particle quality setting scales emission and max count — Low reduces particle GPU time ≥50% on the Malison fight (profiler capture)

## ENG-G · Post-processing (Demo)

### Pipeline
- [x] ENG-0146 · Demo · P0 · M · Post pipeline as an ordered pass list (bloom, CA, Litany, damage, LUT, vignette, grain, dither) with per-pass enable flags and uniforms, replacing the monolithic `POST_FS` — toggleable from the debug overlay
- [x] ENG-0147 · Demo · P1 · M · HDR scene target (RGBA16F via `EXT_color_buffer_float`) with a filmic tonemap — RGBA8 fallback path keeps visual parity within tolerance
- [x] ENG-0148 · Demo · P1 · M · Bloom v2: 5-level downsample/upsample mip-chain bloom with soft-knee threshold (replacing 2× 5-tap quarter-res blur and the hard-coded threshold in `endWorld`) — no bloom shimmer on small highlights in a static scene
- [x] ENG-0149 · Demo · P1 · S · Bloom presets per scene type (operation, story, menu, Malison) as data — `PostParams.bloom` becomes a preset id + intensity override
- [x] ENG-0150 · Demo · P1 · S · Dither at final output (blue-noise ±0.5 LSB) — gradient test capture shows no visible banding in the dark vignette

### Grading & look
- [x] ENG-0151 · Demo · P0 · M · LUT colour grading — 32³ LUT strips sampled as 2D textures, crossfade between two LUTs over time; replaces the hard-coded candlelit grade math (neutral-plus-candle default LUT keeps parity)
- [ ] ENG-0152 · Demo · P1 · S · LUT authoring pipeline — neutral LUT PNG exported by script, graded externally, dropped into `assets/luts/`; build validates size and format
- [ ] ENG-0153 · Demo · P1 · S · Chapter 1–2 LUTs — per-location grades (hospice, theatre, street, chapel, night) selected by story backdrop and operation def
- [x] ENG-0154 · Demo · P1 · S · Aspect-aware vignette — parameters derived from aspect ratio so 21:9/32:9 edges are not over-darkened and 16:10 not under-darkened
- [x] ENG-0155 · Demo · P2 · S · Blue-noise film grain — tiled texture animated by offset replaces `hash(v_uv*900)`; grain size in virtual units so 720p and 4K match
- [x] ENG-0156 · Demo · P2 · S · Candle flicker on the light rig — luminance amplitude ≤3%, disabled by the reduce-flashing setting

### Gameplay feedback effects
- [x] ENG-0157 · Demo · P0 · M · Litany v2 — star-shaped ripple radiating from the gesture centroid, sepia with gold highlight retention, radial "clock-hand" blur on onset, smooth ramp driven by the `litanyTime` curve
- [x] ENG-0158 · Demo · P0 · S · Damage feedback — directional red edge flash on `hurt` (intensity ∝ amount, direction from hurt position), capped repetition rate
- [x] ENG-0159 · Demo · P1 · S · Low-vitals treatment — red edge pulse synced to the ECG beat (not a fixed `sin(t*6)`), progressive desaturation below 15 vitals
- [x] ENG-0160 · Demo · P1 · S · Chromatic aberration pass — radial, strength uniform, used on Malison phase shifts and heavy damage, scaled by the accessibility slider
- [x] ENG-0161 · Demo · P1 · M · Malison curse screen effect — ink tendrils creeping from screen edges via noise mask plus slight warp, intensity from boss phase
- [x] ENG-0162 · Demo · P1 · S · Outcome transitions: flatline desaturates and fades to black with film burn; victory swells warm bloom — both driven by one timeline helper

### Safety & settings plumbing
- [x] ENG-0163 · Demo · P0 · M · Photosensitivity flash limiter: full-screen luminance changes limited to <3 flashes/s (Harding-style check) — unit test feeds worst-case post-param timelines (Malison + damage + Litany)
- [x] ENG-0164 · Demo · P0 · S · Post settings plumbed to uniforms — screen shake, chromatic aberration, grain, flicker, bloom (0–100%) and reduce-flashing
- [ ] ENG-0165 · Demo · P1 · S · Post budget — all passes ≤2.0 ms at 1080p on Intel UHD 620 measured with GPU timer queries in the perf replay

## ENG-H · Text rendering: MSDF upgrade (Demo)

### Atlas & shader
- [ ] ENG-0166 · Demo · P0 · M · Build-time MSDF atlas generation — msdf-atlas-gen for IM Fell English regular/italic and UnifrakturMaguntia with JSON metrics and kerning, cached by font hash
- [ ] ENG-0167 · Demo · P0 · M · MSDF text shader (median-of-RGB, screen-px range from derivatives) integrated into the batcher — headings crisp from 12 px to 160 px and under 2.5× camera zoom
- [x] ENG-0168 · Demo · P1 · S · Kerning pairs applied in layout (currently per-glyph advance only) — "AV", "To", "Wa" measured narrower than unkerned
- [ ] ENG-0169 · Demo · P1 · M · Shader text effects: outline, soft drop shadow, outer glow, embossed display style — replaces drawing a second shadow copy in `Gfx.text()`
- [ ] ENG-0170 · Demo · P1 · M · Dynamic fallback for glyphs outside the prebuilt set (player-entered text, rare punctuation) via the existing canvas rasteriser on a separate page — mixed-string render test
- [x] ENG-0171 · Demo · P1 · S · Fix upload hitch: `GlyphAtlas.upload()` re-uploads the full 2048² canvas and regenerates mips per new glyph — switch to `texSubImage2D` of dirty rects (no frame >4 ms when new glyphs appear)
- [ ] ENG-0172 · Demo · P2 · S · Multi-page dynamic glyph atlas — LRU eviction instead of clearing every glyph when the page fills

### Layout
- [x] ENG-0173 · Demo · P0 · M · Text layout engine — wrap with cached measurements, alignment, line height, max lines with ellipsis, returns glyph runs reusable across frames
- [x] ENG-0174 · Demo · P1 · M · Rich-text markup — `[b]`, `[i]`, `[color=blood]`, `[font=display]`, inline icons (`[icon=lancet]`, `[key=Litany]`) resolved to current input glyphs
- [x] ENG-0175 · Demo · P1 · S · Typewriter reveal for the story VN — per-glyph timing with punctuation pauses, skip-to-end, layout computed once
- [x] ENG-0176 · Demo · P1 · S · Grapheme-cluster iteration (`Intl.Segmenter`) and precomposed/combining diacritics for German, French, Polish, Spanish — render test string passes visual check
- [x] ENG-0177 · Demo · P2 · S · Static text cache: unchanged labels reuse baked vertex runs (no per-frame layout) — CPU text cost on the results screen drops ≥50%
- [ ] ENG-0178 · Beta · P1 · M · Script fallback fonts — subset Noto Serif MSDF pages for Cyrillic and CJK loaded per language when Fell/Fraktur lack the glyphs
- [ ] ENG-0179 · Beta · P2 · M · CJK dynamic MSDF generation or pre-baked frequency subsets (≤4k glyphs) with on-demand extra glyphs — memory ≤32 MB per CJK language

## ENG-I · Resolution, DPI & aspect ratio (Demo)

- [x] ENG-0180 · Demo · P0 · S · Remove the hard DPR cap of 2 in `Main.resize()` — resolution is governed by the render-scale setting so 4K/HiDPI UI renders at native pixels
- [x] ENG-0181 · Demo · P0 · M · Render scale (50–100% + native) for the world target independent of UI resolution; UI and text always native — world upscaled with bilinear or FSR1-style EASU on Low
- [x] ENG-0182 · Demo · P0 · M · Aspect policy — 1280×720 virtual safe area; on 21:9/32:9 the world extends horizontally (drape, backdrops fill the extra width) instead of pillarboxing; HUD anchors to safe-area edges
- [x] ENG-0183 · Demo · P0 · S · 16:10 (Steam Deck 1280×800, MacBook) extends the view vertically with no letterbox bars — HUD anchors verified
- [x] ENG-0184 · Demo · P0 · M · Anchor-based layout helpers (`anchor('top-left', offset)`, safe-area insets) replacing absolute coordinates in HUD/menus — layout verified at 16:9, 16:10, 21:9, 32:9, 4:3
- [x] ENG-0185 · Demo · P0 · S · Pointer mapping correct under every aspect mode, letterbox and render scale — unit tests with synthetic bounding rects replace the plain `getBoundingClientRect` ratio in `Input.move`
- [x] ENG-0186 · Demo · P1 · S · `ResizeObserver` with `devicePixelContentBoxSize` for exact backbuffer sizing — re-evaluate DPR when the window moves between monitors of different scale
- [x] ENG-0187 · Demo · P1 · S · Minimum supported window 1024×576 — below that the UI scales down uniformly and remains usable (test at 800×450)
- [x] ENG-0188 · Demo · P1 · S · UI scale setting — 80–130% applied to HUD and menu panels within the safe area for large monitors and Steam Deck legibility
- [ ] ENG-0189 · Demo · P1 · M · Multi-resolution screenshot regression — 1280×720, 1920×1080, 2560×1440, 3840×2160, 2560×1080, 3440×1440, 5120×1440, 1280×800 goldens in CI (SwiftShader)

## ENG-J · GPU capabilities, fallbacks & context loss (Demo)

### Capability detection & tiers
- [x] ENG-0190 · Demo · P0 · S · `GpuCaps` probe at boot: `MAX_TEXTURE_SIZE`, `MAX_SAMPLES`, float/half-float renderability, anisotropy, timer queries, parallel shader compile, highp FS precision, unmasked renderer/vendor — logged once per launch
- [x] ENG-0191 · Demo · P0 · M · GPU tier classification (Low/Medium/High) from caps plus a 2 s first-launch micro-benchmark of the flesh pass — stored in settings and user-overridable
- [x] ENG-0192 · Demo · P1 · S · Driver quirks table — renderer regex → forced tier/workarounds shipped as JSON so fixes need no code change
- [x] ENG-0193 · Demo · P0 · M · Fallback matrix implemented and tested — no float RT → RGBA8 bloom; no MSAA → FXAA; `MAX_TEXTURE_SIZE` 4096 → split atlas pages; no timer query → CPU-only profiler; mediump-only FS → simplified flesh variant
- [x] ENG-0194 · Demo · P1 · S · Software-rendering detection — SwiftShader/llvmpipe renderer strings force Low tier and show a one-time "hardware acceleration is off" notice with help link
- [ ] ENG-0195 · Demo · P1 · S · Request the discrete GPU on hybrid laptops (`powerPreference: 'high-performance'` + desktop wrapper switch) — verified on an Optimus laptop via renderer string
- [ ] ENG-0196 · Demo · P1 · M · ANGLE backend test matrix for the desktop build (D3D11 on Windows, Metal on macOS, GL/Vulkan on Linux/Deck) — documented defaults and a `--gl-backend` override for support
- [ ] ENG-0197 · Demo · P1 · S · Desktop-build fatal screen when WebGL2 fails — GPU/driver info, "update your graphics driver" guidance, log folder button, safe-mode relaunch button

### Context loss & resource registry
- [x] ENG-0198 · Demo · P0 · M · GL resource registry: every buffer, VAO, program, texture and target created through it with a recreate callback — enables restore and leak counting
- [x] ENG-0199 · Demo · P0 · S · `webglcontextlost` — `preventDefault()`, pause sim and audio, show a "Restoring the lamps…" overlay drawn without GL (DOM)
- [x] ENG-0200 · Demo · P0 · M · `webglcontextrestored`: recreate programs, VAOs, buffers, textures (from retained `ImageBitmap`s/URLs), glyph/MSDF atlases, render targets and decal maps from the stamp log, then resume — Playwright test with `WEBGL_lose_context` mid-operation continues correctly
- [x] ENG-0201 · Demo · P1 · S · Repeated context loss — 3 losses within 60 s drop to Low tier and log a GPU-instability event for crash reporting
- [x] ENG-0202 · Demo · P1 · M · Parallel shader compilation via `KHR_parallel_shader_compile` during the boot screen — readable compile errors with variant defines and source line numbers
- [x] ENG-0203 · Demo · P1 · S · Shader pre-warm — every program/variant drawn once off-screen during loading so first use in an operation causes no hitch (no frame >25 ms on first Malison appearance)

## ENG-K · Asset pipeline & preloading (Demo)

### Pipeline
- [x] ENG-0204 · Demo · P0 · S · `assets/` source layout (sprites, backdrops, portraits, luts, fonts, particles, shaders, audio) and generated output under `public/` — conventions documented in `docs/assets.md`
- [x] ENG-0205 · Demo · P0 · M · Build-generated asset manifest (id → hashed path, bytes, type, bundle) plus a generated `AssetId` union type — referencing a missing asset is a compile error
- [ ] ENG-0206 · Demo · P0 · M · Vite plugin for `.glsl` files — `#include` resolution, `#define` variants, `#line` mapping for error messages; shaders move out of template strings in `shaders.ts`
- [ ] ENG-0207 · Demo · P1 · S · Image optimisation in the build — oxipng lossless (optional lossy for backdrops) with a per-bundle size report printed by `npm run build`
- [ ] ENG-0208 · Demo · P1 · S · Font subsetting of shipped fonts to supported-language coverage (Latin-1 + Latin Extended-A for demo) — size delta reported
- [x] ENG-0209 · Demo · P0 · S · Asset validation step in CI — referenced ids exist, no unused asset >50 KB, textures within 4096 px, atlas pages power-of-two, LUTs correct size
- [x] ENG-0210 · Demo · P1 · S · Missing/failed asset fallback: magenta checker texture and silent audio with a logged warning — never an exception in release builds

### Loading
- [x] ENG-0211 · Demo · P0 · M · Typed asset loader `assets.load(id)` with de-duplication, reference counting and `release()` — images decoded via `createImageBitmap` off the main thread
- [x] ENG-0212 · Demo · P0 · M · Bundles `boot`, `title`, `story-common`, `ops-common`, `chapter1`, `chapter2` — next bundle prefetched during story scenes; chapter bundles unloaded when leaving a chapter
- [x] ENG-0213 · Demo · P0 · S · Boot sequence — fonts → boot bundle → shader compile/pre-warm → title, with progress on a DOM splash so the window never shows a blank canvas; cold start to title ≤5 s on SATA SSD
- [x] ENG-0214 · Demo · P1 · S · Font loading in the boot bundle — replaces `document.fonts.load` in `boot()`, with timeout and logged fallback to system serif
- [x] ENG-0215 · Demo · P1 · M · Asset hot reload in dev — changed PNG/JSON/GLSL/LUT reloads live via Vite HMR without restarting the running operation
- [x] ENG-0216 · Demo · P1 · S · Desktop builds load all assets from the local package (no network) — web builds use content-hashed URLs for cache busting
- [x] ENG-0217 · Demo · P1 · S · Demo install-size budget — game assets ≤150 MB (so the Windows depot stays ≤250 MB with the runtime), tracked per bundle in CI with a failing threshold

## ENG-L · Performance, memory budgets & profiling (Demo)

### Targets & measurement
- [x] ENG-0218 · Demo · P0 · S · Performance targets doc — 60 fps at 1080p Medium on Intel UHD 620/Iris Xe and at 1280×800 on Steam Deck; ≥144 fps High on GTX 1060; CPU frame ≤6 ms; per-system budgets (sim 1.5, batching 2, flesh 3, particles 2, post 2 ms)
- [x] ENG-0219 · Demo · P0 · M · Profiler overlay (F3) — CPU scopes per system, GPU pass timings via `EXT_disjoint_timer_query_webgl2`, draw calls, vertices, texture MB, JS heap, frame-time graph with budget lines
- [x] ENG-0220 · Demo · P1 · S · Frame capture — dump the last 600 frames of scope timings to CSV (dev key) for offline analysis
- [ ] ENG-0221 · Demo · P0 · M · Automated perf benchmark — scripted playback of the op1-5 Matins fight and the Lauds fight in a real-GPU runner, recording mean/p99 frame time; CI job flags regressions >10%
- [ ] ENG-0222 · Demo · P0 · M · Integrated-GPU pass on the reference Intel UHD 620 laptop — every Ch1–2 operation holds 60 fps at Medium, with captures attached to the ticket
- [ ] ENG-0223 · Demo · P0 · M · Steam Deck pass — 60 fps at 1280×800 Medium across Ch1–2; 40 fps preset holds with ≥25% lower APU power (Deck performance overlay readings)
- [x] ENG-0224 · Demo · P1 · S · Hitch audit: no frame >50 ms during any operation (shader first use, atlas upload, GC, save write) — asserted by the perf benchmark

### CPU & memory
- [x] ENG-0225 · Demo · P0 · M · Remove per-frame allocations in hot paths: `entities.filter` in `Operation.update`, `visibleEntities().sort` per pointer event, `{...pos}` copies in `Input`, `tf.slice()` in `save()`, point arrays in `quadCurve`/`dashed` — steady-state allocation <50 KB/s in a Chrome allocation profile
- [x] ENG-0226 · Demo · P1 · S · Scratch-vector pool — in-place math variants for draw code; zero `Vec` allocations in `Gfx` shape calls (allocation profile)
- [x] ENG-0227 · Demo · P0 · S · Memory budgets — VRAM ≤384 MB (Low) / ≤768 MB (High), JS heap ≤300 MB, tracked live by the resource registry; exceeding budget logs a warning with the top 10 consumers
- [ ] ENG-0228 · Demo · P1 · M · Soak test — 2-hour automated loop through all Ch1–2 operations with JS heap growth <5% and GL object count stable
- [x] ENG-0229 · Demo · P1 · S · Idle throttling — menus and paused states drop to 30 fps when nothing animates; resumes instantly on input (laptop/Deck battery)
- [ ] ENG-0230 · Demo · P2 · S · Web Worker evaluation — move save serialisation and replay compression off the main thread only if the measured saving is ≥1 ms per operation

## ENG-M · Developer tooling & debug overlays (Demo)

- [ ] ENG-0231 · Demo · P1 · M · Shader hot reload — saving a `.glsl` file recompiles affected programs at runtime; a failed compile keeps the previous program and shows the error on an overlay
- [x] ENG-0232 · Demo · P1 · M · Debug overlays (dev builds) — entity hit shapes and ids, `FIELD`/opening outline, pointer path samples, camera bounds, layer draw counts
- [x] ENG-0233 · Demo · P1 · S · Render-target viewer — thumbnails of scene, bloom mips, cut mask, blood/corruption decal maps, LUT, with click-to-enlarge
- [x] ENG-0234 · Demo · P1 · M · Dev console (backtick) — `op <id>`, `phase <n>`, `vitals <n>`, `litany`, `win`, `lose`, `timescale <x>`, `seed <n>`, `god`, `tier <low|med|high>`, `lose-context`
- [ ] ENG-0235 · Demo · P2 · M · Tweakables panel — shader/post/particle uniforms editable live, save-to-JSON writes back into content/preset files in dev
- [x] ENG-0236 · Demo · P1 · S · Time controls in dev — pause, single-step one fixed tick, 0.25× slow-mo, 4× fast-forward
- [x] ENG-0237 · Demo · P0 · S · Dev-only code behind `import.meta.env.DEV` and stripped from release bundles — CI greps the release bundle for dev console strings and `window.__game`
- [ ] ENG-0238 · Demo · P0 · M · Visual regression harness — Playwright + SwiftShader renders fixed-seed scenes (title, story, each Ch1–2 operation at set ticks) and pixel-diffs against goldens with per-test tolerance; runs on every PR
- [x] ENG-0239 · Demo · P1 · S · Screenshot capture (F12) of the backbuffer (`preserveDrawingBuffer`-free via readPixels after the final pass) saved as PNG — hook reused by Steam screenshots
- [x] ENG-0240 · Demo · P2 · S · Build stamp — version, git sha, tier and renderer shown in dev/QA builds and in the release pause menu

## ENG-N · Entity model evolution & sim/render separation (Demo)

- [ ] ENG-0241 · Demo · P0 · L · Move rendering out of `Entity.draw(g, op)` into view classes registered per entity type (`IncisionView`, `MalisonView`…) — `src/surgery/**` imports no `render/*` modules (lint rule enforced)
- [x] ENG-0242 · Demo · P0 · S · Per-operation entity id allocator replacing the module-level `nextId` counter in `entity.ts` — ids identical across runs of the same seed (test)
- [x] ENG-0243 · Demo · P0 · M · Typed sim event bus (`op.events`: cut, stitch, bleed, drain, burn, extract, hurt, heal, rate, phase, litany, malisonHit…) consumed by views, particles, decals, audio and achievements — replaces `op.cues` strings and sim-owned popups
- [ ] ENG-0244 · Demo · P1 · M · Shared behaviour components — Transform, Bleeds, Revealable, Drains, HitShape as composable data/mixins, deduplicating the 950-line `entities.ts` with no behaviour change (tests + golden replays pass)
- [ ] ENG-0245 · Demo · P1 · M · Shape-based hit testing — circle/capsule/polyline/polygon with layer priority, replacing per-entity ad-hoc distance checks in `onPress`
- [x] ENG-0246 · Demo · P2 · S · Spatial index — uniform grid over the field for picking and sweep tools when entity count >64; benchmark with 300 entities
- [x] ENG-0247 · Demo · P1 · S · Entity lifecycle hooks — `onSpawn`/`onDeath` emit events so VFX and achievements never poll entity arrays
- [ ] ENG-0248 · Demo · P1 · M · Tuning tables — bleed rates, radii, timers and damage move from constants in `entities.ts`/`malison.ts` into typed content tables, hot-reloadable in dev
- [x] ENG-0249 · Demo · P1 · M · Operation state serialisation (entities, rng state, timers, phase, score) to JSON with a round-trip test — used by the debug "save state/restore state" keys and crash reports
- [x] ENG-0250 · Demo · P1 · S · Extended `Pointer` — `pressure`, `tilt`, `source` (mouse/pen/touch/gamepad-cursor) so pens, Deck touchscreen and the gamepad cursor feed the same sim API
- [x] ENG-0251 · Demo · P1 · S · Remove remaining `Math.random` from `OperationScene` (ECG jitter at low vitals) — presentation noise uses a seeded presentation RNG so golden screenshots are stable

## ENG-O · Determinism & replays (Demo → Alpha)

- [x] ENG-0252 · Demo · P1 · S · Determinism lint rule — bans `Math.random`, `Date.now`, `performance.now` and DOM access inside `src/surgery` and `src/content`
- [x] ENG-0253 · Demo · P1 · M · Input recording — per-tick pointer/tool/key events delta+varint encoded; a 5-minute operation replay file ≤50 KB
- [x] ENG-0254 · Demo · P1 · M · State hashing every 60 ticks — replaying a recording reproduces identical hashes, and the dev desync detector reports the first divergent tick and entity
- [x] ENG-0255 · Demo · P1 · M · Golden-run regression suite — one recorded run per Ch1–2 operation re-simulated headlessly in CI; final score, rank, vitals and hash must match exactly
- [x] ENG-0256 · Demo · P2 · S · Replay in bug reports — last operation's replay attached automatically to crash reports and in-game bug reports
- [x] ENG-0257 · Alpha · P1 · S · Replay file header with format version, build id and content hash — incompatible replays refuse to load with a clear message
- [ ] ENG-0258 · Alpha · P2 · M · Replay player scene — play/pause, 0.25×–4× speed, scrub via keyframe snapshots every 5 s, HUD toggle
- [ ] ENG-0260 · Alpha · P2 · S · Golden runs for Chapters 3–5 — suite extended to every new operation and challenge-mode variant as content lands

## ENG-P · Shader & VFX library for Chapters 3–5 (Alpha)

### Afflictions
- [x] ENG-0261 · Alpha · P0 · M · Petrification — per-pixel petrify map turns tissue to grey granite (voronoi fissures, desaturation, specular loss) with a creeping front; chisel strikes stamp crack decals and stone-dust particles
- [x] ENG-0262 · Alpha · P0 · M · Frost/rime — dendritic frost growth over tissue, icy specular with slight refraction offset, thaw animation when warmed by the Brand, meltwater wetness
- [x] ENG-0263 · Alpha · P0 · M · Dragon-breath burns — deep char with glowing ember fissures (HDR emissive), heat-shimmer distortion pass masked to the wound, cooling over world time
- [x] ENG-0264 · Alpha · P1 · M · Plague/gangrene spread — necrotic colour ramp and wetness loss driven by a spreading map updated in the 10 Hz decal pass, reversing where treated
- [x] ENG-0265 · Alpha · P1 · M · Under-skin movement — larvae/parasite bulges travelling beneath tissue via a displacement term in the normal field, synced to sim positions
- [x] ENG-0266 · Alpha · P1 · S · Hostile-spell residue — rune-scar emissive decals that pulse with world time and fade when dispelled
- [x] ENG-0267 · Alpha · P2 · S · Poison variants — venom vein-spread shader tinted by a per-poison colour ramp from content data

### Remaining Malison variants
- [ ] ENG-0268 · Alpha · P0 · L · Malison of Prime and Terce render sets per boss design doc — body shader, hit flash, phase-change effect, defeat dissolve, arena LUT
- [ ] ENG-0269 · Alpha · P0 · L · Malison of Sext and None render sets per boss design doc — body shader, hit flash, phase-change effect, defeat dissolve, arena LUT
- [ ] ENG-0270 · Alpha · P0 · L · Malison of Vespers and Compline render sets — per boss design doc, including Compline's finale-only full-screen corruption sequence
- [ ] ENG-0271 · Alpha · P1 · S · Shared Malison shader chunk — ink flow, sigil glints and dissolve, so each variant is a parameter set plus at most one bespoke function

### Other disciplines
- [x] ENG-0272 · Alpha · P1 · M · Field-triage rendering — tent-canvas/mud drape variant, rain streaks on the view and grime overlay, torch-lit light rig preset
- [ ] ENG-0273 · Alpha · P1 · M · Bone-setting view — translucent "vellum anatomy" skeletal overlay shader with fracture highlights and alignment guides
- [x] ENG-0274 · Alpha · P1 · M · Forensic/inquisition view — corpse-pallor flesh profile (no pulse, livor mortis pooling), evidence highlight shader for the Scrying Lens
- [ ] ENG-0275 · Alpha · P2 · M · Diagnosis view — full-body chart renderer (patient silhouette with region hover, symptom overlays) reusing sprite/mesh APIs
- [x] ENG-0276 · Alpha · P2 · S · Drape material presets — hospice linen, noble silk, prison sackcloth, army canvas, selected in the operation def

## ENG-Q · Final art integration & rendering polish (Beta)

- [ ] ENG-0277 · Beta · P0 · M · Painted story backdrops — layered with parallax and light overlays, replacing procedural `drawBackdrop()` placeholders for all locations
- [ ] ENG-0278 · Beta · P1 · M · Spike: skeletal 2D animation runtime (Spine vs DragonBones vs custom mesh rig) for VN portraits and Malisons — license, bundle size, draw-call cost; decision recorded
- [ ] ENG-0279 · Beta · P0 · M · VN portrait renderer — layered expression sprites with blink and mouth-flap cycles, crossfade on expression change, speaker highlight/dim
- [ ] ENG-0280 · Beta · P1 · M · Final tool sprites — state animation (lancet glint, brand heat ramp, tongs grip, lens shimmer) replacing vector-drawn `toolIcon`
- [ ] ENG-0281 · Beta · P1 · S · Final LUTs for Chapters 3–5 — every location and per-Malison arena graded and signed off
- [ ] ENG-0282 · Beta · P1 · M · sRGB-correct pipeline — `SRGB8_ALPHA8` textures and linear blending in the HDR target, with art sign-off that final art matches the source files
- [ ] ENG-0283 · Beta · P0 · S · Full-campaign VRAM audit with final art — per-chapter atlas pages unloaded on chapter exit, peak within budget on Low
- [ ] ENG-0284 · Beta · P1 · S · Credits renderer — long scrolling rich-text with section art, skippable, 60 fps on Deck

## ENG-R · Release performance & stability (Release)

- [ ] ENG-0285 · Release · P0 · M · Minimum-spec validation matrix (Intel HD 520, UHD 620, Vega 8, GTX 750 Ti, Apple M1, Steam Deck) — every operation ≥60 fps at its tier preset, ≥30 fps on HD 520 Low; results published as the store min/recommended spec
- [ ] ENG-0286 · Release · P0 · S · Full-campaign hitch audit via golden replays — no frame >50 ms in any operation or story scene
- [ ] ENG-0287 · Release · P0 · M · Driver workaround sweep from Beta crash/telemetry reports — each workaround added to the quirks table with a regression test where reproducible
- [ ] ENG-0288 · Release · P0 · S · Release-branch perf gate — benchmark regression >5% blocks the release candidate
- [ ] ENG-0289 · Release · P1 · M · Full-campaign soak — 5 hours on Windows, macOS and Deck with no leaks and context-loss recovery verified

## ENG-S · Post-launch engine (Post)


---

## PLT-A · Platform foundation (M0 prototype — shipped)

- [x] PLT-0001 · M0 · P0 · S · npm scripts `dev`, `build`, `preview`, `typecheck`, `test` — Playwright pinned as a dev dependency for smoke runs
- [x] PLT-0002 · M0 · P0 · S · localStorage save v1 (legacy key `grim-apothecary.save` from the working title) — campaign progress, best rank/score per operation, volume; `recordBest`/`advance` helpers
- [x] PLT-0003 · M0 · P1 · S · Campaign autosave — flow stores progress on each step and operation result (`scenes/flow.ts`)
- [x] PLT-0004 · M0 · P1 · S · Browser fullscreen toggle — F11 / Alt+Enter

## PLT-B · Desktop runtime evaluation spike: Electron vs Tauri (Demo)

- [ ] PLT-0005 · Demo · P0 · M · Build the current game in Electron (latest stable) and Tauri 2 shells on Windows 11, macOS 14 (arm64) and Ubuntu 22.04 — record install size, cold start, idle RAM, frame pacing on op1-5
- [ ] PLT-0006 · Demo · P0 · S · WebGL2 compatibility check per shell: WebView2 (Windows), WKWebView (macOS), WebKitGTK (Linux) — flesh shader compiles, MSAA/float RT availability, fps vs Chromium
- [ ] PLT-0007 · Demo · P0 · M · Steam integration feasibility per shell — steamworks.js (napi) under Electron vs the Rust `steamworks` crate under Tauri; overlay renders and receives input on Windows fullscreen and windowed
- [ ] PLT-0009 · Demo · P1 · S · Audio behaviour per shell — WebAudio latency, autoplay policy, device change and suspend/resume measured and recorded
- [x] PLT-0010 · Demo · P0 · S · ADR-001 "Desktop runtime" — scored matrix (GPU compat, Steam overlay, size, startup, dev velocity, update story) and decision; Electron is the default unless Tauri wins on compat and overlay
- [x] PLT-0011 · Demo · P1 · S · Runtime version policy — pinned major, security-patch bumps within 2 weeks, major upgrades only between milestones with full regression pass

## PLT-C · Desktop shell (Demo)

- [x] PLT-0012 · Demo · P0 · M · `desktop/` package — main-process entry, window creation, `contextIsolation`, `sandbox`, no `nodeIntegration`, preload script exposing a minimal bridge
- [x] PLT-0013 · Demo · P0 · M · Typed `platform` bridge — saves, settings, steam, window, logging, paths, quit, with a web/no-op implementation so the browser build runs unchanged
- [x] PLT-0014 · Demo · P0 · S · Serve the game from a custom `app://` protocol with a strict CSP (`default-src 'self'`) — no localhost server in production
- [x] PLT-0015 · Demo · P0 · S · Release hardening — devtools, reload shortcuts, navigation, `window.open` and drag-drop navigation disabled; enabled with `--dev`
- [x] PLT-0016 · Demo · P1 · S · Single-instance lock — a second launch focuses the existing window
- [x] PLT-0017 · Demo · P0 · S · Quit flow — window close, Alt+F4 and Cmd+Q ask for confirmation mid-operation and await the pending save flush before exiting
- [x] PLT-0018 · Demo · P1 · S · No application menu on Windows/Linux — minimal macOS menu (About, Hide, Quit, Toggle Full Screen)
- [x] PLT-0019 · Demo · P1 · S · App icons and metadata — ico, icns, PNG set incl. 256 px; product name and version embedded in executables
- [x] PLT-0020 · Demo · P1 · S · Command-line flags — `--windowed`, `--fullscreen`, `--safe-mode`, `--reset-settings`, `--log-level=<lvl>`, `--gl-backend=<angle>`
- [x] PLT-0021 · Demo · P1 · S · Safe mode — Low tier, no MSAA/HDR, default settings, windowed; offered automatically after 2 consecutive failed launches
- [x] PLT-0022 · Demo · P2 · S · Prevent display sleep during operations and story auto-play — released in menus and on pause
- [x] PLT-0023 · Demo · P1 · S · Web build kept green — browser demo for press/itch built in CI from the same code with platform feature flags

## PLT-D · Packaging & installers (Demo)

- [x] PLT-0024 · Demo · P0 · M · Packaging config (electron-builder or tauri bundler): Windows x64 directory build, macOS universal `.app`, Linux x64 directory build — each as a Steam depot input
- [x] PLT-0025 · Demo · P0 · S · Steam depot layout — separate Windows, macOS and Linux depots with correct executable bits
- [x] PLT-0026 · Demo · P0 · S · Electron fuses: disable `RunAsNode` and `NODE_OPTIONS`, enable `OnlyLoadAppFromAsar` and embedded ASAR integrity validation — verified with `@electron/fuses read`
- [x] PLT-0027 · Demo · P1 · S · Strip unused Chromium locale paks and dev artefacts — size delta recorded; Windows demo depot ≤250 MB compressed
- [x] PLT-0028 · Demo · P1 · M · Per-bundle resource archives — code, common, chapter1, chapter2 split so a code-only hotfix is a Steam patch ≤20 MB instead of re-downloading one big ASAR
- [ ] PLT-0031 · Demo · P1 · S · Windows — per-monitor-v2 DPI awareness, Windows 10 1809+ minimum, no external redistributables required (clean VM test)
- [x] PLT-0032 · Demo · P1 · S · Reproducible builds: pinned Node (`.nvmrc`), lockfile installs, deterministic archive ordering — two CI builds of one commit produce identical app archive hashes
- [x] PLT-0033 · Release · P1 · M · DRM-free installers for GOG/itch — Windows NSIS (Start-menu shortcut, uninstaller that keeps saves), macOS signed `.dmg`, Linux `.tar.gz` + AppImage

## PLT-E · Code signing & notarisation (Demo)

- [ ] PLT-0034 · Demo · P0 · M · Windows Authenticode signing — executables and native modules signed in CI (OV/EV certificate or Azure Trusted Signing) with RFC 3161 timestamps
- [ ] PLT-0037 · Demo · P0 · S · Signing credentials stored only in the CI secret store (or cloud HSM) — documented rotation and revocation procedure; no keys on developer machines
- [ ] PLT-0038 · Demo · P0 · S · Post-build verification in CI — `signtool verify /pa /v`, `codesign --verify --deep --strict`, `spctl -a -t exec`; failure blocks upload
- [x] PLT-0039 · Release · P2 · S · DRM-free checksums — SHA-256 with detached GPG signatures published for every download

## PLT-F · Steamworks core integration (Demo)

### SDK & lifecycle
- [x] PLT-0040 · Demo · P0 · M · Integrate the chosen Steamworks binding behind `platform.steam` (init, callbacks pumped each frame, shutdown) — no-op implementation when Steam is absent
- [x] PLT-0041 · Demo · P0 · S · `RestartAppIfNecessary` in release builds so launching the exe outside Steam relaunches through Steam — `steam_appid.txt` only in dev builds
- [ ] PLT-0042 · Demo · P0 · M · Steam overlay works in fullscreen, borderless and windowed on Windows, Linux and macOS — `GameOverlayActivated` pauses the game and suspends input
- [x] PLT-0043 · Demo · P1 · S · Steam language default — `GetCurrentGameLanguage` sets the game language on first launch
- [x] PLT-0044 · Demo · P1 · S · Steam user persona and SteamID available to save namespacing — never displayed in screenshots by default

### Features
- [ ] PLT-0045 · Demo · P1 · M · Rich presence — localisation tokens file with `#Status_Story`, `#Status_Operating` (patient + chapter), `#Status_Menu`; updated on scene changes; verified in friends list
- [ ] PLT-0046 · Demo · P0 · M · Steam Cloud via Auto-Cloud — root overrides for `WinAppDataRoaming`, `MacAppSupport`, `LinuxXdgDataHome` matching the save paths; quota 10 MB / 50 files; round-trip between two machines tested
- [ ] PLT-0047 · Demo · P1 · S · Cloud conflict behaviour tested (edit offline on two machines) — Steam conflict dialog appears and either choice loads cleanly
- [ ] PLT-0048 · Demo · P1 · M · Screenshots — Steam's screenshot key captures the game frame on every OS (fallback: `HookScreenshots` + readPixels via `AddScreenshotToLibrary`); F12 in-game path shared
- [x] PLT-0049 · Demo · P1 · M · Achievement framework: data-driven definitions, `unlock(id)` from sim events, offline queue flushed when Steam connects, dev "reset all" command — used by demo (if enabled) and full game
- [ ] PLT-0050 · Demo · P2 · S · Steam Timeline markers — operation start, Malison fight, patient lost, XS rank, so Game Recording clips are labelled
- [ ] PLT-0051 · Demo · P1 · S · Overlay web/store links — `ActivateGameOverlayToWebPage`/`ToStore` with default-browser fallback when the overlay is disabled

### SteamPipe & branches
- [x] PLT-0052 · Demo · P0 · M · SteamPipe scripts (`app_build_<id>.vdf`, `depot_build_<id>.vdf`) per edition and OS generated from one config — `steamcmd` upload from CI
- [x] PLT-0053 · Demo · P0 · S · Branch strategy — `qa` (password, nightly), `beta` (release candidates), `default` (manually promoted); promotion checklist in `docs/release.md`
- [ ] PLT-0054 · Demo · P0 · S · Dedicated Steam build account with minimal permissions and Steam Guard handled via stored `config.vdf` secret — documented recovery
- [ ] PLT-0055 · Demo · P0 · S · Steam launch options — per-OS executable and arguments plus a secondary "Launch in safe mode" option

## PLT-G · Steam demo app, content gating & Next Fest (Demo)

### Demo app & build flavour
- [ ] PLT-0056 · Demo · P0 · S · Separate Steam demo app ID — Steamworks "Demo" app linked to the base game with its own depots, branches, Cloud settings and store association
- [x] PLT-0057 · Demo · P0 · M · Build flavour `VITE_EDITION=demo|full` as a compile-time constant — demo bundles contain no Chapter 3–5 code modules; CI inspects `dist/` chunks and fails on any `chapter3+` module
- [x] PLT-0058 · Demo · P0 · M · Content gating — campaign, chapter select, challenge mode and extras expose only Chapters 1–2 in the demo; unit test that no reachable route or save field references non-demo content ids
- [x] PLT-0059 · Demo · P0 · S · Asset manifest filter excludes non-demo bundles from demo packages — package size check in CI
- [x] PLT-0060 · Demo · P0 · S · Per-edition identifiers — app id, executable name, window title ("Suture & Steel Demo"), rich presence and achievement sets selected by edition
- [x] PLT-0061 · Demo · P1 · S · Demo watermark option — corner stamp with build id for press/festival builds, off in the public demo

### End of demo & wishlist
- [x] PLT-0062 · Demo · P0 · M · End-of-demo scene after the Chapter 2 finale — thank-you, teaser, "Wishlist on Steam" button opening the full game's store page in the overlay (`ActivateGameOverlayToStore`), browser fallback outside Steam
- [x] PLT-0063 · Demo · P1 · S · Wishlist entry points — demo title screen and pause menu, compliant with Steam guidelines (no forced interruptions)
- [x] PLT-0064 · Demo · P2 · S · Owned-full-game notice — if `BIsSubscribedApp(fullAppId)`, the demo title says "The full game is in your library" instead of the wishlist prompt

### Demo → full-game carry-over
- [x] PLT-0065 · Demo · P0 · M · Carry-over contract — demo saves carry `edition`, build version and stable content ids (`ch1.op3`); full game maps demo ids to full-game ids through a versioned table (unit tests with fixture demo saves)
- [x] PLT-0066 · Demo · P0 · M · Shared save location (`…/suture-and-steel/demo/`) readable by the full game (Steam Cloud cannot cross app ids) — full game detects demo saves on first launch and offers import
- [ ] PLT-0067 · Demo · P1 · S · Carry-over import QA — tested on Windows, macOS, Linux and Deck, including when the demo is uninstalled but its save folder remains
- [x] PLT-0068 · Demo · P2 · S · Carry-over limitation documented — demo progress imports only on the machine where it was played; stated in the FAQ and the import dialog
- [ ] PLT-0069 · Demo · P1 · S · Demo save format frozen — at demo 1.0, covered by the save-compatibility CI suite for every later full-game build

### Next Fest readiness
- [ ] PLT-0070 · Demo · P0 · S · Next Fest checklist with dates — demo build live and reviewed ≥2 weeks before the festival, store page demo section, broadcast/press build, known-issues list
- [ ] PLT-0071 · Demo · P0 · M · Festival hotfix pipeline rehearsed — fix → CI build → signed → `beta` branch → smoke on 3 OSes + Deck → `default` in ≤4 hours
- [x] PLT-0072 · Demo · P1 · M · Opt-in anonymous demo telemetry — operations started/finished/failed, fail phase, session length, quit point, settings tier; first-run consent, options toggle, published data policy
- [x] PLT-0073 · Demo · P1 · S · "Send feedback" link — form/Discord prefilled with build id, OS and GPU tier
- [x] PLT-0074 · Demo · P2 · M · Kiosk/booth mode (`--kiosk`) — no saves, auto-return to title after 90 s idle, quit disabled, operation select for show floors
- [ ] PLT-0075 · Demo · P0 · M · Clean-machine demo QA via the Steam client (no dev tools installed) on Windows 10, Windows 11, macOS arm64, Ubuntu and Steam Deck — install, play Ch1–2 end to end, Cloud sync, uninstall
- [ ] PLT-0076 · Demo · P1 · S · Demo Deck compatibility review — requested once the Deck checklist items pass

## PLT-H · Save system v2 (Demo)

### Schema & storage
- [x] PLT-0077 · Demo · P0 · S · Rebrand identifiers to the final title — package name `grim-surgeon` → `suture-and-steel`, `<title>` in `index.html`, the WebGL2 fatal message in `main.ts`, and the storage namespace (with legacy-key migration below)
- [x] PLT-0078 · Demo · P0 · M · Save schema v2 split into `profile.json` (progress, unlocks, best ranks, playtime), `settings.json` (moves `volume` out of the save) and `slot<N>.json` — types in `src/core/save/schema.ts`
- [x] PLT-0079 · Demo · P0 · M · `SaveStore` interface — desktop file backend via the platform bridge, browser backend (IndexedDB with localStorage fallback), in-memory backend for tests
- [x] PLT-0080 · Demo · P0 · M · Ordered migration chain (v1 → v2 → …) replacing the current behaviour that silently discards any save whose `version !== 1` — fixture saves for every historic version in `tests/fixtures/saves/`
- [x] PLT-0081 · Demo · P0 · S · First-run migration of the legacy `grim-apothecary.save` localStorage entry into the v2 profile (web build) — unit test with a captured v1 blob
- [x] PLT-0082 · Demo · P0 · M · Atomic writes — write `*.tmp`, fsync, rename over the target, keep the previous good file as `*.bak`; power-cut simulation test (kill mid-write) never leaves an unreadable save
- [x] PLT-0083 · Demo · P0 · M · Corruption recovery — checksum + schema validation on load; fall back to `.bak`, then the latest autosave; player sees "Your journal was damaged and restored from a backup" instead of a silent reset
- [x] PLT-0084 · Demo · P0 · S · Fuzz test — 1,000 randomly mutated/truncated save files never throw from the loader and always yield a valid profile
- [x] PLT-0085 · Demo · P1 · S · Forward-compatible saves — unknown future fields preserved on round-trip so a downgrade from a beta branch loses nothing

### Slots & autosave
- [x] PLT-0086 · Demo · P0 · M · Save slots — three manual slots + one autosave slot with metadata (chapter, step, patient, playtime, timestamp, field-snapshot thumbnail) for the load menu
- [x] PLT-0087 · Demo · P0 · S · Autosave after every story scene and operation result, never mid-operation — quitting mid-operation resumes at that operation's briefing (documented behaviour)
- [x] PLT-0088 · Demo · P1 · S · Autosave indicator — quill glyph on the overlay layer while a write is in flight, shown for at least 0.6 s
- [x] PLT-0089 · Demo · P1 · S · Saves written asynchronously via the bridge — no frame >2 ms attributable to saving (profiler capture)
- [x] PLT-0090 · Demo · P1 · S · Playtime tracking — excludes pause and idle periods over 5 minutes
- [x] PLT-0091 · Demo · P1 · S · Per-user saves — namespaced by SteamID (or local profile id outside Steam) so shared PCs keep separate progress
- [x] PLT-0092 · Demo · P0 · M · Save-compatibility CI suite — fixture saves from every released demo/full build load and migrate correctly on each commit
- [x] PLT-0093 · Demo · P2 · S · Support export — "Copy save folder" / zip of saves + logs from the options screen for bug reports
- [ ] PLT-0094 · Alpha · P1 · S · Full-game profile fields — Chapters 3–5, challenge mode, disciplines, New Game+ and extras unlocks added via migration with no demo-save breakage
- [ ] PLT-0095 · Beta · P1 · S · Save data privacy review — only SteamID/local id and gameplay data stored; documented in the privacy policy

## PLT-I · Settings system (Demo)

- [x] PLT-0096 · Demo · P0 · M · Typed settings schema — defaults, ranges, enum options, `requiresRestart`, version; persisted separately from saves with the same migration machinery
- [x] PLT-0097 · Demo · P0 · S · Settings service with change events — renderer, post-FX, audio, input and window subscribe and apply live
- [x] PLT-0098 · Demo · P0 · M · Graphics settings — display mode, monitor, resolution/render scale, UI scale, vsync, frame cap, preset (Low/Medium/High/Custom), AA, particle and shader quality, bloom, grain, chromatic aberration, flicker, screen shake
- [x] PLT-0099 · Demo · P0 · S · Audio settings — master, music, SFX, voice, ambience volumes (bus gains), mute when unfocused
- [x] PLT-0100 · Demo · P1 · S · Accessibility/gameplay settings plumbing — text speed, reduce flashing, reduce motion, colour-filter mode, cursor size, hold-to-toggle stored and exposed to UX/gameplay systems
- [x] PLT-0101 · Demo · P0 · M · Input bindings storage — keyboard remaps for tools 1–8/cycle/pause/Litany, mouse button swap, gamepad cursor speed/acceleration, conflict detection
- [x] PLT-0102 · Demo · P1 · S · Language setting — defaults to Steam language, then OS locale, then English
- [x] PLT-0103 · Demo · P0 · S · First-launch auto-detection — GPU tier → quality preset, display refresh → frame cap, OS/Steam locale → language; the Deck preset (below) overrides on Steam Deck
- [x] PLT-0104 · Demo · P1 · S · Display-change confirmation — resolution/mode changes revert after 15 s unless confirmed
- [x] PLT-0105 · Demo · P1 · S · Settings metadata export (label key, widget type, range, category, restart flag) consumed by the UX workstream's options screen — no hand-duplicated option lists
- [x] PLT-0106 · Demo · P1 · S · Reset-to-defaults per category and global — `--reset-settings` flag
- [x] PLT-0107 · Demo · P0 · S · Settings validation tests — out-of-range values clamped, unknown keys dropped, missing keys defaulted, corrupt file → defaults with a logged warning

## PLT-J · Windowing & display (Demo)

- [x] PLT-0108 · Demo · P0 · M · Display modes switchable at runtime: fullscreen, borderless windowed (frameless, display-sized) and resizable windowed — replaces the browser `requestFullscreen` toggle in desktop builds; F11/Alt+Enter keep working
- [x] PLT-0109 · Demo · P0 · S · Persist window size, position, mode and monitor — on launch clamp to the visible work area if that monitor is gone
- [x] PLT-0110 · Demo · P1 · S · Fullscreen monitor selection — display list with names and resolutions on multi-monitor setups
- [ ] PLT-0111 · Demo · P1 · M · VSync on/off — Chromium has no runtime toggle, so apply `--disable-gpu-vsync`/`--disable-frame-rate-limit` on next launch with a restart prompt; verified with a tear test pattern
- [ ] PLT-0112 · Demo · P1 · S · High-refresh displays: rAF runs at the display rate (144/165 Hz) in the desktop build on Windows and macOS ProMotion — verified with the refresh estimator
- [x] PLT-0113 · Demo · P0 · S · Focus loss — auto-pause operations, optionally mute, release captured mouse buttons (no stuck lancet drag after Alt+Tab)
- [ ] PLT-0114 · Demo · P1 · M · Hardware cursor option — OS cursor with custom image (menus and operation reticle) instead of the software-drawn reticle with `cursor: none`; input-to-photon latency compared and the lower-latency path is default
- [ ] PLT-0115 · Demo · P2 · S · Cursor confinement option — keep the cursor inside the window in fullscreen/borderless on multi-monitor setups so fast strokes cannot leave it
- [ ] PLT-0116 · Demo · P0 · S · Alt+Tab/minimise/restore in fullscreen on Windows returns to a correct frame (no black screen, context intact) — tested on NVIDIA, AMD and Intel
- [ ] PLT-0119 · Demo · P2 · S · Windows HDR desktop mode — SDR output not washed out or over-bright (visual check on an HDR monitor)

## PLT-K · Logging & crash reporting (Demo)

- [x] PLT-0120 · Demo · P0 · M · Structured logger (levels, categories, timestamps, frame number) shared by renderer and main process — in-memory ring buffer of the last 2,000 lines
- [x] PLT-0121 · Demo · P0 · S · Log files with rotation (5 × 5 MB) in the OS log directory — header records build id, OS, locale, GPU caps and settings tier
- [x] PLT-0122 · Demo · P0 · S · Renderer error capture — `window.onerror` and `unhandledrejection` routed to the logger and the error boundary screen
- [ ] PLT-0123 · Demo · P0 · M · Native crash reporting — Crashpad minidumps uploaded to a chosen backend (Sentry, BugSplat or Backtrace; decision recorded), symbols (PDB/dSYM/debug) uploaded from CI for every shipped build
- [ ] PLT-0124 · Demo · P0 · M · JavaScript error reporting — same backend as native crashes, source maps uploaded from CI and never shipped in the package
- [x] PLT-0125 · Demo · P0 · S · Crash/telemetry consent — first-run notice, options toggle, respected before any upload; privacy policy section
- [x] PLT-0126 · Demo · P0 · M · Renderer/GPU process gone handling — auto-reload the renderer back to the last autosave, count crashes, offer safe mode after 2 in 10 minutes
- [x] PLT-0127 · Demo · P1 · S · Crash dialog — "Suture & Steel has stopped" with report id, Open log folder and Restart buttons
- [x] PLT-0128 · Demo · P1 · S · Hang watchdog — renderer unresponsive >10 s triggers a capture and a restart offer
- [x] PLT-0129 · Demo · P0 · S · PII scrubbing — usernames in file paths, SteamID and machine name removed from logs and reports (unit test on sample paths)
- [ ] PLT-0130 · Demo · P1 · S · Crash-free-session dashboard — demo launch gate of ≥99.5% crash-free sessions on the `beta` branch
- [x] PLT-0131 · Demo · P1 · M · QA bug-report key (F8 in QA builds) — screenshot, last 2,000 log lines, replay, save and settings zipped into the support folder or uploaded with a ticket id

## PLT-L · OS file paths & filesystem (Demo)

- [x] PLT-0132 · Demo · P0 · M · `paths` module — Windows `%APPDATA%\suture-and-steel` (saves, settings) and `%LOCALAPPDATA%\suture-and-steel` (logs, cache, shader cache); macOS `~/Library/Application Support/suture-and-steel` and `~/Library/Logs/suture-and-steel`; Linux XDG data/config/state dirs
- [ ] PLT-0133 · Demo · P0 · S · Non-ASCII and long user paths (e.g. `C:\Users\Jürgen Ünïcødé\…`), OneDrive-redirected folders avoided (no Documents usage) — test matrix on Windows VMs
- [x] PLT-0134 · Demo · P1 · S · Screenshots folder — `Pictures/Suture & Steel` with "Open folder" actions via the shell
- [x] PLT-0135 · Demo · P0 · S · Read-only or full disk — save failure shows a non-blocking warning, retries with backoff, and the game keeps running
- [x] PLT-0136 · Demo · P1 · S · Edition-aware directories — `demo/` and `full/` under one parent so carry-over works without collisions
- [x] PLT-0137 · Demo · P2 · S · "Delete all local data" action — double confirmation; uninstall behaviour (saves retained) documented

## PLT-M · CI, build matrix, versioning & release branches (Demo)

### Continuous integration
- [ ] PLT-0138 · Demo · P0 · M · GitHub Actions PR pipeline — typecheck, lint, Vitest, production build, Playwright smoke (SwiftShader) and visual regression; all required for merge
- [ ] PLT-0139 · Demo · P0 · S · ESLint + Prettier baseline — `no-floating-promises`, `no-misused-promises`, consistent type imports; applied repo-wide and enforced in CI (sim-purity rules live in ENG)
- [ ] PLT-0140 · Demo · P0 · M · Build matrix — `windows-latest`, `macos-14` (arm64, universal output), `ubuntu-22.04`, each producing signed demo and full packages as artifacts
- [x] PLT-0141 · Demo · P1 · S · CI caching — npm, runtime downloads and atlas/MSDF outputs cached so the PR pipeline stays ≤15 minutes
- [ ] PLT-0142 · Demo · P1 · S · Nightly job — build all flavours, upload to the Steam `qa` branch, post the build id and changelog to the team channel
- [ ] PLT-0143 · Demo · P1 · S · Coverage gate — ≥80% line coverage for `src/surgery` and `src/core/save`
- [x] PLT-0144 · Demo · P1 · S · Dependency hygiene — Renovate/Dependabot, `npm audit` failing on high severity, licence allowlist check (MIT/BSD/Apache/ISC/OFL/CC-BY)
- [x] PLT-0145 · Demo · P0 · S · Third-party notices — runtime/Chromium, npm deps and OFL fonts generated, shipped in the package and viewable from the credits

### Versioning & releases
- [x] PLT-0146 · Demo · P0 · S · Versioning scheme — SemVer per edition (`demo 1.0.x`, full `0.x` until 1.0); build id `version+sha.date` shown on the title screen corner, in logs and crash reports
- [ ] PLT-0147 · Demo · P0 · S · Branching — `main` for development, `release/demo-1.x` for demo hotfixes (cherry-picks only), tags `demo-v1.0.0`; protected branches with required reviews
- [x] PLT-0148 · Demo · P1 · S · Changelog generation — conventional commits turned into a Steam patch-notes draft per release
- [ ] PLT-0149 · Demo · P0 · M · One-command release job — version bump, tag, build matrix, sign/notarise, symbol upload, SteamPipe upload to `beta`, smoke on each OS
- [ ] PLT-0150 · Demo · P1 · S · Artifact and symbol retention — every shipped build kept for ≥2 years
- [x] PLT-0151 · Demo · P1 · S · Feature-flag system — build-time constants + runtime overrides in QA builds to gate unfinished features out of the demo
- [ ] PLT-0152 · Release · P0 · S · `release/1.x` branch — cut at Release Candidate with the demo hotfix rules and a code-freeze policy

## PLT-N · Controllers & Steam Deck (Demo → Release)

### Controller platform layer
- [ ] PLT-0153 · Demo · P0 · M · Gamepad API backend (standard mapping) feeding the input abstraction, with hot-plug and per-frame polling in the fixed step — works in the desktop shell on all OSes
- [ ] PLT-0154 · Demo · P0 · M · Steam Input integration — action manifest with action sets Menu, Operation, Litany; default configurations for Xbox, PlayStation, Switch Pro and Steam Deck; Gamepad API fallback when Steam Input is off
- [x] PLT-0155 · Demo · P0 · S · Glyph sets (Xbox, PlayStation, Switch, Deck, keyboard/mouse) switched by last-used device — Steam Input glyph lookup when available
- [ ] PLT-0156 · Demo · P1 · S · Deck touchscreen input — tap = press, drag = stroke, usable for full operations
- [x] PLT-0157 · Demo · P1 · S · Controller disconnect handling — operation auto-pauses with a "reconnect controller" prompt

### Steam Deck
- [x] PLT-0158 · Demo · P0 · S · Deck preset — `IsSteamRunningOnSteamDeck` selects 1280×800, Medium, 60 fps cap, UI scale 115%
- [ ] PLT-0159 · Demo · P0 · M · Deck default layout uses the right trackpad as the surgical cursor with triggers for press/hold — every Ch1–2 operation completable at A rank or better by a tester on Deck
- [x] PLT-0160 · Demo · P0 · S · Legibility: all text ≥9 px tall at 1280×800 (Deck Verified guideline) — automated check over layout dumps
- [ ] PLT-0161 · Demo · P0 · S · Suspend/resume on Deck mid-operation — game auto-pauses, audio resumes, no context-loss crash (10 cycles)
- [ ] PLT-0162 · Demo · P0 · S · No keyboard required anywhere — text input fields use `ShowFloatingGamepadTextInput`
- [ ] PLT-0164 · Demo · P1 · S · Deck Verified self-review — Valve's checklist (input, display, seamlessness, system support) passed for the demo
- [ ] PLT-0165 · Release · P0 · S · Deck Verified for the full game — review submitted and passed

## PLT-O · Data-driven content loading (Alpha)

- [ ] PLT-0166 · Alpha · P0 · L · Content formats — chapters, operations, phases, story scripts and dialogue as JSON/YAML with JSON Schema, compiled and validated at build (replacing TS modules with spawn closures such as `chapter1.ts`)
- [x] PLT-0167 · Alpha · P0 · M · Declarative phase spawn DSL — `{type: 'Laceration', at: [x, y], length, severity}` plus a registry of named scripted hooks for bespoke behaviour (bosses, tutorials)
- [ ] PLT-0168 · Alpha · P0 · S · Stable namespaced content ids (`ch1.op3`, `ch2.lauds`) used by saves, achievements, telemetry and replays — CI fails on duplicate or renamed ids without a migration entry
- [ ] PLT-0169 · Alpha · P1 · S · Validation errors point to file, line and field — the build prints all errors at once
- [ ] PLT-0170 · Alpha · P1 · S · Content hot reload in dev — editing an operation file restarts that operation with new data in place
- [ ] PLT-0171 · Alpha · P1 · M · Per-chapter content packs — data + asset bundle loaded lazily on chapter entry, keeping boot content minimal
- [x] PLT-0172 · Alpha · P1 · S · Localisation string tables — key → string per language loaded as content, missing-key detection and pseudo-localisation mode for the loc workstream
- [x] PLT-0173 · Alpha · P2 · S · Chapter 1–2 content migration — moved to the data format with golden-run replays proving identical outcomes

## PLT-P · Full-game Steam & platform features (Beta)

- [ ] PLT-0174 · Beta · P0 · S · Full-game app configuration — depots per OS, branches, launch options, Cloud quotas and paths mirrored from the demo config; no DRM wrapper (decision recorded)
- [ ] PLT-0175 · Beta · P0 · M · Full achievement set (~40) — defined in data with locked/unlocked icons and localised text, unlock tests driven by golden replays
- [ ] PLT-0176 · Beta · P1 · M · Steam stats — operations completed, Malisons purged, XS ranks, patients saved, backing progress achievements with offline caching
- [ ] PLT-0177 · Beta · P1 · M · Challenge-mode leaderboards — per operation (score, time), uploaded on completion, friends/global views
- [ ] PLT-0178 · Beta · P1 · S · Localised rich presence — token files for every shipped language
- [ ] PLT-0179 · Beta · P2 · S · Remote Play and Steam Link — input latency acceptable and cursor behaves in a streaming session (manual test)
- [ ] PLT-0180 · Beta · P0 · M · Demo → full carry-over retested against the final full build — demo Chapter 1–2 progress unlocks Chapter 3 start and keeps ranks
- [ ] PLT-0181 · Beta · P1 · S · Steam Families and offline mode — game fully playable offline after first launch; achievements sync later
- [ ] PLT-0182 · Beta · P1 · M · External compatibility pass — min-spec and varied GPUs/drivers, non-English Windows locales (Turkish, German), non-admin accounts, 4K at 125/150% scaling

## PLT-Q · Auto-update & alternate storefronts (Release)

- [x] PLT-0183 · Release · P1 · S · Platform abstraction build variant `PLATFORM=none` — no Steam binaries linked, all Steam calls no-op, verified by a CI package inspection
- [ ] PLT-0184 · Release · P1 · M · GOG build — DRM-free offline installers, GOG Galaxy integration evaluated (achievements/cloud) with a decision recorded
- [ ] PLT-0185 · Release · P1 · M · itch.io build — `butler push` channels for Windows/macOS/Linux and `.itch.toml` launch config, plus the browser demo channel
- [ ] PLT-0186 · Release · P1 · M · Auto-updater for direct-download builds only (signed update feed, differential downloads, rollback on failed start) — disabled in Steam/GOG builds
- [x] PLT-0187 · Release · P2 · S · Storefront-aware links — "rate / wishlist" URLs resolved per storefront build
- [ ] PLT-0188 · Release · P0 · S · Storefront clean-machine checklist — each build passes install/play/uninstall on all target OSes

## PLT-R · Launch readiness & compliance (Release)


## PLT-S · Post-launch platform (Post)


