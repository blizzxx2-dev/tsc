# Chapters III–V — operation and boss design specs

Specs for every Chapter III–V operation and the six remaining Hours of the Malison plus the
Office, as implemented. Content lives in `src/content/chapter3.ts`, `chapter4.ts`,
`chapter5.ts` (registered through `src/content/later.ts`); new ailments in
`src/surgery/ailments/{kilnrows,vennmark,hollownight}.ts`; bosses in `src/surgery/bosses/`.
Every operation is played by the bot (`tests/bot.ts` → `tests/bot-later.ts`) at steady and
novice pace in `tests/balance.test.ts`; the boss operations also across seeds in
`tests/boss-seeds.test.ts`. Rank thresholds come from `CALIBRATE=1`.

Where this spec differs from the roadmap line, the difference is listed under **Deviations**.

---

## Chapter III — Prime and Terce (Kilnrows, quarantine, guildhall)

### op3-1 "The Hornchild" (Liesl, aged seven) — horn-bud trepanation
- Two `HornBud`s. **Drill**: hold the lancet on the bone ≥ 1.5 s and release; past 3 s the bone
  overheats (BAD, −4 vitals, and the Choir sigil beneath reacts to the drill by splitting the
  scalp — a laceration). **Lift**: drag the bone disc > 60 px with the tongs. **Excise**: one lancet
  touch on the bud. A small `Sigil` (eye) remains beneath each bud — sear it out with the brand.
- Last phase: salve the scalp nick.
- Deviations: the `hornchildCertificate = natural` branch (skip the second bud) needs the
  campaign flag store and is not wired.

### op3-2 "Ball and Wadding" (Kaspar, powder-mill guard)
- Incision → lead `shot` plus three hidden `ClothFragment`s (lens to find, tongs to pull > 50 px).
  Fragments are not required: a surgeon can close without them.
- After closing, `woundFeverPhase()` checks for wadding left in the wound: if any, a `WoundFever`
  spawns (0.8 vitals/s; two 1 s tincture draughts break it) and the leftover is rated MISS.

### op3-4 "Kilnrows Blast" (Jannik, Old Rudi, Wenzel) — three patients on one timer
- Three phases, one hand each: powder burns; mill-iron beside an `Artery` (clamp first);
  glass, a gash and smoke inhalation (tincture site).
- Deviations: the three patients share the one vitals meter and come in sequence; true
  multi-patient support (per-patient vitals, Tab switching) is an engine feature not built here.

### op3-3 "Founder's Colic" (Ute Brandt, bell-founder)
- Four hidden lead deposits (`leadDeposit` = hidden `TinctureSite`): lens, then hold the
  tincture 1 s; each leaves grey bile (`BloodPool('blackbile')`) for the leech-pipe. A founder's
  ulcer (rot) to salve.
- Deviations: tincture colour variants on the mouse wheel are not implemented (one tincture).

### op3-5 "The Crow's Beak" (Berthold, carter) — amputation
- `Amputation`: saw along the marked line with lancet strokes, back and forth — six strokes of
  ≥ 40 px each, −1 vitals per stroke. Three `Vessel`s then bleed: **ligate** with two thread
  crossings (COOL, slow) or **sear** with 0.5 s of brand (GOOD, −5 vitals each: −15 for all three).
- Poppy draught first (tincture site); bone splinters; close the flap.

### op3-6 "The Pieman's Revenge" (Frieda, laundress) — gut-worms
- Drain the flux; three `Worm`s: grab the head with the tongs and draw it 140 px. Tension follows
  pull speed; above 260 px/s the worm tears (BAD, −3) and the head slips back, regrowing for 8 s.
  An anthelmintic draught (tincture site) to finish.

### op3-7 "Lance the Buboes" (Mother Agathe) — quarantine plague
- Six buboes (lance each once, drain pus before salving — existing rules keep the pus off the
  cuts), then plague-rot at spread 1.0 (faster than op1-4's 0.4–0.6).
- Deviations: the candle-only light modifier (vignette following the cursor) is not built.

### op3-8 "The Flagellant's Back" (Brother Ansgar)
- `Agitation` meter at his brow: +3.5 %/s and +25 % per nail extracted. Past 70 % he thrashes:
  field shake and, every 3 s, a jolt that opens a cut and costs 2 vitals. Hold the tincture on his
  brow 0.6 s to calm him (to 0). Four nail shards, then festering welts.

### op3-9 "The Most Hated Avocation" (Inquisitor Stroh) — dentistry
- `Jaw` hazard: a lancet held down in the mouth for > 1 s without working on anything → he bites
  (BAD, −4). Abscess (bubo) to lance and drain; `Molar`: grab with the tongs, rock ±12 px
  sideways three times, then draw it 60 px up; drawn before three rocks, the root snaps (BAD,
  −5) and leaves a tooth fragment to extract. Stroh's interrogation runs through the callouts.
- Deviations: no mid-op VN pause; `strohTooth` flag not written (needs the flag store).

### op3-10 "The Hour of Prime" (Registrar Oswin Tallert) — boss, see **Prime** below.
### op3-11 "The Hour of Terce" (Master Haller) — boss, see **Terce** below; then his burned hands
(hexfire burns: eschar, salve; split skin: thread) and ash-grubs.

## Chapter IV — Sext and None (the Vennmark field hospital)

Field conditions: `RainDrip` (op4-1) drips a small blood pool somewhere on the field every 7 s
(seeded) while work remains. Cart drift and mud-before-thread are not built.

### op4-1 "Quarrel at the Gorget" (Ruprecht, crossbowman)
- `Artery` beside a bolt. Tongs on the vessel clamps it (GOOD). If the bolt comes out unclamped,
  the artery sprays: 1.0 vitals/s plus pooling, BAD. Either way, ligate it with three thread
  crossings once the bolt is out (COOL if it was clamped).

### op4-2 "Tusk and Hoof" (Wendel, convoy guard)
- `Tick`s crawl (28 px/s); pluck with the tongs within 6 s (COOL) or they burrow (MISS, hidden;
  lens then tongs, GOOD). `Contamination` (dung): 0.35 vitals/s until the leech-pipe irrigates
  it for 1.5 s. Hidden horn tip; a pre-burrowed tick; stitch the goring.

### op4-3 "Delver's Lung" (Brakka, of Orsa's crew)
- `Nodule`s grow stage I → II → III every 12 s. Lancet excises stage I (COOL) or II (GOOD); stage
  III must first be cracked with 0.6 s of brand. While any nodule is at stage II+, the patient
  "rallies" (+0.12 vitals/s): the false recovery. `NoCutZone` (the beard): a lancet press inside
  it is BAD and −150 score.

### op4-4 "The Swallowed Strongbox" (Gutram, giant)
- Three successive incisions (thick hide). `Retractor`: drag the muscle flap 80 px aside with the
  tongs; it stays pinned open 15 s, and what lies beneath is hidden while it is closed.
  `Lockbox`: three pins rotate; tap a pin with the tongs when its notch is within ±25° of the top
  to set it (GOOD); a slip is BAD and costs 3 s. Then draw the box out 90 px. The deep layers are
  left to knit; the outer layer is stitched.
- Deviations: the lock is timing-based, not wheel-driven; the retractor is pinned rather than held.

### op4-5 "The Dead Man's Pulse" (Lord Eckbert von Salm) — branch A, save
- Three hidden fang fragments; `StilledHeart` beats every 6 s with a 0.9 s beat window. A 0.8 s
  tincture hold that completes inside a beat restarts it (COOL); outside a beat it is BAD. Two
  restarts break the trance.
- **Slow-pulse vitals** (CON-0155, `slowPulse: 6`): the vitals only move on a beat — the harm between beats
  lands at once, so the monitor steps down instead of sliding. The stilled heart beats with the patient's own
  pulse, and restarting it returns a normal heart.
- **Branch** (CON-0154, NAR-0136): s4-5 asks for the verdict. `deadManVerdict = 'entranced'` runs this op;
  `'dead'` closes it — von Salm is burned, and breathes on the pyre.
- Deviation: branch B as a forensic examination needs the forensic discipline (CON-0243).

### op4-6 "The Thirsted Neck" (Margit, courtesan)
- Tooth fragments, anaemia (base drain 0.25, blood-restoring draught), old bites.
  `BiteChannel`: brand it 0.6 s (the bond burned away; `op.flags` gets `thirst:brand`) or salve it
  (the bond left be; `thirst:salve`). Her stated wish in s4-6 is salve.

### op4-7 "The Hour of Sext" (Captain Mauer) — boss, see **Sext**.

### op4-8 "The Stone Bride" (Hanne) — elite, three fronts: hand, arm, chest
- `PetrifyFront` advances 4–5 px/s along a path toward the heart; numbered stone plates stand
  along it. Tap them with the lancet in order (GOOD); a wrong plate is BAD and surges the front
  30 px. When every plate is cracked, salve the living margin to halt it (COOL). The front
  reaching the heart loses the patient; the Litany holds it still.

### op4-9 "The Hour of None" (Pieter, militiaman) — boss, see **None**.

## Chapter V — Vespers and Compline (Hollow Night)

### op5-5 "Hexstone Shot" (Sergeant Lotte Harrach)
- `HexBall` (hexstone `Embedded`): only the tongs may touch it — any other instrument pressed on it
  is BAD and increments the operation's whisper count (evidence) — and it may be dropped only in
  the lead dish beside the table. It raises `Bud`s (tooth, finger, eye) every 7 s, up to three:
  cut a bud with the lancet within 8 s (COOL if > 4 s left); rooted buds need 0.8 s of brand.

### op5-1 "Choir-Throat" (Jakob, chorister)
- Three `VocalFold`s sing 3 s verses and rest 2 s, staggered. A lancet touch in the rest excises
  (COOL early in the rest); in a verse it is BAD, −3. While any fold sings, every sound cue is
  muted (a `Muffler` swallows the frame's cues); ratings and popups still show.

### op5-2 "The Mouth Beneath" (Dietmar, tanner) — elite
- `Cyst` talks (a line every 9 s: threats to tell the Inquisitor what it knows). Encircle it with
  the lancet (a 330° loop at 0–80 px outside its wall) to free it, then lift it off the table with
  the tongs (COOL). A blade into the cyst, or three tongs pulls before it is free, ruptures it: BAD,
  a pus pool, and a `Remnant` (40 hp) that crawls to the nearest wound — sear it.
- Deviations: its lines are not yet keyed to a Whisper band (no Whisper meter in the game).

### op5-3 "Blood of Tallow" (Greta, chandler's daughter)
- `TallowClot`s: a brief brand touch (≥ 0.3 s) softens a clot; held past 1.2 s it scorches (BAD, −3).
  Then 0.9 s of leech-pipe draws it off. A thinning draught.

### op5-4 "Under the Hollow Moon" (Rosina) — field obstetrics
- Low incision; `Infant`: grip with the tongs and hold still ≥ 0.6 s (not > 2.5 s: too tight),
  then carry it slowly (< 320 px/s) off the table. Any breach is one BAD. The child has its own
  vigour (−0.5/s from 100); at 0 the operation is lost. Two vessels (ligate or sear), then close.
- Sensitivity: tone is hopeful; no gore escalation. Human sign-off required (see handoff).

### op5-6 "The Hour of Vespers" (Sister Ilse) — boss, see **Vespers**. Callouts are voiced as Orsa.
### op5-7 "The Precentor's Remnants" (the Burgomaster's guard-captain) — gauntlet
- Prime, Terce and None in turn, each the full module at `GAUNTLET_HP` = 40 hp; 300 s.
### op5-8 "The Hour of Compline" (Inquisitor Stroh) — final boss, see **Compline**.
### op5-9 "The Office" (Aurel Vennholt, the Precentor) — finale, see **The Office**. 720 s.

---

## The Hours

### Prime — "the Registrar" (`bosses/prime.ts`)
- A quill-mass writes `NameSigil`s (5 strokes; the name is drawn from 40 original names). Each
  stroke takes `strokeTime`; its path is pre-drawn faintly, and the nib glints (with a scratch)
  0.8 s before each stroke. A completed name: −18 vitals, MISS, a shallow cut per letter.
- Erase with the lancet by tracing strokes in reverse order (newest first); a trace of any older
  stroke is BAD (−2). Erasing sets the quill back 2 s; erasing a whole name exposes Prime to the
  brand for 3 s (7 dps). Under the Litany the quill does not write, and every correct erasure is COOL.
- Phase 1 "Roll-Call" (100–60 %): one name at a time, 1.2 s/stroke. Phase 2 "The Ledger" (60–25 %):
  two names, a third below 40 %, 2.4 s/stroke; one quill moves between them after each stroke;
  names near the heart are in red ink and 30 % faster. Phase 3 "Kreuzer" (25–0 %): the surgeon's
  own name (7 strokes) along the top edge; ink blots every 7 s (max 2) — draw off with the
  leech-pipe; any other instrument touching ink is fouled for 3 s; a blot left 8 s becomes a
  3-stroke name. Farming guard: stroke ratings are capped at 36 per operation.

### Terce — "Tongues of Fire" (`bosses/terce.ts`)
- Core hidden in one of three organ zones; it leaps every 5 s (the target zone glows 1 s first,
  with a crackle). Each leap lights a `FlameTongue` (max 3); with three burning, leaps flare into
  hexfire burns (max 2; at most 5 fire patches, and boss + fire stay under 2.2 vitals/s). Salve the flame-front (85 % coverage) then excise the root ember with the
  lancet: −10 % each. Phase 2 "Pentecost" (≤ 65 %): three tongues, each doused within 2 s of the last
  or the doused ones rekindle. Phase 3 "Ash" (≤ 30 %): the core lies bare; heat-haze displaces the
  instruments (not the cursor) by up to 10 px; 1 s of leech-pipe on the smoke clears it for 4 s;
  encircle the core with the lancet (330°) for −10 %; embers kindle new tongues every 9 s.
- The brand on Terce or its tongues heals it 5 %/s and relights salved fronts; the first use earns
  a warning, every further second a BAD.

### Sext — "the Noonday Demon" (`bosses/sext.ts`)
- Torpor: the instruments' lag grows 0 → 250 ms over 20 s; a tincture injection resets it. A ring
  around Sext shows the lag. Phase 1 "Languor": chip six crust plates (two lancet taps each), brand
  what lies beneath (11 dps). Phase 2 "False Noon" (≤ 60 %): the vitals meter settles toward a calm
  70 while the true vitals sink (real drain 1.2/s); the Scrying Lens held over the heart shows the
  truth (HUD and a "true pulse" readout); Ilse warns after 10 s. Sext re-crusts every 10 % hp.
  Phase 3 "Stillborn Hour" (≤ 30 %, again at 15 %): Sext casts its own Stillness — the instruments
  lag 400 ms — until three sun-dials are broken with the brand. The Litany cast during its
  Stillness cancels both and stuns Sext for 4 s (×1.5 damage).

### None — "the Hour of Death" (`bosses/none.ts`)
- A burrower tunnels through organ waypoints toward the heart (seeded paths; no path ever starts
  closer than 8 s of travel). A skin ripple shows roughly where it is; the Scrying Lens tracks the
  head (visible 4 s); a lancet across it brings it up, exposed 3 s for the brand (5 dps). Reaching
  the heart in phases 1 and 3 is instant loss. The Litany freezes it entirely. Abandoned tunnel
  caves in as cuts 10 s later (max 4). A heart-proximity ring pulses as the head nears.
- Phase 2 "Division" (≤ 70 %): three segments race independently; brand each 0.7 s; one reaching
  the heart costs 40 vitals. Phase 3 "Ninth Hour": the shrunken core surfaces; three lancet cuts
  bring it to extraction size; then 2 s to pull it off the table with the tongs, or it regrows one
  stage. The Precentor speaks through the host for the first time in phase 3.

### Vespers — "the Lamp-Lighting" (`bosses/vespers.ts`)
- Four lamps light four quadrants; each burns down over 15 s and relights with 0.3 s of brand.
  An unlit quadrant falls to 20 % brightness, and the wicks in it are hidden (inert).
  Phase 1 "Lucernarium": sever six wick-filaments with a lancet stroke across each (−40 % in all);
  each bleeds a tallow clot (soften with the brand, draw off with the leech). Tallow blood: each
  clot drains 0.1/s; with three or more, a tincture is worth half. Phase 2 "Magnificat" (≤ 60 %):
  the body wanders and takes the brand only where lamplight falls on it; every 12 s it snuffs two
  lamps (they gutter and lean for 1 s first). Phase 3 "Last Light" (≤ 25 %): one lamp remains and
  wanders; trace the wick back from the body to its root with the lancet (75 %), then excise the root.

### Compline — "the Great Silence" (`bosses/compline.ts`)
- Vitals drift toward a "peaceful" nothing (0.25/s). Every 20 s all sound cues are muted for 8 s,
  with a 1 s "[silence]" tell first; visual ratings remain.
- Phase 1 "Examen" (100–70 %): it wears Matins, Lauds and Prime in turn (their own modules:
  `MatinsEcho`, `LaudsEcho`, a `NameSigil`), 25 s each; beating an echo is −10 %.
- Phase 2 "Nunc Dimittis" (70–35 %): it steals the Litany (the medallion cannot be used) and every
  12 s casts it on the surgeon — the instruments lag 300 ms for 5 s. Four silence-nodes: brand
  each 0.8 s (−8.75 % each); all four restore the Litany, usable again even if already spent.
- Phase 3 "Great Silence" (35–0 %): the core yields only to the lancet opening it and the brand
  following within 0.6 s (−8 % each). Every 20 s an echo of Terce, None, Vespers or Sext interrupts
  at about 60 % strength.

### The Office — the final form (`bosses/office.ts`)
- A clock-face of eight hour-sigils around the heart. Phase 1 "Dial": the hand sweeps (1.5 s) to
  each Hour in a seeded order; that Hour's short trial must be cleared to extinguish its sigil
  (Matins echo, a two-Voice Lauds echo, a Prime name, two Terce tongues, four Sext plates, a None
  segment, two tallow clots, two silence-nodes). Phase 2 "Unison": two at once, from
  `UNISON_PAIRS` — Matins+Prime, Lauds+Sext, Terce+Compline, None+Vespers — each pair on
  different instruments (`HOUR_TOOL`) and within a 2.2/s drain budget (tested). Phase 3 "The
  Choir's Heart": trace the eight-stroke conductor-sigil out with the brand. Sister Ilse holds the
  vitals throughout (a tincture every 12 s while below 60; every 10 s at the Heart).

### Voices
Each Hour speaks 10–11 original lines (`bosses/voices.ts`), rising from the curse every 9 s.
