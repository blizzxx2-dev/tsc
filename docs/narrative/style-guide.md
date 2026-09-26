# Narrative style guide — *Suture & Steel: The Malison Hours*

For everyone who writes player-facing words: scenes, barks, codex, case notes, briefings, store copy.
Companion documents: `bible.md` (world), `calendar.md`, `timeline.md`, `medical-primer.md`,
`names.csv` (every proper noun, IP-checked), `beat-sheets.md`, `docs/loc/style-guide.md` (translation).
Research and the IP avoid-list: `docs/research/warhammer-fantasy-tone.md` (§1 pillars, §7 avoid-list).

Automated checks: `node scripts/narrative-lint.mjs` (diction, avoid-list) and `tests/narrative.test.ts`
(line lengths, scene budgets, variants). Both run in `npx vitest run`.

---

## 1. The six pillars (NAR-0001)

Each pillar has two lines from the Chapter I–II script that do it, and two that don't (rejected drafts,
kept here as warnings).

### 1. Mercy in a merciless world
Saving a life is the only victory, and it is always provisional. Kreuzer never wins an argument; he wins a patient.
- **Do** — `s2-4` Ilse: “…Doctor. Whatever he is, he’s a patient.”
- **Do** — `s1-2` Kreuzer: “Then put him down gently, Captain, and stop counting him among the dead.”
- **Don't** — *“Another life saved! The hospice triumphs again!”* (victory-lap; mercy is quiet and provisional)
- **Don't** — *“He’s a heretic. Let him burn — after I’ve finished with him.”* (Kreuzer never ranks patients by worth)

### 2. The body as a battlefield
Wounds are sorted by what made them. The cold open is the Wound Man: a body stuck with every weapon, and standing.
- **Do** — `prologue` narrator: “Beneath it, in faded ink: ‘Here is the battlefield. Hold it.’”
- **Do** — `s1-2` Haller: “Horned-folk heads are barbed like fish-hooks. They cut a notch in their antlers for every one that sticks in a man.”
- **Don't** — *“He’s hurt pretty badly.”* (name the weapon, the wound, the cost)
- **Don't** — *“The magic wound glows with dark energy.”* (curses are wounds with anatomy, not light shows)

### 3. Every miracle is evidence
Skill that looks supernatural is noticed, counted and written down. Stroh is always counting.
- **Do** — `s2-end` Stroh: “When that thing screamed, every candle in this tent stopped flickering. The flames stood still. For eight heartbeats.” / “I counted.”
- **Do** — `s1-5` Haller: “Do not do it where the Inquisitor can see. The Tribunal does not distinguish between a prayer and a spell.”
- **Don't** — *“Nobody noticed the Doctor slow time.”* (somebody always notices)
- **Don't** — *Kreuzer: “Behold, the power of the Litany!”* (he hides it; he never performs it)

### 4. Gallows humour aimed at institutions
Jokes land on guilds, councils, tribunals, folk cures and pie vendors — never on the patient's suffering (§2).
- **Do** — `s1-3` Ilse: “The Guild will pay for his care. Once we have paid the Guild’s fee for inspecting its own burst barrel.”
- **Do** — `s2-1` Mauer: “The Inquisitor dines with the Burgomaster on Thursdays. On Fridays, the Burgomaster signs things.”
- **Don't** — *“Look at him squeal like a pig!”* (mocks the patient's pain)
- **Don't** — *“Plague again? These peasants never learn to wash.”* (punches down at the sick and poor)

### 5. Material honesty
Tallow, brass, gut thread, leeches, turnips, ledgers. Name the thing, its weight and its smell.
- **Do** — `a1-1` Ilse: “Under ‘fees, vegetable’. We have a column. It is the longest one in the ledger.”
- **Do** — `s2-2` Orsa: “The rock went black, Doctor. Black as a wet eye, and it had a pulse.”
- **Don't** — *“He used the medical equipment.”* (which instrument? made of what?)
- **Don't** — *“A mysterious green crystal.”* (vague, and the green-glowing rock is someone else's; hexstone is black glass with a heartbeat)

### 6. Institutions as antagonists
The Guild, the council and the Tribunal are as dangerous as any Malison, and more patient.
- **Do** — `s1-2` Mauer: “Twelve went out with the timber-road caravan. Twelve came back, eleven walking.” (the Watch counts; the council does not)
- **Do** — `s1-4` Stroh: “Pestilence so often has a sponsor — and I hear the Kilnrows are coughing too.”
- **Don't** — *“The Inquisitor is evil and wants everyone dead.”* (Stroh is reasonable by his own law; that is what makes him frightening)
- **Don't** — *“The council, wise and just, sends aid.”* (it sends writs, invoices and quarantine chains)

---

## 2. The humour rule (NAR-0002)

> **Jokes target institutions and folk belief, never the patient's suffering.**

A line may be funny about a patient (Orsa's bluster, Matthis's pride) only if the patient is the one
making the joke, or the joke is about something they chose. Pain, fear, disfigurement, poverty, faith
and death are never the punchline. Supporting rules:
- The laugh goes *up* (guilds, councils, Tribunal, Burgomaster) or *sideways* (folk cures, superstitions, pie-men), never *down*.
- A joke may sit next to horror but not inside it: no quips during a patient's death (failure scenes are never funny).
- Kreuzer's humour is dry and defensive; Haller's is contempt for institutions; Ilse's is ledger-dry; Mauer's is military exasperation; Orsa's is bluster; Stroh's is not humour — until Chapter III thaws him into the odd dry line at his own expense.

### Audit — every Chapter I–II joke line (re-run after each script change)

| Id | Line (abridged) | Target | Verdict |
|---|---|---|---|
| prologue.010 | “…just in time for the Tuesday knife-fights.” | Kessendorf's tavern violence | Pass |
| prologue.011 | “…the instruments, the ledgers, and the Master’s temper.” | Haller (a speaker, not a patient) | Pass |
| prologue.012 | “Somebody at the Crooked Goose disagreed with his dice.” | Tavern culture (the drover is not mocked for the wound) | Pass |
| a1-1.001 | “He pays in turnips… He will break it by Friday.” | The drover's *choice* to gamble, not his wound | Pass |
| a1-1.002–.004 | Haller: “simple work… I call it Tuesday… not leisurely” | The surgeon's performance | Pass |
| a1-1.006 | “Under ‘fees, vegetable’. We have a column.” | Hospice poverty / bookkeeping | Pass |
| s1-2.004 | “Twelve came back, eleven walking.” | — (character tic, not a joke on Pieter) | Pass |
| s1-2.007 | Antler notches per arrow | Folk custom of the raiders (grim, not comic) | Pass |
| a1-2.002 | “The Watch pays its debts… Slowly, but it pays.” | The Watch as institution | Pass |
| s1-3.001 | Second sack of turnips | Word of mouth / poverty economy | Pass |
| s1-3.004–.006 | Gunsmiths' Guild fee; “pays the Guild for the privilege of being shot by its work”; itemised bill | Guild | Pass |
| a1-3.001 | “Nobody keeps the barrel.” | The Guild's failed barrel | Pass |
| a1-3.002–.003 | Master wants the lead back; “best-proven lead in Kessendorf” | The master / Guild avarice | Pass |
| s1-4.003 | Matthis: “I had a trade before I had a fever.” | — (dignity line; deliberately not played for laughs) | Pass |
| a1-4.004 | Stroh: “In my experience, everything does.” | The Tribunal's paranoia | Pass |
| s2-1.003 | Stroh dines with the Burgomaster; “On Fridays, the Burgomaster signs things.” | Council corruption | Pass |
| s2-1.005–.007 | Counting the cook; counting the mules | Mauer's tic / army life | Pass |
| a2-1.002 | “I am starting to like you, Doctor, and I don’t care for it.” | Mauer | Pass |
| s2-2.001 | Orsa: “I can… mostly walk.” | Orsa's own bluster (she makes the joke) | Pass |
| s2-2.005 | Debt-knots: “my sons are idle.” | Orsa's family, by Orsa | Pass |
| s2-2.007 | “Break anything else of his first.” | Haller | Pass |
| s2-2.008 | “Dwarf hide’s thicker than yours, lad.” | Orsa, about herself | Pass |
| a2-2.001–.003 | The Kreuzer Deep “will probably be a bad one” | Kreuzer | Pass |
| s2-3.001 | Snoring keeps the wolves off | Camp superstition / Orsa (asleep, not suffering) | Pass |
| s2-3.002 | “Wrapped up like a midwinter ham.” | — | **Pass with note**: said of a victim. Kept because the image is the web, not his pain, and Mauer is not laughing; revisit at table read (NAR-0176). |
| a2-3.002–.003 | “Spider-cutter”; “called worse by better men” | Soldiers' nicknames / Kreuzer | Pass |
| s2-4.005 | “The dead are poor at answering them.” | Stroh's cruelty (not a joke on the prisoner's pain; characterises Stroh) | Pass |
| s2-end.011 | “It was a long night, Inquisitor.” | Kreuzer's evasion | Pass |
| *rejected* | *“Try not to scream, he said, and the drover screamed.”* | The patient's pain | **Fail — cut** |
| *rejected* | *Vagrant: “Unknown vagrant”* as a punchline to the queue | The poor | **Fail — replaced by Matthis Kolb (NAR-0030)** |

### Audit — every Chapter III–V joke line (NAR-0178)

| Id | Line (abridged) | Target | Verdict |
|---|---|---|---|
| s3-3.001 | Windows “bow inward and then, politely, stay whole” | The building (next to the blast, not inside anyone’s death) | Pass |
| s3-3.004–.006 | Anno: master thinks he’s shirking; crooked eyebrows | Anno, about himself | Pass |
| s3-4.008–.009 | Founders’ Guild invoices for the lead; “collect it from the privy” | Guild | Pass |
| s3-5.003 | Vapour-wardens’ beef “stolen by noon” | Folk cure | Pass |
| s3-6.001–.003 | The pie-shop “is not happy”; “They were not eel” | Pie vendor (Frieda’s worms are not the joke) | Pass |
| s3-6b.002 | Mother Agathe: “Clean lancet, boy” | Agathe’s own bluster | Pass |
| s3-8.001–.002 | Stroh’s jaw “like a plum”; “You are what remains” | The Tribunal needing its suspect (the laugh goes up) | Pass |
| s3-8.005, .007 | “Open wider, Inquisitor”; “even a man of the Tribunal” | Tribunal | Pass |
| s3-9.010, .012 | “Practically a garland”; “stop being paid for it” | Guild | Pass |
| s3-10.005 | “You’ll want it for shouting at me afterwards” | Haller’s temper (bedside comfort, not his burns) | Pass |
| s3-end.002, .012 | “Honest, which is inconvenient”; “badly, and with a great deal of advice” | Haller, about himself | Pass |
| s3-end.017, .022 | “Not a lie if you are looking at the lamp”; “It will worry him” | Tribunal | Pass |
| s4-1.015 | Ushkar: “It pulled back” | Ushkar, about himself | Pass |
| s4-2.012 | Wendel: “the rude bastard” | The one raider who gored him — not the horned folk as a people (bible §7) | **Pass with note** |
| s4-3.001–.003 | The Kreuzer Deep fell in; “Very like you, on your first day” | Orsa’s bluster / Kreuzer | Pass |
| s4-4.002–.005 | Gutram ate the strongbox “from… thieves” | Something Gutram chose (not his pain) | Pass |
| s4-6.001 | “The chaplain pretends not to know” | The chaplaincy | Pass |
| s4-8.013–.014 | “Mostly complaints about the price” | Hospice poverty / the Tribunal’s reading | Pass |
| s4-9.004 | “Hold his bride together with my own hands” | Mauer’s exasperation (not Hanne’s stone) | Pass |
| s4-10.001, .011–.012 | Capital letters; “Do not tell the Guild”; “Ink will have to do” | Haller, about his own hands | Pass |
| s4-end.020 | “A very rude drawing of the Precentor” | The villain | Pass |
| s5-1.007–.009 | The drover drives “very slowly” | The bailiff and the warrant | Pass |
| s5-2.001, .012 | “The Widow Reiss chose the judges”; “saved the trouble” | Council / court | Pass |
| s5-2.015 | Orsa: “Witchcraft? Pah.” | Tribunal | Pass |
| s5-3.007, .017 | “A very long supper”; “hang leaning on a crutch” | Gaolers / Mauer about himself | Pass |
| s5-3.010–.014, s5-end.012–.013, s5-end-exile.010 | The very good tunnel; the Kreuzer Hope | Orsa’s bluster | Pass |
| s5-6.001–.004 | The cyst “has opinions” | The curse (Dietmar’s own line .005 is played straight) | **Pass with note** |
| s5-9b.008–.011 | “Your most irritating quality”; “anything more foolish” | Kreuzer | Pass |
| s5-end.004–.005 | “I had rather got used to the idea / the damp” | Kreuzer, about his own sentence | Pass |
| s5-end.009, s5-end-pyre.012 | Stroh’s “very small fire”; “a very Kessendorf solution” | The law, and Stroh himself — see §5 on Stroh’s thaw | Pass |
| s5-end.011, .015 | “Very large, very polite rats”; Voss voted against | Council / Guild | Pass |
| s5-end-pyre.009, .016 | “The Watch declines to do anything about it”; “a very sharp knife” | Watch / licensing | Pass |
| s5-end-exile.006, .016 | “She is always furious”; the new surgeon “is terrible” | The Order / Haller | Pass |
| s5-epilogue.008 | “He would have hated the fuss” | Haller’s temper and the Guild’s bell, beside his death | **Pass with note** |
| s5-epilogue.035 | “A surfeit of Thursday dinners… several cooks” | The Burgomaster’s gluttony (the laugh goes up) | **Pass with note** |
| a3-1.001 | Liesl asks to keep the bits of horn | Liesl’s own delight | Pass |
| a3-3.002–.003 | The privy basket; “lightly used” | Guild | Pass |
| a3-5.001–.002 | Berthold’s horse “the right way round”; “hold you to the cushion” | Berthold, about his own leg | Pass |
| a3-9.002–.003 | Stroh: “So, very nearly, did I” | Stroh, about his own tooth | Pass |
| a3-10.003 | “Read something with a happy ending” | Kreuzer’s bedside manner | Pass |
| *rewritten* | *s5-epilogue.029: Emmerich’s fever “the most ordinary thing he ever did”* | His death as the punchline | **Fail — rewritten**: his mother keeps his candle |

---

## 3. Diction (NAR-0003)

**Register:** early-modern and concrete, **without** mock-archaic pronouns. Characters speak in plain,
slightly formal sentences; contractions are fine in speech (“don’t”, “he’ll”), rarer in narration.
- **Never:** thee, thou, thy, thine, ye, hath, doth, dost, shalt, wilt (not even the Choir).
- **Banned modern words** (the lint fails on them): okay/ok, stress(ed), germ(s), bacteria, virus,
  infection/infected/infectious (the world has no germ theory: say *festering, wound-fever, corruption,
  bad air, rot*), adrenaline, sterile/sterilise, antiseptic, antibiotic, oxygen, hormone, trauma, guys, weekend.
- **Prefer:** humours, bile, pus, rot, festering, flux, fever, pulse, vapours, draught, tincture,
  salve, physick; *league* not *mile*; bells and canonical hours not *o’clock* (numbers like
  “one beat a minute” are allowed in medicine).
- **Units:** leagues, ells, ounces, pounds, heartbeats. Money: pennies, shillings, guilders.
- **Oaths:** “Saints”, “Saint Ildra”, “damn you”. No real-world deity names; no “God” as a proper-noun oath from Ilse (the Order swears by the Saint).
- **Typography:** curly quotes (’ “ ”), em dash — with spaces, ellipsis … as one character, and
  small caps only via the display font. Hour names capitalised (Matins, Lauds); *the Office*, *the Choir*, *the Litany*.

## 4. Length (NAR-0004)

| Text | Limit | Enforced by |
|---|---|---|
| VN line (story, aftermath, failure) | ≤ 140 characters | `tests/narrative.test.ts`, `tests/content-later.test.ts` |
| Bark | ≤ 60 characters | `tests/barks.test.ts` |
| Callout label (rating/popup text over the field: `label.*`, `popup.*`) | ≤ 28 characters | `tests/narrative.test.ts` |
| Scene (Ch1–2) | chapter opener and end ≤ 14 lines, mid-chapter ≤ 10 (NAR-0036) | `tests/narrative.test.ts` |
| Scene (Ch3–5) | ≤ 14 lines in the longest variant any flags allow; the crypt (s5-10) and the three endings ≤ 24 (NAR-0178) | `tests/narrative.test.ts` |
| Codex body | ≤ 180 words | `tests/codex.test.ts` |
| Case note | ≤ 120 words | `tests/codex.test.ts` |

## 5. Voices (quick reference)

| Speaker | Sounds like | Never |
|---|---|---|
| Kreuzer | Short, dry, deflecting; kind in deeds, curt in words. Never exclaims; spoken lines ≤ 130 characters (NAR-0178, tested) | Speeches; boasting; theology |
| Ilse | Precise, ledger-minded, faith spoken plainly | Hysteria; sermonising |
| Haller | Gruff contempt for letters and guilds; love shown as insult | Warmth said aloud (until Ch3) |
| Stroh | Courteous, patient, legal; counts everything. From his tooth (Ch3) a rare dry line, always at himself or the law | Shouting; cartoon cruelty; a joke at a prisoner |
| Mauer | Counts his men; impatient; loyal downward | Cowardice; eloquence |
| Orsa | Loud, proud, generous; mountain customs stated as facts | Grudges, runes, oaths of vengeance (see `bible.md` §Mountain-folk) |
| The Malison / Choir | Liturgical, soft, second person; short lines | Thee/thou; gloating monologues over 4 lines |

## 6. Conditional lines

Variant lines are marked with `when({...}, …lines)` (`src/content/conditions.ts`) and keep their own
line ids. Write every variant so the scene reads naturally both ways, and so the *canonical* variant
(Litany spoken, middling rank) works when a player resumes from a save.
