# Story suite (QAT-0132)

Scenes: prologue, s1-2, s1-3, s1-4, s1-5, s1-end, s2-1, s2-2, s2-3, s2-4, s2-5, s2-end.

| ID | Title | Pri | Tags | Min | Steps → Expected | Auto |
|---|---|---|---|---|---|---|
| TC-STORY-001 | Advance line by line | P0 | smoke,regression | 3 | Prologue: click/Space/Enter first completes the typewriter, then advances; each line shows once, in order | e2e new-game flow |
| TC-STORY-002 | Fast-forward with Ctrl | P1 | full | 2 | Hold Ctrl in s1-2 → text types 8× faster and auto-advances; releasing stops | |
| TC-STORY-003 | Skip a scene | P0 | regression | 2 | Esc (and the Skip button) in s1-3 → goes straight to the op1-3 briefing; save advances | |
| TC-STORY-004 | Auto mode | P1 | full | 3 | Toggle Auto in s2-1 → lines advance after reading time; any input stops Auto | |
| TC-STORY-005 | Backlog | P1 | full | 3 | Open the backlog mid-s1-4 → shows every previous line with speaker; closing resumes on the same line | |
| TC-STORY-006 | Choices and flags | P1 | full | 4 | At each choice (NAR), each option leads to its branch; the flag persists across save/reload (check with the console `json`) | |
| TC-STORY-007 | Speaker plates | P1 | full | 4 | Every speaker shows the right name plate, colour and portrait (Kreuzer, Ilse, Haller, Stroh, Mauer, patients using `as`, narrator with no plate, the Choir as "???") | story-data test |
| TC-STORY-008 | END OF CHAPTER I card | P0 | regression | 3 | Finish op1-5 → s1-end ends on "END OF CHAPTER I — THE HOUR OF MATINS" card → Chapter II begins at s2-1 | story-data test |
| TC-STORY-009 | END OF CHAPTER II card | P0 | regression | 3 | Finish op2-5 → s2-end ends on "END OF CHAPTER II — THE HOUR OF LAUDS" → demo-complete screen | story-data test |
| TC-STORY-010 | Every backdrop renders | P2 | full | 6 | Visit each story scene (console `story <id>`): hospice, street, chapel, night, camp backdrops draw without artefacts | visual suite (story-prologue) |
| TC-STORY-011 | Long lines fit the box | P1 | full | 5 | Longest line per scene fits the text box at 1280×720 and 1920×1080, all text sizes | |
