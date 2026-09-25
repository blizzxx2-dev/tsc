# Steam Input

- `game_actions_APPID.vdf` — the In-Game Actions manifest: action sets **Operation**, **Story**
  and **Menu**, one action per entry in `src/input/actions.ts` (plus analogue cursor/stick
  actions). Rename to `game_actions_<real app id>.vdf` once the App ID exists.
- The default configurations (Xbox, PlayStation, generic, Steam Deck) are authored in the
  Steam Input configurator from the tables below, exported, and set as official defaults in
  Steamworks → Application → Steam Input. Until native Steam Input lands (INP-0115) the game
  reads the Gamepad API, so every default configuration must emit a **standard XInput
  gamepad** (buttons below) — the game's own bindings then apply.

## Gamepad defaults (every controller family)

| Control | Game action |
| --- | --- |
| Left stick | Cursor (900 px/s, curve 2.0, 80 ms ramp) |
| Right stick | Precision nudge (25 %); picks the instrument while the wheel is open |
| RT / R2 | Use instrument (hold) |
| LT / L2 | Hold and trace the star; release to cast |
| LB / RB | Previous / next instrument (fire on release) |
| LB + RB held 0.6 s | Speak the Litany |
| Y / Triangle | Instrument wheel (hold, right stick to pick, release) |
| D-pad left | Swap to last instrument |
| A / Cross, B / Circle | Confirm / back (swapped with the Nintendo layout option) |
| Menu / Options | Pause (cannot be unbound) |
| View / Create | Dialogue log (story) |

## Steam Deck default layout (INP-0091)

| Deck control | Configurator setting | Game action |
| --- | --- | --- |
| Right trackpad | As Mouse; click = Left Mouse Click; haptic intensity: low; soft press on | Cursor + use instrument |
| R2 | Right Trigger (full pull) | Use instrument (hold) |
| L2 | Left Trigger | Draw the star |
| Left trackpad | Radial Menu is **not** used; bind as Directional Pad → hold = Y (instrument wheel) | Instrument wheel |
| Left stick | Joystick | Cursor |
| Right stick | Joystick | Precision nudge / wheel pick |
| L1 / R1 | Left / Right Bumper | Previous / next instrument; together = Litany |
| D-pad | D-pad (left = quick-swap) | Menus / quick-swap |
| A B X Y | A B X Y | Confirm / back / — / wheel |
| Menu (≡) | Start | Pause |
| View (⧉) | Back | Dialogue log |
| Gyro | Off | — |

The same table is shown in-game under Options → Controls → Steam Deck.

Verification on hardware is a human task — see `docs/handoff/INP/README.md`.
