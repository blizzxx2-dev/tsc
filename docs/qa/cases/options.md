# Options suite (QAT-0136)

For every option: change it, confirm it applies **immediately**, restart the game, confirm the value is kept and
still applied. Minutes are for the whole row.

| ID | Title | Pri | Tags | Min | Steps → Expected | Auto |
|---|---|---|---|---|---|---|
| TC-OPT-001 | Audio buses | P0 | regression | 5 | Master, music, SFX, voice sliders each change only their bus, 0 % is silent; persists | e2e options (master volume, mute) |
| TC-OPT-002 | Display mode | P0 | full | 4 | Windowed / borderless / fullscreen switch without restart, canvas stays 16:9; persists | |
| TC-OPT-003 | Render scale | P1 | full | 3 | 50–100 % visibly changes sharpness and frame time; persists | |
| TC-OPT-004 | Frame cap | P1 | full | 3 | 30/60/120/uncapped caps frame rate (Steam FPS counter); persists | |
| TC-OPT-005 | Screen shake | P1 | full | 3 | Off / Gentle / Full: Malison splitting and hurts shake accordingly (none when Off); persists | e2e options |
| TC-OPT-006 | Reduce flashing | P0 | regression | 3 | On: low-vitals pulse and Litany ripple are softened; persists | e2e options |
| TC-OPT-007 | Text size | P1 | full | 4 | Each size applies to callouts, story box and menus without clipping; persists | |
| TC-OPT-008 | Gore level | P1 | full | 4 | Each level changes blood/wound presentation only, never gameplay; persists | |
| TC-OPT-009 | Assists | P0 | regression | 5 | Time allowed ×1.5/×2 lengthens the timer; Litany on Space works; results show "(assisted)"; persists | e2e options (timer assist) |
| TC-OPT-010 | Language | P0 | regression | 4 | Switching language re-lays out the current screen immediately; persists | e2e language switch (LOC) |
| TC-OPT-011 | Key bindings | P0 | regression | 6 | Rebind each tool and the Litany; conflicts are refused or swapped; reset to defaults works; persists | |
| TC-OPT-012 | Decimal and locale safety | P1 | full | 3 | With OS format tr-TR / de-DE, change volume and restart → values unchanged (no comma decimals in settings) | e2e OS locales |
