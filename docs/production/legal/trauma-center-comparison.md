# *Trauma Center* expression and trade-dress comparison (prepares OPS-0049/OPS-0050)

**Status: internal comparison for counsel — not legal advice.** Counsel writes the memo and decides
which differences are required; each required change becomes a ticket owned by UIX, GAM or ART.
Sources for the Atlus side: `docs/research/trauma-center.md` (wiki, LP archives, reviews cited there).
Our side: the current build (`src/scenes/operation.ts`, `src/surgery/*`, `src/content/*`).

Background: game *mechanics and genres* are generally not protected by copyright, but *expression* is —
specific art, text, audiovisual presentation, and a distinctive combination of presentation elements
("look and feel"); trade dress and trademarks protect source-identifying presentation and names. The
questions for counsel are therefore about **how we present** shared genre mechanics, and about the
exact words we borrow.

## Side by side
| # | Element | *Trauma Center* (Atlus, DS/Wii 2005–2010) | *Suture & Steel* today | Similarity | Options to put to counsel |
|---|---|---|---|---|---|
| 1 | **Per-action grade words** | Cool / Good / Bad / OK / Miss popups | COOL / GOOD / BAD / MISS popups (`rating.*` keys; results rows Cool/Good/Bad/Miss) | **High** — same four words, same use | Keep (common English words) **or** replace with period words, e.g. *Deft / Sound / Clumsy / Botched*; the change is a string edit (D-0008) |
| 2 | **Rank letters** | XS / S / A / B / C | XS / S / A / B / C | **High** — "XS" is distinctive to the series | Replace "XS" with an original top rank (e.g. a wax-seal "✠" or "Master") and keep S/A/B/C (generic) |
| 3 | **Time-slow power and its input** | *Healing Touch*: draw a **star** in one stroke to slow time, once per operation | *Litany of Stillness*: draw a **five-pointed star** (right mouse) to slow time ~8 s, once per operation | **High** in mechanic + input; different name, fiction (a prayer), visuals (sepia ripple) | Keep the prayer fiction; consider a different sigil (e.g. hour-glyph or a Latin cross stroke) or keep the star but make the tutorial and VFX clearly our own |
| 4 | **Vitals meter** | 0–99 number with ECG trace, turns yellow on fibrillation | 0–99 number, ECG "pulse-glass", heart medallion, blood tube | Medium — a 0–99 vitals number is a distinctive series convention | Change the range/presentation (e.g. 0–100 %, or a "humours" gauge) if counsel flags it |
| 5 | **Countdown timer** | mm:ss countdown, usually 5:00 | Hourglass plaque with m:ss | Low — timers are generic | — |
| 6 | **Tool tray** | Icons for 8–10 tools on the touch-screen edge; tool selection by tapping | Vertical leather tray with 8 period instruments, hotkeys 1–8, tooltips | Medium in function (similar tool set: scalpel, forceps, drain, suture, gel, syringe, laser, ultrasound); presentation differs | Keep period instruments and art; ensure icon shapes/colours do not mimic Atlus icons |
| 7 | **Assistant callouts** | Nurse portrait with a text box giving instructions during surgery (Angie) | Sister Ilse medallion + scroll text box at the bottom giving instructions | Medium — same framing | Distinct art direction (woodcut medallion, scroll); counsel to confirm the framing is generic |
| 8 | **Chain counter** | Chain counter (Second Opinion onwards) | "×N chain" wax seal | Low–medium | Rename "chain" if (1) changes |
| 9 | **Boss pathogens** | GUILT: man-made parasites, a named strain per boss (Greek weekdays), multi-phase fights inside the patient | The Malison: a living curse woven by a coven, variants named for canonical hours, multi-phase fights | Medium — structure echo; names and fiction are original | Keep; counsel to confirm the "named series" device is not protectable expression |
| 10 | **Operation frame** | Briefing VN → disinfect/incise → waves → suture/close → results | Story VN → briefing chart → incise → phases → close incision → results ledger | Medium — genre structure | Keep; our briefing is a parchment chart, results a wax-sealed ledger |
| 11 | **Story beats** | Young surgeon discovers a miraculous gift; a secret medical organisation (Caduceus); a terrorist group spreads GUILT | Young apothecary-surgeon with a gift that witch-hunters would call witchcraft; a hospice; a heretic coven weaves curses | Medium in premise; setting, institutions and themes differ | NAR to avoid a "secret medical organisation" beat and any plot sequence mirroring the Delphi arc |
| 12 | **Titles and marketing copy** | "Trauma Center", Atlus/SEGA marks | Must never use Atlus footage, logos or the series name in paid/store copy — see [marketing-reference-rules.md](marketing-reference-rules.md) | — | Counsel to rule whether "for fans of surgery-action games like *Trauma Center*" may appear in press materials only |

## What we recommend asking counsel to decide
1. Rating words (#1) and "XS" (#2): keep or replace — feeds D-0008, the GAM scoring spec, the UIX HUD
   and the LOC termbase (LOC-0037).
2. Star gesture (#3): acceptable as-is, or change the sigil.
3. Vitals 0–99 (#4): acceptable, or change range/presentation.
4. Whether items 6–11, taken together with 1–4, create a "look and feel" risk, and which two or three
   changes would reduce it most.
5. The nominative-reference question in #12.

## Evidence we keep (OPS-0055)
Independent-creation archive snapshots (design docs, research, sketches, commit history) are produced by
`node scripts/ops/archive-snapshot.mjs` at each milestone — see
[independent-creation-archive.md](independent-creation-archive.md).
