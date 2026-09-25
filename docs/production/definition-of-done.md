# Definitions of done

Owner: Producer (task level), Owner + QA lead (milestones). Gate procedures are in [gates.md](gates.md).

## Task level (OPS-0014)

A roadmap task / issue is done when **all** of these hold (the PR template `.github/pull_request_template.md`
repeats this list as checkboxes):

1. **Reviewed** — the PR is approved by someone other than the author (code, content or document).
2. **Tested** — unit tests or the golden replay for the operation are added/updated; `npx tsc --noEmit`
   and `npx vitest run` pass (including `tests/balance.test.ts`: every operation winnable by the bot at
   steady and novice pace).
3. **Strings in the string table** — no player-facing literal in `src/scenes`/`src/ui`
   (`npm run i18n:check` passes); new keys have an `en.meta.json` entry.
4. **No new lint errors** (once the PLT lint gate exists).
5. **Changelog line** — one line under *Unreleased* in the changelog for any player-visible change.
6. **Verified in a build by someone other than the author** — on the Steam `qa` branch or a local
   production build (`npx vite build`); visual changes include before/after captures
   (`node scripts/shoot.mjs`).
7. The acceptance criterion in the task line is met, and the roadmap line is marked `[x]`.

## Demo (OPS-0016)

The demo is done when:

- **Content:** Chapters I–II — op1-1…op1-5 and op2-1…op2-5 (10 operations) with the Malisons of Matins
  and Lauds — playable from the title through the demo-complete/wishlist screen, all story scenes in.
- **Systems:** tutorials for every instrument and the Litany; options (audio, video, accessibility,
  assists, language); save with Steam Cloud; controller and Steam Deck basics (Deck "Playable" or better
  on self-test); opt-in telemetry with consent; demo carry-over prepared.
- **Languages:** English plus every signed-off demo language (D-0003, LOC-0054) in menu, HUD, story
  and store; stretch languages only with a go at feature lock.
- **Quality:** 0 open S1/S2 bugs; QA sign-off on the RC; perf budgets met on min-spec (ENG targets) and
  on Steam Deck; every operation has a golden replay and calibrated ranks.
- **Store & legal:** Valve build review and store review passed for both apps; content survey and
  AI-disclosure answered; privacy notice live; counsel clearance on file for name, title and trade dress.
- **Marketing:** end-of-demo wishlist screen links the live store page; demo page shows the Download
  Demo button.

## Alpha (OPS-0020)

- All core systems feature-complete (surgery tools and ailments, Litany, scoring/ranks, save, options,
  challenge mode shell, the disciplines chosen in D-0014).
- Chapters I–V playable end-to-end with placeholder art/audio (15 new operations + 6 Malison hours).
- Every operation has a golden replay and calibrated rank thresholds; `tests/balance.test.ts` covers all.
- No S1 bugs older than one sprint. Gate review recorded in [gates.md](gates.md#alpha).

## Beta (OPS-0021)

- Content complete; final art, audio and VO integrated.
- All shipped languages in (D-0003 + IT/JA/KO) and passing `npm run i18n` with no warnings for shipped locales.
- Balance signed off by the GAM owner; achievements, Steam Cloud and Deck integration complete.
- 0 open S1. Gate review recorded.
