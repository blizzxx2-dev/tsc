# Builds, editions and the desktop shell

Everything here runs on a developer machine or CI; signing, Steam partner setup and hardware QA are human
steps listed in `docs/handoff/PLT/`.

## Flavours

| Variable | Values | Effect |
|---|---|---|
| `VITE_EDITION` | `demo` (default) · `full` | Compile-time `EDITION` constant (`src/platform/build.ts`): content gating, identifiers, achievement and rich-presence sets, save folder (`…/suture-and-steel/<edition>/`). Full-game chapters must only be referenced behind `EDITION === 'full'` so demo bundles contain no Chapter III–V code (checked by `scripts/check-demo-bundle.mjs`). |
| `VITE_PLATFORM` | `web` · `desktop` · `none` | `desktop` builds load from `app://game/` (relative base). `none` = desktop without Steam (GOG/itch): no Steamworks binaries in the package, all Steam calls no-op (`scripts/check-package.mjs --no-steam`). |
| `SS_RELEASE=1` | | Release desktop build: `RestartAppIfNecessary` on, `steam_appid.txt` never written. |
| `VITE_QA=1` | | QA build: F8 bug-report capture, Ctrl+Shift+F9 reset achievements, runtime flag overrides (`?flag.watermark=1`, `--flag=watermark=1`). |
| `VITE_WATERMARK=1` | | Press/festival corner stamp with the build id (off in the public demo). |
| `VITE_SENTRY_DSN`, `SS_CRASH_SUBMIT_URL` | | Crash/JS error reporting endpoints (see `docs/handoff/PLT/crash-backend.md`). Unset = nothing is ever uploaded. |

Versions live in `versions.json` per edition (demo `1.0.x` after launch, full `0.x` until 1.0). The build id is
`version+sha.date` (e.g. `0.9.0+48d12fc3.20260925`), shown bottom-right on the title screen, written in every log
header and attached to crash reports. `node scripts/version-bump.mjs demo patch` bumps and prints the tag.

## Commands

```sh
npm run build                      # typecheck + web build (demo), unchanged
npm run build:demo | build:full    # web build of an edition (browser demo for press/itch)
npm run desktop:dev                # build, then run Electron from the checkout with --dev (devtools, reload)
npm run desktop:pack -- --os=linux # release/<edition>/linux-unpacked  (also --os=win, --os=mac on those hosts)
npm run desktop:smoke              # boot the packaged Linux build headless under Xvfb and verify it
npm run check:demo-bundle          # fail on Chapter III–V modules/ids in dist/
npm run check:package -- release/demo/linux-unpacked   # fuses, no maps, no steam_appid.txt, size budget
npm run steam:config -- --branch=qa                    # SteamPipe VDFs, rich presence tokens, achievements, launch options
npm run icons | notices | changelog | check:licenses
```

`desktop:smoke` verifies in the real packaged app: the preload bridge exists and Node is not visible to the page,
the platform is `desktop` with the file-system save backend, a save write reaches disk through the atomic writer,
the CSP header is served from `app://`, the canvas booted without the fatal screen, and the window title is the
edition's product name.

## Package layout (Steam depots)

electron-builder (`desktop/electron-builder.config.cjs`) writes one folder per OS — each folder is a depot's content
root (`scripts/steam-config.mjs` points the depot VDFs at them):

| OS | Folder | Executable |
|---|---|---|
| Windows x64 | `release/<edition>/win-unpacked/` | `SutureAndSteelDemo.exe` / `SutureAndSteel.exe` |
| macOS universal | `release/<edition>/mac-universal/` | `Suture & Steel Demo.app` / `Suture & Steel.app` |
| Linux x64 | `release/<edition>/linux-unpacked/` | `SutureAndSteelDemo` / `SutureAndSteel` |

CI archives each folder with `tar` so executable bits survive the artifact round trip to the SteamPipe upload job.

### Size (Linux demo, measured 2026-09-25)

| Step | Size |
|---|---|
| Electron 44 dist as downloaded | 296.3 MB unpacked |
| Chromium locale paks: 55 → 11 kept (`electronLanguages`) | 9.0 MB → 1.5 MB (−7.5 MB) |
| Other OSes' Steamworks binaries stripped (`desktop/build/afterPack.cjs`) | −6.2 MB |
| Final package | 291.8 MB unpacked, ≈124 MB compressed (budget 250 MB, enforced by `check-package.mjs`) |

### Electron fuses (verified by `check-package.mjs` / `npx @electron/fuses read`)

RunAsNode **off**, NODE_OPTIONS **off**, `--inspect` args **off**, OnlyLoadAppFromAsar **on**, embedded ASAR
integrity validation **on** (enforced on Windows/macOS), cookie encryption on, file:// extra privileges off.

## Desktop shell behaviour

- **Security:** `contextIsolation`, `sandbox`, no `nodeIntegration`; the preload exposes only
  `ssBridge.invoke/send/on` for the channels listed in `src/platform/bridge.ts`, and main rejects IPC from any
  other sender. The game is served from `app://game/` with `default-src 'self'`; navigation, redirects,
  `window.open`, webviews, permission requests and drag-and-drop navigation are refused. Devtools and reload
  shortcuts exist only with `--dev` (or an unpackaged checkout).
- **Command line:** `--windowed`, `--fullscreen`, `--safe-mode`, `--reset-settings`, `--kiosk`, `--dev`,
  `--log-level=debug|info|warn|error`, `--gl-backend=d3d11|d3d9|gl|gles|vulkan|metal|swiftshader`,
  `--flag=<name>=0|1` (QA builds).
- **Safe mode:** Low preset, no MSAA, default settings, windowed, sRGB colour profile. Offered automatically after
  two consecutive launches that never reached 20 s of healthy running, and after two renderer crashes within ten
  minutes (crash dialog). Steam launch option 2 starts it directly.
- **Display modes:** windowed (resizable), borderless and fullscreen, switchable at runtime; F11/Alt+Enter toggle.
  Chromium has no exclusive fullscreen, so on Windows/Linux both non-windowed modes are borderless full-screen
  windows; on macOS *fullscreen* is a native Space and *borderless* is simple fullscreen (no Space). A mode or
  monitor change reverts after 15 s unless confirmed. Size, position, mode and monitor persist in
  `<cache>/window.json` and are clamped to a visible work area on launch.
- **VSync:** Chromium cannot toggle vsync at runtime; the setting writes `<cache>/launch-switches.json` and the next
  launch adds `--disable-gpu-vsync --disable-frame-rate-limit`.
- **Quit:** closing the window, Alt+F4 and Cmd+Q ask for confirmation during an operation, then wait (≤5 s) for the
  game to flush pending saves before exiting. Booth/kiosk builds ignore quit except Ctrl+Shift+Alt+Q.
- **Display sleep** is blocked during operations (unless paused) and story scenes.
- **Focus loss** pauses an operation (setting), mutes if "mute when unfocused" is on, and releases held mouse
  buttons. OS suspend (Deck sleep) pauses the operation.
- **Crash handling:** renderer crash → reload straight back to the last autosave; second crash within ten minutes →
  "Suture & Steel has stopped" dialog (Restart / Restart in safe mode / Open log folder / Quit). Renderer silent for
  >10 s → "not responding" dialog; Restart forces a renderer crash so Crashpad captures it, then recovers.
- **Logs:** `game.log` + 4 rotations of ≤5 MB in the OS log folder, header with build, OS, locale, GPU and settings
  tier; renderer lines are forwarded in batches. User names, SteamIDs, machine and persona names are scrubbed.
- **Screenshots:** F12 (when Steam is not running — otherwise Steam's own key) saves a PNG to
  `Pictures/Suture & Steel/`.
