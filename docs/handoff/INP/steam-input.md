# Steam Input and Steam Deck layout (INP-0090, INP-0091)

Prepared: `steam/input/game_actions_APPID.vdf` (action sets Operation, Story, Menu with English
localisation) and the default layout tables in `steam/input/README.md`.

## INP-0090 — manifest and default configurations
- [ ] Rename the manifest to `game_actions_<AppID>.vdf`; upload it under Steamworks → Application →
      Steam Input → "Use the In-Game Actions manifest"; publish.
- [ ] In the Steam client, open the Steam Input configurator for the game with an Xbox pad and
      confirm the three action sets and every action title appear.
- [ ] Author the Xbox, PlayStation and generic default configurations from the "Gamepad defaults"
      table (each must present a standard XInput gamepad to the game until native Steam Input,
      INP-0115, lands). Export each and set them as official defaults in Steamworks.
- [ ] With each controller: every row of the table does what it says in op1-1 and in the menus.

## INP-0091 — Steam Deck default layout
- [ ] On a retail Deck, build the configuration from the "Steam Deck default layout" table
      (right trackpad as mouse with click = left click and soft-press haptic; L2 draw star;
      left trackpad → hold Y for the instrument wheel; Menu = pause; gyro off).
- [ ] Export it and set it as the official Deck default in Steamworks.
- [ ] Verify each row on an LCD Deck and on an OLED Deck in op1-1, op1-3 (Litany) and op2-5
      (boss); confirm the in-game table under Options → Controls → Steam Deck matches.
- [ ] Record results (device, SteamOS version, pass/fail per row) in `docs/qa/input-matrix.md`.
