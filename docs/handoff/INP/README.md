# INP — tasks that need a human

- INP-0055 — Capture the real star corpus: ≥ 300 positive star strokes and ≥ 300 negatives (circles, checks, scribbles, zig-zags, stitching strokes) from ≥ 15 people on mouse, trackpad, pen and gamepad stick. Procedure and tooling: `docs/handoff/INP/star-corpus.md` (records with `?record=1`, converts with `scripts/extract-stars.mjs`, the benchmark in `tests/starBenchmark.test.ts` picks the files up automatically).
- INP-0090 — Upload and test the Steam Input action manifest: rename `steam/input/game_actions_APPID.vdf` to the real App ID, upload it in Steamworks, author the Xbox / PlayStation / generic default configurations from the tables in `steam/input/README.md` in the Steam Input configurator, export and publish them as official defaults, then check each action set (Menu, Operation, Story) in the configurator. Checklist: `docs/handoff/INP/steam-input.md`.
- INP-0091 — Build the Steam Deck default configuration on a retail Deck from the layout table in `steam/input/README.md` (the same table is shown in-game under Options → Controls → Steam Deck), set it as the official Deck default, and verify every row on LCD and OLED hardware. Checklist: `docs/handoff/INP/steam-input.md`.
- INP-0021 — Click-to-photon measurement with a 240 fps camera on the reference PCs and Deck
- INP-0023 — Profile an 8 kHz mouse on the low-spec PC
- INP-0026 — Trace-calibration playtest with 17 testers
- INP-0088 — 5-tester gamepad calibration of every Ch1–2 op
- INP-0093 — Deck Verified input checklist on LCD and OLED Decks
- INP-0094 — Deck suspend/resume manual test ×10
- INP-0099 — Device-matrix sign-off with the listed mice, pads, trackpads and tablet
- INP-0114 — Ch3–5 gesture corpus and first-try playtests
- INP-0122 — Submit for Steam Deck Verified
- INP-0123 — Remote Play check host→Deck/phone
- INP-0125 — Freeze the default bindings two weeks before launch (policy decision)
