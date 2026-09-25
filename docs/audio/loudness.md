# Loudness specification

All values EBU R128 / ITU-R BS.1770 (K-weighted, gated). Measured with ffmpeg's
`ebur128` filter (`scripts/audio-loudness.mjs`), which the audio CI runs over every
asset and over gameplay captures.

## Targets

| What | Integrated | True peak | Notes |
|---|---|---|---|
| Gameplay mix (10-minute capture) | **−18 LUFS ±2** | **≤ −1 dBTP** | Default mix, "Full" dynamic range |
| Music stems (final mix of a cue) | −20 LUFS ±2 | ≤ −1 dBTP | Bus trim −6 dB keeps the bed under VO |
| SFX files | — (short) | **≤ −3 dBTP** | Peaks, not loudness, are checked |
| Ambience beds | −26 LUFS ±4 | ≤ −6 dBTP | |
| VO lines | −24 LUFS ±1 | ≤ −3 dBTP | Consistent room tone; sits ≈ 6 LU above the music bed |
| Master sample peak | — | ≤ −1.5 dBFS sample | Soft ceiling after the limiter keeps true peak ≤ −1 dBTP |

Relationships: VO ≈ 6 LU above the music bed (VO −24 LUFS against music at −20 LUFS
minus the −6 dB music bus trim and −8 dB bark ducking ≈ −34 LUFS under a line).

## Mix structure that delivers it

- Bus trims (`BUS_TRIM` in `engine.ts`): music −6 dB, world 0, hud −1, ui −4, vo 0, ambience −5.
- Default volumes: master 60, music 80, SFX 90, voice 100, ambience 70, interface 70.
- Master: range compressor (bypassed in Full; 3:1 Reduced; 6:1 Night with VO +4 dB) →
  limiter −6 dB / 20:1 / 3 ms / 100 ms → soft ceiling at −1.5 dBFS.
- Ducking (`DUCKING` in `mixer.ts`): barks −8 dB music / −6 dB ambience (80 ms / 400 ms);
  rating stings −3 dB music for 250 ms; boss moments −4 dB; death knell −14 dB.

## Measurements

| Date | Capture | Integrated | True peak | LRA | Result |
|---|---|---|---|---|---|
| 2026-09-25 | Offline bot replay of demo operations, 3 min, procedural mix, defaults at 100 master | −19.3 LUFS | −1.6 dBTP | 18.2 LU | Within spec |

Reproduce with `npm run audio:capture` (defaults to 10 minutes; `node scripts/audio-capture.mjs out.wav 3` for a quick check).
The offline test `tests/audio/offline-replay.test.ts` additionally renders the whole op1-5 boss fight and
asserts no sample above −0.5 dBFS.

## Sign-off

Final mix sign-off (AUD-0141) is recorded here by the audio lead after the mix passes on the
four reference playback systems (see `docs/handoff/AUD/mix-passes.md`).

| Chapter | Capture | Integrated | True peak | Systems checked | Signed off by | Date |
|---|---|---|---|---|---|---|
| | | | | | | |
