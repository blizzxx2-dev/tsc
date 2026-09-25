# Composer brief, contract checklist and deliverables (AUD-0069, 0120–0122, 0145)

## Scope (demo)

≈ 30 minutes of stemmed music — the cue list is `docs/audio/music-cues.md` (generated; it names
every cue, tempo, key, sections and stems). The build already plays a procedural version of
every cue; use it as the functional spec for form, adaptivity and length, not as a style limit.
Direction: `docs/audio/music-direction.md`.

| Cue | Length | Stems |
|---|---|---|
| Title "The Malison Hours" | 2–3 min loop + 20 s first-boot intro | bed, pulse, melody |
| Hospice (calm), Tense (Stroh), Sorrow | 3 × 90–150 s | bed, pulse, melody (+ tension for Tense) |
| Operation A (Ch1), Operation B (Ch2) | 2 × 2 min loops, 120/126 BPM | bed, pulse, tension, danger + clock, flow, melody, Stillness |
| Malison of Matins, Malison of Lauds | sections per phase + intro + death outro | as operation + Stillness |
| Briefing, Results (warm / grave), Demo-end, Chapter I/II fanfares | short loops / stingers | 1–2 stems |

## Deliverables per stem

- 48 kHz / 24-bit WAV, **mono per stem** (see `docs/audio/decisions.md` — memory budget), bar-aligned,
  identical length within a cue.
- Sidecar JSON: `{"bpm":120,"beats":4,"key":"D dorian","loop":[startSec,endSec],"licence":"…","source":"…"}`.
- Loop points sample-exact; tails after the loop end printed separately if needed.
- Loudness: each cue's full mix −20 LUFS ±2, true peak ≤ −1 dBTP (`npm run audio:check`).

## Later hours (AUD-0120–0122)

Prime & Terce, Sext & None, Vespers & Compline — one liturgical character each (see the task
lines in `docs/roadmap/02-ux-ui-audio.md`); the procedural sketches in `themes.ts` fix tempo,
mode and section structure per boss phase.

## Contract checklist

- [ ] Rights: demo, full game, trailers, store pages, soundtrack album (AUD-0145), streaming/VOD allowed
- [ ] Stems and project files delivered; right to edit/loop/re-sequence adaptively
- [ ] Credit name; soundtrack royalty split
- [ ] Schedule: sketches → approval → stems per milestone (Demo, Beta)
- [ ] Revisions: 2 rounds per cue
- [ ] Performer releases for any live players/singers

## Soundtrack release (AUD-0145)

Master album order: Title; Hospice/Tense/Sorrow; Operation A/B; the eight Malison hours; Credits.
Liner-note PDF with woodcut art; Steam soundtrack DLC depot; 320 kbps MP3 + FLAC.
