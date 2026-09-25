# Medical-lore primer for writers (NAR-0008)

One page. **What the characters believe** (humoral medicine, c. 1500) versus **what the game's
mechanics actually do**. Write dialogue from the left column; make sure it never contradicts the right.
Period sources for the look and words: `docs/loc/period-medicine.md`.

## The belief system in five lines
1. The body holds four **humours** — blood (hot, wet), phlegm (cold, wet), yellow bile (hot, dry) and
   black bile (cold, dry). Health is their balance; disease is one in excess or gone bad.
2. Wounds fester when **corrupt humours** or **bad air** (miasma, vapours) get in. Pus that is thick and
   white is "laudable" (a good sign); thin, green or stinking pus is not.
3. Fever is heat; you cool it, bleed it, or sweat it out. Plague is a corruption of the air that
   gathers in **buboes**, which must be ripened and lanced.
4. Surgery is a craft (the guilds'), physick is a learned art (the universities'), and both are
   suspicious of anything that works too well.
5. Curses are real in this world. Folk medicine blurs the line between a curse, a fever and a sin.

## Belief versus mechanic

| Instrument / act | What Kreuzer, Haller and Ilse say it does | What the game actually does | Safe lines | Never write |
|---|---|---|---|---|
| **Leech-Pipe** (drain) | Draws off pooled blood and corrupt humours so the wound can be seen and closed | Removes `BloodPool` / pus / bile; stitching over a pool is blocked | "Draw it off", "drain the bile", "you can't stitch through a pool" | "Suction", "remove the fluid" |
| **Gut Thread** (suture) | Closes the wound so humours stay in and bad air stays out | Zig-zag stitch closes `Laceration` / incisions | "Stitch", "close him", "a strong arm on the thread" | "Sutures" as a clinical noun in dialogue (fine in UI) |
| **Saint's Salve** (gel) | A balm of honey, turpentine and the Saint's blessing that seals small wounds and checks rot | Heals small nicks, clears `Rot`, finishes burns after eschar | "Salve it", "seal the margin", "check the rot" | "Antibiotic", "disinfect" |
| **Tincture** (syringe) | A cordial that strengthens the heart and "steadies the pulse"; also antidotes and draughts (anthelmintic, chelating) | Restores vitals; neutralises venom when held on the bite; certain `TinctureSite`s | "If his pulse flags — the tincture", "hold it on the bite until it draws" | "Adrenaline", "inject", "dose" (use "draught", "hold it to the flesh") |
| **Cautery Brand** (laser) | Hot iron seals vessels, burns out rot and kills what crawls in wounds; sears curse-writing | Kills `Grub`s, sears `Sigil`s and Malison flesh; damages healthy flesh | "Sear it", "burn the grubs, not the man" | "Laser", "sterilise" |
| **Lancet** (scalpel) | Opens, lances ripe buboes, nicks barbs free | Incisions, lancing, nicks | "Lance it", "open him along the line" | "Scalpel" (fine as a gloss in codex) |
| **Tongs** (forceps) | Pulls out what doesn't belong | Extracts `Embedded`, eschar, worms | "Pluck", "draw it out whole" | — |
| **Scrying Lens** (ultrasound) | An old glass that shows what hides beneath skin — Haller swears it is optics, not magic | Reveals `hidden` entities | "Pass it slowly", "where it shimmers" | "Scan", "X-ray" |
| **Litany of Stillness** | A rite from the old offices; "still your heart and the world waits" | Slows time ~8 s, once per operation | "The world will wait for you", "for eight heartbeats" | "Time magic", "bullet time", "slow-mo" |
| **Vitals** | "His pulse", "his colour", "his breath", "he's slipping" | 0–99 meter | "His pulse is weak", "he's greying" | "Blood pressure", "heart rate numbers" |

## Diseases as the world names them
- **Festering / wound-fever** — what we'd call infection. Caused (they think) by cloth, dirt, bad air,
  or salving over dead flesh. Mechanically: rot spawns, cloth fragments cause a fever phase.
- **Plague (buboes, pestilent humours)** — bad air in poor quarters; lance, drain, salve.
- **Founder's colic** — lead in the blood from bell-pits; "heavy blood". Chelating draught (tincture).
- **Delver's lung** — crystal dust grown in the lung; a false recovery before the worst.
- **The thirst** — blood-debt from a drinking thing; a week without pain after each feeding.
- **Petrification** — the stone front; Ilse's "stone bride".

## Rules
- Characters are **right about practice and wrong about causes**: they drain, stitch, clean and
  close because it works, and explain it with humours. Don't make them accidentally modern.
- Nobody says *germ, bacteria, virus, infection, sterile, antiseptic* (the narrative lint fails).
- The Guild's rules are often the villain (fees before surgery, no cadaver study); good medicine is
  frequently *against* the rules. Kreuzer's anatomical knowledge is itself slightly suspect.
- Pain is real and treated seriously: a tincture or a strap, never a joke.
