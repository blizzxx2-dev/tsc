# 04 — Gameplay Systems & Bosses · Suture & Steel: The Malison Hours

Workstreams: **`GAM`** Core surgery systems (tools, ailments, scoring, vitals, Litany, difficulty, balance, tutorials, challenge mode, progression, mechanical accessibility) · **`BOS`** The Malison Hours and elite ailments.

Baseline this roadmap builds on (M0 prototype):
- `src/surgery/operation.ts` — deterministic `Operation` sim: vitals 0–99 (`MAX_VITALS`), timer, phases, `rate()` COOL 100 / GOOD 60 / BAD 15 / MISS 0 with combo multiplier `1 + min(combo,20)·0.05`, end bonuses (vitals + time), ranks XS/S/A/B/C from per-op thresholds, Litany (8 s at 0.15× time scale, once per op), Tincture (0.7 s hold, +25, 6 s cooldown).
- `src/surgery/entities.ts` — Incision, StitchLine, BloodPool (blood/pus/black bile), Laceration, Embedded (arrow/bolt/shot/tooth/shard/glass/`warpshard`), Burn (fire/acid/hexfire), Bubo, Rot, Venom, Grub, Sigil; `SALVE_MAX = 46`.
- `src/surgery/malison.ts` — Matins: 4 s veiled / 2.5 s open shroud rhythm, drifts, rends lacerations while veiled, spawns MalisonShards. `src/surgery/lauds.ts` — Lauds: 4 orbiting ChoirVoices shield the heart, 5 s exposure window before rekindle, Hymn ring spawns lacerations, submerge phase leaves Rot, EggSac + SpiderlingGrub adds.
- `src/surgery/gesture.ts` — star recogniser (resample + tests). `tests/bot.ts` — scripted bot surgeon (`playWithBot(def, {think})`); `tests/balance.test.ts` — steady bot (think 1.0) must win in < 75 % of time at rank B–S, novice bot (think 1.5) must win; `CALIBRATE=1` prints rank thresholds.
- Content: Ch1 `op1-1` A Tavern Knife · `op1-2` The Barbed Shaft · `op1-3` Powder Burns · `op1-4` Pestilent Humours · `op1-5` The Hour of Matins; Ch2 `op2-1` Gravehound · `op2-2` The Green Seam · `op2-3` Brood-Mother's Kiss · `op2-4` The Silenced Cantor · `op2-5` The Hour of Lauds.

Known issues carried in: (1) **slow-play farming** — boss adds (lacerations from rend/Hymn, shards, spiderlings) are rated per-action with no cap, so stalling a boss inflates score past a fast clear; (2) the entity id `warpshard` echoes GW's "warpstone" and must be renamed `hexstone` in code/saves; (3) rank thresholds are calibrated off the bot only.

Phase tags: `M0` shipped prototype · `Demo` required for the release-quality Chapters 1–2 Steam demo · `Alpha`/`Beta`/`Release` Chapters 3–5 and full game · `Post` after launch.

---

## GAM-A · Core systems shipped in the prototype (M0)

### Simulation & scoring baseline
- [x] GAM-0001 · M0 · P0 · M · Deterministic Operation sim — vitals, timer, phases, win/lose, seeded RNG; headless unit tests pass
- [x] GAM-0002 · M0 · P0 · S · Rating & combo rules — COOL/GOOD/BAD/MISS points with capped ×2.0 combo multiplier, combo reset on BAD/MISS
- [x] GAM-0003 · M0 · P0 · S · Rank computation — XS/S/A/B/C from per-op `ranks` thresholds plus vitals/time end bonuses
- [x] GAM-0004 · M0 · P0 · S · Litany of Stillness — star gesture on right mouse, 8 s at 0.15× time scale, once per op
- [x] GAM-0005 · M0 · P0 · S · Tincture — 0.7 s hold, +25 vitals, 6 s cooldown
- [x] GAM-0006 · M0 · P1 · M · Ailment entities — Incision, StitchLine, BloodPool, Laceration, Embedded (7 kinds), Burn (3 kinds), Bubo, Rot, Venom, Grub, Sigil
- [x] GAM-0007 · M0 · P1 · S · Star-gesture recogniser with unit tests — (`gesture.ts`)
- [x] GAM-0008 · M0 · P0 · M · Bot surgeon harness + demo balance test — (steady & novice paces) for all Ch1–2 ops

## GAM-B · Simulation hygiene & data model (Demo)

### Refactors that unblock tuning
- [x] GAM-0009 · Demo · P0 · S · Rename `EmbeddedKind 'warpshard'` → `'hexstone'` in sim, bot, content and save data — grep for `warpshard` returns 0 hits; old saves migrate
- [x] GAM-0010 · Demo · P0 · M · Extract every tuning constant (drain rates, hold times, radii, spawn timers) from entity classes into `src/surgery/tuning.ts` keyed by ailment — no numeric literals left in `update()` bodies except 0/1
- [x] GAM-0011 · Demo · P1 · M · Per-op tuning overrides — `OperationDef.tuning?: Partial<Tuning>` merges over defaults; unit test proves an override changes Laceration drain in only that op
- [ ] GAM-0012 · Demo · P0 · S · Split sim from draw — entities expose state only; drawing moves to `src/render/surgery/*` so the sim imports nothing from `render/` (lint rule enforces)
- [x] GAM-0013 · Demo · P0 · S · Per-operation entity id counter — (not module-level) so replays of the same seed produce identical ids (test)
- [x] GAM-0014 · Demo · P0 · M · Fixed-step sim (1/120 s) decoupled from render frame rate — same seed + input log gives identical score at 30/60/144 fps (test)
- [x] GAM-0015 · Demo · P1 · M · Input recording & replay — record pointer frames per op to JSON; `replay(def, log)` reproduces final score/rank exactly (test on all 10 demo ops)
- [x] GAM-0016 · Demo · P1 · S · Event bus for sim → presentation (`op.events` — rated, spawned, phaseStart, vitalsWarn, litany…) replacing `op.cues` string array
- [x] GAM-0017 · Demo · P1 · S · Operation telemetry summary — per op: time per phase, ratings histogram, vitals minimum, tools used, Litany timing; written to results scene and debug log
- [x] GAM-0018 · Demo · P2 · S · Debug overlay (F3) — entity hitboxes, drain per entity, vitals delta/s, active timers, combo state
- [x] GAM-0019 · Demo · P2 · S · Debug cheats (dev builds only) — skip phase, set vitals, freeze drain, spawn any entity at cursor
- [x] GAM-0020 · Alpha · P1 · M · Data-driven ailment schema — ailments declared in content files (`{kind, pos, params}`) validated by a zod-style schema at load; bad content fails CI

## GAM-C · Tool feel & tuning (Demo)

### Lancet
- [x] GAM-0021 · Demo · P0 · M · Incision rating from path error — mean deviation ≤ 6 px COOL, ≤ 14 px GOOD, else BAD; overshooting the endpoint by > 20 px nicks flesh (small laceration) — unit tests per band
- [x] GAM-0022 · Demo · P1 · S · Lancet speed window — strokes faster than 1400 px/s rate BAD ("rushed"), slower than 60 px/s rate GOOD max; tuned via bot traces
- [x] GAM-0023 · Demo · P1 · S · Dotted guide line fades in 0.3 s and shows start/end nubs — hidden on Hard/Master (see difficulty)
- [x] GAM-0024 · Demo · P1 · S · Encircle-excise gesture — closed loop around a growth (gap ≤ 18 px) excises; loop cutting into healthy tissue > 25 % of its length rates BAD
- [x] GAM-0025 · Demo · P1 · S · Cutting across an existing stitched line reopens it (test) — prevents accidental score farming via re-stitching
- [x] GAM-0026 · Demo · P2 · S · Lancet haptic/visual feedback — blade trail, wet parting shader on flesh, 40 ms micro-shake on BAD

### Tongs
- [x] GAM-0027 · Demo · P0 · S · Grab tolerance radius 22 px (+6 px Assist mode) — grabbing empty flesh is a MISS only if held > 0.25 s (prevents mis-click penalties)
- [x] GAM-0028 · Demo · P0 · M · Extraction angle rule — pulling within ±25° of the embed axis is COOL, ±50° GOOD, otherwise tears (laceration spawn + BAD); unit test for arrow/bolt/tooth
- [x] GAM-0029 · Demo · P1 · S · Drop-off zone — objects must be dragged off the body silhouette (tray at screen edge) to count; release on body re-embeds shallowly
- [x] GAM-0030 · Demo · P1 · S · Held-object drag inertia (lag 60 ms) so heavy items (bolts, lead shot) feel weighty — light items (glass) have none
- [x] GAM-0031 · Demo · P2 · S · Tongs clack SFX pitch by object weight — grip closes visually on grab

### Leech-Pipe
- [x] GAM-0032 · Demo · P0 · S · Drain rate 1 pool-unit per 0.9 s at centre, falloff to 40 % at rim — pools < 10 % auto-clear as GOOD
- [x] GAM-0033 · Demo · P1 · S · Pool rating by speed — cleared within 1.5 s of first contact COOL, 3 s GOOD
- [x] GAM-0034 · Demo · P1 · S · Blood refill rule — pools over an open laceration refill at the laceration's bleed rate; teaches stitch-first (tutorial callout on third refill)
- [x] GAM-0035 · Demo · P2 · S · Leech-Pipe audio/visual feedback — gurgle loop volume and suction particle count scale linearly with current drain rate

### Gut Thread
- [x] GAM-0036 · Demo · P0 · M · Zig-zag stitch detection — each crossing of the wound axis counts one stitch; stitch spacing 10–28 px COOL, 6–40 px GOOD; sparse lines leave "gaps" that keep bleeding at 30 % (test)
- [x] GAM-0037 · Demo · P1 · S · Minimum stitches per wound = ceil(length/22) — fewer never closes the wound
- [x] GAM-0038 · Demo · P1 · S · Final incision closure — long closing suture rated as one action with bonus 200 on COOL; stitched line persists visually to results
- [x] GAM-0039 · Demo · P2 · S · Thread tension visual — (taut line from last stitch to cursor) and knot tie flourish on completion

### Saint's Salve
- [x] GAM-0040 · Demo · P0 · S · Salve capacity `SALVE_MAX = 46` covers one medium rot; refill is automatic after 3 s idle — document and expose in HUD as a meter
- [x] GAM-0041 · Demo · P1 · S · Coverage-based rating using `coverage.ts` grid: ≥ 95 % in one stroke COOL, ≥ 80 % GOOD — unsalved remainder regrows at 20 %/s
- [x] GAM-0042 · Demo · P1 · S · Salve on large wounds — Salve over open lacerations > 20 px does nothing and shows "Stitch it first" callout once per op
- [x] GAM-0043 · Demo · P2 · S · Salve gloss persists 4 s after application — (shader wetness param)

### Tincture
- [x] GAM-0044 · Demo · P0 · S · Tincture rating — injected while vitals < 40 COOL (needed), 40–70 GOOD, > 85 BAD ("wasteful") to stop spam
- [x] GAM-0045 · Demo · P1 · S · Injection site must be on body and ≥ 30 px from any open wound — else MISS
- [x] GAM-0046 · Alpha · P1 · M · Tincture variants — red (vitals), green (antivenom), blue (stimulant vs Sext torpor), amber (anti-fever); selected by pressing 6 repeatedly; colour-coded vial HUD
- [x] GAM-0047 · Alpha · P2 · S · Tincture overdose — > 3 doses in 20 s causes 5 s tremor (cursor jitter 4 px); telegraphed by vial going dark

### Cautery Brand
- [x] GAM-0048 · Demo · P0 · S · Brand hold times — grub 0.8 s, sigil node 1.0 s, Malison flesh continuous DPS 18/s; values from tuning table
- [x] GAM-0049 · Demo · P1 · S · Branding healthy flesh > 0.5 s creates a Burn(fire) and BAD — prevents holding brand everywhere
- [x] GAM-0050 · Demo · P1 · S · Brand overheat meter — 6 s continuous use locks it for 2 s; shown as glowing tip colour
- [x] GAM-0051 · Demo · P2 · S · Sizzle SFX and smoke particles scale with target type — brand smoke obscures field briefly (cosmetic only)

### Scrying Lens
- [x] GAM-0052 · Demo · P0 · S · Lens reveal radius 90 px — hidden entities become "found" after 0.4 s hover and stay visible (test)
- [x] GAM-0053 · Demo · P1 · S · Hidden-entity drain continues while unfound so skipping the Lens is punished — op briefings hint when the Lens is needed
- [x] GAM-0054 · Demo · P2 · S · Lens shader — desaturated x-ray view with vein map inside circle, subtle hum loop

### Tool switching
- [x] GAM-0055 · Demo · P0 · S · Tool switch latency: hotkeys 1–8 immediate, mouse wheel 80 ms step debounce — switching mid-drag cancels the drag without rating
- [x] GAM-0056 · Demo · P1 · M · Radial tool wheel (hold Q or middle mouse) with 8 slots, 0.35× time while open (not stacking with Litany) — also used for controller
- [x] GAM-0057 · Demo · P1 · S · Context auto-suggest (Assist only) — tool icon pulses when cursor hovers an entity that needs it
- [x] GAM-0058 · Demo · P2 · S · Wrong-tool feedback — using a tool on an entity it cannot affect shows a one-shot hint (e.g. "Tongs won't sear a grub") without rating MISS

## GAM-D · Existing ailments to release quality (Demo)

### Incision & StitchLine
- [x] GAM-0059 · Demo · P1 · S · Incision depth layers (skin → fascia) for ops that require a second cut — second guide appears only after first layer is opened
- [x] GAM-0060 · Demo · P2 · S · Incision bleeds at 0.2 vitals/s while open with no work inside — gentle pressure to proceed

### Laceration
- [x] GAM-0061 · Demo · P0 · S · Laceration bleed scales with length (0.01 vitals/s per px) and spawns a BloodPool every 4 s until stitched — unit test on 40/70 px cuts
- [x] GAM-0062 · Demo · P1 · S · Small lacerations (< 25 px) are Salve-closable — larger require Thread (content validator warns on mismatched briefings)
- [x] GAM-0063 · Demo · P2 · S · Laceration edge shader — jagged vs clean variants for claw vs blade sources

### Embedded objects
- [x] GAM-0064 · Demo · P0 · M · Barbed-arrow extraction: tearing out an un-nicked barb spawns a 1.6× bleed laceration and a BAD rating — nicking the barb channel with Lancet first allows a clean pull (unit test)
- [x] GAM-0065 · Demo · P1 · S · Crossbow bolt — requires two-stage pull (drag 40 %, pause 0.3 s, finish) or it snaps, leaving a hidden fragment that needs the Lens
- [x] GAM-0066 · Demo · P1 · S · Lead shot — Lens reveals 1–3 cloth wadding fragments; any left in when closing triggers a "wound-fever" mini-phase (+Venom-like drain 0.4/s for 20 s)
- [x] GAM-0067 · Demo · P1 · S · Glass shard — slicing damage on drag: moving faster than 500 px/s while held spawns a nick; teaches slow extraction
- [x] GAM-0068 · Demo · P1 · S · Tooth (gravehound fang) — lodged at an angle, pull axis indicated only by the Lens outline
- [x] GAM-0069 · Demo · P1 · M · Hexstone — writhes (±8 px jitter) until branded 0.5 s; touching it bare with tongs > 2 s drains 2 vitals ("whisper"); must be dropped in the lead dish tray, not the normal tray
- [x] GAM-0070 · Demo · P2 · S · Generic shard — fallback kind for debris; confirm drop tray SFX and removal popups for all 7 kinds

### Burns
- [x] GAM-0071 · Demo · P0 · S · Fire burn — Salve heals; dead-tissue char must be excised with Lancet first on grade-3 burns (black centre) — test
- [x] GAM-0072 · Demo · P1 · S · Acid burn — spreads outward 6 px/s until Leech-Pipe neutralises the pool, then Salve; salving before draining rates BAD
- [x] GAM-0073 · Demo · P1 · S · Hexfire burn — re-ignites 3 s after salving unless its ember sigil is branded out; tell = green flicker 0.8 s before re-ignite
- [x] GAM-0074 · Demo · P2 · S · Burn grades visual — (pink/blistered/charred) consistent between briefing art and field

### Bubo
- [x] GAM-0075 · Demo · P0 · S · Bubo lancing — single short incision across the crown; cut longer than bubo diameter rates BAD and spawns pus overflow
- [x] GAM-0076 · Demo · P1 · S · Unlanced buboes swell over 30 s and burst on their own (pus pools + Rot spawn) — timer visible via swelling scale
- [x] GAM-0077 · Demo · P1 · S · Pus contaminating an open laceration converts it to Rot after 5 s (tell: yellow creep) — teaches drain order

### Rot
- [x] GAM-0078 · Demo · P0 · S · Rot spreads 2 px/s radius to max 60 px — Salve coverage ≥ 95 % removes; partial coverage leaves islands that regrow (coverage test)
- [x] GAM-0079 · Demo · P2 · S · Rot animation — bubbling speed tied to remaining coverage percentage, stops at 0 %

### Venom
- [x] GAM-0080 · Demo · P0 · S · Venom mote travel along drawn veins toward heart glyph — reaching it = −10 vitals; branding or leeching a mote removes it
- [x] GAM-0081 · Demo · P1 · S · Vein ligature — Gut Thread across a vein stops motes beyond that point (unit test)
- [x] GAM-0082 · Demo · P2 · S · Venom colour-coding — (green/violet) groundwork for antidote matching in Alpha

### Grub
- [x] GAM-0083 · Demo · P0 · S · Grub behaviour — crawls toward nearest open wound, burrows after 6 s leaving a hidden grub (Lens); brand 0.8 s or tongs-drag off body
- [x] GAM-0084 · Demo · P1 · S · Grub split — branding under 0.4 s then releasing splits it into two small grubs (BAD); tell: grub puffs up
- [x] GAM-0085 · Demo · P2 · S · Grub feedback — 3 squeal SFX variants (random by seeded RNG) and 0.4 s death-curl animation on brand kill

### Curse-sigil
- [x] GAM-0086 · Demo · P0 · M · Sigil tracing — trace the glyph's strokes in order (numbered faint dots on Normal); wrong order snaps a stroke and spawns a laceration whip
- [x] GAM-0087 · Demo · P1 · S · Sigil glyph set — 6 original glyphs in `SIGILS` with stroke data validated (each stroke ≥ 2 points, no self-duplicates) by unit test
- [x] GAM-0088 · Demo · P1 · S · Partially traced sigils regress one stroke every 4 s — prevents pause-and-return cheese

## GAM-E · New ailment types (Alpha, Chapters 3–5)

### Fractures & bone-setting puzzle
- [x] GAM-0089 · Alpha · P0 · L · Fracture entity — bone split into 2–5 fragments with rotation/translation offsets; Tongs drag + mouse-wheel rotates the held fragment
- [x] GAM-0090 · Alpha · P0 · M · Fit rule: fragment within 4 px and 3° of target snaps with COOL, 8 px/6° GOOD — misalignment at pin time rates BAD and reduces end bonus
- [x] GAM-0091 · Alpha · P1 · M · Bone pin/plate step — after alignment, tap 2 pin points with the Lancet-turned-awl (Tincture slot swap) in order
- [x] GAM-0092 · Alpha · P1 · S · Bone splinter entity — small hidden fragments near fractures revealed by Lens; each left in causes a 0.2/s drain post-closure phase
- [x] GAM-0093 · Alpha · P1 · S · Compound fracture — bone through skin must be reduced before lacerations can be stitched (stitch blocked with hint)
- [x] GAM-0094 · Alpha · P2 · S · Bone-dust debris pools removed by Leech-Pipe — rendered pale not red
- [x] GAM-0095 · Alpha · P1 · S · Fracture unit test — bot solver aligns all fragments of 3 procedural fractures in < 25 s

### Petrification chipping
- [x] GAM-0096 · Alpha · P0 · M · Stone-plate entity — plates with visible crack lines; Lancet taps on crack nodes in shown order chip the plate; off-node taps rate BAD and spread stone 10 px
- [x] GAM-0097 · Alpha · P1 · S · Stone front advances 3 px/s toward a vital organ glyph — reaching it = immediate −30 vitals; Litany freezes advance entirely
- [x] GAM-0098 · Alpha · P1 · S · Living margin — tissue under removed plates must be salved within 5 s or it re-stones (unit test)
- [x] GAM-0099 · Alpha · P2 · S · Stone-front reveal — Lens shows the true stone front under skin as a grey tide line ahead of visible plates

### Frost-curse thawing
- [x] GAM-0100 · Alpha · P0 · M · Frost patch — Brand in low-heat mode (tap rather than hold) thaws; holding > 0.4 s scalds (Burn). Thaw progress ring per patch
- [x] GAM-0101 · Alpha · P1 · S · Frozen tissue rejects Lancet/Thread — (tools skid, no rating) until thawed
- [x] GAM-0102 · Alpha · P1 · S · Ice crystals in vessels: Leech-Pipe draws them out only after thaw — frozen vessel blocks blood flow causing slow drain 0.3/s
- [x] GAM-0103 · Alpha · P2 · S · Frost presentation — breath-fog overlay and cold-blue grade intensity tied to remaining frost area %

### Tumours & growths
- [x] GAM-0104 · Alpha · P0 · M · Growth entity — pulsing tumour; encircle-excise with Lancet, then Tongs lift; lifting before full loop rips it (BAD + blood)
- [x] GAM-0105 · Alpha · P1 · S · Growth with feeder vessels — 2–4 vessels must be ligated with Thread before excision or massive bleed (−15)
- [x] GAM-0106 · Alpha · P1 · S · Mutation buds (hexstone op) — buds root after 8 s visible timer; unrooted buds excise with one loop, rooted require loop + brand
- [x] GAM-0107 · Alpha · P2 · S · Growth variants art — tooth-bud, finger-bud, eye-bud (eye tracks cursor)

### Glass & splinters
- [x] GAM-0108 · Alpha · P1 · S · Glass cluster — 6–12 tiny shards visible only under Lens with sparkle; batch pickup by dragging Tongs across (max 3 per grab)
- [x] GAM-0109 · Alpha · P2 · S · Wooden splinter variant — breaks if pulled against the grain (grain lines shown), leaving a second splinter

### Ulcers
- [x] GAM-0110 · Alpha · P1 · M · Ulcer — crater that weeps acid bile; Leech-Pipe then Salve in concentric ring order (outer first); inner-first rates BAD and ulcer perforates (new laceration)
- [x] GAM-0111 · Alpha · P2 · S · Perforation spill — perforated ulcer contaminates adjacent organ with Rot after 6 s unless drained

### Troll-regeneration wounds
- [x] GAM-0112 · Alpha · P0 · M · Regenerating wound — closes over embedded shrapnel in 4 s after opening; brand the rim (trace full circle) to stop regrowth before extraction
- [x] GAM-0113 · Alpha · P1 · S · Overgrowth — if closed over an object, the object is hidden and a lump forms; re-incise and repeat
- [x] GAM-0114 · Alpha · P1 · S · Acid spray on gut opening disables one random tool for 10 s — (greyed hotbar slot, shown in HUD)
- [x] GAM-0115 · Alpha · P2 · S · Regrowth rate scaled by patient vitals (healthier = faster) — a deliberate inversion; tooltip in briefing

### Vampire bite & blood-drain
- [x] GAM-0116 · Alpha · P0 · M · Bite channel — two puncture wounds linked by a thrall-thread; lodged tooth fragments (Lens); vitals ceiling reduced to 70 until channel is cauterised
- [x] GAM-0117 · Alpha · P1 · S · Blood-drain meter — separate "blood volume" bar that drains; Tincture restores vitals but not volume, transfusion step (Leech-Pipe reversed on a donor bowl) restores volume
- [x] GAM-0118 · Alpha · P1 · S · Thrall choice hook — leaving the channel open ends op with flag `thrallKept`; scoring unaffected, story branch recorded
- [x] GAM-0119 · Alpha · P2 · S · Anaemic flesh shader — (pale, reduced wet specular) tied to blood volume

### Alchemical acid & poisons
- [x] GAM-0120 · Alpha · P1 · M · Alchemical acid pool — corrodes any tool that touches it for > 1 s (tool disabled 6 s); neutralise first with Tincture(amber) dropped into pool
- [x] GAM-0121 · Alpha · P1 · M · Antidote matching — venom motes coloured 3 ways; correct Tincture colour tap on mote = COOL, wrong = BAD + mote speeds up 30 %
- [x] GAM-0122 · Alpha · P2 · S · Gas-pocket poison — Lancet into pocket releases haze that blurs field 4 s unless Leech-Pipe held on it first

### Gangrene & amputation
- [x] GAM-0123 · Alpha · P0 · L · Gangrene spread — black tissue creeps up limb 2 px/s; Lens shows demarcation line; debride with Lancet + Salve if caught below the line
- [x] GAM-0124 · Alpha · P0 · M · Amputation op flow — saw gesture (back-and-forth Lancet drag, 8 strokes at rhythm), then seal choice: Brand (fast, −15 vitals) vs Thread ligatures (slower, +score)
- [x] GAM-0125 · Alpha · P1 · S · Ligature vs cautery scoring — ligature path yields +400 bonus but requires tying 3 vessels within 20 s
- [ ] GAM-0126 · Alpha · P2 · S · Tone guard — amputation presented through surgical drape framing; no gore beyond chart content-rating guidelines (checked with ESRB/PEGI notes)

### Parasites & worms
- [x] GAM-0127 · Alpha · P1 · M · Gut worm — pull head out whole with steady Tongs drag < 300 px/s; tearing leaves the body which regrows a head in 6 s
- [x] GAM-0128 · Alpha · P1 · S · Ticks — crawl out of wounds and burrow after 4 s if not plucked; burrowed tick = hidden drain 0.1/s
- [x] GAM-0129 · Alpha · P2 · S · Antiparasitic finish — Tincture(green) at end clears unseen larvae; skipping it applies −10 % end bonus

### Infection lines & spores
- [x] GAM-0130 · Alpha · P1 · M · Infection line — dark vein climbs along a branching path; Leech + Tincture at each branch node; reaching armpit node forces amputation branch
- [x] GAM-0131 · Alpha · P1 · S · Spore crust — dragging Lancet across it scatters spores that seed new crust within 60 px; excise via encircle only
- [x] GAM-0132 · Alpha · P2 · S · Dung contamination zone — drains 0.2/s until irrigated with Leech-Pipe in reverse (right-click toggle)

### Organ-specific hazards
- [x] GAM-0133 · Alpha · P1 · M · Organ layout system — `OrganKind` regions (heart/lung/gut/liver/brain/bone) with per-organ sensitivity multiplier on BAD penalties (heart ×2)
- [x] GAM-0134 · Alpha · P1 · S · Heart rhythm hazard — during arrhythmia, incisions near the heart only succeed between beats (ECG-synced 0.4 s windows)
- [x] GAM-0135 · Alpha · P1 · S · Lung collapse — Leech-Pipe air pocket then Thread seal; while collapsed vitals max drops to 60
- [x] GAM-0136 · Alpha · P2 · M · Brain/trepanation — circular drill gesture (3 steady circles), lift bone disc with Tongs, too-fast circles rate BAD and nick dura
- [x] GAM-0137 · Alpha · P2 · S · Larynx folds (Choir-Throat) — excise only in silence gaps between hummed verses (audio + waveform HUD cue for deaf players)
- [x] GAM-0138 · Alpha · P2 · M · Swallowed-object retrieval — stomach lock minigame: rotate 3 tumblers with Tongs + wheel inside stomach while acid timer runs
- [x] GAM-0139 · Beta · P2 · S · Wax-blood clots (Blood of Tallow) — Brand low-heat to soften then Leech; unsoftened clots clog pipe for 2 s

## GAM-F · Scoring, combos & ranks

### Rating rules
- [x] GAM-0140 · Demo · P0 · M · Scoring spec doc-in-code — `scoring.ts` with one exported table of every rateable action and its COOL/GOOD/BAD criteria; results screen and tests read from it
- [x] GAM-0141 · Demo · P0 · S · MISS policy — only tool-on-nothing actions > 0.25 s or wrong-organ actions rate MISS; plain clicks on empty flesh never do (test)
- [x] GAM-0142 · Demo · P1 · S · Combo timeout — combo resets if no rated action for 6 s (prevents idling on a combo); Litany pauses the timeout
- [x] GAM-0143 · Demo · P1 · S · Combo milestones — at ×10 and ×20 play chime + "Steady hands!" callout; no score change beyond multiplier
- [x] GAM-0144 · Demo · P1 · S · Popup text consistency — COOL/GOOD/BAD/MISS + combo "×N" placement never overlaps HUD (layout test at 1280×720 and 3840×2160)

### Slow-play farming fix (known issue)
- [x] GAM-0145 · Demo · P0 · S · Reproduce farming — bot variant `farm` stalls Matins/Lauds kill for 120 s; test asserts farm score > fast score (current failing behaviour captured)
- [x] GAM-0146 · Demo · P0 · M · Boss-spawned entities (rend lacerations, Hymn lacerations, MalisonShards, spiderlings, rekindled Voices) tagged `spawnedByBoss` — their ratings award 25 % points and do not extend combo beyond ×5
- [x] GAM-0147 · Demo · P0 · S · Per-op add-score cap — sum of add-rating points capped at 15 % of the op's S threshold; overflow shown as "—" popups
- [x] GAM-0148 · Demo · P0 · S · Time bonus reweight — time bonus = 8 pts per remaining second on boss ops (was flat); fast clears must out-score farming
- [x] GAM-0149 · Demo · P0 · S · Regression test — `farm` bot score ≤ `steady` bot score − 5 % on op1-5 and op2-5; also for every future boss op
- [x] GAM-0150 · Demo · P1 · S · Audit non-boss respawners (Bubo overflow, Grub split, rot regrowth) for the same loophole — cap self-inflicted-entity points to 0

### Ranks
- [x] GAM-0151 · Demo · P0 · S · Rank thresholds recalibrated after farming fix via `CALIBRATE=1` — committed per op with calibration date comment
- [x] GAM-0152 · Demo · P0 · S · XS rank requires S score + no BAD/MISS + vitals never < 50 + Litany either unused or used at a scripted peak — documented in results tooltip
- [ ] GAM-0153 · Demo · P1 · S · Human playtest validation — 5 playtesters' median rank on each demo op falls in B–A; outliers logged as tuning tasks
- [x] GAM-0154 · Demo · P1 · S · Results breakdown — ratings histogram, max combo, vitals bonus, time bonus, penalties, final rank with the next-rank delta ("312 to A")
- [x] GAM-0155 · Demo · P1 · S · Best rank/score per op persisted per difficulty in save — results shows NEW BEST
- [ ] GAM-0156 · Alpha · P1 · S · Ch3–5 rank thresholds — every op calibrated via `CALIBRATE=1` bot run and signed off by designer in PR
- [x] GAM-0157 · Beta · P2 · S · Online leaderboard hook (Steam) — submit score only from validated replays (replay re-simulated headlessly on submit)

## GAM-G · Vitals model

- [x] GAM-0158 · Demo · P0 · S · Vitals drain = sum of entity `drain()` × difficulty multiplier — unit test for additive stacking and floor at 0 → lose
- [x] GAM-0159 · Demo · P0 · S · Low-vitals warnings at 30 (Ilse callout + heartbeat SFX) and 15 (red pulse post-FX) — once per crossing, with 5-point hysteresis
- [x] GAM-0160 · Demo · P1 · S · Passive recovery — +0.15/s when no drain entities exist (between phases) so phase transitions feel like breathing room
- [x] GAM-0161 · Demo · P1 · S · Vitals HUD shows drain rate arrow — (↓ slow / ↓↓ fast) computed from last 1 s delta
- [x] GAM-0162 · Demo · P1 · S · ECG line tied to vitals: rate rises as vitals fall — flatline animation on loss; deterministic (no `Math.random`)
- [x] GAM-0163 · Alpha · P1 · M · Secondary vitals (Alpha only where used): blood volume (bites), temperature (frost/fever) — HUD shows only when an op declares them
- [x] GAM-0164 · Alpha · P2 · S · Fake-vitals state for Sext — HUD shows smoothed false number; Lens hover over heart reveals true value
- [x] GAM-0165 · Beta · P2 · S · Patient constitution modifier per op — (frail 0.8× max vitals / hardy 1.2× drain tolerance) exposed in briefing

## GAM-H · Litany of Stillness

- [ ] GAM-0166 · Demo · P0 · S · Star recognition tolerance tuned from 200 recorded human stars (≥ 92 % accept, ≤ 2 % false-positive on zig-zag stitch paths) — test data committed
- [x] GAM-0167 · Demo · P0 · S · Litany does not slow the player's cursor or tool timers (hold durations use real time) — only entity time; unit test
- [x] GAM-0168 · Demo · P1 · S · Litany drawn anywhere including off-body — right mouse draws in gold ink with fade trail; failed star shows "The words falter" and does not consume use
- [x] GAM-0169 · Demo · P1 · S · Litany extended by COOL chain — each COOL during Litany adds 0.25 s up to +3 s
- [x] GAM-0170 · Demo · P1 · S · Litany availability tell — HUD star glyph lit/unlit; op briefing notes if the Litany is sealed for story reasons
- [x] GAM-0171 · Demo · P1 · S · Keyboard/controller alternative — hold L then trace star with stick/mouse OR hold key for 1.5 s in Accessibility mode
- [x] GAM-0172 · Alpha · P1 · M · Litany variants (unlocked by chapter): Stillness (slow), Vigil (reveal all hidden for 6 s), Mercy (freeze drain 6 s, no slow), Wrath (brand damage ×2 for 6 s) — one selected per op in briefing
- [x] GAM-0173 · Alpha · P1 · S · Variant gestures — each variant uses the same star; selection is pre-op to keep a single gesture
- [x] GAM-0174 · Alpha · P2 · S · Whisper meter hook — each Litany use adds +1 Whisper (story system); event emitted, no gameplay effect in sim
- [x] GAM-0175 · Beta · P2 · S · Two-Litany ops (Compline finale) — second use granted after breaking silence nodes; unit test

## GAM-I · Difficulty modes & assists

- [x] GAM-0176 · Demo · P0 · M · Difficulty modes: Novice (drain ×0.6, time ×1.4, guides always), Surgeon (baseline), Master (drain ×1.35, time ×0.85, no guides, unlocks after Ch2 clear) — stored per save
- [x] GAM-0177 · Demo · P0 · S · Retry flow — on loss offer Retry (same seed), Retry at Novice for this op only, or return to menu; Retry at checkpoint for boss ops (phase start)
- [x] GAM-0178 · Demo · P0 · S · Boss checkpoint — losing on Matins/Lauds phase ≥ 2 restarts at that phase with vitals 70; score marked "checkpointed" (no XS)
- [x] GAM-0179 · Demo · P1 · S · Assist toggles independent of difficulty: bigger hitboxes (+6 px), guide lines, auto-lens reveal, slower boss tells (×1.25), no-fail vitals floor at 1 — each flagged on results
- [x] GAM-0180 · Demo · P1 · S · Dynamic hint system — after 2 failures on the same op, Ilse offers a one-line strategy tip specific to the failure cause (e.g. "drain before salving")
- [x] GAM-0181 · Demo · P1 · S · Balance test runs every demo op at all three difficulties: Novice novice-bot wins with vitals ≥ 40 — Master steady-bot wins
- [x] GAM-0182 · Alpha · P2 · S · "Hard mode" story flavour — Master mode changes Ilse's lines to terse callouts

## GAM-J · Bot harness & balance

### Harness capabilities
- [x] GAM-0183 · Demo · P0 · M · Bot skill profiles: `novice` (think 1.5, ±10 px aim noise), `steady` (1.0, ±5 px), `expert` (0.6, ±2 px), `farm` (stall boss), `sloppy` (30 % wrong-order actions) — seeded noise
- [x] GAM-0184 · Demo · P0 · S · Bot handles every entity kind incl. hexstone lead-dish rule, barb nick, bolt two-stage pull, wadding fragments — (fails loudly on unknown entity)
- [x] GAM-0185 · Demo · P0 · S · Multi-seed sweep — balance test runs each op on 20 seeds; asserts win rate 100 % steady, ≥ 95 % novice
- [x] GAM-0186 · Demo · P1 · S · Balance report CLI `npm run balance` — CSV per op/profile/seed: score, rank, time used, min vitals, Litany used; diffed against committed baseline in CI (> 10 % shift flags)
- [x] GAM-0187 · Demo · P1 · S · Bot uses Litany at its heuristic best moment (largest simultaneous drain) — expert XS reachable on every demo op (test)
- [x] GAM-0188 · Demo · P1 · S · Bot-harness perf — full 10-op × 5-profile × 20-seed sweep < 60 s in CI
- [x] GAM-0189 · Demo · P2 · S · Bot visual playback — dev scene that replays a bot run with the real renderer for eyeballing
- [x] GAM-0190 · Alpha · P1 · M · Bot extensions for Alpha mechanics — fracture alignment, stone chipping order, frost tap-thaw, amputation saw rhythm, antidote colour matching

### Per-operation tuning (demo)
- [x] GAM-0191 · Demo · P0 · S · op1-1 A Tavern Knife tuning — first-op pass: novice-bot min vitals ≥ 60, steady time used ≤ 50 %; 2 lacerations + 1 pool; no hidden entities
- [x] GAM-0192 · Demo · P0 · S · op1-2 The Barbed Shaft tuning — barb-nick taught; sloppy bot (no nick) still wins at C/B; ranks recalibrated
- [x] GAM-0193 · Demo · P0 · S · op1-3 Powder Burns tuning — shot + wadding + fire burns; steady ≤ 70 % time; wadding-miss fever phase survivable by novice
- [x] GAM-0194 · Demo · P0 · S · op1-4 Pestilent Humours tuning — bubo swell timers ≥ 30 s so novice lances all before bursts on at least 18/20 seeds
- [ ] GAM-0195 · Demo · P0 · S · op2-1 Gravehound tuning — fang angles readable; claw lacerations total ≤ 5; steady rank B–A
- [x] GAM-0196 · Demo · P0 · S · op2-2 The Green Seam tuning — hexstone whisper drain never alone kills novice bot (min vitals ≥ 25)
- [ ] GAM-0197 · Demo · P0 · S · op2-3 Brood-Mother's Kiss tuning — venom mote count and grub spawn cadence set so drain peaks ≤ 1.2/s steady
- [x] GAM-0198 · Demo · P0 · S · op2-4 The Silenced Cantor tuning — sigil stroke counts 4–7; regress timer 4 s verified fair for novice
- [ ] GAM-0199 · Demo · P1 · S · Difficulty curve check — steady-bot median min-vitals decreases monotonically op1-1 → op2-5 except post-boss breather op2-1 (documented chart in balance report)
- [x] GAM-0200 · Alpha · P1 · S · Ch3 op tuning — every Ch3 op passes 20-seed steady/novice sweep and has committed thresholds
- [x] GAM-0201 · Alpha · P1 · S · Ch4 op tuning — every Ch4 op passes 20-seed steady/novice sweep and has committed thresholds
- [x] GAM-0202 · Beta · P1 · S · Ch5 op tuning — every Ch5 op passes 20-seed steady/novice sweep and has committed thresholds
- [ ] GAM-0203 · Beta · P1 · M · Human telemetry balance pass — opt-in beta telemetry (fail rate per op); any op with > 35 % first-attempt fail on Surgeon gets a tuning task

## GAM-K · Tutorialisation (Demo)

- [x] GAM-0204 · Demo · P0 · M · Guided op1-1 — step-gated tutorial: each tool introduced with Ilse line + highlight + input prompt; sim pauses drain until first correct action of each step
- [x] GAM-0205 · Demo · P0 · S · Tool introduction schedule: op1-1 Lancet/Leech/Thread/Tincture, op1-2 Tongs, op1-3 Salve/Lens, op1-4 Brand, op1-5 Litany — unit test asserts no op requires an un-introduced tool
- [x] GAM-0206 · Demo · P0 · S · Litany tutorial — prompted star practice in a paused frame before Matins phase 2 with 3 attempts and a "skip" fallback that auto-triggers the Litany
- [x] GAM-0207 · Demo · P1 · S · Contextual first-time hints (one per mechanic, save-tracked) — barb nick, bolt pull, wadding, rot coverage, sigil order, hexstone dish, venom ligature
- [x] GAM-0208 · Demo · P1 · S · Tutorial skip for returning players — (option + "I've operated before" prompt on new save)
- [x] GAM-0209 · Demo · P1 · S · Surgeon's Manual — in-game codex page per tool and ailment unlocked on first encounter, with 3-frame animated diagram
- [x] GAM-0210 · Demo · P1 · S · Practice Theatre — sandbox scene with dummy patient to try each tool without scoring; accessible from pause menu
- [x] GAM-0211 · Demo · P2 · S · Tutorial input glyphs — prompts switch between mouse/keyboard and controller glyphs within 1 frame of last-used device changing
- [ ] GAM-0212 · Alpha · P1 · S · Chapter 3–5 new-mechanic intro ops each have a no-fail first phase that teaches the mechanic — (fracture, stone, frost, amputation)

## GAM-L · Challenge mode ("X-Operations")

### Rules & structure
- [x] GAM-0213 · Demo · P1 · M · Demo X-op: "X1 — Matins, Unveiled" unlocks on Ch2 clear; Matins with 1.5× HP, 3 s veil / 2 s open rhythm, no checkpoint, Master-only drain
- [x] GAM-0214 · Demo · P1 · S · X-op rules: no Assist toggles, no retry-at-Novice, Litany allowed once — results show rank and a global demo best time
- [x] GAM-0215 · Alpha · P1 · L · Full X-op ladder — X1–X8, one per Malison Hour, each a remixed escalated boss unlocked by clearing its story chapter at A rank or better
- [x] GAM-0216 · Alpha · P1 · S · X-op modifiers table (data): drain×, time×, HP×, tell speed×, add cadence× — each X-op declares its modifiers
- [x] GAM-0217 · Alpha · P2 · M · Time-attack mode — any cleared op replayable against the clock; ghost vitals graph of personal best overlaid on HUD
- [x] GAM-0218 · Beta · P1 · M · Symptom Loom — procedural challenge ops built from 3 adjacent "verses" out of 12 symptom modules; seed shown and shareable
- [x] GAM-0219 · Beta · P1 · S · Loom validator — every generated combination tested by bot sweep (1000 seeds) for completability before shipping the module set
- [x] GAM-0220 · Beta · P2 · M · Daily Loom — date-seeded op; Steam leaderboard per day
- [ ] GAM-0221 · Post · P2 · L · The Unsung Hour — secret post-game challenge stitching remnants of every patient lost; unlocked by X1–X8 all cleared
- [x] GAM-0222 · Post · P3 · M · Custom challenge editor — toggle modifiers on any cleared op and share code string

### Mutators
- [x] GAM-0223 · Alpha · P2 · S · Mutator: "Candle-Only" — vignette radius 45 %, Lens reveal radius ×0.7
- [x] GAM-0224 · Alpha · P2 · S · Mutator: "Moving Cart" — field sways 12 px sinusoidal at 0.3 Hz; aim tolerance unchanged
- [x] GAM-0225 · Alpha · P2 · S · Mutator: "Field Tent in Rain" — drips create small blood-thinning pools every 5 s
- [x] GAM-0226 · Beta · P3 · S · Mutator: "Stroh Watches" — Litany use fails the op (inquisition challenge)

## GAM-M · Meta progression

- [x] GAM-0227 · Alpha · P1 · M · Instrument upgrades — purchasable with fees earned from ranks: Fine Lancet (tolerance +2 px), Silver Tongs (hexstone whisper −50 %), Deep Leech (drain ×1.2), Waxed Thread (stitch spacing tolerance +20 %) — max one tier each
- [x] GAM-0228 · Alpha · P1 · S · Upgrades disabled in X-ops and leaderboards — results flag "upgraded kit"
- [x] GAM-0229 · Alpha · P1 · S · Fee economy — XS 300, S 200, A 120, B 70, C 30; full game upgrade cost 2400 so a B-average player owns all by Ch5
- [x] GAM-0230 · Alpha · P2 · S · Kit loadout — choose 1 of 3 unlocked Litany variants and 1 Tincture variant pre-op
- [x] GAM-0231 · Beta · P2 · S · Hospice reputation — sum of best ranks unlocks cosmetic hospice improvements and codex pages
- [x] GAM-0232 · Beta · P2 · S · Achievements hooks for gameplay — first XS, 50-combo, no-Litany boss clear, all X-ops, never-BAD op (event list shared with platform workstream)
- [x] GAM-0233 · Demo · P2 · S · Demo progression — ranks and bests carry over to the full game save (migration test)

## GAM-N · Accessibility of mechanics

- [x] GAM-0234 · Demo · P0 · S · Hold-to-toggle option — tools needing a held button (Leech, Brand, Tincture, Lens) can be click-to-start/click-to-stop
- [x] GAM-0235 · Demo · P0 · S · Every audio tell has a visual twin (e.g. Hymn ring, shroud opening) — checklist test lists cue ids with both channels
- [x] GAM-0236 · Demo · P1 · S · Colour-blind safe ailments — venom, hexstone, rot, pus distinguished by shape/pattern not hue alone; verified under deuteranopia/protanopia/tritanopia filters
- [x] GAM-0237 · Demo · P1 · S · Game-speed slider 70–100 % — (flags results, disables leaderboard)
- [x] GAM-0238 · Demo · P1 · S · Gesture simplification — zig-zag stitches can be replaced by click-per-stitch; encircle can be replaced by tap-and-hold 1 s; star can be a hold key
- [x] GAM-0239 · Demo · P1 · S · Screen shake and flash intensity sliders honoured by all boss effects — (Matins open flash, Lauds dawn flare)
- [x] GAM-0240 · Demo · P2 · S · Cursor options — cursor size (1×/1.5×/2×) and high-contrast target outlines toggle, applied to all entities
- [x] GAM-0241 · Alpha · P1 · S · One-handed mode — tool cycle on mouse side buttons, Litany via hold key; every Alpha mechanic validated completable
- [x] GAM-0242 · Alpha · P2 · S · Rhythm mechanics — (amputation saw, heart beats) have a "no rhythm" assist with widened windows ×2
- [x] GAM-0243 · Beta · P1 · S · Accessibility audit of all 5 chapters — each op completable with all assists on by the bot using simplified gestures

## GAM-O · Environment & patient modifiers (Alpha)

- [x] GAM-0244 · Alpha · P2 · S · Patient thrashing — flagellant/penitent ops: field shakes 6 px unless Tincture calms (10 s effect)
- [x] GAM-0245 · Alpha · P2 · S · Talking patient interruptions — VN overlay mid-op pauses sim; resumes with 1 s grace
- [x] GAM-0246 · Alpha · P2 · S · Arterial spray event — unclamped artery adds pool every 1 s; clamp with Tongs hold 0.5 s before extracting nearby objects
- [ ] GAM-0247 · Alpha · P2 · S · Multi-organ fields — camera pan between two regions (Tab), off-screen entities keep draining with edge arrows
- [ ] GAM-0248 · Beta · P2 · M · Two-patient triage op (Ch4) — switch patient with Tab; each has separate vitals; fail if either dies

## GAM-P · Operation flow, phases & assistant

- [x] GAM-0249 · Demo · P0 · S · Phase transitions — phase ends when all required entities cleared; 1.5 s breather with drain frozen and Ilse line; unit test that phase N+1 spawns only after
- [x] GAM-0250 · Demo · P0 · S · Pause (Esc) freezes sim completely, blurs field (prevents planning exploit on hidden entities — Lens reveal off while paused)
- [x] GAM-0251 · Demo · P1 · S · Ilse callout priority queue — max 1 line per 2.5 s, priority (danger > instruction > praise); `sayOnce` keys persisted per op run
- [x] GAM-0252 · Demo · P1 · S · Callout audit — every demo op callout ≤ 90 chars, references tools by display name from `TOOL_INFO` (test scans content)
- [x] GAM-0253 · Demo · P1 · S · Timer rules — timer out = loss; last 30 s timer turns red with ticking; time bonus 0 below 10 s
- [x] GAM-0254 · Demo · P1 · S · Operation intro — 2 s "Begin" beat where input is ignored; first-frame drain = 0 (test)
- [x] GAM-0255 · Demo · P1 · S · Closing step — every op ends with final suture of the initial incision unless op declares `noClose`; skipped closure impossible
- [x] GAM-0256 · Demo · P2 · S · Scripted events DSL in OperationDef (`at: {phase, t}`, `when: cleared(kind)`) for callouts/spawns — replaces ad-hoc code in chapter files
- [x] GAM-0257 · Alpha · P1 · S · Branching op outcomes — op may end with a choice (cauterise bite / leave; excise hornbud / certify) recorded as story flag; scoring independent
- [x] GAM-0258 · Alpha · P2 · S · Mid-op VN insert support (talking cyst) — pause, dialogue, resume; bot harness skips dialogue deterministically
- [x] GAM-0259 · Alpha · P2 · S · Ilse assist action — once per op, press H for Ilse to hold a pool/clamp (auto-drain one pool) at the cost of −200 score

## GAM-Q · Disciplines hooks (Beta)

- [x] GAM-0260 · Beta · P2 · M · Diagnosis mini-mode core — Lens/palpation clicks on a still patient collect symptoms; select ailment from 4 options; wrong answer costs time in next op
- [x] GAM-0261 · Beta · P2 · M · Forensic/inquisition mode core — examine corpse, tag evidence points, present verdict to Stroh; no vitals, timer only
- [x] GAM-0262 · Beta · P2 · M · Field triage core — 3–5 patients, tag priority then 30 s micro-ops each; shared timer
- [x] GAM-0263 · Beta · P2 · S · Bone-setting discipline reuses fracture puzzle with external manipulation — (no incision) and traction meter

---

## BOS-A · Boss framework (Demo)

- [x] BOS-0001 · Demo · P0 · M · `MalisonBase` class — shared HP, phase list, hurt flash, tells, add registry (`spawnedByBoss`), exposure windows; Matins and Lauds refactored onto it with unchanged bot results
- [x] BOS-0002 · Demo · P0 · S · Boss HP bar HUD with phase notches and hour name in Fraktur — hidden segments reveal as phases unlock
- [x] BOS-0003 · Demo · P0 · S · Tell framework — every attack declares `tell: {lead: s, visual, audio}`; minimum lead 0.8 s on Surgeon, 1.0 s on Novice; test enforces for all bosses
- [x] BOS-0004 · Demo · P0 · S · Boss phase-transition cinematic beat — (1.2 s, sim frozen, shake + choir sting) with skip on repeat attempts
- [x] BOS-0005 · Demo · P1 · S · Boss death sequence — 2.5 s dissolve, ash particles, all boss-spawned adds wither over 3 s (scored at 0, not failed)
- [x] BOS-0006 · Demo · P1 · S · Boss drain budget — sum of boss + adds drain never exceeds 2.0/s on Surgeon (sim assertion in debug builds)
- [x] BOS-0007 · Demo · P1 · S · Boss bot-harness contract — every boss exports a `botStrategy` used by `tests/bot.ts`; completion test on 20 seeds per difficulty
- [x] BOS-0008 · Demo · P1 · S · Hollow Choir leitmotif hooks — boss emits `music.intensity` 0–3 by phase for adaptive music
- [x] BOS-0009 · Alpha · P1 · S · Boss content lint — every boss phase has ≥ 1 tell, ≥ 1 counter, an Ilse hint line, and codex text

## BOS-B · Matins — The Night Vigil (Chapter 1 boss, Demo polish)

### Mechanics & phases
- [x] BOS-0010 · M0 · P0 · M · Matins core — shroud rhythm 4 s veiled / 2.5 s open, drift, rend lacerations while veiled, brand only while open, MalisonShard spawns
- [x] BOS-0011 · Demo · P0 · S · Phase 1 "Vigil" (100–60 % HP): base rhythm — rend every 4.5 s; tell = shroud tremor 0.8 s before opening
- [x] BOS-0012 · Demo · P0 · S · Phase 2 "Watchfire" (60–25 %): open window 2.0 s, spawns 2 MalisonShards on each veil close that crawl to wounds — Litany tutorial triggers at phase start
- [x] BOS-0013 · Demo · P0 · S · Phase 3 "The Eye" (25–0 %): a single eye opens on a 3-beat pulse — branding the eye only on beat 3 deals ×2 damage; misses rend
- [x] BOS-0014 · Demo · P1 · S · Eye-gaze attack — eye locks cursor for 1 s (tell: iris contracts) then fires a lash laceration along the gaze line; moving cursor off gaze line avoids
- [x] BOS-0015 · Demo · P1 · S · Veiled-branding feedback — branding the veiled shroud rates MISS once then hint "Wait for it to open"; no further MISSes for 5 s
- [x] BOS-0016 · Demo · P1 · S · Drift clamp — Matins never drifts within 40 px of field edge or under HUD
### Audio/visual cues
- [x] BOS-0017 · Demo · P1 · S · Opening cue — low bell toll + shroud peels with inner red glow; visual lead 0.8 s, audio lead 0.6 s
- [x] BOS-0018 · Demo · P1 · S · Rend cue — shroud edge sharpens into hooks 0.5 s before laceration spawns
- [x] BOS-0019 · Demo · P2 · S · Matins flesh-shader corruption radius grows with HP lost — recedes on death
- [x] BOS-0020 · Demo · P2 · S · Matins ambience — choir whisper loop stereo-panned to Matins screen x-position (−1..1)
### Tuning & tests
- [x] BOS-0021 · Demo · P0 · S · HP and brand DPS tuned so steady bot clears in 150–210 s on Surgeon — novice bot wins 20/20 seeds
- [x] BOS-0022 · Demo · P0 · S · Farming regression — `farm` bot Matins score ≤ steady score (depends on GAM farming fix)
- [x] BOS-0023 · Demo · P1 · S · Unit tests — rhythm timings per phase, eye beat damage multiplier, shard spawn count per veil
- [x] BOS-0024 · Demo · P1 · S · Checkpoint at phases 2 and 3 verified — retry resumes with correct HP and no leftover adds
- [ ] BOS-0025 · Demo · P1 · S · Playtest gate — 5 new players: ≥ 4 clear Matins within 3 attempts on Surgeon
- [x] BOS-0026 · Demo · P2 · S · Matins codex & debrief — codex entry unlocked on first encounter; 3 Ilse debrief lines keyed to rank (XS/S, A/B, C)

## BOS-C · Lauds — The Antiphon (Chapter 2 boss, Demo polish)

### Mechanics & phases
- [x] BOS-0027 · M0 · P0 · M · Lauds core — 4 orbiting ChoirVoices shield heart; 5 s exposure before rekindle; Hymn ring lacerations; submerge phase leaving Rot; EggSac + SpiderlingGrub adds
- [x] BOS-0028 · Demo · P0 · S · Phase 1 "Call" (100–65 %): 4 Voices — silence a Voice by tracing its sigil; heart exposed when all silent
- [x] BOS-0029 · Demo · P0 · S · Phase 2 "Response" (65–30 %): two linked bodies in different regions joined by light-thread — damaging one heals the other 50 % unless the other is struck within a 1.5 s response window
- [x] BOS-0030 · Demo · P0 · S · Thread severance counter — Lancet across the light-thread during its dim beat (every 6 s, 1 s window) unlinks bodies for 8 s
- [x] BOS-0031 · Demo · P0 · S · Phase 3 "Dawn" (30–0 %): submerges and surfaces at Lens-revealed ripples — dawn flare blinds Lens every 12 s for 2 s (tell: horizon glow 1 s)
- [x] BOS-0032 · Demo · P1 · S · Hymn ring — max 1 laceration per verse on Surgeon, 2 on Master; ring radius and speed exposed in tuning
- [x] BOS-0033 · Demo · P1 · S · Rekindle rules — rekindled Voices spawn at 50 % trace length (partially traced) so repeated rekindles are faster to clear
- [x] BOS-0034 · Demo · P1 · S · EggSac hatch timer 10 s with swell tell — hatched spiderlings target open wounds; limit 6 live spiderlings
- [x] BOS-0035 · Demo · P1 · S · Submerged Rot trail capped at 3 patches — (existing) and trail Rot rated as boss-add (farming fix)
### Audio/visual cues
- [x] BOS-0036 · Demo · P1 · S · Antiphon audio — each linked body sings one half of a two-note call; response window visualised as an arc filling between them
- [x] BOS-0037 · Demo · P1 · S · Hymn tell — choir inhale SFX + ring outline shimmer 0.8 s before expansion
- [x] BOS-0038 · Demo · P1 · S · Dawn flare — gold bloom spike limited by flash-intensity option; Lens icon greys out during blind
- [x] BOS-0039 · Demo · P2 · S · Voice silence FX — each silenced Voice drops a note from the sung chord (4-voice stem mix)
### Tuning & tests
- [x] BOS-0040 · Demo · P0 · S · Steady bot clears Lauds in 240–320 s — novice bot 20/20; expert XS reachable
- [x] BOS-0041 · Demo · P0 · S · Bot strategy handles response window — (strike A then B within 1.5 s) and thread severance timing
- [x] BOS-0042 · Demo · P0 · S · Farming regression — `farm` bot Lauds score ≤ steady score
- [x] BOS-0043 · Demo · P1 · S · Unit tests — heal-on-unanswered strike, severance unlink duration, flare blind duration, rekindle partial trace
- [x] BOS-0044 · Demo · P1 · S · Lauds checkpoints — retry at phases 2 and 3 resumes with correct HP, linked-body state, and no leftover adds (test)
- [ ] BOS-0045 · Demo · P1 · S · Playtest gate — ≥ 4/5 players clear Lauds in ≤ 4 attempts on Surgeon; median attempt time logged
- [x] BOS-0046 · Demo · P2 · S · Lauds codex, debrief lines, and end-of-demo tease of Prime — (name-sigil flicker in final frame)

## BOS-D · Prime — The Roll of the Dead (Chapter 3)

### Mechanics & phases
- [x] BOS-0047 · Alpha · P0 · L · Prime entity — a quill-like mass that writes name-sigils stroke by stroke across tissue; each completed name = −18 vitals and a laceration per letter
- [x] BOS-0048 · Alpha · P0 · M · Phase 1 "Roll-Call" (100–60 %): writes 1 name at a time (5 strokes, 1.2 s/stroke) — erase by tracing strokes in reverse order with Lancet; each erased name exposes Prime for 3 s brand window
- [x] BOS-0049 · Alpha · P0 · M · Phase 2 "The Ledger" (60–25 %): 2–3 names written in parallel in different organs; priority juggling — names closer to heart write 30 % faster (tell: red ink)
- [x] BOS-0050 · Alpha · P0 · M · Phase 3 "Kreuzer" (25–0 %): writes the surgeon's own name across the HUD edge — erase strokes while dodging ink-blot pools that disable the tool touching them 3 s
- [x] BOS-0051 · Alpha · P1 · S · Ink-blot adds — pooled ink behaves as BloodPool (black bile) drained by Leech-Pipe; left 8 s it becomes a new stroke source
- [x] BOS-0052 · Alpha · P1 · S · Litany interaction — Litany pauses all writing; erasing during Litany rated COOL automatically if order correct
### Counterplay, tells & cues
- [x] BOS-0053 · Alpha · P1 · S · Stroke tell — nib glint + scratch SFX 0.8 s before each stroke; stroke path pre-drawn as faint indentation
- [x] BOS-0054 · Alpha · P1 · S · Name completion warning — at final stroke, name glows and a bell tolls once; Ilse "It's nearly written!"
- [x] BOS-0055 · Alpha · P2 · S · Names drawn from lost-patient list in the save (fallback to canned names) — fictional names only, never player-entered text
- [x] BOS-0056 · Alpha · P2 · S · Audio — monk voice reading a roll, one name per completed stroke set
### Tuning & tests
- [ ] BOS-0057 · Alpha · P0 · S · Bot strategy: erase names in heart-proximity priority — steady bot clears in 260–340 s; novice 20/20
- [x] BOS-0058 · Alpha · P1 · S · Unit tests — reverse-order erase rule, parallel write speeds, ink-to-stroke conversion timer
- [x] BOS-0059 · Alpha · P1 · S · Farming guard — erased-stroke points count as boss-add (capped)
- [ ] BOS-0060 · Beta · P1 · S · Prime final pass — playtest gate (≥ 4/5 clear in ≤ 4 attempts) and retune with final art/audio
- [x] BOS-0061 · Beta · P2 · S · Prime codex & debrief — codex entry + 3 rank-keyed Ilse debrief lines

## BOS-E · Terce — Tongues of Fire (Chapter 3 finale)

### Mechanics & phases
- [x] BOS-0062 · Alpha · P0 · L · Terce entity — hexfire core hidden in one organ; flame tongues leap between organs along an organ graph every 5 s
- [x] BOS-0063 · Alpha · P0 · M · Phase 1 "Kindling" (100–65 %): tongues spawn Burn(hexfire) patches — Salve the flame-front then Lancet-excise the root ember to damage core (10 % each)
- [x] BOS-0064 · Alpha · P0 · M · Brand inversion — using the Cautery Brand on Terce or its flames heals it 5 %/s and spreads fire; first use triggers Ilse warning, subsequent uses rate BAD
- [x] BOS-0065 · Alpha · P0 · M · Phase 2 "Pentecost" (65–30 %): core splits into 3 tongues — each must be doused (Salve full coverage) within 2 s of each other or they re-merge at full HP of the phase
- [x] BOS-0066 · Alpha · P0 · M · Phase 3 "Ash" (30–0 %): core exposed but surrounded by heat haze that distorts cursor (offset up to 10 px) — Leech-Pipe drawing smoke clears haze 4 s; excise core with encircle
- [x] BOS-0067 · Alpha · P1 · S · Salve capacity pressure — Terce op raises SALVE_MAX to 70 and refill delay to 2 s; tuning documented
### Counterplay, tells & cues
- [x] BOS-0068 · Alpha · P1 · S · Leap tell — target organ glows orange 1.0 s and crackle SFX pans toward it
- [x] BOS-0069 · Alpha · P1 · S · Heat-haze shader tied to phase-3 remaining haze — accessibility option replaces distortion with orange outline (cursor offset remains, shown as ghost cursor)
- [x] BOS-0070 · Alpha · P2 · S · Tongue audio — each tongue whispers a different syllable; merged core sings full word
### Tuning & tests
- [ ] BOS-0071 · Alpha · P0 · S · Bot strategy: salve fronts, excise roots, synchronized douse in phase 2 — steady clears 280–360 s
- [x] BOS-0072 · Alpha · P1 · S · Unit tests — brand heals Terce, re-merge window, haze cursor offset applied to tool pos not visual cursor
- [x] BOS-0073 · Alpha · P1 · S · Fire-spread cap — ≤ 6 hexfire patches at once; drain budget assertion holds
- [ ] BOS-0074 · Beta · P1 · S · Terce final pass — playtest gate (≥ 4/5 clear in ≤ 4 attempts) and retune with final art/audio
- [x] BOS-0075 · Beta · P2 · S · Terce codex & debrief — codex entry + 3 rank-keyed Ilse debrief lines

## BOS-F · Sext — The Noonday Demon (Chapter 4)

### Mechanics & phases
- [x] BOS-0076 · Alpha · P0 · L · Sext entity — acedia-curse that inflicts torpor: tool response lag grows 0→250 ms over 20 s unless stimulant Tincture(blue) is injected
- [x] BOS-0077 · Alpha · P0 · M · Phase 1 "Languor" (100–60 %): Sext rests beneath a stone crust — chip crust plates (petrification rules) to expose; torpor ramps
- [x] BOS-0078 · Alpha · P0 · M · Phase 2 "False Noon" (60–30 %): HUD vitals show a calm false value (smoothed toward 70) — true vitals only via Lens on heart; real drain 1.2/s
- [x] BOS-0079 · Alpha · P0 · M · Phase 3 "Stillborn Hour" (30–0 %): Sext casts its own Litany — the world slows but the player's tools slow too (inverse); break 3 sun-dial nodes with Brand to end its stillness
- [x] BOS-0080 · Alpha · P1 · S · Petrification spread from Sext's crust at 3 px/s — stone reaching an organ glyph halves that organ's drain resistance
- [x] BOS-0081 · Alpha · P1 · S · Player Litany vs Sext — using Litany during its Stillborn cast cancels both (clash FX) and stuns Sext 4 s
### Counterplay, tells & cues
- [x] BOS-0082 · Alpha · P1 · S · Torpor tell — cursor trail lengthens and HUD edges desaturate proportional to lag; option to show a numeric lag readout
- [x] BOS-0083 · Alpha · P1 · S · False-vitals tell — ECG line flat-smooth (too regular) while false; Ilse hint after 10 s "His colour's wrong — check the heart"
- [x] BOS-0084 · Alpha · P2 · S · Noon bell audio — midday heat drone, cicada-like buzz rising with torpor
- [x] BOS-0085 · Alpha · P1 · S · Accessibility — torpor lag capped at 120 ms when "reduced input lag effects" assist is on
### Tuning & tests
- [ ] BOS-0086 · Alpha · P0 · S · Bot strategy: Tincture(blue) when lag > 150 ms, periodic Lens on heart in phase 2 — steady clears 280–360 s
- [x] BOS-0087 · Alpha · P1 · S · Unit tests — input-lag queue applied deterministically, false vitals never shown when Lens hovers heart, clash stun
- [ ] BOS-0088 · Beta · P1 · S · Playtest — confirm torpor reads as boss mechanic not game lag (survey question ≥ 80 % correct)
- [x] BOS-0089 · Beta · P2 · S · Sext codex & debrief — codex entry + 3 rank-keyed Ilse debrief lines

## BOS-G · None — The Hour of Death (Chapter 4 finale)

### Mechanics & phases
- [x] BOS-0090 · Alpha · P0 · L · None entity — heart-seeking burrower tunnelling along a hidden organ path; reaching the heart = instant loss (Litany or assist floor excepted)
- [x] BOS-0091 · Alpha · P0 · M · Phase 1 "Descent" (100–70 %): Lens tracks tunnel head — incise ahead of it to intercept; exposed 3 s → brand; it re-burrows along new path
- [x] BOS-0092 · Alpha · P0 · M · Phase 2 "Division" (70–35 %): each brand hit splits a segment off (3 segments) — segments race independently; any segment reaching heart = −40 vitals (not instant loss)
- [x] BOS-0093 · Alpha · P0 · M · Phase 3 "Ninth Hour" (35–0 %): shrunken core must be cut down to extraction size (3 hits) then pulled with Tongs within 2 s window — failing re-grows one stage
- [x] BOS-0094 · Alpha · P1 · S · Heart-distance meter HUD — shows nearest head's tunnel distance to heart; pulses under 20 %
- [x] BOS-0095 · Alpha · P1 · S · Litany intercept — Litany freezes burrowing fully (not 0.15×) during None; documented exception with test
- [x] BOS-0096 · Alpha · P1 · S · Tunnel collapse — tunnels left behind become lacerations that open 10 s later
### Counterplay, tells & cues
- [x] BOS-0097 · Alpha · P1 · S · Burrow tell — skin ripple + heartbeat SFX quickens as head nears heart; audible even with Lens off
- [x] BOS-0098 · Alpha · P1 · S · Surfacing tell — skin bulge 0.8 s before exposure point
- [x] BOS-0099 · Alpha · P2 · S · Three-o'clock bell toll at phase 3 start — lighting dims to ninth-hour gloom
### Tuning & tests
- [x] BOS-0100 · Alpha · P0 · S · Bot strategy: intercept prediction along known path — novice bot wins ≥ 19/20 (instant-loss boss needs margin)
- [x] BOS-0101 · Alpha · P0 · S · Fairness test — no seed spawns the head closer than 8 s travel from the heart at any phase start
- [x] BOS-0102 · Alpha · P1 · S · Unit tests — split segment count, heart-contact outcomes by phase, extraction window regrowth
- [ ] BOS-0103 · Beta · P1 · S · Playtest — instant-loss frustration check; checkpoint per phase mandatory
- [x] BOS-0104 · Beta · P2 · S · None codex & debrief — codex entry + 3 rank-keyed Ilse debrief lines

## BOS-H · Vespers — The Lamp-Lighting (Chapter 5)

### Mechanics & phases
- [x] BOS-0105 · Alpha · P0 · L · Vespers entity — wick-filaments threaded through vessels turn blood to tallow; field brightness tied to 4 "lamp" glow nodes
- [x] BOS-0106 · Alpha · P0 · M · Lamp rule — each lamp dims over 15 s; relight with Brand tap (0.3 s); unlit lamps darken their quadrant to 20 % brightness where Vespers hides
- [x] BOS-0107 · Alpha · P0 · M · Phase 1 "Lucernarium" (100–60 %): filaments visible only in lit quadrants — sever with Lancet, then Leech tallow clots (Brand-soften first)
- [x] BOS-0108 · Alpha · P0 · M · Phase 2 "Magnificat" (60–25 %): Vespers snuffs 2 lamps at once every 12 s — its body is only brandable while silhouetted against a lit lamp
- [x] BOS-0109 · Alpha · P0 · M · Phase 3 "Last Light" (25–0 %): one lamp remains and wanders — keep it lit while tracing Vespers' wick back to its root and excising it
- [x] BOS-0110 · Alpha · P1 · S · Tallow blood — vitals drain rises 0.1/s per un-drained clot; Tincture efficacy halved while ≥ 3 clots
### Counterplay, tells & cues
- [x] BOS-0111 · Alpha · P1 · S · Snuff tell — lamp flame gutters and leans 1.0 s before snuffing; hiss SFX
- [x] BOS-0112 · Alpha · P1 · S · Darkness accessibility — "Minimum brightness" option keeps dark quadrants at ≥ 45 % with Vespers outline
- [x] BOS-0113 · Alpha · P2 · S · Evening hymn music layer — each lit lamp adds a harmonic
### Tuning & tests
- [ ] BOS-0114 · Alpha · P0 · S · Bot strategy: lamp maintenance loop + filament cutting — steady clears 300–380 s
- [x] BOS-0115 · Alpha · P1 · S · Unit tests — lamp dim timer, quadrant visibility masking of entity hit-tests, silhouette damage rule
- [ ] BOS-0116 · Alpha · P1 · S · Perf check — dynamic lighting mask ≤ 0.5 ms GPU at 1080p on min-spec
- [ ] BOS-0117 · Beta · P1 · S · Vespers final pass — playtest gate (≥ 4/5 clear in ≤ 4 attempts) and retune with final art/audio
- [x] BOS-0118 · Beta · P2 · S · Vespers codex & debrief — codex entry + 3 rank-keyed Ilse debrief lines

## BOS-I · Compline — The Great Silence (Chapter 5)

### Mechanics & phases
- [x] BOS-0119 · Alpha · P0 · L · Compline entity — mixes mechanics of all prior Hours in rotation; pushes the patient toward a "peaceful death" (vitals drift toward 0 with calm music)
- [x] BOS-0120 · Alpha · P0 · M · Phase 1 "Examen" (100–70 %): cycles Matins shroud rhythm → Lauds voices → Prime names, 25 s each — each sub-mechanic reuses its boss module
- [x] BOS-0121 · Alpha · P0 · M · Phase 2 "Nunc Dimittis" (70–35 %): steals the Litany — at phase start the player's Litany becomes Compline's; it periodically slows the *player's* tool timers for 5 s
- [x] BOS-0122 · Alpha · P0 · M · Silence nodes — 4 nodes appear; branding all 4 restores the player's Litany (usable once more even if already spent)
- [x] BOS-0123 · Alpha · P0 · M · Audio mute mechanic — Compline mutes all SFX cues for 8 s windows; visual twins stay on (accessibility rule)
- [x] BOS-0124 · Alpha · P0 · M · Phase 3 "Great Silence" (35–0 %): core only damageable by a two-tool combo — Lancet open then Brand within 0.6 s — each combo 8 %
- [x] BOS-0125 · Alpha · P1 · S · Terce/Sext/None/Vespers snippets rotate in phase 3 as interrupts — (one per 20 s) at 60 % intensity
### Counterplay, tells & cues
- [x] BOS-0126 · Alpha · P1 · S · Litany-theft tell — HUD star glyph cracks and turns black; Ilse gasp line
- [x] BOS-0127 · Alpha · P1 · S · Silence window tell — all ambient audio ducks 1 s before full mute; subtitles show "[silence]"
- [x] BOS-0128 · Alpha · P2 · S · Compline music: evening prayer fades to single sustained note — returns in full when silence nodes broken
### Tuning & tests
- [ ] BOS-0129 · Alpha · P0 · S · Bot strategy covers stolen-Litany slow, node breaking, two-tool combo — steady clears 380–480 s; novice ≥ 19/20
- [x] BOS-0130 · Alpha · P1 · S · Unit tests — Litany ownership transfer and restore, mute windows never overlap a lethal attack without visual tell, combo window
- [x] BOS-0131 · Alpha · P1 · S · Module reuse test — Compline's Matins/Lauds/Prime sub-phases pass their original boss unit tests in isolation
- [ ] BOS-0132 · Beta · P1 · S · Playtest + final tuning — checkpoint per phase
- [x] BOS-0133 · Beta · P2 · S · Compline codex & debrief — codex entry + 3 rank-keyed Ilse debrief lines

## BOS-J · The Office — the Malison's final form (Chapter 5 finale)

### Mechanics & phases
- [x] BOS-0134 · Alpha · P0 · L · The Office entity — the complete curse woven from all eight Hours; a clock-face of 8 hour-sigils around a central heart, one lit per phase
- [x] BOS-0135 · Beta · P0 · M · Phase 1 "Dial": the lit hour-sigil dictates the active mechanic (random order, each Hour once) — extinguish each by clearing that Hour's counter (8 mini-trials, 20–30 s each)
- [x] BOS-0136 · Beta · P0 · M · Phase 2 "Unison": two Hours active simultaneously (pairs chosen so tools don't conflict: e.g. Matins+Vespers, Lauds+None) — pairing table in data
- [x] BOS-0137 · Beta · P0 · M · Phase 3 "The Choir's Heart": the Hollow Choir's conductor-sigil — trace the full 8-stroke Office sigil while Ilse holds vitals (auto-Tincture every 10 s) — story beat
- [x] BOS-0138 · Beta · P0 · S · Final Litany — Kreuzer's Litany plus Ilse's prayer: a second star within 3 s of the first grants 12 s Stillness (final phase only)
- [x] BOS-0139 · Beta · P1 · S · Stroh branch — if story flag `strohAlly`, Stroh's brand strike clears one hour-sigil in phase 1 automatically
### Counterplay, tells & cues
- [x] BOS-0140 · Beta · P1 · S · Dial tell — hand of the clock sweeps to the next Hour over 1.5 s with that Hour's signature sound
- [ ] BOS-0141 · Beta · P1 · S · All eight Hours' leitmotifs layered as a canon in phase 2 — mix test for clarity of tells
### Tuning & tests
- [ ] BOS-0142 · Beta · P0 · S · Bot completion on 50 seeds all difficulties — steady clears 480–600 s; op timeLimit 720 s
- [x] BOS-0143 · Beta · P0 · S · Pairing validator — every allowed pair of Hours tested for tool conflicts and drain budget ≤ 2.2/s
- [x] BOS-0144 · Beta · P1 · S · Checkpoint after each extinguished hour-sigil in phase 1 on Novice/Surgeon — per phase on Master
- [ ] BOS-0145 · Beta · P1 · S · Playtest gate — ≥ 70 % of playtesters clear within 5 attempts on Surgeon
- [x] BOS-0146 · Release · P2 · S · Office codex — ending debrief variants by rank and story flags

## BOS-K · Mid-bosses & elite ailments

### Demo elites (Chapters 1–2)
- [x] BOS-0147 · Demo · P1 · M · Brood-Mother's egg-cluster elite (op2-3) — cluster of 3 EggSacs sharing a membrane; cutting membrane first (encircle) prevents simultaneous hatch; unit + bot test
- [x] BOS-0148 · Demo · P1 · M · Cantor's Knot elite (op2-4) — a sigil wound round the larynx that re-draws one stroke each time its bearer "sings" (5 s cycle, tell = hum SFX + glow); must be traced between hums
- [x] BOS-0149 · Demo · P1 · S · Gravehound fang-nest elite (op2-1) — 3 fangs linked by a rot web; extracting fangs out of order spreads Rot 30 px
- [x] BOS-0150 · Demo · P2 · S · Matins herald (op1-4 final phase) — a single MalisonShard that flees the Lens; foreshadows Matins; branding it gives bonus 300
- [x] BOS-0151 · Demo · P1 · S · Elite health bars use the boss HUD in compact form — elite ops calibrated in balance test

### Alpha/Beta elites (Chapters 3–5)
- [x] BOS-0152 · Alpha · P1 · M · Stone Bride elite — petrification front from fingertips toward heart; chipping order puzzle + Litany freeze; 3 phases (hand, arm, chest)
- [x] BOS-0153 · Alpha · P1 · M · Troll-Blood Sellsword elite — regenerating wounds over shrapnel + acid spray disabling tools
- [x] BOS-0154 · Alpha · P1 · M · The Mouth Beneath elite — talking cyst; remove whole via encircle + tongs lift; rupture spawns a crawling remnant mini-boss (HP 40, flees to wounds)
- [x] BOS-0155 · Alpha · P1 · M · Hornchild elite — horn-bud trepanation with Choir sigil under the bud; sigil reacts to drill vibration by spawning lacerations
- [x] BOS-0156 · Alpha · P1 · M · Choir-Throat elite — extra vocal folds hum the hymn; hum mutes audio cues; excise in silence gaps
- [x] BOS-0157 · Alpha · P2 · M · Gut-worm matriarch — giant worm whose segments detach and become separate worms when pulled too fast
- [x] BOS-0158 · Alpha · P2 · M · Dead Man's Pulse elite — one heartbeat per minute; incisions only during the beat window; Lens shows bite-trance sigil
- [x] BOS-0159 · Beta · P2 · M · Frost-Wight's Kiss elite — frost-curse spreading from a bite, frost patches refreeze unless thawed in ring order
- [x] BOS-0160 · Beta · P2 · M · Ghoul-claw infection elite — infection lines race to armpit; forced amputation branch if lost
- [x] BOS-0161 · Beta · P2 · M · Choir Magus remnant — mid-boss before Compline: a Hollow Choir agent's hex embedded as 3 hexstones that orbit and swap places (shell-game) under the Lens
- [x] BOS-0162 · Alpha · P1 · S · Elite framework — elites use `MalisonBase` with ≤ 2 phases, no checkpoints, bot completion tests, and farming guards
- [x] BOS-0163 · Beta · P1 · S · Every elite has codex entry — Ilse hint on 2nd failure, and balance-report row

## BOS-L · Boss X-op remixes (challenge mode)

- [x] BOS-0164 · Demo · P1 · S · X1 Matins remix — 1.5× HP, 3 s/2 s rhythm, eye phase from start alongside shroud; bot expert clears on 20 seeds
- [x] BOS-0165 · Alpha · P1 · S · X2 Lauds remix — 6 Voices, response window 1.0 s, dawn flare every 8 s
- [x] BOS-0166 · Alpha · P1 · S · X3 Prime remix — writes 4 names in parallel from start; ink blots become strokes after 5 s
- [x] BOS-0167 · Alpha · P1 · S · X4 Terce remix — Salve capacity back to 46; tongues leap every 3.5 s
- [x] BOS-0168 · Beta · P1 · S · X5 Sext remix — torpor starts at 150 ms; false vitals permanent
- [x] BOS-0169 · Beta · P1 · S · X6 None remix — 5 split segments; heart contact always instant loss
- [x] BOS-0170 · Beta · P1 · S · X7 Vespers remix — only 3 lamps, dim over 9 s
- [x] BOS-0171 · Beta · P1 · S · X8 Compline remix — no silence nodes; Litany permanently stolen; two-tool combo window 0.4 s
- [ ] BOS-0172 · Beta · P1 · S · X-op remix validation — each remix cleared by expert bot on ≥ 18/20 seeds and by a designer by hand (recorded replay committed)

## BOS-M · Boss release polish & post-launch

- [ ] BOS-0173 · Beta · P1 · S · Boss consistency pass — all 8 Hours + Office share tell lead-time rules, HUD, checkpoint behaviour, results "Hour defeated" stamp
- [ ] BOS-0174 · Beta · P1 · S · Boss audio mix pass — tells audible over music at all volume presets (loudness test −3 dB margin)
- [ ] BOS-0175 · Release · P0 · S · Final bot sweep — all bosses/elites × 3 difficulties × 50 seeds pass on release candidate build
- [ ] BOS-0176 · Release · P1 · S · Replay-verified boss speedrun leaderboards — (fastest clear per Hour) enabled
- [x] BOS-0177 · Release · P1 · S · Crash/soft-lock audit — each boss run with random-input fuzz bot for 10 min × 20 seeds; no exceptions, no stuck phases
- [x] BOS-0178 · Post · P2 · M · Boss Rush mode — all 8 Hours back-to-back with carried vitals, one Litany total
- [ ] BOS-0179 · Post · P3 · L · Free update boss "Lauds Reprised" — Ilse-as-patient variant with new antiphon mechanic
- [ ] BOS-0180 · Post · P2 · S · Post-launch balance patch — tune from Steam telemetry fail rates per boss phase (any phase > 40 % fail on Surgeon adjusted)

