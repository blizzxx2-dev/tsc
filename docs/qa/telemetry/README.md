# Telemetry (opt-in, local-only scaffolding)

Code: `src/telemetry/`. Schema: `src/telemetry/schema.ts`, published as `events.v1.schema.json` (this folder,
regenerate with `npm run telemetry:schema`; a unit test fails if they drift). Tests: `tests/unit/telemetry/`.

## Privacy rules

- **Opt-in.** Nothing is recorded until consent is granted (the consent prompt is UIX/PLT's; testers use the console:
  `telemetry on`). Declining clears anything queued.
- **Local only (today).** Batches go to a `LocalTransport` in localStorage (`telemetry dump` in the console shows them).
  The ingest backend (QAT-0096) is a hand-off; until then nothing leaves the machine.
- No free text from the player, no IP addresses, no hardware serials; positions are quantised to 32 px; the install id
  is a random UUID the player can reset (`resetInstallId()`, which also clears queued events).
- Every event carries `flavour` (`dev`, `qa`, `playtest`, `release`) so dashboards can exclude non-player data
  (QAT-0099: the backend routes non-release flavours to a staging dataset).

## Event schema v1 (QAT-0094)

Envelope: `schema`, `event`, `ts` (ISO), `session` (UUID per launch), `install` (resettable UUID), `seq`, `build`,
`flavour`, `props`. Unknown fields and missing required fields are rejected (`additionalProperties: false`).

| Event | Props | Emitted when |
|---|---|---|
| `session_start` | os, gpuFamily, locale, edition, viewport | launch (after the kill-switch config is read) |
| `consent_answered` | granted | the player answers the telemetry prompt |
| `title_view` | firstThisSession | the title screen appears |
| `new_game` | replacedSave | the prologue starts from the title |
| `chapter_start` | chapter | a chapter's first story step starts |
| `op_start` | op, attempt, assists | an operation leaves its intro |
| `op_end` | op, result (won/lost/quit), rank, score, duration, minVitals, counts, maxCombo, litanyUsed, tinctures, assists | the operation ends or is abandoned |
| `op_fail` | op, reason (vitals/timer/quit), phase, liveKinds | with every non-won `op_end` |
| `rating` | op, tool, entity, label, rating, x, y (32 px grid) | every COOL/GOOD/BAD/MISS |
| `tool_select` | op, tool | the instrument changes during an operation |
| `story_skip` | story, line, lines | a story scene is left before its last line |
| `settings_changed` | changes | any option changes |
| `demo_end_view` | — | the demo-complete screen appears |
| `wishlist_click` | source | the wishlist button opens the store page |
| `quit` | scene, sessionSeconds | the page/app is closed |

Batching (QAT-0097): flush every 60 s and on quit, offline queue capped at 1 MB (oldest dropped), exponential backoff
2 s → 5 min on failed sends; observing costs < 0.1 ms per frame (measured in the unit test).
Kill switch (QAT-0098, client side): a `{ enabled, disabledEvents }` document read once per session start can turn
everything or single events off; today it is read from local storage (`suture-and-steel.telemetry.config`), and from
`VITE_TELEMETRY_CONFIG_URL` once the backend exists.

## Demo funnel (QAT-0101)

Each step is exactly one event; a player's furthest step is the last one seen for their install id.

| # | Step | Event (and filter) |
|---|---|---|
| 1 | Launch | `session_start` |
| 2 | Consent answered | `consent_answered` |
| 3 | Title | `title_view` (`firstThisSession`) |
| 4 | New game | `new_game` |
| 5 | op1-1 started | `op_start` (`op = op1-1`) |
| 6 | op1-1 won | `op_end` (`op = op1-1`, `result = won`) |
| 7–14 | op1-2 … op1-4 started / won | `op_start` / `op_end won` per op |
| 15 | Matins won | `op_end` (`op = op1-5`, `result = won`) |
| 16 | Chapter II started | `chapter_start` (`chapter = 2`) |
| 17–24 | op2-1 … op2-4 started / won | `op_start` / `op_end won` per op |
| 25 | Lauds won | `op_end` (`op = op2-5`, `result = won`) |
| 26 | Demo end shown | `demo_end_view` |
| 27 | Wishlist clicked | `wishlist_click` |

Note: players who decline consent are invisible after step 2 by design; report the consent rate beside the funnel.
Dashboards (QAT-0102…0108) and the backend (QAT-0096, 0098 endpoint, 0099, 0100) are hand-offs — see
`docs/handoff/QAT/`.
