# Tutorial suite (QAT-0134)

One row per tool tutorial (UIX): Lancet, Tongs, Leech-Pipe, Gut Thread, Saint's Salve, Tincture, Cautery Brand,
Scrying Lens, plus the Litany star. Minutes are per tutorial.

<!-- multiplier: 9 -->

| ID | Title | Pri | Tags | Min | Steps → Expected | Auto |
|---|---|---|---|---|---|---|
| TC-TUT-001 | Tutorial completes | P0 | regression | 2 | First use of the tool → the tutorial prompt explains the gesture; performing it correctly completes the step and the op continues | |
| TC-TUT-002 | Tutorial can be failed and retried | P0 | full | 2 | Do the gesture wrongly (e.g. stitch across blood, pull an un-nicked barb) → a hint explains why; retrying succeeds | tool matrix |
| TC-TUT-003 | Skippable on replay | P1 | full | 1 | Replay the op from the Operating Theatre → tutorial prompts are skipped or can be skipped with one input | |
| TC-TUT-004 | Glyphs follow the last device | P0 | regression | 2 ×1 | Use the mouse → prompts show mouse glyphs; touch a controller/Deck control → prompts switch to that device's glyphs within one prompt | |
