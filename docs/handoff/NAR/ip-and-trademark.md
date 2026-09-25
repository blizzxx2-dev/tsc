# IP and trademark items that need a human (NAR-0020, NAR-0022, NAR-0026)

Desk checks were done by the narrative workstream (web searches, 2026-09-25) and logged in
`docs/narrative/names.csv` (checker `CL` = desk check, not legal clearance). Counsel's wider review
is `docs/production/legal/ip-name-review.md` (OPS-0052). What remains needs a trademark search in
the relevant classes (9 — software; 41 — entertainment; 28 — games) and a lawyer's sign-off.

## NAR-0020 — "Hollow Choir"
- Known uses: *The Hollow Choir*, a free 5e monster on itch.io (longislanddungeonmaster.itch.io);
  a novel of the same title; *the Choir* faction in *Hollow Knight: Silksong*.
- **Decision recorded:** keep "the Hollow Choir" unless the class 9/41 search finds a registered mark.
  **Fallback pre-approved: "the Unsung".** The find-and-replace is mechanical: `Hollow Choir` → `Unsung`
  in `src/content/*.ts` and `docs/narrative/*` (grammar: "the Hollow Choir" → "the Unsung"; "Choir"
  alone stays as the common noun). `node scripts/narrative-lint.mjs` and `npx vitest run` must pass after.
- **Human:** run the search; record result and date in `names.csv` (`status` → clear/renamed).

## NAR-0022 — title, subtitle and tagline
- "Suture & Steel": no game of that title found (web search).
- **Risk found:** *Malison: The Cursed City*, a dark-fantasy survival-horror RPG published by
  Devolver Digital (announced), shares the word **Malison** with our subtitle *The Malison Hours* and our
  boss term. "Malison" is an archaic dictionary word (a curse), so the boss term is low risk, but a
  subtitle in the same genre and store category may draw a confusion objection.
- Store tagline in use: see `docs/production/store/store-page.md`; it does **not** echo
  "A Grim World of Perilous Adventure" (checked; the lint also bans that phrase in strings).
- **Human:** trademark search on "Suture & Steel" and "Malison" (classes 9/28/41), and a decision on
  the subtitle. Pre-cleared alternatives if needed: *Suture & Steel: The Canonical Hours*,
  *Suture & Steel: The Office of Hours*, *Suture & Steel: Litany of Stillness*.

## NAR-0026 — legal sign-off record (Release)
- Freeze `docs/narrative/names.csv` at the release commit; counsel adds reviewer name, date and
  outcome per row; attach to the release checklist (`docs/release.md`).
