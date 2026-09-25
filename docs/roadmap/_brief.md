# Roadmap Brief (shared context for every workstream)

## The game
**Grim Apothecary** (working title) — a PC surgery-action game that reimagines Atlus's *Trauma Center* series in an
original grimdark early-modern fantasy world inspired by the *tone* of Warhammer Fantasy (dirt, plague, pike-and-shot,
witch hunters, black humour, Dürer/Bruegel/Bosch art). **No Games Workshop IP** — all names, factions, gods and places are original.

- The player is a **human apothecary-surgeon** (Doctor Kreuzer) at a charity hospice in a free city (Kessendorf).
- Patients arrive with the ailments of a grim world: **blade wounds, arrows/crossbow bolts/lead shot, burns (fire,
  acid, hexfire, dragon-breath), plague and disease (buboes, rot, gangrene), venom and poisons, curses and hostile
  spells (curse-sigils, hexstone shards, petrification…), monster attacks (bites with lodged fangs, claw rakes, larvae/grubs)**.
- The recurring boss threat (the *GUILT* analogue) is **the Malison**: a *living curse* woven by a heretic coven
  (**the Hollow Choir**). Each variant is named for a canonical hour — Matins, Lauds, Prime, Terce, Sext, None,
  Vespers, Compline — and fights back inside the patient with its own phases/gimmicks.
- The surgeon's *Healing Touch* analogue is **the Litany of Stillness**: draw a five-pointed star (right mouse) to slow
  time for ~8 s, once per operation. Narrative tension: witch hunters would call this gift witchcraft.
- Assistant (the "Angie" role): **Sister Ilse** of a mercy order. Witch-hunter ally/antagonist: **Inquisitor Stroh**.
- Controls: **mouse + keyboard** (stylus/Wiimote gestures translated to drag/hold/trace). Tools with hotkeys 1–8 and
  mouse wheel: Lancet (scalpel), Tongs (forceps), Leech-Pipe (drain), Gut Thread (suture), Saint's Salve (gel),
  Tincture (syringe/stabiliser), Cautery Brand (laser), Scrying Lens (ultrasound).
- Scoring: every action rated COOL / GOOD / BAD / MISS with combos; ranks XS / S / A / B / C; vitals meter 0–99 and a timer.
- Structure: chapters of visual-novel story scenes + operations, a challenge mode, later other "disciplines"
  (field triage, diagnosis, forensic/inquisition, bone-setting) like *Trauma Team*.

## Tech (already chosen and partly built)
- TypeScript 5.9, Vite 6, Vitest 3. **Rendering is WebGL2** via a custom batched 2D renderer (`src/render/gfx.ts`):
  shapes/lines/arcs/gradients/glows batched into one VBO, glyph-atlas text (bundled OFL fonts IM Fell English +
  UnifrakturMaguntia), a procedural **flesh shader** (fbm/voronoi, veins, wet specular, curse corruption), and a
  **post-process chain** (bloom, candlelit grade, vignette, grain, Litany ripple/sepia, low-vitals red pulse, shake).
- Simulation is DOM-free and deterministic (seeded RNG) so operations are unit-testable headlessly.
- Audio: procedural WebAudio cues for now (to be replaced/augmented with recorded SFX/music).
- PC shipping plan: wrap the web build in **Electron** (or Tauri) for Windows/macOS/Linux; Steam via Steamworks (greenworks/steamworks.js).

## Already implemented (mark these tasks `[x]` if you list them)
Vite/TS/Vitest scaffold; math/RNG; input (mouse/keys/wheel); procedural audio cues; Operation simulation (vitals,
timer, phases, scoring/combos/ranks, Litany, tincture, callouts, popups, shake); entities: Incision, StitchLine,
BloodPool (blood/pus/black bile), Laceration, Embedded (arrow/bolt/shot/tooth/shard/glass/hexstone, barbed arrows),
Burn (fire/acid/hexfire), Bubo, Rot, Venom, Grub, Sigil (curse), Malison (Matins) + MalisonShard; star-gesture
recogniser with tests; WebGL2 renderer/shaders/text atlas. In progress: scenes (title, story VN, briefing,
operation HUD, results), first chapter content.

## Milestones
- **M0 Prototype** — vertical slice: engine + ~5 operations + first Malison.
- **Alpha** — every core system feature-complete; whole campaign playable end-to-end with placeholder art/audio.
- **Beta** — content complete; final art/audio/VO integrated; balancing; localisation; platform integration; broad testing.
- **Release (1.0)** — polish, performance, certification/store compliance, launch.
- **Post-launch** — patches, DLC/free updates, community features.

## Task format (strict — the files are merged and counted by script)
One task per line, as a markdown checkbox:

```
- [ ] ENG-0001 · Alpha · P1 · M · Task title — concrete acceptance criterion / detail
```

- ID: the workstream prefix given to you + zero-padded 4-digit sequence, unique within your file.
- Phase: `M0`, `Alpha`, `Beta`, `Release`, or `Post`.
- Priority: `P0` (blocker) … `P3` (nice to have).
- Size: `S` (≤ ½ day), `M` (1–3 days), `L` (≤ 2 weeks). Split anything bigger than L.
- Group tasks under `##` epic headings and `###` feature headings. Epics should run roughly in phase order.
- Tasks must be **specific, actionable, and verifiable** — no filler, no duplicates, no vague "improve X".
  Good: "Barbed-arrow extraction: tearing out an un-nicked barb spawns a 1.6× bleed laceration and a BAD rating (unit test)".
  Bad: "Make arrows better".
- Write the file incrementally (append section by section with bash heredocs) — it will be long.
