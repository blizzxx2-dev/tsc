# Exploratory charters and soak (QAT-0140 … 0144)

Each charter is a 90-minute time-boxed session by one tester on the build under test. Take notes as you go
(timestamp, what you tried, what happened), file bugs through the issue forms with the F8 bundle, and end with a
3-line debrief: areas covered, bugs found (ids), what still worries you. Use the console / F1 menu to set up
situations fast (`preset`, `op <id> go`, `skip`, `vitals`, `time`), then play them for real.

## QAT-0140 — Tool switching and capture

*Explore* switching instruments and interrupting grips *with* every input path *to discover* stuck captures, lost
or doubled ratings and wrong penalties.

- On every entity type (see `docs/qa/tool-entity-matrix.md` for the expected response), start a drag / hold / pull
  and mid-gesture: switch tool by hotkey, wheel, Q/E, Tab quick-swap and tray click; press Esc (pause); open the
  Steam overlay (Shift+Tab); alt-tab; unplug the mouse.
- Targets: an arrow mid-pull (did it sink back? tear?), a tincture mid-hold (progress reset?), the brand on a Voice
  mid-silence (does silence decay?), tongs on a Malison shard mid-drag (does it rejoin on time?), thread mid-zig-zag.
- Oracles: after the interruption the next gesture behaves normally; no rating fires twice; nothing is still "held".

## QAT-0141 — Litany edge cases

*Explore* invoking the Litany of Stillness at awkward moments *to discover* timer, slow-motion or once-per-op errors.

- Draw the star: during the 0.8 s phase transition; at 1 vitals; while paused (should do nothing); while holding a
  Voice or a shard; on the last second of the timer; right as the patient flatlines; twice quickly; with the
  Space assist and the star together.
- Oracles: the timer stops for exactly the Litany (8 s), the world moves at 15 %, the surgeon's input does not slow,
  it works once per operation, "The Litany is spent." afterwards, ops without it never trigger it.

## QAT-0142 — Window and display chaos

*Explore* the window and display during the Lauds and Matins fights *to discover* crashes, context loss, stuck
input and layout breakage.

- Alt-tab spam (20× in 10 s); unplug the active monitor; display sleep and wake; change Windows scaling (100→150 %)
  while moving the window between monitors; F11 / Alt+Enter repeatedly during a Hymn; minimise for 5 minutes;
  lock the session (Win+L) mid-op; Deck suspend/resume.
- Oracles: the game survives, redraws correctly (WebGL context restored), the op pauses rather than punishing lost
  time, the canvas keeps 16:9 and the cursor maps to the right place.

## QAT-0143 — Entity pressure

*Explore* the densest moments *to discover* frame-time spikes, unreadable screens and input-priority mistakes.

- op2-5: let the Lauds Hymn run while spiderlings (op2-3 egg sacs via console `op op2-3 go`, let them hatch) and
  blood pools accumulate; add more with repeated wounds. op1-5: let the Matins rend for a minute before branding.
- Watch the Steam FPS counter / F8 frame times; note when it dips below budget and what is on screen.
- Oracles: presses go to the topmost thing under the cursor (shards over wounds, the Malison over lacerations),
  callouts stay readable, frame time stays in budget (log p95 in the debrief).

## QAT-0144 — Idle soak

Automated driver: `node scripts/qa/soak.mjs <scene> <hours>` (QA build; scenes `title`, `paused-op`, `demo-end`)
samples JS heap every minute and fails on an error, a stall, or heap growth over 50 MB. The 8-hour runs on the
reference PCs and the Deck (packaged build, where process memory is read from the OS) are a manual hand-off.

| Scene | Duration | Pass when |
|---|---|---|
| Title screen | 8 h | no crash; memory growth < 50 MB; title music/ambience still audible; input still works |
| Paused operation (op2-5 in the Lauds phase, Esc) | 8 h | same; unpausing resumes the fight with the same state |
| Demo-end summary | 8 h | same; wishlist button still works |
