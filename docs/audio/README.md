# Audio

Everything the player hears is produced by `src/audio/`: a WebAudio engine with a
bus mixer, designed SFX synthesised per event, an adaptive procedural score,
location ambiences and heartbeat sonification. Recorded assets (SFX, stems, VO)
drop in through the manifest and replace the synthesised design event by event.

## Map

| File | Role |
|---|---|
| `engine.ts` | Context, bus graph, master safety chain, reverb sends, voices, loops, snapshots, ducking, assets, captions, meters |
| `events.ts` | The event table: every sound id with bus, limits, priority, variations, caption, ducking, recorded asset keys |
| `synth.ts` | Synthesis toolkit: noise bank, modal resonators (steel, glass, wood, clay, plate, bells), bubbles, Karplus-Strong, formant voices, wavetables, textures |
| `sfx.ts`, `sfx-later.ts` | Designed recipes (one-shots) and loop recipes; `beds.ts` holds the location beds |
| `mixer.ts` | Snapshot stack and ducking table (pure, unit-tested) |
| `voices.ts` | Voice manager: per-event limits, 48-voice cap, priority/oldest stealing |
| `music/` | Instruments, themes (stems per layer), state machine, look-ahead player |
| `ambience.ts` | Bed per location, random emitters (≥ 4 s apart), curse-corruption bed |
| `director.ts` | Operation director: turns the simulation into sound each frame |
| `scenes.ts` | Scene director: music state, ambience and snapshot per scene; VN/briefing/results sounds; overlays |
| `heartbeat.ts` | QRS-locked heartbeat scheduling, heart timbre, star-corner counter |
| `vo.ts` | Voice-over runtime (line ids, takes, cooldowns, language folders, subtitles) |
| `captions.ts`, `captions-view.ts`, `i18n.ts` | Sound captions, VO subtitles, visual heartbeat, localisation tables |
| `options-scene.ts`, `prefs.ts` | Audio options screen and persisted preferences |
| `debug-overlay.ts` | F4 overlay: voices per bus, meters, snapshots, music, banks, latency, last events |
| `assets.ts` | Manifest, bank loading with progress, decoded-memory accounting, release |

## Signal flow

```
voices → world ┐
         hud ──┴→ sfx ┐
         music ───────┤
         ui ──────────┼→ master → range comp → limiter (−6 dB, 20:1, 3 ms/100 ms)
         vo ──────────┤          → ceiling (−1.5 dBFS) → mono fold → balance → focus fade → out
         ambience ────┘
each bus: volume → duck → snapshot gain → low-pass [→ high-shelf on world/hud] → parent, + reverb send
reverb: stone theatre / chapel impulse responses (synthesised), one fed at a time
```

## Adding a sound

1. Add the id to `EVENTS` in `events.ts` (bus, priority, limit, caption if it matters to play).
2. Add a recipe with the same id to `RECIPES` (or `LOOPS` for a held sound) in `sfx.ts`.
   Recipes get the variation index `v` (no immediate repeats) and event params.
3. Trigger it: from the simulation `op.cues.push('your.id')`, from a scene `game.audio.play('your.id')`,
   or from the director when it observes a state change.
4. `npx vitest run tests/audio` renders every recipe offline and checks it is audible and below the ceiling.

To replace a design with a recording, put the WAV under `assets-src/audio/<category>/<bank>/`,
list its key in the event's `assets`, and run `npm run audio:build`.

## Tools

| Command | What it does |
|---|---|
| `npm run audio:build` | Encode sources to Ogg Opus, write `public/audio/manifest.json` (duration, LUFS, true peak) |
| `npm run audio:check` | CI: bad/missing/oversized files, memory budget, loudness per category |
| `npm run audio:release-check` | Also fails on files without licence/provenance or marked temporary |
| `npm run audio:events` | Regenerate `docs/audio/sfx-events.csv` (the SFX event list) |
| `npm run vo:export` | Regenerate `docs/audio/vo-script.csv` and list pickups since the last export |
| `node scripts/music-cue-sheet.mjs` | Regenerate `docs/audio/music-cues.md` |
| `npm run audio:capture` | Render a 10-minute gameplay capture offline and measure it against the loudness spec |
| `node scripts/audio-smoke.mjs [op]` | Browser smoke test: bus peaks, snapshots, music state, page errors per step |
| `AUDIO_PERF=1 npx vitest run tests/audio/perf.test.ts` | Render cost per component (% of one core at 48 kHz) |

## Decisions

See `decisions.md` (music streaming, pulse chime, procedural-first design) and `loudness.md` (targets and measurements).
