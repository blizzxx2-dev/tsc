# 05 — Narrative & Content

Workstream prefixes: **NAR** (story, writing, characters, lore, barks, IP/tone/sensitivity review) and
**CON** (operations and other disciplines, content pipeline, challenge set, authoring QA, demo end flow).
Scope follows `_brief.md`: `Demo` = Chapters 1–2 (Matins, Lauds; 10 operations) at release quality;
`Alpha`/`Beta`/`Release` = Chapters 3–5 and the full game; `Post` = after 1.0.

Existing script: `src/content/chapter1.ts` (Prologue, s1-2…s1-end; ops op1-1…op1-5), `src/content/chapter2.ts`
(s2-1…s2-end; ops op2-1…op2-5), `src/content/characters.ts` (cast), `src/content/story.ts` (Line/StoryDef).

**Campaign outline (target):**
| Ch | Title | Setting | Boss hour(s) | Host patient |
|---|---|---|---|---|
| I | The Hour of Matins | Hospice of Saint Ildra, Kessendorf, winter night | Matins | Emmerich, page-boy |
| II | The Hour of Lauds | Watch muster camp, Timber Road / Grauwald | Lauds (antiphonal pair) | Jorg, standard-bearer |
| III | Prime and Terce | Foundry quarter (the Kilnrows), plague quarantine, bridges raised | Prime, Terce | Registrar Oswin Tallert; Master Haller |
| IV | Sext and None | Field hospital with Kessendorf's hired companies in the eastern Vennmark marches | Sext, None | Captain Mauer; Pieter (Ch1 militiaman) |
| V | Vespers and Compline | Kessendorf on Hollow Night; Kreuzer's trial | Vespers, Compline | Sister Ilse; Inquisitor Stroh |

Antagonist: **the Precentor** (Aurel Vennholt), a guild surgeon struck from the rolls by Haller twenty years ago, who
believes the completed Office will "still" all suffering: Compline is "a quiet night and a perfect end" for the whole city.

## NAR · Epic 1 — Canon, tone and IP safety (Demo foundation)

### Story bible and style guide
- [x] NAR-0001 · Demo · P0 · M · Write `docs/narrative/style-guide.md` — six pillars (mercy, body-as-battlefield, every miracle is evidence, gallows humour at institutions, material honesty, institutions as antagonists) each with 2 do/2 don't example lines from the Ch1–2 script
- [x] NAR-0002 · Demo · P0 · S · Humour rule in style guide — "jokes target institutions and folk belief, never the patient's suffering"; every Ch1–2 joke line audited against it and listed with pass/fail
- [x] NAR-0003 · Demo · P1 · S · Diction rules — early-modern register without thee/thou; banned modern words list (okay, stress, germs, infection-as-germ-theory, adrenaline); lint script flags them in `src/content/*.ts`
- [x] NAR-0004 · Demo · P1 · S · Line-length rule — VN lines ≤ 140 chars, barks ≤ 60 chars, callouts ≤ 28 chars; Vitest content test fails on violations
- [x] NAR-0005 · Demo · P1 · M · Story bible `docs/narrative/bible.md` — Kessendorf (free city, Burgomaster, council of guild-houses), the Long Muster, Saint Ildra and the Merciful Order, the Ash Tribunal, the Hollow Choir, the eight Hours; one page each
- [x] NAR-0006 · Demo · P1 · S · Calendar and dating convention — "year N of the Long Muster", month names, Hollow Night date; used consistently in Prologue and codex
- [x] NAR-0007 · Demo · P1 · S · Timeline of Ch1–2 — day/hour of every scene (Prologue → s2-end) in a table; scene `place` strings match it
- [x] NAR-0008 · Demo · P1 · S · Medical-lore primer — humoral theory as the characters believe it vs what the mechanics do (drain, salve, brand, tincture); 1 page for writers
- [x] NAR-0009 · Demo · P2 · S · Map sketch of Kessendorf and environs — hospice, Tanners' Rows, gunsmiths' quarter, Gilded Goose, east-gate pyres, Timber Road, Grauwald, barrow-fields; referenced by codex entries
- [x] NAR-0010 · Alpha · P1 · M · Extend bible to Ch3–5 locations — Kilnrows foundry quarter, the Raised Bridges, Guildhall of Barber-Surgeons, Vennmark marches, Hollow Night processions, the Tribunal court

### IP-safety review (every name)
- [x] NAR-0011 · Demo · P0 · S · Rename "Order of the Pyre" to "the Ash Tribunal" (Paizo Pathfinder collision) — update `characters.ts` title and STORY_1_4/STORY_1_5 lines ("The Tribunal does not distinguish between a prayer and a spell")
- [x] NAR-0012 · Demo · P0 · S · Remove green hexstone — STORY_2_2 "The rock went green" rewritten to "black as a wet eye, and it had a pulse"; art ticket raised for black-glass-with-heartbeat look
- [x] NAR-0013 · Demo · P0 · S · Rename `'warpshard'` embedded kind to `'hexshard'` in `chapter2.ts` and entities — no "warp-" coinages anywhere; grep test asserts zero matches for /warp/i in src
- [x] NAR-0014 · Demo · P0 · M · Name register `docs/narrative/names.csv` — every proper noun in Ch1–2 (people, places, orgs, items, diseases) with origin note, IP-check status and checker initials
- [x] NAR-0015 · Demo · P0 · S · Blocklist test — Vitest scans `src/content` and localisation strings against the §7 avoid-list (Sigmar, Shallya, Morrslieb, Skaven, turnskin, swain, Nurgle, Reikland, etc.) and fails on any hit
- [x] NAR-0016 · Demo · P0 · S · Review "beast-folk"/"horned raiders" (STORY_1_2) against GW "Beastmen" — replace with "horned folk" and give them one original cultural detail (antler-tallies) in codex
- [x] NAR-0017 · Demo · P1 · S · Review "dwarf" usage for Orsa (STORY_2_2) — keep generic word, strip any grudge/rune/slayer/beard-oath tropes; add original "debt-knots in the beard" detail
- [x] NAR-0018 · Demo · P1 · S · Review "Gravehound" and "corpse-eaters" (STORY_2_1) — confirm not GW unit names; document in names.csv
- [x] NAR-0019 · Demo · P1 · S · Collision check for place names Kessendorf, Weissburg, Grauwald, Tanners' Rows, Gilded Goose — search games/novels; rename any exact fantasy-IP hit
- [x] NAR-0021 · Demo · P1 · S · Trauma Center term sweep — no GUILT, Healing Touch, Caduceus, Delphi, strain names, "Angie" in any string or code comment shipped to players
- [x] NAR-0023 · Demo · P2 · S · Saint names register — Saint Ildra plus any saint invoked in barks; emblem is a candle-and-key, never dove or bleeding heart
- [x] NAR-0024 · Alpha · P0 · M · IP review of all Ch3–5 names — Kilnrows, Vennmark, Precentor Aurel Vennholt, Registrar Tallert, etc.; logged in names.csv before VO recording

### Sensitivity review
- [x] NAR-0027 · Demo · P1 · M · Sensitivity brief — rules for depicting plague, children in peril (Emmerich), religious persecution, torture (never shown on-screen, only implied), disability and amputation
- [x] NAR-0029 · Demo · P1 · S · Content descriptor text for Steam page — blood/gore, body horror, religious persecution, implied torture; matches what the demo shows
- [x] NAR-0030 · Demo · P2 · S · Vagrant patient (op1-4) — give him a name and one line of dignity in STORY_1_4 instead of "Unknown vagrant"
- [x] NAR-0034 · Beta · P1 · S · Content-warning toggles text — per-chapter warnings shown before Ch4 and Ch5 when "Show content notes" option is on

## NAR · Epic 2 — Chapter I "The Hour of Matins": demo-quality rewrite

### Structure and pacing
- [x] NAR-0035 · Demo · P0 · S · Ch1 beat sheet — one-line purpose per scene (Prologue, s1-2…s1-end) and what each teaches, reveals, or sets up; gaps flagged
- [x] NAR-0036 · Demo · P1 · S · Scene length budget — Prologue ≤ 14 lines, mid-chapter scenes ≤ 10, s1-end ≤ 14; measured by content test
- [x] NAR-0037 · Demo · P1 · S · Add cold-open line before Prologue text — a 2-line woodcut caption (Wound Man motif) establishing "the body as battlefield" pillar
- [x] NAR-0038 · Demo · P1 · M · Add post-op aftermath micro-scenes after op1-1…op1-4 — 2–4 lines each so every op result is acknowledged before the next brief
- [x] NAR-0039 · Demo · P1 · S · Branch aftermath text on rank — XS/S vs C variants of Haller's comment after op1-1 ("simple work" callback)
- [x] NAR-0040 · Demo · P2 · S · Failure scene text for each Ch1 op — short retry framing (Haller/Ilse line) shown on patient death before the retry prompt

### Prologue and s1-2 … s1-end passes
- [x] NAR-0041 · Demo · P0 · M · Prologue rewrite — establish Kreuzer's motive (why a sworn Weissburg surgeon takes a charity post) in ≤ 2 lines; keep "we do not lose patients to simple work"
- [x] NAR-0042 · Demo · P1 · S · Give Kreuzer a voice line in each Ch1 scene — currently silent in s1-2…s1-5; one characterising reply each
- [x] NAR-0043 · Demo · P1 · S · s1-2 rewrite — Mauer introduced with a character tic (counts his men aloud); barb tutorial lines split from story lines for the tutorial system
- [x] NAR-0044 · Demo · P1 · S · s1-3 rewrite — gunsmith guild's fee joke (institutional humour) and tincture tutorial line tightened to one instruction
- [x] NAR-0045 · Demo · P1 · S · s1-4 rewrite — Stroh's entrance: silence beat, then line; plague quarantine rumour planted for Ch3
- [x] NAR-0046 · Demo · P1 · S · s1-5 rewrite — Haller's Litany explanation cut to 3 lines; the "Do not do it where the Inquisitor can see" line kept as the chapter's hook
- [x] NAR-0047 · Demo · P1 · S · s1-end rewrite — Stroh's "time itself were obliging you" beat triggered only if the player used the Litany in op1-5; alternate line if not
- [x] NAR-0048 · Demo · P1 · S · Plant the crestless carriage — one line identifies its livery as absent on purpose; codex entry "The Carriage Without a Crest" unlocks (pays off in Ch4 patron betrayal)
- [x] NAR-0049 · Demo · P2 · S · Emmerich's sigil detail — describe one sigil shape in s1-end that reappears on the cantor in op2-4 (continuity hook)
- [x] NAR-0050 · Demo · P2 · S · Drover payment joke (turnips) extended into s1-3 opener callback — one line only

### Tutorial dialogue split
- [x] NAR-0051 · Demo · P0 · M · Separate instructional lines from story lines in Ch1 — tutorial text moves to tutorial prompts keyed by tool; story lines keep flavour only
- [x] NAR-0052 · Demo · P1 · S · Control-agnostic tutorial wording — every instruction uses input-glyph tokens ({TOOL_LANCET}, {LITANY_GESTURE}) so mouse, pad and Deck show correct prompts
- [x] NAR-0053 · Demo · P1 · S · Litany tutorial copy — star gesture explained in-fiction by Haller and in UI copy; ≤ 2 prompts; re-openable from pause "Remembered Teachings"

## NAR · Epic 3 — Chapter II "The Hour of Lauds": demo-quality rewrite

### Structure and pacing
- [x] NAR-0054 · Demo · P0 · S · Ch2 beat sheet — purpose per scene s2-1…s2-end; escalation from mundane (Ch1) to monsters and magic stated per scene
- [x] NAR-0055 · Demo · P0 · S · Fix count error in STORY_2_END — Ilse says "Seven more hours" but lists six; change to "Six more hours to the full Office"
- [x] NAR-0056 · Demo · P1 · M · Add post-op aftermath micro-scenes after op2-1…op2-4 — 2–4 lines each
- [x] NAR-0057 · Demo · P1 · S · Chapter transition card — "a week later" interstitial between s1-end and s2-1 with requisition writ shown as a prop image
- [x] NAR-0058 · Demo · P2 · S · Failure scene text for each Ch2 op — retry framing with Ilse/Mauer lines

### s2-1 … s2-end passes
- [x] NAR-0059 · Demo · P1 · S · s2-1 rewrite — Mauer/Ilse banter; the "requisitioned surgeon" writ; Stroh's influence on the Burgomaster made explicit in one line
- [x] NAR-0060 · Demo · P1 · M · s2-2 rewrite — Orsa Flintvein intro with original mountain-folk culture detail (debt-knots), hexstone description (black, pulsing), Scrying Lens handover
- [x] NAR-0061 · Demo · P1 · S · s2-3 rewrite — Orsa snoring gag kept; web-spinner "brood-mother" folk name and one camp superstition line
- [x] NAR-0062 · Demo · P0 · M · s2-4 rewrite — first moral pressure scene: Stroh demands the cantor live for interrogation; Kreuzer's reply choice (2 options) sets flag `cantorMercy` for Ch3
- [x] NAR-0063 · Demo · P1 · S · s2-5 rewrite — the dawn hymn: lyrics of the Lauds antiphon (original 4-line verse, two voices) shown as the hymn falters
- [x] NAR-0064 · Demo · P0 · M · s2-end rewrite — demo cliffhanger: the hymn is heard in the ward at dawn and Jorg's LAUDS sigil matches the Ch1 sigil shape from Emmerich; Stroh's "After Prime" line ends the demo
- [x] NAR-0065 · Demo · P1 · S · Stroh's candle beat in s2-end conditional on Litany use in op2-5 — alternate: he notes the Doctor's hands "shook, for once"
- [x] NAR-0066 · Demo · P1 · S · Lauds boss framing — lines establish the curse as an antiphonal pair (two voices answering) so the boss mechanic is foreshadowed in story

### Demo-exclusive framing
- [x] NAR-0067 · Demo · P0 · S · Demo end card copy — "The Office is not finished. Prime is sung next." + wishlist call to action (≤ 25 words)
- [x] NAR-0068 · Demo · P1 · S · Chapter III teaser script — 6-line VN teaser (foundry smoke, raised bridges, Haller's licence vote, Stroh's "After Prime") shown after the end card
- [x] NAR-0069 · Demo · P2 · S · Demo main-menu flavour lines — 8 rotating title-screen epigraphs (hymn fragments, guild notices) all IP-cleared

## NAR · Epic 4 — Demo barks, codex and case notes

### Operation barks (Ilse, Haller, patients)
- [x] NAR-0070 · Demo · P0 · S · Bark taxonomy doc — trigger list (op start, COOL/GOOD/BAD/MISS, combo 5/10/20, vitals < 30, < 15, tincture used, Litany cast, phase change, boss enraged, op success, op fail, time < 30 s) with max frequency per trigger
- [x] NAR-0071 · Demo · P0 · M · Sister Ilse bark set — ≥ 6 variants per trigger above (≈ 90 lines), in `src/content/barks.ts` keyed by trigger id
- [x] NAR-0072 · Demo · P1 · M · Master Haller bark set (Ch1 observer) — ≥ 3 variants per trigger, dry and critical; replaces Ilse on ops where Haller supervises (op1-1, op1-2)
- [x] NAR-0073 · Demo · P1 · S · Captain Mauer bark set (Ch2 camp ops) — 30 lines; military impatience ("Is he fit to march?")
- [x] NAR-0074 · Demo · P1 · S · Inquisitor Stroh observer barks — 20 lines fired only on Litany cast/boss phases when he is present (op1-4, op1-5, op2-4, op2-5)
- [x] NAR-0075 · Demo · P1 · M · Patient pain/relief barks — 4–6 per demo patient (Jost, Pieter, Anno, vagrant, Emmerich, Tomas, Orsa, Henning, cantor, Jorg); fire on first incision, extraction, closing
- [x] NAR-0076 · Demo · P1 · S · Malison voice lines — Matins (whispered vigil verses, 8 lines) and Lauds (two-voice call and response, 12 lines) keyed to boss phases
- [x] NAR-0077 · Demo · P1 · S · Bark anti-repeat rule — same line not repeated within 3 fires of its trigger; unit test over 1000 simulated triggers
- [x] NAR-0078 · Demo · P2 · S · Rank-card quips — one line per rank (XS/S/A/B/C) per speaker shown on the results screen

### Codex (demo set)
- [x] NAR-0079 · Demo · P0 · S · Codex schema — entry id, title, category (People, Places, Afflictions, Instruments, The Hours, Orders), unlock condition, body ≤ 180 words, woodcut image id
- [x] NAR-0080 · Demo · P1 · M · People entries — Kreuzer, Ilse, Haller, Stroh, Mauer, Orsa (6 entries), each with a second paragraph unlocked by an S rank or chapter completion
- [x] NAR-0081 · Demo · P1 · M · Instrument entries — Lancet, Tongs, Leech-Pipe, Gut Thread, Saint's Salve, Tincture, Cautery Brand, Scrying Lens, Litany of Stillness (9 entries) with in-world origin and period-flavoured usage note
- [x] NAR-0082 · Demo · P1 · M · Affliction entries — blade wounds, barbed arrows, powder burns, pestilent humours/buboes, rot, grubs, gravehound bite, hexstone, web-spinner venom and brood, curse-sigils (10 entries)
- [x] NAR-0083 · Demo · P1 · S · Places and orders — Kessendorf, Hospice of Saint Ildra, Merciful Order, Ash Tribunal, Kessendorf Watch, the Grauwald, the barrow-fields (7 entries)
- [x] NAR-0084 · Demo · P1 · S · The Hours entries — Matins and Lauds (full), plus six locked silhouettes titled with hour names only
- [x] NAR-0085 · Demo · P2 · S · Folk-remedy sidebars — 5 black-humour quack cures (beef on a flagpole, penitent's whip for fever, etc.) attached to affliction entries
- [x] NAR-0086 · Demo · P2 · S · Codex unlock audit — every demo entry reachable in a normal playthrough; test walks campaign steps and asserts unlock ids exist

### Patient case notes
- [x] NAR-0087 · Demo · P1 · S · Case-note template — Kreuzer's hand: patient, presenting complaint, procedure, outcome, one personal observation; outcome line varies by rank
- [x] NAR-0088 · Demo · P1 · M · Write 10 demo case notes — op1-1…op2-5; each ≤ 120 words with rank-variant outcome sentence
- [x] NAR-0089 · Demo · P2 · S · "Where are they now" footnotes — one-line follow-up per demo patient shown after chapter completion (Jost breaks his promise by Friday, etc.)

## NAR · Epic 5 — Character arcs (full game)

### Dr. Kreuzer
- [x] NAR-0090 · Alpha · P0 · M · Kreuzer arc doc — from sworn craftsman hiding the Litany to open defiance at trial; 5 chapter-by-chapter turning points with the scene id carrying each
- [x] NAR-0091 · Alpha · P1 · S · Backstory reveal — why he left Weissburg (a patient he lost to a guild rule); revealed in Ch3 to Haller during licence vote
- [x] NAR-0092 · Alpha · P1 · S · Litany origin — Kreuzer learns in Ch4 that the Litany is itself a sung office fragment, linking his gift to the Choir; codex "The Litany, Reconsidered"
- [x] NAR-0093 · Alpha · P1 · S · Whisper-meter narrative states — 4 bands (Unremarked, Noted, Suspected, Accused) each with 3 unique Kreuzer interior lines
- [x] NAR-0094 · Beta · P2 · S · Kreuzer journal epilogue — one page per ending written in his voice

### Sister Ilse
- [x] NAR-0095 · Alpha · P0 · M · Ilse arc doc — faith vs. what she sees; she lies to Stroh for Kreuzer in Ch3, is taken as Vespers host in Ch5
- [x] NAR-0096 · Alpha · P1 · S · Ilse's order politics — the Merciful Order has no political weight; Ch3 scene where the Mother Superior orders her to leave the hospice and she refuses
- [x] NAR-0097 · Alpha · P1 · S · Ilse personal side-scene per chapter — Ch3–5; unlocked by high average rank, 8–12 lines each

### Master Haller
- [x] NAR-0098 · Alpha · P0 · M · Haller arc doc — mentor who once struck the Precentor from the guild rolls; guilt; licence vote in Ch3; hexfire host in Terce; survives or dies by player rank
- [x] NAR-0099 · Alpha · P1 · S · Haller confession scene (Ch3) — reveals he knew the Precentor as his pupil, Aurel Vennholt; 12–16 lines
- [x] NAR-0100 · Alpha · P1 · S · Haller fate branch — Terce op rank ≥ A: he lives, retires with burned hands and becomes Ch4–5 advisor by letter; < A: he survives maimed and bitter (no death to keep op fail distinct)

### Inquisitor Stroh
- [x] NAR-0101 · Alpha · P0 · M · Stroh arc doc — chartered agent of the council; his charter has lapsed (Ch4 reveal); trust meter drives whether he defends or prosecutes Kreuzer in Ch5
- [x] NAR-0102 · Alpha · P1 · S · Stroh dental op scene "The Most Hated Avocation" (Ch3) — interrogation between groans; trust +1 on S rank
- [x] NAR-0103 · Alpha · P1 · S · Charter-lapse reveal scene (Ch4) — Mauer produces the council roll; Stroh's authority is now void; 14 lines
- [x] NAR-0104 · Alpha · P1 · S · Stroh trust flags list — every choice that moves it (cantorMercy, certificate signing, Stroh's tooth rank, Litany seen count) with deltas

### Captain Mauer
- [x] NAR-0105 · Alpha · P1 · M · Mauer arc doc — loyal to his men over the council; Sext host in Ch4; leads the Watch against the Tribunal on Hollow Night if saved at rank ≥ B
- [x] NAR-0106 · Alpha · P2 · S · Mauer's roll-call motif — he counts his men in every scene; count falls across Ch4; payoff line in Ch5

### Orsa Flintvein
- [x] NAR-0107 · Alpha · P1 · M · Orsa arc doc — returns in Ch4 with her miners (Delver's Lung), then in Ch5 digs the tunnel under the Tribunal court
- [x] NAR-0108 · Alpha · P2 · S · Orsa's mine-name running gag — names a bad mine after Kreuzer (Ch2), reports its collapse (Ch4), names a better one (epilogue)

### The Precentor
- [x] NAR-0109 · Alpha · P0 · M · Precentor arc doc — Aurel Vennholt, struck-off surgeon; motive: end all suffering with a perfect Compline; appears only as voice until Ch4, in person in Ch5
- [x] NAR-0110 · Alpha · P1 · S · Precentor's letters — 5 intercepted letters (one per chapter, Ch1–2 letters added to demo codex as locked stubs) building his case in his own voice
- [x] NAR-0111 · Alpha · P1 · S · Precentor/Kreuzer mirror scene (Ch5) — both claim to stop pain; 20 lines; no villain monologue beyond 4 consecutive lines
- [x] NAR-0112 · Alpha · P2 · S · Hollow Choir hierarchy — Precentor, cantors, lay-cantors, acolytes; the hospice patron (Widow Aldegund Reiss) as secret acolyte; bible entry

### Supporting cast
- [x] NAR-0113 · Alpha · P1 · S · Add cast entries to `characters.ts` — precentor, orsa, reiss, tallert, motherSuperior, burgomaster with colors and silhouettes
- [x] NAR-0114 · Alpha · P2 · S · Returning-patient cameos — Jost, Pieter, Anno, Emmerich, Tomas each reappear once in Ch3–5 with a line reflecting their demo op rank

## NAR · Epic 6 — Chapter III "Prime and Terce" (Kilnrows and quarantine)

### Outline
- [x] NAR-0115 · Alpha · P0 · M · Ch3 outline — 10 ops, 12 scenes; acts: Hornchild inspection → foundry explosions → plague and raised bridges → Prime (roll of the dead) → guild licence vote → Terce (guildhall fire, Haller host)
- [x] NAR-0116 · Alpha · P0 · S · Ch3 flag inputs — reads `cantorMercy`, demo Litany-seen count, demo total rank; writes `hornchildCertificate`, `strohTooth`, `hallerFate`
- [x] NAR-0117 · Alpha · P1 · S · Ch3 title card and opening narration — "Prime: the first work of the day. The roll of the dead is read aloud."

### Scenes (first draft)
- [x] NAR-0118 · Alpha · P0 · M · s3-1 "After Prime" — Stroh's promised conversation; the inspection decree invoked on a hornchild (Liesl, 7); Kreuzer must examine her
- [x] NAR-0119 · Alpha · P0 · M · s3-2 Certificate choice — sign "natural growth" (false, Whisper +2, Liesl lives free) or "late-turned" (true, Liesl taken by the Tribunal); both lead to op3-1
- [x] NAR-0120 · Alpha · P1 · M · s3-3 Kilnrows powder-mill explosion — mass casualties; introduces field triage mode in-fiction via Ilse
- [x] NAR-0121 · Alpha · P1 · S · s3-4 Founder's colic — lead poisoning patient; guild fee humour (the founders' guild bills the hospice for the lead removed)
- [x] NAR-0122 · Alpha · P1 · M · s3-5 The bridges are raised — council quarantine; vapour-wardens hang beef on poles; flagellant brotherhood marches past the hospice
- [x] NAR-0123 · Alpha · P1 · S · s3-6 Penny-pie outbreak — black-humour scene with a pie vendor denying everything
- [x] NAR-0124 · Alpha · P0 · M · s3-7 Prime — Registrar Oswin Tallert collapses reading the roll of plague dead; names writing themselves across his skin
- [x] NAR-0125 · Alpha · P1 · S · s3-8 Stroh's toothache — he arrives at night, jaw swollen, and must be treated by the man he suspects
- [x] NAR-0126 · Alpha · P0 · M · s3-9 Licence vote at the Barber-Surgeons' Guildhall — Haller defends Kreuzer; Kreuzer's backstory surfaces; vote outcome depends on Ch1–3 average rank
- [x] NAR-0127 · Alpha · P0 · M · s3-10 Terce — the guildhall catches hexfire mid-vote; Haller is the host
- [x] NAR-0128 · Alpha · P0 · M · s3-end — Haller's confession about Aurel Vennholt; the Precentor's name spoken for the first time; the council orders the companies east
- [x] NAR-0129 · Alpha · P1 · S · Ch3 aftermath micro-scenes for all 10 ops — 2–4 lines each

## NAR · Epic 7 — Chapter IV "Sext and None" (the Vennmark field)

### Outline
- [x] NAR-0130 · Alpha · P0 · M · Ch4 outline — 9 ops, 11 scenes; acts: march east → field hospital in rain → Orsa's miners → the dead man's pulse → Sext at noon (Mauer host) → charter-lapse reveal → patron betrayal → None
- [x] NAR-0131 · Alpha · P0 · S · Ch4 flag inputs/outputs — reads `hallerFate`, `hornchildCertificate`, `strohTrust`; writes `mauerFate`, `charterRevealed`, `deadManVerdict`, `thirstChoice`

### Scenes (first draft)
- [x] NAR-0132 · Alpha · P1 · M · s4-1 The march — hired companies, crossbow specialists, deserters; Kreuzer's field kit introduced (environment modifiers in fiction)
- [x] NAR-0133 · Alpha · P1 · S · s4-2 Rain in the tents — Ilse and Kreuzer on the Litany's nature; first hint it is a hymn fragment
- [x] NAR-0134 · Alpha · P1 · M · s4-3 Orsa returns — her crew poisoned by crystal dust; mountain-folk customs (don't shave the beard) as a plot constraint
- [x] NAR-0135 · Alpha · P1 · S · s4-4 The giant mercenary — a tithe-eater swallowed stolen council documents; comic interrogation by Mauer
- [x] NAR-0136 · Alpha · P0 · M · s4-5 The dead man's pulse — a noble's "corpse" with one heartbeat a minute; Stroh demands a verdict; branch into forensic op or save-op
- [x] NAR-0137 · Alpha · P1 · M · s4-6 The thirsted courtesan — Margit, bitten repeatedly; she begs Kreuzer not to end the bond; player choice `thirstChoice`
- [x] NAR-0138 · Alpha · P0 · M · s4-7 Sext — noon lethargy sweeps the camp; Mauer collapses reporting calm while dying (fake-calm vitals foreshadowed)
- [x] NAR-0139 · Alpha · P0 · M · s4-8 Charter lapse — the council roll shows Stroh's mandate expired at the new year; Stroh's reaction varies by `strohTrust`
- [x] NAR-0140 · Alpha · P1 · S · s4-9 The stone bride — a camp-follower's wedding interrupted by petrification
- [x] NAR-0141 · Alpha · P0 · M · s4-10 Patron betrayal — Widow Aldegund Reiss, the hospice's benefactor, revealed as Choir acolyte; the crestless carriage (Ch1 plant) was hers
- [x] NAR-0142 · Alpha · P0 · M · s4-11 None — Pieter (Ch1 militiaman) carries the burrower toward his heart; the Precentor speaks through him for the first time
- [x] NAR-0143 · Alpha · P0 · S · s4-end — return to Kessendorf; Hollow Night is three days off; Stroh (or the council, if trust is low) issues a warrant for Kreuzer

## NAR · Epic 8 — Chapter V "Vespers and Compline" (Hollow Night)

### Outline
- [x] NAR-0144 · Alpha · P0 · M · Ch5 outline — 8 ops, 12 scenes; acts: warrant and arrest → trial (witch-pricking evidence) → Hollow Night processions → Vespers (Ilse) → descent under the Tribunal court → Compline (Stroh) → endings
- [x] NAR-0145 · Alpha · P0 · S · Ch5 flag inputs — all prior flags plus final Whisper band; outputs `ending` enum

### Scenes (first draft)
- [x] NAR-0146 · Alpha · P0 · M · s5-1 Arrest — Kreuzer taken from the hospice mid-shift; Ilse keeps working the ward alone
- [x] NAR-0147 · Alpha · P0 · L · s5-2 The trial — fair-trial rule; each false certificate or witnessed Litany is entered as evidence; interview-mode questioning (see CON disciplines); witnesses: Mauer, Orsa, Haller (letter), Liesl's mother
- [x] NAR-0148 · Alpha · P1 · M · s5-3 Verdict — outcome from evidence tally and Stroh's stance; acquittal, conviction with escape (Orsa's tunnel), or conviction with Mauer's rescue
- [x] NAR-0149 · Alpha · P1 · M · s5-4 Hollow Night — the streets empty, charms hung, the Choir sings openly; hymn lyrics for Vespers (original)
- [x] NAR-0150 · Alpha · P1 · S · s5-5 Choir-throat — a chorister of the cathedral hums the hymn; field op on the street
- [x] NAR-0151 · Alpha · P1 · S · s5-6 The mouth beneath — a cyst that talks and threatens to tell Stroh Kreuzer's secret
- [x] NAR-0152 · Alpha · P1 · S · s5-7 The chandler's daughter — blood setting like wax; leads into Vespers
- [x] NAR-0153 · Alpha · P1 · M · s5-8 Under the Hollow Moon — midwives delay a birth for superstition; Kreuzer overrules; hope-giving scene before the finale
- [x] NAR-0154 · Alpha · P0 · M · s5-9 Vespers — Ilse is the host; the lamps of the ward go out one by one
- [x] NAR-0155 · Alpha · P0 · M · s5-10 The Precentor — meeting under the Tribunal court; mirror scene; he sings Compline into Stroh (or into the Burgomaster if Stroh was lost)
- [x] NAR-0156 · Alpha · P0 · M · s5-11 Compline — the Litany stolen; last lines before the final op
- [x] NAR-0157 · Alpha · P0 · L · Endings — 4 endings (The Quiet Night averted with Stroh's pardon; Exile with Ilse; The Pyre Refused; The Perfect End — failure-state bad ending) each 20–40 lines plus epilogue cards per surviving character

### Endgame and branching
- [x] NAR-0158 · Alpha · P0 · M · Ending matrix — table mapping (strohTrust, Whisper band, hornchildCertificate, mauerFate, hallerFate) → ending; every combination reachable and covered by test
- [x] NAR-0159 · Beta · P1 · S · Epilogue cards — 12 characters × survives/dies/absent variants, woodcut caption style, ≤ 50 words each
- [x] NAR-0160 · Beta · P1 · S · Post-credits sting — the Unsung Hour hymn fragment unlocking challenge mode's secret op
- [x] NAR-0161 · Beta · P2 · S · Chapter-select recap text — 3-sentence "previously" for each chapter shown when starting from chapter select

## NAR · Epic 9 — Full-game barks, codex and case notes

### Barks
- [x] NAR-0162 · Alpha · P1 · M · Ch3–5 speaker bark sets — Ilse (continues), Orsa (Ch4 field ops), Haller-by-letter (Ch4 briefings), Stroh (Ch3 tooth op, Ch5) ≥ 3 variants per trigger
- [x] NAR-0163 · Alpha · P1 · M · Malison voice lines — Prime (reading names), Terce (tongues of fire), Sext (false calm), None (death-count), Vespers (lamp-hymn), Compline (silence-verses): 10–14 lines each
- [x] NAR-0164 · Alpha · P1 · S · Environment barks — rain in field tent, moving-cart table, candle-only light: 6 lines each warning of the modifier at op start
- [x] NAR-0165 · Alpha · P1 · M · Patient barks for Ch3–5 — 4–6 per named patient (27 patients)
- [x] NAR-0166 · Alpha · P2 · S · Whisper-band barks — Ilse/Stroh remarks after a Litany cast when Whisper is Suspected or Accused (8 lines)
- [x] NAR-0167 · Beta · P1 · S · Challenge-mode barks — neutral "examiner" voice for X-ops (30 lines), no story spoilers
- [x] NAR-0168 · Beta · P2 · S · Discipline barks — triage (Ilse callouts of incoming), bone-setting (patient pain), forensic (Stroh), interviews (witnesses) — 20 each

### Codex and case notes
- [x] NAR-0169 · Alpha · P1 · M · Ch3–5 codex entries — ≥ 40 new entries (afflictions, places, Choir hierarchy, the six remaining Hours, Precentor letters)
- [x] NAR-0170 · Alpha · P1 · M · Case notes for 27 Ch3–5 operations — with rank-variant outcomes
- [x] NAR-0171 · Beta · P2 · S · Codex completion reward text — a final Kreuzer essay "On Mercy" unlocked at 100%
- [x] NAR-0172 · Beta · P2 · S · Hymnal page — full original lyrics of all eight Hours collected in codex, unlocked by defeating each Malison

## NAR · Epic 10 — Script passes, VO prep and localisation readiness

### Script passes
- [x] NAR-0174 · Demo · P1 · S · Demo proofread pass — spelling, punctuation (typographic quotes/dashes consistent), speaker names; zero issues in second read _(automated: tests/unit/content/proofread.test.ts — quotes, dashes, ellipses, spacing)_
- [ ] NAR-0175 · Demo · P1 · S · Demo continuity pass — injuries, names, times of day and item names consistent across scenes, briefings, codex and case notes
- [ ] NAR-0177 · Alpha · P0 · L · Ch3–5 second draft — incorporates playtest notes and ending matrix; all scene ids wired in campaign data
- [ ] NAR-0178 · Beta · P0 · M · Ch3–5 polish pass — pacing budget enforced, jokes audited against humour rule, Kreuzer voice consistent
- [ ] NAR-0179 · Beta · P1 · S · Full-game continuity pass — timeline, flags and callbacks verified against the bible; issues tracked to zero

---

## CON · Epic 1 — Data-driven content pipeline (Demo foundation)

### Operation data format
- [x] CON-0001 · Demo · P0 · L · Serialisable operation schema — OperationDef phases expressed as JSON/TS data (entity type + params) instead of `spawn` closures; op1-1…op2-5 ported with identical seeded outcomes (golden test)
- [x] CON-0002 · Demo · P0 · M · Entity registry — string ids (laceration, incision, embedded, burn, bubo, rot, venom, grub, sigil, malison-matins, malison-lauds…) mapped to constructors with typed param validation
- [x] CON-0003 · Demo · P0 · S · Schema validation — Zod (or hand-rolled) validator rejects unknown entity ids, out-of-field positions, tools missing for required entities; runs in Vitest over all ops
- [x] CON-0004 · Demo · P1 · S · Tool-requirement check — test asserts every spawned entity is resolvable with the op's `tools` list (e.g. Embedded needs tongs, Grub needs brand)
- [x] CON-0005 · Demo · P1 · S · Remove non-setting `race` values `'elf' | 'halfling' | 'orc'` from OperationDef — replace with `'human' | 'mountainfolk' | 'hornfolk' | 'giant'` flesh tints
- [x] CON-0007 · Demo · P1 · M · Campaign graph data — chapters as ordered step lists with optional branch nodes (`if flag`), replacing the hard-coded `CAMPAIGN` array; demo graph = Ch1+Ch2 only
- [x] CON-0008 · Demo · P1 · S · Flag store — named boolean/int campaign flags (cantorMercy, litanySeenCount) persisted in save; unit tests for set/get/serialise
- [x] CON-0009 · Demo · P1 · S · Story script conditionals — `Line` gains optional `if` (flag expression) so s1-end/s2-end Litany-conditional lines work; parser tested
- [x] CON-0010 · Demo · P1 · S · Choice nodes in StoryDef — 2–3 option choices writing flags; used by s2-4
- [x] CON-0011 · Demo · P2 · S · Op hot-reload in dev — editing an op data file restarts the running operation with same seed within 1 s

### Authoring tools
- [x] CON-0012 · Demo · P1 · M · Dev op-sandbox scene — pick any op/phase, jump to phase N, toggle invulnerable vitals, freeze timer; available only in dev builds _(the dev console: `op`, `phase`, `god`, `nodrain`, `time`)_
- [x] CON-0013 · Demo · P1 · M · Placement overlay — in sandbox, shows field grid in `at(x,y)` units and entity bounds; click copies coordinates to clipboard
- [x] CON-0014 · Demo · P1 · S · Headless op simulator CLI — `npm run sim op2-3 --bot perfect|average|poor` runs the op with a scripted bot and prints score, time, rank, vitals min
- [x] CON-0016 · Demo · P1 · S · Rank-threshold report — sim runs every op with 3 bots × 20 seeds and outputs a CSV of scores vs S/A/B thresholds
- [x] CON-0017 · Alpha · P1 · M · Phase timeline visualiser — renders per-op phase durations and entity counts from sim runs as an HTML report
- [x] CON-0018 · Alpha · P2 · M · Story scene previewer — dev scene renders any StoryDef with a flag override panel _(the dev console: `story <id>` with `flag` overrides)_

## CON · Epic 2 — Operation-authoring QA and balance (applies to every op)
- [x] CON-0019 · Demo · P0 · S · Op acceptance checklist `docs/content/op-checklist.md` — winnable with perfect bot, loseable with poor bot, all callouts ≤ 28 chars/line, briefing present, case note present, rank thresholds from sim, no softlock
- [x] CON-0020 · Demo · P0 · M · Softlock test — for every op, sim with a "do nothing" bot must end in `lost` before timeLimit + 5 s; with perfect bot must reach `won`
- [x] CON-0021 · Demo · P0 · S · Determinism test — each op run twice with same seed and inputs yields identical score and final vitals
- [x] CON-0022 · Demo · P1 · S · Difficulty curve targets — Ch1 op average-bot win rate 95→80%, Ch2 85→65% (op2-5 boss lowest); sim report checked in CI _(superseded by GAM-0185: novice ≥ 95 % on every op)_
- [x] CON-0023 · Demo · P1 · S · Time budget rule — perfect-bot clear time ≤ 55% of timeLimit, average-bot ≤ 85%; violations fail report
- [x] CON-0024 · Demo · P1 · S · Tool-introduction ledger — table of which op first requires each tool and the Litany; demo introduces each at most once per op, lens last (op2-2)
- [x] CON-0027 · Alpha · P1 · S · Apply checklist — softlock and determinism tests to every Ch3–5 op (CI gate for the content folder)
- [x] CON-0029 · Beta · P1 · S · Difficulty modes content — Easy (+40% time, −30% drain) and Hard (−20% time, stricter COOL window) values set per op and validated by sim _(Novice / Surgeon / Master in src/surgery/difficulty.ts)_

## CON · Epic 3 — Chapter I operations: demo polish

### op1-1 "A Tavern Knife" (Jost, drover) — tutorial: thread, leech, salve
- [x] CON-0030 · Demo · P0 · S · Split into guided tutorial phases — stitch-only phase cannot fail (vitals floor 40) until first successful stitch
- [x] CON-0031 · Demo · P1 · S · Reposition lacerations — so neither overlaps HUD safe area at 16:9, 16:10 and Steam Deck 1280×800
- [x] CON-0032 · Demo · P1 · S · Blood-pool phase — pool spawns over the second laceration so "drain before stitch" is demonstrated, not just told _(superseded by GAM-0191: the first op keeps its pool in plain sight)_
- [x] CON-0033 · Demo · P1 · S · Rank thresholds re-derived from sim — currently S 3950 / A 3150 / B 2350; XS requires no BAD/MISS

### op1-2 "The Barbed Shaft" (Pieter, militiaman) — lancet nicks, tongs
- [x] CON-0035 · Demo · P0 · S · Barb rule clarity — each required nick marked with a faint ink tick until performed; tearing an un-nicked barb spawns a 1.6× bleed laceration + BAD (test)
- [x] CON-0037 · Demo · P1 · S · Post-extraction bleed phase tuned — so average bot keeps vitals > 40
- [x] CON-0038 · Demo · P2 · S · Horned-folk arrow codex unlock — entry unlocks on first clean extraction (test)

### op1-3 "Powder Burns" (Anno, gunsmith's apprentice) — tongs on eschar, incision, tincture intro
- [x] CON-0039 · Demo · P0 · S · Eschar-before-salve rule enforced — salving over eschar gives BAD and a festering rot spawn after 10 s (test)
- [x] CON-0041 · Demo · P1 · S · Tincture intro moment — scripted vitals dip to 30 at shot extraction with callout, guaranteed once _(shipped as op1-3 opening at 70 vitals with the tincture callout)_
- [x] CON-0042 · Demo · P1 · S · Lead-fragment count 3–5 by seed — lens not available so all fragments visible
- [x] CON-0043 · Demo · P2 · S · Burst-barrel shrapnel pattern — radial; instead of random scatter

### op1-4 "Pestilent Humours" (named vagrant, Tanners' Rows) — buboes, rot, grubs, brand intro
- [x] CON-0044 · Demo · P0 · S · Rot regrowth timer shown as a creeping edge — regrowth rate tuned so average bot clears it in ≤ 2 passes _(regrowth now takes salved cells beside live rot first (`Rot.frontier`), and those cells darken as `Rot.creep` comes due. Steady bot: 1.3 passes per purge across the demo (tests/sim/rot-passes.test.ts); tests/unit/content/rotCreep.test.ts)_
- [x] CON-0045 · Demo · P1 · S · Bubo lancing — sloppy lance (angle > 30° off axis) leaves a festering wound; clean lance COOL (test) _(superseded by the Overcut rule: a cut longer than the bubo spills it)_
- [x] CON-0046 · Demo · P1 · S · Pus-on-open-cut rule — pus contacting an unstitched laceration spawns rot (test)
- [x] CON-0047 · Demo · P1 · S · Brand intro — grubs flee from brand heat; searing healthy flesh gives MISS and −2 vitals
- [x] CON-0048 · Demo · P2 · S · Stroh observer overlay — silhouette at field edge during this op only _(`observer` on an op def: a dim portrait-shader bust left of the field, rim-lit in the character’s colour, lifting into the light when vitals drop below 40. op1-4 only (after s1-4’s “I only wish to watch”). tests/unit/content/observer.test.ts)_

### op1-5 "The Hour of Matins" (Emmerich, page-boy) — sigils, Malison boss, Litany intro
- [x] CON-0049 · Demo · P0 · M · Matins boss phase review — eye-open rhythm telegraphed 0.8 s before opening (audio + visual), brand damage only while open
- [x] CON-0050 · Demo · P0 · S · Litany teaching beat — first Malison enrage forces a callout prompting the star gesture; op still winnable without Litany (perfect bot test)
- [x] CON-0051 · Demo · P1 · S · Sigil trace phase — stroke order shown as numbered ink dots on first attempt, hidden on retry ≥ 2 _(`op.strokeNumbers`: the attempt is the save’s run of failures + 1; from attempt 3 only the next node pulses. Novice and the Guides assist keep the numbers. tests/unit/content/sigilNumbers.test.ts)_
- [x] CON-0052 · Demo · P1 · S · Mote spawn cap — ≤ 6 alive; so the field never becomes unreadable
- [x] CON-0053 · Demo · P1 · S · Final phase — MATINS word seared into flesh as a visual when boss dies (matches s1-end)
- [x] CON-0054 · Demo · P1 · S · Boss-fail tips — 3 context tips cycling on retry ("Brand only when the eye is open", etc.) _(BOS-0009: Ilse’s tip for the phase it was lost in)_

## CON · Epic 4 — Chapter II operations: demo polish

### op2-1 "Gravehound" (Tomas, scout) — claw rakes, lodged teeth, venom
- [x] CON-0055 · Demo · P0 · S · Venom-on-bite tincture interaction — tincture held on bite for 1.5 s neutralises venom; wrong spot gives MISS (test)
- [x] CON-0056 · Demo · P1 · S · Claw-rake lacerations as parallel triples — stitch zig-zag detection works on parallel close wounds (no cross-stitch mis-assignment)
- [x] CON-0057 · Demo · P1 · S · Tooth count 3–4 — one tooth broken (tongs twice) for variety _(`elite-fangnest` takes `optional` (trailing spots on a seeded coin-flip) and `broken` (an Embedded with `crowns`: the first pull brings the crown, the root stays for a second). op2-1: 3–4 fangs, the second broken. tests/unit/content/fangNest.test.ts)_
- [x] CON-0058 · Demo · P2 · S · Grave-dirt contamination — 2 dirt spots must be drained before salve or salve rates BAD _(`gravedirt` (src/surgery/ailments/graveDirt.ts): the Leech-Pipe draws it out in 1.2 s; Saint’s Salve over it rates BAD "Dirt sealed in", harms, and festers into rot 5 s later. op2-1 carries two in with the claw rakes. tests/unit/content/graveDirt.test.ts)_

### op2-2 "The Green Seam" → rename "The Black Seam" (Orsa Flintvein) — scrying lens intro
- [x] CON-0059 · Demo · P0 · S · Rename op title and all references to "The Black Seam" — hexshard visual is black glass with a heartbeat pulse, no green
- [x] CON-0060 · Demo · P0 · S · Lens tutorial — first hidden shard revealed automatically under the lens with callout; rest must be found (4–6 by seed) _(op2-2: a `guide` hexstone shows at once within 1.8 × the lens radius and Ilse names the glint (LENS_GUIDE); one more hexstone and a seeded pick of 2–4 glass splinters must be found. Ranks recalibrated; op2-3 starts at 80 to keep the chapter curve. tests/unit/content/lensTutorial.test.ts)_
- [x] CON-0061 · Demo · P1 · S · Spoiling flesh around unfound shards spreads at 1 radius/10 s — spread rate tuned from sim _(every lodged hexstone, found or not, seeds a rot patch one radius (60 px) out every 10 s, at most four at once (tuning.tongs.hexCorrupt*); the sweep holds op2-2 steady 100 % and novice min vitals ≥ 25. tests/unit/content/hexSpoil.test.ts)_
- [x] CON-0062 · Demo · P1 · S · Thick-hide stitching — mountain-folk flesh tint and 1.3× thread-pass requirement (Orsa's "strong arm" line)
- [x] CON-0063 · Demo · P2 · S · Hexshard handling — shards dropped only in the lead dish tray; dropping elsewhere = BAD (plants Whisper system)

### op2-3 "Brood-Mother's Kiss" (Henning, forager) — venom, egg sacs, grubs
- [x] CON-0064 · Demo · P0 · S · Egg-sac hatch timer shown as swelling — lanced sacs spill grubs to be branded; unlanced hatch scatters 3× grubs (test)
- [x] CON-0065 · Demo · P1 · S · Venom spread along drawn veins — tincture targets the vein head _(the bite is the vein’s head: the Antidote rule, tincture held on it)_
- [x] CON-0066 · Demo · P1 · S · Web-silk wrapping overlay that must be cut — with the lancet before the field is accessible
- [x] CON-0067 · Demo · P2 · S · Grub AI flees toward nearest open wound — not random; so good play closes wounds first

### op2-4 "The Silenced Cantor" (lay-cantor of the Hollow Choir) — igniting sigils, swallowed object
- [x] CON-0068 · Demo · P0 · S · Igniting sigils — each sigil ignites on a stagger (not all at once); untraced ignition causes hexfire burn
- [x] CON-0069 · Demo · P1 · S · Swallowed object phase — lens reveals a hymn-token in the stomach; incision + tongs extraction; item appears in codex _(op2-4’s last phase: an incision line and a hidden `token` (Embedded kind) the Tongs reach only through the open incision; out, it sets `hymnToken` and Ilse names it. Codex “The Hymn-Token” (Orders) — scratched “Lauds. Standard.”, a thread to op2-5. Time limit 330 s; ranks recalibrated. tests/unit/content/hymnToken.test.ts)_
- [x] CON-0070 · Demo · P1 · S · `cantorMercy` flag read — if Kreuzer chose to argue with Stroh, op starts with +10 vitals (Ilse prepared him); test

### op2-5 "The Hour of Lauds" (Jorg, standard-bearer) — antiphonal Malison boss
- [x] CON-0072 · Demo · P0 · M · Lauds antiphonal pair — two linked bodies joined by a light-thread; damaging one makes the other "answer" (heals 15% + spawns a cut) unless struck within a 1.2 s response window
- [x] CON-0073 · Demo · P0 · S · Thread-sever option — lancet then gut thread on the light-thread splits the pair for 8 s
- [x] CON-0074 · Demo · P1 · S · Dawn-flare hazard — every 20 s the field flares white and the lens is blinded 3 s; warned 1 s ahead
- [x] CON-0075 · Demo · P1 · S · Phase 3 fusion — halves fuse into one body with a Voices ring; brand the Voices as currently implemented _(superseded by the Lauds redesign: split, then Dawn)_
- [x] CON-0076 · Demo · P1 · S · Litany synergy — during Litany both halves can be hit in one window; sim confirms Litany is not mandatory _(the response window runs on boss time, which the Litany slows: a 2.5 s real gap is answered under it and heals without it (tests/hours.test.ts). With `litany: false`, steady wins 5/5 and novice ≥ 4/5 (tests/sim/lauds-no-litany.test.ts))_
- [x] CON-0077 · Demo · P1 · S · Boss-fail tips (3) and phase checkpoint — on fail after phase 2, retry offers "start at the Choir" with rank capped at B _(GAM-0178: the checkpoint restart flags the run and blocks XS)_
- [x] CON-0078 · Demo · P1 · S · Closing phase — LAUDS word seared over the heart; banner-cloth fibres to tweeze from the wound (tongs) as the final flourish

### Demo briefing and diagnosis content (all 10 ops)
- [x] CON-0079 · Demo · P1 · S · Briefing schema — patient name/age/trade, presenting complaint, diagnosis (≤ 160 chars), tools unlocked, objective list, woodcut plate id
- [x] CON-0080 · Demo · P1 · S · Ch1 briefings rewritten for op1-1…op1-5 — diagnosis strings match the scenes (vagrant renamed), objective list matches phases
- [x] CON-0081 · Demo · P1 · S · Ch2 briefings rewritten for op2-1…op2-5 — "The Black Seam" retitle, Lauds described as "two voices beneath the sternum"
- [x] CON-0082 · Demo · P1 · S · Objective-to-phase test — every briefing objective maps to at least one phase id; test fails on orphans
- [x] CON-0084 · Demo · P2 · S · Patient ages and trades consistent between briefing — scene text and case note (content test cross-references ids) _(NAR-0170: every case note names the patient its op names)_

### Demo retry and replay content
- [x] CON-0085 · Demo · P1 · S · Chapter-select for demo — replay any cleared op; best rank shown per op
- [ ] CON-0086 · Demo · P1 · S · Seed variants — each demo op defines 3 seeds; replays rotate seeds; all 30 seed/op pairs pass softlock and determinism tests
- [x] CON-0087 · Demo · P2 · S · Rank-goal hints on op select — "S rank: finish with no MISS and 60 s spare"; derived from thresholds
- [x] CON-0088 · Demo · P1 · S · Op failure analytics events — op id, phase, cause of loss; emitted for playtest builds to target polish

## CON · Epic 5 — Demo end flow, wishlist hook and demo extras

### End-of-demo flow
- [x] CON-0093 · Demo · P1 · S · Demo save carry-over contract — flags and ranks saved in a documented format the full game imports (cantorMercy, litanySeenCount, per-op best rank)

### Demo challenge set
- [x] CON-0096 · Demo · P1 · S · Unlock rule — demo "Trials of the Guild" menu unlocks after completing Ch2; 3 X-ops
- [x] CON-0097 · Demo · P1 · M · X-op "Tuesday Knife-Fights" — 4 simultaneous stab wounds, 120 s, no salve; remix of op1-1 entities at higher bleed
- [x] CON-0098 · Demo · P1 · M · X-op "A Quiver's Worth" — 5 barbed arrows incl. 2 hidden (lens), blood pools
- [x] CON-0099 · Demo · P1 · M · X-op "Matins, Unwatched" — Matins boss with faster eye rhythm (×1.4), no Litany, XS rank requires no MISS
- [x] CON-0100 · Demo · P2 · S · Local best-score table per X-op — Steam leaderboard hooks owned by engine workstream

## CON · Epic 6 — Chapter III operations (Prime and Terce)

### op3-1 "The Hornchild" (Liesl, 7) — trepanation-style bud excision
- [x] CON-0101 · Alpha · P0 · S · Design spec — 2 horn-buds on skull; new Drill entity (hold lancet in circle 1.5 s), lift bone disc with tongs, excise bud, salve; Choir sigil under each bud
- [x] CON-0102 · Alpha · P0 · M · Implement Drill/BoneDisc entities — with unit tests (drill overheats if held > 3 s → BAD)
- [x] CON-0103 · Alpha · P1 · S · Branch — `hornchildCertificate = natural` skips excision of the second bud and scores the op on care only
- [x] CON-0104 · Alpha · P1 · S · Author `op3-1` data file — callouts, thresholds, checklist pass

### op3-2 "Ball and Wadding" (Kaspar, powder-mill guard) — lead shot with cloth fragments
- [x] CON-0105 · Alpha · P0 · S · Design spec — ball carries 2–4 doublet-cloth fragments found only with the lens; any fragment left triggers a delayed wound-fever phase (vitals drain ×2)
- [x] CON-0106 · Alpha · P0 · M · Implement ClothFragment entity + WoundFever delayed phase — unit test: fragment left → fever phase spawns after close
- [x] CON-0107 · Alpha · P1 · S · Author `op3-2` data file — callouts, thresholds, checklist pass

### op3-3 "Founder's Colic" (Ute Brandt, bell-founder) — lead poisoning
- [x] CON-0108 · Alpha · P0 · S · Design spec — lead deposits visible under lens as grey veins; chelating tincture (new tincture colour) dissolves them; drain the grey bile with leech-pipe
- [x] CON-0109 · Alpha · P0 · M · Implement LeadDeposit entity and tincture-variant selection — wheel on tincture picks colour; with tests
- [x] CON-0110 · Alpha · P1 · S · Author `op3-3` data file — callouts, thresholds, checklist pass

### op3-4 "Kilnrows Blast" (three powder-mill hands) — triage handoff op
- [x] CON-0111 · Alpha · P0 · S · Design spec — three patients in sequence on one timer; switch between them with Tab; each has burns, shrapnel and one lacerated artery _(shipped as op3-4's patients in turn on one clock and GAM-0248's two cots on one field — both visible, so no switch key)_
- [x] CON-0112 · Alpha · P0 · M · Implement multi-patient operation support — per-patient vitals, shared timer, switch cost 1 s; with tests _(GAM-0248: `second` patient, `vitals2`, shared clock)_
- [x] CON-0113 · Alpha · P1 · S · Author `op3-4` data file — callouts, thresholds, checklist pass

### op3-5 "The Crow's Beak" (Berthold, carter) — amputation choice
- [x] CON-0114 · Alpha · P0 · S · Design spec — shattered shin; saw with lancet strokes; seal with cautery (fast, −15 vitals) or ligate each vessel with thread (slower, +score); historical ligature codex entry
- [x] CON-0115 · Alpha · P0 · M · Implement Saw/Stump entities and ligature-vs-cautery scoring — with tests
- [x] CON-0116 · Alpha · P1 · S · Author `op3-5` data file — callouts, thresholds, checklist pass

### op3-6 "The Pieman's Revenge" (Frieda, laundress) — gut worms
- [x] CON-0117 · Alpha · P0 · S · Design spec — drain flux, pull worm heads whole with tongs (slow pull; torn worm regrows in 8 s), antiparasitic tincture
- [x] CON-0118 · Alpha · P0 · M · Implement Worm entity — with tension meter and regrow rule (unit tests)
- [x] CON-0119 · Alpha · P1 · S · Author `op3-6` data file — callouts, thresholds, checklist pass

### op3-7 "Lance the Buboes" (quarantine ward, Mother Agathe) — plague
- [x] CON-0120 · Alpha · P0 · S · Design spec — 6 buboes; clean lance only; pus must not touch open cuts; plague-rot regrows faster than op1-4; candle-only light modifier
- [x] CON-0121 · Alpha · P0 · M · Implement candle-light environment modifier — vignette radius follows cursor; data flag
- [x] CON-0122 · Alpha · P1 · S · Author `op3-7` data file — callouts, thresholds, checklist pass

### op3-8 "The Flagellant's Back" (Brother Ansgar) — scourge wounds on a thrashing penitent
- [x] CON-0123 · Alpha · P0 · S · Design spec — nail fragments in festering welts; patient thrashes (field shake) unless calmed with tincture before each extraction
- [x] CON-0124 · Alpha · P0 · M · Implement Agitation meter driving field shake amplitude — tincture resets it (tests)
- [x] CON-0125 · Alpha · P1 · S · Author `op3-8` data file — callouts, thresholds, checklist pass

### op3-9 "The Most Hated Avocation" (Inquisitor Stroh) — dentistry
- [x] CON-0126 · Alpha · P0 · S · Design spec — mouth field; abscess drain, rocking the rotten molar with tongs (root breaks if pulled too fast), VN interruption lines between phases; patient bites if lancet lingers
- [x] CON-0127 · Alpha · P0 · M · Implement Tooth/Root entity — with rock-and-pull input and bite hazard (tests)
- [x] CON-0128 · Alpha · P1 · S · Mid-op VN interjection support (op pauses for 2–3 lines between phases) — used here and in op5-2
- [x] CON-0129 · Alpha · P1 · S · Author `op3-9` data file — callouts, thresholds, `strohTooth` flag write, checklist pass

### op3-10 "The Hour of Prime" (Registrar Oswin Tallert) — boss
- [x] CON-0130 · Alpha · P0 · M · Prime design spec — writes name-sigils across tissue stroke by stroke; each completed name = −12 vitals; trace-erase with brand in reverse stroke order; up to 3 names writing at once in phase 2
- [x] CON-0131 · Alpha · P0 · L · Implement PrimeMalison + NameSigil entities — phases, write speed curve, erase rules; with unit tests
- [x] CON-0132 · Alpha · P1 · S · Name list content — 40 original Kessendorf names used by the name-sigils (IP-checked)
- [x] CON-0133 · Alpha · P1 · S · Author `op3-10` data file — callouts, boss-fail tips, thresholds, checklist pass

### op3-11 "The Hour of Terce" (Master Haller) — boss
- [x] CON-0134 · Alpha · P0 · M · Terce design spec — hexfire tongues leap between 3 organ zones; salve the flame-front, then excise the root with lancet; brand feeds the fire (+size)
- [x] CON-0135 · Alpha · P0 · L · Implement TerceMalison + FlameTongue entities — spread graph between zones; with unit tests
- [x] CON-0136 · Alpha · P1 · S · Burned-hands aftermath phase — Haller's hands require salve + thread; rank feeds `hallerFate`
- [x] CON-0137 · Alpha · P1 · S · Author `op3-11` data file — callouts, boss-fail tips, thresholds, checklist pass

## CON · Epic 7 — Chapter IV operations (Sext and None, field hospital)

### Field environment
- [x] CON-0138 · Alpha · P0 · S · Field-hospital modifiers spec — rain drips (random blood-pool spawns), moving-cart table (periodic field drift 20 px), mud contamination (salve required before thread)
- [x] CON-0139 · Alpha · P0 · M · Implement environment modifiers as op data flags — `env: ['rain','cart','mud']`; with deterministic seeded effects (tests)
- [x] CON-0140 · Alpha · P1 · S · Limited supplies rule — per-op consumable counts for thread/salve/tincture shown on HUD; running out is a soft fail state (scored, not lost)

### op4-1 "Quarrel at the Gorget" (Ruprecht, crossbowman)
- [x] CON-0141 · Alpha · P0 · S · Design spec — bolt beside the carotid; clamp artery with tongs before extraction or arterial spray adds −1 vitals/s until ligated
- [x] CON-0142 · Alpha · P0 · M · Implement Artery/Clamp entity and arterial-spray bleed rule — tests
- [x] CON-0143 · Alpha · P1 · S · Author `op4-1` data file — callouts, thresholds, checklist pass (rain modifier on)

### op4-2 "Tusk and Hoof" (Wendel, convoy guard) — horned-folk goring
- [x] CON-0144 · Alpha · P0 · S · Design spec — horn tip broken inside (lens); ticks crawl from the wound and burrow if not plucked within 6 s; dung contamination drains vitals until irrigated with leech-pipe
- [x] CON-0145 · Alpha · P0 · M · Implement Tick entity — crawl, burrow → sub-surface; and Contamination zone (tests)
- [x] CON-0146 · Alpha · P1 · S · Author `op4-2` data file — callouts, thresholds, checklist pass

### op4-3 "Delver's Lung" (Orsa's crew-mate Brakka) — crystal nodules, 3-stage sickness
- [x] CON-0147 · Alpha · P0 · S · Design spec — lung field; crystal nodules grow through stages I–III; false-recovery stage shows vitals rising while nodules grow; beard region is a no-cut zone (−score)
- [x] CON-0148 · Alpha · P0 · M · Implement Nodule staged growth and no-cut zone penalty — tests
- [x] CON-0149 · Alpha · P1 · S · Author `op4-3` data file — callouts, thresholds, checklist pass

### op4-4 "The Swallowed Strongbox" (Gutram, giant mercenary)
- [x] CON-0150 · Alpha · P0 · S · Design spec — 3 incision layers (thick hide), low organ layout needing lens, heavy retraction held with tongs, lock-pick minigame inside the stomach (rotate wheel to align 3 pins)
- [x] CON-0151 · Alpha · P0 · M · Implement layered Incision and Retractor-hold — tongs held reduces field obstruction; (tests)
- [x] CON-0152 · Alpha · P1 · M · Implement Lock minigame entity — 3 pins, wheel-driven, time penalty on slip
- [x] CON-0153 · Alpha · P1 · S · Author `op4-4` data file — callouts, thresholds, checklist pass

### op4-5 "The Dead Man's Pulse" (Lord Eckbert von Salm) — forensic/save branch
- [x] CON-0154 · Alpha · P0 · S · Design spec — lens shows one heartbeat per minute; branch A (save): extract bite-trance fang fragments and restart pulse with tincture; branch B (forensic): documented in forensic discipline
- [x] CON-0155 · Alpha · P0 · M · Implement slow-pulse vitals mode — vitals only tick on heartbeat; and branch routing via `deadManVerdict`
- [x] CON-0156 · Alpha · P1 · S · Author `op4-5` data file — callouts, thresholds, checklist pass for branch A

### op4-6 "The Thirsted Neck" (Margit, courtesan)
- [x] CON-0157 · Alpha · P0 · S · Design spec — repeated bite wounds with lodged tooth fragments, anaemia (baseDrain), bite channel choice at end: brand it (ends the thrall) or salve it (leaves it)
- [x] CON-0158 · Alpha · P0 · S · End-choice prompt entity and `thirstChoice` flag write — test
- [x] CON-0159 · Alpha · P1 · S · Author `op4-6` data file — callouts, thresholds, checklist pass

### op4-7 "The Hour of Sext" (Captain Mauer) — boss
- [x] CON-0160 · Alpha · P0 · M · Sext design spec — torpor: tool response delay up to 0.6 s, fake calm vitals shown on HUD (true vitals under lens), stone crust over organs cracked with lancet taps; stimulant tincture removes delay for 10 s
- [x] CON-0161 · Alpha · P0 · L · Implement SextMalison — InputTorpor effect, FalseVitals HUD override, StoneCrust entity (tests incl. input-delay determinism)
- [x] CON-0162 · Alpha · P1 · S · Accessibility check — torpor delay capped at 0.3 s in Assist mode
- [x] CON-0163 · Alpha · P1 · S · Author `op4-7` data file — callouts, boss-fail tips, thresholds, `mauerFate` write, checklist pass

### op4-8 "The Stone Bride" (Hanne, camp-follower)
- [x] CON-0164 · Alpha · P0 · S · Design spec — petrification front advancing from fingertips toward the heart; crack plates with lancet taps in the shown pattern, salve the living margin; Litany freezes spread; lens shows the front
- [x] CON-0165 · Alpha · P0 · M · Implement PetrifyFront — advancing polygon; and Plate tap-pattern entity (tests)
- [x] CON-0166 · Alpha · P1 · S · Author `op4-8` data file — callouts, thresholds, checklist pass

### op4-9 "The Hour of None" (Pieter, militiaman) — boss
- [x] CON-0167 · Alpha · P0 · M · None design spec — heart-seeking burrower tunnels through 4 organs; instant fail on reaching the heart; cut down in stages (3 sizes) until small enough to extract with tongs; Litany intercept window
- [x] CON-0168 · Alpha · P0 · L · Implement NoneMalison burrower pathing — seeded organ graph; stage splits and heart-fail condition (tests)
- [x] CON-0169 · Alpha · P1 · S · Precentor voice-through overlay during phase 3 — VN lines over op
- [x] CON-0170 · Alpha · P1 · S · Author `op4-9` data file — callouts, boss-fail tips, thresholds, checklist pass

## CON · Epic 8 — Chapter V operations (Vespers and Compline, Hollow Night)

### op5-1 "Choir-Throat" (Jakob, cathedral chorister)
- [x] CON-0171 · Alpha · P0 · S · Design spec — larynx grows extra vocal folds that hum; hum spreads motes to the field and mutes audio cues; excise folds only in the silence between verses (visual metronome)
- [x] CON-0172 · Alpha · P0 · M · Implement VocalFold entity — with verse/rest cycle and audio-cue mute effect (tests; subtitles still show cues)
- [x] CON-0173 · Alpha · P1 · S · Author `op5-1` data file — callouts, thresholds, checklist pass

### op5-2 "The Mouth Beneath" (Dietmar, tanner)
- [x] CON-0174 · Alpha · P0 · S · Design spec — talking abdominal cyst bargains mid-op (VN interjections), must be removed whole; rupture spawns a crawling remnant mini-boss
- [x] CON-0175 · Alpha · P0 · M · Implement Cyst — integrity meter; and Remnant mini-boss entities (tests)
- [x] CON-0176 · Alpha · P1 · S · Cyst dialogue lines keyed to Whisper band — threatens to tell Stroh specific evidence
- [x] CON-0177 · Alpha · P1 · S · Author `op5-2` data file — callouts, thresholds, checklist pass

### op5-3 "Blood of Tallow" (Greta, chandler's daughter)
- [x] CON-0178 · Alpha · P0 · S · Design spec — waxy clots in vessels; drain clots, re-warm vessels with brand on low heat (hold < 1 s taps), tincture to thin
- [x] CON-0179 · Alpha · P0 · M · Implement WaxClot and brand low-heat tap mode — tests
- [x] CON-0180 · Alpha · P1 · S · Author `op5-3` data file — callouts, thresholds, checklist pass

### op5-4 "Under the Hollow Moon" (Rosina, labouring mother) — field obstetrics
- [x] CON-0181 · Alpha · P0 · S · Design spec — caesarean on a living mother (historical Nufer account in codex); layered incision, lift the child with tongs (gentle-hold meter), ligate, close; no gore escalation, hope-giving tone
- [x] CON-0182 · Alpha · P0 · M · Implement gentle-hold tongs mode — grip pressure from hold duration; and dual-vitals (mother + child) (tests)
- [x] CON-0184 · Alpha · P1 · S · Author `op5-4` data file — callouts, thresholds, checklist pass

### op5-5 "Hexstone Shot" (Sergeant Lotte Harrach, Watch)
- [x] CON-0185 · Alpha · P0 · S · Design spec — mutagenic ball; surrounding tissue buds teeth, fingers and eyes on a root timer; excise buds before they root; lift stone only with tongs into the lead dish; touching it with other tools adds Whisper
- [x] CON-0186 · Alpha · P0 · M · Implement Bud entity — with root timer and Whisper-on-contact rule (tests)
- [x] CON-0187 · Alpha · P1 · S · Author `op5-5` data file — callouts, thresholds, checklist pass

### op5-6 "The Hour of Vespers" (Sister Ilse) — boss
- [x] CON-0188 · Alpha · P0 · M · Vespers design spec — wick-filaments turn blood to tallow; field dims over time; keep 4 lamp nodes lit with brand; curse hides in shadow (only visible within lamp radius); drain tallow clots
- [x] CON-0189 · Alpha · P0 · L · Implement VespersMalison — LampNode lighting mask and shadow-hide rule (tests)
- [x] CON-0190 · Alpha · P1 · S · Assistant swap — Haller (letter barks) or Orsa voices callouts since Ilse is the patient; data-driven assistant per op
- [x] CON-0191 · Alpha · P1 · S · Author `op5-6` data file — callouts, boss-fail tips, thresholds, checklist pass

### op5-7 "The Precentor's Remnants" (the Burgomaster's guard) — gauntlet
- [x] CON-0192 · Alpha · P1 · S · Design spec — escalation gauntlet: short phases of Prime names, Terce tongues and None burrower on one patient, 300 s
- [x] CON-0193 · Alpha · P1 · M · Implement reuse of Ch3–4 boss entities at reduced HP in one op — data only; no new code beyond HP scaling param
- [x] CON-0194 · Alpha · P1 · S · Author `op5-7` data file — callouts, thresholds, checklist pass

### op5-8 "The Hour of Compline" (Inquisitor Stroh) — final boss
- [x] CON-0195 · Alpha · P0 · M · Compline design spec — mixes all hours; mutes audio; steals the Litany (a star gesture now slows the player's own time); vitals drift toward a "peaceful" 0; break 5 silence nodes to recover the Litany; final phase needs a two-hand combo (hold tongs on core, brand with keyboard-bound second action)
- [x] CON-0196 · Alpha · P0 · L · Implement ComplineMalison phases 1–2 — mixed-hour attacks, audio mute, Litany inversion; with tests
- [x] CON-0197 · Alpha · P0 · L · Implement ComplineMalison phases 3–4 — silence nodes, Litany recovery, two-hand combo finale; with tests
- [x] CON-0198 · Alpha · P0 · S · Two-hand combo accessibility — toggle mode (tap to hold) and controller mapping verified
- [x] CON-0199 · Alpha · P1 · S · Host swap — if Stroh was lost, host is the Burgomaster (patient string and barks only)
- [x] CON-0200 · Alpha · P1 · S · Author `op5-8` data file — callouts, boss-fail tips, thresholds, checklist pass; phase checkpoints after phase 2 and 3

## CON · Epic 9 — Challenge mode ("Trials of the Guild") and X-ops

### Structure
- [x] CON-0201 · Alpha · P1 · S · Challenge mode spec — 24 X-ops in 4 tiers (Journeyman, Master, Grand Master, Unsung); tier unlock by S-ranks in previous tier
- [x] CON-0202 · Alpha · P1 · S · X-op rules layer — per-op overrides: time ×, drain ×, no-Litany, no-lens, one-life combo (any MISS fails), mirrored field
- [x] CON-0203 · Beta · P1 · S · X-op rank table — XS thresholds calibrated so perfect bot achieves XS and average bot achieves B on ≤ 50% of X-ops

### Journeyman tier (remixes of Ch1–2 content)
- [x] CON-0204 · Beta · P1 · S · X-op "Gilded Goose Closing Time" — 6 knife wounds + 2 pools, 150 s
- [x] CON-0205 · Beta · P1 · S · X-op "Gunsmiths' Tuesday" — two burst-barrel patients back-to-back, eschar + shot
- [x] CON-0206 · Beta · P1 · S · X-op "Tanners' Rows Fever" — 8 buboes, fast rot regrowth, candle light
- [x] CON-0207 · Beta · P1 · S · X-op "Barrow-Field Patrol" — gravehound + brood-mother bites on one patient
- [x] CON-0208 · Beta · P1 · S · X-op "Black Seam, Deeper" — 8 hidden hexshards, spoil spread ×1.5
- [x] CON-0209 · Beta · P1 · S · X-op "Lauds, Unanswered" — Lauds pair with 0.8 s response window, no Litany

### Master tier (Ch3–4 content)
- [x] CON-0210 · Beta · P1 · S · X-op "Roll of the Plague Dead" — Prime writing 5 names simultaneously
- [x] CON-0211 · Beta · P1 · S · X-op "Guildhall Ablaze" — Terce with 5 organ zones
- [x] CON-0212 · Beta · P1 · S · X-op "Three Worms, One Pie" — Pieman's Revenge ×3 worms with 5 s regrow
- [x] CON-0213 · Beta · P1 · S · X-op "Crossbow Volley" — 4 gorget-adjacent bolts, rain and cart modifiers _(t11: the gorget bolt under rain and cart)_
- [x] CON-0214 · Beta · P1 · S · X-op "Noonday Demon" — Sext with permanent false vitals (no lens reveal)
- [x] CON-0215 · Beta · P1 · S · X-op "Stone Wedding" — two petrification fronts from both hands

### Grand Master tier (Ch5 content and mixes)
- [x] CON-0216 · Beta · P1 · S · X-op "Hollow Choir in Full Voice" — Choir-Throat with audio mute for the whole op
- [x] CON-0217 · Beta · P1 · S · X-op "Every Lamp Out" — Vespers starting at 1 lit lamp
- [x] CON-0218 · Beta · P1 · S · X-op "Burrower's Race" — None with 2 burrowers _(t19: None split five ways, segments lethal — one burrower, since two Hours at once break its rules)_
- [x] CON-0219 · Beta · P1 · S · X-op "Compline, Alone" — Compline with no assistant callouts and no checkpoints
- [x] CON-0220 · Beta · P2 · S · X-op "Hexstone Harvest" — 3 hexstone balls, Whisper tracked as score penalty _(t21: three hexstone balls to the lead dish; the Whisper is not scored)_
- [x] CON-0221 · Beta · P2 · S · X-op "Office Entire" — Matins → Compline boss rush with carried-over vitals

### Unsung tier and procedural
- [x] CON-0222 · Beta · P2 · M · Secret X-op "The Unsung Hour" — remnants of every patient the player lost in the campaign stitched together; falls back to a curated set if none lost

## CON · Epic 10 — Other disciplines (modes)

### Field triage (Kilnrows blast, Vennmark field)
- [x] CON-0226 · Alpha · P1 · M · Triage mode spec — 4–8 incoming patients on stretchers with visible wounds and a declining clock each; player assigns tag (Immediate / Delayed / Beyond Help / Walking) and short procedures (tourniquet, pack, splint)
- [x] CON-0227 · Alpha · P1 · L · Implement triage scene simulation — DOM-free, seeded; with patient deterioration curves and scoring by lives saved + correct tags (unit tests)
- [x] CON-0228 · Alpha · P1 · M · Triage content — 3 scenarios: "Kilnrows Blast" (Ch3), "After the Ford" (Ch4), "Hollow Night Streets" (Ch5); 30 patient cards total with correct-tag answers
- [x] CON-0229 · Alpha · P2 · S · "Beyond Help" moral beat — tagging a patient Beyond Help triggers a 2-line last-rites vignette; tagging wrongly is shown in results
- [x] CON-0230 · Beta · P1 · S · Triage tutorial prompts and balance pass — average bot saves ≥ 60%

### Diagnosis and inquisition interviews
- [x] CON-0231 · Alpha · P1 · M · Interview mode spec — examine patient (click body regions for findings), ask questions from a topic list, present evidence; conclusion chosen from 3–4 diagnoses/verdicts
- [x] CON-0232 · Alpha · P1 · L · Implement interview scene — findings, questions, evidence inventory, contradiction detection; data-driven with tests
- [x] CON-0233 · Alpha · P1 · M · Interview "The Late-Turned Child" (Ch3, Liesl) — findings decide horn-bud cause; feeds `hornchildCertificate`
- [x] CON-0234 · Alpha · P1 · M · Interview "Founders' Guild Inquiry" (Ch3) — diagnose lead colic vs. curse among 3 founders; wrong answer sends the hexfire case to op3-3 unprepared (−vitals)
- [x] CON-0235 · Alpha · P0 · L · Interview "The Trial of Doctor Kreuzer" (Ch5) — Kreuzer questioned by the Tribunal; player answers and presents witnesses; outcome tally feeds verdict
- [x] CON-0236 · Beta · P1 · S · Interview content QA — every question path reachable; contradiction pairs tested

### Bone-setting
- [x] CON-0237 · Alpha · P1 · M · Bone-setting mode spec — X-ray-free: palpate with lens (bone silhouettes), traction via mouse drag with tension meter, rotate fragments with wheel, splint with thread
- [x] CON-0238 · Alpha · P1 · L · Implement Bone/Fragment entities — with alignment scoring (angle and gap tolerances) and over-traction damage (tests)
- [x] CON-0239 · Alpha · P1 · M · Bone-setting content — 4 cases: "Kicked by a Dray-Horse" (tibia), "Fall from the Scaffold" (radius/ulna), "Pike-Shaft Blow" (collarbone), "Rack-Broken Hands" (Ch5, Tribunal victim, many small fragments)
- [x] CON-0240 · Beta · P2 · S · Bone-setting tutorial and balance pass — average bot aligns ≥ 70% of fragments within tolerance

### Forensic post-mortem
- [x] CON-0241 · Alpha · P1 · M · Forensic mode spec — no vitals; timer is "candle length"; find, document and tag wounds/foreign bodies in a corpse; conclusion answers cause and manner of death
- [x] CON-0242 · Alpha · P1 · L · Implement forensic scene — evidence tagging, notebook, conclusion validator; reusing op entities in inert mode (tests)
- [x] CON-0243 · Alpha · P1 · M · Forensic "The Dead Man's Pulse" branch B (Ch4) — prove Lord von Salm is undead or bite-tranced; writes `deadManVerdict`
- [x] CON-0244 · Alpha · P1 · M · Forensic "The Registrar's Predecessor" (Ch3) — body found with a partial name-sigil, foreshadows Prime
- [x] CON-0245 · Alpha · P2 · M · Forensic "The Widow's Coachman" (Ch4) — evidence ties Widow Reiss's carriage to the Choir (patron betrayal clue)
- [x] CON-0246 · Beta · P2 · S · Forensic tutorial and balance pass — perfect evidence rate achievable in ≤ 70% of candle

### Discipline integration
- [x] CON-0247 · Alpha · P1 · S · Campaign step kinds `triage` — `interview`, `bonesetting`, `forensic` added to campaign graph schema with validation
- [x] CON-0248 · Beta · P2 · S · Discipline challenge entries — 2 X-ops per discipline in challenge mode

## CON · Epic 11 — Content integration (Beta) and release checks
- [x] CON-0252 · Beta · P1 · S · Codex/case-note unlock audit across full campaign graph — all branches
- [x] CON-0253 · Beta · P1 · S · Full-campaign playthrough script — QA route covering each ending with flag setup; 4 routes documented

