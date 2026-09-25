# 02 — Input, UI/UX & Audio

Workstream prefixes: **INP** (input & controls), **UIX** (UI/UX, HUD, menus, accessibility), **AUD** (audio).
Scope follows `_brief.md`: `Demo` = everything the Chapters 1–2 Steam demo needs at release quality
(≈10 operations, Malison of Matins and of Lauds); `Alpha`/`Beta`/`Release` = Chapters 3–5 and the full game;
`Post` = after launch. `[x]` = already in the codebase (commit `5f65723`).

Code anchors used below: `src/core/input.ts` (`Input`), `src/core/audio.ts` (`Audio`, `Cue`),
`src/surgery/operation.ts` (`Operation.handlePointer`, `rate`, `say`, `cues`), `src/surgery/gesture.ts` (`isStar`),
`src/surgery/types.ts` (`TOOL_INFO`, `Pointer`), `src/scenes/*.ts` (Title, Story, Briefing, Operation, Results,
Operations, `flow.ts`), `src/ui/widgets.ts` / `layout.ts` (`panel`, `button`, `toolIcon`, `reticle`, `PALETTE`, 1280×720 view).

---

## Epic INP-A · Input architecture & mouse/keyboard gestures (Demo)

### Device plumbing & action layer
- [x] INP-@@@@ · M0 · P0 · M · Mouse/keyboard/wheel sampling — `Input` latches pressed/released/rightPressed/wheel per frame and maps pointer to the 1280×720 virtual view
- [x] INP-@@@@ · M0 · P1 · S · Pointer robustness basics — pointer capture on press, canvas context menu suppressed, window blur clears held keys/buttons, OS cursor hidden (`cursor: none; touch-action: none`)
- [x] INP-@@@@ · M0 · P1 · S · Fullscreen toggle — F11 and Alt+Enter toggle document fullscreen (`main.ts`)
- [ ] INP-@@@@ · Demo · P0 · M · Action map — add `src/core/actions.ts` mapping physical inputs to named actions (`tool.select.1..8`, `tool.next`, `tool.prev`, `tool.quickSwap`, `tool.radial`, `litany.draw`, `litany.chord`, `pause`, `ui.confirm`, `ui.back`, `vn.advance`, `vn.fast`, `vn.auto`, `vn.log`, `vn.hide`); scenes read actions only — grep finds no `keyPressed('Key…')`/`'Digit…'` literals outside `actions.ts`
- [ ] INP-@@@@ · Demo · P0 · M · Device adapters — split `Input` into mouse, keyboard and gamepad adapters that fill one `InputFrame` snapshot per tick; `Operation.handlePointer(ptr, dt)` still receives the existing `Pointer` shape and all current tests pass unchanged
- [ ] INP-@@@@ · Demo · P0 · S · `pointercancel` / `lostpointercapture` are treated as a release — alt-tabbing mid-drag with the Tongs snaps the object back instead of leaving `down` stuck (manual + unit test on adapter)
- [ ] INP-@@@@ · Demo · P0 · S · Focus-loss auto-pause — `blur`, `visibilitychange` and Steam overlay activation open the pause menu during an operation; `timeLeft` does not advance while unfocused (test: hidden 10 s, timer unchanged)
- [ ] INP-@@@@ · Demo · P1 · S · Wheel normalisation — replace `Math.sign(e.deltaY)` per event with delta accumulation (threshold 50 px or 1 line, 120 ms cooldown) so one mouse notch or one trackpad flick = one tool step (test: 30 trackpad events of 4 px → at most 2 steps)
- [ ] INP-@@@@ · Demo · P1 · S · Layout-aware key labels — bindings stay on `KeyboardEvent.code`, but on-screen labels come from `navigator.keyboard.getLayoutMap()` so AZERTY/QWERTZ players see their real key caps (fallback to US labels when the API is missing)
- [ ] INP-@@@@ · Demo · P1 · S · Shipped-build key hygiene — in Electron release builds Ctrl+R, F5, Ctrl+W, Ctrl+Shift+I and Alt-menu focus are disabled; Alt+F4 / Cmd+Q quit via a confirm dialog when mid-operation
- [ ] INP-@@@@ · Demo · P1 · S · Mouse button coverage — middle button and side buttons (X1/X2) are captured (`pointerdown` `button` 1/3/4) and exposed as bindable inputs; browser back/forward navigation on X1/X2 is suppressed
- [ ] INP-@@@@ · Demo · P2 · S · Cursor confinement option — "Confine cursor to window" uses Pointer Lock with a virtual cursor so drags crossing the window edge in windowed mode never release (off by default; on by default in fullscreen on multi-monitor setups)

### Pointer fidelity, buffering & latency
- [ ] INP-@@@@ · Demo · P0 · M · Timestamped event queue — record every pointer/key event with `event.timeStamp` in order; the frame consumes them in sequence so a press+release inside one frame both register and hold durations (Tincture 0.7 s, lens reveal 0.4 s) are measured from event time, not frame time (unit tests for press+release same frame)
- [ ] INP-@@@@ · Demo · P0 · M · Sub-frame stroke samples — collect `getCoalescedEvents()` points into `InputFrame.samples[]`; `StitchLine.sweep` and `Incision.onDrag` iterate every sub-segment (test: three crossings of a wound inside one 33 ms frame produce three stitches)
- [ ] INP-@@@@ · Demo · P1 · S · Frame-rate independence test — replay the same recorded stitch, incision and extraction strokes at 30/60/144/240 Hz through the headless harness; ratings, stitch counts and vitals match exactly
- [ ] INP-@@@@ · Demo · P1 · M · Input record/replay — `?record=1` serialises `InputFrame` streams to JSON with op id + seed; `?replay=<file>` re-drives the operation deterministically; used for regression tests and attached to bug reports
- [ ] INP-@@@@ · Demo · P1 · S · Teleport guard — pointer jumps > 200 px in one sample (focus regained, cursor warped, pen proximity re-entry) break the stroke instead of producing a giant segment, preventing accidental stitch crossings and incision jumps (unit test)
- [ ] INP-@@@@ · Demo · P1 · S · Inter-phase grace — during the 0.8 s `phaseDelay` between phases and the 1.2 s intro, empty Lancet presses are ignored (no MISS, no 3-vital hurt) (unit test on `Operation.emptyPress`)
- [ ] INP-@@@@ · Demo · P1 · S · Tool-key-before-click ordering — a tool hotkey pressed up to 100 ms before a click in the same or previous frame applies before the press is dispatched (test: `Digit2` then click on a shard grabs it with the Tongs)
- [ ] INP-@@@@ · Demo · P1 · M · Latency overlay — dev overlay (F3) shows input-event→next-rAF and input-event→present latency p50/p95 over the last 300 events plus current frame time; target p95 ≤ 50 ms at 60 Hz in the Electron build
- [ ] INP-@@@@ · Demo · P1 · M · Click-to-photon measurement — measure with a 240 fps camera on 3 reference PCs (low/mid/high) and a Steam Deck, windowed and fullscreen, VSync on/off; record results in `docs/qa/latency.md`; release gate ≤ 70 ms on mid PC, ≤ 90 ms on Deck
- [ ] INP-@@@@ · Demo · P2 · S · Low-latency canvas experiment — compare `desynchronized: true` WebGL context and Electron `--disable-frame-rate-limit`/VSync-off settings against baseline with the latency overlay; adopt only if p95 improves ≥ 8 ms without tearing complaints
- [ ] INP-@@@@ · Demo · P2 · S · High-polling mice — with an 8 kHz mouse the pointermove handler stays O(1) and coalesced samples are capped at 64 per frame; CPU for input handling < 0.3 ms/frame on the low-spec PC

### Gesture translation — trace (Lancet incisions)
- [x] INP-@@@@ · M0 · P0 · M · Incision tracing — press at the head or last progress point (22 px / 30 px windows), follow the dashed guide; mean deviation < 6 px COOL, < 13 px GOOD, else BAD; > 34 px slip = BAD + 2 vitals (`Incision`)
- [ ] INP-@@@@ · Demo · P1 · S · Trace tuning table — move incision constants (start radius 22, resume window 30, slip 34, COOL/GOOD 6/13) into `src/surgery/tuning.ts` with comments; entities read from it; no magic numbers left in `Incision`
- [ ] INP-@@@@ · Demo · P1 · M · Trace playtest calibration — log per-incision mean deviation from 10 mouse + 4 trackpad + 3 gamepad testers on op1-2 and Ch2 ops; set thresholds so ≥ 80 % of first attempts rate GOOD or better on mouse and ≥ 65 % on trackpad; record histogram in the tuning PR
- [ ] INP-@@@@ · Demo · P1 · S · Backwards/late-start feedback — pressing on the guide but > 30 px from the progress point pulses the start node and shows the one-time hint "Begin at the glowing mark" instead of silently ignoring the press
- [ ] INP-@@@@ · Demo · P2 · S · Trace smoothing — optional 1€ filter (tunable min-cutoff/beta) applied to pointer samples during Lancet traces only; default off for mouse, on for gamepad virtual cursor and touch (unit test: noisy line deviation reduced ≥ 40 %)
- [ ] INP-@@@@ · Demo · P1 · S · Deviation thresholds honour the Target Size assist multiplier (1.0/1.25/1.5×) for start radius, slip distance and rating bands (unit test at 1.5×)

### Gesture translation — hold & brush (Leech-Pipe, Salve, Tincture, Brand, Lens)
- [x] INP-@@@@ · M0 · P0 · S · Hold tools — Leech drains pools under the held cursor, Tincture hold 0.7 s injects (6 s cooldown), Brand sears while held, Lens reveals hidden entities on hover, Salve brushes `Coverage` cells
- [ ] INP-@@@@ · Demo · P1 · M · Toggle-hold option — "Hold actions: Hold / Toggle"; in Toggle mode one click starts a hold-tool action and a second click (or moving off-body) stops it; synthesised `Pointer.down` drives Leech, Salve, Tincture and Brand (unit test: Brand toggle sears a grub without the button held)
- [ ] INP-@@@@ · Demo · P2 · S · Hold key — bindable key (default `Space` during operations) acts as the primary button at the cursor for hold tools, so players can rest the mouse button finger
- [ ] INP-@@@@ · Demo · P1 · S · Salve brush radius (24 px) and Leech capture radius (pool r + 10) read from the tuning table and scale with the Target Size assist (unit tests at 1.0× and 1.5×)
- [ ] INP-@@@@ · Demo · P1 · S · Brand healthy-flesh grace — the Brand does not hurt healthy flesh for the first 120 ms of a hold, so brief contact while moving between grubs isn't penalised (unit test: 100 ms on flesh = 0 damage)

### Gesture translation — zig-zag stitching (Gut Thread)
- [x] INP-@@@@ · M0 · P0 · S · Zig-zag stitching — each crossing of the wound line is a stitch, crossings within 10 px of an existing mark are rejected, one-stroke closure rates COOL (`StitchLine`)
- [ ] INP-@@@@ · Demo · P0 · S · Fast-swipe robustness — with sub-frame samples, a 500 px/s zig-zag at 30 fps registers ≥ 95 % of geometric crossings; crossings within 4 px of a wound endpoint still count (unit test with synthetic stroke)
- [ ] INP-@@@@ · Demo · P1 · S · Stitch spacing scales with wound length — min spacing = clamp(total/needed × 0.4, 8, 16) px instead of fixed 10 px, so short nicks can't be failed by an over-strict rule (unit tests: 36 px and 120 px lacerations)
- [ ] INP-@@@@ · Demo · P1 · M · Assisted stitching option — hold primary and run the cursor along the wound; a crossing is auto-generated every wound-length/needed px while within 20 px of the line; ratings capped at GOOD; default on for gamepad if the calibration task shows < 80 % op1-1 completion
- [ ] INP-@@@@ · Demo · P2 · S · Stitch direction freedom — stitching may start at either end or the middle and travel either way; verify with tests for reverse-direction strokes

### Gesture translation — encircle & excise
- [ ] INP-@@@@ · Demo · P1 · M · Stroke capture service — `OperationScene` records the full primary-button stroke polyline per press and dispatches `Entity.onStroke(op, stroke, tool)` on release (new optional hook), enabling shape gestures without entities reading input
- [ ] INP-@@@@ · Demo · P1 · M · `isEncircle(stroke, centre, radius)` in `gesture.ts` — returns quality 0..1: closed within 35 % of loop size, winding number ≥ 1 around the centre, loop encloses ≥ 85 % of the target disc, loop area ≤ 3× target; tests accept circle, ellipse, double loop; reject C-shape, figure-8 off-target, spiral into centre
- [ ] INP-@@@@ · Demo · P1 · S · Encircle rating — quality ≥ 0.85 COOL, ≥ 0.6 GOOD, else BAD; the Lancet hint "Encircle growths to excise them" in `TOOL_INFO` becomes true for the Ch2 growth entity (integration test)
- [ ] INP-@@@@ · Demo · P2 · S · Encircle guide — with the Lancet selected, excisable growths show a faint dotted ring at the ideal cut radius; the live stroke is drawn as a fine red line

### Gesture translation — grab & pull-out (Tongs)
- [x] INP-@@@@ · M0 · P0 · S · Tongs extraction — grab within 20 px of the handle, drag > 70 px from origin to extract; barbed arrows need two Lancet nicks or they tear (1.6× laceration, BAD) (`Embedded`)
- [ ] INP-@@@@ · Demo · P1 · S · Grab snapping — Tongs snap to the nearest graspable within the grab radius (20 px × Target Size assist) and the hovered graspable gets an outline, so near-misses on thin arrow shafts don't fall through to flesh
- [ ] INP-@@@@ · Demo · P1 · S · Pull-axis tolerance — while grabbed, a faint axis line shows the shaft direction; pulling within ±35° of the axis keeps COOL/GOOD timing rules, larger deviations cap the rating at GOOD (unit tests at 20° and 60°)
- [ ] INP-@@@@ · Demo · P2 · S · Drag-lock option — "Grab: Hold / Click-to-toggle": click once to seize, move, click again to release; Tongs extraction thresholds unchanged (unit test for toggle extraction)
- [ ] INP-@@@@ · Demo · P1 · S · Mid-grab interruptions — switching tool, drawing the Litany star, pausing or losing focus while an object is grabbed returns it to its origin without rating; covered by unit tests for each path

### Tool switching
- [x] INP-@@@@ · M0 · P0 · S · Tool selection — hotkeys 1–8 (`TOOL_INFO.code`), mouse wheel and Q/E cycle, clicking a tray slot; switching releases any capture (`Operation.setTool`)
- [ ] INP-@@@@ · Demo · P0 · S · HUD hit-test layer — replace the `trayClick` flag and `x > TRAY.x+TRAY.w+10` filter with a UI hit-test pass where HUD widgets (tray, Litany icon, callout panel, pause button) consume presses first; test: clicking the gap between tray slots with the Lancet never rates MISS
- [ ] INP-@@@@ · Demo · P1 · S · Unavailable-tool feedback — pressing the hotkey of a tool not in `def.tools` shakes the tray and shows "Not in the kit for this operation" once per op; no `select` cue spam
- [ ] INP-@@@@ · Demo · P1 · S · Quick-swap — bindable action (default `Tab`/mouse X1) toggles between the current and previous tool; test: 1 → 4 → Tab returns to Lancet, Tab again returns to Gut Thread
- [ ] INP-@@@@ · Demo · P1 · M · Radial tool menu — hold middle mouse (or gamepad RB) opens a radial of the operation's tools centred on the cursor; flick direction + release selects; world time is not paused; selection latency ≤ 1 frame after release; cancels if released within 12 px of centre
- [ ] INP-@@@@ · Demo · P2 · S · Wheel options — "Invert wheel" and "Wheel wraps around the tray" settings; default wrap on (current behaviour)
- [ ] INP-@@@@ · Demo · P2 · M · Auto-tool assist — optional "Suggest tool on press": pressing on a target with the wrong tool switches to the tool implied by that target (pool → Leech-Pipe, open laceration → Gut Thread, grub → Brand) before dispatching; off by default; unit test for each Ch1–2 entity type

### Litany of Stillness input
- [x] INP-@@@@ · M0 · P0 · M · Star recogniser `isStar` — resample to 80 points, closed within 35 % of size, 4–8 self-crossings, ≥ 3 sharp corners; tests accept clean/sloppy pentagrams and reject circle, zig-zag, tiny scribble
- [x] INP-@@@@ · M0 · P1 · S · Right-drag star trail rendered additively; failure popups "The sign falters…", "The Litany is spent.", "Not now."
- [ ] INP-@@@@ · Demo · P0 · M · Star corpus — capture ≥ 300 positive star strokes (mouse, trackpad, pen, gamepad stick; ≥ 15 people) and ≥ 300 negatives (circles, checks, scribbles, zig-zags, stitching strokes) into `tests/fixtures/stars/*.json` via the record tool
- [ ] INP-@@@@ · Demo · P0 · S · Recogniser benchmark test — Vitest runs `isStar` over the corpus; CI fails if true-positive rate < 95 % or false-positive rate > 1 %
- [ ] INP-@@@@ · Demo · P1 · M · Recogniser tuning — accept any starting vertex, either winding direction, rotation ±45° and aspect down to 0.6; minimum size 60 px scales with UI scale; new unit tests for each case, corpus benchmark still green
- [ ] INP-@@@@ · Demo · P2 · M · $P point-cloud recogniser spike — implement a $P matcher with 5 star templates, compare F1 against the heuristic on the corpus, keep the better one (or AND/OR combine) and record the numbers in the PR
- [ ] INP-@@@@ · Demo · P1 · S · Failure reasons — `isStar` returns a diagnostic (`tooSmall`, `notClosed`, `tooFewPoints`, `tooManyCrossings`) and the failure popup names it ("Close the sign, Doctor", "Five points — draw larger")
- [ ] INP-@@@@ · Demo · P1 · S · Live vertex feedback — while drawing, detected corners are counted incrementally and exposed to the HUD star (0–5 points lit) and the audio shimmer pitch
- [ ] INP-@@@@ · Demo · P0 · S · Key-chord fallback — bindable chord (default hold `Shift`+`Space` for 0.5 s) invokes the Litany; setting "Litany input: Draw / Chord / Both" (default Both); chord obeys `canInvokeLitany()` and shows the same denial popups
- [ ] INP-@@@@ · Demo · P1 · S · Laptop alternative — holding a bindable modifier (default `Alt`) turns left-drag into star drawing, so trackpad users without comfortable right-drag can cast; tested on a Windows Precision and a Mac trackpad
- [ ] INP-@@@@ · Demo · P1 · S · Star-while-grabbing — starting a star stroke with the right button while the Tongs hold an object releases it back to origin and the star still records (unit test)
- [ ] INP-@@@@ · Demo · P2 · S · Stitch-stroke false positives — zig-zag stitch strokes from the corpus never trigger the Litany even if drawn with the Litany modifier held for < 150 ms (debounce) (unit test)

### Precision, handedness & motor options
- [ ] INP-@@@@ · Demo · P1 · S · Global hit-scale — one `hitScale` from the Target Size assist multiplies every entity interaction radius (Incision 22/34, Tongs 20, Embedded nick 30, Leech r+10, Salve 24, lens 60/110); table-driven unit test per entity at 1.5×
- [ ] INP-@@@@ · Demo · P2 · S · Precision modifier — while a bindable key (default `Ctrl`) is held in pointer-lock mode, cursor movement is scaled ×0.4 for fine tracing; indicator ring on the reticle while active
- [ ] INP-@@@@ · Demo · P2 · S · Cursor speed — 0.5×–2.0× multiplier applies in pointer-lock and virtual-cursor modes (no effect in absolute OS-cursor mode, greyed with explanation)
- [ ] INP-@@@@ · Demo · P1 · S · Left-handed mode (input) — swaps default primary/secondary mouse roles (tool on right button, star on left) independently of the OS setting; bindings screen reflects the swap; HUD mirroring handled in UIX
- [ ] INP-@@@@ · Demo · P2 · S · One-handed mouse preset — operations fully playable without keyboard: wheel/radial for tools, right-drag star, pause via a clickable HUD button; verified by completing op1-1…op1-5 mouse-only

### Rebinding
- [ ] INP-@@@@ · Demo · P0 · M · Bindings model — each action holds up to 2 keyboard/mouse bindings + 1 gamepad binding; versioned JSON in the settings file (separate from progress), defaults in code, migration on version bump (unit tests)
- [ ] INP-@@@@ · Demo · P0 · M · Rebinding screen — Options → Controls lists actions by group (Tools, Litany, Story, Menus); "Press a key…" capture with 5 s timeout, Esc cancels, conflict prompt offers Swap/Cancel, per-action and global Reset to defaults; works with mouse, keyboard and gamepad navigation
- [ ] INP-@@@@ · Demo · P0 · S · Reserved inputs — `Escape` (pause/back), primary mouse (use tool) and gamepad Start cannot be unbound; attempting shows an explanation
- [ ] INP-@@@@ · Demo · P0 · S · Glyphs from bindings — every prompt ("Right-drag ★" in the Litany indicator, the story footer "Click / Space: advance…", tray hotkey labels, briefing instrument keys) renders via `glyphFor(action)`; test: rebinding `tool.select.1` to `KeyZ` changes the tray label to "Z"
- [ ] INP-@@@@ · Demo · P2 · S · Binding presets — Default, Left-handed, One-handed mouse; selecting a preset previews changes before applying

## Epic INP-B · Gamepad & Steam Deck basics (Demo)

### Gamepad plumbing
- [ ] INP-@@@@ · Demo · P0 · M · Gamepad adapter — poll `navigator.getGamepads()` each frame (standard mapping), expose buttons/axes to the action map, handle `gamepadconnected`/`gamepaddisconnected` hot-plug; unit tests with a fake Gamepad object
- [ ] INP-@@@@ · Demo · P0 · S · Controller disconnect mid-operation auto-pauses and shows "Controller disconnected — reconnect or press any key"; reconnect resumes to the pause menu, not straight into play
- [ ] INP-@@@@ · Demo · P0 · S · Stick deadzones — radial inner deadzone 0.15, outer 0.95, rescaled; per-stick settings in Options → Controls; test: 0.1 drift produces no cursor motion
- [ ] INP-@@@@ · Demo · P0 · M · Menu navigation actions — `ui.up/down/left/right/confirm/back/tabPrev/tabNext` from arrows/WASD, D-pad and left stick with 180 ms initial repeat delay and 80 ms repeat rate; A/Cross confirm, B/Circle back (Nintendo layout swap option)
- [ ] INP-@@@@ · Demo · P1 · S · Last-used device tracking — prompts switch between mouse/keyboard and gamepad glyphs within one frame of input from the other device, with hysteresis (mouse must move > 4 px) so resting hands don't cause flicker
- [ ] INP-@@@@ · Demo · P1 · M · Glyph sets — Xbox, PlayStation, Steam Deck, Nintendo and generic glyph atlases in the woodcut UI style; auto-detected from `Gamepad.id` / Steam Input controller type; manual override in Options
- [ ] INP-@@@@ · Demo · P1 · S · Linux/Electron gamepad sanity — Xbox, DualSense and Deck built-in controls report the standard mapping in the Electron build on SteamOS and Ubuntu; mapping fixes shipped as a table for known ids

### Virtual cursor & gamepad surgery
- [ ] INP-@@@@ · Demo · P0 · M · Virtual cursor — left stick moves the reticle with an acceleration curve (max 900 px/s, response exponent 2.0, 80 ms ramp), RT/R2 = primary press/hold, cursor clamped to the view; "Cursor speed" setting 0.5–2.0×
- [ ] INP-@@@@ · Demo · P1 · S · Precision nudge — right stick moves the virtual cursor at 25 % speed for tracing and stitching fine work (bindable, off when the right stick is used for the radial)
- [ ] INP-@@@@ · Demo · P1 · M · Aim assist (gamepad only) — cursor speed ×0.5 within 30 px of an interactable valid for the current tool; with the Lancet the cursor gently snaps to the incision progress node on press; toggle "Aim assist" (default on for gamepad)
- [ ] INP-@@@@ · Demo · P1 · S · Gamepad tool switching — LB/RB cycle tools, hold Y/Triangle opens the radial menu selected with the right stick, D-pad left/right = quick-swap; all rebindable
- [ ] INP-@@@@ · Demo · P0 · M · Gamepad Litany — hold LT/L2 and trace the star with the virtual cursor (stick strokes use the gamepad threshold profile from the corpus), release LT to cast; chord fallback LB+RB held 0.6 s
- [ ] INP-@@@@ · Demo · P1 · M · Gamepad gesture calibration — 5 testers complete every Ch1–2 operation on an Xbox pad; any mechanic with < 80 % first-try success gets a gamepad-specific tuning entry (radius, speed, assisted stitching default) in `tuning.ts`
- [ ] INP-@@@@ · Demo · P1 · S · Virtual cursor in menus — in list/menus the stick drives focus navigation, not the cursor; in free-cursor screens (operation, codex art) the cursor appears; switching modes never strands focus

### Steam Input & Steam Deck
- [ ] INP-@@@@ · Demo · P0 · M · Steam Input action manifest — `game_actions_X.vdf` with action sets Menu, Operation, Story; default configurations for Xbox, PlayStation, generic and Deck; uploaded via Steamworks and tested with the Steam Input configurator
- [ ] INP-@@@@ · Demo · P0 · M · Deck default layout — right trackpad = mouse (click = primary, soft-press haptic), R2 = primary hold, L2 = Litany draw, left trackpad = radial tool menu, D-pad = quick-swap/pause, gyro off by default; documented in the Controls screen
- [ ] INP-@@@@ · Demo · P0 · S · Deck touchscreen basics — touch `pointerType === 'touch'` taps and drags act as primary mouse input in menus and operations; two-finger tap opens pause; tested on device
- [ ] INP-@@@@ · Demo · P0 · M · Deck Verified input checklist — all functionality reachable with Deck controls, correct Deck glyphs everywhere, no external keyboard needed, no launcher; pass recorded on retail Deck (LCD + OLED)
- [ ] INP-@@@@ · Demo · P1 · S · Deck suspend/resume — suspending the Deck mid-operation resumes into the pause menu with timer intact and audio context resumed (manual test ×10)

### Haptics
- [ ] INP-@@@@ · Demo · P2 · M · Rumble patterns — `vibrationActuator.playEffect('dual-rumble')` for BAD (short low), MISS (double), heavy hurt (≥ 8 vitals), Malison hit and critical heartbeat (< 30 vitals, synced to beat); "Vibration" 0–100 % setting; zero when app unfocused
- [ ] INP-@@@@ · Demo · P2 · S · Deck trackpad ticks — stitch crossings and incision checkpoints trigger a light trackpad haptic pulse via Steam Input (steamworks.js), rate-limited to 30/s

### Input QA
- [ ] INP-@@@@ · Demo · P0 · M · Headless gesture bots — scripted `Pointer` sequences complete every Ch1–2 operation for each assist combination (none, target 1.5×, toggle-hold, assisted stitching, auto-Litany); runs in Vitest CI
- [ ] INP-@@@@ · Demo · P1 · M · Device matrix sign-off — 5 mice (incl. 1 kHz and 8 kHz), Windows Precision trackpad, MacBook trackpad, Wacom Intuos (as mouse), Xbox Series pad, DualSense, Switch Pro, Steam Deck; pass sheet per Ch1–2 op in `docs/qa/input-matrix.md`
- [ ] INP-@@@@ · Demo · P1 · S · Input fuzz test — random press/move/release/key streams for 10 000 frames per operation never throw, never leave `captured` set after release, and never produce NaN positions
- [ ] INP-@@@@ · Demo · P2 · S · Bug-report hook — F8 saves the last 30 s of input recording + settings + build id to the logs folder and shows the path, for tester reports

## Epic UIX-A · UI foundation & art direction (Demo)

### Widget framework
- [x] UIX-@@@@ · M0 · P0 · M · Immediate-mode widgets — `panel`, `parchment`, `button` (hover/click), procedural `toolIcon` for all 8 tools, `star`, brass `reticle` (`src/ui/widgets.ts`)
- [x] UIX-@@@@ · M0 · P0 · S · Virtual 1280×720 layout, letterboxed 16:9 canvas scaled to the window at up to 2× DPR (`main.ts` resize)
- [ ] UIX-@@@@ · Demo · P0 · M · Update/draw split — widgets currently handle clicks inside `render()`; introduce a per-frame UI context that processes input in `update()` and draws in `render()`, so menus are testable without WebGL and input is handled exactly once per frame
- [ ] UIX-@@@@ · Demo · P0 · M · Focus navigation — every interactive widget registers a focus node; directional navigation picks the nearest node in the pressed direction; gold rim + candle-glow focus ring; Enter/A activates; all menus completable with keyboard only (Playwright keyboard script over Title → Options → Chapter Select → Operation → Pause → Results)
- [ ] UIX-@@@@ · Demo · P0 · S · Activate-on-release — buttons fire on primary release inside the rect after a press inside the rect (not on press), preventing click-through into the next scene; unit test with synthetic press/release
- [ ] UIX-@@@@ · Demo · P0 · M · Control widgets — slider, toggle, stepper (◀ value ▶), dropdown, tab bar, scroll list (wheel/drag/stick), modal confirm dialog; each supports mouse, keyboard and gamepad; gallery page at `?ui=gallery` for visual review
- [ ] UIX-@@@@ · Demo · P0 · S · Modal stack — pause, confirm and options can stack; Esc/B pops only the top modal; input never reaches layers underneath (test: Esc in Options-over-Pause returns to Pause, not gameplay)
- [ ] UIX-@@@@ · Demo · P1 · S · Tooltip widget — 400 ms hover delay (instant on focus for gamepad), auto-flip at screen edges, max width 360 px, used for tray tools, option descriptions and rank seals
- [ ] UIX-@@@@ · Demo · P1 · S · Scene transitions — `game.go()` routes through a transition manager (ink-wash dissolve or fade-through-black, 300 ms, instant with Reduced Motion); input blocked during transitions; no double-trigger if a button is clicked twice
- [ ] UIX-@@@@ · Demo · P1 · S · UI event hooks — widgets emit `ui.hover`, `ui.focus`, `ui.confirm`, `ui.back`, `ui.slider`, `ui.tab`, `ui.error` to the audio event bus (sounds defined in AUD)
- [ ] UIX-@@@@ · Demo · P1 · S · Text bounds — `textBlock` returns the laid-out height; single-line text ellipsises at its widget width; dev builds log widget id + string when text overflows (runs in the pseudo-loc and text-scale checks)

### Layout, resolution & scaling
- [ ] UIX-@@@@ · Demo · P0 · M · 16:10 / Steam Deck layout — decide and implement 1280×800 handling (extend virtual height to 800 with anchored HUD vs themed letterbox bars); HUD anchors (top-left, top-centre, bottom-right…) respect the extra space; screenshots at 1280×800, 1920×1080, 2560×1440, 3440×1440 and 3840×2160 reviewed
- [ ] UIX-@@@@ · Demo · P1 · S · Ultrawide handling — 21:9 and 32:9 windows pillarbox the 16:9 play area with an illuminated-border backdrop instead of plain black; the reticle and HUD stay inside the play area
- [ ] UIX-@@@@ · Demo · P1 · S · Safe-area margins — all HUD and menu elements sit inside a 4 % title-safe margin (debug overlay F3 draws the safe rect)
- [ ] UIX-@@@@ · Demo · P1 · M · UI scale option (80–150 %) scales HUD, menus and VN text independently of the world; layout verified at both extremes on 1280×800 without overlap
- [ ] UIX-@@@@ · Demo · P1 · S · Window modes — windowed/borderless/fullscreen and window size persisted; restore on next launch; DPR cap 2 retained with a "Render scale" option (50–100 %) for low-end GPUs

### Art direction & assets
- [ ] UIX-@@@@ · Demo · P0 · M · UI style guide — one-page guide + reference board: parchment sheets for documents (chart, report, codex, options), dark oak + brass for in-operation HUD, woodcut hatching for icons, wax seals for primary actions, blackletter (UnifrakturMaguntia) only for titles ≥ 36 px, IM Fell English for body; semantic colour tokens (`ok`, `warn`, `danger`, `curse`, `litany`, `inkOnParchment`) added to `PALETTE`
- [ ] UIX-@@@@ · Demo · P0 · M · 9-slice frames — textured oak panel, parchment sheet, iron-banded frame and torn-edge note replace procedural `panel()`/`parchment()`; single UI atlas ≤ 2048², crisp at 1× and 2× DPR
- [ ] UIX-@@@@ · Demo · P0 · L · Woodcut icon set — 8 tool icons, 4 rating stamps, heart, hourglass, Litany star, wax seal, rank seals XS/S/A/B/C, and ailment icons for Ch1–2 (knife wound, arrow, bolt, lead shot, fire/acid/hexfire burn, bubo, rot, venom, grub, curse-sigil, hexstone, Malison); 32/64/128 px exports in the UI atlas
- [ ] UIX-@@@@ · Demo · P1 · M · Tool cursor sprites — per-tool cursor art with the hotspot at the working tip (blade point, tong jaws, pipe mouth…) replacing the procedural `toolIcon` beside the reticle; reticle kept as optional overlay
- [ ] UIX-@@@@ · Demo · P1 · S · Wax-seal button — red wax seal with embossed glyph for primary actions ("Scrub In", "Continue", "Wishlist"); press squash 90 ms + crack sound hook; disabled state as cold grey wax
- [ ] UIX-@@@@ · Demo · P1 · S · Illuminated chapter title cards — blackletter chapter numeral, drop-cap border, woodcut vignette for Chapter I and Chapter II
- [ ] UIX-@@@@ · Demo · P1 · S · Glyph coverage audit — IM Fell English and UnifrakturMaguntia render every character used in Ch1–2 text and UI (`×`, `★`, `▼`, `—`, `’`, `…`, `é`, `ü`, `ß`); missing glyphs fall back to a matching serif; automated test scans content strings against atlas coverage
- [ ] UIX-@@@@ · Demo · P0 · S · Minimum text size — raise every UI string to ≥ 16 px virtual (tray hint and story footer are 13 px, tray keys 14 px today); a test/grep over `g.text(` size literals fails below 16 in HUD/menu code
- [ ] UIX-@@@@ · Demo · P0 · S · Contrast audit — all text ≥ 4.5:1 against its background (WCAG AA); fix known weak pairs such as faded ink `#5a4228` on parchment `#c4ae80` and `inkDim` over flesh; results table in the PR
- [ ] UIX-@@@@ · Demo · P1 · S · Motion language — easing/duration table (hover 80 ms, panel open 220 ms easeOutQuad, stamp 180 ms easeOutBack, page turn 350 ms) implemented as shared tween helpers; all honour Reduced Motion
- [ ] UIX-@@@@ · Demo · P2 · S · Candle-flicker UI lighting — panels receive a subtle 2–3 % luminance flicker synced to the scene's candle light; disabled with Reduced Motion / Reduced Flashing

## Epic UIX-B · Operation HUD (Demo)

### Already in place
- [x] UIX-@@@@ · M0 · P0 · S · Vitals readout — 0–99 number and bar with colour thresholds (> 60 good, > 30 warn, else danger) in the top bar
- [x] UIX-@@@@ · M0 · P0 · S · ECG trace — scrolling waveform driven by a heartbeat at 58 + (99 − vitals) × 0.9 bpm, jittering below 25 vitals, flat on death
- [x] UIX-@@@@ · M0 · P0 · S · Timer (mm:ss, red under 20 s, gold during the Litany), operation title and phase pips
- [x] UIX-@@@@ · M0 · P0 · S · Score and "Chain ×N" combo readout; patient name
- [x] UIX-@@@@ · M0 · P0 · S · Tool tray — slot per operation tool with hotkey label, selected highlight, Tincture cooldown overlay, tool name + hint text below
- [x] UIX-@@@@ · M0 · P0 · S · Litany indicator — star glyph glowing when ready, 8 s duration arc, "Right-drag ★ / Stillness / Spent" caption
- [x] UIX-@@@@ · M0 · P0 · S · Assistant callout panel with typewriter reveal (60 chars/s) and per-line hold of max(2.4 s, 55 ms/char)
- [x] UIX-@@@@ · M0 · P0 · S · Rating popups — COOL/GOOD/BAD/MISS text with combo suffix, scale-in and rise; damage numbers
- [x] UIX-@@@@ · M0 · P0 · S · Tool cursor — reticle + tool icon beside it, flash on switch, Tincture injection progress arc
- [x] UIX-@@@@ · M0 · P1 · S · Operation intro title card ("Let us begin."), "Operation Complete" and "The Patient Is Lost" banners

### Top bar: vitals, ECG, timer, score
- [ ] UIX-@@@@ · Demo · P0 · M · Top bar v2 layout — woodcut-framed bar with vitals block left, hourglass timer centre, score/combo right; no element overlaps the operating field ellipse (660, 410, 430×250); screenshot review at 1280×720 and 1280×800
- [ ] UIX-@@@@ · Demo · P0 · S · Vitals damage feedback — a pale "lag" bar trails the real value by 0.5 s after damage; heal shows a green sweep; digits shake ±2 px on hits ≥ 5 (off with Reduced Motion)
- [ ] UIX-@@@@ · Demo · P1 · S · Beating heart icon beside vitals scales on each beat (synced to the ECG beat phase) and changes shape per state (steady/strained/failing) so state is readable without colour
- [ ] UIX-@@@@ · Demo · P1 · M · ECG monitor v2 — sweep-style trace with an erase gap instead of array shifting; waveform variants per state (tachycardia under venom, irregular under curse/Malison, weak below 25) selected by the scene; flatline with ink bleed on loss
- [ ] UIX-@@@@ · Demo · P1 · S · Critical vitals state (< 30) — top-bar vitals block pulses red, screen edges vignette (existing post-process `danger`) and Ilse's low-vitals bark; state ends with hysteresis at 35
- [ ] UIX-@@@@ · Demo · P1 · S · Hourglass timer — sand level = timeLeft/timeLimit; sand frozen and gilded while the Litany holds; last 30 s the digits pulse and a tick event fires each second (AUD)
- [ ] UIX-@@@@ · Demo · P1 · S · Score roll-up — score counts up over 300 ms per gain; combo readout gains flame tiers at 5/10/20 (ember/flame/holy fire) and cracks visibly on combo break
- [ ] UIX-@@@@ · Demo · P2 · S · Phase progress v2 — pips become small seal icons with tooltip "Phase 2 of 4"; boss phases shown as notches on the Malison bar instead

### Ratings, popups & feedback
- [ ] UIX-@@@@ · Demo · P0 · M · Rating stamps — replace text popups with woodcut stamps (COOL gold leaf, GOOD green ink, BAD rust, MISS blood splash), each a distinct shape so it reads without colour; label text ("Incision") beneath; 1.1 s lifetime; stamp-in 120 ms
- [ ] UIX-@@@@ · Demo · P0 · S · Popup de-overlap — popups spawned within 40 px and 0.3 s of another stack upwards by one line; test: 5 simultaneous shard ratings stay legible (no bounding boxes overlap)
- [ ] UIX-@@@@ · Demo · P1 · S · Combo milestone callouts — at chain 5/10/20 a larger banner ("Steady hands!", "A surgeon's grace!", "Saint Ildra guides you!") appears once per milestone per operation
- [ ] UIX-@@@@ · Demo · P1 · S · Damage-number toggle and vitals-loss aggregation — continuous drain damage is summed and shown at most every 0.5 s per source instead of per frame
- [ ] UIX-@@@@ · Demo · P1 · S · Hurt direction cue — when vitals drop from an entity, a brief red pulse ring marks that entity so players learn what is draining the patient

### Tool tray & cursor
- [ ] UIX-@@@@ · Demo · P0 · M · Tray v2 — slot art per tool, selected slot slides out 8 px, binding glyph from current bindings, hover/focus tooltip (name, gesture, binding), Tincture cooldown as radial wipe, Brand heat glow; tray mirrors to the right edge in left-handed mode
- [ ] UIX-@@@@ · Demo · P1 · S · Contextual tool hints — the 13 px hint under the tray is replaced by a hint line near the cursor shown for the first 3 uses of a tool and after 5 s idle; setting "Tool hints: Always / First uses / Off"
- [ ] UIX-@@@@ · Demo · P0 · M · Target-validity cursor — cursor tints green over a valid target for the current tool; over a target needing another tool it shows that tool's ghost icon ("Needs: Leech-Pipe"); shape changes (ring vs cross) so it is colour-independent
- [ ] UIX-@@@@ · Demo · P1 · S · Hold-progress rings on the cursor for every hold tool — Leech (pool remaining), Brand (sear progress on grub/sigil/Malison), Lens reveal (0.4 s), Salve coverage %, Tincture injection (existing)
- [ ] UIX-@@@@ · Demo · P1 · S · Cursor visibility — reticle has a dark outline and optional size (1×–2×) and colour (brass/white/cyan/magenta) settings; remains visible over dark blood, black bile and bright hexfire

### Callouts & guidance
- [ ] UIX-@@@@ · Demo · P0 · S · Callout panel placement — the panel (y 650–708) currently overlaps the bottom of the operating field; move it into a reserved bottom strip or make it click-through and auto-shift away from the active entity; hit-test confirms clicks pass to the field
- [ ] UIX-@@@@ · Demo · P1 · M · Callout priorities — `op.say(line, { priority })`: urgent lines (low vitals, shard rejoining, Brand on healthy flesh) interrupt the queue; tips queue; duplicate lines within 10 s are dropped (unit tests on the queue)
- [ ] UIX-@@@@ · Demo · P1 · M · Sister Ilse bust in the callout panel with calm/urgent/relieved/worried expressions keyed by line priority or tag; subtle blink and mouth flap while text types
- [ ] UIX-@@@@ · Demo · P1 · S · Callout log — last 20 callouts of the current operation viewable from the pause menu
- [ ] UIX-@@@@ · Demo · P1 · S · Phase objective banner — optional `PhaseDef.objective` ("Close the wounds", "Draw off the blood") shown for 2 s at phase start and kept as a small line under the timer
- [ ] UIX-@@@@ · Demo · P2 · S · Threat markers — entities with a countdown (Malison shard rejoin, hexstone corruption every 7 s, bubo swelling) show a thin radial timer ring; edge arrows point to off-attention threats when the cursor is > 400 px away

### Boss HUD (Malison)
- [ ] UIX-@@@@ · Demo · P0 · M · Malison intro card — 3 s blackletter title card ("The Malison — Hour of Matins" / "— Hour of Lauds") with woodcut illustration and bell hook; skippable after first view; shown before the boss phase spawns
- [ ] UIX-@@@@ · Demo · P0 · M · Malison bar — name plate + "unmaking" bar with phase notches under the top bar; veiled/open state icon (the brand can only hurt when open); shard phase shows remaining shard count
- [ ] UIX-@@@@ · Demo · P1 · S · Veil telegraph — 0.6 s before the shroud parts, the Malison bar icon and the creature outline flash a warning so players can pre-select the Brand
- [ ] UIX-@@@@ · Demo · P1 · S · Lauds-specific HUD element — whatever gimmick the Ch2 boss design specifies (e.g. dawn-light exposure meter) gets its own readable HUD widget, reviewed against the Lauds design doc

### Litany & end-of-operation presentation
- [ ] UIX-@@@@ · Demo · P0 · S · Litany indicator v2 — star fills per detected vertex while drawing, candle flame when ready, 8 s radial while active, caption from current binding (draw or chord); HUD dims 30 % during Stillness so the world reads first
- [ ] UIX-@@@@ · Demo · P1 · S · Litany end warning — last 1.5 s of Stillness the ripple contracts and the indicator flickers (paired with the AUD reverse swell)
- [ ] UIX-@@@@ · Demo · P1 · S · Intro card v2 — shows patient name, ailment icon and time allowed for 1.2 s; any press skips; the intro no longer blocks the first click after it ends
- [ ] UIX-@@@@ · Demo · P1 · S · Win/lose presentation — "Operation Complete" stamps as a wax seal; "The Patient Is Lost" bleeds in as ink; results follow after 2.2 s or on click after 0.8 s
- [ ] UIX-@@@@ · Demo · P2 · S · Minimal HUD option — hides score, combo and phase pips (vitals, timer, tray, Litany always shown)
- [ ] UIX-@@@@ · Demo · P1 · S · Dev HUD (F3, dev builds only) — fps, frame ms, entity count, vitals drain/s per entity, active tool, input device, latency p95, audio voices

## Epic UIX-C · Front-end, flow, save & options (Demo)

### Boot & first launch
- [x] UIX-@@@@ · M0 · P1 · S · WebGL2 failure message shown in-page instead of a blank canvas (`boot()` fallback)
- [ ] UIX-@@@@ · Demo · P0 · S · Boot sequence — studio logo (2 s, skippable), then photosensitivity notice and content warning (gore, plague, body horror, religious violence) on first launch only, with a link to comfort options
- [ ] UIX-@@@@ · Demo · P0 · M · First-launch setup — language (English only in demo, list ready), brightness calibration, input device check ("Mouse detected" / "Controller detected"), subtitle size, and "Would you like gentler timings?" assist prompt; every step skippable; runs once per settings file
- [ ] UIX-@@@@ · Demo · P1 · S · Brightness calibration screen — woodcut symbol barely visible at correct gamma; slider adjusts the post-process gamma uniform; also in Display options
- [ ] UIX-@@@@ · Demo · P1 · S · Loading indicator — spinning wax-seal indicator during font/atlas/audio bank loads over 150 ms; no blank frames between boot and title

### Title screen
- [x] UIX-@@@@ · M0 · P0 · S · Title — Continue / Take the Oath (new game, with forswear-progress confirm) / Operating Theatre / Sound toggle; fullscreen hint and version string
- [ ] UIX-@@@@ · Demo · P0 · M · Title v2 — key-art backdrop (Kessendorf woodcut skyline, animated rain and candlelight), "Suture & Steel — The Malison Hours" logo lockup, menu: Continue, New Game, Chapter Select, Operating Theatre, Options, Credits, Quit; "DEMO" ribbon and Wishlist seal in demo builds
- [ ] UIX-@@@@ · Demo · P0 · S · Replace the stale "Chapter I complete. Chapter II is being written…" line with build-appropriate messaging (demo: routes to the demo-complete flow; full: nothing)
- [ ] UIX-@@@@ · Demo · P0 · S · Rename to Suture & Steel — title-screen logo text "Grim Apothecary" → "Suture & Steel" (subtitle "The Malison Hours"), `index.html` <title>, the WebGL2 failure message and the window title; localStorage key `grim-apothecary.save` migrated to `suture-and-steel.save` on first load (unit test with a legacy-key fixture); grep finds no "Grim Apothecary" in `src/` or `index.html`
- [ ] UIX-@@@@ · Demo · P1 · S · Continue preview — tooltip/card shows chapter, next step title, total play time and last-played date
- [ ] UIX-@@@@ · Demo · P1 · S · Quit to desktop — confirm dialog, calls Electron `app.quit()`; hidden in browser builds
- [ ] UIX-@@@@ · Demo · P1 · S · Build string — "Demo v0.x.y (build hash)" bottom-right replaces "v0.1 prototype", read from Vite `define`
- [ ] UIX-@@@@ · Demo · P1 · M · Credits — scrolling credits (team, voice cast, music, OFL font attributions for IM Fell English and UnifrakturMaguntia, third-party licences), speed-up on hold, skippable

### Chapter select & operating theatre
- [x] UIX-@@@@ · M0 · P1 · S · Operating Theatre list — replay any reached operation with best rank/score (`OperationsScene`)
- [ ] UIX-@@@@ · Demo · P0 · M · Chapter select — chapter cards (illustration, numeral, title, completion %, rank seals per operation); demo shows Chapters I–II playable and III–V as locked parchment "In the full game" cards
- [ ] UIX-@@@@ · Demo · P1 · M · Chapter step list — replay any reached story scene or operation from a chapter; replays never move `save.progress` backwards (unit test on `advance`)
- [ ] UIX-@@@@ · Demo · P1 · M · Operating Theatre v2 — scrollable grouped list by chapter, keyboard/gamepad navigation, details panel (best rank, best score, best time, clear date, assisted flag), rank-seal art
- [ ] UIX-@@@@ · Demo · P2 · S · Rank collection summary — "Seals earned: 7/10 S or better" per chapter on the chapter card

### Save & load
- [x] UIX-@@@@ · M0 · P0 · S · Progress autosave to localStorage after each step and best rank/score per operation (`save.ts`: `advance`, `recordBest`, `store`)
- [ ] UIX-@@@@ · Demo · P0 · M · Save slots — three slots with cards (chapter, next step, play time, seal count, last played); New Game asks for a slot; overwrite needs confirm
- [ ] UIX-@@@@ · Demo · P0 · S · Autosave indicator — quill/seal icon in a corner for ≥ 1 s whenever a save is written; tip on first boot "Do not quit while the seal turns"
- [ ] UIX-@@@@ · Demo · P0 · S · Corrupt save handling — today `load()` silently returns `fresh()` on parse failure; instead show "Your records are damaged" with Restore backup / Start fresh, and keep the bad file aside (test with a truncated JSON fixture)
- [ ] UIX-@@@@ · Demo · P0 · S · Settings separated from progress — volume, bindings, accessibility and display live in `settings.json`; `SaveData.volume` removed with a v1 → v2 migration test
- [ ] UIX-@@@@ · Demo · P1 · S · Delete slot — double confirm, plays a page-burn animation; cannot delete the slot currently loaded mid-session
- [ ] UIX-@@@@ · Demo · P1 · S · Demo → full-game carry-over — demo save format is forward compatible; a fixture test imports a demo save into the full-game loader and keeps progress and best ranks

### Pause
- [x] UIX-@@@@ · M0 · P0 · S · Pause menu "Respite" — Resume, Begin Again, Abandon the Patient; Esc toggles
- [ ] UIX-@@@@ · Demo · P0 · M · Pause v2 — Resume, Restart (confirm), Options, Controls card, Callout log, Abandon (confirm), Quit to Desktop (confirm); operation info panel (patient, ailment, time left, current rank pace)
- [ ] UIX-@@@@ · Demo · P1 · S · Pause presentation — world blurred and dimmed, parchment menu slides in 220 ms; resume optionally with a 3-2-1 countdown (Accessibility setting, default off)
- [ ] UIX-@@@@ · Demo · P1 · S · Pause button on HUD — clickable/touchable pause glyph in the top bar for mouse-only and Deck touch players

### Options
- [ ] UIX-@@@@ · Demo · P0 · M · Options shell — tabs Gameplay / Controls / Display / Audio / Accessibility / Language; live preview; per-tab Defaults; changes persist to `settings.json` on Back; reachable from Title and Pause (display mode and language greyed in-operation)
- [ ] UIX-@@@@ · Demo · P0 · M · Display tab — window mode, window size, VSync, frame cap (30/60/120/144/unlimited), render scale, UI scale, brightness, bloom intensity, film grain on/off, vignette on/off, screen-shake 0–100 % (scales `op.shake`)
- [ ] UIX-@@@@ · Demo · P1 · S · Gameplay tab — tool hints mode, damage numbers, callout text speed, confirm on abandon, wheel invert/wrap, Minimal HUD, skip-seen-tutorials
- [ ] UIX-@@@@ · Demo · P1 · S · Option descriptions — every option shows a one-line description and, where relevant, a live preview thumbnail (e.g. colour-blind palette on a sample operating field)
- [ ] UIX-@@@@ · Demo · P1 · S · Options are validated on load — out-of-range or unknown values fall back to defaults (unit tests per option)

### Patient chart (briefing)
- [x] UIX-@@@@ · M0 · P0 · S · Briefing parchment — title, patient, findings, time allowed, previous best, instrument icons with hotkeys, Scrub In / Back
- [ ] UIX-@@@@ · Demo · P0 · M · Chart v2 — patient woodcut portrait, anatomical sketch with ailment markers, instrument row with binding glyphs and "NEW" ribbon for first-time tools, Sister Ilse's handwritten note (tip) and target ranks
- [ ] UIX-@@@@ · Demo · P1 · M · New-instrument card — when an operation introduces a tool for the first time (Ch1: Lancet/Tongs, Tincture, Brand; Ch2: Scrying Lens), a card shows its illustration, a looping ghost-hand gesture and its binding before Scrub In
- [ ] UIX-@@@@ · Demo · P2 · S · Chart ink-writing animation — findings text writes in as quill ink (instant with Reduced Motion or on click)

### Results & rank
- [x] UIX-@@@@ · M0 · P0 · S · Results — rating counts, longest chain, vitals and time bonuses, score, animated rank reveal, "A new best!", Continue / Operate Again / Leave
- [ ] UIX-@@@@ · Demo · P0 · M · Chirurgical report — parchment report with tally marks per rating, per-action breakdown (incisions, sutures, extractions, burns dressed…), time taken, vitals remaining, Litany used; rank stamped as a wax seal with bell
- [ ] UIX-@@@@ · Demo · P1 · S · Next-rank hint — "S at 1500 — 120 short" and the most costly rating category ("4 BAD sutures")
- [ ] UIX-@@@@ · Demo · P0 · S · Failure report — cause of death, targeted tip derived from the run ("Blood pooled for 40 s — drain with the Leech-Pipe"), Try Again / Back to chapter; shown for both vitals and time-out losses
- [ ] UIX-@@@@ · Demo · P1 · S · Results skip — first press completes the tally animation, second press continues; Enter keeps working (existing)
- [ ] UIX-@@@@ · Demo · P1 · S · XS rank celebration — gold-leaf seal, choir sting hook, and "Without a single slip" subtitle
- [ ] UIX-@@@@ · Demo · P2 · S · Assisted badge — runs with any assist enabled show a small "Assisted" ribbon on the report and in the Operating Theatre (ranks still recorded)

## Epic UIX-D · Story / visual-novel UI (Demo)

### Text box & controls
- [x] UIX-@@@@ · M0 · P0 · S · Story scene — backdrop, procedural portrait, name plate in speaker colour, typewriter at 48 cps, click/Space/Enter advance, Ctrl fast-forward, Esc skips the scene, ▼ continue marker, place caption
- [ ] UIX-@@@@ · Demo · P0 · M · Backlog — wheel-up or `vn.log` opens a scrollable log of every line shown in the current scene (speaker + text, VO replay icon when VO exists); Esc/B closes; supports gamepad scrolling
- [ ] UIX-@@@@ · Demo · P0 · S · Story pause menu — Esc no longer skips instantly; it opens Resume / Skip Scene (confirm) / Backlog / Options / Return to Title
- [ ] UIX-@@@@ · Demo · P1 · S · Auto mode — toggle advances after the line completes plus max(1.2 s, 30 ms/char) or when VO ends; auto icon lit while active; any manual input pauses auto
- [ ] UIX-@@@@ · Demo · P1 · M · Read-text tracking — seen line ids stored per save; Ctrl skip passes only seen lines unless "Skip unread text" is on; skip stops at unseen lines with a flash
- [ ] UIX-@@@@ · Demo · P1 · S · Text-box control strip — clickable Auto / Skip / Log / Hide / Menu icons at the box's bottom-right, with binding tooltips; replaces the 13 px footer hint
- [ ] UIX-@@@@ · Demo · P1 · S · Hide UI — `vn.hide` (H / right-click / Y) hides the text box to view art; any input restores
- [ ] UIX-@@@@ · Demo · P1 · S · Text speed option — 24/48/72 cps/instant, shared by story text and operation callouts
- [ ] UIX-@@@@ · Demo · P1 · S · Text-box readability — optional box opacity 60–100 %, line spacing 1.3, max 3 lines at 125 % text scale without overflow on 1280×800

### Portraits & presentation
- [ ] UIX-@@@@ · Demo · P0 · M · Layered portraits — base + expression + effects layers per character (Kreuzer, Ilse, Stroh, Haller, Mauer, patients, Choir hood); script tag `say('ilse', text, { face: 'worried' })`; missing expression falls back to neutral with a dev warning
- [ ] UIX-@@@@ · Demo · P1 · M · Two-slot staging — left/right portrait slots, speaker lit, listener darkened 40 %, enter/exit slide 250 ms, cross-fade on expression change 120 ms
- [ ] UIX-@@@@ · Demo · P1 · S · First-appearance title — name plate shows the character's `title` ("Inquisitor Stroh — Order of the Pyre") the first time they speak in a save
- [ ] UIX-@@@@ · Demo · P1 · S · Location card — scene opens with "Kessendorf — Hospice of Saint Ildra — before Matins" lettered card and fade (replaces the plain `place` caption)
- [ ] UIX-@@@@ · Demo · P1 · M · Script effects — `shake`, `flash` (respects Reduced Flashing), `fade`, `cg` (full-screen illustration) and `sfx`/`music` commands in `StoryDef` lines, executed by `StoryScene`
- [ ] UIX-@@@@ · Demo · P2 · S · Inline emphasis markup — `*italic*` and `{term}` highlighting for key terms (Malison, Litany, Hollow Choir) in story text and callouts

## Epic UIX-E · Tutorials & first-time user experience (Demo)

### Teaching ladder
- [ ] UIX-@@@@ · Demo · P0 · M · FTUE ladder audit — table mapping each mechanic to the operation that teaches it (op1-1 stitch/leech/salve, op1-2 incision/tongs/barbs, op1-3 burns/tincture, op1-4 bubo/rot/brand, op1-5 Malison + Litany, Ch2 lens/venom/grubs/encircle/Lauds); every mechanic is taught before it is tested and none is taught twice
- [ ] UIX-@@@@ · Demo · P0 · M · Tutorial overlay system — scripted steps anchored to an entity or HUD element (arrow + dimmed surround), optional world-time pause until the requested action fires (`op.flags` / rating events); content in data, not scene code
- [ ] UIX-@@@@ · Demo · P0 · L · Ghost-hand demonstrations — translucent gloved hand + tool replays a recorded stroke over the real target for: trace incision, zig-zag stitch, hold-drain, Tongs pull-out, barb nick then pull, salve brush, hold-inject, sear, lens hover, encircle, star; 11 demos, looping until the player acts
- [ ] UIX-@@@@ · Demo · P1 · S · Device-aware demos — ghost demos and prompts switch to stick/trigger glyphs when a gamepad is the last-used device
- [ ] UIX-@@@@ · Demo · P1 · M · Adaptive re-teaching — two consecutive BAD/MISS on the same mechanic, or 8 s idle with a required entity untouched, replays that ghost demo once; setting "Adaptive hints" on by default
- [ ] UIX-@@@@ · Demo · P0 · M · Litany practice — before the op1-5 boss, a practice beat asks the player to draw the star (up to 3 tries with failure reasons, then offers the chord); success unlocks the Litany for the fight
- [ ] UIX-@@@@ · Demo · P1 · S · Controls reference card — per-tool gesture illustrations with current bindings, reachable from briefing and pause
- [ ] UIX-@@@@ · Demo · P1 · S · Tutorial skipping — "Skip tutorials" setting and per-prompt "Don't show again"; skipped tutorials remain viewable from the controls card

### FTUE validation
- [ ] UIX-@@@@ · Demo · P0 · M · Fresh-player playtest — 8 players new to Trauma Center: record time-to-first-success and attempts per mechanic through Ch1; any mechanic where > 25 % need > 3 attempts gets a tutorial or tuning fix before Next Fest
- [ ] UIX-@@@@ · Demo · P1 · S · First-operation friction target — median new player completes op1-1 in ≤ 4 min with ≤ 1 retry; tracked in the playtest sheet
- [ ] UIX-@@@@ · Demo · P1 · S · Tooltips on first appearance — the first time each ailment appears (bubo, rot, venom, grub, sigil, hexstone, Malison) a short Ilse callout plus codex-style card explains it (2 lines max)

## Epic UIX-F · Accessibility, comfort & assists (Demo)

### Vision
- [ ] UIX-@@@@ · Demo · P0 · M · Colour-blind palettes — deuteranopia, protanopia, tritanopia palette swaps driven by semantic tokens for ratings, vitals states, ichor types (blood/pus/black bile), curse purple and Litany gold; verified with simulator screenshots of every Ch1–2 operation
- [ ] UIX-@@@@ · Demo · P0 · S · Shape redundancy — every colour-coded state also differs by shape/icon/pattern (rating stamps, vitals heart states, pool hatching per ichor, validity cursor ring vs cross); checklist signed off in greyscale screenshots
- [ ] UIX-@@@@ · Demo · P0 · M · Text scaling — 100/125/150/175 % for story text, callouts, subtitles and tooltips; VN box and callout panel grow to 3 lines; no overflow at 175 % on 1280×800
- [ ] UIX-@@@@ · Demo · P1 · S · High-contrast mode — solid dark plates behind all HUD text, 2 px outlines on interactable entities and incision guides, stronger reticle outline
- [ ] UIX-@@@@ · Demo · P1 · S · Readable font option — swap body text from IM Fell English to Atkinson Hyperlegible (OFL, bundled) everywhere except titles/logo
- [ ] UIX-@@@@ · Demo · P2 · S · Screen-reader menus (Electron) — focused menu item text mirrored to an ARIA live region so NVDA/Narrator read menus; tested with NVDA on Windows

### Motion, flashing & gore
- [ ] UIX-@@@@ · Demo · P0 · S · Reduced motion — disables screen shake (`op.shake`), popup scale/rise, UI parallax, candle flicker, pulsing glows; Litany ripple becomes a static sepia tint; one toggle, previewed live
- [ ] UIX-@@@@ · Demo · P0 · M · Reduced flashing — caps bloom spikes, Malison hurt flash, low-vitals red pulse and lightning to ≤ 3 luminance flashes/s and ≤ 20 % area; Harding-style analysis on captured Ch1–2 boss footage passes with the setting on and off
- [ ] UIX-@@@@ · Demo · P0 · M · Gore level — Full / Reduced / Minimal: Reduced darkens blood to brown and removes spurts; Minimal renders blood and open wounds as ink-black stylised shapes; applies to `BloodPool`, `Laceration`, `Incision` draw and the flesh shader; gameplay readability unchanged (playtest)
- [ ] UIX-@@@@ · Demo · P2 · S · Creature filter — option replaces grub/larva art with abstract blotches and mutes their chittering (for insect phobia)
- [ ] UIX-@@@@ · Demo · P1 · S · Content warnings — per-chapter warnings listed in Options → Accessibility and on the chapter card (demo: Ch1–2)

### Assists
- [ ] UIX-@@@@ · Demo · P0 · M · Assist menu — Timer speed (100/75/50 %), Vitals drain (100/75/50 %), Target size (1.0/1.25/1.5×), Toggle-hold, Assisted stitching, Auto-Litany, Tutorial hints; applied through an `Assists` object read by `Operation` (unit tests per assist)
- [ ] UIX-@@@@ · Demo · P1 · S · Auto-Litany — when enabled, the Litany triggers automatically the first time vitals fall below 25 or the Malison bar reaches its last notch; still once per operation (unit test)
- [ ] UIX-@@@@ · Demo · P1 · S · Assist transparency — assists never block achievements or progress; the report shows which assists were active; Operating Theatre filter "Unassisted bests only"
- [ ] UIX-@@@@ · Demo · P1 · S · Skip after failures — after 3 losses on the same operation, "Let Sister Ilse steady your hand" offers enabling assists or continuing the story with the operation marked "Passed with aid"
- [ ] UIX-@@@@ · Demo · P1 · S · Accessibility presets — "Vision", "Motor", "Hearing", "Comfort" one-click presets on first launch and in Options, each listing what it changes
- [ ] UIX-@@@@ · Demo · P1 · M · Accessibility audit — demo checked against Game Accessibility Guidelines (basic + key intermediate items) and Xbox Accessibility Guidelines 101–107, 112, 114, 117; gaps logged with owners; results table in `docs/qa/accessibility.md`

## Epic UIX-G · Demo-complete flow & wishlist (Demo)

### Demo build gating
- [ ] UIX-@@@@ · Demo · P0 · S · `__DEMO__` build flag (Vite `define`) gates demo-only UI (DEMO ribbon, wishlist seals, locked Ch3–5 cards, demo-complete scene); CI builds and smoke-tests both flavours
- [ ] UIX-@@@@ · Demo · P0 · S · Demo campaign end — `playStep` past the last Chapter II step routes to `DemoCompleteScene` in demo builds (today it falls back to `TitleScene`); unit test with a two-chapter campaign stub

### Demo-complete scene
- [ ] UIX-@@@@ · Demo · P0 · M · "Here the demo ends" sequence — illuminated card, teaser of the next Malison hour (Prime) as a silhouette with "The Hours are not yet done…", music sting, then the summary; skippable after first view
- [ ] UIX-@@@@ · Demo · P0 · M · Demo summary — grid of rank seals for all 10 operations, total play time, XS count, longest chain, Litany uses; "Replay operations for better seals" button to the Operating Theatre
- [ ] UIX-@@@@ · Demo · P0 · M · Wishlist call-to-action — wax-seal "Wishlist on Steam" button opens the full game's store page via steamworks.js overlay (`overlay.activateToStore(appId)`), falling back to `steam://store/<appid>` via `shell.openExternal` when the overlay is disabled; tested with overlay on and off and on Deck
- [ ] UIX-@@@@ · Demo · P1 · S · Feedback link — "Tell us what you think" opens the survey URL with build id and play time as query parameters
- [ ] UIX-@@@@ · Demo · P2 · S · Community row — Discord and newsletter links (small woodcut icons) under the wishlist button; hidden in kiosk builds
- [ ] UIX-@@@@ · Demo · P1 · S · Save-carry message — "Your progress and seals will carry over to the full game" shown only once carry-over is verified by the fixture test

### After the demo
- [ ] UIX-@@@@ · Demo · P0 · S · Post-demo title state — after completion the title shows a "Demo complete" banner and Wishlist seal, Continue becomes Chapter Select, and the demo-complete scene is replayable from Extras
- [ ] UIX-@@@@ · Demo · P1 · S · Title wishlist seal — always visible on the demo title (not a pop-up nag); click-through tracked in the local stats file
- [ ] UIX-@@@@ · Demo · P2 · M · Event kiosk mode — `--kiosk` flag: returns to title after 90 s idle, disables Quit and save slots, resets progress each session, shows controls card on title (for Next Fest streams and conventions)
- [ ] UIX-@@@@ · Demo · P0 · M · Demo-complete E2E test — Playwright drives the demo build via debug `skipTo` hooks through the Lauds operation to `DemoCompleteScene`, asserts the summary values and that the wishlist handler is invoked (mocked steamworks)

## Epic AUD-A · Audio engine, mixer & pipeline (Demo)

### Engine & bus graph
- [x] AUD-@@@@ · M0 · P0 · M · Procedural WebAudio cues — 16 `Cue`s (ratings, cut, stitch, squelch, pluck, burn, inject, heartbeat, flatline, litany, bell, select, alarm) synthesised from oscillators and filtered noise into a master gain
- [x] AUD-@@@@ · M0 · P0 · S · AudioContext unlocked on first pointer/key gesture; mute toggle on the title screen
- [x] AUD-@@@@ · M0 · P1 · S · Simulation emits sounds as data (`op.cues`), drained and de-duplicated per frame by `OperationScene` — keeps the sim DOM-free
- [ ] AUD-@@@@ · Demo · P0 · M · Bus graph — master → music, sfx (world, hud), ui, vo, ambience buses as GainNodes with persisted 0–100 volumes; topology unit-tested against a fake AudioContext
- [ ] AUD-@@@@ · Demo · P0 · S · Wire persisted volume — `SaveData.volume` is saved but never applied (`Audio.volume` is hard-coded 0.5); master volume comes from settings on boot and updates live
- [ ] AUD-@@@@ · Demo · P0 · S · Master safety limiter — DynamicsCompressorNode on master (threshold −6 dB, ratio 20, attack 3 ms, release 100 ms); an offline render of the op1-5 boss replay shows no sample above −0.5 dBFS
- [ ] AUD-@@@@ · Demo · P0 · M · Data-driven events — replace the `Cue` string union with event ids (`sfx.lancet.cut`, `sfx.rate.cool`, `vo.ilse.lowVitals`…) defined in `src/audio/events.ts`; the sim keeps pushing ids into `op.cues`; unit test that every id the sim can emit has a mapping
- [ ] AUD-@@@@ · Demo · P0 · S · Procedural fallback — events without recorded assets fall back to the existing synth so dev builds never go silent; boot logs a list of unmapped/placeholder events in dev
- [ ] AUD-@@@@ · Demo · P1 · S · Pre-built noise buffers — `noise()` allocates and fills a new AudioBuffer with `Math.random()` per call; precompute white-noise buffers at unlock and reuse (no per-cue buffer allocations in a heap snapshot)
- [ ] AUD-@@@@ · Demo · P0 · M · Voice manager — `play(id, { pan, vol, pitch, priority })` with per-event voice limits (e.g. stitch 4, squelch 3, rating 2), stealing lowest-priority/oldest voice, global cap 48 voices; unit tests on stealing order
- [ ] AUD-@@@@ · Demo · P0 · S · Variation & randomisation — events define 3–6 variations with no-immediate-repeat selection and per-event pitch (± cents) and gain (± dB) ranges
- [ ] AUD-@@@@ · Demo · P0 · M · Loop API — `startLoop(id)` / `setParam(handle, name, v)` / `stopLoop(handle, fadeMs)` for held-tool loops (leech suction, brand sizzle, salve smear, tincture plunger, lens hum, Litany drone); loops stop within 50 ms of release and never leak (test: 1 000 hold/release cycles leave 0 active loops)
- [ ] AUD-@@@@ · Demo · P1 · S · Stereo placement — StereoPannerNode pan from entity screen X across the operating field (−0.6…0.6); disabled by the Mono setting
- [ ] AUD-@@@@ · Demo · P1 · S · Scheduled heartbeat — heartbeat events scheduled on `ctx.currentTime` with 100 ms look-ahead from the ECG beat phase, so beats land within ±5 ms of the QRS spike instead of rAF jitter
- [ ] AUD-@@@@ · Demo · P1 · S · Convolution reverb — two impulse responses (stone operating theatre, chapel) as send effects per bus; scene selects the space; wet level per snapshot

### Mixing: ducking & snapshots
- [ ] AUD-@@@@ · Demo · P0 · M · Ducking — VO/callout barks duck music −8 dB and ambience −6 dB (attack 80 ms, release 400 ms); rating stings duck music −3 dB for 250 ms; ducking amounts in a data table
- [ ] AUD-@@@@ · Demo · P0 · M · Snapshots — `default`, `pause` (music LPF 800 Hz −6 dB, world SFX muted, ambience −12 dB), `litany`, `lowVitals`, `vn`, `results`, `menu`; 300 ms cross-fades; stack with priorities; unit-tested transitions
- [ ] AUD-@@@@ · Demo · P0 · M · Litany snapshot — world SFX playbackRate ×0.6 and LPF 1.2 kHz, reverb send +6 dB, heartbeat slowed to match the 0.15 time scale, UI/VO untouched; enters in 400 ms, exits in 600 ms synced to `litanyTime`
- [ ] AUD-@@@@ · Demo · P1 · S · Low-vitals snapshot — below 30 vitals a gradual high-shelf cut (−6 dB above 4 kHz) and a faint tinnitus layer; lifted with 35 hysteresis; off with "Reduce audio stress"
- [ ] AUD-@@@@ · Demo · P1 · S · Pause behaviour — pausing freezes world loops (suspended, not stopped) and resumes them in place; VO pauses mid-line and resumes

### Asset pipeline & runtime
- [ ] AUD-@@@@ · Demo · P0 · M · Asset pipeline — source WAVs (48 kHz/24-bit) in `assets-src/audio`, build script encodes Ogg Opus (SFX 96 kbps, music 160 kbps, VO 64 kbps mono), generates a manifest with duration, integrated LUFS and true peak; CI fails on missing or oversized files
- [ ] AUD-@@@@ · Demo · P0 · M · Bank loading — events grouped in banks (boot/ui, title, story, operation-common, per-operation, boss) preloaded on scene entry with progress; decoded memory ≤ 150 MB for the demo; unused banks released
- [ ] AUD-@@@@ · Demo · P1 · S · Music streaming decision — long music stems either streamed via `MediaElementAudioSourceNode` or decoded buffers with loop points; decide by memory/gapless test and document in the PR
- [ ] AUD-@@@@ · Demo · P1 · S · Device resilience — handle output device change (`devicechange`), headphones unplug, sample-rate changes and `AudioContext` `interrupted` state on macOS without silence or crash (manual matrix)
- [ ] AUD-@@@@ · Demo · P1 · S · Output latency — create the context with `latencyHint: 'interactive'`; debug overlay shows `baseLatency` + `outputLatency`; target < 40 ms on Windows WASAPI in Electron
- [ ] AUD-@@@@ · Demo · P1 · S · Mute when unfocused — option (default on) fades master to −∞ in 200 ms on window blur and back on focus
- [ ] AUD-@@@@ · Demo · P1 · M · Audio debug overlay (F4) — active voices by bus, bus RMS/peak meters, current snapshot stack, loaded banks and memory, last 20 events fired
- [ ] AUD-@@@@ · Demo · P2 · M · Offline audio tests — Vitest renders event sequences through `OfflineAudioContext` (node-web-audio-api) to assert no clipping, correct ducking depth and loop stop timing

## Epic AUD-B · Designed SFX for Chapters 1–2 (Demo)

### Sourcing & direction
- [ ] AUD-@@@@ · Demo · P0 · S · SFX direction brief — period-authentic palette (steel, horn, wood, glass, wax, wet leather, embers, church bronze; no modern beeps), grim but not gratuitous gore level, reference clips; approved before recording
- [ ] AUD-@@@@ · Demo · P0 · M · Foley session — record flesh (cabbage, wet chamois, raw meat, gelatine), antique steel instruments, glass vials/jars, wax seals, parchment, quill, thread through leather, embers/cautery iron in water; 48 kHz/24-bit, slate log, ≥ 5 takes per action
- [ ] AUD-@@@@ · Demo · P1 · S · Library licensing — licences for bell, choir and ambience libraries recorded in `docs/licences/audio.md` with per-file provenance in the manifest
- [ ] AUD-@@@@ · Demo · P0 · M · SFX event list — spreadsheet of every Ch1–2 event (id, trigger in code, variations, loop?, bus, priority, caption text, status) generated from `events.ts` and reviewed weekly
- [ ] AUD-@@@@ · Demo · P0 · S · Procedural → designed migration — each of the 16 current `Cue`s mapped to designed events (e.g. `cut` splits into lancet cut, barb nick, Malison rend; `pluck` into tongs grab, burn debride, grub pluck); after migration the synth only runs as fallback (dev report shows 0 fallback plays in a full Ch1–2 replay)

### Instruments (per tool)
- [ ] AUD-@@@@ · Demo · P0 · M · Lancet set — skin-touch on press, cutting loop with gain/pitch from stroke speed, incision-complete wet open, off-the-line slip, empty-press air slash (MISS), barb nick; ≥ 4 variations each
- [ ] AUD-@@@@ · Demo · P0 · M · Tongs set — jaw open/close clicks, grab (wet flesh vs hard object), pulling-strain loop scaled by distance from origin, extraction pop per object (wooden arrow shaft, crossbow bolt, lead shot, tooth, glass shard, hexstone chime), drop into metal dish
- [ ] AUD-@@@@ · Demo · P0 · S · Leech-Pipe set — suction loop with gurgle intensity from pool radius, separate textures for blood, pus and black bile, pool-cleared slurp
- [ ] AUD-@@@@ · Demo · P0 · M · Gut Thread set — needle pierce per stitch with pitch rising along the wound (+1 semitone per stitch, capped), thread pull zip, final knot tie on closure
- [ ] AUD-@@@@ · Demo · P0 · S · Saint's Salve set — jar lid, wet smear loop gated by coverage progress, sealing shimmer when a nick or rot patch is sealed
- [ ] AUD-@@@@ · Demo · P0 · S · Tincture set — vial clink on select, plunger loop during the 0.7 s hold, injection-complete swell + heal chime, cooldown-ready tick after 6 s
- [ ] AUD-@@@@ · Demo · P0 · M · Cautery Brand set — idle ember hum, sizzle loop on contact with variants for flesh (warning hiss), grub, curse-sigil and Malison flesh, quench/steam on release
- [ ] AUD-@@@@ · Demo · P0 · S · Scrying Lens set — glass hum loop while selected, proximity shimmer rising near hidden objects, "Found!" reveal chime
- [ ] AUD-@@@@ · Demo · P1 · S · Tool pick-up sounds — distinct select sound per tool (steel, tong spring, glass, jar, iron) replacing the shared `select` square blip; unavailable-tool dull clack

### Ailments & patient (Ch1–2)
- [ ] AUD-@@@@ · Demo · P0 · S · Bleeding — laceration trickle loop scaled by severity, blood-pool growth drips, pooled blood blocking stitching ("flooded") wet slap
- [ ] AUD-@@@@ · Demo · P0 · S · Embedded objects — hexstone corruption pulse (whisper + low chime every 7 s cycle), barbed tear rip with pained patient vocal
- [ ] AUD-@@@@ · Demo · P0 · S · Burns — eschar flake crack on debride, fire-burn crackle bed, acid fizz, hexfire whispering crackle; "Burn dressed" cool-down hiss
- [ ] AUD-@@@@ · Demo · P0 · S · Plague — bubo swelling creak, lance pop + pus burst, pus drain, rot creeping squelch loop, "Rot purged" cleanse
- [ ] AUD-@@@@ · Demo · P0 · S · Venom — spreading hiss/tingle loop scaled by `spreadR`, antidote neutralise effervescence
- [ ] AUD-@@@@ · Demo · P0 · S · Grubs — wriggle chitter loop per grub (voice-limited to 3), burrow, seared squeal, plucked squeak, dropped-in-dish tick
- [ ] AUD-@@@@ · Demo · P0 · S · Curse-sigil — chanting whisper loop while active, crack stages during searing, "Curse broken" glass-bell shatter
- [ ] AUD-@@@@ · Demo · P1 · S · Ch2 growth excision — encircle cut loop, growth severed release, Tongs removal of the excised mass
- [ ] AUD-@@@@ · Demo · P1 · M · Patient vocal set — moans, sharp pain on BAD/MISS hurt ≥ 3, relieved breath on win, death rattle; 4 voice types (man, woman, elder, dwarf); toggle "Patient vocalisations"

### The Malison (Ch1–2 bosses)
- [ ] AUD-@@@@ · Demo · P0 · M · Malison of Matins set — veiled drone, shroud-parting choir swell, flesh-rending tear, brand-hit shriek, hexling shedding, splitting apart, shard rejoin warning (2 s rising whisper) and rejoin thud, "Malison unmade" collapse with bell
- [ ] AUD-@@@@ · Demo · P0 · M · Malison of Lauds set — full event set for the Ch2 boss per its design (≈ 12 events: intro, phase shifts, attacks, telegraphs, hits, death); every telegraph has a distinct audio cue ≥ 0.5 s before the threat lands
- [ ] AUD-@@@@ · Demo · P1 · S · Hour bells — boss intro card plays the canonical hour bell pattern (Matins: 3 slow strokes in darkness; Lauds: dawn peal) through the chapel reverb

### Scoring, vitals & timer
- [ ] AUD-@@@@ · Demo · P0 · S · Rating stings — COOL (bright bell + parchment stamp), GOOD (soft chime), BAD (dull wooden thud), MISS (discordant lute + splash); ≤ 400 ms, voice limit 2, never mask the action sound
- [ ] AUD-@@@@ · Demo · P1 · S · Combo tiers — chain 5/10/20 add an ascending choir note layer to COOL/GOOD; combo break plays a snapped-string cue
- [ ] AUD-@@@@ · Demo · P0 · S · Vitals alarms — crossing below 60 and 30 plays a period hand-bell warning (replaces the square-wave `alarm`); below 15 a rapid bell; rate-limited to once per 5 s
- [ ] AUD-@@@@ · Demo · P0 · S · Flatline/death — replace the 980 Hz beep with a death knell + sustained low drone and heartbeat stop
- [ ] AUD-@@@@ · Demo · P1 · S · Timer — clock-escapement tick each second in the last 10 s (quieter 11–30 s option), "time is up" bell; ticking suspended during the Litany
- [ ] AUD-@@@@ · Demo · P1 · S · Phase clear — short resolving motif (on the music bar grid when possible) when a phase's required entities are gone

### Litany of Stillness
- [ ] AUD-@@@@ · Demo · P0 · S · Star drawing — shimmering trail loop while the right button draws, pitch step per detected vertex (5 steps of a pentatonic scale); failed sign fizzle; "Litany spent" dull denial
- [ ] AUD-@@@@ · Demo · P0 · S · Invocation — whispered Kreuzer prayer ("Be still…") + choral swell replacing the four sine tones; end warning reverse swell 1.5 s before Stillness ends; release exhale when time resumes

### UI, story & results
- [ ] AUD-@@@@ · Demo · P0 · S · UI set — hover (soft quill), confirm (wax seal stamp), back (page turn), tab (page flip), slider tick, toggle (latch), error (dull lute), pause open/close (cloth rustle), save (quill scratch)
- [ ] AUD-@@@@ · Demo · P1 · S · VN set — line advance tick, optional per-character text blips (off by default), scene transition page turn, backdrop change whoosh, portrait enter rustle
- [ ] AUD-@@@@ · Demo · P1 · S · Results set — tally tick per row, score roll loop, rank seal stamps per rank (XS choir sting, S bell, A chime, B/C muted thud), new-best flourish
- [ ] AUD-@@@@ · Demo · P1 · S · Briefing/chart set — parchment unroll, quill writing loop during ink animation, "Scrub In" basin splash + instrument tray rattle

