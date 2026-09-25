# VFX specs (ART-0294)

Every Demo effect, filled in on the spec template below. The operation effects are procedural:
the "sprite" column names the function that draws them (`src/art/vfx.ts`, `src/render/particles.ts`,
`src/art/bossVfx.ts`) rather than a PNG, so there is nothing to atlas. The **Operation effects**
table is generated from `VFX_SPECS` (`npx tsx scripts/art/vfx-specs.ts`), and
`tests/unit/art/vfx.test.ts` fails if an effect in code is missing here. Every effect loops on
`?scene=vfxlab` for review (`?scene=vfxlab&t=0.4` freezes the board for a screenshot).

## Template

| Field | Meaning |
| --- | --- |
| Sprite | What draws it: a procedural function, a shader mode or an atlas frame id |
| Frames | Flipbook frames (`procedural` = continuous, driven by time or state) |
| fps | 24 for VFX, 12 for woodcut flipbooks (timing sheet: [timing.md](timing.md)) |
| Blend | `alpha` (paint, decals, ink) or `add` (light: sparks, glows, gilt) |
| Lifetime | Seconds one instance lives; `while active` = drawn while its condition holds |
| Max concurrent | Live instances. Past it the oldest is retired (`VfxLayer.add`); particles stop spawning at their cap (`PARTICLE_CAPS`, ART-0373) |

## Operation effects

| Effect | Task | Sprite | Frames | fps | Blend | Lifetime | Max concurrent |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `blood-droplet` | ART-0275 | particles.bloodDroplet ×6 | 1 | 24 | alpha | 0.55 s | 64 |
| `blood-splatter` | ART-0275 | vfx.splatter ×8 | 1 | 24 | alpha | 6 s | 24 |
| `lancet-spray` | ART-0275 | vfx.spray | 6 | 24 | alpha | 0.25 s | 4 |
| `leech-swirl` | ART-0275 | vfx.swirl | procedural | 24 | alpha | while active | 1 |
| `brand-sparks` | ART-0276 | particles.sparkSprite | 8 | 24 | add | 0.35 s | 48 |
| `brand-smoke` | ART-0276 | vfx.smokePuff | 12 | 24 | alpha | 0.5 s | 6 |
| `sear-glow` | ART-0276 | vfx.sear | 48 | 24 | add | 2 s | 16 |
| `tincture-ripple` | ART-0277 | vfx.veinRipple | 24 | 24 | add | 1 s | 3 |
| `tincture-calm` | ART-0277 | vfx.calmShimmer | 36 | 24 | add | 1.5 s | 1 |
| `lens-ring` | ART-0278 | POST_FS lens + vfx.lensRing | procedural | 24 | add | while active | 1 |
| `lens-wash` | ART-0278 | vfx.inkWash | procedural | 24 | alpha | while active | 8 |
| `salve-smear` | ART-0279 | vfx.smear | 1 | 24 | alpha | 1.5 s | 6 |
| `salve-glint` | ART-0279 | vfx.glint | 8 | 24 | add | 0.35 s | 4 |
| `suture-glint` | ART-0280 | vfx.threadGlint | 6 | 24 | add | 0.25 s | 4 |
| `suture-sealed` | ART-0280 | vfx.sealedFlash | 12 | 24 | add | 0.5 s | 2 |
| `tongs-stretch` | ART-0281 | vfx.fleshPull | 24 | 24 | alpha | 1 s | 3 |
| `tongs-clink` | ART-0281 | vfx.clink | 6 | 24 | add | 0.25 s | 3 |
| `curse-mote` | ART-0282 | particles.curseMote ×4 | 1 | 24 | add | 2.2 s | 32 |
| `curse-spawn` | ART-0282 | vfx.curseBurst | 12 | 24 | add | 0.5 s | 4 |
| `brand-kill-pop` | ART-0282 | vfx.killPop | 8 | 24 | add | 0.35 s | 4 |
| `curse-crackle` | ART-0283 | vfx.crackle | 18 | 24 | add | 0.75 s | 6 |
| `sigil-embers` | ART-0284 | particles.ember | 1 | 24 | add | 1.1 s | 40 |
| `phase-shockwave` | ART-0285 | vfx.threadSnap | 18 | 24 | add | 0.75 s | 1 |
| `phase-ink-bleed` | ART-0285 | vfx.inkBleed | 48 | 24 | alpha | 2 s | 1 |
| `litany-star` | ART-0286 | vfx.litanyStar | 30 | 24 | add | 1.25 s | 1 |
| `litany-dust` | ART-0287 | vfx.frozenDust | procedural | 24 | add | 8 s | 40 |
| `litany-marginalia` | ART-0287 | vfx.marginalia | procedural | 24 | alpha | 8 s | 8 |
| `litany-leaf` | ART-0288 | vfx.starFracture + particles.goldLeaf | 12 | 12 | alpha | 1 s | 40 |
| `star-trail` | ART-0274 | vfx.inkTrail | procedural | 24 | add | 0.6 s | 1 |
| `gesture-fizzle` | ART-0289 | vfx.smudge | 18 | 24 | alpha | 0.75 s | 1 |
| `low-vitals-glass` | ART-0291 | vfx.crackedGlass | procedural | 24 | alpha | while active | 1 |
| `low-vitals-vessels` | ART-0291 | vfx.vesselCreep | procedural | 24 | alpha | while active | 1 |
| `combo-ribbon` | ART-0293 | vfx.comboRibbon (gilt-edged) | 12 | 12 | alpha | 1.8 s | 1 |

## Particle caps (ART-0373)

Live particles per family, enforced in `Particles.spawn` (`PARTICLE_CAPS` in
`src/render/particles.ts`): **blood 64, sparks 48, motes 32, leaf 40**. Gold flakes and sigil
embers are also capped at 40. A burst that would pass its cap spawns only up to it. Smoke, pus and
dust share the 3,000-particle pool.

## Triggers

| Effect | Fires on |
| --- | --- |
| Blood droplets | Any `fx` blood event (one of six droplet shapes per particle) |
| Splatter decal, Lancet spray | The `cut` event on the body, sprayed across the stroke direction (scaled by the gore level) |
| Leech-Pipe swirl | The Leech-Pipe held down on the body |
| Sparks, smoke puff, sear glow | The `burn` event (Brand on flesh). The glow cools orange → red → char over 2 s |
| Vein ripple, calm shimmer | The `inject` cue (Tincture) |
| Lens rim, ink wash | The Lens in hand. The sepia wash sits under hidden objects within the lens radius |
| Salve smear, glint | The Salve held on the body; the glint on a Salve rating |
| Thread glint, sealed flash | The `stitch` event; the flash on a Thread rating (a closed wound) |
| Flesh pull, clink | The Tongs seize something; the clink at the tray dish (or the drop point) on `extract` |
| Curse motes, spawn burst, kill pop | Malison and shard motes and spawns; the pop on a death while the Brand is in hand |
| Curse crackle | A laceration spawned while a boss lives (the Malison's attack) |
| Sigil embers | Each newly seared sigil cell, then a slow trickle from the seared strokes |
| Thread-snap ring, ink bleed | A phase change (a violet bleed when a boss is on the table) |
| Litany star, dust, marginalia, leaf | The `litany` event. The star burns along the traced path in 0.3 s, then grows with the POST_FS ripple front (`u_litanyAge × 0.9` of the view height) and fades by `exp(−2.4·age)`. Eight margin glyphs fade one per second of the 8 s. At the end the star breaks apart over 12 woodcut frames of falling leaf |
| Star trail, fizzle | While tracing, each stretch fades over 0.6 s to a 15 % residue; a star that fails to read smudges and fizzles |
| Cracked glass, vessel creep | Vitals ≤ 30, growing to full at 0; the vessels pulse with the heartbeat (`u_pulse`) |
| Combo ribbon | The combo reaches ×5 and ×10 |

## Other Demo effects (owned elsewhere)

| Effect | Owner | Sprite | Frames | fps | Blend | Lifetime | Max concurrent |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rating stamps COOL/GOOD/BAD/MISS (ART-0290) | `src/art/kit.ts` `ratingStamp` | UI_ART_FS stamp | 6 | 12 | alpha | 1.1 s | popup stack (UIX-0047) |
| Hurt ring (UIX-0050) | `src/scenes/operation.ts` | arc | procedural | 24 | alpha | 0.5 s | short-lived, unbounded |
| Litany sepia and ripple | `POST_FS` (`u_litany`, `u_litanyAge`) | post pass | procedural | — | grade | 8 s | 1 |
| Danger pulse and failing LUT | `POST_FS` (`u_danger`) | post pass | procedural | — | grade | while vitals < 35 | 1 |
| Hurt flash | `POST_FS` (`u_hurt`) | post pass | procedural | — | grade | 0.45 s | 1 (flash-limited) |
| Malison body, eye, dissolve | `CREATURE_FS` | shader mode 0/1 | procedural | — | alpha | while alive | 1 per Malison |
| Lauds light-thread (ART-0237) | `src/art/bossVfx.ts` `lightThread` | beam + pulses | procedural | 24 | add | while linked | 1 |
| Lauds dawn flare (ART-0238) | `src/art/bossVfx.ts` `dawnFlare` ([dawn-flare.md](dawn-flare.md)) | full-screen bloom | procedural | 24 | add | 2 s | 1 |
| Candle/torch flicker (ART-0154) | `SCENE_FS` | scene shader | 12-frame loop | 12 | add | loop | per scene |
| Smoke and dust overlay (ART-0155) | `SCENE_FS` | scene shader | procedural | — | add | loop | 1 |
