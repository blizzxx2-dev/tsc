# Audio–visual parity audit (AUD-0117)

Every sound that carries gameplay information, and what shows the same information on
screen. Events flagged `gameplay: true` in `src/audio/events.ts` are the source list; all
of them also carry a caption (shown when "Sound captions" is on, with an arrow toward
off-centre sources).

| Sound (event) | Information | Visual counterpart | Status |
|---|---|---|---|
| Heartbeat (`sfx.heart.beat`) | Vitals falling, pace of decline | ECG trace, heart medallion pulse; edge vignette pulse when heartbeat audio is off/muted (AUD-0118) | ✓ |
| Pulse tick (`sfx.heart.pulseTick`) | Beat timing | ECG spike | ✓ |
| Vitals bells 60/30/15 (`sfx.vitals.warn*`) | Threshold crossed | Vitals number colour (green/amber/red), low-vitals red pulse, Ilse's callout at 30 | ✓ (60 has colour only) |
| Timer ticks, time-up bell | Time running out | Hourglass; clock flashes red under 20 s | ✓ |
| Litany end warning (`sfx.litany.endWarn`) | Stillness ends in 1.5 s | Medallion arc drains | **Gap:** no distinct cue in the last 1.5 s → UIX task A |
| Tincture ready (`sfx.tincture.ready`) | Injection available | Cooldown shade on the tray slot clears | **Gap:** no moment-of-ready flash → UIX task B |
| Shard rejoin warning (`sfx.matins.rejoinWarn`) | Shards rejoin in 2 s | Life ring around each shard | ✓ |
| Shroud parts (`sfx.matins.shroud`) | Malison vulnerable | Eye opens, orange ring | ✓ |
| Malison rend (`sfx.malison.rend`) | New wound | Laceration appears, screen shake, callout | ✓ |
| Hymn verse (`sfx.lauds.hymn`) | A tearing ring is coming (≥ 0.5 s) | Expanding hymn ring | ✓ |
| Voices recalled (`sfx.lauds.recall`) | Shield restored | Voices reappear, callout | ✓ |
| Lauds submerges (`sfx.lauds.submerge`) | Use the Scrying Lens | Core vanishes, callout | ✓ |
| Hexstone whisper (`sfx.hexstone.pulse`) | Corruption spreading | Hexstone glow pulse, rot patches, callout | ✓ |
| Bubo creak (`sfx.bubo.creak`) | Bubo ripening | Swelling; red ring only when > 75 % ripe | **Gap:** early creaks have no visual → UIX task C |
| Egg sac throb (`loop.eggsac.pulse`) | Hatch timer | Sac wobble quickens, callout at 5 s | ✓ |
| Curse lash (`sfx.sigil.lash`) | Periodic damage | "The curse lashes out!" popup, −N popup | ✓ |
| Blood flooding (`sfx.blood.flooded`) | Can't stitch until drained | Callout | ✓ |
| Lens shimmer (`loop.lens.hum` prox) | Something hidden nearby | Arcs around hidden entities near the lens | ✓ |
| Lens found (`sfx.lens.found`) | Revealed | "Found!" popup | ✓ |
| Combo break (`sfx.combo.break`) | Chain lost | Chain seal disappears | ✓ |
| Lancet slip (`sfx.lancet.slip`) | Off the line | "Off the line BAD" rating | ✓ |
| Grub chitter (`loop.grub.chitter`) | Grubs present | Grubs visible | ✓ |
| Spiderling skitter, larvae swarm | Swarm present | Visible entities | ✓ |
| Stone creep (Ch3–5) | Petrification spreading | To be designed with the mechanic | Pending feature |

## UIX tasks to file

- **A** — Litany medallion flashes gold in the final 1.5 s of Stillness (matches the reverse-swell warning).
- **B** — Tincture tray slot gives a brief glint when the cooldown completes (matches the ready tick).
- **C** — Unripe buboes show a faint pulse each time they grow (matches the creak), not only past 75 %.

## Human verification

A deaf or hard-of-hearing tester completes Chapters 1–2 with sound off and captions on; see
`docs/handoff/AUD/parity-playtest.md`.
