# Steam edge-case suite (QAT-0139)

| ID | Title | Pri | Tags | Min | Steps → Expected | Auto |
|---|---|---|---|---|---|---|
| TC-STEAM-001 | Steam offline mode | P0 | full | 5 | Put Steam in offline mode, launch → the demo runs, saves locally, no error dialogs; back online the Cloud sync completes | |
| TC-STEAM-002 | Launch outside Steam | P0 | regression | 3 | Start the executable directly → it restarts through Steam (SteamAPI_RestartAppIfNecessary) and runs | |
| TC-STEAM-003 | Overlay disabled | P1 | full | 3 | Disable the in-game overlay → the game runs; the wishlist button falls back to the client/browser | |
| TC-STEAM-004 | Big Picture mode | P1 | full | 5 | Launch from Big Picture → controller navigation works on every front-end screen; the on-screen keyboard is never required | |
| TC-STEAM-005 | Steam Deck gaming mode | P0 | regression | 10 | Launch on Deck in gaming mode → default controls work for menus, stitching, star gesture; text legible at 1280×800; suspend/resume mid-op resumes paused | |
| TC-STEAM-006 | Cloud conflict dialog | P1 | full | 8 | Play offline on two machines, then go online → Steam shows the conflict dialog; either choice leads to a loadable save | |
