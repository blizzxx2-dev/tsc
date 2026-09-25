# IP-safety review of every name in `src/content` (prepares OPS-0052)

**Status: internal review, not legal advice. For counsel review and written sign-off before the
announce (handoff OPS-0052).** Prepared 2026-09-25 against commit state of `src/content/*.ts`,
`src/surgery/*.ts` (player-facing literals) and `src/i18n/strings/en.json`.

## Method
1. **Automated scan** — `node scripts/ops/ip-scan.mjs` (tested in `tests/ops.test.ts`) builds a
   234-term blocklist from the "Avoid" column of the IP table in
   `docs/research/warhammer-fantasy-tone.md` §7 (Games Workshop setting names, gods, factions, coined
   terms, diseases, places, orders, spell names) plus Atlus/SEGA *Trauma Center* terms (GUILT, Healing
   Touch, Caduceus, Delphi, the GUILT strain names, cast and hospital names), and matches them against
   every player-facing string (UI keys, story lines, operation titles/patients/diagnoses/callouts, barks)
   and every string literal in `src/content` and `src/surgery`.
   **Result: 0 blocklisted terms in player-facing text** except *Hollow Choir*, which the research doc
   itself lists as low-risk (#43) and which is allowed pending the trademark knock-out; 1 internal enum
   value (`race: 'orc'`) in `src/surgery/operation.ts`.
2. **Manual review** — every proper-name candidate the scan inventories (85 capitalised words/phrases
   not at sentence start), grouped below, checked against the research table, the *Trauma Center* cast
   and terminology (`docs/research/trauma-center.md`), and general knowledge of existing game/fiction
   names. Risk: **low** (generic word, real name, or public-domain term), **check** (a knock-out search
   or counsel look is advised), **change** (recommend renaming).

## Characters
| Name | Where | Assessment | Risk |
|---|---|---|---|
| Dr. (Doctor) Kreuzer | protagonist | Common German surname; no GW or Atlus character of that name. *Trauma Center* protagonist is Derek Stiles — no overlap in name or look (portrait likeness is OPS-0053) | low |
| Sister Ilse | assistant | Common German given name. Role parallels Angie Thompson (assistant) — a genre function, not protected; keep her order's iconography distinct from GW's Shallya (no dove, no bleeding heart) | low |
| Inquisitor Stroh | witch-hunter | Surname; "Inquisitor" is a real historical title (GW also uses it in 40K — generic word) | low |
| Master Haller | mentor | Surname; guild-master title is historical | low |
| Captain Mauer | watch captain | Surname | low |
| Jost, Pieter, Anno, Emmerich, Tomas, Henning, Jorg | patients | Common historical given names | low |
| Orsa Flintvein | dwarf patient | Original compound surname; "dwarf" is generic folklore. Avoid GW dwarf culture markers (grudges, runes, "Karak", Slayers) in her writing and art | low |
| "???" (the Choir) | cast id `choir` | Placeholder name | low |

## Places
| Name | Assessment | Risk |
|---|---|---|
| Kessendorf / the Free City of Kessendorf | Invented German-style toponym (compare real *Kesselsdorf*, Saxony). "Free city" is a real historical status. Not a GW city (Altdorf, Nuln, Middenheim, Marienburg…) | low |
| Weissburg | German-style toponym; real places are *Weißenburg* / *Weißenberg* — generic | low |
| Grauwald | "Grey forest"; not GW's Drakwald/Reikwald | low |
| Tanners' Rows, Timber Road, the Black Seam, barrow-fields | Descriptive English | low |
| Hospice of Saint Ildra (the Merciful) | Invented saint; replaces GW's Shallya/temple-hospital. Keep emblem distinct (research #7) | low |
| The Gilded Goose (tavern) | Inn-sign phrase; **also the name of a *Magic: The Gathering* card (Wizards of the Coast)**. Inn names are descriptive and the card is not a mark for taverns, but a two-word swap costs nothing | check — optional rename (e.g. "the Brass Goose") |

## Institutions, factions and religion
| Name | Assessment | Risk |
|---|---|---|
| The Ash Tribunal | Chosen specifically to avoid Paizo's "Order of the Pyre" (#42) | low |
| The Merciful Order | Generic descriptive; replaces GW "Order of the Bleeding Heart" (#7) | low |
| The Hollow Choir | Title overlap with a novel and an itch.io supplement (#43); titles are rarely protectable. **Needs the trademark knock-out search** in class 9/41 with the title search (OPS-0058); fallbacks listed in research (#43) | check |
| The Guild, the Watch, the Burgomaster | Historical institutions/titles | low |
| The Long Muster (era name) | Invented; no GW match | low |
| Saints (Saint Ildra, "Saints"), Martinmas | Invented saint; Martinmas is a real feast (public domain) | low |

## Bosses, hours and mechanics
| Name | Assessment | Risk |
|---|---|---|
| The Malison (living curse) | Archaic English word for "curse" (public domain). Functional parallel to Atlus's GUILT — the *concept* of a man-made pathogen boss is not protectable; the name, look and lore are original | low (concept parallel noted for the counsel trade-dress memo, OPS-0049) |
| Matins, Lauds, Prime, Terce, Sext, None, Vespers, Compline | Canonical hours — public-domain liturgical terms; replaces GW's Winds of Magic device (#29). *Trauma Center*'s GUILT strains are Greek weekday names (Kyriaki…Savato) — a structural echo (named series of seven/eight bosses); keep | low (note for OPS-0049) |
| The Litany of Stillness | Original name for the time-slow power. **Mechanic and input are close to *Trauma Center*'s Healing Touch, which is also activated by drawing a star** — see [trauma-center-comparison.md](trauma-center-comparison.md) | low name / **check** presentation |
| Hexstone, hexfire | Replaces GW *warpstone* (#14); `hexstone` confirmed as the id (D-0007). Common fantasy coinages; run a quick class-9/28 knock-out on "Hexstone" (it may exist as a product or card name) | check |
| Lancet, Tongs, Leech-Pipe, Gut Thread, Saint's Salve, Tincture, Cautery Brand, Scrying Lens | Generic period instrument names | low |
| COOL / GOOD / BAD / MISS, rank XS | Taken from *Trauma Center*'s rating vocabulary — see the comparison memo; decision D-0008 waits for counsel | **check** |

## Operation, chapter and scene titles
| Title | Assessment | Risk |
|---|---|---|
| A Tavern Knife, The Barbed Shaft, Powder Burns, Pestilent Humours, Gravehound, The Black Seam, Brood-Mother's Kiss, The Silenced Cantor | Descriptive phrases. "Gravehound" is a generic compound (also used for monsters in several games); not a GW unit name | low |
| The Hour of Matins, The Hour of Lauds (op and chapter titles) | Public-domain liturgical terms | low |
| Scene captions ("The Hospice — noon", etc.) | Descriptive | low |

## Creatures and ailments
| Name | Assessment | Risk |
|---|---|---|
| Beast-folk, horned raiders | Replaces GW *Beastmen* (#18); keep culture/terms original (no Gor/Ungor/Herdstone) | low |
| Hexlings, spiderlings, web-spinner, corpse-eaters, grubs, egg sacs, Brood-Mother | Generic | low |
| Buboes, rot, gangrene, humours, black bile, venom | Historical medicine | low |

## Internal identifiers (not player-facing)
| Identifier | Where | Assessment | Action |
|---|---|---|---|
| `race: 'human' \| 'dwarf' \| 'elf' \| 'halfling' \| 'orc'` | `OperationDef.race` in `src/surgery/operation.ts` (flesh tint only) | Generic fantasy words, but the research table recommends avoiding orcs/elves/halflings as peoples (#20, #23, #24). Only `human`/`dwarf` are used by content | Ask GAM/NAR to drop unused `elf`/`halfling`/`orc` values or rename them to original peoples before any appears in content |

## Recommendations for counsel
1. Sign off the name register as above; confirm or reject the two optional renames (Gilded Goose;
   Hollow Choir fallback) after the knock-out searches.
2. Treat the *Trauma Center* parallels (rating words, "XS", star-drawn time-slow, assistant callout
   framing, man-made pathogen bosses) in the trade-dress memo, not the name review.
3. Re-run `node scripts/ops/ip-scan.mjs` at Alpha and Release (Chapters III–V add names) and attach
   the output to the counsel sign-off letter (OPS-0073).
