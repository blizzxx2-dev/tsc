# Save suite (QAT-0135)

| ID | Title | Pri | Tags | Min | Steps → Expected | Auto |
|---|---|---|---|---|---|---|
| TC-SAVE-001 | Quit at every story/op boundary | P0 | full | 25 | For each of the 22 demo steps: quit to desktop at the start of the step and relaunch → Continue lands on that step (ops resume at their briefing) | e2e continue/resume (sampled) |
| TC-SAVE-002 | Best results survive restarts | P0 | full | 3 | Win op1-1 at S, quit, relaunch → Operating Theatre shows S and the score | save helper tests |
| TC-SAVE-003 | Kill during save | P0 | regression | 8 | Kill the process (Task Manager / `kill -9`) repeatedly right as a step changes → the save is either the old or the new state, never corrupt; Continue works | |
| TC-SAVE-004 | Corrupted save | P0 | regression | 4 | Replace the save with junk / truncate it → the game starts, warns once, offers a fresh start (or restores the backup), does not crash | |
| TC-SAVE-005 | Deleted save | P1 | full | 2 | Delete the save while the game is closed → fresh title state; settings are kept (separate file) | |
| TC-SAVE-006 | Steam Cloud round trip | P0 | regression | 12 | PC A: play to s1-4, quit. PC B (same account): launch → Continue at s1-4 with the same bests; play to op1-4; back on PC A → Continue at op1-4 | |
| TC-SAVE-007 | Demo → full game carry-over | P1 | full | 8 | With a demo save at the demo end, launch the full game (when available) → offers to import; Chapter III starts with demo bests kept | |
| TC-SAVE-008 | Save location and size | P2 | full | 3 | Save lives in the documented per-user folder, is < 64 KB, and is readable JSON (support can inspect it) | |
