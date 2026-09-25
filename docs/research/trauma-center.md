# Trauma Center series: design research for a mouse-driven grimdark adaptation

Covers *Under the Knife* (DS, 2005; "UtK"), *Second Opinion* (Wii, 2006; "SO", a remake of UtK), *New Blood* (Wii, 2007; "NB"), *Under the Knife 2* (DS, 2008; "UtK2") and *Trauma Team* (Wii, 2010; "TT").

**About the sources.** From the earlier download, `wiki/tc/GUILT.txt` and `wiki/tc/Healing_Touch.txt` were usable wiki text. `sw_guilt.html`, `fandom.html` and `gf.html` are Cloudflare challenge pages with no content in them. `crit.pdf` is a *Warhammer Fantasy Roleplay 4e* critical-hits reference sheet, not a Trauma Center source. It is still useful as flavour for grimdark injuries: Bleeding conditions, minor and major fractures, amputations, "Festering Wound", "Blood Rot". Most of the facts below come from the Caduceus Database fandom wiki (https://traumacentergame.fandom.com, read through its MediaWiki API), Wikipedia, Hardcore Gaming 101, LP Archive and reviews. GameFAQs, StrategyWiki, Neoseeker and the Wayback Machine were blocked from this environment.

**A naming correction.** *Stigma* is the disease in **New Blood**, not in Trauma Team. Trauma Team's pathogen is the **Rosalia Virus** and its final form, **Twisted Rosalia**. The **Neo-GUILT** strains (Nous, Bythos, Sige, Aletheia) belong to **UtK2**. The canonical order of the GUILT strains follows the Greek weekdays: Kyriaki (Sunday), Deftera, Triti, Tetarti, Pempti, Paraskevi, Savato. The Japanese releases swap the names of Triti and Tetarti. (https://traumacentergame.fandom.com/wiki/GUILT)

---

## 1. Core operation loop

### 1.1 Structure of an operation
Every operation has the same frame:

1. A **briefing**: a visual-novel conversation that names the patient, the ailment and the objectives. Example: "Suture any lacerations. Extract fragments of glass" (https://traumacentergame.fandom.com/wiki/Standard_Procedure).
2. **Opening**: disinfect along a guideline with gel, then cut along it with the scalpel.
3. **Treatment phases**: the view moves to organ close-ups, and new waves are scripted to trigger when the last wound of the current wave is treated.
4. **Closing**: suture the incision, apply gel, then apply the bandage along the whole cut.
5. **Results screen**.

HG101 describes the loop as "disinfect the operation site, make the initial incision, then examine the organ in closer view," with several objectives competing at once (https://www.hardcoregaming101.net/trauma-center-under-the-knife/).

Wave progression is a pacing lever. The next phase "will not kick in until the last wound is treated," so experienced players leave one wound open to buy time to raise vitals (https://traumacentergame.fandom.com/wiki/Fever, https://traumacentergame.fandom.com/wiki/Kyriaki).

### 1.2 Vitals
- **Vitals** run from 0 to 99. If they drop below 0, the patient dies and the operation fails (https://traumacentergame.fandom.com/wiki/Vitals).
- Vitals drain continuously. The drain rate is the sum of every untreated problem on screen, and each problem type has its own rate: open lacerations, tumors, polyps, inflammations, Triti membranes, orbiting Pempti cores and so on. In the UtK2 LP: vitals decrease "whenever there's any wound on screen" (https://lparchive.org/Trauma-Center-Under-the-Knife-2/Update%2001/).
- **Burst damage** comes from GUILT attacks, ruptured aneurysms or tumors, and Misses. Using the scalpel also drains vitals slightly while it cuts. In TT this only happens when cutting open hemorrhages (https://traumacentergame.fandom.com/wiki/Surgical_Tools).
- **Ways to restore vitals**:
  - Stabilizer, injected with the syringe: a full injection gives +12 over about one second, or +24 on Easy.
  - Antibiotic gel: a small gain.
  - Naomi's Healing Touch.
  - Resolving a cardiac arrest.
  (https://traumacentergame.fandom.com/wiki/Vitals, https://traumacentergame.fandom.com/wiki/Difficulty)
- **Maximum-vitals cap.** Several systems lower the *maximum* rather than the current value:
  - Each Blue Savato alive caps vitals at 70, 50 or 35 for one, two or three of them.
  - Cardia's red membrane lowers the max permanently.
  - On Extreme in TT, each miss lowers max vitals.
  - A transplant *raises* the cap as each vessel is connected.
  UtK2 shows the cap as a blue bar on the gauge (https://traumacentergame.fandom.com/wiki/Savato, https://traumacentergame.fandom.com/wiki/Transplant).
- **Cardiac arrest.** Vitals are forced to 10 and keep draining until the patient is defibrillated or massaged. In UtK they are held at 1 and the player has 60 s of heart massage; the timer is then restored to its value before the arrest. **Fibrillation** is shown by an abnormal ECG and a yellow vitals gauge. The player must **stop working**: any action during fibrillation is a Miss (https://traumacentergame.fandom.com/wiki/Cardiac_Arrest). This makes "hands off" a skill in itself.

### 1.3 Timer
Most operations have a 5:00 countdown. Boss fights and gauntlets such as Savato (5-9) and five Kyriaki patients in a row (5-2) get 10:00. Short, urgent ones get 3:00, for example the bleeding lung in 2-6 and "Race for the Cure." Running out of time is a failure. The time left feeds the time bonus and the special-bonus thresholds (https://traumacentergame.fandom.com/wiki/Under_the_Knife_(episode), https://traumacentergame.fandom.com/wiki/Just_Let_Me_Die). HG101 notes that the near-universal five minutes is "absurdly long in some cases, and very strict in other cases, particularly the Kyriaki missions."

### 1.4 Per-action grades: Cool, Good, Bad, OK, Miss
- **Cool, Good, Bad** grade actions that have a measurable quality (https://traumacentergame.fandom.com/wiki/Surgery). Examples:
  - An incision close to the guideline.
  - A glass shard pulled out "straight" along its axis (https://lparchive.org/Trauma-Center-Second-Opinion/Update%2001/).
  - A bandage laid from end to end after gel.
  - A tumor exposed *without* locking its ultrasound shadow. In SO and UtK2, using the ultrasound caps the grade at Good, so Cools reward memorising where things are (https://traumacentergame.fandom.com/wiki/Tumor).
  - Cauterising that stops right after the bleeding stops (TT endoscopy).
  - An injection released at the yellow line (TT).
- **OK** marks a successful action that has no quality axis, such as a laser kill or a Pempti core hit.
- **Miss** is an error:
  - Straying off an incision guideline or halting partway.
  - A suture that wanders from the wound.
  - Dropping an object.
  - Using the wrong antigen.
  - Acting during fibrillation or turbulence.
  - Stabilizer injected into Pempti.
  Misses cost vitals, and more so on higher difficulties (https://traumacentergame.fandom.com/wiki/Difficulty).
- **UtK uses a Miss limit.** Reaching it fails the operation. It counts "how many incorrect things you can do, from cutting outside the guidelines to simply putting the bandage on a bit crooked" (HG101).
- **SO onwards uses a Chain.** Cool, Good and OK extend the chain; Bad, Miss and complications break it. Complications include cytoplasm oozing back into a drained tumor and polyps rupturing. The chain feeds "MAX CHAIN over X" bonuses. In NB's Challenge ("Special") mode, even a *Good* where a Cool was possible breaks the chain (https://traumacentergame.fandom.com/wiki/Surgery, https://traumacentergame.fandom.com/wiki/Trauma_Center:_New_Blood). HG101 describes the SO change as "rather than failing for missed actions, the game keeps track of your combo of well-performed actions" (https://www.hardcoregaming101.net/trauma-center-second-opinion/).

### 1.5 End-of-operation scoring
- **Final score** = operation score (the sum of the per-action grade points) + **vital bonus** + **time bonus** + **special bonuses**. In SO the vital and time bonuses are "five points for every point of vitals and every second on the clock" (https://lparchive.org/Trauma-Center-Second-Opinion/Update%2001/).
- **Special bonuses** are specific to each operation.
  - UtK: they total 2000, are hidden, and typically mean no misses, no Healing Touch, and finishing within a time.
  - SO/UtK2: fixed values shown on the results screen, including the ones the player failed.
  - NB: they are **multipliers** on a "Skill score" of vitals + time + chain.
  - Common criteria: X seconds left, X Cools, MAX CHAIN ≥ X, vitals never below X, no mistakes, no Healing Touch, fewer than X blood pools. There are also boss-specific criteria such as "diverticula formed < X", "Triti membrane regenerated < X" and "red vein not touched."
  (https://traumacentergame.fandom.com/wiki/Special_Bonuses)
- **Worked example**, SO 1-1:
  - Bonuses: No mistakes 1000; Vitals above 60/70/75 (by difficulty) 500; Completed with 240/270/275 s left 300; 3/4/6 Cools 200.
  - Rank bands: C ≤4899, B 4900–5099, A 5100–5199, S 5200–5399, XS ≥5400.
  The bands are narrow, so **a rank is effectively set by which special bonuses were earned** (https://traumacentergame.fandom.com/wiki/Standard_Procedure). Boss bands are wider: SO Savato gives S at 13000–17999 and XS at ≥18000 (https://traumacentergame.fandom.com/wiki/Death_Awaits_All).

### 1.6 Ranks
From https://traumacentergame.fandom.com/wiki/Rank:

| Rank | Title | Notes |
|---|---|---|
| XS | Medical Prodigy | Only on Hard, Extreme (NB "Special", TT "Specialist"). Needs every special bonus plus high bonuses. |
| S | Master Surgeon | The highest rank in UtK and on Easy/Normal. |
| A | Senior Surgeon | Usually 3 of 4 special bonuses. |
| B | Specialist | |
| C | Rookie Doctor | A failed NB Challenge gives an automatic C. |
| Pass | (TT only) | The player failed but chose to continue from the failure point. |

TT drops the rank titles and instead plays a short **post-op exchange whose content depends on the rank**.

### 1.7 Difficulty
Difficulty settings were added in SO "based on feedback about the high difficulty of the original" (https://en.wikipedia.org/wiki/Trauma_Center:_Second_Opinion). They scale:
- vitals drain rate;
- how much a Miss costs;
- GUILT speed and HP;
- how fast blood pools form;
- stabilizer strength (×2 on Easy);
- special-bonus thresholds.

TT renames them Intern, Resident and Specialist. NB's "Special" mode carries vitals **between patients** (https://traumacentergame.fandom.com/wiki/Difficulty). NWR praised being able to "bump down the difficulty for a tough operation and then jack it back up for the next one" (https://www.nintendoworldreport.com/review/12463/trauma-center-second-opinion-wii).

### 1.8 Failure presentation
When an operation fails, a senior staff member takes over in a single line, for example "Out of the way, Stiles... I'll take over from here!" (https://traumacentergame.fandom.com/wiki/Standard_Procedure_2). Story failures lead to **bleak epilogue text**. One reads: "Derek Stiles mysteriously disappeared... The burden of the patients' lives turned out to be more than he could bear." TT plays **an unused tape-recorded confession** from the failed doctor. This is ready-made grimdark material (https://traumacentergame.fandom.com/wiki/Game_Over).

---

## 2. Tools: mechanics, gestures and selection UI

Sources for this section: https://traumacentergame.fandom.com/wiki/Surgical_Tools, the NB tutorial scripts https://traumacentergame.fandom.com/wiki/Operation_Pointers_1 through _3, and https://en.wikipedia.org/wiki/Trauma_Center_(video_game_series).

### 2.1 The eight core tools

| Tool | Gesture (DS stylus / Wii pointer) | Rules and resource limits |
|---|---|---|
| **Antibiotic gel** | Hold and brush over an area, painting coverage. A yellow guideline turns blue where disinfected. | Disinfects before cutting; seals small wounds (laser burns, extraction holes); temporarily stops a laceration bleeding; stops small hemorrhage "clouds"; sets synthetic membranes; cements bone fragments; gives a small vitals gain. It also **slows GUILT** (Kyriaki, Cheir, Sige) and can "herd" Deftera, at a vitals cost. The jar depletes with continuous use and refills when idle, until TT. |
| **Syringe** | Hold on a vial to fill (DS: drag upward from the vial), then hold on the target to inject. The **dose is continuous**, e.g. ¼–⅓ syringe per Tetarti hit. | Stabilizer gives +12 vitals per full syringe (+24 on Easy). Continuous stabilizer use empties the syringe (orange, then red, then empty). Per-mission vials: anti-inflammatory (blue), aneurysm sedative (brown), coolant, antigens, serums, nanomachine and others. TT endoscopy: **release at the yellow line**; overdose is Bad and costs vitals. |
| **Sutures** | Hold and **zigzag across** the wound from end to end. UtK needs many passes; later games accept a quick "N" or "Z" for short cuts. | A Bad suture breaks the chain. Straying too far is a Miss. Suture thread *can* run out under extreme Savato spam. |
| **Drain** | Hold over fluid and sweep to widen the area. | Removes blood, pus, mucus and tumor cytoplasm; drains fused Deftera and Soma fluid. Blood pools **block other tools** from working underneath them. |
| **Laser** | Hold on the target. | Burns polyps, small tumors and most GUILT. It runs on a **battery**: if fully drained, it takes about 4 s to swap in a new one, and it recharges during short pauses. Pempti fights swap in the red **Scalar laser**, which has infinite charge. |
| **Ultrasound** | Sweep to reveal shadows; click to lock a shadow for about 5 s. From NB on, shadows show without clicking. | Finds tumors, buried Kyriaki, fluid packets, internal hemorrhages (larger shadow = closer to bursting) and the shapes of bent wires. The Wiimote **pulses** when the cursor is over a Kyriaki shadow that can be cut (https://traumacentergame.fandom.com/wiki/Kyriaki). |
| **Scalpel** | Press at one end of a guideline and drag along it **without stopping**. Short taps expose buried GUILT; tumors are encircled to excise them. | Halting midway or going off-line is a Miss. On Savato's web the blade **melts** after each strand and is out of action for a few seconds while the rest of the kit stays usable. |
| **Forceps** | Grab (Wii: A+B, a "pinch"), pull out **along the object's axis**, carry to the tray and release. Twisting the Wiimote rotates the held piece. | Extracts shards, bullets, excised tumors and dead GUILT. Places membranes, grafts and bone fragments. Pinches large lacerations closed so they can be sutured before they reopen. Pulls vessels into place for anastomosis. Dropping an object is a Miss. |

### 2.2 Situational tools
- **Hands** (UtK): massage a membrane in wide circles for a Cool, and heart massage (https://traumacentergame.fandom.com/wiki/Tumor).
- **Defibrillator**, from SO on. DS: slide the paddles into place, then hold to charge and release. Wii: push both controllers forward, then press B+Z as an oscillating meter passes. The **green** zone revives in one shock; **grey** needs a second (https://traumacentergame.fandom.com/wiki/Cardiac_Arrest).
- **Heart massage** (NB/UtK2): press A+B when two hand outlines overlap, a rhythm-game ring. A Cool counts as 2 pulses and a Good as 1; about 10 pulses are needed. UtK2 instead requires 5 correct in a row.
- **Bandage**: drag it along the closed incision after gel. It only appears in the kit at the end of an operation.
- **Magnifier**: in UtK, draw a "C"; in SO, a single click; in later games, push the pointer to the screen edge to pan.
- **Synthetic membrane**, **skin grafts**, **wire** (a loop around the appendix), **penlight and camera flash** (dark operations, where repeated flashes cost points), **air compressor** (UtK2: blow into the DS microphone to clear Sige's gas) (https://traumacentergame.fandom.com/wiki/Surgical_Tools).

### 2.3 Tool-selection UI
- **DS** (UtK, UtK2): "ten available surgical tools… selected using icons along the edges of the touch screen." The icons sit down both the left and right sides. The top screen shows story, portraits, score, time and the nurse's commentary (https://en.wikipedia.org/wiki/Trauma_Center:_Under_the_Knife, https://en.wikipedia.org/wiki/Trauma_Center:_Under_the_Knife_2). Every tool change means travelling to the edge, which is a hidden time cost. HG101 later called this "awkward side-screen navigation."
- **Wii** (SO, NB, TT surgery): the Nunchuk stick selects from "a radial menu of surgical tools" with 8 directions. A uses most tools; two-button combinations are for "physical" actions: A+B for forceps, B+Z for the defibrillator (https://www.hardcoregaming101.net/trauma-center-second-opinion/, https://en.wikipedia.org/wiki/Trauma_Center:_Second_Opinion). NWR found the wheel faster, but "the zone for each tool is so small that you may not get the right tool until the second or third try" (https://www.nintendoworldreport.com/review/12463/trauma-center-second-opinion-wii).
- **Vials and consumables** are separate targets on screen. The player points at the vial and holds to fill the syringe, so medicine type is chosen by *where you click*, not by the tool wheel (https://traumacentergame.fandom.com/wiki/Operation_Pointers_2).
- **Tool rosters vary per mission.** Stabilizer or gel can be missing, and mission-specific vials and tools appear only where needed.

---

## 3. Standard procedures and ailment types

Each ailment is a small **recipe**: an ordered sequence of tools with a failure mode if the steps are slow or out of order. Recipes are combined and timed against each other.

- **Lacerations**: suture. Gel briefly stops the bleeding. **Large lacerations**: drain, pinch closed with forceps, then suture *before it reopens*; if it reopens it costs vitals (https://traumacentergame.fandom.com/wiki/Laceration).
- **Glass shards, bullets and foreign objects**: widen the entry with the scalpel if needed, pull straight out with forceps, drop on the tray, then gel the hole. A split bullet causes a cardiac arrest in which **defibrillation is forbidden** while metal is still in the heart (https://traumacentergame.fandom.com/wiki/Civil_War). Curved wires need ultrasound to see their shape.
- **Tumors**, via the "Powell Procedure":
  1. Ultrasound; the shadow fades after about 5 s.
  2. Vertical incision across the tumor.
  3. Drain the cytoplasm. If excision comes too late, it oozes back and breaks the chain.
  4. Excise around the edges.
  5. Forceps to the tray.
  6. Synthetic membrane.
  7. Gel (plus a hand massage in UtK).
  8. Laser any polyps that form.
  (https://traumacentergame.fandom.com/wiki/Tumor)
  - **"Unusual" and PGS tumors** are held by 3 blood vessels. Extracting a tumor while *any* vessel is intact regenerates **all** extracted tumors, and cut vessels regrow after a while. This teaches "cut two vessels on each tumor, then finish all of them."
- **Polyps**: laser, then gel the burn.
- **Hemorrhage**: small clouds get gel; pools get drained, and **pools spawn faster next to other pools**. **Internal hemorrhages**: find with ultrasound, incise (costs vitals), drain, suture. A larger shadow means it is closer to bursting (https://traumacentergame.fandom.com/wiki/Hemorrhage).
- **Inflammation**: anti-inflammatory, where one syringe covers several. It forms when pus is left on the organ (https://traumacentergame.fandom.com/wiki/Inflammation). NB adds colour-coded "chemical" inflammations: a sedative makes the colours disappear, and the player must remember them to inject the matching antidote.
- **Thrombi**: ultrasound, pin with forceps (they move), incise, drain (https://traumacentergame.fandom.com/wiki/Dormant_Ability).
- **Aneurysms**, under magnification: brown sedative, cut, extract, drain, reconnect the vessel with forceps, suture. Large aneurysms need a synthetic vessel rotated into place. The final wave is usually 4–5 at once (https://traumacentergame.fandom.com/wiki/Aneurysm).
- **Burns**: inject culture fluid into healthy skin squares, cut grafts, place them on burns (about 4 squares per burn), gel. Burns that wait too long go **black and necrotic**: coolant, excise, remove. Blood pooling under a graft knocks it off (https://traumacentergame.fandom.com/wiki/Burn). Critics called the burn level "infamously tedious" (https://traumacentergame.fandom.com/wiki/Lost_in_the_Flames).
- **Fractures and bone puzzles**: extract splinters, realign the bone with forceps, fit fragments in by rotating them, find the missing piece with ultrasound, cement with gel (https://traumacentergame.fandom.com/wiki/From_Overseas, https://traumacentergame.fandom.com/wiki/Hidden_Peril).
- **Transplants**: inject vasoconstrictor until an incision line appears, cut, drain, pull the vessel to the opening, suture before the drug wears off. Vessels are done in a set order, and the vitals cap rises with each one (https://traumacentergame.fandom.com/wiki/Transplant).
- **Pleural fluid**: ultrasound, excise, drain, gel. It is combined with **turbulence**: acting during a jolt makes a laceration and counts as a Miss (https://traumacentergame.fandom.com/wiki/Miracle_at_9,800ft).
- **Other recipes**: gallstones (laser them while cutting out the gallbladder in steps), appendix (sedative, wire tie, excise), pacemaker leads, valve replacement interrupted by fibrillation, overlapping myocardium closure (TT).
- **Non-medical "operations"** reuse the surgical verbs:
  - Bomb defusal (UtK/SO 3-6): drain water between tanks, remove triggers, cool heating dynamite with gel or stabilizer, laser the correct chips, cut only red wires in 15 s.
  - Lock-picking in a cell (UtK2), by penlight.
  - Nanomachine design puzzles using the forceps (SO 4-7 and 4-9).
  (https://traumacentergame.fandom.com/wiki/Bomb, https://traumacentergame.fandom.com/wiki/Improvising)
- **Environmental modifiers**: darkness (only a positionable penlight lights the field), camera-flash memory rounds, TV-studio flashes, turbulence, multiple patients in sequence with vitals carried over.

---

## 4. The Healing Touch

Sources: https://traumacentergame.fandom.com/wiki/Healing_Touch and the earlier `wiki/tc/Healing_Touch.txt`.

- **Activation**: draw a **star** in one stroke.
  - DS: draw on the touch screen. In UtK the star must be finished **within 3 s** of touching down (https://traumacentergame.fandom.com/wiki/Striving_for_Asclepius). UtK2 lets you hold L or R and then draw.
  - Wii: hold **Z+B** and draw with the pointer.
- **Leniency.** The official guidebook says the recogniser accepts *any single-stroke shape with about three sharp (~90°) corners*, such as a "W", a "Σ", a "butterfly" or an "umbrella". Four-sided shapes do not count. A shape closer to a star lasts longer.
- **Once per operation per doctor.**
- **Duration.** In UtK and SO it depends on how good the star is; later games fix it at about 30 s real time. When a story conversation interrupts, the HT timer **freezes**.
- **Two kinds.** An *instinctive* HT is scripted, can last the whole emergency, and has no cost; it teaches the power in 1-8 and 2-1. A *manual* HT is the player's single use.
- **Variants:**
  - **Slow Time** (Derek, Markus, Hoffman): the world runs at ½ speed on DS and ¼ on Wii. Useful for laceration waves, aneurysm waves and extra time bonus.
  - **Naomi** (SO): no slow-down. Every OK, Good or "Great" gives **+10 vitals** and every Cool **+25**, which rewards chaining quick easy actions.
  - **Anesthesia / Valerie** (NB): **locks vitals** where they are (stabilizer is ignored; only cardiac arrest gets through) and gives **+10 when it ends**. Best used before a known spike such as an aneurysm rupture.
  - **Double HT** (instinctive + manual, or two doctors) **stops time completely**. It is the scripted finisher for Savato and Mutated Savato.
- **Penalties.**
  - UtK: the wiki says a manual HT outside Savato or the tutorial forces a **C rank**. HG101 puts it as "the highest S rank cannot be achieved if the ability is used."
  - SO: "No Healing Touch" is often a 1000-point bonus. Some Hard operations *need* HT to reach XS.
  - TT: HT is effectively removed "to promote greater realism" (https://en.wikipedia.org/wiki/Trauma_Team).
- **Training levels** are separate "operations": draw 5–6 stars with a guide at first and no timer (UtK/SO 2-3, UtK2 4-2 and 2-1, NB T-4). In UtK2, Derek *loses* HT; his training attempts fail on purpose until a story beat restores it (https://traumacentergame.fandom.com/wiki/Losing_Faith). This is a strong way to deliver a mechanic through the story.
- **Criticism.** Drawing the star on the Wiimote was the most-cited control problem: "a major difference between drawing a shape with the DS stylus and drawing in the air... picky about the number of lines" (NWR, SO). In NB it was "still janky" (https://gamecritics.com/brad-gallaway/trauma-center-new-blood-review/).

---

## 5. Boss pathogens, phase by phase

The pattern shared by every GUILT, Stigma and Neo-GUILT fight:
1. Treat the collateral damage (the "pre-GUILT" stage).
2. The pathogen emerges.
3. Hurt it with its specific tool combination while it keeps creating ordinary ailments.
4. An escalated final form.
5. Often a scripted HT or serum finisher.

Each strain teaches **one distinctive rule**.

### 5.1 GUILT (UtK/SO/UtK2)

- **Kyriaki**, "blades" (https://traumacentergame.fandom.com/wiki/Kyriaki):
  - Phase 0: suture the existing lacerations.
  - Phase 1: **Immature Kyriaki** hide in the organ. Ultrasound, then tap the scalpel on the shadow to pull one to the surface (doing so leaves a counter-laceration), then laser.
  - Phase 2: a **Mature Kyriaki** enters with three long lacerations in an **asterisk**. It takes more laser and **dives back in when hit**.
  - UtK2 adds the **Queen**, which lays eggs when it dives. Eggs must be found, excised and extracted, and attacking the Queen while eggs are present makes them hatch.
  - Distinctive: hide-and-seek plus wound spam. UtK caps the number of lacerations, so players *ignore* wounds and gel them instead.
- **Deftera**, "creeping tumors" (https://traumacentergame.fandom.com/wiki/Deftera):
  - Laser the Deftera tumors (they seed mini-tumors) until the pair emerges.
  - A red A-type and a blue B-type wander around. When **opposite types collide** they try to eat each other: drain them then. After the **third drain** they go berserk; excise them and patch with a membrane.
  - **Same-colour collisions** cost vitals and spawn tumors.
  - The first operation has one pair (stomach) and then **two pairs** (lung), a clean way to double the difficulty inside one level.
  - The mutated form bleeds, and blood pools shield it.
  - Distinctive: steering collisions, a positional puzzle.
- **Triti**, "contagious nightmare" (https://traumacentergame.fandom.com/wiki/Triti, https://traumacentergame.fandom.com/wiki/Forbidden_Knowledge):
  - A grid of triangular membranes, each corner pinned by a thorn. Pull thorns straight up with forceps, then peel the membrane (UtK also needs a scalpel cut).
  - **Spread rules:** a membrane grows back on any free edge between two linked thorns, and a lone membrane with a thorn spawns three neighbours.
  - Thorns regrow on a timer that depends on how many membranes remain.
  - Thorns can dissolve into a **mist** that must be drained. If mist **escapes the field, the operation fails instantly**.
  - A tinted "blue/purple" membrane does extra damage. A "scream" plays whenever Triti spreads.
  - Distinctive: a spatial logic puzzle where the time limit is the main threat. Players worked out a "block by block" solution. It confused reviewers, one of whom "couldn't wrap my head around how it spread" (https://mybrainongames.com/2021/12/17/trauma-center-under-the-knife-nintendo-ds-review/).
- **Tetarti** (https://traumacentergame.fandom.com/wiki/Tetarti):
  - Pre-phase: 3 swelling **diverticula** (V purple, P green, H yellow). Inject the matching antigen and excise before they are fully grown, or they release toxic gas.
  - Mature: three bodies **flash their colours briefly as they emerge**. Remember them and inject the matching antigens. The first injection starts a **hidden timer**; if all three aren't done in time, they submerge and reset.
  - A wrong antigen creates a new diverticulum.
  - Mutated forms: never show colours (the player reads the colour of their toxic mist instead); UtK2 adds blue and black colours.
  - The story wraps it in an antigen-collection level: up to 5 random patients across the city until 3 antigen types are found (https://traumacentergame.fandom.com/wiki/Race_for_the_Cure).
  - Distinctive: memory plus a colour-matching race.
- **Pempti** (https://traumacentergame.fandom.com/wiki/Pempti):
  - A gelatinous mass. Two **nanomachine** injections expose the core; then the red Scalar laser.
  - The core regenerates and cycles three mini-core attacks:
    - **Pink**: dash to the edge, pause, then make a **laceration** unless lasered first. 5 per wave, sometimes 10.
    - **Blue**: 5 extend across the organ and leave **polyps**. If they pass over existing polyps, those **rupture** (vitals loss, chain break).
    - **Grey**: 5 orbit the core and deal damage that grows with their number and time alive.
  - The first cycle is a **demonstration** (each attack once, core invulnerable). After that the order is random and the core **surfaces only when attacking**. Scoring an OK on it stops the current attack.
  - Mutated (UtK2): **splits into two cores**. When one dies, the other goes red and uses two attack types at once. On X-3 the two cores have *different HP* to punish players who split damage evenly.
  - Story delivery: a **research arc** across chapter 4. 4-6 is an exploratory operation that follows Victor's orders; 4-7 is a nanomachine puzzle; 4-8 is a partial success that has to be aborted; 4-9 is another puzzle; 4-10 is the real fight. The patient, the Director, dies of the strain anyway (https://traumacentergame.fandom.com/wiki/Taking_a_First_Step, https://traumacentergame.fandom.com/wiki/Doctors%27_Struggle).
  - Distinctive: a bullet-hell-style **interception** fight where the laser is almost never off. Players regard it as the franchise's classic difficulty wall; forum threads like "Can somebody help me with Pempti?" are common (https://www.neoseeker.com/forums/32568/t1156586-somebody-help-with-pempti/).
- **Paraskevi**, "arrow to the heart" (https://traumacentergame.fandom.com/wiki/Paraskevi, https://traumacentergame.fandom.com/wiki/Infection):
  - A worm. Laser the **tail** to stun it, then **slice it in half** with the scalpel. Each half makes two lacerations.
  - Repeat until 16 segments (4 halvings), then stun and extract each.
  - Any segment left alone **burrows into the next organ**: small intestine, stomach, liver, then **heart = instant death**. SO adds a tail-wag warning cue.
  - Distinctive: the operating field moves between organs as a fail-forward "lives" system. Splitting is exponential risk, so players focus on one piece at a time.
- **Savato**, "face-off with death" (https://traumacentergame.fandom.com/wiki/Savato, https://traumacentergame.fandom.com/wiki/Death_Awaits_All):
  - Phase 1: a **web** around the heart. Cut the strands with the scalpel; the blade **melts** after each strand. Cut the top strand first or two new ones appear. A web left alone turns red and drains heavily. It is rebuilt 3 times, and new strands spawn 4–10 mini-Savato.
    - Too many minis clump into a **Blue Savato**, which cuts current *and* max vitals.
    - Leftover minis merge back into the main body.
  - Phase 2: laser off its coat, **stab once with the scalpel**, and it regrows the coat. Do this 3 times while it makes triple lacerations and spawns minis.
  - Phase 3: it absorbs the minis and becomes slow. Inject the **black serum** (vitals must be above 30 first). It goes berserk: vitals drop to 30, 9 lacerations, then 5 at a time, too fast to target.
    - The automatic HT kicks in with no time limit. The player's saved manual HT then **stops time** to deliver the final dose.
  - Distinctive: a three-act boss with a tool-denial mechanic (the melting scalpel) and a finisher that pays off saving the HT all game.
- **Bliss**: the eighth strain, inside Delphi's leader. It is story only and never operated on.
- **Mutated and remixed strains**: late chapters bring back each strain in mutated form (Mutated Kyriaki, Triti, Tetarti, Savato). UtK chapter 6 is a **boss rush**: one operation per strain on the child "Sinners." SO 6-6 and 6-7 show GUILT **turning into other strains** mid-operation (https://traumacentergame.fandom.com/wiki/Episodes/Under_the_Knife, `wiki/tc/GUILT.txt`).

### 5.2 Stigma (New Blood)
Source pages: https://traumacentergame.fandom.com/wiki/Stigma and each strain's page.
- **Cheir**: a Kyriaki analogue with 3–4 waves. Two fuse into a **Fused Cheir** that cuts a 6-laceration asterisk. The laser pushes it back, so players can shove it off the organ or park the beam in its path. It is briefly immune after an OK.
- **Soma**: a blue fluid blob that sheds red tumors. Draining it exposes the core, which leaves a **ring of tissue that must be drained before it hardens**; the core must be lasered to an OK in a time window. Later it **splits into a decoy**; the real one flashes green and is the only one making tumors. An unhandled decoy bursts into a star of tissue.
- **Ops**: a central sphere fed by two invulnerable spawners that shoot **nutrients**. Blue nutrients are drained; red ones are lasered. If Ops absorbs one, **every tumor on the organ bursts**. Distinctive: a tower-defence style interception with a two-tool split.
- **Onyx**: hidden and found by ultrasound; it creates clones. The real one has **4 dots in a square** and clones have **3 in a triangle**. Cutting a clone, or taking too long, triggers a 5-laceration star. Mutated Onyx releases a vision-blocking "poison web" that also *reveals* every Onyx.
- **Brachion**: a core with grappler arms. Toxin travels down the arms; **pinching an arm segment** sends it back to the start. Players plan pinches while extracting grapplers (14, or 17 on X). If toxin reaches a grappler, the extracted ones regenerate.
- **Cardia**, the final boss:
  - Phase 1: excise a membrane while it roams inside a shell. **Red sections** lower max vitals. Repeat 3 times.
  - Phase 2: it dashes around making lacerations and small tumors (removed with forceps), then **emits ripples that detonate tumors**.
  - Last stand: a **ring of 20 tumors** and a central vulnerable window, which is where HT is used.
  - A second boss theme with a Latin choir starts on the phase change.

### 5.3 Neo-GUILT (UtK2)
Source: https://traumacentergame.fandom.com/wiki/Neo-GUILT. Each emergence and each defeat causes a convulsion.
- **Nous**: spore tumors must be drained and excised **in the order they appeared**. Out of order, all earlier ones burst for 30–35 each (65 on X). A hidden timer makes Nous dive if too slow. It takes 5–6 "hits."
- **Bythos**: lacerations and "warp" hemorrhages. Lasering breaks the shell into **orbiting spores**. The core must be **carried to the tray without touching any spore or shard**, a steady-hand maze. The core goes blue, then purple, then red over repeated extractions. At most 8 lacerations exist at once.
- **Sige**: while buried, its gas pressurises the organ, which must be **vented with the scalpel** or it bursts. Excising it releases fog that the player *blows away* with the microphone. It races around leaving pus; freeze it with gel and then cut it (5–6 hits). Its clones punish wrong cuts.
- **Aletheia**, the final boss: merged with the heart, it **summons waves of other strains**.
  - Stage 1: Kyriaki, Nous, Pempti. Stage 2: Sige, Tetarti, Kyriaki. Stage 3: Bythos, Sige, Pempti.
  - After each kill there is a one-second window to inject black antibiotic. Enough damage opens its eye, showing **8 vessels** to sever **without touching the red one** (−30 and a phase reset).
  - Final stage: the red vein switches rapidly and touching it is **instant death**. HT is required, and in this stage it has no timer.
  - Distinctive: a **boss rush inside a boss** (https://traumacentergame.fandom.com/wiki/Aletheia).

### 5.4 Rosalia and Twisted Rosalia (Trauma Team)
Source: https://traumacentergame.fandom.com/wiki/Rosalia_Virus. The virus shows up in every discipline with a different verb:
- **Surgery**: claw-shaped foci. Drain mucus, blue vasoconstrictor, orange deactivator, excise. Foreign bodies drift through the vessels; if they touch a focus, its treatment **resets**.
- **Endoscopy**: colonies **burst if touched** and spread a bruise. Spray antiviral first, and inject equal amounts into each segment of a giant colony.
- **First Response**: a white reagent reveals a colour after a delay, and the player injects the matching antiviral. Convulsions happen across several patients.
- **Orthopedics**: foci whose supporting vessels must be severed along *moving* paths.
- **Twisted Rosalia**, the finale:
  - Four heart chambers, each harder by one step: one more extension, one more shell piece, one more gelator site. Shell fragments cause lacerations and leave shards; drifting colony cells must be drained.
  - Then **stop the heart with cardioplegic solution**. Vitals *and* the cap plunge. Excise the membrane and deliver about 2 syringes of antiserum.

---

## 6. Trauma Team's six disciplines

Sources: the fandom pages for each field and https://en.wikipedia.org/wiki/Trauma_Team.

- **Surgery** (CR-S01): the classic loop with more guidance, lower difficulty, and "Pass" continues after failure. The Healing Touch is gone. In co-op, tools are split so each player holds 3–5.
- **Orthopedics** (Hank):
  - There are **no vitals and no timer**. Instead there is a mistake budget: 10 per the wiki, "five hearts" per Wikipedia.
  - Each step pre-selects the tool; the player just executes:
    - **scalpel and laser cutter**: trace a guide; releasing breaks the chain; the laser cutter is confined to a circle and must avoid "static" and bone sparks;
    - **drill**: steer toward a guide, where speed depends on how far the cursor is from the drill;
    - **screwdriver**: it spins down after release, and over-tightening is a Miss;
    - **hammer**: swing the Wiimote, where swing speed sets the force and fewer swings score more;
    - **saw**: twist to angle it;
    - **stapler**: twist to align.
  - **The chain grows continuously while tracing close to the line**; Good and Cool add +50 and +100. Designed as the "easier, precision" contrast mode.
- **Endoscopy** (Tomoe):
  - The only fully 3D mode. A+B plus a push or pull motion moves the scope; the stick aims the camera; the pointer is a flashlight.
  - Hitting walls costs vitals. A radar shows targets. Peristalsis pushes the scope back and blocks tools. Gates track the branches already explored.
  - Tools come from a C-button palette of 8, selected by tilting the Nunchuk; Z uses them: snare, hemostatic forceps (stop just as the bleeding stops), syringe (release at the line), spray and others.
  - Critics found the controls awkward.
- **First Response** (Maria):
  - **Up to 5 patients at once**, switched with markers at the top of the screen. Each has triage-coloured **tags that fall off as vitals drop**.
  - A patient's death does not end the level, but there is a death limit.
  - Tools: gauze and tape instead of sutures, absorbent gauze instead of a drain, splints, IVs, scissors, tourniquets, hydraulic cutters for steel beams, CPR by **swinging the Wiimote**, intubation, bandages wound on by drawing circles, and "Talk" to patients for clues and medals.
  - Seen as a fast, well-liked variant: a triage game.
- **Diagnosis** (Gabriel): point-and-click symptom spotting.
  - Interview (flag statements), stethoscope (toggle between the patient's sound and a normal one; audio can come through the Wiimote speaker), blood panel, ECG (toggle against a healthy trace), visual inspection, and CT, MRI and X-ray comparison.
  - Then **drag symptoms onto disease descriptions** in RONI's database.
  - 5 mistakes allowed; no rank. It got mixed reviews for pacing.
- **Forensics** (Naomi): crime scenes (magnifier, ALS light that *rings* when it finds something, luminol, fingerprint powder), corpse and skeleton reconstruction, evidence cards **combined into "Solid Evidence"** (inspired by Megami Tensei's demon fusion), testimony tapes, and a final accusation where the player picks the evidence. 10 mistakes allowed. Praised for its style, though some found it repetitive.
- **Structure**: six parallel campaigns of about 5–6 playable episodes each, **playable in any order and interleaved**, then a 13-episode "Patient Zero" finale that switches between disciplines. Kotaku praised it as rare non-linear storytelling. Doctor Medals (8 per doctor) are secret mastery challenges, e.g. "100% COOL rating on one surgery operation" (https://traumacentergame.fandom.com/wiki/Doctor_Medals).

---

## 7. Narrative structure, pacing and onboarding

- **Format.** Chapters are made of numbered episodes (e.g. 3-4). Story-only VN episodes are interleaved with operations. The DS top screen or a Wii overlay shows portraits and text; the nurse gives instructions during operations. Voiced shout-outs appear in UtK and SO, NB is fully voiced, and TT uses a voiced **motion comic** with about 15,000 lines (https://en.wikipedia.org/wiki/Trauma_Team). SO added a **Skip** option for mid-operation dialogue (https://traumacentergame.fandom.com/wiki/Trauma_Center:_Second_Opinion).
- **Operations per chapter**, counted from the episode lists (https://traumacentergame.fandom.com/wiki/Episodes/Under_the_Knife and the equivalent pages for the other games):
  - UtK: 6 chapters with 6, 6, 5, 7, 6 and 7 operations; 2–5 story-only episodes per chapter; 7 X missions.
  - SO: adds one Naomi "Z" operation to each of chapters 1–5 and rewrites chapter 6 (5 operations).
  - NB: 7 chapters with 5–8 operations each, 4 in-story tutorials ("Operation Pointers"), 4 Challenge operations (A-1 to A-4) and 6 X missions.
  - UtK2: 7 chapters with 5–6 operations each, plus 7 X missions.
  - TT: 6 doctors with about 5–6 episodes each, plus the finale.
- **Onboarding curve** (UtK/SO):
  - 1-1: gel, scalpel, forceps, sutures, bandage.
  - 1-2: ultrasound, drain, stabilizer (the Powell procedure).
  - 1-3: anti-inflammatory, and **no more step-by-step instructions**.
  - 1-5: magnifier and polyps.
  - 1-8: cardiac arrest, plus a **first taste of the scripted Healing Touch**.
  - 2-1: thrombi, with an instinctive HT.
  - 2-3: HT training.
  - 2-4: aneurysm wave, where HT is effectively required.
  - 2-6: large lacerations.
  - 2-9: **first GUILT (Kyriaki)**, about a third of the way through.
  - Then one new strain every chapter or so, each introduced "one pair, then two pairs" within its first operation (https://traumacentergame.fandom.com/wiki/Something_Precious).
  - Chapter 5 remixes the strains as mutated versions plus a **5-patient Kyriaki gauntlet** in 10 minutes. It has a mercy rule: after patient 3, backup arrives and a timeout is no longer a loss (https://traumacentergame.fandom.com/wiki/Under_the_Knife_(episode)).
  - Chapter 6 is a boss rush of all seven strains; the finale is Savato or the Aletheia rush.
  - UtK2 and TT open with **an operation that is itself the tutorial** (https://traumacentergame.fandom.com/wiki/Refugee_Camp, https://traumacentergame.fandom.com/wiki/Frozen_in_Time).
- **Variety beats** break up repetition: bomb, turbulence, darkness and penlight, puzzles, TV studio, kidnap operations, multiple patients in a row.
- **Post-game**:
  - **X missions**: one per boss strain on Extreme. Faster drains, more bodies, more HP, and one rule twist per strain (e.g. Paraskevi vitals capped at 50 and −30 per cut in SO; Onyx lets you find it in about 7 s and then deals 70 damage) (https://traumacentergame.fandom.com/wiki/X_missions).
  - **Challenge mode** replays for score (UtK).
  - NB's **Challenge** series of consecutive operations with vitals carried over, plus online leaderboards.
  - Co-op in NB and TT.
  - TT's Medals.

---

## 8. Presentation, UI, audio and critical reception

- **Visuals.** Anime portraits over a stylised but bloody organ view. HG101: "patients' outer bodies are essentially Barbie dolls, but with internal organs that are three-dimensional, realistic, and bloody"; the palette is mostly browns and reds. The developers deliberately avoided both extreme realism and cartoonishness (https://en.wikipedia.org/wiki/Trauma_Center:_Under_the_Knife).
- **HUD language**: a vitals number with an ECG trace (turns yellow on fibrillation; a max cap is shown), a countdown timer, the current tool, graded popups (Cool/Good/Bad/Miss/OK), a chain counter (SO onwards), a nurse portrait with a text box, and tray and vial targets on the field. SO lacked 16:9; NB added it.
- **Audio** (https://www.hardcoregaming101.net/trauma-center-under-the-knife/, https://en.wikipedia.org/wiki/Trauma_Center:_New_Blood):
  - Meguro, Tsuchiya and Kikkawa's synth, piano, guitar and string score.
  - Operation themes that intensify for boss fights; Cardia's second phase adds a Latin choir.
  - Short voiced **shout-outs** during operations (ten times more in SO than UtK).
  - Diegetic stings: Triti's "scream" as it spreads, the ALS ring, the Wiimote pulse on a Kyriaki shadow, stethoscope audio through the controller.
- **What critics praised**:
  - The touch and motion controls as the core idea: "antibiotic to the industry's stagnate design dogmas" (Game Informer), "balancing of narrative and arcade-style gameplay" (GameSpot).
  - SO's controls and difficulty options.
  - NB's co-op.
  - UtK2's polish and Easy mode.
  - TT's variety and its interwoven story (https://en.wikipedia.org/wiki/Trauma_Center_(video_game_series)).
  - Edge's point: the Wiimote is an "ideal laser simulator" but "the stylus was a superior choice for slicing and stitching" (https://en.wikipedia.org/wiki/Trauma_Center:_Under_the_Knife_2).
- **What critics criticised**:
  - **Difficulty spikes.** Cited for UtK and by several outlets for SO. NB was "nearly impossible, even on the easiest setting" solo (Gamecritics rated it 7 with a partner and 4 alone). One UtK reviewer gave up with "stylus-induced tendinitis" on the final surgery (https://gamecritics.com/brad-gallaway/trauma-center-under-the-knife-review/).
  - **Trial and error**: players "fail over and over until they luck into the solution" (Pocket Gamer); "confusing or arbitrary mechanics" (Eurogamer).
  - **Repetition and low early variety**: "most of the surgeries are either finding and removing tumors or treating a large number of lacerations" (HG101). UtK2 was called "a complete rehash" (NWR).
  - **Too much text**, with slow cutscenes that must be clicked through again after every failure (https://www.nintendolife.com/reviews/2006/08/trauma_centre_under_the_knife_ds).
  - **Motion precision**: star drawing, small tool-wheel zones, awkward endoscopy. There were also DS stylus registration misses and suture targeting of the wrong laceration (HG101).
  - **"Lack of room for improvisation"** (https://en.wikipedia.org/wiki/Trauma_Center:_Under_the_Knife).
- **Atlus's own fixes in TT** confirm these complaints. They discarded "the often-strict victory conditions and lack of clarity about loss conditions," lowered surgery difficulty, and added other disciplines to address "fatigue with players experiencing only surgery" (https://en.wikipedia.org/wiki/Trauma_Team).

---

## 9. Translating stylus and Wiimote controls to mouse and keyboard

1. **The mouse is closer to the stylus than the Wiimote is.** Edge rated the stylus best for slicing and stitching and the Wiimote best for the laser, and a mouse is good at both. **Precision will be higher and cursor travel faster** than in the originals, so re-tune the Cool, Good and Miss tolerances and the time limits for a mouse. Don't copy DS numbers. Define tolerances in virtual-view pixels, not device pixels, so they don't change with DPI.
2. **Tool selection should never pull the cursor away from the work.** DS edge icons had a hidden travel cost; the Wii wheel was fast but mis-selected. On PC, use number-key hotkeys, mouse-wheel cycling, a **quick-swap to the last tool**, and optionally an RMB-hold radial at the cursor. Keep clickable icons for new players. If some friction is wanted, add a very short "hand-off" animation instead of cursor travel.
3. **LMB-hold = "A"**, the tool is active. Keep the **continuous-stroke rules**: halting a cut mid-line is a Miss (or breaks the chain), and so is straying from it. For the **forceps "pinch" (A+B)**, use LMB-hold with the tongs, or a separate grip key. Map **Wiimote twist** to the mouse wheel or Q/E while holding. Grade extraction by the **drag vector compared with the object's axis**, as the originals did.
4. **Sutures.** Accept a short N or Z for small wounds (UtK2 and later), not UtK's long zigzags. Reviewers blamed suture-heavy levels for wrist strain and tendinitis, and mouse scribbling is just as tiring.
5. **The star gesture needs a lenient recogniser.** Atlus's own guidebook shows it accepted any single stroke with about three sharp corners and scaled the *duration* by how star-like it was. On Wii the strict recogniser drew the most complaints. For mouse: add a hold-to-draw modifier as the equivalent of Z+B (so an accidental gel stroke never triggers it), a short draw window (UtK used 3 s), a quality grade that affects duration, and a keyboard alternative for accessibility.
6. **Rhythm and force gestures.** Wiimote swings (CPR, hammer), Nunchuk pushes (defibrillator), shaking (bandage) and blowing into the microphone (Sige fog) become:
   - **timing clicks** on an oscillating meter, where green revives in one shock and grey needs another;
   - **drag-velocity** measurement, a quick downward flick with speed as force;
   - **circular scrubbing** for bandaging;
   - a **held key** for the "bellows."
   Keep the same pass and fail windows.
7. **Syringe dose as hold duration.** Fill by holding on a vial (or holding a key so the cursor doesn't move), inject by holding. Show the fill level at the cursor, because dose accuracy (¼ versus ⅓ syringe; release at the line) is the skill being tested.
8. **Panning and zoom.** Use edge-scroll, WASD or middle-mouse drag instead of the DS "C" gesture or edge push. Keep the field on one screen where possible; the originals reset the zoom per phase.
9. **Feedback that replaces rumble.** Change the cursor and play a soft tick when hovering a hidden target that can be cut (as the Wiimote pulse did), and give strong audio and visual stings for Cool, Miss and a broken chain.
10. **Respect the "hands off" beats.** Fibrillation and turbulence are good tension beats, but make the warning unmistakable: an ECG flash plus a sound. Consider locking tool input briefly instead of charging a Miss for the first click.
11. **Pause and information.** Players paused during Aletheia's colour flash to study it. Decide whether pause should hide the field.
12. **Trim the frustration the reviews list.**
    - Skippable briefings, auto-skipped when retrying.
    - A retry-from-phase option ("Pass"-style) with a capped rank.
    - Visible special-bonus criteria.
    - Clear loss conditions.
    - Difficulty that can be changed per operation.
    - Tell the player the spread and memory rules instead of making them discover them by failing (Triti).
13. **Grimdark mapping.** GUILT's weekday naming maps neatly onto a canonical-hours naming scheme, and the Healing Touch onto a litany or sign. The originals' bleak failure epilogues and "the patient dies anyway" beats (the Pempti arc) already suit the tone.

---

### Primary source URLs
- Caduceus Database (fandom): https://traumacentergame.fandom.com/wiki/Surgical_Tools, /Healing_Touch, /Rank, /Vitals, /Special_Bonuses, /Difficulty, /GUILT, /Kyriaki, /Deftera, /Triti, /Tetarti, /Pempti, /Paraskevi, /Savato, /Stigma, /Neo-GUILT, /Aletheia, /Rosalia_Virus, /Orthopedics, /Endoscopy, /First_Response, /Diagnosis, /Forensics, /X_missions, /Episodes/Under_the_Knife and the individual episode pages cited inline.
- Wikipedia: https://en.wikipedia.org/wiki/Trauma_Center:_Under_the_Knife, /Trauma_Center:_Second_Opinion, /Trauma_Center:_New_Blood, /Trauma_Center:_Under_the_Knife_2, /Trauma_Team, /Trauma_Center_(video_game_series).
- Hardcore Gaming 101: https://www.hardcoregaming101.net/trauma-center-under-the-knife/, https://www.hardcoregaming101.net/trauma-center-second-opinion/.
- Reviews and Let's Plays: https://www.nintendoworldreport.com/review/12463/trauma-center-second-opinion-wii, https://gamecritics.com/brad-gallaway/trauma-center-new-blood-review/, https://gamecritics.com/brad-gallaway/trauma-center-under-the-knife-review/, https://www.nintendolife.com/reviews/2006/08/trauma_centre_under_the_knife_ds, https://mybrainongames.com/2021/12/17/trauma-center-under-the-knife-nintendo-ds-review/, https://lparchive.org/Trauma-Center-Second-Opinion/Update%2001/, https://lparchive.org/Trauma-Center-Under-the-Knife-2/Update%2001/.
