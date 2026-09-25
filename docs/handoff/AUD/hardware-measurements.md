# Hardware measurements

## Output latency — AUD-0025

The context is created with `latencyHint: 'interactive'`; the F4 overlay prints
`baseLatency + outputLatency` in ms.

1. Windows 11, Electron build, default WASAPI device, 48 kHz. Open an operation, press F4, read *latency*.
2. Repeat with a USB interface and with Bluetooth (expect higher; record it).
3. Loop-back check: record the speaker with a mic while clicking with the Lancet; the click-to-sound
   gap in a DAW should be within ±10 ms of the overlay figure.

Target: < 40 ms on the default WASAPI device. Record results:

| Device | Overlay (ms) | Loop-back (ms) | Pass |
|---|---|---|---|
| | | | |

## Audio CPU budget — AUD-0142

Target: audio thread ≤ 3 % CPU on Steam Deck, zero underruns in a 30-minute soak of the busiest boss.

Desktop baseline (node-web-audio-api, one core, 48 kHz; `AUDIO_PERF=1 npx vitest run tests/audio/perf.test.ts`):
empty graph 1.5 %, theatre ambience 5 %, operation bed+pulse 7 %, all eight stems 16 %, Matins all stems 12 %.

Procedure on the Deck:
1. Build with `?op=op2-5` (Lauds) and set vitals low with the dev hooks so tension+danger stems play.
2. `chrome://tracing` (Electron: `--enable-tracing`) or the Deck's performance overlay level 4 while looping the fight for 30 min.
3. Count underruns: in Chromium `chrome://media-internals` → AudioContext → "glitches".

If over budget, the levers (in order): recorded stems instead of procedural music for that cue
(one buffer source per stem), fewer simultaneous stems, lower `GLOBAL_VOICE_CAP`, shorter reverb IR.

| Build | Scene | CPU % | Underruns | Pass |
|---|---|---|---|---|
| | | | | |
