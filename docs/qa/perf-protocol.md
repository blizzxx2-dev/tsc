# Performance-run protocol (QAT-0073)

Applies to every ENG benchmark capture on the reference machines (min-spec PC, recommended PC, Steam Deck) and to
the frame-time numbers quoted in the demo test plan's exit criteria. The point is that two captures a week apart
differ only because the game changed.

## Fixed environment (record it in the capture header)

| Item | Rule |
|---|---|
| Build | Release flavour of the build under test (never dev/QA builds — the debug API and console change timing). Build id recorded. |
| GPU driver | The version pinned in `docs/qa/compat-matrix.md` for that machine; update deliberately, never mid-comparison. |
| OS | Windows: pinned feature update, Game Mode on, Windows Update paused for the session. SteamOS: pinned version (Settings → System), no beta channel. |
| Power | Windows: "Best performance" power mode, laptop on mains. Deck: plugged in, default TDP / GPU clock (no manual limits), 60 Hz, FPS limit off. |
| Display | Native resolution of the machine, fullscreen, vsync **off** for throughput runs and **on** for frame-pacing runs (state which). |
| Background | Reboot before the session; close launchers other than Steam; Steam overlay enabled (players have it); no recording software unless the run is about capture. |
| Game settings | Defaults, except the variable under test. Settings file archived with the results. |

## Procedure

1. Reboot, wait 2 minutes idle, start the game.
2. **Warm-up:** play the capture scenario once without recording (shader compilation and file caches settle).
3. Capture the scenario **3 times** back to back, same seed and route:
   - *title idle* 60 s on the title screen;
   - *op1-1 opening* first 60 s of op1-1 (lacerations, pools);
   - *Matins* op1-5 from the Malison phase (`preset pre-matins`, then play; or the ENG scripted replay) for 90 s;
   - *Lauds* op2-5 from the Lauds phase for 90 s (Hymn rings + Voices + spiderlings: worst case);
   - *demo end* 30 s on the demo-complete screen.
4. Tools: PresentMon (Windows) / MangoHud log (SteamOS/Linux) at 1 ms resolution, plus the game's own frame-time
   export when ENG ships it.
5. Report the **median of the 3 runs** for p50, p95 and p99 frame time and for the worst 1 % low; also peak memory.
   A run that differs from the other two by more than 10 % on p95 is discarded and repeated.
6. Store raw logs and the summary under the build's QA folder; link them from the compat matrix cell.

## Comparing builds

Only compare captures taken under this protocol on the same machine. A regression is p95 frame time worse by more
than 10 % or any new hitch over 50 ms; file it `area:perf` with both capture links.
