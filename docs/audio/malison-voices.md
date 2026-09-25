# Malison voice processing chain (AUD-0105)

One chain for every hour so later hours stay consistent with Matins and Lauds. Each Malison
voice is a **choir layer** plus a **creature layer**.

## Sources

- Choir: 4–8 singers, sustained vowels on the hour's chord (see `HOUR_VOICE` in
  `src/audio/sfx-later.ts` for roots, vowels and chord sets per hour), plus whispered text
  (the hour's office in Latin, recorded close and dry).
- Creature: one performer — growls, inhaled shrieks, wet clicks; recorded close, 48 kHz / 24-bit.

## Chain (in order)

1. **Pitch −5 semitones** on the creature layer (formant-preserving off: the throat should grow).
2. **Granular smear**: 60–120 ms grains, 30 % position jitter, 4 voices — sustains become tides.
3. **Reversed whispers**: reverse the whisper layer, gate it to the choir's envelope, −12 dB under the choir.
4. **Sour detune** (hour-dependent, `sour` in `HOUR_VOICE`): a second choir copy up by
   `sour` semitones (Terce 0.45, Compline 0.2), −6 dB.
5. **Saturation**: soft clip, drive 4–6, only on shrieks ("hit").
6. **Space**: chapel impulse response (the in-game one: 3.6 s, dark), 25 % wet; the game adds
   its own send on top, so print dry-ish.
7. **Deliverables per hour**: intro, telegraph (≥ 0.5 s build before its hit), attack, hit (brand
   shriek), phase change, summon, shield, shield break, submerge, weaken, death, drone loop (seamless,
   60 s) — the ids `sfx.hour.<hour>.<kind>` / `loop.hour.<hour>` already exist in the event table
   with procedural placeholders using this same chain in miniature.

Mastering follows `loudness.md`: SFX peaks ≤ −3 dBFS; drone loops −26 LUFS.
