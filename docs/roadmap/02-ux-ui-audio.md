# 02 — Input, UI/UX & Audio

Workstream prefixes: **INP** (input & controls), **UIX** (UI/UX, HUD, menus, accessibility), **AUD** (audio).
Scope follows `_brief.md`: `Demo` = everything the Chapters 1–2 Steam demo needs at release quality
(≈10 operations, Malison of Matins and of Lauds); `Alpha`/`Beta`/`Release` = Chapters 3–5 and the full game;
`Post` = after launch. `[x]` = already in the codebase as of commit `fbe1cf0` (Chapter II, Lauds, bot surgeon, rename) plus the settings/options work in the current working tree.

Code anchors used below: `src/core/input.ts` (`Input`), `src/core/audio.ts` (`Audio`, `Cue`),
`src/surgery/operation.ts` (`Operation.handlePointer`, `rate`, `say`, `cues`), `src/surgery/gesture.ts` (`isStar`),
`src/surgery/types.ts` (`TOOL_INFO`, `Pointer`), `src/scenes/*.ts` (Title, Story, Briefing, Operation, Results,
Operations, `flow.ts`), `src/ui/widgets.ts` / `layout.ts` (`panel`, `button`, `toolIcon`, `reticle`, `PALETTE`, 1280×720 view).

---

## Epic INP-A · Input architecture & mouse/keyboard gestures (Demo)

### Device plumbing & action layer
- [x] INP-0001 · M0 · P0 · M · Mouse/keyboard/wheel sampling — `Input` latches pressed/released/rightPressed/wheel per frame and maps pointer to the 1280×720 virtual view
- [x] INP-0002 · M0 · P1 · S · Pointer robustness basics — pointer capture on press, canvas context menu suppressed, window blur clears held keys/buttons, OS cursor hidden (`cursor: none; touch-action: none`)
- [x] INP-0003 · M0 · P1 · S · Fullscreen toggle — F11 and Alt+Enter toggle document fullscreen (`main.ts`)
- [x] INP-0004 · Demo · P0 · M · Action map — add `src/core/actions.ts` mapping physical inputs to named actions (`tool.select.1..8`, `tool.next`, `tool.prev`, `tool.quickSwap`, `tool.radial`, `litany.draw`, `litany.key`, `pause`, `ui.confirm`, `ui.back`, `vn.advance`, `vn.fast`, `vn.auto`, `vn.log`, `vn.hide`); scenes read actions only — grep finds no `keyPressed('Key…')`/`'Digit…'` literals outside `actions.ts`
- [x] INP-0005 · Demo · P0 · M · Device adapters — split `Input` into mouse, keyboard and gamepad adapters that fill one `InputFrame` snapshot per tick; `Operation.handlePointer(ptr, dt)` still receives the existing `Pointer` shape and all current tests pass unchanged
- [x] INP-0006 · Demo · P0 · S · `pointercancel` / `lostpointercapture` are treated as a release — alt-tabbing mid-drag with the Tongs snaps the object back instead of leaving `down` stuck (manual + unit test on adapter)
- [x] INP-0007 · Demo · P0 · S · Focus-loss auto-pause — `blur`, `visibilitychange` and Steam overlay activation open the pause menu during an operation; `timeLeft` does not advance while unfocused (test: hidden 10 s, timer unchanged)
- [x] INP-0008 · Demo · P1 · S · Wheel normalisation — replace `Math.sign(e.deltaY)` per event with delta accumulation (threshold 50 px or 1 line, 120 ms cooldown) so one mouse notch or one trackpad flick = one tool step (test: 30 trackpad events of 4 px → at most 2 steps)
- [x] INP-0009 · Demo · P1 · S · Layout-aware key labels — bindings stay on `KeyboardEvent.code`, but on-screen labels come from `navigator.keyboard.getLayoutMap()` so AZERTY/QWERTZ players see their real key caps (fallback to US labels when the API is missing)
- [ ] INP-0010 · Demo · P1 · S · Shipped-build key hygiene — in Electron release builds Ctrl+R, F5, Ctrl+W, Ctrl+Shift+I and Alt-menu focus are disabled; Alt+F4 / Cmd+Q quit via a confirm dialog when mid-operation
- [x] INP-0011 · Demo · P1 · S · Mouse button coverage — middle button and side buttons (X1/X2) are captured (`pointerdown` `button` 1/3/4) and exposed as bindable inputs; browser back/forward navigation on X1/X2 is suppressed
- [ ] INP-0012 · Demo · P2 · S · Cursor confinement option — "Confine cursor to window" uses Pointer Lock with a virtual cursor so drags crossing the window edge in windowed mode never release (off by default; on by default in fullscreen on multi-monitor setups)

### Pointer fidelity, buffering & latency
- [x] INP-0013 · Demo · P0 · M · Timestamped event queue — record every pointer/key event with `event.timeStamp` in order; the frame consumes them in sequence so a press+release inside one frame both register and hold durations (Tincture 0.7 s, lens reveal 0.4 s) are measured from event time, not frame time (unit tests for press+release same frame)
- [x] INP-0014 · M0 · P0 · M · Sub-frame stroke samples — `Input.path` collects `getCoalescedEvents()` points (capped at 64 per frame) and `OperationScene` replays each as its own `Pointer` step with dt split across them, so fast stitches survive low frame rates
- [ ] INP-0015 · Demo · P1 · S · Frame-rate independence test — replay the same recorded stitch, incision and extraction strokes at 30/60/144/240 Hz through the headless harness; ratings, stitch counts and vitals match exactly
- [x] INP-0016 · Demo · P1 · M · Input record/replay — `?record=1` serialises `InputFrame` streams to JSON with op id + seed; `?replay=<file>` re-drives the operation deterministically; used for regression tests and attached to bug reports
- [x] INP-0017 · Demo · P1 · S · Teleport guard — pointer jumps > 200 px in one sample (focus regained, cursor warped, pen proximity re-entry) break the stroke instead of producing a giant segment, preventing accidental stitch crossings and incision jumps (unit test)
- [ ] INP-0018 · Demo · P1 · S · Inter-phase grace — during the 0.8 s `phaseDelay` between phases and the 1.2 s intro, empty Lancet presses are ignored (no MISS, no 3-vital hurt) (unit test on `Operation.emptyPress`)
- [x] INP-0019 · Demo · P1 · S · Tool-key-before-click ordering — a tool hotkey pressed up to 100 ms before a click in the same or previous frame applies before the press is dispatched (test: `Digit2` then click on a shard grabs it with the Tongs)
- [ ] INP-0020 · Demo · P1 · M · Latency overlay — dev overlay (F3) shows input-event→next-rAF and input-event→present latency p50/p95 over the last 300 events plus current frame time; target p95 ≤ 50 ms at 60 Hz in the Electron build
- [ ] INP-0021 · Demo · P1 · M · Click-to-photon measurement — measure with a 240 fps camera on 3 reference PCs (low/mid/high) and a Steam Deck, windowed and fullscreen, VSync on/off; record results in `docs/qa/latency.md`; release gate ≤ 70 ms on mid PC, ≤ 90 ms on Deck
- [ ] INP-0022 · Demo · P2 · S · Low-latency canvas experiment — compare `desynchronized: true` WebGL context and Electron `--disable-frame-rate-limit`/VSync-off settings against baseline with the latency overlay; adopt only if p95 improves ≥ 8 ms without tearing complaints
- [ ] INP-0023 · Demo · P2 · S · High-polling mice — with the existing 64-sample cap, an 8 kHz mouse keeps input handling plus per-sample `handlePointer` replay under 0.5 ms/frame on the low-spec PC (profile capture attached to the PR)

### Gesture translation — trace (Lancet incisions)
- [x] INP-0024 · M0 · P0 · M · Incision tracing — press at the head or last progress point (22 px / 30 px windows), follow the dashed guide; mean deviation < 6 px COOL, < 13 px GOOD, else BAD; > 34 px slip = BAD + 2 vitals (`Incision`)
- [ ] INP-0025 · Demo · P1 · S · Trace tuning table — move incision constants (start radius 22, resume window 30, slip 34, COOL/GOOD 6/13) into `src/surgery/tuning.ts` with comments; entities read from it; no magic numbers left in `Incision`
- [ ] INP-0026 · Demo · P1 · M · Trace playtest calibration — log per-incision mean deviation from 10 mouse + 4 trackpad + 3 gamepad testers on op1-2 and Ch2 ops; set thresholds so ≥ 80 % of first attempts rate GOOD or better on mouse and ≥ 65 % on trackpad; record histogram in the tuning PR
- [ ] INP-0027 · Demo · P1 · S · Backwards/late-start feedback — pressing on the guide but > 30 px from the progress point pulses the start node and shows the one-time hint "Begin at the glowing mark" instead of silently ignoring the press
- [ ] INP-0028 · Demo · P2 · S · Trace smoothing — optional 1€ filter (tunable min-cutoff/beta) applied to pointer samples during Lancet traces only; default off for mouse, on for gamepad virtual cursor and touch (unit test: noisy line deviation reduced ≥ 40 %)
- [ ] INP-0029 · Demo · P1 · S · Rating bands scale with Target Size — the COOL/GOOD mean-deviation bands (6/13 px) are multiplied by the assist factor (1.0/1.25/1.5×) so larger targets also forgive wobble (unit test at 1.5×)
- [ ] INP-0030 · Demo · P1 · S · Lancet hint accuracy — `TOOL_INFO` promises "Encircle growths to excise them" but no Chapter 1–2 entity can be encircled; the demo hint describes tracing incisions, nicking barbs and lancing buboes/egg sacs until the encircle mechanic ships (test: each hint verb maps to an implemented interaction)

### Gesture translation — hold & brush (Leech-Pipe, Salve, Tincture, Brand, Lens)
- [x] INP-0031 · M0 · P0 · S · Hold tools — Leech drains pools under the held cursor, Tincture hold 0.7 s injects (6 s cooldown), Brand sears while held, Lens reveals hidden entities on hover, Salve brushes `Coverage` cells
- [x] INP-0032 · Demo · P1 · M · Toggle-hold option — "Hold actions: Hold / Toggle"; in Toggle mode one click starts a hold-tool action and a second click (or moving off-body) stops it; synthesised `Pointer.down` drives Leech, Salve, Tincture and Brand (unit test: Brand toggle sears a grub without the button held)
- [x] INP-0033 · Demo · P2 · S · Hold key — bindable key (default `Shift` during operations; Space is taken by the Litany key) acts as the primary button at the cursor for hold tools, so players can rest the mouse button finger
- [ ] INP-0034 · Demo · P1 · S · Button-chatter debounce — a release followed by a press within 60 ms (worn mouse switches) does not reset Tincture injection or Brand sear progress and does not start a new `pressId` stroke (unit tests for both tools)
- [ ] INP-0035 · Demo · P1 · S · Brand healthy-flesh grace — the Brand does not hurt healthy flesh for the first 120 ms of a hold, so brief contact while moving between grubs isn't penalised (unit test: 100 ms on flesh = 0 damage)

### Gesture translation — zig-zag stitching (Gut Thread)
- [x] INP-0036 · M0 · P0 · S · Zig-zag stitching — each crossing of the wound line is a stitch, crossings within 10 px of an existing mark are rejected, one-stroke closure rates COOL (`StitchLine`)
- [ ] INP-0037 · Demo · P0 · S · Fast-swipe robustness — with sub-frame samples, a 500 px/s zig-zag at 30 fps registers ≥ 95 % of geometric crossings; crossings within 4 px of a wound endpoint still count (unit test with synthetic stroke)
- [ ] INP-0038 · Demo · P1 · S · Stitch spacing scales with wound length — min spacing = clamp(total/needed × 0.4, 8, 16) px instead of fixed 10 px, so short nicks can't be failed by an over-strict rule (unit tests: 36 px and 120 px lacerations)
- [x] INP-0039 · Demo · P1 · M · Assisted stitching option — hold primary and run the cursor along the wound; a crossing is auto-generated every wound-length/needed px while within 20 px of the line; ratings capped at GOOD; default on for gamepad if the calibration task shows < 80 % op1-1 completion
- [ ] INP-0040 · Demo · P2 · S · Stitch direction freedom — stitching may start at either end or the middle and travel either way; verify with tests for reverse-direction strokes

### Gesture translation — grab & pull-out (Tongs)
- [x] INP-0041 · M0 · P0 · S · Tongs extraction — grab within 20 px of the handle, drag > 70 px from origin to extract; barbed arrows need two Lancet nicks or they tear (1.6× laceration, BAD) (`Embedded`)
- [ ] INP-0042 · Demo · P1 · S · Grab snapping — Tongs snap to the nearest graspable within the grab radius (20 px × Target Size assist) and the hovered graspable gets an outline, so near-misses on thin arrow shafts don't fall through to flesh
- [ ] INP-0043 · Demo · P1 · S · Pull-axis tolerance — while grabbed, a faint axis line shows the shaft direction; pulling within ±35° of the axis keeps COOL/GOOD timing rules, larger deviations cap the rating at GOOD (unit tests at 20° and 60°)
- [ ] INP-0044 · Demo · P2 · S · Drag-lock option — "Grab: Hold / Click-to-toggle": click once to seize, move, click again to release; Tongs extraction thresholds unchanged (unit test for toggle extraction)
- [ ] INP-0045 · Demo · P1 · S · Mid-grab interruptions — switching tool, drawing the Litany star, pausing or losing focus while an object is grabbed returns it to its origin without rating; covered by unit tests for each path

### Tool switching
- [x] INP-0046 · M0 · P0 · S · Tool selection — hotkeys 1–8 (`TOOL_INFO.code`), mouse wheel and Q/E cycle, clicking a tray slot; switching releases any capture (`Operation.setTool`)
- [ ] INP-0047 · Demo · P0 · S · HUD hit-test layer — replace the `trayClick` flag and `x > TRAY.x+TRAY.w+10` filter with a UI hit-test pass where HUD widgets (tray, Litany icon, callout panel, pause button) consume presses first; test: clicking the gap between tray slots with the Lancet never rates MISS
- [ ] INP-0048 · Demo · P1 · S · Unavailable-tool feedback — pressing the hotkey of a tool not in `def.tools` shakes the tray and shows "Not in the kit for this operation" once per op; no `select` cue spam
- [x] INP-0049 · Demo · P1 · S · Quick-swap — bindable action (default `Tab`/mouse X1) toggles between the current and previous tool; test: 1 → 4 → Tab returns to Lancet, Tab again returns to Gut Thread
- [x] INP-0050 · Demo · P1 · M · Radial tool menu — hold middle mouse (or gamepad Y) opens a radial of the operation's tools centred on the cursor; flick direction + release selects; world time is not paused; selection latency ≤ 1 frame after release; cancels if released within 12 px of centre
- [x] INP-0051 · Demo · P2 · S · Wheel options — "Invert wheel" and "Wheel wraps around the tray" settings; default wrap on (current behaviour)
- [ ] INP-0052 · Demo · P2 · M · Auto-tool assist — optional "Suggest tool on press": pressing on a target with the wrong tool switches to the tool implied by that target (pool → Leech-Pipe, open laceration → Gut Thread, grub → Brand) before dispatching; off by default; unit test for each Ch1–2 entity type

### Litany of Stillness input
- [x] INP-0053 · M0 · P0 · M · Star recogniser `isStar` — resample to 80 points, closed within 35 % of size, 4–8 self-crossings, ≥ 3 sharp corners; tests accept clean/sloppy pentagrams and reject circle, zig-zag, tiny scribble
- [x] INP-0054 · M0 · P1 · S · Star trail & denial popups — right-drag trail rendered additively; failures show "The sign falters…", "The Litany is spent." or "Not now."
- [ ] INP-0055 · Demo · P0 · M · Star corpus — capture ≥ 300 positive star strokes (mouse, trackpad, pen, gamepad stick; ≥ 15 people) and ≥ 300 negatives (circles, checks, scribbles, zig-zags, stitching strokes) into `tests/fixtures/stars/*.json` via the record tool
- [x] INP-0056 · Demo · P0 · S · Recogniser benchmark test — Vitest runs `isStar` over the corpus; CI fails if true-positive rate < 95 % or false-positive rate > 1 %
- [x] INP-0057 · Demo · P1 · M · Recogniser tuning — accept any starting vertex, either winding direction, rotation ±45° and aspect down to 0.6; minimum size 60 px scales with UI scale; new unit tests for each case, corpus benchmark still green
- [ ] INP-0058 · Demo · P2 · M · $P point-cloud recogniser spike — implement a $P matcher with 5 star templates, compare F1 against the heuristic on the corpus, keep the better one (or AND/OR combine) and record the numbers in the PR
- [x] INP-0059 · Demo · P1 · S · Failure reasons — `isStar` returns a diagnostic (`tooSmall`, `notClosed`, `tooFewPoints`, `tooManyCrossings`) and the failure popup names it ("Close the sign, Doctor", "Five points — draw larger")
- [ ] INP-0060 · Demo · P1 · S · Live vertex feedback — while drawing, detected corners are counted incrementally and exposed to the HUD star (0–5 points lit) and the audio shimmer pitch
- [x] INP-0061 · M0 · P0 · S · Litany key assist — "Assist: Litany on Space" casts the Litany with Space (same denial popups), the indicator caption reads "Space", and results count as assisted (`settings.litanyKey`)
- [x] INP-0062 · Demo · P0 · S · Litany key as a bindable action — the Space assist moves into the bindings system as `litany.key` (default Space, rebindable, gamepad chord LB+RB); the setting becomes "Litany input: Draw / Key / Both"; design decides whether key-casting stays flagged by `assisted()` and the results screen matches
- [ ] INP-0063 · Demo · P1 · S · Laptop alternative — holding a bindable modifier (default `Alt`) turns left-drag into star drawing, so trackpad users without comfortable right-drag can cast; tested on a Windows Precision and a Mac trackpad
- [x] INP-0064 · Demo · P1 · S · Star-while-grabbing — starting a star stroke with the right button while the Tongs hold an object releases it back to origin and the star still records (unit test)
- [ ] INP-0065 · Demo · P2 · S · Stitch-stroke false positives — zig-zag stitch strokes from the corpus never trigger the Litany even if drawn with the Litany modifier held for < 150 ms (debounce) (unit test)

### Precision, handedness & motor options
- [x] INP-0066 · Demo · P1 · S · Global hit-scale — one `hitScale` from the Target Size assist multiplies every entity interaction radius (Incision 22/34, Tongs 20, Embedded nick 30, Leech r+10, Salve 24, lens 60/110); table-driven unit test per entity at 1.5×
- [ ] INP-0067 · Demo · P2 · S · Precision modifier — while a bindable key (default `Ctrl`) is held in pointer-lock mode, cursor movement is scaled ×0.4 for fine tracing; indicator ring on the reticle while active
- [ ] INP-0068 · Demo · P2 · S · Cursor speed — 0.5×–2.0× multiplier applies in pointer-lock and virtual-cursor modes (no effect in absolute OS-cursor mode, greyed with explanation)
- [ ] INP-0069 · Demo · P1 · S · Left-handed mode (input) — swaps default primary/secondary mouse roles (tool on right button, star on left) independently of the OS setting; bindings screen reflects the swap; HUD mirroring handled in UIX
- [ ] INP-0070 · Demo · P2 · S · One-handed mouse preset — operations fully playable without keyboard: wheel/radial for tools, right-drag star, pause via a clickable HUD button; verified by completing op1-1…op1-5 mouse-only

### Rebinding
- [x] INP-0071 · Demo · P0 · M · Bindings model — each action holds up to 2 keyboard/mouse bindings + 1 gamepad binding; versioned JSON in the settings file (separate from progress), defaults in code, migration on version bump (unit tests)
- [x] INP-0072 · Demo · P0 · M · Rebinding screen — Options → Controls lists actions by group (Tools, Litany, Story, Menus); "Press a key…" capture with 5 s timeout, Esc cancels, conflict prompt offers Swap/Cancel, per-action and global Reset to defaults; works with mouse, keyboard and gamepad navigation
- [x] INP-0073 · Demo · P0 · S · Reserved inputs — `Escape` (pause/back), primary mouse (use tool) and gamepad Start cannot be unbound; attempting shows an explanation
- [x] INP-0074 · Demo · P0 · S · Glyphs from bindings — every prompt ("Right-drag ★" in the Litany indicator, the story footer "Click / Space: advance…", tray hotkey labels, briefing instrument keys) renders via `glyphFor(action)`; test: rebinding `tool.select.1` to `KeyZ` changes the tray label to "Z"
- [ ] INP-0075 · Demo · P2 · S · Binding presets — Default, Left-handed, One-handed mouse; selecting a preset previews changes before applying

## Epic INP-B · Gamepad & Steam Deck basics (Demo)

### Gamepad plumbing
- [x] INP-0076 · Demo · P0 · M · Gamepad adapter — poll `navigator.getGamepads()` each frame (standard mapping), expose buttons/axes to the action map, handle `gamepadconnected`/`gamepaddisconnected` hot-plug; unit tests with a fake Gamepad object
- [x] INP-0077 · Demo · P0 · S · Controller disconnect mid-operation auto-pauses and shows "Controller disconnected — reconnect or press any key"; reconnect resumes to the pause menu, not straight into play
- [x] INP-0078 · Demo · P0 · S · Stick deadzones — radial inner deadzone 0.15, outer 0.95, rescaled; per-stick settings in Options → Controls; test: 0.1 drift produces no cursor motion
- [x] INP-0079 · Demo · P0 · M · Menu navigation actions — `ui.up/down/left/right/confirm/back/tabPrev/tabNext` from arrows/WASD, D-pad and left stick with 180 ms initial repeat delay and 80 ms repeat rate; A/Cross confirm, B/Circle back (Nintendo layout swap option)
- [x] INP-0080 · Demo · P1 · S · Last-used device tracking — prompts switch between mouse/keyboard and gamepad glyphs within one frame of input from the other device, with hysteresis (mouse must move > 4 px) so resting hands don't cause flicker
- [ ] INP-0081 · Demo · P1 · M · Glyph sets — Xbox, PlayStation, Steam Deck, Nintendo and generic glyph atlases in the woodcut UI style; auto-detected from `Gamepad.id` / Steam Input controller type; manual override in Options
- [ ] INP-0082 · Demo · P1 · S · Linux/Electron gamepad sanity — Xbox, DualSense and Deck built-in controls report the standard mapping in the Electron build on SteamOS and Ubuntu; mapping fixes shipped as a table for known ids

### Virtual cursor & gamepad surgery
- [x] INP-0083 · Demo · P0 · M · Virtual cursor — left stick moves the reticle with an acceleration curve (max 900 px/s, response exponent 2.0, 80 ms ramp), RT/R2 = primary press/hold, cursor clamped to the view; "Cursor speed" setting 0.5–2.0×
- [ ] INP-0084 · Demo · P1 · S · Precision nudge — right stick moves the virtual cursor at 25 % speed for tracing and stitching fine work (bindable, off when the right stick is used for the radial)
- [x] INP-0085 · Demo · P1 · M · Aim assist (gamepad only) — cursor speed ×0.5 within 30 px of an interactable valid for the current tool; with the Lancet the cursor gently snaps to the incision progress node on press; toggle "Aim assist" (default on for gamepad)
- [ ] INP-0086 · Demo · P1 · S · Gamepad tool switching — LB/RB cycle tools (firing on release so the LB+RB Litany chord never cycles), hold Y/Triangle opens the radial menu selected with the right stick, D-pad left/right = quick-swap; all rebindable
- [x] INP-0087 · Demo · P0 · M · Gamepad Litany — hold LT/L2 and trace the star with the virtual cursor (stick strokes use the gamepad threshold profile from the corpus), release LT to cast; chord fallback LB+RB held 0.6 s
- [ ] INP-0088 · Demo · P1 · M · Gamepad gesture calibration — 5 testers complete every Ch1–2 operation on an Xbox pad; any mechanic with < 80 % first-try success gets a gamepad-specific tuning entry (radius, speed, assisted stitching default) in `tuning.ts`
- [ ] INP-0089 · Demo · P1 · S · Virtual cursor in menus — in list/menus the stick drives focus navigation, not the cursor; in free-cursor screens (operation, codex art) the cursor appears; switching modes never strands focus

### Steam Input & Steam Deck
- [ ] INP-0090 · Demo · P0 · M · Steam Input action manifest — `game_actions_X.vdf` with action sets Menu, Operation, Story; default configurations for Xbox, PlayStation, generic and Deck; uploaded via Steamworks and tested with the Steam Input configurator
- [ ] INP-0091 · Demo · P0 · M · Deck default layout — right trackpad = mouse (click = primary, soft-press haptic), R2 = primary hold, L2 = Litany draw, left trackpad = radial tool menu, D-pad left/right = quick-swap, Menu = pause, gyro off by default; documented in the Controls screen
- [ ] INP-0092 · Demo · P0 · S · Deck touchscreen basics — touch `pointerType === 'touch'` taps and drags act as primary mouse input in menus and operations; two-finger tap opens pause; tested on device
- [ ] INP-0093 · Demo · P0 · M · Deck Verified input checklist — all functionality reachable with Deck controls, correct Deck glyphs everywhere, no external keyboard needed, no launcher; pass recorded on retail Deck (LCD + OLED)
- [ ] INP-0094 · Demo · P1 · S · Deck suspend/resume — suspending the Deck mid-operation resumes into the pause menu with timer intact and audio context resumed (manual test ×10)

### Haptics
- [ ] INP-0095 · Demo · P2 · M · Rumble patterns — `vibrationActuator.playEffect('dual-rumble')` for BAD (short low), MISS (double), heavy hurt (≥ 8 vitals), Malison hit and critical heartbeat (< 30 vitals, synced to beat); "Vibration" 0–100 % setting; zero when app unfocused
- [ ] INP-0096 · Demo · P2 · S · Deck trackpad ticks — stitch crossings and incision checkpoints trigger a light trackpad haptic pulse via Steam Input (steamworks.js), rate-limited to 30/s

### Input QA
- [x] INP-0097 · M0 · P0 · M · Bot surgeon — `tests/bot.ts` plays every Ch1–2 operation through the `Pointer` API at steady and novice pace; `operations.test.ts`/`balance.test.ts` assert each is winnable and calibrate rank thresholds
- [ ] INP-0098 · Demo · P0 · M · Bot assist & device profiles — extend the bot with assist combinations (time ×2, target 1.5×, toggle-hold, assisted stitching, auto-Litany) and a gamepad profile (capped cursor speed, smoothed path); every Ch1–2 operation stays winnable under each
- [ ] INP-0099 · Demo · P1 · M · Device matrix sign-off — 5 mice (incl. 1 kHz and 8 kHz), Windows Precision trackpad, MacBook trackpad, Wacom Intuos (as mouse), Xbox Series pad, DualSense, Switch Pro, Steam Deck; pass sheet per Ch1–2 op in `docs/qa/input-matrix.md`
- [x] INP-0100 · Demo · P1 · S · Input fuzz test — random press/move/release/key streams for 10 000 frames per operation never throw, never leave `captured` set after release, and never produce NaN positions
- [ ] INP-0101 · Demo · P2 · S · Bug-report hook — F8 saves the last 30 s of input recording + settings + build id to the logs folder and shows the path, for tester reports

## Epic UIX-A · UI foundation & art direction (Demo)

### Widget framework
- [x] UIX-0001 · M0 · P0 · M · Immediate-mode widgets — `panel`, `parchment`, `button` (hover/click), procedural `toolIcon` for all 8 tools, `star`, brass `reticle` (`src/ui/widgets.ts`)
- [x] UIX-0002 · M0 · P0 · S · Resolution scaling — virtual 1280×720 layout, letterboxed 16:9 canvas scaled to the window at up to 2× DPR (`main.ts` resize)
- [x] UIX-0003 · Demo · P0 · M · Update/draw split — widgets currently handle clicks inside `render()`; introduce a per-frame UI context that processes input in `update()` and draws in `render()`, so menus are testable without WebGL and input is handled exactly once per frame
- [x] UIX-0004 · Demo · P0 · M · Focus navigation — every interactive widget registers a focus node; directional navigation picks the nearest node in the pressed direction; gold rim + candle-glow focus ring; Enter/A activates; all menus completable with keyboard only (Playwright keyboard script over Title → Options → Chapter Select → Operation → Pause → Results)
- [x] UIX-0005 · Demo · P0 · S · Activate-on-release — buttons fire on primary release inside the rect after a press inside the rect (not on press), preventing click-through into the next scene; unit test with synthetic press/release
- [x] UIX-0006 · Demo · P0 · M · Control widgets — slider, toggle, stepper (◀ value ▶), dropdown, tab bar, scroll list (wheel/drag/stick), modal confirm dialog; each supports mouse, keyboard and gamepad; gallery page at `?ui=gallery` for visual review
- [x] UIX-0007 · Demo · P0 · S · Modal stack — pause, confirm and options can stack; Esc/B pops only the top modal; input never reaches layers underneath (test: Esc in Options-over-Pause returns to Pause, not gameplay)
- [x] UIX-0008 · Demo · P1 · S · Tooltip widget — 400 ms hover delay (instant on focus for gamepad), auto-flip at screen edges, max width 360 px, used for tray tools, option descriptions and rank seals
- [x] UIX-0009 · Demo · P1 · S · Scene transitions — `game.go()` routes through a transition manager (ink-wash dissolve or fade-through-black, 300 ms, instant with Reduced Motion); input blocked during transitions; no double-trigger if a button is clicked twice
- [x] UIX-0010 · Demo · P1 · S · UI event hooks — widgets emit `ui.hover`, `ui.focus`, `ui.confirm`, `ui.back`, `ui.slider`, `ui.tab`, `ui.error` to the audio event bus (sounds defined in AUD)
- [x] UIX-0011 · Demo · P1 · S · Text bounds — `textBlock` returns the laid-out height; single-line text ellipsises at its widget width; dev builds log widget id + string when text overflows (runs in the pseudo-loc and text-scale checks)

### Layout, resolution & scaling
- [ ] UIX-0012 · Demo · P0 · M · 16:10 / Steam Deck layout — decide and implement 1280×800 handling (extend virtual height to 800 with anchored HUD vs themed letterbox bars); HUD anchors (top-left, top-centre, bottom-right…) respect the extra space; screenshots at 1280×800, 1920×1080, 2560×1440, 3440×1440 and 3840×2160 reviewed
- [ ] UIX-0013 · Demo · P1 · S · Ultrawide handling — 21:9 and 32:9 windows pillarbox the 16:9 play area with an illuminated-border backdrop instead of plain black; the reticle and HUD stay inside the play area
- [ ] UIX-0014 · Demo · P1 · S · Safe-area margins — all HUD and menu elements sit inside a 4 % title-safe margin (debug overlay F3 draws the safe rect)
- [ ] UIX-0015 · Demo · P1 · M · UI scale option — 80–150 % scales HUD, menus and VN text independently of the world; layout verified at both extremes on 1280×800 without overlap
- [ ] UIX-0016 · Demo · P1 · S · Window modes — windowed/borderless/fullscreen and window size persisted; restore on next launch; DPR cap 2 retained with a "Render scale" option (50–100 %) for low-end GPUs

### Art direction & assets
- [ ] UIX-0017 · Demo · P0 · M · UI style guide — one-page guide + reference board: parchment sheets for documents (chart, report, codex, options), dark oak + brass for in-operation HUD, woodcut hatching for icons, wax seals for primary actions, blackletter (UnifrakturMaguntia) only for titles ≥ 36 px, IM Fell English for body; semantic colour tokens (`ok`, `warn`, `danger`, `curse`, `litany`, `inkOnParchment`) added to `PALETTE`
- [ ] UIX-0018 · Demo · P0 · M · 9-slice frames — textured oak panel, parchment sheet, iron-banded frame and torn-edge note replace procedural `panel()`/`parchment()`; single UI atlas ≤ 2048², crisp at 1× and 2× DPR
- [ ] UIX-0019 · Demo · P0 · L · Woodcut icon set — 8 tool icons, 4 rating stamps, heart, hourglass, Litany star, wax seal, rank seals XS/S/A/B/C, and ailment icons for Ch1–2 (knife wound, bite, arrow, bolt, lead shot, fire/acid/hexfire burn, bubo, rot, venom, grub, egg sac, spiderling, curse-sigil, hexstone, Malison); 32/64/128 px exports in the UI atlas
- [ ] UIX-0020 · Demo · P1 · M · Tool cursor sprites — per-tool cursor art with the hotspot at the working tip (blade point, tong jaws, pipe mouth…) replacing the procedural `toolIcon` beside the reticle; reticle kept as optional overlay
- [x] UIX-0021 · Demo · P1 · S · Wax-seal button — red wax seal with embossed glyph for primary actions ("Scrub In", "Continue", "Wishlist"); press squash 90 ms + crack sound hook; disabled state as cold grey wax
- [ ] UIX-0022 · Demo · P1 · S · Illuminated chapter title cards — blackletter chapter numeral, drop-cap border, woodcut vignette for Chapter I and Chapter II
- [ ] UIX-0023 · Demo · P1 · S · Glyph coverage audit — IM Fell English and UnifrakturMaguntia render every character used in Ch1–2 text and UI (`×`, `★`, `▼`, `—`, `’`, `…`, `é`, `ü`, `ß`); missing glyphs fall back to a matching serif; automated test scans content strings against atlas coverage
- [x] UIX-0024 · Demo · P0 · S · Minimum text size — raise every UI string to ≥ 16 px virtual (tray hint and story footer are 13 px, tray keys 14 px today); a test/grep over `g.text(` size literals fails below 16 in HUD/menu code
- [x] UIX-0025 · Demo · P0 · S · Contrast audit — all text ≥ 4.5:1 against its background (WCAG AA); fix known weak pairs such as faded ink `#5a4228` on parchment `#c4ae80` and `inkDim` over flesh; results table in the PR
- [x] UIX-0026 · Demo · P1 · S · Motion language — easing/duration table (hover 80 ms, panel open 220 ms easeOutQuad, stamp 180 ms easeOutBack, page turn 350 ms) implemented as shared tween helpers; all honour Reduced Motion
- [x] UIX-0027 · Demo · P2 · S · Candle-flicker UI lighting — panels receive a subtle 2–3 % luminance flicker synced to the scene's candle light; disabled with Reduced Motion / Reduced Flashing

## Epic UIX-B · Operation HUD (Demo)

### Already in place
- [x] UIX-0028 · M0 · P0 · S · Vitals readout — 0–99 number and bar with colour thresholds (> 60 good, > 30 warn, else danger) in the top bar
- [x] UIX-0029 · M0 · P0 · S · ECG trace — scrolling waveform driven by a heartbeat at 58 + (99 − vitals) × 0.9 bpm, jittering below 25 vitals, flat on death
- [x] UIX-0030 · M0 · P0 · S · Timer & phase readout — mm:ss timer (red under 20 s, gold during the Litany), operation title and phase pips
- [x] UIX-0031 · M0 · P0 · S · Score readout — running score, "Chain ×N" combo counter and patient name in the top bar
- [x] UIX-0032 · M0 · P0 · S · Tool tray — slot per operation tool with hotkey label, selected highlight, Tincture cooldown overlay, tool name + hint text below
- [x] UIX-0033 · M0 · P0 · S · Litany indicator — star glyph glowing when ready, 8 s duration arc, "Right-drag ★ / Stillness / Spent" caption
- [x] UIX-0034 · M0 · P0 · S · Assistant callouts — callout panel with typewriter reveal (60 chars/s) and per-line hold of max(2.4 s, 55 ms/char)
- [x] UIX-0035 · M0 · P0 · S · Rating popups — COOL/GOOD/BAD/MISS text with combo suffix, scale-in and rise; damage numbers
- [x] UIX-0036 · M0 · P0 · S · Tool cursor — reticle + tool icon beside it, flash on switch, Tincture injection progress arc
- [x] UIX-0037 · M0 · P1 · S · Operation bookends — intro title card ("Let us begin."), "Operation Complete" and "The Patient Is Lost" banners

### Top bar: vitals, ECG, timer, score
- [ ] UIX-0038 · Demo · P0 · M · Top bar v2 layout — woodcut-framed bar with vitals block left, hourglass timer centre, score/combo right; no element overlaps the operating field ellipse (660, 410, 430×250); screenshot review at 1280×720 and 1280×800
- [ ] UIX-0039 · Demo · P0 · S · Vitals damage feedback — a pale "lag" bar trails the real value by 0.5 s after damage; heal shows a green sweep; digits shake ±2 px on hits ≥ 5 (off with Reduced Motion)
- [ ] UIX-0040 · Demo · P1 · S · Beating heart icon — scales on each beat beside vitals (synced to the ECG beat phase) and changes shape per state (steady/strained/failing) so state is readable without colour
- [ ] UIX-0041 · Demo · P1 · M · ECG monitor v2 — sweep-style trace with an erase gap instead of array shifting; waveform variants per state (tachycardia under venom, irregular under curse/Malison, weak below 25) selected by the scene; flatline with ink bleed on loss
- [ ] UIX-0042 · Demo · P1 · S · Critical vitals state (< 30) — top-bar vitals block pulses red, screen edges vignette (existing post-process `danger`) and Ilse's low-vitals bark; state ends with hysteresis at 35
- [ ] UIX-0043 · Demo · P1 · S · Hourglass timer — sand level = timeLeft/timeLimit; sand frozen and gilded while the Litany holds; last 30 s the digits pulse and a tick event fires each second (AUD)
- [ ] UIX-0044 · Demo · P1 · S · Score roll-up — score counts up over 300 ms per gain; combo readout gains flame tiers at 5/10/20 (ember/flame/holy fire) and cracks visibly on combo break
- [ ] UIX-0045 · Demo · P2 · S · Phase progress v2 — pips become small seal icons with tooltip "Phase 2 of 4"; boss phases shown as notches on the Malison bar instead

### Ratings, popups & feedback
- [ ] UIX-0046 · Demo · P0 · M · Rating stamps — replace text popups with woodcut stamps (COOL gold leaf, GOOD green ink, BAD rust, MISS blood splash), each a distinct shape so it reads without colour; label text ("Incision") beneath; 1.1 s lifetime; stamp-in 120 ms
- [ ] UIX-0047 · Demo · P0 · S · Popup de-overlap — popups spawned within 40 px and 0.3 s of another stack upwards by one line; test: 5 simultaneous shard ratings stay legible (no bounding boxes overlap)
- [ ] UIX-0048 · Demo · P1 · S · Combo milestone callouts — at chain 5/10/20 a larger banner ("Steady hands!", "A surgeon's grace!", "Saint Ildra guides you!") appears once per milestone per operation
- [x] UIX-0049 · Demo · P1 · S · Damage-number toggle and vitals-loss aggregation — continuous drain damage is summed and shown at most every 0.5 s per source instead of per frame
- [ ] UIX-0050 · Demo · P1 · S · Hurt direction cue — when vitals drop from an entity, a brief red pulse ring marks that entity so players learn what is draining the patient

### Tool tray & cursor
- [ ] UIX-0051 · Demo · P0 · M · Tray v2 — slot art per tool, selected slot slides out 8 px, binding glyph from current bindings, hover/focus tooltip (name, gesture, binding), Tincture cooldown as radial wipe, Brand heat glow; tray mirrors to the right edge in left-handed mode
- [x] UIX-0052 · M0 · P1 · S · Tool hint tooltip — name + hint panel beside the selected tray slot, fading 2.5 s after each switch (replaced the static text under the tray)
- [x] UIX-0053 · Demo · P1 · S · Tool hint modes — "Tool hints: Always / First uses / Off"; in First-uses mode the tooltip also re-appears after 5 s idle during a tool's first 3 uses; hint text raised from 13 px to ≥ 16 px
- [ ] UIX-0054 · Demo · P0 · M · Target-validity cursor — cursor tints green over a valid target for the current tool; over a target needing another tool it shows that tool's ghost icon ("Needs: Leech-Pipe"); shape changes (ring vs cross) so it is colour-independent
- [ ] UIX-0055 · Demo · P1 · S · Hold-progress rings on the cursor for every hold tool — Leech (pool remaining), Brand (sear progress on grub/sigil/Malison), Lens reveal (0.4 s), Salve coverage %, Tincture injection (existing)
- [x] UIX-0056 · Demo · P1 · S · Cursor visibility — reticle has a dark outline and optional size (1×–2×) and colour (brass/white/cyan/magenta) settings; remains visible over dark blood, black bile and bright hexfire

### Callouts & guidance
- [ ] UIX-0057 · Demo · P0 · S · Callout panel placement — the panel (y 650–708) currently overlaps the bottom of the operating field; move it into a reserved bottom strip or make it click-through and auto-shift away from the active entity; hit-test confirms clicks pass to the field
- [ ] UIX-0058 · Demo · P1 · M · Callout priorities — `op.say(line, { priority })`: urgent lines (low vitals, shard rejoining, Brand on healthy flesh) interrupt the queue; tips queue; duplicate lines within 10 s are dropped (unit tests on the queue)
- [ ] UIX-0059 · Demo · P1 · M · Ilse callout bust — portrait in the callout panel with calm/urgent/relieved/worried expressions keyed by line priority or tag; subtle blink and mouth flap while text types
- [x] UIX-0060 · Demo · P1 · S · Callout log — last 20 callouts of the current operation viewable from the pause menu
- [ ] UIX-0061 · Demo · P1 · S · Phase objective banner — optional `PhaseDef.objective` ("Close the wounds", "Draw off the blood") shown for 2 s at phase start and kept as a small line under the timer
- [ ] UIX-0062 · Demo · P2 · S · Threat markers — entities with a countdown (Malison shard rejoin, hexstone corruption every 7 s, bubo swelling) show a thin radial timer ring; edge arrows point to off-attention threats when the cursor is > 400 px away

### Boss HUD (Malison)
- [ ] UIX-0063 · Demo · P0 · M · Malison intro card — 3 s blackletter title card ("The Malison — Hour of Matins" / "— Hour of Lauds") with woodcut illustration and bell hook; skippable after first view; shown before the boss phase spawns
- [ ] UIX-0064 · Demo · P0 · M · Malison bar — name plate + "unmaking" bar with phase notches under the top bar; veiled/open state icon (the brand can only hurt when open); shard phase shows remaining shard count
- [ ] UIX-0065 · Demo · P1 · S · Veil telegraph — 0.6 s before the shroud parts, the Malison bar icon and the creature outline flash a warning so players can pre-select the Brand
- [ ] UIX-0066 · Demo · P0 · M · Lauds HUD — Malison bar shows the orbiting Choir Voice count and a "shielded" state while any Voice sings, a Hymn telegraph ring expanding 0.8 s before each verse tears the flesh, and a "Submerged — use the Scrying Lens" state when it dives under the skin

### Litany & end-of-operation presentation
- [ ] UIX-0067 · Demo · P0 · S · Litany indicator v2 — star fills per detected vertex while drawing, candle flame when ready, 8 s radial while active, caption from current binding (draw or Litany key); HUD dims 30 % during Stillness so the world reads first
- [ ] UIX-0068 · Demo · P1 · S · Litany end warning — last 1.5 s of Stillness the ripple contracts and the indicator flickers (paired with the AUD reverse swell)
- [ ] UIX-0069 · Demo · P1 · S · Intro card v2 — shows patient name, ailment icon and time allowed for 1.2 s; any press skips; the intro no longer blocks the first click after it ends
- [ ] UIX-0070 · Demo · P1 · S · Win/lose presentation — "Operation Complete" stamps as a wax seal; "The Patient Is Lost" bleeds in as ink; results follow after 2.2 s or on click after 0.8 s
- [x] UIX-0071 · Demo · P2 · S · Minimal HUD option — hides score, combo and phase pips (vitals, timer, tray, Litany always shown)
- [ ] UIX-0072 · Demo · P1 · S · Dev HUD (F3, dev builds only) — fps, frame ms, entity count, vitals drain/s per entity, active tool, input device, latency p95, audio voices

## Epic UIX-C · Front-end, flow, save & options (Demo)

### Boot & first launch
- [x] UIX-0073 · M0 · P1 · S · WebGL2 failure message — shown in-page instead of a blank canvas (`boot()` fallback)
- [ ] UIX-0074 · Demo · P0 · S · Boot sequence — studio logo (2 s, skippable), then photosensitivity notice and content warning (gore, plague, body horror, religious violence) on first launch only, with a link to comfort options
- [ ] UIX-0075 · Demo · P0 · M · First-launch setup — language (English only in demo, list ready), brightness calibration, input device check ("Mouse detected" / "Controller detected"), subtitle size, and "Would you like gentler timings?" assist prompt; every step skippable; runs once per settings file
- [x] UIX-0076 · Demo · P1 · S · Brightness calibration screen — woodcut symbol barely visible at correct gamma; slider adjusts the post-process gamma uniform; also in Display options
- [ ] UIX-0077 · Demo · P1 · S · Loading indicator — spinning wax-seal indicator during font/atlas/audio bank loads over 150 ms; no blank frames between boot and title

### Title screen
- [x] UIX-0078 · M0 · P0 · S · Title — Continue / Take the Oath (new game, with forswear-progress confirm) / Operating Theatre / Sound toggle; fullscreen hint and version string
- [ ] UIX-0079 · Demo · P0 · M · Title v2 — key-art backdrop (Kessendorf woodcut skyline, animated rain and candlelight), "Suture & Steel — The Malison Hours" logo lockup, menu: Continue, New Game, Chapter Select, Operating Theatre, Options, Credits, Quit; "DEMO" ribbon and Wishlist seal in demo builds
- [ ] UIX-0080 · Demo · P0 · S · Stale end-of-content text — replace "Chapter I complete. Chapter II is being written…" with build-appropriate messaging (demo: routes to the demo-complete flow; full: nothing)
- [x] UIX-0081 · M0 · P0 · S · Rename to Suture & Steel — title logo, `index.html` title, WebGL2 failure message and save key `suture-and-steel.save`
- [ ] UIX-0082 · Demo · P1 · S · Continue preview — tooltip/card shows chapter, next step title, total play time and last-played date
- [ ] UIX-0083 · Demo · P1 · S · Quit to desktop — confirm dialog, calls Electron `app.quit()`; hidden in browser builds
- [ ] UIX-0084 · Demo · P1 · S · Build string — "Demo v0.x.y (build hash)" bottom-right replaces "v0.1 prototype", read from Vite `define`
- [ ] UIX-0085 · Demo · P1 · M · Credits — scrolling credits (team, voice cast, music, OFL font attributions for IM Fell English and UnifrakturMaguntia, third-party licences), speed-up on hold, skippable

### Chapter select & operating theatre
- [x] UIX-0086 · M0 · P1 · S · Operating Theatre list — replay any reached operation with best rank/score (`OperationsScene`)
- [ ] UIX-0087 · Demo · P0 · M · Chapter select — chapter cards (illustration, numeral, title, completion %, rank seals per operation); demo shows Chapters I–II playable and III–V as locked parchment "In the full game" cards
- [ ] UIX-0088 · Demo · P1 · M · Chapter step list — replay any reached story scene or operation from a chapter; replays never move `save.progress` backwards (unit test on `advance`)
- [ ] UIX-0089 · Demo · P1 · M · Operating Theatre v2 — scrollable grouped list by chapter, keyboard/gamepad navigation, details panel (best rank, best score, best time, clear date, assisted flag), rank-seal art
- [ ] UIX-0090 · Demo · P2 · S · Rank collection summary — "Seals earned: 7/10 S or better" per chapter on the chapter card

### Save & load
- [x] UIX-0091 · M0 · P0 · S · Progress autosave — localStorage save after each step plus best rank/score per operation (`save.ts`: `advance`, `recordBest`, `store`)
- [ ] UIX-0092 · Demo · P0 · M · Save slots — three slots with cards (chapter, next step, play time, seal count, last played); New Game asks for a slot; overwrite needs confirm
- [ ] UIX-0093 · Demo · P0 · S · Autosave indicator — quill/seal icon in a corner for ≥ 1 s whenever a save is written; tip on first boot "Do not quit while the seal turns"
- [ ] UIX-0094 · Demo · P0 · S · Corrupt save handling — today `load()` silently returns `fresh()` on parse failure; instead show "Your records are damaged" with Restore backup / Start fresh, and keep the bad file aside (test with a truncated JSON fixture)
- [x] UIX-0095 · M0 · P0 · S · Settings file — volume, mute, screen shake, reduce flashing and assists persist under `suture-and-steel.settings`, separate from campaign progress (`src/core/settings.ts`)
- [ ] UIX-0096 · Demo · P1 · S · Dead save field — remove the unused `SaveData.volume` (settings own volume now) through a v1 → v2 save migration with a fixture test
- [ ] UIX-0097 · Demo · P1 · S · Delete slot — double confirm, plays a page-burn animation; cannot delete the slot currently loaded mid-session
- [ ] UIX-0098 · Demo · P1 · S · Demo → full-game carry-over — demo save format is forward compatible; a fixture test imports a demo save into the full-game loader and keeps progress and best ranks

### Pause
- [x] UIX-0099 · M0 · P0 · S · Pause menu "Respite" — Resume, Begin Again, Options, Abandon the Patient; Esc toggles
- [x] UIX-0100 · Demo · P0 · M · Pause v2 — Resume, Restart (confirm), Options, Controls card, Callout log, Abandon (confirm), Quit to Desktop (confirm); operation info panel (patient, ailment, time left, current rank pace)
- [x] UIX-0101 · Demo · P1 · S · Pause presentation — world blurred and dimmed, parchment menu slides in 220 ms; resume optionally with a 3-2-1 countdown (Accessibility setting, default off)
- [ ] UIX-0102 · Demo · P1 · S · Pause button on HUD — clickable/touchable pause glyph in the top bar for mouse-only and Deck touch players

### Options
- [x] UIX-0103 · M0 · P0 · M · Options v0 — `OptionsScene` with ‹ value › rows for Volume, Sound, Screen shake (Off/Gentle/Full), Reduce flashing, Assist: time allowed, Assist: Litany on Space and Fullscreen, reachable from the pause menu
- [x] UIX-0104 · Demo · P0 · M · Options shell — tabs Gameplay / Controls / Display / Audio / Accessibility / Language; live preview; per-tab Defaults; changes persist to `settings.json` on Back; reachable from Title and Pause (display mode and language greyed in-operation)
- [ ] UIX-0105 · Demo · P0 · M · Display tab — window mode, window size, VSync, frame cap (30/60/120/144/unlimited), render scale, UI scale, brightness, bloom intensity, film grain on/off, vignette on/off, screen shake (the v0 Off/Gentle/Full setting extended to 0–100 %)
- [x] UIX-0106 · Demo · P1 · S · Gameplay tab — tool hints mode, damage numbers, confirm on abandon, wheel invert/wrap, Minimal HUD, skip-seen-tutorials
- [x] UIX-0107 · Demo · P1 · S · Option descriptions — every option shows a one-line description and, where relevant, a live preview thumbnail (e.g. colour-blind palette on a sample operating field)
- [ ] UIX-0108 · Demo · P1 · S · Options are validated on load — out-of-range or unknown values fall back to defaults (unit tests per option)

### Patient chart (briefing)
- [x] UIX-0109 · M0 · P0 · S · Briefing parchment — title, patient, findings, time allowed, previous best, instrument icons with hotkeys, Scrub In / Back
- [ ] UIX-0110 · Demo · P0 · M · Chart v2 — patient woodcut portrait, anatomical sketch with ailment markers, instrument row with binding glyphs and "NEW" ribbon for first-time tools, Sister Ilse's handwritten note (tip) and target ranks
- [ ] UIX-0111 · Demo · P1 · M · New-instrument card — when an operation introduces a tool for the first time (Ch1: Lancet/Tongs, Tincture, Brand; Ch2: Scrying Lens), a card shows its illustration, a looping ghost-hand gesture and its binding before Scrub In
- [ ] UIX-0112 · Demo · P2 · S · Chart ink-writing animation — findings text writes in as quill ink (instant with Reduced Motion or on click)

### Results & rank
- [x] UIX-0113 · M0 · P0 · S · Results — rating counts, longest chain, vitals and time bonuses, score, animated rank reveal, "A new best!", Continue / Operate Again / Leave
- [ ] UIX-0114 · Demo · P0 · M · Chirurgical report — parchment report with tally marks per rating, per-action breakdown (incisions, sutures, extractions, burns dressed…), time taken, vitals remaining, Litany used; rank stamped as a wax seal with bell
- [ ] UIX-0115 · Demo · P1 · S · Next-rank hint — "S at 1500 — 120 short" and the most costly rating category ("4 BAD sutures")
- [ ] UIX-0116 · Demo · P0 · S · Failure report — cause of death, targeted tip derived from the run ("Blood pooled for 40 s — drain with the Leech-Pipe"), Try Again / Back to chapter; shown for both vitals and time-out losses
- [ ] UIX-0117 · Demo · P1 · S · Results skip — first press completes the tally animation, second press continues; Enter keeps working (existing)
- [ ] UIX-0118 · Demo · P1 · S · XS rank celebration — gold-leaf seal, choir sting hook, and "Without a single slip" subtitle
- [ ] UIX-0119 · Demo · P2 · S · Assisted badge — runs with any assist enabled show a small "Assisted" ribbon on the report and in the Operating Theatre (ranks still recorded)

## Epic UIX-D · Story / visual-novel UI (Demo)

### Text box & controls
- [x] UIX-0120 · M0 · P0 · S · Story scene — backdrop, procedural portrait, name plate in speaker colour, typewriter at 48 cps, click/Space/Enter advance, Ctrl fast-forward, Esc skips the scene, ▼ continue marker, place caption
- [ ] UIX-0121 · Demo · P0 · M · Backlog — wheel-up or `vn.log` opens a scrollable log of every line shown in the current scene (speaker + text, VO replay icon when VO exists); Esc/B closes; supports gamepad scrolling
- [ ] UIX-0122 · Demo · P0 · S · Story pause menu — Esc no longer skips instantly; it opens Resume / Skip Scene (confirm) / Backlog / Options / Return to Title
- [ ] UIX-0123 · Demo · P1 · S · Auto mode — toggle advances after the line completes plus max(1.2 s, 30 ms/char) or when VO ends; auto icon lit while active; any manual input pauses auto
- [x] UIX-0124 · Demo · P1 · M · Read-text tracking — seen line ids stored per save; Ctrl skip passes only seen lines unless "Skip unread text" is on; skip stops at unseen lines with a flash
- [ ] UIX-0125 · Demo · P1 · S · Text-box control strip — clickable Auto / Skip / Log / Hide / Menu icons at the box's bottom-right, with binding tooltips; replaces the 13 px footer hint
- [ ] UIX-0126 · Demo · P1 · S · Hide UI — `vn.hide` (H / right-click / Y) hides the text box to view art; any input restores
- [ ] UIX-0127 · Demo · P1 · S · Text speed option — 24/48/72 cps/instant, shared by story text and operation callouts
- [x] UIX-0128 · Demo · P1 · S · Text-box readability — optional box opacity 60–100 %, line spacing 1.3, max 3 lines at 125 % text scale without overflow on 1280×800

### Portraits & presentation
- [ ] UIX-0129 · Demo · P0 · M · Layered portraits — base + expression + effects layers per character (Kreuzer, Ilse, Stroh, Haller, Mauer, patients, Choir hood); script tag `say('ilse', text, { face: 'worried' })`; missing expression falls back to neutral with a dev warning
- [ ] UIX-0130 · Demo · P1 · M · Two-slot staging — left/right portrait slots, speaker lit, listener darkened 40 %, enter/exit slide 250 ms, cross-fade on expression change 120 ms
- [ ] UIX-0131 · Demo · P1 · S · First-appearance title — name plate shows the character's `title` ("Inquisitor Stroh — Order of the Pyre") the first time they speak in a save
- [ ] UIX-0132 · Demo · P1 · S · Location card — scene opens with "Kessendorf — Hospice of Saint Ildra — before Matins" lettered card and fade (replaces the plain `place` caption)
- [ ] UIX-0133 · Demo · P1 · M · Script effects — `shake`, `flash` (respects Reduced Flashing), `fade`, `cg` (full-screen illustration) and `sfx`/`music` commands in `StoryDef` lines, executed by `StoryScene`
- [ ] UIX-0134 · Demo · P2 · S · Inline emphasis markup — `*italic*` and `{term}` highlighting for key terms (Malison, Litany, Hollow Choir) in story text and callouts

## Epic UIX-E · Tutorials & first-time user experience (Demo)

### Teaching ladder
- [ ] UIX-0135 · Demo · P0 · M · FTUE ladder audit — table mapping each mechanic to the operation that teaches it (op1-1 stitch/leech/salve, op1-2 incision/tongs/barbs, op1-3 burns/tincture, op1-4 bubo/rot/brand, op1-5 Malison + Litany, Ch2 bites/venom/egg sacs & spiderlings/Scrying Lens/Lauds); every mechanic is taught before it is tested and none is taught twice
- [ ] UIX-0136 · Demo · P0 · M · Tutorial overlay system — scripted steps anchored to an entity or HUD element (arrow + dimmed surround), optional world-time pause until the requested action fires (`op.flags` / rating events); content in data, not scene code
- [ ] UIX-0137 · Demo · P0 · L · Ghost-hand demonstrations — translucent gloved hand + tool replays a recorded stroke over the real target for: trace incision, zig-zag stitch, hold-drain, Tongs pull-out, barb nick then pull, salve brush, hold-inject, sear, lens hover, star; 10 demos, looping until the player acts
- [ ] UIX-0138 · Demo · P1 · S · Device-aware demos — ghost demos and prompts switch to stick/trigger glyphs when a gamepad is the last-used device
- [ ] UIX-0139 · Demo · P1 · M · Adaptive re-teaching — two consecutive BAD/MISS on the same mechanic, or 8 s idle with a required entity untouched, replays that ghost demo once; setting "Adaptive hints" on by default
- [ ] UIX-0140 · Demo · P0 · M · Litany practice — before the op1-5 boss, a practice beat asks the player to draw the star (up to 3 tries with failure reasons, then offers the Litany key assist); success unlocks the Litany for the fight
- [x] UIX-0141 · Demo · P1 · S · Controls reference card — per-tool gesture illustrations with current bindings, reachable from briefing and pause
- [ ] UIX-0142 · Demo · P1 · S · Tutorial skipping — "Skip tutorials" setting and per-prompt "Don't show again"; skipped tutorials remain viewable from the controls card

### FTUE validation
- [ ] UIX-0143 · Demo · P0 · M · Fresh-player playtest — 8 players new to Trauma Center: record time-to-first-success and attempts per mechanic through Ch1; any mechanic where > 25 % need > 3 attempts gets a tutorial or tuning fix before Next Fest
- [ ] UIX-0144 · Demo · P1 · S · First-operation friction target — median new player completes op1-1 in ≤ 4 min with ≤ 1 retry; tracked in the playtest sheet
- [ ] UIX-0145 · Demo · P1 · S · Tooltips on first appearance — the first time each ailment appears (bubo, rot, venom, grub, egg sac, spiderling, sigil, hexstone, Malison, Choir Voice) a short Ilse callout plus codex-style card explains it (2 lines max)

## Epic UIX-F · Accessibility, comfort & assists (Demo)

### Vision
- [x] UIX-0146 · Demo · P0 · M · Colour-blind palettes — deuteranopia, protanopia, tritanopia palette swaps driven by semantic tokens for ratings, vitals states, ichor types (blood/pus/black bile), curse purple and Litany gold; verified with simulator screenshots of every Ch1–2 operation
- [ ] UIX-0147 · Demo · P0 · S · Shape redundancy — every colour-coded state also differs by shape/icon/pattern (rating stamps, vitals heart states, pool hatching per ichor, validity cursor ring vs cross); checklist signed off in greyscale screenshots
- [x] UIX-0148 · Demo · P0 · M · Text scaling — 100/125/150/175 % for story text, callouts, subtitles and tooltips; VN box and callout panel grow to 3 lines; no overflow at 175 % on 1280×800
- [x] UIX-0149 · Demo · P1 · S · High-contrast mode — solid dark plates behind all HUD text, 2 px outlines on interactable entities and incision guides, stronger reticle outline
- [x] UIX-0150 · Demo · P1 · S · Readable font option — swap body text from IM Fell English to Atkinson Hyperlegible (OFL, bundled) everywhere except titles/logo
- [ ] UIX-0151 · Demo · P2 · S · Screen-reader menus (Electron) — focused menu item text mirrored to an ARIA live region so NVDA/Narrator read menus; tested with NVDA on Windows

### Motion, flashing & gore
- [x] UIX-0152 · Demo · P0 · S · Reduced motion — disables screen shake (`op.shake`), popup scale/rise, UI parallax, candle flicker, pulsing glows; Litany ripple becomes a static sepia tint; one toggle, previewed live
- [x] UIX-0153 · M0 · P1 · S · Reduce flashing v0 — scales the failing-vitals red pulse and the Litany ripple to 35 % (`settings.reduceFlashing`)
- [ ] UIX-0154 · Demo · P0 · M · Reduced flashing — caps bloom spikes, Malison hurt flash, low-vitals red pulse and lightning to ≤ 3 luminance flashes/s and ≤ 20 % area; Harding-style analysis on captured Ch1–2 boss footage passes with the setting on and off
- [x] UIX-0155 · Demo · P0 · M · Gore level — Full / Reduced / Minimal: Reduced darkens blood to brown and removes spurts; Minimal renders blood and open wounds as ink-black stylised shapes; applies to `BloodPool`, `Laceration`, `Incision` draw and the flesh shader; gameplay readability unchanged (playtest)
- [x] UIX-0156 · Demo · P1 · S · Creature filter — replaces grub, egg-sac and spiderling art (op2-3 "Brood-Mother's Kiss") with abstract blotches and mutes their skitter/chitter SFX, for insect and spider phobia
- [ ] UIX-0157 · Demo · P1 · S · Content warnings — per-chapter warnings listed in Options → Accessibility and on the chapter card (demo: Ch1–2)

### Assists
- [x] UIX-0158 · M0 · P1 · S · Time-allowed assist — ×1 / ×1.5 / ×2 time limit applied when the operation is created (`OperationScene.create`); assisted runs detected via `assisted()`
- [ ] UIX-0159 · Demo · P0 · M · Assist menu — Time allowed (existing ×1/×1.5/×2), Vitals drain (100/75/50 %), Target size (1.0/1.25/1.5×), Toggle-hold, Assisted stitching, Auto-Litany, Tutorial hints; applied through an `Assists` object read by `Operation` (unit tests per assist)
- [ ] UIX-0160 · Demo · P1 · S · Auto-Litany — when enabled, the Litany triggers automatically the first time vitals fall below 25 or the Malison bar reaches its last notch; still once per operation (unit test)
- [ ] UIX-0161 · Demo · P1 · S · Assist transparency — assists never block achievements or progress; the report shows which assists were active; Operating Theatre filter "Unassisted bests only"
- [ ] UIX-0162 · Demo · P1 · S · Skip after failures — after 3 losses on the same operation, "Let Sister Ilse steady your hand" offers enabling assists or continuing the story with the operation marked "Passed with aid"
- [ ] UIX-0163 · Demo · P1 · S · Accessibility presets — "Vision", "Motor", "Hearing", "Comfort" one-click presets on first launch and in Options, each listing what it changes
- [ ] UIX-0164 · Demo · P1 · M · Accessibility audit — demo checked against Game Accessibility Guidelines (basic + key intermediate items) and Xbox Accessibility Guidelines 101–107, 112, 114, 117; gaps logged with owners; results table in `docs/qa/accessibility.md`

## Epic UIX-G · Demo-complete flow & wishlist (Demo)

### Demo build gating
- [ ] UIX-0165 · Demo · P0 · S · Demo build flag — `__DEMO__` (Vite `define`) gates demo-only UI (DEMO ribbon, wishlist seals, locked Ch3–5 cards, demo-complete scene); CI builds and smoke-tests both flavours
- [ ] UIX-0166 · Demo · P0 · S · Demo campaign end — `playStep` past the last Chapter II step routes to `DemoCompleteScene` in demo builds (today it falls back to `TitleScene`); unit test with a two-chapter campaign stub

### Demo-complete scene
- [ ] UIX-0167 · Demo · P0 · M · "Here the demo ends" sequence — illuminated card, teaser of the next Malison hour (Prime) as a silhouette with "The Hours are not yet done…", music sting, then the summary; skippable after first view
- [ ] UIX-0168 · Demo · P0 · M · Demo summary — grid of rank seals for all 10 operations, total play time, XS count, longest chain, Litany uses; "Replay operations for better seals" button to the Operating Theatre
- [ ] UIX-0169 · Demo · P0 · M · Wishlist call-to-action — wax-seal "Wishlist on Steam" button opens the full game's store page via steamworks.js overlay (`overlay.activateToStore(appId)`), falling back to `steam://store/<appid>` via `shell.openExternal` when the overlay is disabled; tested with overlay on and off and on Deck
- [ ] UIX-0170 · Demo · P1 · S · Feedback link — "Tell us what you think" opens the survey URL with build id and play time as query parameters
- [ ] UIX-0171 · Demo · P2 · S · Community row — Discord and newsletter links (small woodcut icons) under the wishlist button; hidden in kiosk builds
- [ ] UIX-0172 · Demo · P1 · S · Save-carry message — "Your progress and seals will carry over to the full game" shown only once carry-over is verified by the fixture test

### After the demo
- [ ] UIX-0173 · Demo · P0 · S · Post-demo title state — after completion the title shows a "Demo complete" banner and Wishlist seal, Continue becomes Chapter Select, and the demo-complete scene is replayable from Extras
- [ ] UIX-0174 · Demo · P1 · S · Title wishlist seal — always visible on the demo title (not a pop-up nag); click-through tracked in the local stats file
- [ ] UIX-0175 · Demo · P2 · M · Event kiosk mode — `--kiosk` flag: returns to title after 90 s idle, disables Quit and save slots, resets progress each session, shows controls card on title (for Next Fest streams and conventions)
- [ ] UIX-0176 · Demo · P0 · M · Demo-complete E2E test — Playwright drives the demo build via debug `skipTo` hooks through the Lauds operation to `DemoCompleteScene`, asserts the summary values and that the wishlist handler is invoked (mocked steamworks)

## Epic AUD-A · Audio engine, mixer & pipeline (Demo)

### Engine & bus graph
- [x] AUD-0001 · M0 · P0 · M · Procedural WebAudio cues — 16 `Cue`s (ratings, cut, stitch, squelch, pluck, burn, inject, heartbeat, flatline, litany, bell, select, alarm) synthesised from oscillators and filtered noise into a master gain
- [x] AUD-0002 · M0 · P0 · S · Audio unlock & mute — AudioContext unlocked on first pointer/key gesture; mute toggle on the title screen
- [x] AUD-0003 · M0 · P1 · S · Simulation emits sounds as data (`op.cues`), drained and de-duplicated per frame by `OperationScene` — keeps the sim DOM-free
- [x] AUD-0004 · Demo · P0 · M · Bus graph — master → music, sfx (world, hud), ui, vo, ambience buses as GainNodes with persisted 0–100 volumes; topology unit-tested against a fake AudioContext
- [x] AUD-0005 · M0 · P0 · S · Persisted master volume & mute — `Audio.volume`/`muted` setters update the master gain live; values loaded from settings on boot
- [x] AUD-0006 · Demo · P0 · S · Master safety limiter — DynamicsCompressorNode on master (threshold −6 dB, ratio 20, attack 3 ms, release 100 ms); an offline render of the op1-5 boss replay shows no sample above −0.5 dBFS
- [x] AUD-0007 · Demo · P0 · M · Data-driven events — replace the `Cue` string union with event ids (`sfx.lancet.cut`, `sfx.rate.cool`, `vo.ilse.lowVitals`…) defined in `src/audio/events.ts`; the sim keeps pushing ids into `op.cues`; unit test that every id the sim can emit has a mapping
- [x] AUD-0008 · Demo · P0 · S · Procedural fallback — events without recorded assets fall back to the existing synth so dev builds never go silent; boot logs a list of unmapped/placeholder events in dev
- [x] AUD-0009 · Demo · P1 · S · Pre-built noise buffers — `noise()` allocates and fills a new AudioBuffer with `Math.random()` per call; precompute white-noise buffers at unlock and reuse (no per-cue buffer allocations in a heap snapshot)
- [x] AUD-0010 · Demo · P0 · M · Voice manager — `play(id, { pan, vol, pitch, priority })` with per-event voice limits (e.g. stitch 4, squelch 3, rating 2), stealing lowest-priority/oldest voice, global cap 48 voices; unit tests on stealing order
- [x] AUD-0011 · Demo · P0 · S · Variation & randomisation — events define 3–6 variations with no-immediate-repeat selection and per-event pitch (± cents) and gain (± dB) ranges
- [x] AUD-0012 · Demo · P0 · M · Loop API — `startLoop(id)` / `setParam(handle, name, v)` / `stopLoop(handle, fadeMs)` for held-tool loops (leech suction, brand sizzle, salve smear, tincture plunger, lens hum, Litany drone); loops stop within 50 ms of release and never leak (test: 1 000 hold/release cycles leave 0 active loops)
- [x] AUD-0013 · Demo · P1 · S · Stereo placement — StereoPannerNode pan from entity screen X across the operating field (−0.6…0.6); disabled by the Mono setting
- [x] AUD-0014 · Demo · P1 · S · Scheduled heartbeat — heartbeat events scheduled on `ctx.currentTime` with 100 ms look-ahead from the ECG beat phase, so beats land within ±5 ms of the QRS spike instead of rAF jitter
- [x] AUD-0015 · Demo · P1 · S · Convolution reverb — two impulse responses (stone operating theatre, chapel) as send effects per bus; scene selects the space; wet level per snapshot

### Mixing: ducking & snapshots
- [x] AUD-0016 · Demo · P0 · M · Ducking — VO/callout barks duck music −8 dB and ambience −6 dB (attack 80 ms, release 400 ms); rating stings duck music −3 dB for 250 ms; ducking amounts in a data table
- [x] AUD-0017 · Demo · P0 · M · Snapshots — `default`, `pause` (music LPF 800 Hz −6 dB, world SFX muted, ambience −12 dB), `litany`, `lowVitals`, `vn`, `results`, `menu`; 300 ms cross-fades; stack with priorities; unit-tested transitions
- [x] AUD-0018 · Demo · P0 · M · Litany snapshot — world SFX playbackRate ×0.6 and LPF 1.2 kHz, reverb send +6 dB, heartbeat slowed to match the 0.15 time scale, UI/VO untouched; enters in 400 ms, exits in 600 ms synced to `litanyTime`
- [x] AUD-0019 · Demo · P1 · S · Low-vitals snapshot — below 30 vitals a gradual high-shelf cut (−6 dB above 4 kHz) and a faint tinnitus layer; lifted with 35 hysteresis; off with "Reduce audio stress"
- [x] AUD-0020 · Demo · P1 · S · Pause behaviour — pausing freezes world loops (suspended, not stopped) and resumes them in place; VO pauses mid-line and resumes

### Asset pipeline & runtime
- [x] AUD-0021 · Demo · P0 · M · Asset pipeline — source WAVs (48 kHz/24-bit) in `assets-src/audio`, build script encodes Ogg Opus (SFX 96 kbps, music 160 kbps, VO 64 kbps mono), generates a manifest with duration, integrated LUFS and true peak; CI fails on missing or oversized files
- [x] AUD-0022 · Demo · P0 · M · Bank loading — events grouped in banks (boot/ui, title, story, operation-common, per-operation, boss) preloaded on scene entry with progress; decoded memory ≤ 150 MB for the demo; unused banks released
- [x] AUD-0023 · Demo · P1 · S · Music streaming decision — long music stems either streamed via `MediaElementAudioSourceNode` or decoded buffers with loop points; decide by memory/gapless test and document in the PR
- [ ] AUD-0024 · Demo · P1 · S · Device resilience — handle output device change (`devicechange`), headphones unplug, sample-rate changes and `AudioContext` `interrupted` state on macOS without silence or crash (manual matrix)
- [ ] AUD-0025 · Demo · P1 · S · Output latency — create the context with `latencyHint: 'interactive'`; debug overlay shows `baseLatency` + `outputLatency`; target < 40 ms on Windows WASAPI in Electron
- [x] AUD-0026 · Demo · P1 · S · Mute when unfocused — option (default on) fades master to −∞ in 200 ms on window blur and back on focus
- [x] AUD-0027 · Demo · P1 · M · Audio debug overlay (F4) — active voices by bus, bus RMS/peak meters, current snapshot stack, loaded banks and memory, last 20 events fired
- [x] AUD-0028 · Demo · P2 · M · Offline audio tests — Vitest renders event sequences through `OfflineAudioContext` (node-web-audio-api) to assert no clipping, correct ducking depth and loop stop timing

## Epic AUD-B · Designed SFX for Chapters 1–2 (Demo)

### Sourcing & direction
- [ ] AUD-0029 · Demo · P0 · S · SFX direction brief — period-authentic palette (steel, horn, wood, glass, wax, wet leather, embers, church bronze; no modern beeps), grim but not gratuitous gore level, reference clips; approved before recording
- [ ] AUD-0030 · Demo · P0 · M · Foley session — record flesh (cabbage, wet chamois, raw meat, gelatine), antique steel instruments, glass vials/jars, wax seals, parchment, quill, thread through leather, embers/cautery iron in water; 48 kHz/24-bit, slate log, ≥ 5 takes per action
- [ ] AUD-0031 · Demo · P1 · S · Library licensing — licences for bell, choir and ambience libraries recorded in `docs/licences/audio.md` with per-file provenance in the manifest
- [x] AUD-0032 · Demo · P0 · M · SFX event list — spreadsheet of every Ch1–2 event (id, trigger in code, variations, loop?, bus, priority, caption text, status) generated from `events.ts` and reviewed weekly
- [x] AUD-0033 · Demo · P0 · S · Procedural → designed migration — each of the 16 current `Cue`s mapped to designed events (e.g. `cut` splits into lancet cut, barb nick, Malison rend; `pluck` into tongs grab, burn debride, grub pluck); after migration the synth only runs as fallback (dev report shows 0 fallback plays in a full Ch1–2 replay)

### Instruments (per tool)
- [x] AUD-0034 · Demo · P0 · M · Lancet set — skin-touch on press, cutting loop with gain/pitch from stroke speed, incision-complete wet open, off-the-line slip, empty-press air slash (MISS), barb nick; ≥ 4 variations each
- [x] AUD-0035 · Demo · P0 · M · Tongs set — jaw open/close clicks, grab (wet flesh vs hard object), pulling-strain loop scaled by distance from origin, extraction pop per object (wooden arrow shaft, crossbow bolt, lead shot, tooth, glass shard, hexstone chime), drop into metal dish
- [x] AUD-0036 · Demo · P0 · S · Leech-Pipe set — suction loop with gurgle intensity from pool radius, separate textures for blood, pus and black bile, pool-cleared slurp
- [x] AUD-0037 · Demo · P0 · M · Gut Thread set — needle pierce per stitch with pitch rising along the wound (+1 semitone per stitch, capped), thread pull zip, final knot tie on closure
- [x] AUD-0038 · Demo · P0 · S · Saint's Salve set — jar lid, wet smear loop gated by coverage progress, sealing shimmer when a nick or rot patch is sealed
- [x] AUD-0039 · Demo · P0 · S · Tincture set — vial clink on select, plunger loop during the 0.7 s hold, injection-complete swell + heal chime, cooldown-ready tick after 6 s
- [x] AUD-0040 · Demo · P0 · M · Cautery Brand set — idle ember hum, sizzle loop on contact with variants for flesh (warning hiss), grub, curse-sigil and Malison flesh, quench/steam on release
- [x] AUD-0041 · Demo · P0 · S · Scrying Lens set — glass hum loop while selected, proximity shimmer rising near hidden objects, "Found!" reveal chime
- [x] AUD-0042 · Demo · P1 · S · Tool pick-up sounds — distinct select sound per tool (steel, tong spring, glass, jar, iron) replacing the shared `select` square blip; unavailable-tool dull clack

### Ailments & patient (Ch1–2)
- [x] AUD-0043 · Demo · P0 · S · Bleeding — laceration trickle loop scaled by severity, blood-pool growth drips, pooled blood blocking stitching ("flooded") wet slap
- [x] AUD-0044 · Demo · P0 · S · Embedded objects — hexstone corruption pulse (whisper + low chime every 7 s cycle), barbed tear rip with pained patient vocal
- [x] AUD-0045 · Demo · P0 · S · Burns — eschar flake crack on debride, fire-burn crackle bed, acid fizz, hexfire whispering crackle; "Burn dressed" cool-down hiss
- [x] AUD-0046 · Demo · P0 · S · Plague — bubo swelling creak, lance pop + pus burst, pus drain, rot creeping squelch loop, "Rot purged" cleanse
- [x] AUD-0047 · Demo · P0 · S · Venom — spreading hiss/tingle loop scaled by `spreadR`, antidote neutralise effervescence
- [x] AUD-0048 · Demo · P0 · S · Grubs — wriggle chitter loop per grub (voice-limited to 3), burrow, seared squeal, plucked squeak, dropped-in-dish tick
- [x] AUD-0049 · Demo · P0 · S · Curse-sigil — chanting whisper loop while active, crack stages during searing, "Curse broken" glass-bell shatter
- [x] AUD-0050 · Demo · P0 · S · Egg sacs & spiderlings — sac pulse loop quickening as the hatch timer runs down, lance squelch, hatch burst, spiderling skitter loop (voice-limited to 4), seared squeal (op2-3 "Brood-Mother's Kiss")
- [x] AUD-0051 · Demo · P1 · M · Patient vocal set — moans, sharp pain on BAD/MISS hurt ≥ 3, relieved breath on win, death rattle; 4 voice types (man, woman, elder, dwarf); toggle "Patient vocalisations"

### The Malison (Ch1–2 bosses)
- [x] AUD-0052 · Demo · P0 · M · Malison of Matins set — veiled drone, shroud-parting choir swell, flesh-rending tear, brand-hit shriek, hexling shedding, splitting apart, shard rejoin warning (2 s rising whisper) and rejoin thud, "Malison unmade" collapse with bell
- [x] AUD-0053 · Demo · P0 · M · Malison of Lauds set — per-Voice choir loop panned with its orbit, Voice-silenced cut-off, "calling its Voices back" swell, Hymn verse build + tearing blast, submerge gurgle and lens-found surfacing sting, hexstone shatter burst, death; every telegraph audible ≥ 0.5 s before it lands
- [x] AUD-0054 · Demo · P0 · S · Hymn cue collision — `lauds.ts` pushes the player's `litany` cue for the Hymn; give the Hymn its own event so it is never mistaken for the player's Litany (unit test: the Hymn emits no `litany` cue)
- [x] AUD-0055 · Demo · P1 · S · Hour bells — boss intro card plays the canonical hour bell pattern (Matins: 3 slow strokes in darkness; Lauds: dawn peal) through the chapel reverb

### Scoring, vitals & timer
- [x] AUD-0056 · Demo · P0 · S · Rating stings — COOL (bright bell + parchment stamp), GOOD (soft chime), BAD (dull wooden thud), MISS (discordant lute + splash); ≤ 400 ms, voice limit 2, never mask the action sound
- [x] AUD-0057 · Demo · P1 · S · Combo tiers — chain 5/10/20 add an ascending choir note layer to COOL/GOOD; combo break plays a snapped-string cue
- [x] AUD-0058 · Demo · P0 · S · Vitals alarms — crossing below 60 and 30 plays a period hand-bell warning (replaces the square-wave `alarm`); below 15 a rapid bell; rate-limited to once per 5 s
- [x] AUD-0059 · Demo · P0 · S · Flatline/death — replace the 980 Hz beep with a death knell + sustained low drone and heartbeat stop
- [x] AUD-0060 · Demo · P1 · S · Timer — clock-escapement tick each second in the last 10 s (quieter 11–30 s option), "time is up" bell; ticking suspended during the Litany
- [x] AUD-0061 · Demo · P1 · S · Phase clear — short resolving motif (on the music bar grid when possible) when a phase's required entities are gone

### Litany of Stillness
- [x] AUD-0062 · Demo · P0 · S · Star drawing — shimmering trail loop while the right button draws, pitch step per detected vertex (5 steps of a pentatonic scale); failed sign fizzle; "Litany spent" dull denial
- [x] AUD-0063 · Demo · P0 · S · Invocation — whispered Kreuzer prayer ("Be still…") + choral swell replacing the four sine tones; end warning reverse swell 1.5 s before Stillness ends; release exhale when time resumes

### UI, story & results
- [x] AUD-0064 · Demo · P0 · S · UI set — hover (soft quill), confirm (wax seal stamp), back (page turn), tab (page flip), slider tick, toggle (latch), error (dull lute), pause open/close (cloth rustle), save (quill scratch)
- [x] AUD-0065 · Demo · P1 · S · VN set — line advance tick, optional per-character text blips (off by default), scene transition page turn, backdrop change whoosh, portrait enter rustle
- [x] AUD-0066 · Demo · P1 · S · Results set — tally tick per row, score roll loop, rank seal stamps per rank (XS choir sting, S bell, A chime, B/C muted thud), new-best flourish
- [x] AUD-0067 · Demo · P1 · S · Briefing/chart set — parchment unroll, quill writing loop during ink animation, "Scrub In" basin splash + instrument tray rattle

## Epic AUD-C · Adaptive music (Demo)

### Direction & production
- [ ] AUD-0068 · Demo · P0 · S · Music direction brief — early-modern instrumentation (viol consort, hurdy-gurdy, sackbut, shawm, crumhorn, frame drum, positive organ, plainchant voices, church bells), modal harmony (Phrygian/Dorian), Hollow Choir leitmotif, reference tracks; approved by the owner
- [ ] AUD-0069 · Demo · P0 · M · Composer contract & schedule — ≈ 30 min of stemmed music for the demo (list below), stems delivered at 48 kHz/24-bit with tempo, key and loop-point metadata; rights cover demo, full game, trailers and soundtrack release
- [x] AUD-0070 · Demo · P0 · S · Music cue sheet — every demo cue with state, length, stems, loop points and owner, kept alongside the SFX event list

### Adaptive system
- [x] AUD-0071 · Demo · P0 · M · Music state machine — states title, story-calm, story-tense, briefing, op-intro, operation, boss, victory, failure, results, demo-end; transitions quantised to the next bar (tempo metadata) or immediate with a 2 s cross-fade when urgent; unit-tested transition table
- [x] AUD-0072 · Demo · P0 · M · Vertical layering — operation tracks ship 4 synchronised stems (bed, pulse, tension, danger) started sample-accurately together; layer gains follow game state: tension fades in below 60 vitals, danger below 30, a percussion "clock" layer in the last 30 s, a "flow" ornament layer at chain ≥ 10; 1.5 s gain ramps
- [x] AUD-0073 · Demo · P0 · S · Gapless loops — stems loop at their metadata loop points with no audible gap or phase drift after 20 minutes (automated check that stem playheads stay within 1 ms)
- [x] AUD-0074 · Demo · P0 · M · Litany music treatment — on invoke, cross-fade (400 ms) to a "Stillness" stem (sustained, same key/tempo grid), duck other stems −12 dB with LPF, reverb up; 1.5 s before the end a reverse swell; stems resume in sync at the exact musical position they would have reached
- [x] AUD-0075 · Demo · P1 · S · Stingers — scrub-in, phase clear, boss reveal, victory, failure and rank-reveal stingers in key with the playing track, scheduled on beat when a track is running
- [x] AUD-0076 · Demo · P1 · S · Outcome endings — on failure the operation music is cut by a bowed-string scrape into silence (no modern tape-stop effect); on victory the stems resolve to the tonic through the victory stinger on the next beat

### Demo tracks
- [x] AUD-0077 · Demo · P0 · M · Title theme "The Malison Hours" — 2–3 min loop (hurdy-gurdy + choir) with a 20 s intro for first boot
- [x] AUD-0078 · Demo · P0 · M · Hospice / story themes — calm hospice (Ilse), tense (Stroh / witch-hunter), sorrow (patient loss); 3 loops of 90–150 s
- [x] AUD-0079 · Demo · P0 · M · Operation theme A (Ch1 standard operations) — 4 stems, 120 BPM grid, 2 min loop
- [x] AUD-0080 · Demo · P0 · M · Operation theme B (Ch2 standard operations, harsher arrangement) — 4 stems, 2 min loop
- [x] AUD-0081 · Demo · P0 · L · Malison of Matins boss theme — nocturnal plainchant + tolling bells; sections for veiled, shroud-open and shard phases driven by the Malison's phase; intro and death outro
- [x] AUD-0082 · Demo · P0 · L · Malison of Lauds boss theme — perverted dawn hymn; sections per Lauds phase; shares the Hollow Choir leitmotif with Matins
- [x] AUD-0083 · Demo · P1 · S · Briefing & results loops — quiet 60–90 s chart loop; results loop in warm (win) and grave (loss) variants
- [x] AUD-0084 · Demo · P1 · S · Demo-end cue — Prime teaser motif leading into the wishlist screen, loops quietly on the summary
- [x] AUD-0085 · Demo · P1 · S · Chapter card fanfares — short illuminated-card flourishes for Chapter I and Chapter II openings

## Epic AUD-D · Ambience, heartbeat & sonification (Demo)

### Ambiences
- [x] AUD-0086 · Demo · P0 · M · Backdrop ambiences — seamless 60–120 s loops for each `Backdrop` (hospice, street, theatre, chapel, night, camp): rain on shutters, distant coughs, cart wheels, gulls/crows, candle crackle; cross-fade 1 s on scene change
- [x] AUD-0087 · Demo · P1 · S · Random emitters — one-shot layers (distant church bell, dog bark, drunk singing, watchman's call) with min/max intervals and random pan per backdrop; never two within 4 s
- [x] AUD-0088 · Demo · P0 · S · Operating theatre bed — stone-room tone, dripping basin, fire in the brazier, flies; ducks −6 dB as tension layers rise
- [x] AUD-0089 · Demo · P1 · S · Curse corruption bed — whispering choir layer whose gain follows the scene's `corrupt` value (sigils 0.25, Malison 0.7) with 1.5 s smoothing

### Heartbeat & ECG sonification
- [x] AUD-0090 · M0 · P1 · S · Low-vitals heartbeat — thump per beat when vitals < 45, rate from the ECG bpm formula
- [x] AUD-0091 · Demo · P0 · M · Heartbeat v2 — recorded heartbeat pairs (lub-dub) with bpm from vitals, timbre degrading below 25 (muffled, irregular skipped beats), strength rising as vitals fall; setting "Heartbeat: Always / Low vitals only / Off"
- [x] AUD-0092 · Demo · P1 · S · Pulse chime decision — replace the anachronistic monitor idea with a period-flavoured pulse (a small glass/brass tick per beat, audible only when enabled or vitals < 30); decision recorded, implemented behind the heartbeat setting
- [x] AUD-0093 · Demo · P1 · S · Heal and hurt sonification — vitals gains play a rising breath/chime scaled by amount; losses ≥ 5 play a body-impact thud scaled by amount (rate-limited)
- [x] AUD-0094 · Demo · P2 · S · Drain sonification — the entity currently draining the most vitals gets a subtle louder loop (e.g. the heaviest bleed), helping players triage by ear

## Epic AUD-E · Voice (Demo)

### Plan & pipeline
- [ ] AUD-0095 · Demo · P0 · S · VO scope decision — demo ships fully voiced Sister Ilse operation barks (gameplay-critical) + grunt-style emotive snippets for VN lines (all speaking characters); full VN VO decided at Alpha by budget; decision recorded with cost estimate
- [ ] AUD-0096 · Demo · P0 · M · Line IDs — every speakable string gets a stable id: story lines (`s1-2.014`), phase callouts (`op1-2.p0.1`), `sayOnce` tips in `entities.ts`/`malison.ts`/`operation.ts` (`bark.flooded`, `bark.barbs`, `bark.lowVitals`…); `op.say` accepts ids; a test fails if any inline literal remains in `say()`/`sayOnce()` calls
- [x] AUD-0097 · Demo · P0 · S · Script export — `npm run vo:export` writes a CSV (id, character, line, context, emotion, max duration, variant count) from content and barks; re-export diff highlights changed lines needing pickups
- [x] AUD-0098 · Demo · P0 · S · VO runtime — `vo.play(id)` on the vo bus with ducking; text-only fallback when audio is missing; a new urgent bark interrupts a playing tip with a 60 ms fade; callout panel timing follows VO length when present
- [x] AUD-0099 · Demo · P1 · S · Bark variants & cooldowns — repeated barks (low vitals, praise, flooded, brand on flesh) have 3 variants and per-bark cooldowns (≥ 20 s) so they never repeat back-to-back

### Casting & recording
- [ ] AUD-0100 · Demo · P0 · M · Casting briefs & auditions — Sister Ilse (warm, steady alto, calm under pressure), Dr. Kreuzer (weary baritone; efforts and Litany whisper), Inquisitor Stroh (cold, precise bass-baritone), Master Haller (gravelly elder), Captain Mauer (gruff soldier), Hollow Choir (whispered ensemble); 3 auditions per role; human performers only, no synthetic voices
- [ ] AUD-0101 · Demo · P0 · S · Performer contracts — usage covers demo, full game, trailers and store pages; credit names; pickup rates; union/non-union status recorded
- [ ] AUD-0102 · Demo · P0 · M · Ilse bark session — ≈ 150 lines (phase callouts for 10 ops, tips, vitals warnings at 60/30/15, praise at chain 5/10/20, loss sympathy, Litany reaction, Matins/Lauds reactions) with 3 takes; 48 kHz/24-bit; edited, de-noised, named by line id
- [ ] AUD-0103 · Demo · P1 · M · Grunt-style VN set — per speaking character 3–6 short vocalisations per emotion (neutral, surprised, angry, sad, amused, pained) triggered at line start by an `emotion` tag; random non-repeating selection
- [ ] AUD-0104 · Demo · P1 · S · Kreuzer efforts — strained breaths on long pulls, whispered "Be still" on Litany, relieved exhale on success, shaken breath on loss
- [ ] AUD-0105 · Demo · P0 · M · Malison voices — layered choir + creature voice for Matins and Lauds with processing chain (granular smear, reversed whispers, pitch −5 st) documented so later hours stay consistent
- [ ] AUD-0106 · Demo · P1 · S · VO mastering — per-line loudness −24 LUFS integrated (±1), true peak ≤ −3 dBTP, consistent room tone; batch script verifies all delivered files

## Epic AUD-F · Loudness, audio options & visual sound cues (Demo)

### Loudness & mix
- [x] AUD-0107 · Demo · P0 · S · Loudness spec — gameplay integrated −18 LUFS ±2 over a 10-minute capture, true peak ≤ −1 dBTP; music stems −20 LUFS; SFX peaks ≤ −3 dBFS; VO sits ≈ 6 LU above the music bed; documented in `docs/audio/loudness.md`
- [x] AUD-0108 · Demo · P0 · S · Loudness CI — script runs ffmpeg `ebur128` over every audio asset and fails the build when a file is outside its category tolerance
- [ ] AUD-0109 · Demo · P0 · M · Mix passes — full Ch1–2 mix review on studio monitors, laptop speakers, Steam Deck speakers and headphones; issues logged and closed; final capture measured against the loudness spec
- [x] AUD-0110 · Demo · P1 · S · Dynamic range setting — Full / Reduced / Night: Reduced adds bus compression (3:1), Night (6:1) with raised VO; default Reduced on Steam Deck

### Audio options
- [x] AUD-0111 · Demo · P0 · S · Volume sliders — Master, Music, Sound Effects, Voice, Ambience, Interface (0–100, step 5) with a test sound on release; replaces the title "Sound: On/Off" toggle
- [x] AUD-0112 · Demo · P1 · S · Mono & balance — mono downmix toggle and left/right balance slider applied on the master bus
- [x] AUD-0113 · Demo · P1 · S · Comfort audio toggles — patient vocalisations on/off, heartbeat mode, "Reduce audio stress" (removes tinnitus/low-vitals filtering and caps alarm repetition)
- [x] AUD-0114 · Demo · P2 · S · Output device selection — Electron `setSinkId` device picker in Audio options (hidden when unsupported)

### Visual cues for sound
- [x] AUD-0115 · Demo · P0 · M · Sound captions — events carry an optional caption ("[Bell tolls for Matins]", "[The shard whispers — it will rejoin]", "[Heartbeat quickens]", "[Grub chitters beneath the skin]"); shown in the subtitle area with source-side arrow when off-centre; toggle "Sound captions"
- [x] AUD-0116 · Demo · P0 · S · Subtitles for all VO — speaker name in character colour, size S/M/L/XL, background opacity 0–100 %, max 2 lines, timed to VO; on by default
- [ ] AUD-0117 · Demo · P0 · S · Audio-visual parity audit — table of every gameplay-relevant sound (telegraphs, alarms, heartbeat state, timer ticks, shard rejoin warning, Litany end warning) and its visual counterpart; missing visuals filed as UIX tasks; deaf/hard-of-hearing tester completes Ch1–2 with sound off
- [x] AUD-0118 · Demo · P1 · S · Visual heartbeat — when heartbeat audio is Off or the SFX bus is muted, a faint edge vignette pulses on each beat below 45 vitals, carrying the warning the audible thump gives today

## Epic INP-C · Full-game input: disciplines, Chapters 3–5, advanced devices (Alpha–Beta)

### New gestures for Chapters 3–5 and disciplines
- [ ] INP-0102 · Alpha · P1 · M · Stroke capture service — `OperationScene` records the full primary-button stroke polyline per press and dispatches `Entity.onStroke(op, stroke, tool)` on release (new optional hook), enabling shape gestures without entities reading input
- [ ] INP-0103 · Alpha · P1 · M · `isEncircle(stroke, centre, radius)` in `gesture.ts` — returns quality 0..1: closed within 35 % of loop size, winding number ≥ 1 around the centre, loop encloses ≥ 85 % of the target disc, loop area ≤ 3× target; tests accept circle, ellipse, double loop; reject C-shape, figure-8 off-target, spiral into centre
- [ ] INP-0104 · Alpha · P1 · S · Encircle rating — quality ≥ 0.85 COOL, ≥ 0.6 GOOD, else BAD; the Lancet hint "Encircle growths to excise them" in `TOOL_INFO` is honoured by the first growth/tumour entity in Chapters 3–5 (integration test)
- [ ] INP-0105 · Alpha · P2 · S · Encircle guide — with the Lancet selected, excisable growths show a faint dotted ring at the ideal cut radius; the live stroke is drawn as a fine red line
- [ ] INP-0106 · Alpha · P1 · M · Rotate gesture — `rotationAround(stroke, pivot)` accumulates signed angle of a drag around a pivot (±5° accuracy, tests at 90°/180°/−270°) for bone-setting twists; wheel steps of 15° as keyboard/mouse alternative
- [ ] INP-0107 · Alpha · P1 · M · Two-point actions without a second hand — "pin" action (default `F`/gamepad X) locks the current Tongs grip in place so the player can switch tool and work elsewhere (e.g. hold a fang while cauterising); pinned grip auto-releases after 10 s; unit tests
- [ ] INP-0108 · Alpha · P1 · S · Tap-to-tag input for field triage — single press on a casualty cycles triage tags; long-press (0.5 s) opens the tag radial; gamepad face buttons map directly to tags
- [ ] INP-0109 · Alpha · P1 · S · Palpation/scan hold for diagnosis — hold-and-sweep gesture reporting coverage of a body region (reuses `Coverage`), with hit-scale assist support
- [ ] INP-0110 · Alpha · P2 · S · Magnifier input for forensic/inquisition scenes — hover pan + wheel zoom 1–4× with smooth zoom around the cursor; gamepad triggers zoom
- [ ] INP-0111 · Alpha · P1 · M · Timing-window input for rhythmic Malison gimmicks (Ch3–5 hours) — windows ±60 ms (COOL) / ±120 ms (GOOD) measured from event timestamps, compensated by an audio-latency offset from a calibration screen (Options → Audio → Calibrate)
- [ ] INP-0112 · Alpha · P1 · S · Petrification chip gesture — rapid repeated short Lancet strokes on stone crust register as chips (min 3 per second) with an assist that accepts holding instead
- [ ] INP-0113 · Alpha · P2 · S · Challenge-mode instant retry — hold `R` (gamepad Back) for 1 s to restart; ring fills on the reticle; not active in story mode
- [ ] INP-0114 · Beta · P1 · M · Gesture tuning pass for Chapters 3–5 — corpus recordings and first-try success ≥ 80 % (mouse) and ≥ 70 % (gamepad) for every new mechanic, tuning committed to `tuning.ts`

### Advanced devices
- [ ] INP-0115 · Beta · P1 · M · Steam Input native integration — when running under Steam, read actions through steamworks.js Steam Input instead of the Gamepad API (action origins give exact glyphs); Gamepad API remains the fallback outside Steam
- [ ] INP-0116 · Beta · P2 · M · Gyro cursor — gyro-as-mouse for Deck, DualSense and Switch Pro via Steam Input, enabled while touching the right trackpad or holding R1 (ratchet); sensitivity setting; off by default
- [ ] INP-0117 · Beta · P2 · M · Pen tablet support — `pointerType === 'pen'`: hover moves the cursor, tip = primary, barrel button = Litany draw; Windows Ink press-and-hold right-click suppressed; tested on Wacom and XP-Pen
- [ ] INP-0118 · Beta · P2 · M · Touch play — full touch layout for touchscreen laptops and Deck handheld: on-screen tool strip, two-finger drag draws the Litany star, tap-and-hold as hold tools; toggled automatically on first touch input
- [ ] INP-0119 · Beta · P2 · S · macOS input — Ctrl-click and two-finger click map to secondary, Force Touch ignored, Cmd+Q confirm; tested on a MacBook trackpad and Magic Mouse
- [ ] INP-0120 · Beta · P2 · S · Key-name localisation — bindings screen shows localised key names for FR/DE/ES/IT/PL/RU keyboards
- [ ] INP-0121 · Beta · P2 · S · Opt-in gesture telemetry — anonymous per-mechanic success/attempt counts (no raw strokes) sent only with consent, to guide post-demo tuning

## Epic UIX-H · Full-game UI: codex, dossier, challenge mode, disciplines (Alpha–Beta)

### Codex of ailments
- [ ] UIX-0177 · Alpha · P1 · M · Codex framework — data-driven entries (id, name, woodcut illustration, period-voiced lore, treatment steps, tools, first seen), unlocked on first encounter and saved per slot; accessible from title, chapter select and pause
- [ ] UIX-0178 · Alpha · P1 · S · Codex unlock toast — "New entry in the Codex: Hexstone Shard" wax-seal toast after the operation (never mid-operation)
- [ ] UIX-0179 · Beta · P1 · L · Codex content — ≈ 35 entries covering every ailment in Chapters 1–5 (blade wounds, arrows/bolts/shot, fire/acid/hexfire/dragon-breath burns, buboes, rot, gangrene, venoms, curse-sigils, hexstone, petrification, lodged fangs, claw rakes, larvae) with final illustrations
- [ ] UIX-0180 · Beta · P2 · S · Codex links — `{term}` markup in story text and callouts shows a tooltip and opens the codex entry from pause/backlog
- [ ] UIX-0181 · Beta · P2 · S · Codex completion tracker — per-chapter completion and an overall percentage on the codex index

### Malison dossier
- [ ] UIX-0182 · Alpha · P1 · M · Dossier screen — one page per canonical hour (Matins, Lauds, Prime, Terce, Sext, None, Vespers, Compline): silhouette until defeated, then illustration, phases diagram, weaknesses, best time/rank, Hollow Choir marginalia
- [ ] UIX-0183 · Beta · P1 · M · Dossier content — final art and text for all eight hours; ordering matches the canonical hours; hidden entries remain spoiler-free
- [ ] UIX-0184 · Alpha · P1 · M · Boss HUD variants — intro cards, name plates and bar notch layouts for Prime, Terce, Sext, None, Vespers and Compline; each hour's gimmick has a dedicated readable HUD widget reviewed against its design doc
- [ ] UIX-0185 · Beta · P2 · S · Boss HUD distortion effects — per-hour HUD interference (e.g. timer digits corrupting, tray icons veiled) implemented as optional shader/animation effects that never hide critical information and are disabled by Reduced Motion

### Challenge mode
- [ ] UIX-0186 · Alpha · P1 · M · Challenge list — challenge cards (patient, modifiers such as "No Litany", "Half time", "Blood never stops", target medals), locked/unlocked states, best results
- [ ] UIX-0187 · Alpha · P1 · S · Modifier display — active modifiers shown as seals on the briefing chart and in a HUD corner during play
- [ ] UIX-0188 · Beta · P2 · M · Leaderboard UI — Steam leaderboard per challenge: global/friends/around-me tabs, rank, score, time, "Assisted" filter; offline state message
- [ ] UIX-0189 · Beta · P2 · S · Medal results — bronze/silver/gold/"Saint's" medals on the challenge report with next-medal target

### Disciplines & Chapters 3–5 screens
- [ ] UIX-0190 · Alpha · P1 · M · Field-triage HUD — casualty cards with triage tags, time-to-deterioration rings, battlefield overview map
- [ ] UIX-0191 · Alpha · P1 · M · Diagnosis UI — patient interview panel (question list, answers into a symptom checklist), examination findings sheet, diagnosis selection with confirm seal
- [ ] UIX-0192 · Alpha · P2 · M · Forensic/inquisition evidence board — pinned clues, connect-the-string interaction, verdict parchment; keyboard/gamepad navigable
- [ ] UIX-0193 · Alpha · P2 · M · Bone-setting HUD — joint alignment gauge, rotation guide arc, splint placement ghost
- [ ] UIX-0194 · Alpha · P1 · S · Chapter select for five chapters — Ch III–V cards unlocked progressively; demo "locked" cards removed in full builds
- [ ] UIX-0195 · Beta · P1 · M · Final UI art pass for Ch3–5 — chapter cards, title cards and discipline HUDs match the style guide; signed off by the art director

### Extras & meta
- [ ] UIX-0196 · Beta · P2 · M · Extras menu — art gallery (unlocked CGs and portraits), music room (unlocked tracks with loop toggle), statistics (operations played, total stitches, Litanies cast, XS count)
- [ ] UIX-0197 · Beta · P2 · S · In-game achievement list — mirrors Steam achievements with locked/unlocked state and hidden descriptions for story achievements
- [ ] UIX-0198 · Release · P1 · M · Epilogue and ending credits — final credits sequence with full cast, post-credits scene hook, unlocks New Game+ entry on title

## Epic AUD-G · Full-game audio: Chapters 3–5, hours & voice (Alpha–Beta)

### Music
- [x] AUD-0119 · Alpha · P1 · M · Placeholder boss themes — temp-stemmed tracks for Prime, Terce, Sext, None, Vespers and Compline wired into the state machine so every boss is playable with adaptive music at Alpha
- [ ] AUD-0120 · Beta · P1 · L · Malison of Prime and Terce themes — final stemmed boss tracks, one liturgical character each (Prime: morning office in plainsong; Terce: bright brass turned sour), with phase sections and outros
- [ ] AUD-0121 · Beta · P1 · L · Malison of Sext and None themes — final stemmed boss tracks (Sext: midday heat, droning shawms; None: the hour of death, funereal organ)
- [ ] AUD-0122 · Beta · P1 · L · Malison of Vespers and Compline themes — final stemmed boss tracks (Vespers: evening Magnificat inverted; Compline: final night office, full Hollow Choir), Compline as the finale with extended phases
- [x] AUD-0123 · Beta · P1 · M · Chapter 3–5 operation themes — two additional 4-stem operation tracks plus variations for later chapters' higher stakes
- [x] AUD-0124 · Beta · P2 · M · Discipline music — field triage (distant pike-and-shot battle drums), diagnosis (sparse viol), forensic/inquisition (tense low strings), bone-setting (rhythmic, percussive)
- [x] AUD-0125 · Beta · P2 · S · Challenge-mode remixes — faster variants of two operation themes for challenge mode
- [x] AUD-0126 · Release · P1 · M · Credits song / finale piece — full choir arrangement of the Hollow Choir leitmotif resolved, used in ending credits

### SFX
- [ ] AUD-0127 · Alpha · P1 · M · Placeholder SFX for all Ch3–5 events — every new event id has at least a library placeholder so Alpha is fully audible; fallback-synth report shows 0 unmapped events
- [x] AUD-0128 · Beta · P1 · M · Dragon-breath burn and gangrene sets — roaring ember bed, blistering pops, necrotic wet crackle, amputation-grade saw if required by design
- [x] AUD-0129 · Beta · P2 · S · Growth excision set — encircle cut loop, severed release and Tongs removal of the excised mass, for the Chapters 3–5 growth mechanic
- [x] AUD-0130 · Beta · P1 · M · Petrification set — stone creep, chip strikes with pitch by crust depth, crumble release, flesh-under-stone reveal
- [x] AUD-0131 · Beta · P1 · M · Monster wound sets — lodged-fang extraction (enamel grind), claw-rake laceration variants, larvae swarm loop with per-larva voices
- [x] AUD-0132 · Beta · P1 · L · Malison hour SFX sets — Prime, Terce, Sext, None, Vespers, Compline each with ≈ 12 events (intro, telegraphs, attacks, hits, phase changes, death) following the Matins processing chain
- [x] AUD-0133 · Beta · P2 · M · Discipline SFX — triage tag stamps, battlefield ambience one-shots, stethoscope-analogue (ear trumpet) listening, bone crepitus and snap-into-place
- [x] AUD-0134 · Beta · P1 · M · Ch3–5 ambiences — witch-hunter pyre square, cathedral, catacombs, army camp at night, flooded lower city; 60–120 s loops with emitters

### Voice
- [ ] AUD-0135 · Alpha · P1 · S · Full-game VO decision — full VN VO vs extended grunt-style for Chapters 3–5, based on demo wishlist conversion and budget; decision recorded with line count and cost
- [ ] AUD-0136 · Beta · P1 · L · Chapter 3–5 VO recording — Ilse barks for all new operations and disciplines, VN VO or grunt sets for all characters, new patients; pickups for any Ch1–2 lines changed since the demo
- [ ] AUD-0137 · Beta · P1 · M · Remaining Malison voices — Hollow Choir and Malison voices for Prime through Compline using the documented processing chain
- [ ] AUD-0138 · Beta · P2 · M · Portrait lip-flap — mouth frames driven by VO amplitude envelope (precomputed at build time) for voiced characters

## Epic UIX-I · Localisation-ready UI & audio (Beta)

### Strings, fonts, captions & subtitles
- [ ] UIX-0199 · Beta · P0 · M · String extraction — every hard-coded UI string in `src/scenes/*.ts` and `src/ui/*.ts` ("Respite", "Begin Again", "Scrub In", "The Patient Lives"…) and `TOOL_INFO` names/hints moves to `strings/en.json` with ids; a lint rule rejects new string literals passed to `g.text` outside the string table
- [ ] UIX-0200 · Beta · P0 · S · Pseudo-localisation build — `?lang=pseudo` expands strings +40 % with accented characters; every screen reviewed for overflow/clipping with the dev overflow log empty
- [ ] UIX-0201 · Beta · P1 · M · CJK text support — dynamic glyph atlas pages for Simplified Chinese and Japanese (Noto Serif CJK subset per language), line breaking by character, blackletter titles fall back to a matching CJK display face
- [ ] UIX-0202 · Beta · P1 · S · Blackletter fallback — languages with glyphs outside UnifrakturMaguntia (Polish, Russian) use a Cyrillic/Latin-Extended display face for titles, chosen in the style guide
- [ ] UIX-0203 · Beta · P1 · S · Language switch at runtime — Options → Language reloads strings, fonts and captions without restarting; persisted in settings
- [ ] UIX-0204 · Beta · P1 · S · Localised text in art — title cards, wax seals and rank stamps with words are rendered from text over art, not baked into textures
- [x] AUD-0139 · Beta · P1 · S · Localised subtitles and captions — subtitle/caption tables per language keyed by VO line id and event id; timing re-validated for languages ≥ 30 % longer (split into two subtitle cards)
- [x] AUD-0140 · Beta · P2 · S · VO language independence — VO stays English with localised subtitles; the audio pipeline supports a per-language VO folder so localised VO can be added post-launch without code changes

## Epic REL · Release readiness (Release)

### Input
- [ ] INP-0122 · Release · P0 · M · Steam Deck Verified submission — full-game pass of Valve's Deck compatibility checklist (input, glyphs, text size ≥ 9 px physical at 1280×800, default config, no launcher); issues fixed before review
- [ ] INP-0123 · Release · P1 · S · Steam Remote Play check — mouse, gamepad and Litany drawing work over Remote Play (host PC → Deck/phone); latency overlay numbers recorded
- [ ] INP-0124 · Release · P1 · S · Final input regression — the recorded input corpus replays green on the release candidate across all operations, and the star benchmark still meets 95 %/1 %
- [ ] INP-0125 · Release · P1 · S · Default bindings freeze — defaults locked two weeks before launch; any later change requires a bindings version bump with migration test

### UI
- [ ] UIX-0205 · Release · P0 · M · Screenshot regression suite — Playwright captures every scene and modal at 1280×720, 1280×800 and 2560×1440 in English and one CJK language; diffs reviewed on each RC
- [ ] UIX-0206 · Release · P1 · S · UI performance budget — HUD + menus ≤ 1.0 ms CPU and ≤ 150 draw-batch flushes per frame on Steam Deck; measured in the heaviest boss fight
- [ ] UIX-0207 · Release · P0 · S · Store-compliance text review — no placeholder text ("prototype", "being written", lorem), all legal/credit/licence screens complete, age-rating content descriptors matched by in-game warnings
- [ ] UIX-0208 · Release · P1 · M · Final accessibility audit — full game re-checked against the demo accessibility table; any regressions fixed; accessibility feature list published on the store page
- [ ] UIX-0209 · Release · P1 · S · Demo → full upgrade flow — launching the full game with a demo save present offers "Continue from the demo" and skips replaying Chapters 1–2 if chosen

### Audio
- [ ] AUD-0141 · Release · P0 · M · Final mix — full-campaign mix pass on the four reference playback systems; loudness spec met for every chapter capture; sign-off note in `docs/audio/loudness.md`
- [ ] AUD-0142 · Release · P1 · S · Audio performance budget — audio thread ≤ 3 % CPU on Steam Deck and zero underruns during a 30-minute soak with the busiest boss replay looping
- [x] AUD-0143 · Release · P1 · S · Fallback purge — release build contains no procedural fallback plays in a full campaign replay (report checked in CI) and the dev-only synth is tree-shaken out
- [x] AUD-0144 · Release · P1 · S · Asset licence audit — every audio file in the manifest has provenance and licence recorded; unlicensed or temp files block the build

## Epic POST · Post-launch (Post)

### Input
- [ ] INP-0126 · Post · P2 · M · Switch/scanning access — single-switch mode: tools and targets cycled by timed highlighting, one input performs the selected action with assisted gestures; tested with an accessibility consultant
- [ ] INP-0127 · Post · P3 · M · DualSense adaptive triggers — trigger resistance while pulling with the Tongs and a pulse on each stitch via Steam Input / native HID bridge
- [ ] INP-0128 · Post · P3 · S · Pen pressure option — optional pressure-scaled incision depth feedback (visual only, no scoring change) for pen users
- [ ] INP-0129 · Post · P2 · S · Community-requested bindings — review the top 5 input requests from Steam forums/Discord after launch and ship fixes in the first two patches

### UI
- [ ] UIX-0210 · Post · P2 · M · New Game+ UI — NG+ badge on save slots, remixed-operation markers in chapter select, NG+ rank seals
- [ ] UIX-0211 · Post · P2 · M · DLC/free-update chapter integration — chapter select and codex support additional chapters and discipline packs discovered from content manifests without code changes
- [ ] UIX-0212 · Post · P3 · M · Photo mode — pause-time photo mode for story CGs and operation aftermath with frames, filters (woodcut, sepia) and hidden HUD; excluded when gore level is Minimal
- [ ] UIX-0213 · Post · P2 · S · Seasonal challenge UI — rotating weekly challenge card on the title with countdown and leaderboard link
- [ ] UIX-0214 · Post · P2 · S · Player-feedback accessibility patch — review accessibility feedback 30 days after launch; ship the top-requested options (tracked list in `docs/qa/accessibility.md`)

### Audio
- [ ] AUD-0145 · Post · P2 · M · Soundtrack release — mastered album (Title, operation themes, eight Malison hours, credits piece) as Steam soundtrack DLC with liner-note PDF of woodcut art
- [ ] AUD-0146 · Post · P3 · L · Localised VO (German) — if sales in DACH exceed the plan threshold, record German VO for Ilse barks and the Choir using the per-language VO folder
- [ ] AUD-0147 · Post · P2 · S · Audio bug triage — fix audio issues reported in the first month (missing sounds, level complaints) with before/after loudness captures attached to each fix
