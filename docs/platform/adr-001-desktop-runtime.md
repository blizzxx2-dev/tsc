# ADR-001 — Desktop runtime: Electron

- **Status:** accepted (2026-09-25) · revisit only if the measurements in PLT-0005–0009 contradict the scores below
- **Tasks:** PLT-0010 (decision), PLT-0011 (runtime version policy)
- **Deciders:** platform lead; sign-off by the project owner

## Context

Suture & Steel is a WebGL2 game (custom batched renderer, fbm/voronoi flesh shader, float render targets for
bloom, a multi-pass post chain) that must ship on Steam for Windows, macOS and Linux/Steam Deck, with the Steam
overlay, achievements, Cloud, rich presence and Steam Input, and a free demo for Next Fest. The two realistic
shells are **Electron** (bundled Chromium + Node) and **Tauri 2** (system webview + Rust).

## Scored matrix

Weights reflect what can sink a Steam launch. Scores 1–5; evidence column says where each score comes from. The
PLT-0005–0009 hardware spike fills the "measured" column; a score changes only if a measurement contradicts it.

| Criterion (weight) | Electron | Tauri 2 | Evidence |
|---|---|---|---|
| WebGL2 compatibility (×5) | **5** — one Chromium/ANGLE build on every OS; the renderer is developed and smoke-tested against Chromium (Playwright + SwiftShader in CI, `scripts/desktop.mjs smoke`) | **2** — three engines: WebView2 (Chromium, fine), WKWebView (Safari WebGL2, different float-RT/MSAA limits), WebKitGTK (WebGL2 historically slow or disabled under some compositors; on SteamOS it is whatever the runtime ships) | Chromium is the only engine the game is tested in; float RT + MSAA resolve behaviour differs on WebKit |
| Steam overlay (×5) | **4** — `steamworks.js` `electronEnableSteamOverlay()` (in-process GPU + frame invalidation) is the known-working path used by shipped Electron games; needs verifying in fullscreen/borderless on each OS (PLT-0042) | **2** — the overlay must hook the webview's own GPU process/surface; with WebView2/WKWebView/WebKitGTK the game does not own the swap chain, reports of partial or no overlay | Overlay hooks the process that presents frames |
| Steamworks API (×4) | **5** — `steamworks.js` 0.4 (napi, prebuilt for win/mac/linux): achievements, stats, cloud, rich presence, overlay links, Deck detection, floating keyboard | **4** — Rust `steamworks` crate is mature; bridge code has to be written in Rust | package API surface |
| Install size (×2) | **2** — ~124 MB compressed Linux demo package (measured, `scripts/check-package.mjs`), Windows similar | **5** — ~10–20 MB | measured / typical |
| Startup & memory (×2) | **3** — Chromium cold start ~1–2 s, ~250–350 MB idle | **4** — lighter host, but WebKitGTK/WKWebView still spawn web processes | spike PLT-0005 records real numbers |
| Dev velocity (×3) | **5** — TypeScript on both sides; main process shares modules with the game (`src/platform/*`, save codec); unit-testable in Vitest | **3** — Rust main process, second toolchain in CI, cross-compilation for macOS universal | codebase |
| Update / release story (×2) | **4** — Steam delivers updates; electron-builder produces depot folders directly; fuses + ASAR integrity; signing/notarisation well trodden | **4** — Steam delivers updates; tauri bundler similar | build config |
| Security posture (×2) | **4** — sandbox + contextIsolation + CSP + fuses; Chromium patched by bumping Electron | **4** — smaller attack surface, but system webview patch level is the user's | PLT-0012–0015 |
| **Weighted total** | **108** | **78** | |

## Decision

**Electron** (latest stable major at the time of the spike: 44.x), packaged with electron-builder, Steamworks through
`steamworks.js`. Tauri would win only if it matched Electron on WebGL2 compatibility *and* overlay — it does not on
macOS and Linux/Deck, which are both demo targets. Install size is the accepted cost.

Consequences:

- The desktop shell lives in `desktop/` (TypeScript, bundled by esbuild into `desktop/dist/*.cjs`).
- The game keeps running unchanged in browsers through the web/no-op platform backend (itch/press demo).
- Chromium has no exclusive fullscreen and no runtime vsync toggle; "fullscreen" and "borderless" are both
  borderless windows on Windows/Linux, vsync applies on next launch (documented in `docs/platform/build.md`).
- `steamworks.js` 0.4 has no `GameOverlayActivated` callback and no Timeline API: PLT-0042 (pause on overlay)
  and PLT-0050 (Timeline markers) need a binding upgrade or a small napi addition — tracked in the handoff.

## Runtime version policy (PLT-0011)

1. **Pinned major.** `electron`, `electron-builder`, `@electron/fuses` and `steamworks.js` are pinned to exact
   versions in `package.json`; the lockfile is committed and CI installs with `npm ci`. Node is pinned in `.nvmrc`.
2. **Security patches within 2 weeks.** When Electron publishes a security/patch release of the pinned major
   (watch <https://releases.electronjs.org/> and Dependabot PRs), bump within 14 days: CI green + the desktop smoke
   (`node scripts/desktop.mjs smoke`) + a 15-minute manual pass on Windows and Deck, then ship to `beta`.
3. **Major upgrades only between milestones** (after Demo ships, after Alpha, after Beta) — never inside a
   festival window or release candidate — with a full regression pass: every Ch1–2 operation on the three OSes and
   Deck, Steam overlay/achievements/Cloud, crash reporting, save compatibility suite.
4. **Support window.** Electron supports the latest three majors; we must never ship a major that is out of
   support. If the pinned major reaches end of life before a milestone boundary, the upgrade is pulled forward.
5. Dependabot is configured to ignore Electron semver-major bumps (`.github/dependabot.yml`), so majors happen
   only by deliberate PR under rule 3.
