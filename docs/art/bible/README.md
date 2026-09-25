# Suture & Steel — Art Bible

This covers Chapters I–II in full, with notes for III–V. It is the reference every screen, shader and
asset is judged against. The game's graphics are **procedural first**: flesh, backgrounds,
creatures and UI are drawn by shaders and code (`src/render/shaders/*`, `src/art/*`). Painted
assets from the pipeline (`docs/art/pipeline.md`) replace or layer over them where they beat the
procedural result. The rules below apply to both.

## 1. Pillars

1. **The surgeon's table is the stage.** The operating field is the brightest, most saturated thing
   on screen. Everything else (tray, HUD, backdrop) steps down in value and chroma so the flesh
   and the wound read first.
2. **Woodcut and oil, not comic book.** The lines are cut, not drawn: tapered, broken and
   hatched, like the German 16th-century surgical manuals. Colour is glazed and earthy, lit by
   tallow, with oxblood and verdigris as accents.
3. **Grim, not gratuitous.** Wounds are clinical and wet, never lingering on faces in pain (§8).
4. **Faith and dread share a palette.** Gilt means the Litany and holy work. Curse-violet means the
   Malison. Nothing else uses either (§5).
5. **Readable at a glance.** Each state has its own value, shape and colour (UIX-0147), and every
   interactable thing reads against flesh at 1280×720 on a Steam Deck.

## 2. Reference board (public domain)

| Pillar | Works |
| --- | --- |
| Surgical diagrams | Hans von Gersdorff, *Feldtbuch der Wundartzney* (1517): the Wound Man, amputation plates; Ambroise Paré, *Œuvres* (1575) instrument plates |
| Woodcut line | Albrecht Dürer, *Apocalypse* series (1498); Hans Holbein the Younger, *Dance of Death* (1538) |
| Crowd and town | Pieter Bruegel the Elder, *The Fight Between Carnival and Lent* (1559), *The Triumph of Death* (c. 1562) |
| Dread and the uncanny | Hieronymus Bosch, *The Garden of Earthly Delights* (right panel), *The Last Judgement* (Vienna) |
| Portraiture | Holbein, *The Ambassadors* (1533); Dürer, self-portraits; Lucas Cranach the Elder, court portraits |
| Light | Georges de La Tour, candle-lit interiors (*Magdalene with the Smoking Flame*), for the tallow key light |

Do / don't pairs:

- **Do** taper and break outlines where light hits. **Don't** use even-weight vector outlines.
- **Do** mix hatching into shadow values. **Don't** use airbrushed gradients alone in shadows.
- **Do** keep flesh warm, wet and translucent (the SSS term). **Don't** push flesh toward pink
  cartoon skin or grey plastic.
- **Do** light every scene from a warm source with cool fill. **Don't** light with neutral
  white.
- **Do** keep the UI in material metaphors (parchment, oak, brass, wax). **Don't** use flat UI
  panels, rounded rectangles or drop-shadow cards.

## 3. IP-avoidance checklist (every asset review ticks it)

The setting is original. Warhammer Fantasy is only a guide to tone. Before approval, confirm the
asset contains none of these:

- [ ] a twin-tailed comet, a double-headed or skull-headed eagle, a skull-and-wings emblem
- [ ] an eight-pointed star of any kind (the Litany star is **five**-pointed), or arrow-tipped
      eight-ray symbols
- [ ] rat-men, horned rats or a horned-rat sigil; bird-headed or daemonic "chaos" heralds
- [ ] a hammer-and-comet, a warrior-god with a twin-tailed comet, or a "Sigmarite" priest look
      (bald, hammer, scripture-chained)
- [ ] green-skinned orcs or goblins, pointed-eared elves, bearded "dwarf" miners in horned helms
      (our peoples are human, mountainfolk, hornfolk and giants, drawn from folk costume)
- [ ] names, heraldry or place names from any Games Workshop setting

Banned silhouettes also include the big-pauldron power-armour shape and the Nurgle-style bloated
plague god. Plague art is medical (buboes, sores), never a deity.

## 4. Master palette

`src/render/palette.ts` defines 32 named swatches (tallow, soot, oxblood, verdigris, bile, bone,
gilt, curse-violet…). `docs/art/palette.gpl` is an importable swatch file generated from it
(`node scripts/art/palette-export.mjs`). UI tokens (`src/ui/ornaments.ts` `UI`,
`src/ui/layout.ts` `PALETTE`) and the semantic theme (`src/ui/theme.ts`) take their colours
from swatches. `tests/unit/art/palette.test.ts` checks that every UI token is within ΔE 6 of a
swatch.

## 5. Reserved colours

- **Curse-violet** (`#b060ff` family, hue 255–295°, saturated) is reserved for the Malison, the
  Hollow Choir and curse effects (sigils, hexfire, curse motes). This is enforced by
  `tests/unit/art/curseViolet.test.ts`. A curse line outside the boss modules must carry a
  `curse-violet: <reason>` marker.
- **Gilt** (`#f5d76e` family) is reserved for the Litany, COOL ratings, rank seals and holy work.

## 6. Line and hatching language

The procedural shaders use three hatch densities:

| Density | Use | Shader parameter |
| --- | --- | --- |
| Light | half-tones on parchment, backdrop mid-ground | 1 stroke / 6 px, 0.12 opacity |
| Mid | form shadow on props, the flesh rim | 1 stroke / 4 px, 0.22 opacity |
| Shadow | core shadow, cast shadows, UI woodcut borders | cross-hatch, 1 / 3 px, 0.35 opacity |

Stroke weights at 1080p: 3 px for silhouettes, 2 px for interior form lines and 1 px for hatching.
Line-break rule: a contour breaks (a gap of 2–4 stroke widths) where it faces the key light, and
thickens by 50 % on the shadow side. The look-dev page `?scene=artview` shows the ornament kit, and
`?scene=fleshlab` shows the flesh under every grade.

## 7. Value structure

Reduced to five grey values, every story background keeps the character zone (the bust area,
x 180–480) at least two value steps from what surrounds it. The operating field sits in the top
two values and the HUD in the bottom two, so the field reads first. Backgrounds are lit darker
behind the speaker, and the scene shader's vignette and lighting variants are tuned so that this
holds at night, dusk and day.

## 8. Gore tone

Target rating: PEGI 16 / ESRB M.

- **Shown:** open tissue inside wounds, blood and pus pools, grubs and leeches, arrowheads and
  shot in the flesh, burns, the Malison's body.
- **Implied, never shown:** faces in agony (patients are seen only as the operating field; busts
  stay composed), children's wounds (a child patient is heard, not seen), dismemberment beyond the
  amputation line, torture.
- **Comfort options:** Reduced gore browns the blood and removes spurts. Minimal draws blood and
  wounds as ink-black shapes. The creature filter replaces crawling things with blots
  (`src/render/presentation.ts`).

## 9. Costume guide (text brief for the turnaround sheets)

| Faction | Silhouette and materials |
| --- | --- |
| Landsknecht pikemen | Puffed and slashed doublets in two clashing colours, codpiece, broad beret with ostrich feather, katzbalger at the hip |
| Merciful Order (Ilse) | Grey-blue wool habit, white linen wimple, leather apron with instrument loops, sun-in-palm pendant |
| Pyre inquisitors (Stroh) | Black gown with a white falling band, tall felt hat, iron chain of office, ash-grey gloves |
| City Watch | Halberd, brigandine over a padded jack, morion helmet, city-arms tabard (Kessendorf) |
| Guild surgeons (Haller, Kreuzer) | Long fur-trimmed physician's robe, coif, spectacles on a cord, rolled instrument case |
| The Hollow Choir | Undyed hooded cassocks, faceless cloth masks with a sewn mouth-slit, beeswax candles, no visible hands |

## 10. Material notes

| Material | Base / shadow / highlight | Lighting note |
| --- | --- | --- |
| Brass | `#b8903c` / `#5a3a14` / `#f0d890` | Sharp, warm specular; tarnish in crevices |
| Pewter | `#8a8a86` / `#3a3a38` / `#d8d8d0` | Soft, broad highlight |
| Tallow | `#e8d8a8` / `#8a7040` / `#fff4d0` | Translucent near the flame, sooty drip |
| Waxed linen | `#d8ccb0` / `#7a6a50` | Low sheen and a visible weave |
| Gut thread | `#c8a878` | Thin wet highlight |
| Leech skin | `#2a1a18` / `#0a0404` / `#8a6a60` | Wet, banded, with a small sharp specular |
| Vellum | `#e0cfa4` / `#9a8660` | Matte, foxing spots, rolled ends |
| Stained glass | Saturated primaries behind soot-black leading | Always emissive, with coloured light pooling on the floor |

## 11. Heraldry and signage (Kessendorf)

- **City arms:** per pale, argent and gules, a tower sable over a frozen river azure. The river
  froze twice in the ninth year of the Long Muster.
- **Hospice of Saint Ildra seal:** a sun-in-palm within a ring of lancets.
- **Guild marks:** Surgeons (crossed lancet and saw), Gunsmiths (a burst barrel), Tanners (a
  hide on a frame), Drovers (a yoke), Apothecaries (a still and alembic), Watch (a lantern on a
  halberd). All are simple woodcut glyphs, readable at 24 px.

## 12. Faith iconography

- **Saint Ildra the Merciful:** a sun rising from an open palm. In UI it is used as a small
  woodcut glyph on the hospice seal and the Litany reliquary.
- **The Merciful Order:** a dove carrying a lancet.
- **The Litany:** the five-pointed star, drawn in one stroke.
- UI glyph variants: 16, 24 and 32 px line versions and a filled wax-seal version.

## 13. Chapters III–V (bible v2 notes)

| Chapter | Region | Key light and palette | Factions |
| --- | --- | --- | --- |
| III | The Kiln Rows (glassworks and forges) | Furnace orange, soot, green glass | Glaziers' guild, the Pyre |
| IV | The Vennmark (marsh villages, salt mines) | Grey-green fog, lantern amber | Marsh folk, mountainfolk miners |
| V | Hollow Night (the Choir's abbey) | Moonlit blue with curse-violet accents | The Hollow Choir, the Office |

The remaining Hours (Prime, Terce, Sext, None, Vespers, Compline, the Office) each get one
signature shape. Prime is written names, Terce a flame-front, Sext a sun-dial, None a segmented
worm, Vespers candle wicks, Compline silence-nodes, and the Office the eight Hours at once. The
Hours share curse-violet as a secondary colour, and each has its own primary (Terce furnace red,
Sext bleached noon white, Vespers tallow gold).
