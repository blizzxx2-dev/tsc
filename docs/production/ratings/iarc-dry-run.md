# Age-rating dry run — Chapters I–II (OPS-0074)

Draft answers to the IARC questionnaire topics for the **demo content (Ch I–II)**, written from the
current build and scripts (`src/content/chapter1.ts`, `chapter2.ts`, `src/surgery/*`), to preview
the likely PEGI/USK/ESRB-equivalent outcomes **before** final art locks. This is a self-assessment, not
a rating; the formal questionnaire is submitted through an IARC-participating storefront or the rating
bodies directly when required (see [territories.md](territories.md)). Re-answer at every content lock and
for Chapters III–V (OPS-0080).

## Content inventory (what a rater will see)
| Area | What is in Ch I–II | Examples |
|---|---|---|
| Blood & gore | **Frequent, detailed surgical gore**: open incisions, pooled blood drained, lacerations stitched, embedded arrows/bolts/lead shot/fangs pulled from flesh, burns, buboes lanced (pus), rot debrided, maggot-like grubs removed, egg sacs lanced; a stylised organic curse (the Malison) cut and seared inside the patient. Rendered in a painterly shader, top-down on an isolated patch of flesh; no faces or dismemberment during surgery | op1-2 barbed arrow, op1-4 buboes/rot, op2-3 egg sacs, op1-5/op2-5 Malison |
| Violence | The player never harms anyone; violence is **off-screen and narrated** (tavern knife fight, raider ambush, beast attacks, witch-hunter custody). Injuries are the aftermath | s1-2, s2-4 |
| Death | Patients can die on the table (failure screen "The Patient Is Lost"); the player must restart | loss screen |
| Horror / fear | Occult body-horror boss inside the patient; curse sigils; dark candlelit tone; heartbeat audio at low vitals | Matins, Lauds |
| Religion / occult | Fictional church, saints and a heretic coven; witch hunters; the player draws a **five-pointed star** to invoke a prayer that slows time; curse sigils are broken with the cautery | Litany, sigils |
| Language | Mild: "damn you" (s1-2) and period insults; no strong profanity | s1-2.002 |
| Alcohol / drugs | Tavern setting mentioned; medicinal tinctures and antidotes; no use of recreational drugs shown or rewarded | op1-1, venom ops |
| Gambling | Mentioned in narration (a patient's dice game); not playable | s1-2.001 |
| Sexual content / nudity | None. Patients' bodies are shown only as a patch of skin/flesh | — |
| Discrimination | Witch-hunt persecution depicted critically; no real-world group targeted | Stroh scenes |
| Interactive elements | No purchases, no user-to-user communication, no location sharing; opt-in telemetry | — |

## Draft questionnaire answers (IARC topics)
| Question topic | Draft answer |
|---|---|
| Violence — does the game contain violence? | Yes: depictions of injuries and their surgical treatment; violence itself is referenced, not shown or performed by the player |
| Violence against humans / realistic appearance | Injuries on human (and one dwarf) patients; painterly, not photo-realistic; no player-initiated violence |
| Blood | Yes, frequent |
| Gore (dismemberment, mutilation, visible organs) | Yes: open wounds, extracted objects, pus, rot and visible tissue during surgery; no dismemberment |
| Horror / fear | Yes: body-horror boss, dark themes, sudden curse "lash-out" events |
| Sexual content / nudity | No |
| Strong language | No (mild only) |
| Controlled substances | No (medicine only) |
| Simulated gambling | No |
| Crude humour | Mild gallows humour, no crude/bodily humour for its own sake |
| Discrimination | No |
| In-game purchases | No |
| Users interact / share location | No |

## Predicted outcomes (to confirm)
| System | Likely rating | Drivers |
|---|---|---|
| PEGI | **16** (possible 18 if gore is judged "gross" after final art) | Realistic-looking injuries/gore, horror |
| USK (Germany) | **16** | Gore in a medical context, occult themes; not glorifying violence |
| ESRB | **M (Mature 17+)** — descriptors *Blood and Gore*, *Violent References*, *Mild Language* | Detailed surgical gore |
| ClassInd (Brazil) | 16 | Gore/violence |
| ACB (Australia) | MA15+ | Gore in context; no incentive-linked violence |
| GRAC (Korea) | 15 or 18 (Beta, OPS-0079) | Gore |

## Feed to ART and UIX
- **ART gore-tone target:** keep surgical detail painterly and contained to the operating patch; avoid
  photo-real textures and any dismemberment imagery so the target stays PEGI 16 / USK 16 / ESRB M.
- **UIX gore-level default:** ship a *Gore: Full / Reduced* option (Reduced desaturates blood and
  swaps pus/rot to muted tones); **default Full**, but show the content warning on first launch and on
  the store page. A Reduced default is not needed for these predicted ratings.
