# PLT — tasks that need a human

Prepared material lives next to this file: `steamworks-setup.md`, `signing.md`, `hardware-qa.md`,
`crash-backend.md`, `next-fest.md`; build/release docs in `docs/platform/` and `docs/release.md`.

- PLT-0005 — Run the Electron build on Windows 11, macOS 14 arm64 and Ubuntu 22.04 and record install size, cold start, idle RAM and frame pacing (Tauri optional, ADR-001 already decided Electron); protocol + results table in `hardware-qa.md` §1
- PLT-0006 — Record WebGL2 caps/shader compile per OS from the log header and op I-1; `hardware-qa.md` §1.5
- PLT-0007 — Verify the Steam overlay (Shift+Tab) in windowed/borderless/fullscreen on Windows with the Steamworks app id set; `hardware-qa.md` §1.6
- PLT-0009 — Measure WebAudio latency, device change and suspend/resume on each OS; `hardware-qa.md` §1.7
- PLT-0031 — Clean Windows 10 1809 / 11 VM test (no redistributables, non-admin, per-monitor DPI); `hardware-qa.md` §2
- PLT-0034 — Create the Azure Trusted Signing account/profile (or OV/EV cert on an HSM) and add the CI secrets; `signing.md` §Windows
- PLT-0037 — Put signing credentials only in GitHub secrets, restrict access to two people, calendar the rotations; procedure in `signing.md` §Custody
- PLT-0038 — Once secrets exist, confirm the `build` workflow's verify steps (signtool/codesign/spctl/stapler) run green and block on failure; `.github/workflows/build.yml`
- PLT-0042 — Verify overlay rendering/input per OS; `hardware-qa.md` §1.6. Auto-pause is wired end to end (`SteamService.onOverlay` → `ss:overlay` → `OverlayGate` pauses and silences input) but steamworks.js 0.4.0 exposes no `GameOverlayActivated` callback: `desktop/src/steam.ts` probes `callback.SteamCallback.GameOverlayActivated` at runtime and logs when it is absent. Until a steamworks.js release (or a fork) binds `GameOverlayActivated_t { uint8 m_bActive }` as `SteamCallback.GameOverlayActivated` with `register(id, ({ active }) => …)`, the overlay pauses the game only through the focus-loss path (Steam's overlay steals keyboard focus on Windows/Linux, so `ss:focus false` fires; verify on macOS)
- PLT-0050 — Steam Timeline markers: `platform.steam.timeline()` (op start/end as a range event, Malison appearance, patient lost, XS rank as instantaneous events) is implemented and sent over `ss:steam-timeline`, but steamworks.js 0.4.0 has no ISteamTimeline binding, so `SteamService.timeline` drops them with one log line. Needed binding (SDK ≥ 1.60, `ISteamTimeline`): `timeline.setTimelineTooltip(description, timeDelta)`, `timeline.setTimelineGameMode(ETimelineGameMode)`, `timeline.addInstantaneousTimelineEvent(title, description, icon, priority, startOffsetSeconds, ETimelineEventClipPriority)`, `timeline.startRangeTimelineEvent(…)` → handle and `timeline.endRangeTimelineEvent(handle, endOffsetSeconds)`; `desktop/src/steam.ts` `OptionalApi` documents the exact shapes it probes for. Once bound, verify the clip labels in Steam Game Recording
- PLT-0045 — Upload `steam/output/<edition>/rich_presence_english.vdf` and check the friends list (code sets presence on every scene change); `steamworks-setup.md` §4
- PLT-0046 — Configure Auto-Cloud (quota, root paths, overrides) exactly as listed, then run the two-machine round trip; `steamworks-setup.md` §3, `hardware-qa.md` §4
- PLT-0047 — Offline-conflict test on two machines; `hardware-qa.md` §4
- PLT-0048 — Verify Steam's screenshot key captures the frame on each OS (in-game F12 fallback to `Pictures/Suture & Steel` is implemented; `HookScreenshots` is not in the binding); `hardware-qa.md` §4
- PLT-0051 — With the overlay disabled in Steam, check what `ActivateGameOverlayToStore` does (browser fallback is implemented when Steam is absent); `hardware-qa.md` §4
- PLT-0054 — Create the `sns-build` Steam account with upload-only permissions and store `config.vdf` as a secret; `steamworks-setup.md` §6
- PLT-0055 — Enter the generated launch options (incl. "Launch in safe mode") in Steamworks; `steam/output/<edition>/launch_options.md`, `steamworks-setup.md` §2
- PLT-0056 — Create the demo app linked to the base game, its depots and branches; put the ids into `src/platform/editions.ts`; `steamworks-setup.md` §1
- PLT-0067 — Carry-over import QA on Windows, macOS, Linux and Deck incl. uninstalled demo; `hardware-qa.md` §4
- PLT-0069 — At demo 1.0: copy the 1.0 build's `profile.json`/`slotauto.json` into `tests/fixtures/saves/` as `v2-demo-1.0.0-*.json` and freeze content-id table v1 (already covered by `tests/save.test.ts` / `tests/carryover.test.ts`); decision point is a release-management call
- PLT-0070 — Fill in the Next Fest dates and owners; `next-fest.md`
- PLT-0071 — Rehearse the ≤4 h festival hotfix pipeline and record timings; `docs/release.md` §Festival hotfix pipeline
- PLT-0075 — Clean-machine demo QA via the Steam client on all five targets; `hardware-qa.md` §6
- PLT-0076 — Request the Deck compatibility review in Steamworks once the Deck checklist passes; `hardware-qa.md` §4
- PLT-0111 — Tear-test VSync off/on (next-launch switch is implemented); `hardware-qa.md` §3
- PLT-0112 — Verify rAF runs at 144/165 Hz on Windows and ProMotion; `hardware-qa.md` §3
- PLT-0116 — Alt+Tab/minimise/restore in fullscreen on NVIDIA, AMD, Intel; `hardware-qa.md` §3
- PLT-0119 — Visual check on a Windows HDR monitor; `hardware-qa.md` §3
- PLT-0123 — Choose the crash backend (Sentry recommended), create the project and add DSN/minidump URL/auth-token secrets; Crashpad + CI symbol upload are wired; `crash-backend.md`
- PLT-0124 — Same account as PLT-0123 (JS reporter + source-map upload are implemented); `crash-backend.md`
- PLT-0130 — Build the crash-free-sessions dashboard and alert (≥99.5 % gate); `crash-backend.md` step 8
- PLT-0133 — Non-ASCII/long-path and OneDrive-redirected-folder test on Windows VMs (paths are unit-tested); `hardware-qa.md` §2
- PLT-0140 — Add the signing secrets so the matrix produces signed packages; workflow is `.github/workflows/build.yml`; `signing.md`
- PLT-0142 — Add `STEAM_CONFIG_VDF`, `STEAM_BUILD_USERNAME` and `TEAM_WEBHOOK_URL` secrets to enable the nightly `qa` upload + post; `.github/workflows/nightly.yml`
- PLT-0147 — Protect `main` and `release/*` in GitHub (required checks `ci / web`, `ci / desktop-linux`, 1 review); branch model in `docs/release.md`
- PLT-0149 — Add secrets (signing, Steam, Sentry) then run the `release` workflow once end to end; `.github/workflows/release.yml`
- PLT-0150 — Create a long-term storage bucket (object lock, 3-year lifecycle) and credentials for the archive job; `crash-backend.md` last paragraph
- PLT-0153 — Controller verification on Windows, macOS, Linux (Gamepad API backend + disconnect pause are implemented and unit-tested); `hardware-qa.md` §5
- PLT-0156 — Deck touchscreen playthrough; `hardware-qa.md` §5
- PLT-0159 — Deck trackpad playtest of every Ch1–2 operation at A rank or better; `hardware-qa.md` §4
- PLT-0161 — Deck suspend/resume ×10 mid-operation (auto-pause on suspend is implemented); `hardware-qa.md` §4
- PLT-0162 — Confirm no step needs a keyboard on Deck (floating keyboard bridge exists for future text fields); `hardware-qa.md` §4
- PLT-0164 — Run Valve's Deck Verified checklist for the demo; `hardware-qa.md` §4
