# Demo-end suite (QAT-0138)

| ID | Title | Pri | Tags | Min | Steps → Expected | Auto |
|---|---|---|---|---|---|---|
| TC-END-001 | Demo-complete scene after s2-end | P0 | smoke,regression | 4 | `preset pre-lauds`, win op2-5, read s2-end → the demo-complete screen appears with the case ledger (best ranks for all 10 ops) | visual suite (demo-end) |
| TC-END-002 | Wishlist with the Steam overlay on | P0 | regression | 3 | Click *Wishlist on Steam* → the overlay opens on the game's store page; closing it returns to the demo-end screen | |
| TC-END-003 | Wishlist with the overlay off | P0 | full | 3 | Disable the overlay → the button opens the store page in the Steam client or default browser | |
| TC-END-004 | No route reaches Chapter III | P0 | regression | 5 | From the demo end: Continue, chapter select, Operating Theatre and the console-free UI never start Chapter III content; title shows "The demo is complete" | demo bundle check (PLT) |
| TC-END-005 | Replay ops from the summary | P1 | full | 4 | From the demo end / Operating Theatre replay op1-3 → briefing → op → results → back; bests update | |
| TC-END-006 | Relaunch after finishing | P1 | full | 2 | Quit on the demo end, relaunch → title in the completed state; Operating Theatre lists all 10 ops | e2e presets (demo-complete) |
