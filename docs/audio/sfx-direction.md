# SFX direction brief (draft for approval — AUD-0029)

## Palette

Period-authentic materials only: **steel** (lancet, tongs, needles, instrument dish), **horn**
(ear trumpet, drinking horns), **wood** (arrow shafts, tally sticks, the operating table),
**glass** (vials, the Scrying Lens, hexstone), **wax** (seals, candles), **wet leather and
flesh**, **embers and the cautery iron**, **church bronze** (tower and hand bells), linen and
parchment. No modern beeps, sine alerts, synth pads or digital UI clicks. Every interface
sound is an object in the room: quill, page, wax seal, latch, lute string.

## Gore level

Grim, not gratuitous. Wetness and tearing are present and specific (a cut parts wetly, a barb
rips) but short; no lingering squelch beds, no bone crunches for their own sake, no screaming
loops. Patient vocals are brief, human and optional ("Patient vocalisations" toggle).

## Magic and curses

The Hollow Choir's sound: human voices wrongly placed — whispers that shouldn't be there, choirs
a semitone off, bells in rooms without bells. The Malison is always *voiced* (choir + creature),
never electronic. The Litany of Stillness is the one warm, consonant magic: a whispered prayer,
a major choral swell, glass harmonics.

## Rules

- Every gameplay telegraph is audible ≥ 0.5 s before it lands and has a caption.
- Rating stings ≤ 400 ms, never masking the action sound (they sit 40 ms behind it, −3 dB music duck).
- Loops stop within 50 ms of release; nothing leaks.
- Level targets per `loudness.md`: SFX peaks ≤ −3 dBFS.

## Reference

The current procedural designs (`src/audio/sfx.ts`) are the living reference for timing, layering
and intent of every event; `docs/audio/sfx-events.csv` lists them all. Suggested listening:
Darkest Dungeon (UI materiality), Pentiment (period interface sounds), Blasphemous (liturgical
dread), Hunt: Showdown (wet, specific foley).

**Approval:** the project owner signs off here before any recording session.

| Approved by | Date | Notes |
|---|---|---|
| | | |
