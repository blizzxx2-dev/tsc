# Music direction brief (draft for approval — AUD-0068)

## Instrumentation

Early-modern consort only: viol consort (treble to bass viol), hurdy-gurdy (melody + drone +
trompette buzz), sackbut, shawm, crumhorn, recorder, lute, frame drum and tabor, positive
organ, plainchant voices (men's schola; a women's choir for the Hollow Choir's "wrong" voices),
church bells (tower peals and hand-bells). No orchestra, no synth pads, no modern percussion.

## Harmony

Modal: Dorian and Phrygian for the operating theatre, Mixolydian and Ionian for the hospice's
warmth, Aeolian for grief. The Hollow Choir corrupts modes with the lowered second (♭2) and the
tritone. Tension is carried by drones against moving viols, not by tempo alone.

## Leitmotif

The **Hollow Choir motif**: root – ♭2 – 5 – 4 – ♭2 – root (1, 1, 1½, ½, 1, 3 beats). It opens
the title theme's intro, threads every Malison hour, and returns resolved in the credits (♭2 lifted
to a natural second, ending on a major third). Hear it in `src/audio/music/themes.ts` (`LEITMOTIF`).

## Adaptivity

Every operation and boss cue is delivered as synchronised stems: **bed, pulse, melody, tension,
danger, clock, flow** plus a **Stillness** stem for the Litany (same key and tempo grid). Boss
cues have sections per boss phase. Tempo and loop-point metadata ship with each stem. The
procedural score in the build is the functional spec: the composer replaces it stem by stem.

## Reference tracks

Hildegard von Bingen *O Euchari* (plainchant colour); Jordi Savall / Hespèrion XXI *Folías*
(viol consort energy); Wardruna (drone and ritual weight, not the Norse palette); *Pentiment* OST
(period authenticity in a game); *Blasphemous* OST (liturgical dread).

**Approval:**

| Approved by | Date | Notes |
|---|---|---|
| | | |
