# 06 — Art · Suture & Steel: The Malison Hours

Workstream: **`ART`** — art direction, 2D production art, texture sets for the WebGL2 flesh shader, VFX, UI art, marketing art, pipeline, QA and budgets.

Baseline this roadmap builds on (as of the M0 prototype), all procedural placeholder art:
- `src/scenes/backdrop.ts` — `drawBackdrop()` draws six scenes (`hospice`, `street`, `theatre`, `chapel`, `night`, `camp`) as gradients, stone arcades and a stained-glass rect; `drawPortrait()` draws cast silhouettes (`hood`/`coif`/`cap`/`hat`/`helm`/`bare`) tinted by `CAST[id].color`.
- `src/ui/widgets.ts` — `panel()`, `parchment()`, `button()`, vector `toolIcon()` for all 8 tools, `star()` and `reticle()`, all drawn from shape primitives.
- `src/render/organs.ts` — per-organ flat palettes (`flesh/heart/lung/gut/liver/brain/bone`) × species tint (`human/dwarf/elf/halfling/orc`) feeding `FLESH_FS` uniforms (`u_base`, `u_deep`, `u_vein`, `u_corrupt`, `u_light`, `u_pulse`); there are no texture samplers yet.
- `src/render/shaders.ts` — the post chain (bloom, candlelit grade, vignette, grain, Litany sepia/ripple, danger pulse); ailment entities draw themselves with vector primitives.

Art pillars (from research §1): **Dürer** engraving crosshatch · **Bruegel** crowded panoramas and *Triumph of Death* · **Bosch** hybrid grotesques for curse-growths · **Holbein** *Dance of Death* woodcuts for fail and results screens · the Gersdorff **Wound Man** as a key motif · Landsknecht costume · *material honesty* (tallow, brass, gut, leeches, woodcut labels, candle smoke). All references are public domain. **No Games Workshop IP** anywhere.

Phase tags: `Demo` = art the Chapters 1–2 Steam demo needs at release quality; `Alpha`/`Beta`/`Release` = Chapters 3–5 and the full game; `Post` = after launch.
Cross-refs: ENG (texture loading, atlases, shader inputs), UX (layouts and widgets), NAR (scripts and cast lists).

---

## ART-A · Placeholder baseline (M0 — shipped)

### Procedural placeholder art in the build
- [x] ART-0001 · M0 · P0 · S · Procedural backdrops for six story scenes in `drawBackdrop()` (gradient sky, stone arcade, chapel window, night and camp variants)
- [x] ART-0002 · M0 · P0 · S · Silhouette portraits in `drawPortrait()` with six headwear styles, name-plate colour and active-speaker backlight
- [x] ART-0003 · M0 · P0 · S · Vector tool icons for all 8 tools in `toolIcon()`, drawn from shape primitives
- [x] ART-0004 · M0 · P0 · S · Parchment and panel widgets (`parchment()`, `panel()`), plus `button()` hover and disabled states
- [x] ART-0005 · M0 · P0 · M · Procedural flesh shader palettes for 7 organ kinds × 5 species tints (`src/render/organs.ts`)
- [x] ART-0006 · M0 · P1 · S · Vector ailment art for incisions, lacerations, embedded objects, burns, buboes, rot, venom, grubs, sigils and the Matins Malison
- [x] ART-0007 · M0 · P1 · S · Candlelit grade, vignette, grain and Litany sepia/ripple post look in `POST_FS`
- [x] ART-0008 · M0 · P1 · S · Bundled OFL fonts IM Fell English and UnifrakturMaguntia in the glyph atlas

---

## ART-B · Art direction & art bible

### Art bible
- [ ] ART-0009 · M0 · P0 · M · Art bible v1 (PDF + `docs/art/bible/`): the pillars, a public-domain reference board per pillar (Dürer, Bruegel, Bosch, Holbein, Gersdorff), and do/don't pairs — signed off by the art director
- [x] ART-0010 · M0 · P0 · S · IP-avoidance checklist in the bible: no GW iconography (twin-tailed comet, skull-and-eagle, eight-pointed star, horned rat), a list of banned silhouettes and symbols, and a checked box on every asset review
- [x] ART-0011 · M0 · P0 · M · Master palette: 32 swatches (tallow, soot, oxblood, verdigris, bile, bone, gilt, curse-violet) as `.ase` + `src/render/palette.ts`, and every UI colour mapped to a swatch
- [x] ART-0012 · M0 · P0 · S · Curse-violet (#b060ff family) reserved exclusively for Malison and Hollow Choir content — rule in the bible and a lint in art QA
- [x] ART-0013 · M0 · P1 · M · Line and hatching language: 3 hatch densities (light/mid/shadow), stroke weights at 1080p, and a woodcut line-break rule — exemplar sheet
- [ ] ART-0014 · M0 · P1 · S · Value-structure rule: every story background passes a 5-value greyscale thumbnail test with the character zone at least 2 value steps from the background
- [ ] ART-0015 · M0 · P1 · M · Costume guide: Landsknecht slashed doublets, mercy-order habits, Pyre inquisitors, Watch halberdiers, guild surgeons, the Hollow Choir — 1 turnaround sheet per faction
- [ ] ART-0016 · M0 · P1 · M · Material library sheet: brass, pewter, tallow, waxed linen, gut thread, leech skin, vellum, stained glass — painted swatch + lighting notes each
- [x] ART-0017 · M0 · P1 · S · Gore-tone rule sheet: what is shown (open tissue, pus, grubs) versus implied (faces in agony, children's wounds), aligned with the PEGI 16 / ESRB M target
- [ ] ART-0018 · Demo · P1 · S · Kessendorf heraldry and signage set (city arms, 6 guild marks, hospice of Saint Ildra seal) designed from scratch, IP-checked
- [ ] ART-0019 · Demo · P2 · S · Faith iconography for Saint Ildra and the Merciful Order (sun-in-palm, dove-and-lancet), with glyph variants for UI use
- [x] ART-0020 · Alpha · P2 · M · Art bible v2 covering Chapters 3–5 regions, factions and the six remaining Malison Hours

### Style frames
- [ ] ART-0021 · M0 · P0 · L · Style frame 1: operation screen at 1920×1080 (painted flesh field, a lodged barbed arrow, the brass tool tray, the vitals meter) — the target every in-game op is measured against
- [ ] ART-0022 · M0 · P0 · M · Style frame 2: VN scene in the hospice ward (Kreuzer + Ilse portraits, dialogue parchment, background)
- [ ] ART-0023 · M0 · P1 · M · Style frame 3: Malison Matins fight mid-phase (eye open, curse motes, Litany ripple)
- [ ] ART-0024 · M0 · P1 · M · Style frame 4: results screen as a Holbein-style woodcut plate showing the rank seal
- [ ] ART-0025 · Demo · P1 · M · Style frame 5: the Chapter 2 war camp at dusk (Bruegel crowd, pike-and-shot tents) to lock the Chapter 2 palette
- [ ] ART-0026 · M0 · P0 · S · In-engine proof of style frame 1: the captured frame matches the paintover within the agreed tolerance (palette and value check) and is reviewed with ENG
- [ ] ART-0027 · Alpha · P2 · M · Style frames for Chapters 3, 4 and 5 (one each) before any Chapter 3–5 production starts

### Direction & reviews
- [x] ART-0028 · M0 · P0 · S · Weekly art review cadence with a template (asset, stage, feedback, owner, due) in `docs/art/reviews/`
- [x] ART-0029 · M0 · P1 · S · Approval stages defined for every asset class: thumbnail → rough → line → colour → in-engine; no stage skipped without director sign-off
- [ ] ART-0030 · Demo · P1 · S · Demo art-lock date set, with the list of assets still placeholder at lock reviewed weekly until empty

---

## ART-C · Art pipeline & tooling

### Source, formats & naming
- [x] ART-0031 · M0 · P0 · S · Naming convention `cat_subject_variant_state@scale.ext` (e.g. `por_ilse_worried@2x.webp`) documented, with a CI script that fails on any non-conforming file in `assets/`
- [x] ART-0032 · M0 · P0 · S · Source-art storage: layered PSD/Krita/Blender sources in Git LFS (`art-src/`), with exports only in `assets/` and an `.gitattributes` LFS rule for each source type
- [x] ART-0033 · M0 · P0 · S · Export spec: WebP lossless for UI, WebP q90 for backgrounds, KTX2/Basis for flesh textures, PNG for masters — table in the bible
- [x] ART-0034 · M0 · P0 · M · Authoring resolution standard: backgrounds at 3840×2160 master, 1920×1080 ship; portraits at 2048 px tall master, 1024 px ship; UI at 2× the 1280×720 virtual space
- [x] ART-0035 · Demo · P0 · M · `npm run art:export` batch script: source → resized, trimmed, compressed exports with a manifest JSON (`assets/manifest.json`) of size, hash and atlas page
- [x] ART-0036 · Demo · P0 · M · Texture-atlas packer (`tools/pack-atlas.ts`) for UI, icons, ailments and VFX: 2048² pages, 2 px extrude, max-rects packing, a JSON frame map consumed by `gfx.ts`
- [x] ART-0037 · Demo · P0 · S · Premultiplied-alpha export for all atlased sprites; no dark halos when drawn on parchment and on flesh (visual test page)
- [x] ART-0038 · Demo · P1 · S · Spritesheet and flipbook convention (row-major, fixed cell, `fps` in the manifest) for ailment and VFX animation
- [x] ART-0039 · Demo · P1 · M · Hot-reload of `assets/` in the Vite dev server: changing an exported PNG updates the running game within 2 s without restart
- [x] ART-0040 · Demo · P1 · S · Art viewer debug scene (`?scene=artview`) listing every manifest entry, with zoom, frame-stepping and a background swatch toggle
- [x] ART-0041 · Demo · P1 · M · Placeholder-tracking: every asset in the manifest tagged `placeholder|wip|final`, with a build report counting each; the demo build fails if any demo asset is `placeholder`
- [x] ART-0042 · Demo · P2 · S · Photoshop/Krita export actions shared in `art-src/tools/` so every artist exports identically
- [x] ART-0043 · Alpha · P2 · M · Per-chapter asset bundles (lazy-loaded atlas pages per chapter) with the manifest split so Chapter 3–5 art doesn't load in the demo

### Engine integration (with ENG)
- [ ] ART-0044 · Demo · P0 · M · Portrait layer format: base body + expression overlay + blink + mouth frames as named layers, loaded by a `PortraitRig` in the story scene, replacing `drawPortrait()`
- [x] ART-0045 · Demo · P0 · M · Background layer format: far / mid / near / FX layers with parallax factors in the manifest, replacing `drawBackdrop()` per `Backdrop` key
- [x] ART-0046 · Demo · P0 · M · Flesh texture input spec agreed with ENG: albedo (sRGB), normal (tangent-space, OpenGL +Y), wet/spec mask (R), vein mask (G), cavity/AO (B) and height (A), 1024² tileable — `FLESH_FS` samples these on top of the procedural base
- [x] ART-0047 · Demo · P0 · S · Ailment sprite anchor convention: pivot at the wound centre, with the embed direction encoded in the manifest (`angle0`) so `Embedded` entities rotate correctly
- [x] ART-0048 · Demo · P1 · S · 9-slice metadata for every UI frame (margins in the manifest) consumed by `panel()` / `parchment()` replacements
- [x] ART-0049 · Demo · P1 · S · Colour-management rule: all authoring in sRGB, previews checked on a calibrated display (ΔE < 3), and flesh albedo validated through the candlelit grade LUT

---

## ART-D · UI art kit

### Parchment, panels & frames
- [x] ART-0050 · Demo · P0 · M · Parchment set: 3 tileable vellum textures (fresh, foxed, burnt-edge) at 1024², plus a 9-slice torn-edge frame, replacing the flat `parchment()` fill
- [x] ART-0051 · Demo · P0 · M · Woodcut border kit: 4 corner ornaments, 2 tiling edge strips and 3 divider rules in the Gersdorff/Holbein style, 9-slice-ready
- [x] ART-0052 · Demo · P0 · S · Dark panel (soot-stained oak with iron straps) 9-slice for the HUD and pause panels, replacing `panel()`
- [x] ART-0053 · Demo · P0 · M · Dialogue box: parchment scroll with a speaker name-plate cartouche (tinted per `CAST.color`), a continue-arrow quill glyph and an auto/skip indicator
- [x] ART-0054 · Demo · P1 · S · Choice-button art: 3 states (idle, hover and pressed wax-rub, disabled faded) for VN choices and menu buttons
- [x] ART-0055 · Demo · P1 · S · Tooltip frame (small vellum slip with a pin) and a keybind glyph plate for tutorial prompts
- [x] ART-0056 · Demo · P1 · M · Briefing screen art: a patient chart on vellum with a Wound-Man diagram and pin markers for ailment locations, plus stamped prognosis boxes
- [x] ART-0057 · Demo · P1 · M · Title-menu frame: an illuminated manuscript page with a rubricated initial and marginalia beasts
- [x] ART-0058 · Demo · P1 · M · Options menu art: tabbed ledger pages (Video, Audio, Controls, Accessibility, Language), with sliders drawn as a brass rule plus a wax bead
- [x] ART-0059 · Demo · P1 · S · Save/load slot cards: ledger entries with chapter vignette thumbnails (1 per chapter scene) and a date-stamp style
- [x] ART-0060 · Demo · P1 · M · End-of-demo wishlist screen: a woodcut plate of the Chapter 3 teaser with a "Wishlist on Steam" button in UI-kit style
- [x] ART-0061 · Demo · P2 · S · Loading-screen art: 4 woodcut vignettes (Wound Man, leech jar, Pyre, Choir mask) with an hourglass spinner
- [ ] ART-0062 · Alpha · P2 · M · Challenge-mode board: a guild notice board with pinned bills per challenge, parchment variants and a rank-wax stamp
- [ ] ART-0063 · Alpha · P2 · M · Discipline-select art for field triage, diagnosis, inquisition forensics and bone-setting — one illuminated tab each

### Wax seals, stamps & rank marks
- [x] ART-0064 · Demo · P0 · M · Rank seals XS / S / A / B / C in wax (gold-leaf XS, oxblood S, green A, brown B, cracked grey C), each with a press-in animation of 6 frames
- [x] ART-0065 · Demo · P0 · S · Action-rating stamps COOL / GOOD / BAD / MISS as ink-stamp sprites (blackletter), with a 4-frame stamp-hit flipbook each
- [x] ART-0066 · Demo · P1 · S · Combo counter art: a tally-mark ribbon (×2–×9 and ×10+ gilt variant)
- [x] ART-0067 · Demo · P1 · S · Chapter-complete seal and "Operation Failed" black-wax seal with a Holbein skeleton impression
- [x] ART-0068 · Demo · P2 · S · Inquisition "SUSPECT" stamp and Guild "APPROVED" stamp for story UI beats
- [ ] ART-0069 · Beta · P2 · S · Achievement icon set (Steam 64×64 + 256×256, colour and greyed) as wax medallions — one per achievement in the design list

### Brass instrument tray & HUD
- [x] ART-0070 · Demo · P0 · L · Brass instrument tray: an 8-slot tray on a leather roll along the screen edge, with engraved hotkey numerals 1–8, a selected-slot glow and an empty-slot state
- [x] ART-0071 · Demo · P0 · M · Vitals meter: a brass-and-glass apothecary gauge (0–99) with red tincture fill, low-vitals crack overlay and pulsing states
- [x] ART-0072 · Demo · P0 · S · Timer art: a sand-glass with an animated sand stream (8 frames) plus a numeric plate
- [x] ART-0073 · Demo · P0 · M · Litany gauge: a five-pointed-star reliquary that fills with gilt, with a "spent" tarnished state and a ready glint animation
- [x] ART-0074 · Demo · P1 · S · Tincture vial HUD element with 3 fill levels and an empty cork state
- [x] ART-0075 · Demo · P1 · S · ECG replacement: a pulse "quill trace" drawn on a vellum strip, with a flatline-warning ink blot
- [ ] ART-0076 · Demo · P1 · S · Sister Ilse callout portrait inset (circular brass locket frame) with 4 expressions for operation callouts
- [x] ART-0077 · Demo · P1 · S · Score and combo popup font treatment: gilt numerals with a dark outline, legible over red flesh at 18 px virtual
- [x] ART-0078 · Demo · P1 · S · Phase banner art ("Phase II", "The Malison Stirs") as a torn ribbon scroll with a slide-in animation
- [x] ART-0079 · Demo · P2 · S · Pause-screen overlay: a candle-snuffed vignette plus a hanging ledger menu

### Typography
- [x] ART-0080 · Demo · P0 · S · Type hierarchy spec: UnifrakturMaguntia for titles and seals only (≥ 28 px virtual), IM Fell English for body (≥ 16 px virtual), IM Fell SC for labels — with a sizes table
- [x] ART-0081 · Demo · P0 · S · Readability check: all body text at 1280×720 passes WCAG AA contrast on parchment (4.5:1) — screenshots of every text style
- [x] ART-0082 · Demo · P1 · M · Rubricated drop-cap set A–Z (red and gilt) for story-scene openings and briefing titles
- [x] ART-0083 · Demo · P1 · S · Dyslexia/accessibility font option: art approval of a plain OFL serif fallback that keeps the parchment look
- [x] ART-0084 · Demo · P1 · S · Glyph coverage audit of both fonts for demo languages (EN/DE/FR/ES/PL/PT-BR) — missing glyphs listed and a fallback font chosen
- [ ] ART-0085 · Beta · P1 · M · CJK and Cyrillic font pairing (OFL) styled to sit with IM Fell — sample sheets approved for each loc language
- [x] ART-0086 · Demo · P2 · S · Custom ligature and ornament glyphs (fleurons, manicules ☞, section marks) packed into the glyph atlas

---

## ART-E · Character portraits (visual novel)

Portrait standard (applies to every task below): half-body at 2048 px master / 1024 px ship, painted over a woodcut line layer, with a transparent background, a separate blink layer (3 frames) and mouth layer (3 frames: closed, mid, open), and the base expression set **neutral, pleased, worried, angry, shocked, grieving, determined, thinking**. Each portrait replaces its `drawPortrait()` silhouette.

### Design pass (whole cast)
- [ ] ART-0087 · M0 · P0 · M · Cast line-up sheet: all principal characters side by side at the same scale, with silhouette-readability test (each identifiable as solid black)
- [ ] ART-0088 · Demo · P0 · S · Expression guide: the 8 base expressions demonstrated on a neutral head, with brow, mouth and eye rules in woodcut shorthand
- [x] ART-0089 · Demo · P1 · S · Portrait lighting rule: key light from candle (warm, screen-left), rim light in the speaker's `CAST.color`, and the inactive-speaker darken value (−35% value)

### Dr. Kreuzer (player)
- [ ] ART-0090 · Demo · P0 · M · Kreuzer concept: 3 thumbnail options → chosen design with a turnaround (front, ¾, profile), surgeon's cap, leather apron and a lancet roll
- [ ] ART-0091 · Demo · P0 · M · Kreuzer portrait base + 8 base expressions + blink + mouth layers, in-engine
- [ ] ART-0092 · Demo · P1 · S · Kreuzer extra expressions: exhausted (after surgery), blood-spattered variant of neutral and determined
- [ ] ART-0093 · Demo · P1 · S · Kreuzer surgical-mask variant (linen mask + magnifier spectacles) for pre-op VN scenes
- [ ] ART-0094 · Alpha · P2 · M · Kreuzer field-surgeon costume (Chapter 3 campaign) with the full expression set

### Sister Ilse (assistant)
- [ ] ART-0095 · Demo · P0 · M · Ilse concept and turnaround: mercy-order coif and habit, a sun-in-palm pendant, rolled sleeves and a satchel of salves
- [ ] ART-0096 · Demo · P0 · M · Ilse portrait base + 8 base expressions + blink + mouth, in-engine
- [ ] ART-0097 · Demo · P1 · S · Ilse extra expressions: urgent-callout (used in op callouts), laughing, suspicious-of-Stroh
- [ ] ART-0098 · Demo · P1 · S · Ilse locket crops (HUD callout inset) exported from the portrait: neutral, urgent, relieved, alarmed
- [ ] ART-0099 · Beta · P2 · M · Ilse travelling-cloak costume for Chapters 3–5 with the full expression set

### Master Haller
- [ ] ART-0100 · Demo · P0 · M · Haller concept: elderly retired guild surgeon, bare-headed, guild chain of office, ink-stained fingers, a brandy flask
- [ ] ART-0101 · Demo · P0 · M · Haller portrait base + 8 expressions + blink + mouth
- [ ] ART-0102 · Demo · P2 · S · Haller extra expressions: drunk-jovial, lecturing (finger raised)

### Inquisitor Stroh
- [ ] ART-0103 · Demo · P0 · M · Stroh concept: Order of the Pyre inquisitor with a wide-brim hat, ash-grey coat, a pyre-brand badge (original design, IP-checked) and a wheel-lock pistol
- [ ] ART-0104 · Demo · P0 · M · Stroh portrait base + 8 expressions + blink + mouth
- [ ] ART-0105 · Demo · P1 · S · Stroh extra expressions: cold smile, interrogating (leaning in), plus a hat-shadowed eyes variant for menace beats
- [ ] ART-0106 · Alpha · P2 · S · Stroh wounded variant (bandaged, Chapter 4 story beat)

### Captain Mauer
- [ ] ART-0107 · Demo · P0 · M · Mauer concept: Kessendorf Watch captain, morion helm, city-arms tabard, halberd, a broken nose
- [ ] ART-0108 · Demo · P0 · M · Mauer portrait base + 8 expressions + blink + mouth
- [ ] ART-0109 · Demo · P2 · S · Mauer helm-off variant for the Chapter 2 camp scenes

### The Hollow Choir
- [ ] ART-0110 · Demo · P0 · M · Hollow Choir cantor design: a hooded chorister with a hollow porcelain singing-mask (open O-mouth), violet-lined robes and a hymnal chained to the wrist
- [ ] ART-0111 · Demo · P0 · M · Choir portrait (`choir` cast id): base + 4 states (singing, silent, mask-cracked, unmasked-in-shadow)
- [ ] ART-0112 · Demo · P1 · S · Lay-cantor patient portrait (op2-4 "The Silenced Cantor"): unmasked, throat bound, fearful and defiant expressions
- [ ] ART-0113 · Alpha · P1 · M · Choir Precentor (coven leader) design and portrait with 6 expressions for Chapters 3–5
- [ ] ART-0114 · Beta · P2 · M · 3 further Choir ranks (novice, cantor, precentor's hand) as silhouette-distinct portraits

### Chapter 1 patients (demo)
- [ ] ART-0115 · Demo · P0 · S · Jost, drover (op1-1): portrait with 3 expressions (pained, drunk-defiant, grateful)
- [ ] ART-0116 · Demo · P0 · S · Pieter, militiaman (op1-2): portrait in a Watch jerkin with 3 expressions (pained, stoic, grateful)
- [ ] ART-0117 · Demo · P0 · S · Anno, gunsmith's apprentice (op1-3): powder-blackened face, singed hair, 3 expressions
- [ ] ART-0118 · Demo · P0 · S · Unknown vagrant of Tanners' Rows (op1-4): buboes visible at the neck, 3 expressions (feverish, delirious, calm)
- [ ] ART-0119 · Demo · P0 · S · Emmerich, page-boy (op1-5): livery, a curse-sigil faintly visible on the collarbone, 3 expressions (frightened, unconscious, recovered)

### Chapter 2 patients (demo)
- [ ] ART-0120 · Demo · P0 · S · Gravehound victim (op2-1): a camp sutler with a torn sleeve, 3 expressions
- [ ] ART-0121 · Demo · P0 · S · Orsa Flintvein, dwarf prospector (op2-2): braided beard with ore beads, ruddy dwarf skin tone matching the dwarf flesh tint, 3 expressions
- [ ] ART-0122 · Demo · P0 · S · Henning, forager (op2-3): swollen bite at the neck, 3 expressions
- [ ] ART-0123 · Demo · P0 · S · Jorg, standard-bearer (op2-5): company colours over his shoulder, 3 expressions + a cursed variant (violet veins)

### Crowd, NPC & later-chapter cast
- [ ] ART-0124 · Demo · P1 · M · Generic NPC bust kit: 6 bodies × 8 heads × 4 hats, recolourable, for unnamed speakers (orderly, watchman, pikeman, camp follower)
- [ ] ART-0125 · Alpha · P1 · L · Chapter 3 named cast: 4 portraits with 6 expressions each (list from NAR's Chapter 3 script)
- [ ] ART-0126 · Alpha · P1 · L · Chapter 4 named cast: 4 portraits with 6 expressions each
- [ ] ART-0127 · Beta · P1 · L · Chapter 5 named cast: 3 portraits with 6 expressions each
- [ ] ART-0128 · Alpha · P1 · L · Chapter 3–5 patient portraits (≈ 15 ops × 3 expressions), covering elf, halfling and orc species variants
- [ ] ART-0129 · Alpha · P2 · M · Species reference sheet: human, dwarf, elf, halfling, orc skin tones, proportions and ear/tusk rules, with skin tones matched to `RACE_TINT`

### VN presentation art
- [ ] ART-0130 · Demo · P1 · M · 6 CG illustrations for Chapters 1–2 key beats (prologue arrival, Matins revealed, Stroh's first accusation, the camp at dawn, Lauds' twin bodies, the chapel epilogue) at 1920×1080
- [ ] ART-0131 · Alpha · P2 · L · 9 CG illustrations for Chapters 3–5 key beats
- [ ] ART-0132 · Demo · P2 · S · Portrait entry and exit poses: slide + fade, with a "lean-in" alt frame for Kreuzer, Ilse and Stroh
- [ ] ART-0133 · Beta · P2 · M · CG gallery thumbnails and a locked-silhouette card for the extras menu

---

## ART-F · Story backgrounds (locations)

Background standard: 3840×2160 master, 1920×1080 ship, split into far/mid/near/FX layers, each with a **day/dusk/night** lighting variant where the script needs it, replacing the matching `drawBackdrop()` key.

### Chapter 1 — Kessendorf (demo)
- [x] ART-0134 · Demo · P0 · L · Hospice of Saint Ildra, ward (`hospice`): vaulted arcade, cots, a leech-jar shelf and candle alcoves — day and night variants
- [x] ART-0135 · Demo · P0 · L · Operating theatre (`theatre`): tiered wooden gallery, a slab table, a brass lamp and a drain gutter — the background behind briefings and pre-op
- [x] ART-0136 · Demo · P0 · L · Kessendorf street (`street`): half-timbered Tanners' Rows, gutters, guild signs, a gibbet — dusk variant
- [x] ART-0137 · Demo · P0 · M · Kessendorf by night (`night`): rooftops, a bell tower, torchlit watch patrol — shared by Chapters 1 and 2
- [x] ART-0138 · Demo · P0 · M · Chapel of Saint Ildra (`chapel`): an original stained-glass window design (sun-in-palm), pews and a reliquary
- [x] ART-0139 · Demo · P1 · M · Hospice apothecary room: shelves of jars, an alembic and a drying-herb rafter (new `apothecary` backdrop key)
- [x] ART-0140 · Demo · P1 · M · Tanners' Rows plague alley for the op1-4 intro: a cart of bodies, a beak-masked physician in the far layer
- [x] ART-0141 · Demo · P2 · M · Guildhall of Surgeons interior for Haller scenes (portraits of guild masters, an anatomy chart)

### Chapter 2 — the war camp (demo)
- [x] ART-0142 · Demo · P0 · L · War camp (`camp`): Bruegel-style panorama of tents, pike stands, cook fires and camp followers — day and dusk variants
- [x] ART-0143 · Demo · P0 · M · Field surgeon's tent interior: a trestle table, a lantern, bloody straw and a saw rack
- [x] ART-0144 · Demo · P1 · M · Graveyard on the camp edge (Gravehound intro): tilted stones, a lychgate and fog layer
- [x] ART-0145 · Demo · P1 · M · Dwarf ore-cart and prospectors' camp (op2-2 intro)
- [x] ART-0146 · Demo · P1 · M · Forest edge with brood webs and egg sacs (op2-3 intro)
- [x] ART-0147 · Demo · P1 · M · Ruined abbey choir loft where the Hollow Choir sang (op2-4 and op2-5 story beats)
- [x] ART-0148 · Demo · P1 · S · Dawn battlefield vista for the Lauds reveal, with a sun-flare FX layer

### Chapters 3–5
- [ ] ART-0149 · Alpha · P1 · L · Chapter 3 location set: 5 backgrounds (list from NAR), each with 2 lighting variants
- [ ] ART-0150 · Alpha · P1 · L · Chapter 4 location set: 5 backgrounds with 2 lighting variants
- [ ] ART-0151 · Beta · P1 · L · Chapter 5 location set: 5 backgrounds including the Choir's cathedral and the Compline finale space
- [x] ART-0152 · Beta · P2 · M · Hospice ward "burned" variant for the late-game story state
- [ ] ART-0153 · Alpha · P2 · M · Discipline backgrounds: triage field, diagnosis study, inquisition cell and bone-setter's bench

### Background animation & FX layers
- [x] ART-0154 · Demo · P1 · M · Candle and torch flicker sprites (3 sizes, 12-frame loop) with light-pool masks for every Chapter 1–2 interior
- [x] ART-0155 · Demo · P1 · S · Drifting smoke and dust-mote loop overlay (tileable, additive) for interiors
- [x] ART-0156 · Demo · P1 · S · Rain and fog overlay layers for the `night` and graveyard scenes
- [x] ART-0157 · Demo · P2 · S · Ambient life loops: 2 pigeons, a hanging-sign sway and a camp flag ripple (6–8 frames each)
- [x] ART-0158 · Demo · P1 · S · Parallax depth values tuned per background so a 2% pointer offset shifts layers without revealing edges (all layers bleed 64 px)

---

## ART-G · Organ & flesh texture sets (WebGL2 flesh shader)

Texture-set standard: each set = **albedo** (painted, sRGB, 1024² tileable) + **normal** + **wet/spec** + **vein mask** + **cavity/AO** + **height**, packed per the spec in ART-C, authored so the shader's fbm/voronoi breakup and `u_corrupt` layer sit on top. Each set is verified on the in-engine flesh test page under candlelight and the Litany sepia.

### Test harness & look-dev
- [x] ART-0159 · Demo · P0 · M · Flesh look-dev page (`?scene=fleshlab`): pick organ × species × texture set, sliders for `u_light`, `u_pulse` and `u_corrupt`, side-by-side with the procedural baseline
- [x] ART-0160 · Demo · P0 · S · Tileability check script: each albedo and normal is offset by half a tile and diffed for seams (fails above threshold)
- [ ] ART-0161 · Demo · P0 · M · Painted-flesh style guide: how far from photoreal (no photo textures; woodcut hatching in the cavity channel), 6 approved swatches
- [x] ART-0162 · Demo · P1 · S · Wet-map authoring guide: specular response per organ (heart glossy, liver satin, bone dry) with target roughness values

### Human organ sets
- [ ] ART-0163 · Demo · P0 · L · Skin/subcutaneous `flesh` set: epidermis, fat lobules and muscle-fibre direction layers — used by all ten demo ops
- [ ] ART-0164 · Demo · P0 · M · Muscle-fascia detail variant of `flesh` (fibre-aligned normals) for deep laceration and arrow sites
- [x] ART-0165 · Demo · P1 · M · Burned-skin overlay set (charred, blistered, weeping) blended by burn severity for `Burn` entities
- [x] ART-0166 · Demo · P1 · M · Plague/rot overlay set (necrotic black-green, pus-slick wet map) blended by `Rot` spread
- [ ] ART-0167 · Alpha · P1 · L · `heart` set: myocardium striation, coronary vein mask and high-gloss wet map
- [ ] ART-0168 · Alpha · P1 · L · `lung` set: alveolar sponge albedo, pleural sheen and soot-speckle variant for smoke/powder victims
- [ ] ART-0169 · Alpha · P1 · L · `gut` set: serosa, peristalsis-ready normal and mesentery vein mask
- [ ] ART-0170 · Alpha · P1 · L · `liver` set: lobular albedo, a satin wet map and a cirrhotic variant
- [ ] ART-0171 · Beta · P1 · L · `brain` set: gyri height map, meningeal vessels and a pale-pink albedo
- [ ] ART-0172 · Alpha · P1 · L · `bone` set: cortical and cancellous, periosteum and a fracture-edge detail variant for bone-setting
- [ ] ART-0173 · Beta · P2 · M · Petrified-tissue overlay set (grey stone crust with cracks as a height map) for Sext and petrification ailments
- [ ] ART-0174 · Beta · P2 · M · Tallow-blood overlay (waxy, opaque, low-spec) for the Vespers Malison

### Species variants
- [x] ART-0175 · Demo · P0 · M · Dwarf `flesh` variant: denser muscle fibre, ruddier albedo, thicker subcutaneous fat — needed for op2-2 Orsa
- [x] ART-0176 · Alpha · P1 · M · Elf `flesh` variant: fine-grained, pale, translucent (fake subsurface in the albedo)
- [ ] ART-0177 · Alpha · P1 · M · Halfling `flesh` variant: rosy, softer fat layer
- [x] ART-0178 · Alpha · P1 · M · Orc `flesh` variant: green-grey, coarse and scarred, with thick hide normals
- [ ] ART-0179 · Beta · P2 · L · Species × organ spot-check: every organ set reviewed under all 5 species tints in `fleshlab`, with a screenshot matrix archived
- [ ] ART-0180 · Beta · P2 · M · Monster anatomy set for inquisition forensics (gravehound and brood-spider tissue)

### Corruption & Malison tissue
- [x] ART-0181 · Demo · P0 · M · Curse-corruption texture (violet veining, bruise-black necrosis, woodcut-hatched sigil scarring) driven by `u_corrupt` 0–1, replacing the procedural tint
- [x] ART-0182 · Demo · P1 · S · Curse-corruption flow map so violet veins crawl toward the Malison position
- [x] ART-0183 · Alpha · P2 · M · Per-Hour corruption palette variants (8), each keyed to its Malison's colour story

---

## ART-H · Ailment sprites & animation

Ailment standard: painted sprite(s) in the woodcut-over-paint style at 2× virtual resolution, with **idle, being-treated and resolved** states, atlased, each replacing the entity's vector `draw()`; readability test: identifiable at 100% zoom on every organ texture set within 0.5 s (hallway test, 5 testers).

### Incisions, lacerations & sutures
- [x] ART-0184 · Demo · P0 · M · Incision art: a tileable cut-edge strip sprite (skin lips, fat layer, bleeding edge) drawn along the `Incision` polyline, with an opening animation over 6 frames
- [x] ART-0185 · Demo · P0 · M · Laceration set: 3 widths × 2 edge types (clean blade, ragged claw), tileable along the path, with a pulse-bleed overlay
- [x] ART-0186 · Demo · P0 · S · Gut Thread suture art: stitch sprite per crossing (gut-coloured, knotted) plus a tightening pull frame for `StitchLine`
- [x] ART-0187 · Demo · P1 · S · Claw-rake variant: 3–4 parallel lacerations as one grouped decal for monster ops (op2-1)
- [x] ART-0188 · Demo · P1 · S · Closed-wound state: a sutured scar sprite that persists to the results screen
- [ ] ART-0189 · Alpha · P2 · S · Surgical-flap art (retracted skin with a pin clamp) for deep-organ ops in Chapters 3–5

### Fluids
- [x] ART-0190 · Demo · P0 · M · Blood pool sprites: 4 shapes × 3 sizes with a wet-map channel, a spreading flipbook (8 frames) and a Leech-Pipe draining shrink
- [x] ART-0191 · Demo · P0 · S · Pus and black-bile variants of the pool set (colour, opacity, viscosity highlight) for `BloodPool` kinds
- [x] ART-0192 · Demo · P1 · S · Arterial spurt flipbook (6 frames, 3 directions) for severed-vessel events
- [x] ART-0193 · Demo · P1 · S · Salve (Saint's Salve) coverage decal: pale-gold paste with a glisten, fading over 1.5 s once absorbed
- [x] ART-0194 · Alpha · P2 · S · Tallow-clot sprites (for Vespers) with a melt animation under the Brand

### Embedded objects
- [x] ART-0195 · Demo · P0 · M · Arrow: a painted goose-fletched shaft with a broadhead, the embedded end masked into the tissue, plus a wobble-on-grab 4-frame loop
- [x] ART-0196 · Demo · P0 · M · Barbed arrow: a visible barb silhouette, a "nicked" state after Lancet release and a torn-out bad state (flesh chunk on the barb)
- [x] ART-0197 · Demo · P0 · S · Crossbow bolt: a short, heavy quarrel with square head and a leather-vaned variant
- [x] ART-0198 · Demo · P0 · S · Lead shot: 3 ball sizes, a flattened deformed variant and a powder-tattoo ring decal around the entry wound
- [x] ART-0199 · Demo · P0 · S · Lodged fang/tooth: gravehound canine and brood-spider fang, with a venom-stained root
- [x] ART-0200 · Demo · P1 · S · Glass shards: 5 shapes with a refraction highlight (rim-lit via the additive pass)
- [x] ART-0201 · Demo · P0 · M · Hexstone shard: black-violet crystal with pulsing inner light (6-frame loop), a crackle on grab and a dissolve on removal
- [x] ART-0202 · Demo · P1 · S · Extraction-tray art: removed objects dropped into a pewter kidney dish at screen edge (one sprite per object type)
- [ ] ART-0203 · Alpha · P2 · S · Splinter and shrapnel set (wood, iron nail, gun-barrel fragment) for Chapter 3 siege ops

### Burns
- [x] ART-0204 · Demo · P0 · M · Fire burn: 3 severity decals (reddened, blistered, charred), with a cooling transition when salved
- [x] ART-0205 · Demo · P0 · S · Acid burn: yellow-green etched decal with a bubbling 6-frame loop and a neutralised state
- [x] ART-0206 · Demo · P0 · M · Hexfire burn: violet-cored flame-edge decal with licking flame flipbook (8 frames) that reignites if untreated
- [ ] ART-0207 · Demo · P1 · S · Powder burn with embedded black grains (op1-3), with grains as pickable sub-sprites
- [x] ART-0208 · Beta · P1 · M · Dragon-breath burn: deep crater with a glassy fused-edge normal and an ember-glow loop

### Plague & disease
- [x] ART-0209 · Demo · P0 · M · Bubo: swelling sprite in 3 sizes with a tension-shine wet map, a lance-open burst flipbook (6 frames) and a drained, deflated state
- [x] ART-0210 · Demo · P0 · M · Rot/gangrene: spreading necrotic decal (4 growth stages) with a crusted edge and a debrided clean state
- [x] ART-0211 · Demo · P1 · S · Pox pustule cluster decal (small, many) for Symptom Loom reuse
- [x] ART-0212 · Alpha · P2 · S · Flux/fever flush overlay (full-field tint map) and a sweat-bead sparkle loop
- [ ] ART-0213 · Alpha · P2 · M · Symptom Loom module icons (12 symptom modules) as woodcut roundels for challenge-mode briefings

### Venom & creatures
- [x] ART-0214 · Demo · P0 · M · Venom: a spreading vein-web decal (green-black) with a tincture-neutralised fade, driven by the `Venom` entity's spread value
- [x] ART-0215 · Demo · P0 · M · Grub: a segmented larva sprite with an 8-frame crawl cycle, a burrow-in/burrow-out pair and a squirm-in-tongs loop
- [x] ART-0216 · Demo · P0 · M · Egg sac: translucent cluster with visible embryos (3 sizes), a pulsing loop, a hatch flipbook (grubs emerge) and a Tongs-removal state — op2-3
- [x] ART-0217 · Demo · P1 · S · Brood silk strands (tileable web decal) that must be cut with the Lancet
- [x] ART-0218 · Alpha · P2 · M · Parasite worm (long, whip-like) with a 12-frame ripple for Chapter 3 marsh ops

### Curses & sigils
- [x] ART-0219 · Demo · P0 · M · Curse-sigil set: 8 original sigil glyphs (IP-checked, no eight-pointed stars), each with stroke-order data for trace-to-erase and a searing-out animation
- [x] ART-0220 · Demo · P0 · S · Sigil glow states: dormant (faint), draining (pulsing violet) and seared (charred gold)
- [x] ART-0221 · Beta · P1 · M · Petrification: creeping stone-crust decal (4 stages) and a crack-apart flipbook for the Tongs
- [x] ART-0222 · Beta · P2 · S · Name-sigils (for Prime): blackletter names written stroke by stroke as a 20-frame write-on effect

### Discipline-specific
- [ ] ART-0223 · Alpha · P2 · M · Bone-setting: fracture sprites (simple, comminuted, compound with bone-end), splint and bandage wrap art
- [ ] ART-0224 · Alpha · P2 · M · Field triage: casualty body-card art (8 poses) with tag ribbons (black, red, yellow, green)
- [ ] ART-0225 · Beta · P2 · M · Inquisition forensics: evidence-item illustrations (15 items) on a parchment evidence board

---

## ART-I · The Malison — boss designs for all eight Hours

Boss standard: concept (3 thumbnails → chosen callout sheet) → per-phase sprite/flipbook set → shader VFX spec handed to ENG → in-engine review in a boss sandbox, plus a **Book-of-Hours title card** (an illuminated miniature of the Hour, used on the intro and on the results screen). Bosch hybrid-grotesque language; curse-violet is the shared thread, and each Hour gets its own secondary colour.

### Shared Malison language
- [x] ART-0226 · Demo · P0 · M · Malison design language sheet: common anatomy (woven-thread body, liturgical fragments, an eye motif), shared violet and per-Hour secondary colours, with 8 silhouettes side by side for distinctness
- [x] ART-0227 · Demo · P0 · S · Book-of-Hours card template: an illuminated miniature frame with the Hour's name in blackletter and a clock-face marginal border
- [x] ART-0228 · Demo · P1 · M · Malison shard (`MalisonShard`) art: 3 thread-knot shapes, a drift loop and a burst-on-kill flipbook
- [x] ART-0229 · Demo · P1 · S · Boss health "thread spool" HUD art that unwinds as the Malison is damaged

### Matins (Chapter 1 — demo)
- [x] ART-0230 · Demo · P0 · M · Matins concept: a shrouded vigil-mass of candle-wax cloth with one great lidded eye — callout sheet with closed/opening/open states
- [x] ART-0231 · Demo · P0 · L · Matins sprites: shroud body (idle breathing 12-frame loop), eye open/close flipbook (10 frames), hurt flash and 3 phase-degradation states, replacing the vector `Malison`
- [x] ART-0232 · Demo · P0 · M · Matins shader VFX spec: shroud cloth distortion (vertex wobble), eye iris glow ramp and a darkness-vignette pulse on the "watching" rhythm
- [x] ART-0233 · Demo · P0 · M · Matins death sequence: the shroud unravels into threads and motes (24 frames) with a final eye-close
- [x] ART-0234 · Demo · P1 · S · Matins Book-of-Hours card and a boss-intro splash (night vigil miniature)

### Lauds (Chapter 2 — demo)
- [ ] ART-0235 · Demo · P0 · M · Lauds concept: two antiphonal bodies (a "choir" of mouths each) joined by a light-thread, with a fused phase-3 form — callout sheet
- [x] ART-0236 · Demo · P0 · L · Lauds sprites: body A and body B idle loops, "call" and "answer" singing flipbooks (8 frames each), hurt and heal-answer states
- [x] ART-0237 · Demo · P0 · M · Lauds light-thread VFX: a stretchable beam sprite with travelling pulses, a sever animation (Lancet) and a tie-off (Thread)
- [x] ART-0238 · Demo · P0 · M · Lauds dawn-flare VFX spec: full-screen gold bloom burst that blinds the Scrying Lens view, with an ENG shader-parameter table (intensity curve, duration)
- [ ] ART-0239 · Demo · P0 · L · Lauds phase-3 fused form: merge transition (20 frames), fused idle loop and death sequence
- [x] ART-0240 · Demo · P1 · S · Lauds Book-of-Hours card (dawn psalm miniature) and boss-intro splash

### Prime (Chapter 3)
- [ ] ART-0241 · Alpha · P1 · M · Prime concept: a scribe-thing with quill fingers that reads the roll of the dead — callout sheet
- [ ] ART-0242 · Beta · P1 · L · Prime sprites: idle, writing-stroke loop, hurt and death, integrated with the name-sigil write-on effect
- [x] ART-0243 · Beta · P2 · S · Prime Book-of-Hours card and intro splash

### Terce (Chapter 3)
- [ ] ART-0244 · Alpha · P1 · M · Terce concept: a pentecostal hexfire crown with tongues that leap between organs — callout sheet
- [ ] ART-0245 · Beta · P1 · L · Terce sprites and VFX: tongue-of-fire flipbooks (leap, land, spread), root-core states and death
- [x] ART-0246 · Beta · P2 · S · Terce Book-of-Hours card and intro splash

### Sext (Chapter 4)
- [ ] ART-0247 · Alpha · P1 · M · Sext concept: the noonday demon of acedia, a slumped stone-lidded torpor with a false-calm halo — callout sheet
- [ ] ART-0248 · Beta · P1 · L · Sext sprites and VFX: petrify-spread wave, fake-vitals overlay glitch, crack states and death
- [x] ART-0249 · Beta · P2 · S · Sext Book-of-Hours card and intro splash

### None (Chapter 4)
- [ ] ART-0250 · Alpha · P1 · M · None concept: a heart-seeking burrower (hourglass-segmented) — callout sheet with 4 size stages
- [ ] ART-0251 · Beta · P1 · L · None sprites: burrow tunnel decal, surfacing flipbook, 4 cut-down size stages, extraction and death
- [x] ART-0252 · Beta · P2 · S · None Book-of-Hours card and intro splash

### Vespers (Chapter 5)
- [ ] ART-0253 · Alpha · P1 · M · Vespers concept: a lamp-lighter of wick-filaments that turns blood to tallow — callout sheet
- [ ] ART-0254 · Beta · P1 · L · Vespers sprites and VFX: wick-filament growth, glow-node "lamps" (lit/dimming/out), shadow-hide dissolve and death
- [x] ART-0255 · Beta · P2 · S · Vespers Book-of-Hours card and intro splash

### Compline (Chapter 5 finale)
- [ ] ART-0256 · Alpha · P0 · M · Compline concept: a veiled sleeper made of every Hour's motif, with a "Great Silence" form — callout sheet with 3 phases
- [ ] ART-0257 · Beta · P0 · L · Compline sprites: 3 phase forms, silence-node sprites (intact/broken), a Litany-theft animation and a two-hand-combo final vulnerable state
- [x] ART-0258 · Beta · P0 · M · Compline VFX spec: audio-mute visual (desaturate + chalk-line hatching), an inverted Litany ripple and a final death that restores colour
- [ ] ART-0259 · Beta · P1 · M · Compline Book-of-Hours card, intro splash and a full-screen finale CG

### The Unsung Hour (secret, post-game)
- [ ] ART-0260 · Release · P2 · M · Unsung Hour concept: a patchwork of every lost patient's wound motifs — callout sheet
- [ ] ART-0261 · Release · P2 · L · Unsung Hour sprites and VFX assembled from the other Hours' atlases plus 1 unique core sprite set
- [x] ART-0262 · Release · P3 · S · Unsung Hour blank Book-of-Hours card (an illuminated page with the text scraped away)

---

## ART-J · Tool icons & cursors

### Tool icons
- [x] ART-0263 · Demo · P0 · M · 8 painted tool icons (Lancet, Tongs, Leech-Pipe, Gut Thread, Saint's Salve, Tincture, Cautery Brand, Scrying Lens) at 128² with a brass-engraved style, replacing vector `toolIcon()`
- [x] ART-0264 · Demo · P0 · S · Icon states for each tool: idle, selected (gilt rim), disabled (tarnished) and cooldown (tincture/salve refill)
- [ ] ART-0265 · Demo · P0 · S · Silhouette test: all 8 icons distinguishable in pure black at 48 px (5-tester hallway test, ≥ 95% correct)
- [x] ART-0266 · Demo · P1 · S · Small 32 px icon variants for the tutorial text inline glyphs and the keybind options page
- [ ] ART-0267 · Demo · P1 · S · Leech-Pipe live-leech detail: a 4-frame squirm loop on the tray icon
- [x] ART-0268 · Alpha · P2 · S · Discipline-tool icons (splint, bone saw, triage tag, evidence tongs, magnifier) in the same style

### Cursors & in-field tool sprites
- [x] ART-0269 · Demo · P0 · M · In-field tool sprites for all 8 tools, drawn at the pointer during use (lancet blade, tong jaws open/closed, pipe nozzle, needle + thread trail, salve spatula, syringe, glowing brand, lens rim)
- [x] ART-0270 · Demo · P0 · S · Tool hotspot definitions (tip pixel) for each tool sprite, verified with a debug crosshair so hits land where the tip is
- [x] ART-0271 · Demo · P0 · S · Menu cursor (quill) and a busy cursor (hourglass), plus the hardware-cursor fallback PNGs at 32² and 64²
- [x] ART-0272 · Demo · P1 · S · Replace `reticle()` with a brass crosshair and a context tint (green valid target, red invalid)
- [x] ART-0273 · Demo · P1 · S · Gamepad/Steam Deck virtual-cursor art (larger ring, 1.5× size) and the button-prompt glyph set (Xbox, PlayStation, Deck)
- [x] ART-0274 · Demo · P1 · S · Litany star-trace cursor trail: a gilt ink stroke that fades over 0.6 s

---

## ART-K · VFX

### Surgical VFX
- [x] ART-0275 · Demo · P0 · M · Blood VFX: droplet particles (6 sprites), a splatter decal set (8), a Lancet-cut spray and a Leech-Pipe suction swirl
- [x] ART-0276 · Demo · P0 · S · Cautery Brand VFX: contact sparks (8-frame), a smoke puff and a sear-glow decal that cools from orange to black over 2 s
- [x] ART-0277 · Demo · P0 · S · Tincture injection VFX: a vein-glow ripple from the needle point and a stabilised "calm" shimmer
- [x] ART-0278 · Demo · P0 · S · Scrying Lens VFX: a lens-edge distortion ring and an ink-wash reveal of hidden objects (sepia underlay)
- [x] ART-0279 · Demo · P1 · S · Salve apply VFX: a smear stroke texture and a glint sparkle on completion
- [x] ART-0280 · Demo · P1 · S · Suture completion VFX: a thread-tighten glint and a small gilt "sealed" flash
- [x] ART-0281 · Demo · P1 · S · Tongs pickup and drop VFX: a flesh-pull stretch decal and a clink spark on the kidney dish

### Curse & Malison VFX
- [x] ART-0282 · Demo · P0 · M · Curse motes: 4 violet mote sprites with trailing wisps, a spawn burst and a Brand-kill pop
- [x] ART-0283 · Demo · P0 · S · Curse-hit feedback: a violet crackle along new lacerations when the Malison attacks
- [x] ART-0284 · Demo · P1 · S · Sigil sear VFX: gold embers rising from each seared stroke
- [x] ART-0285 · Demo · P1 · S · Malison phase-change VFX: a thread-snap shockwave ring and screen-edge violet ink bleed

### Litany of Stillness
- [x] ART-0286 · Demo · P0 · M · Litany activation: a gilt five-pointed star that burns in along the traced path, then expands into the sepia ripple (art timing matched to the `u_litany` curve)
- [x] ART-0287 · Demo · P0 · S · Litany active overlay: slow drifting dust motes frozen in air, and marginalia glyphs at the screen edge that fade as the 8 s run out
- [x] ART-0288 · Demo · P1 · S · Litany end: the star fractures and falls as gold leaf (12 frames)
- [x] ART-0289 · Demo · P1 · S · Failed-gesture feedback: a smudged ink stroke that fizzles

### Feedback & HUD VFX
- [x] ART-0290 · Demo · P0 · S · COOL rating burst: gilt stamp with a halo of leaf flakes; GOOD, BAD and MISS each with their own lighter treatment
- [x] ART-0291 · Demo · P1 · S · Low-vitals VFX art: a cracked-glass overlay on the vitals gauge and blood-vessel creep at the screen edges, in sync with the red pulse
- [x] ART-0292 · Demo · P1 · S · Operation success and failure transitions: a woodcut page-turn wipe (success) and an ink-flood to a Holbein skeleton (failure)
- [x] ART-0293 · Demo · P2 · S · Combo milestone VFX at ×5 and ×10 (a ribbon unfurl with gilt edges)

### VFX system standards
- [x] ART-0294 · Demo · P0 · S · VFX spec template (sprite, frames, fps, blend mode, lifetime, max concurrent) filled for every Demo effect in `docs/art/vfx/`
- [x] ART-0295 · Demo · P1 · S · Reduced-flashing variants for the Lauds dawn-flare, the Litany burst and low-vitals pulse (accessibility toggle) — peak luminance change under 3 flashes/s
- [ ] ART-0296 · Alpha · P2 · M · VFX for Chapter 3–5 ailments (petrify crack, tallow melt, name-sigil write-on, dragon-breath embers) using the same template

---

## ART-L · Animation

### Operation-field animation
- [x] ART-0297 · Demo · P0 · S · Animation timing sheet: standard fps (12 for woodcut flipbooks, 24 for VFX), ease curves and hit-pause frames, applied to every flipbook in the demo
- [x] ART-0298 · Demo · P1 · M · Tissue breathing and heartbeat deformation: a mesh-warp map per flesh set synced to `u_pulse` (no visible sliding of ailment sprites)
- [x] ART-0299 · Demo · P1 · S · Embedded-object reaction animation: the arrow shaft twitches with the heartbeat (3-frame), and the grub flinches on a Lancet near-miss
- [x] ART-0300 · Beta · P2 · M · Organ-specific motion: lung inflate/deflate and gut peristalsis flipbooks for Chapters 3–5 organ sets

### Portrait & VN animation
- [x] ART-0301 · Demo · P0 · S · Blink timing (random 2–6 s interval, 3 frames) and lip-flap timing tied to text reveal speed for all demo portraits
- [x] ART-0302 · Demo · P1 · M · Idle breathing (a 2-layer mesh warp) on Kreuzer, Ilse, Haller, Stroh and Mauer portraits
- [x] ART-0303 · Demo · P2 · M · Hollow Choir mask animation: a slow tilt and a violet glow breathing from the mask's mouth
- [ ] ART-0304 · Beta · P2 · M · Idle breathing on Chapter 3–5 principal portraits

### Title & menu animation
- [x] ART-0305 · Demo · P1 · M · Title screen animated layers: candle flicker, drifting ash and a slow key-art parallax (10 s loop)
- [x] ART-0306 · Demo · P2 · S · Menu transitions: a page-turn (8 frames) between menu pages and a wax-seal break on "New Game"
- [ ] ART-0307 · Demo · P2 · S · Animated logo sting (3 s) for the game's boot sequence

---

## ART-M · Title, key art & logo

### Logo & title treatment
- [ ] ART-0308 · Demo · P0 · M · Game logo "Suture & Steel": a blackletter wordmark with a crossed lancet and suture-needle ampersand; subtitle "The Malison Hours" in IM Fell SC — vector master (SVG) plus a trademark-search note
- [ ] ART-0309 · Demo · P0 · S · Logo variants: full-colour, one-colour (black and parchment), on-dark, a stacked version and an icon-only ampersand mark
- [ ] ART-0310 · Demo · P1 · S · Studio/publisher boot splash layout using the logo kit
- [x] ART-0311 · Demo · P1 · S · Application icon set: Windows `.ico` (16–256), macOS `.icns` and Linux PNGs (512), from the ampersand mark

### Key art
- [ ] ART-0312 · Demo · P0 · L · Key art: Kreuzer over a Wound-Man patient, with Ilse at his side, Stroh in shadow and the Malison eye above — 6000×3375 master, layered so it can be recomposed
- [x] ART-0313 · Demo · P0 · S · Key-art crop map documenting safe areas for every store size (capsules, hero, library, social)
- [ ] ART-0314 · Demo · P1 · M · Title-screen composition derived from the key art with room for menu items (in-engine at 1920×1080)
- [ ] ART-0315 · Beta · P2 · L · Launch key art v2 (Compline-teaser version) for 1.0

---

## ART-N · Steam capsule & store art

### Steam capsules (demo page + main page)
- [ ] ART-0316 · Demo · P0 · M · Header capsule 920×430 and small capsule 462×174: logo legible at thumbnail size (tested at 50% downscale)
- [ ] ART-0317 · Demo · P0 · S · Main capsule 1232×706 and vertical capsule 748×896
- [ ] ART-0318 · Demo · P0 · S · Library capsule 600×900, library hero 3840×1240 (logo-free) and library logo PNG with transparent background
- [ ] ART-0319 · Demo · P0 · S · Page background 1438×810 (darkened key art) and a community icon 184×184
- [ ] ART-0320 · Demo · P0 · S · Demo-specific capsule variants with a "FREE DEMO" banner that is compliant with Steam's text rules
- [ ] ART-0321 · Demo · P0 · S · Steam capsule compliance check: no review quotes, award laurels or discount text on base capsules — checklist signed before upload
- [ ] ART-0322 · Demo · P1 · S · Next Fest event capsule and a festival page banner

### Screenshots & store media
- [ ] ART-0324 · Demo · P1 · S · 5 animated GIF/WebM clips (≤ 3 MB each) for the store description: arrow extraction, Litany, Matins eye, Lauds thread sever and the rank seal
- [x] ART-0325 · Demo · P1 · S · Store description section-header banners (616 px wide) in the woodcut style: "Operate", "The Malison", "Kessendorf"
- [ ] ART-0327 · Release · P1 · S · Seasonal/sale capsule overlays (template) for the Steam sale calendar

### Marketing & social
- [x] ART-0328 · Demo · P1 · M · Social media kit: avatar, X/Bluesky banner (1500×500), YouTube banner, a Discord server icon and banner
- [ ] ART-0329 · Demo · P1 · S · Press kit art folder: logo pack, key art, 10 screenshots and character renders on transparent backgrounds
- [x] ART-0330 · Demo · P2 · M · 6 "Wound Man" woodcut promo illustrations (one per demo ailment family) for social posts
- [ ] ART-0331 · Beta · P2 · M · Physical/merch-ready art: a print-resolution (300 dpi, CMYK proof) key art and an A2 poster layout

---

## ART-O · Trailer storyboards

### Demo / announce trailer
- [x] ART-0332 · Demo · P0 · M · Announce trailer (60–75 s) beat sheet: hook (the barbed arrow), the world (Kessendorf), the tools, the Malison, the Litany, the title card and the wishlist call-to-action
- [ ] ART-0333 · Demo · P0 · M · Announce trailer storyboard: ≥ 30 panels with shot duration, camera move and the in-engine capture setup per panel
- [x] ART-0334 · Demo · P1 · S · Trailer capture scene list: debug seeds and states needed to reproduce each shot deterministically (with ENG's replay tool)
- [x] ART-0335 · Demo · P1 · S · Trailer title cards and end slate (logo, "Free Demo on Steam", platforms, rating placeholder) in the woodcut style
- [x] ART-0336 · Demo · P1 · S · Steam store autoplay cut (30 s) storyboard, readable with sound off (burned-in woodcut captions)
- [x] ART-0337 · Demo · P2 · S · Next Fest livestream overlay art: a frame, lower-thirds and a "Wishlist" bug

### Launch & post-launch trailers
- [x] ART-0338 · Beta · P1 · M · Launch trailer (90 s) storyboard including Chapters 3–5 Hours (Prime through Compline, with no final-form spoilers)
- [x] ART-0339 · Beta · P2 · M · Gameplay deep-dive trailer (2–3 min) storyboard with tool-by-tool callouts
- [x] ART-0340 · Release · P2 · S · Accolades trailer template (laurels layout) for post-launch reviews

---

## ART-P · Outsourcing pipeline

### Vendor setup
- [ ] ART-0342 · Demo · P0 · M · Outsourcing brief pack: art bible, style frames, naming/export specs, a sample finished asset per class and the IP-avoidance checklist — one zip per asset class
- [ ] ART-0343 · Demo · P0 · M · Paid test task for 3 candidate vendors/freelancers (1 portrait with 3 expressions + 1 ailment sprite set), scored on a rubric (style match, turnaround, revisions needed)
- [x] ART-0344 · Demo · P0 · S · Contract terms checklist: work-for-hire/full IP assignment, no AI-generated content without disclosure, source files delivered, credit line
- [x] ART-0345 · Demo · P1 · S · Asset tracker sheet (asset ID, vendor, stage, due, cost, approved-by) covering every Demo asset in this file
- [x] ART-0346 · Demo · P1 · S · Feedback protocol: paintover-based notes, max 2 revision rounds per stage, 48 h review SLA from our side
- [ ] ART-0347 · Demo · P1 · S · Shared delivery folder with automated naming/format validation (the CI script from ART-C run on upload)
- [ ] ART-0348 · Alpha · P1 · M · Chapter 3–5 outsourcing plan: asset counts, vendor allocation and budget per chapter, with the portrait and background vendors locked
- [ ] ART-0349 · Alpha · P2 · S · Vendor style-drift check: every 20th delivered asset placed next to the style frames in a monthly review

### Budget & schedule
- [x] ART-0350 · Demo · P0 · M · Demo art budget and schedule: cost and weeks per asset class (portraits, backgrounds, flesh sets, ailments, bosses, UI, store) with a 15% contingency
- [ ] ART-0351 · Alpha · P1 · M · Full-game art budget re-forecast after demo actuals (cost per asset vs estimate)
- [x] ART-0352 · Demo · P1 · S · Credits list for all art contributors maintained in `docs/art/credits.md`, feeding the in-game credits

---

## ART-Q · Art QA

### Review & checks
- [ ] ART-0353 · Demo · P0 · S · Art QA checklist per asset class (resolution, naming, alpha edges, palette, IP check, readability, scale) — every Demo asset gets a ticked checklist
- [ ] ART-0354 · Demo · P0 · M · Automated asset lint in CI: dimensions match the spec, power-of-two for textures, no non-premultiplied alpha, file size within budget, no orphaned manifest entries
- [ ] ART-0355 · Demo · P0 · M · Screenshot-diff regression suite: 20 canonical scenes (each backdrop, the op HUD, each demo boss phase) rendered headless and diffed against approved goldens
- [ ] ART-0356 · Demo · P0 · S · Resolution pass: every demo screen checked at 1280×720, 1920×1080, 2560×1440, 3840×2160, 1280×800 (Steam Deck) and ultrawide 3440×1440 letterboxed — no blurry upscales, no cropped UI
- [x] ART-0357 · Demo · P1 · S · Colour-blind pass (protanopia, deuteranopia, tritanopia simulation) on the ratings, vitals, sigils vs. veins and the curse-violet vs. blood contrast — fixes filed
- [ ] ART-0358 · Demo · P1 · S · Readability pass of every ailment on every flesh set it can appear on in the demo (a matrix screenshot)
- [ ] ART-0359 · Demo · P1 · S · Gore-level review against the rating target, with the flagged assets listed and resolved before the ratings submission
- [x] ART-0360 · Demo · P1 · S · Localisation art pass: no baked-in text in any image except the logo; stamps and seals with text use a runtime text layer
- [x] ART-0361 · Demo · P1 · S · Placeholder sweep: the build report shows 0 `placeholder` assets in Chapters 1–2 (from the manifest tags)
- [x] ART-0362 · Demo · P2 · S · Z-order and overlap audit: ailment sprites never draw under blood pools unless intended; HUD never overlaps a Malison weak point at 16:10
- [ ] ART-0363 · Beta · P0 · M · Full-game art QA pass of Chapters 3–5 with the same checklist, suite and matrices
- [ ] ART-0364 · Release · P1 · S · Final IP audit of every shipped asset (Games Workshop and other third-party look-alike check) signed off by the producer

---

## ART-R · Performance budgets for art

### Budgets
- [x] ART-0365 · Demo · P0 · S · Texture-memory budget: ≤ 256 MB GPU texture memory in any scene on the min-spec (integrated GPU), documented per scene type
- [x] ART-0366 · Demo · P0 · S · Atlas budget: ≤ 6 2048² atlas pages resident in an operation (UI, tools, ailments, VFX, boss, portraits-callout)
- [ ] ART-0367 · Demo · P0 · S · Flesh texture budget: 1 organ set resident at a time at 1024² (KTX2/BasisU, ~5.3 MB with mips), with a 512² fallback for low settings
- [ ] ART-0368 · Demo · P0 · S · Draw-budget rule for art: an operation frame ≤ 3 texture binds and ≤ 20k batched verts at peak VFX, measured with the ENG profiler overlay
- [ ] ART-0369 · Demo · P0 · S · Overdraw budget: additive VFX ≤ 4× overdraw on the hot area at peak (Litany + motes + sparks), verified on the Steam Deck
- [x] ART-0370 · Demo · P1 · S · Download-size budget: demo art ≤ 400 MB on disk; the build report lists the 20 largest assets
- [ ] ART-0371 · Demo · P1 · S · Backgrounds: ≤ 4 layers × 1920×1080 WebP resident per story scene, with the next scene's background preloaded
- [ ] ART-0372 · Demo · P1 · S · Portrait budget: ≤ 4 portraits resident (2048² atlas page each, expressions packed together)
- [x] ART-0373 · Demo · P1 · S · Particle caps per effect (blood 64, sparks 48, motes 32, leaf 40) set in the VFX specs and enforced in code
- [ ] ART-0374 · Demo · P1 · M · Low/Medium/High art quality tiers: texture resolution, particle density, parallax layers and animated background FX per tier, reviewed on the Steam Deck (target 60 fps at Medium)
- [ ] ART-0375 · Alpha · P1 · S · Per-chapter memory re-check when Chapter 3–5 art lands; budget overruns filed as P1 bugs
- [ ] ART-0376 · Release · P1 · S · Final art-size optimisation pass: unused assets removed (manifest reference check), and recompression tuned to hit the 1.0 download budget

---

## ART-S · Post-launch

### Updates & DLC art
