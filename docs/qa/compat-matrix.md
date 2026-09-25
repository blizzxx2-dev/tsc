# Compatibility matrix (QAT-0111)

One board for every compatibility question the demo must answer. It aggregates the ENG GPU/ANGLE matrix, the PLT
OS/display matrix and the INP device matrix; each cell has an owner, a status and an evidence link (smoke log,
screenshot, capture under `docs/qa/perf-protocol.md`, or the issue that tracks a failure).

Status: ✅ pass · ⚠️ pass with issue (link) · ❌ fail (link) · ⏳ not yet run · — not applicable.
Automated coverage today: Chromium + SwiftShader (CI smoke, E2E, visual) on Linux — `.github/workflows/qa-ci.yml`.

## GPU / graphics (owner: ENG)

| Config | Driver / ANGLE backend | Smoke + one boss | Perf (min-spec budget) | Owner | Status | Evidence |
|---|---|---|---|---|---|---|
| SwiftShader (CI reference) | ANGLE → SwiftShader | automated | — | QA | ✅ | CI `smoke` job |
| NVIDIA GTX 960 (Maxwell) | pinned driver, D3D11 | lab sweep | yes | ENG | ⏳ | |
| NVIDIA GTX 1060 (Pascal) | D3D11 | lab sweep | yes | ENG | ⏳ | |
| NVIDIA RTX 2060 (Turing) | D3D11 | lab sweep | | ENG | ⏳ | |
| NVIDIA RTX 4060 (Ada) | D3D11 | lab sweep | | ENG | ⏳ | |
| AMD RX 580 (Polaris) | D3D11 | lab sweep | yes | ENG | ⏳ | |
| AMD RX 6600 (RDNA2) | D3D11 | lab sweep | | ENG | ⏳ | |
| AMD RX 7600 (RDNA3) | D3D11 | lab sweep | | ENG | ⏳ | |
| Intel UHD 620 (Gen9.5 iGPU) | D3D11 | lab sweep | yes (lowest) | ENG | ⏳ | |
| Intel Iris Xe (Gen12 iGPU) | D3D11 | lab sweep | | ENG | ⏳ | |
| Intel Arc A750 | D3D11 | lab sweep | | ENG | ⏳ | |
| Hybrid laptop (Optimus, iGPU + NVIDIA) | D3D11, both GPUs | lab sweep | | ENG | ⏳ | |
| Hybrid laptop (AMD iGPU + dGPU) | D3D11 | lab sweep | | ENG | ⏳ | |
| Steam Deck (Van Gogh APU) | Proton / ANGLE → Vulkan or GL | Deck round | yes | ENG | ⏳ | |
| macOS Apple silicon (M1) | ANGLE → Metal | lab sweep | | ENG | ⏳ | |
| Linux Mesa (radeonsi) | ANGLE → GL | lab sweep | | ENG | ⏳ | |

## OS / display (owner: PLT)

| Config | Launch | Fullscreen/window toggles | Alt-tab / sleep | DPI 100/150/200 % | Multi-monitor | Owner | Status | Evidence |
|---|---|---|---|---|---|---|---|---|
| Windows 10 22H2 | | | | | | PLT | ⏳ | |
| Windows 11 23H2/24H2 | | | | | | PLT | ⏳ | |
| SteamOS 3.x (Deck, gaming mode) | | | | — | — | PLT | ⏳ | |
| SteamOS desktop mode | | | | | | PLT | ⏳ | |
| Ubuntu 24.04 (X11 and Wayland) | | | | | | PLT | ⏳ | |
| macOS 14 | | | | | | PLT | ⏳ | |
| OS locale tr-TR / de-DE / pl-PL / pt-BR | automated (browser) | | | | | QA | ✅ | `tests/e2e/platform.e2e.ts` |

## Input devices (owner: INP)

| Device | Menus | Stitching precision | Star gesture (Litany) | Glyphs | Owner | Status | Evidence |
|---|---|---|---|---|---|---|---|
| Mouse (1000 Hz) | | | | | INP | ⏳ | |
| Trackpad (laptop) | | | | | INP | ⏳ | |
| Trackball | | | | | INP | ⏳ | |
| Steam Deck controls (default layout) | | | | | INP | ⏳ | |
| Xbox controller | | | | | INP | ⏳ | |
| DualSense | | | | | INP | ⏳ | |
| Pen tablet (Wacom, absolute mode) | | | | | INP | ⏳ | |

The lab sweep (QAT-0112) and Deck round (QAT-0123) fill the ⏳ cells; each result links its evidence here.
