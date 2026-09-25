# Front-end suite (QAT-0131)

| ID | Title | Pri | Tags | Min | Steps → Expected | Auto |
|---|---|---|---|---|---|---|
| TC-FE-001 | New game from a fresh install | P0 | smoke,regression | 4 | Delete saves (`preset fresh`), launch → title shows *Take the Oath*, no Continue → click it → prologue starts at line 1; save progress = chapter 1 step 0 | e2e new-game flow |
| TC-FE-002 | Continue after quitting mid-chapter | P0 | smoke,regression | 4 | Play to s1-3, quit to desktop, relaunch → title shows *Continue* first → it lands on s1-3 | e2e continue/resume |
| TC-FE-003 | New game over an existing save asks first | P0 | full | 3 | With progress, *Take the Oath Anew* → confirmation → *No* returns; *Yes* restarts at the prologue and keeps best ranks in the Operating Theatre | |
| TC-FE-004 | Chapter select lists only reached chapters | P1 | full | 4 | `preset ch2-start` → chapter select shows I and II, II starts at s2-1; fresh save shows I only (UIX chapter select) | |
| TC-FE-005 | Operating Theatre replays reached operations | P0 | regression | 5 | `preset pre-lauds` → Operating Theatre lists op1-1 … op2-4 with best rank/score; op2-5 absent; picking one plays briefing → op → results → back to the list | |
| TC-FE-006 | Options entry and exit from title and pause | P0 | smoke,regression | 3 | Title → Options → Back returns to title; in an op, Esc → Options → Back returns to the paused op with the same state | e2e options persistence |
| TC-FE-007 | Credits reachable and complete | P2 | full | 4 | Title → Credits → scrolls to the end, lists OFL font credits and third-party licences; Esc returns | |
| TC-FE-008 | Quit from the title | P1 | full | 2 | Title → Quit (desktop build) closes cleanly; relaunch keeps settings and progress | |
| TC-FE-009 | Demo ribbon visible | P1 | full | 2 | Title and demo-end show the DEMO ribbon/label; version string shows build id | |
| TC-FE-010 | Owned-full-game title state | P2 | full | 5 | On an account owning the full game, the demo title shows the "You own the full game" state and the store link opens the owned page | |
| TC-FE-011 | Keyboard, mouse and controller navigate every front-end screen | P1 | regression | 6 | Title, options, chapter select, Operating Theatre, results: arrows/Enter/Esc, mouse and a controller all work; focus is always visible | |
| TC-FE-012 | Fullscreen toggles | P1 | full | 3 | F11 and Alt+Enter toggle fullscreen on title and in an op; canvas stays 16:9 and sharp | |
