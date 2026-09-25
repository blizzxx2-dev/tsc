# Mix passes and final mix (AUD-0109, AUD-0141, AUD-0147)

## Reference systems

1. Studio monitors (nearfield, calibrated to 79 dB SPL C-weighted at −20 dBFS pink noise)
2. Laptop speakers (a mid-range Windows laptop)
3. Steam Deck speakers
4. Closed headphones (e.g. DT 770) and earbuds

## Pass checklist (per chapter)

- [ ] Capture 10 minutes (`npm run audio:capture`, or record the Electron build's output) → −18 LUFS ±2, ≤ −1 dBTP
- [ ] Ilse's barks intelligible over the danger stem on every system (bark ducking −8 dB)
- [ ] Rating stings never mask the action sound
- [ ] Heartbeat below 25 vitals audible on laptop and Deck speakers (tiny speakers lose < 80 Hz — check the click/"dub")
- [ ] Every gameplay telegraph audible ≥ 0.5 s before it lands (Hymn, shard rejoin, Litany end)
- [ ] Night mode: VO lifted, peaks tamed; Reduced is the Deck default
- [ ] Mono fold: nothing disappears (phase-cancelled choirs, reverb)
- [ ] No clipping in the F4 meters (peak marker never red)

## Issue log

| # | Chapter / scene | System | Issue | Fix | Before (LUFS/TP) | After | Closed |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

## Final mix sign-off (AUD-0141)

Repeat the checklist for the full campaign; record each chapter capture in the sign-off table at the end of `docs/audio/loudness.md`.

## Post-launch triage (AUD-0147)

For each reported audio issue: reproduce, capture before/after with `node scripts/audio-capture.mjs before.wav 3`,
attach both measurements to the fix.
