# Trailer capture scene list (ART-0334)

Every trailer shot is captured from a **deterministic replay**, so a shot can be re-rendered
frame-exactly after an art change. Operations are seeded (`def.seed`), the simulation takes no
wall-clock or `Math.random` input, and the input stream is recorded with the ENG replay tool
(INP-0016, `src/input/record.ts`).

## How to capture

1. **Record** (once per shot, by a player): `npm run dev`, open `?op=<id>&record=1` (or play from a
   save preset with `?preset=<name>`), and play the beat. When the operation ends, the input stream
   downloads as JSON. Save it as `art-src/trailer/replays/<shot>.json` (Git LFS).
2. **Replay**: `?op=<id>&replay=<url of the json>` plays it back identically, at any resolution. For
   stills, `node scripts/shoot.mjs <out> op:<id>:<seconds>[:<tool key>]` steps the same seeded
   operation to a time.
3. **Grab**: capture at 1920×1080 60 fps (OBS, lossless) with **Options → Display: debug overlay off,
   Reduced flashing off, Screen shake 100 %, Gore full, Cursor size 100 %**. Record the frame range
   from the replay clock readout, not the wall clock.
4. For story beats use the preview URL: `?story=<backdrop>&who=<character>`.

Replay seeds are the operation's own (`seed` in `src/content/ops/ch1.ts` / `ch2.ts`). A shot is
only as stable as its build: re-record the replay if the operation's tuning changes (the replay
header stores the op id, options and bindings; a mismatch refuses to play).

## Shots

| Shot | Beat | Source | Seed | Start state | Frames / timing | Replay file | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T01 | Barbed arrow, idle | `?op=op1-2` | 12 | Phase I, the arrow placed; no input | 4 s from the intro card's end | — (no input) | The shaft twitches with the heartbeat (ART-0299). Pointer parked off-field |
| T02 | Arrow nicked and pulled | `?op=op1-2&replay=…` | 12 | As T01 | Nick, nick, grab, pull: ~5 s | `T02.json` | Hold on the COOL stamp 0.6 s |
| T03 | Hospice ward, night | `?story=hospice&who=narrator` | — | — | 6 s pan | — | Add `&light=night` |
| T04 | Tanners' Rows, dusk | `?story=street&who=narrator` | — | — | 6 s | — | Add `&light=dusk` |
| T05 | Kreuzer and Ilse | `?story=hospice&who=ilse` | — | — | 3 s | — | Callout subtitle added in edit |
| T06 | Lancet incision | `?op=op1-3&replay=…` | 13 | Phase I | 2 s | `T06.json` | One clean trace ending COOL |
| T07 | Leech-Pipe | `?op=op1-2&replay=…` | 12 | A pool beside the wound | 2 s | `T07.json` | Suction swirl visible |
| T08 | Gut Thread | `?op=op1-1&replay=…` | 11 | Final phase: close the incision | 2 s | `T08.json` | End on the sealed flash |
| T09 | Saint's Salve | `?op=op1-3&replay=…` | 13 | A scorch present | 2 s | `T09.json` | Smear plus the glint |
| T10 | Tincture | `?op=op1-3&replay=…` | 13 | Vitals < 60 | 2 s | `T10.json` | Vein-glow ripple from the needle |
| T11 | Cautery Brand on a grub | `?op=op1-4&replay=…` | 14 | A grub surfaced | 2 s | `T11.json` | Sparks, smoke, sear glow |
| T12 | Scrying Lens | `?op=op2-2&replay=…` | 22 | Hidden hexstone present | 2 s | `T12.json` | Ink wash under the hidden shard |
| T13 | Tongs to the dish | `?op=op2-2&replay=…` | 22 | Shard revealed by T12 | 2 s | `T13.json` | Drop it in the lead dish: clink spark |
| T14 | Failing vitals | `?op=op1-4&replay=…` | 14 | Let vitals fall under 30 | 4 s | `T14.json` | Cracked glass and vessel creep |
| T15 | Matins wakes | `?op=op1-5&replay=…` | 15 | `?preset=pre-matins` for the story lead-in | 4 s | `T15.json` | Eye opening |
| T16 | Matins strikes | `?op=op1-5&replay=…` | 15 | Phase II | 3 s | `T16.json` | Violet crackle on the new laceration |
| T17 | Phase change | `?op=op1-5&replay=…` | 15 | End of phase II | 3 s | `T17.json` | Thread-snap shockwave and ink bleed |
| T18 | Litany star | `?op=op1-5&replay=…` | 15 | Litany unused | 3 s | `T18.json` | Draw the star slowly (≈1.2 s) |
| T19 | Litany stitches | continues T18 | 15 | Litany active | 6 s | `T18.json` | Dust, marginalia, then the gold-leaf fracture |
| T20 | Matins dies, rank seal | `?op=op1-5&replay=…` | 15 | Final phase | 4 s + results | `T20.json` | Results scene: the seal press |
| C01 | Title card | ART-0335 card | — | — | 4 s | — | Rendered from the card template |
| C02 | End slate | ART-0335 slate | — | — | 2 s + hold | — | Platforms and the rating placeholder |

## Lauds and later trailers

The Next Fest trailer adds `?op=op2-5` (seed 25, `?preset=pre-lauds`): L01 the light-thread and its
pulses, L02 the sever on the dim beat, L03 the dawn flare blinding the Lens. Record them the same way.
