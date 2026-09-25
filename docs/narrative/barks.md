# Bark taxonomy — *Suture & Steel: The Malison Hours* (NAR-0070)

A **bark** is a short, unscripted line an observer says during an operation: Sister Ilse at the
table, Master Haller supervising the first two cases, Captain Mauer in the camp tent, Inquisitor
Stroh watching from the wall, the patient under the knife, and the Hour itself whispering from the
wound. Barks are flavour. They never carry instructions the player needs — those are the scripted
phase callouts (`OperationDef.phases[].callout`), the sim's own danger lines and the tutorial prompts,
which always outrank a bark in the callout queue.

Data: `src/content/barks.ts`. Runtime: `src/content/barkDirector.ts` (subscribes to the operation's
event bus and calls `op.say` at `praise` priority). Style: `style-guide.md` (§3 diction, §2 humour
rule — a patient's pain is never the joke; a patient may joke about their own choices).

## 1. Triggers

Trigger ids are the keys of `BARKS[speaker]`. "Max" is the most times the trigger may fire in one
operation (`BARK_LIMITS`); "Source" is the sim event the director listens to.

| Trigger | When | Max / op | Source |
|---|---|---|---|
| `op-start` | The first frame of the operation, after the phase-0 callout. | 1 | attach |
| `cool` | A COOL rating. | 6 | `rate` (rating = cool) |
| `good` | A GOOD rating. | 4 | `rate` (rating = good) |
| `bad` | A BAD rating. | 4 | `rate` (rating = bad) |
| `miss` | A MISS (wrong tool, cut on healthy flesh, a lapsed combo). | 4 | `rate` (rating = miss) |
| `combo-5` | The combo counter reaches 5. | 2 | `rate` (combo = 5) |
| `combo-10` | The combo counter reaches 10. | 2 | `rate` (combo = 10) |
| `combo-20` | The combo counter reaches 20. | 1 | `rate` (combo = 20) |
| `vitals-30` | Vitals fall below 30 (re-arms once they climb above 40). | 2 | `hurt` (vitals) |
| `vitals-15` | Vitals fall below 15 (re-arms above 25). | 2 | `hurt` (vitals) |
| `tincture` | A tincture draught steadies the patient. | 3 | `heal` |
| `litany` | The Litany of Stillness is spoken. | 2 | `litany` |
| `phase` | A new phase begins (not the first). | every phase | `phase` (index > 0) |
| `enraged` | A Malison changes temper (Matins' eye opens; Lauds' second voice answers). | 2 | `phase` on a boss op, or `director.fire('enraged')` |
| `success` | The operation is won. | 1 | `win` |
| `fail` | The patient is lost. | 1 | `lose` |
| `idle` | No rated action for 12 s while something remains to do. | 2 | director clock |
| `time-30` | Less than thirty seconds remain on the sand-glass. | 1 | director clock |

Speakers have different **coverage**: Ilse has at least six variants for every trigger; Haller at
least three; Mauer covers the camp-tent set (`op-start`, ratings, combos, vitals, `tincture`, `phase`,
`success`, `fail`, `idle`, `time-30`); Stroh speaks **only** on `litany`, `enraged`, `phase`, `success`
and `fail`, and only when he is present (`STROH_PRESENT`: op1-4, op1-5, op2-4, op2-5). Patients use
their own trigger set (`first-cut`, `extract`, `closing`, `pain`, `relief`), keyed by operation id.
The Malisons whisper on boss phases (`MALISON_WHISPERS`).

### Who speaks on which operation (`speakerFor(opId)`)

| Ops | Speaker | Why |
|---|---|---|
| op1-1, op1-2 | Haller | Haller supervises Kreuzer's first two cases; Ilse holds the tray. |
| op1-3, op1-4, op1-5 | Ilse | The hospice theatre. |
| op2-1, op2-2, op2-3, op2-5 | Mauer | The camp tent in the Grauwald; Ilse assists but the Captain talks. |
| op2-4 | Ilse | The Tribunal cell; Stroh is present and also speaks. |
| anything else | Ilse | Challenge mode, the Practice Theatre, later chapters. |

Stroh adds his lines on top of the primary speaker's when present. The sim's own danger callouts
("Vitals are failing!", "We're losing him!") are in Ilse's voice, so when **Ilse** is the speaker the
director does not fire her `vitals-30` / `vitals-15` barks — they would double the line. Haller,
Mauer and Stroh fire theirs.

## 2. Cooldown and priority rules

1. **Global cooldown: 6 s** between any two barks in an operation (`BARK_COOLDOWN`), measured on the
   sim clock (`op.elapsed`) so pausing does not eat it. `success`, `fail`, `litany` and `enraged`
   ignore the cooldown (they are the moment); everything else waits and is **dropped**, not queued,
   if the cooldown is running. A dropped bark does not count against its trigger's limit.
2. **Per-trigger limits** (`BARK_LIMITS`, the Max column) cap repetition inside one operation.
3. **Priority**: every bark is queued at `praise` priority. Scripted callouts (`instruction`) and the
   sim's danger lines (`danger`) always jump ahead of it, and the queue discards praise lines beyond
   six, so barks can never delay an instruction.
4. **Rating barks are sampled**, not fired on every rating: `cool` fires on roughly one COOL in four,
   `good` one in six, `bad` one in two, `miss` on every one (they are rare and instructive).
5. **Combos** fire only on the exact milestone, once per climb; the counter must lapse and climb
   again before the same milestone can speak.
6. **Vitals** triggers re-arm with hysteresis (`vitals-30` above 40, `vitals-15` above 25).
7. Barks never fire during the resume countdown, the pause overlay, a dialogue insert, or after
   `win`/`lose` (other than `success`/`fail` themselves).
8. **Nothing funny on `fail`.** Failure lines are quiet and never joke (style guide §2).

## 3. Anti-repeat rule (NAR-0077)

`pickBark(speaker, trigger, rng)` chooses uniformly among the trigger's variants **excluding the last
three lines it returned for that speaker and trigger** (or the last `n − 1` when a trigger has fewer
than four variants, so the choice is always non-empty). The history is per speaker and trigger and is
cleared by `resetBarkHistory()` at the start of each operation. `tests/content-barks.test.ts` fires
1000 triggers and asserts no line repeats within three fires and every variant is heard.

Cosmetic choices use `Math.random` by default; the director never touches `op.rng`, so a bark cannot
change a seeded run (golden-op tests stay valid).

## 4. Writing rules for bark lines

- ≤ 90 characters; one sentence, two at most. They show in the callout panel for a few seconds.
- Early-modern register, no mock-archaic pronouns, no modern words (`scripts/narrative-lint.mjs` scans
  `src/content/**`). Say "he" or "she" as the patient's line does; where the speaker cannot know,
  say "the patient" or the name.
- Each speaker keeps their voice: Ilse ledger-dry and kind; Haller contemptuous of guilds and gentle
  with nobody; Mauer counting and impatient ("Is he fit to march?"); Stroh counting evidence, never
  humorous; patients frightened, brave or drunk, but never the punchline.
- Ratings: praise is scarce (Haller almost never praises). A BAD is named as a fact, not a scolding.
- Litany lines are the only place Ilse's fear of the gift shows; Stroh's are the only place it is counted.
- Whispers (Matins, Lauds) are verse fragments the Choir might sing — original, no real liturgy.
