# Hardware QA protocols (PLT platform tasks that need real machines)

Builds: `npm run desktop:pack -- --os=<win|mac|linux>` locally, or the *build* workflow artifacts (tar.gz). Unless
noted, use the demo edition, Steam `beta` branch once Steamworks is set up. Record results in the table at the end
of each section and attach it to the task.

Machines: Windows 11 (NVIDIA + AMD + Intel iGPU), Windows 10 22H2 clean VM, macOS 14 arm64 (M-series) + one Intel
Mac, Ubuntu 22.04 (X11 and Wayland session), Fedora 40, Steam Deck (SteamOS stable).

## 1. Runtime spike (PLT-0005–0009) — Electron measured, Tauri optional

The Electron shell is built; ADR-001 records the decision. To complete the spike numbers:

1. Install size: size of the depot folder and of the tar.gz (`check-package.mjs` prints both).
2. Cold start: reboot, launch, stopwatch to title screen interactive (3 runs, median).
3. Idle RAM: title screen after 60 s — Windows Task Manager "Suture & Steel Demo" group total / macOS Activity
   Monitor / Linux `smem -t -P SutureAndSteel`.
4. Frame pacing: `?op=op1-5` is not available in packaged builds — play op I-1…I-5; enable the in-game frame-time
   graph if ENG ships it, or capture with PresentMon (Windows) / MangoHud (Linux/Deck) for 60 s per operation;
   record average fps and 1 % lows.
5. WebGL2 (PLT-0006): on the title screen press F8 in a QA build (`VITE_QA=1`) and read the log header `gpu=` line
   and the renderer's WebGL caps lines; confirm the flesh shader compiles (op I-1 shows flesh, not a black field).
   For Tauri, build `npx create-tauri-app` with `dist/` as frontend (optional: only if Electron fails a criterion).
6. Steam overlay (PLT-0007/0042): Shift+Tab in windowed, borderless and fullscreen on each OS; overlay must draw
   and take input. **Known gap:** steamworks.js 0.4 exposes no `GameOverlayActivated` callback, so the game does
   not yet auto-pause when the overlay opens — needs a binding upgrade/fork (see README).
7. Audio (PLT-0009): latency by ear (cut/stitch sounds), unplug/replug headphones mid-operation, sleep/wake.

| Metric | Win11 NV | Win11 Intel | macOS arm64 | Ubuntu | Deck |
|---|---|---|---|---|---|
| Install MB / compressed | | | | | |
| Cold start s | | | | | |
| Idle RAM MB | | | | | |
| op I-5 avg fps / 1 % low | | | | | |
| Overlay win/borderless/full | | | | | |

## 2. Packaging per OS (PLT-0029, PLT-0030, PLT-0031, PLT-0133)

- macOS universal: `lipo -archs "…/Contents/MacOS/Suture & Steel Demo"` → `x86_64 arm64`; on an M-series Mac
  Activity Monitor → Kind = *Apple*; on Intel it runs; no Rosetta prompt.
- Linux in the Steam Linux Runtime: in Steamworks set the Linux depot's *Steam Play / runtime* to
  *Steam Linux Runtime 3.0 (sniper)*; launch through Steam on Ubuntu 22.04 (X11 + Wayland), Fedora 40 (Wayland) and
  SteamOS; confirm window, audio, controller and saves under `~/.local/share/suture-and-steel/demo/`.
- Windows clean VM (Windows 10 1809 and 11, no Visual C++ redistributables installed, standard (non-admin) user):
  install from Steam, launch, play op I-1. Per-monitor DPI: move the window between a 100 % and a 150 % monitor —
  it must stay crisp and correctly sized.
- Non-ASCII/long paths (PLT-0133): create local user `Jürgen Ünïcødé` on Windows, play and quit; check saves and
  logs exist under `C:\Users\Jürgen Ünïcødé\AppData\…\suture-and-steel\` and that the log header shows
  `C:\Users\<user>\…`. Repeat with a user whose Documents folder is redirected to OneDrive (saves must not go there).

## 3. Display (PLT-0111, PLT-0112, PLT-0116–0119)

- VSync: Options → V-Sync off → restart → a vertical-bar tear test (drag the lancet fast horizontally across op I-1's
  field at 60 Hz) shows tearing; on → none.
- High refresh: on 144/165 Hz Windows and a ProMotion MacBook, the log line `first launch: … ~144 Hz` and the frame
  cap match the display; UFO test-like motion of the reticle is smooth.
- Alt+Tab / minimise / restore in fullscreen on NVIDIA, AMD, Intel: 20 cycles, no black frame, operation paused.
- macOS: fullscreen (native Space) vs borderless (simple fullscreen) both correct; on a notched MacBook Pro the HUD
  is not under the notch.
- Linux: Wayland at 125 %/150 % fractional scaling; X11 dual monitor with the window moved between screens; Deck in
  gamescope reports 1280×800 (log header / window state).
- Windows HDR on: colours match SDR (compare screenshots side by side); if washed out, test `--safe-mode`
  (forces sRGB) and report.

## 4. Steam features (PLT-0045, PLT-0046/0047, PLT-0048, PLT-0051, PLT-0161–0164, PLT-0067)

- Rich presence: second account views the friends list while you play story, operation and menu.
- Cloud round trip: play to op I-3 on machine A, quit, launch on machine B → Continue resumes at op I-3's briefing.
- Cloud conflict: go offline on A and B, progress differently, go online on both → Steam conflict dialog → pick either
  → the game loads cleanly (no damaged-journal notice).
- Screenshots: Steam's key (F12) captures the game frame on Windows, macOS, Linux; overlay disabled → F12 falls back
  to the in-game capture in `Pictures/Suture & Steel/`.
- Overlay disabled in Steam settings → *Wishlist* opens the store (record whether Steam opens its client store page
  or nothing; if nothing, file a bug to add a browser fallback).
- Deck: suspend/resume 10× mid-operation (auto-pause, audio back, no crash); trackpad + triggers complete op I-1…II-5
  at A rank or better (PLT-0159); no step needs a keyboard (PLT-0162); run Valve's Deck checklist (PLT-0164) and
  request review (PLT-0076).
- Carry-over (PLT-0067): on Windows, macOS, Linux and Deck: finish demo op I-3, uninstall the demo (keep saves), install
  the full game → import dialog appears → progress and ranks carried.

## 5. Controllers (PLT-0153, PLT-0156, PLT-0157)

Xbox, DualSense, Switch Pro on each OS with Steam Input off and on: left stick moves the reticle, A/RT cut and hold,
LT draws the Litany star, LB/RB cycle tools, Start pauses. Pull the cable mid-operation → pause + "Controller
disconnected" notice. Deck touchscreen: tap = press, drag = stroke through a full operation.

## 6. Clean-machine demo pass (PLT-0075)

Windows 10, Windows 11, macOS arm64, Ubuntu, Deck — no dev tools: install from Steam, play Chapters I–II end to end,
check Cloud sync, uninstall (saves remain, per `docs/platform/saves.md`).
