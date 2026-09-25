# Localisation process: schedule, queries, builds, LQA, sign-off (LOC-0049 … LOC-0055, LOC-0098, LOC-0104 … LOC-0109)

Owner: Loc lead.

## Demo schedule (LOC-0049)
| Step | Dates | Notes |
|---|---|---|
| NAR demo script lock = UI string freeze = **handoff** | **Fri 11 Dec 2026** | `npm run i18n:export -- --lang <code>` per language; `npm run i18n:wordcount -- --baseline` after sending |
| Translation (3 weeks + 1 holiday week) | 14 Dec 2026 – 8 Jan 2027 | Queries answered within 48 h (below), except 24 Dec – 1 Jan (72 h) |
| Import + automated checks | 11 Jan | `npm run i18n:import -- …`, then `npm run i18n` |
| LQA (2 weeks) | 11 – 22 Jan | On the Steam `loc` branch |
| Fixes (1 week) | 25 – 29 Jan | Regression spot-check on changed keys |
| **All complete** | **29 Jan 2027** | ≥ 1 week before the 8 Feb press preview |
| Sign-offs | by 1 Feb | Unsigned languages are hidden (D-0015) |

## Full-game schedule (LOC-0098)
Handoff on the NAR full-game script lock **and** UI string freeze, **30 Jul 2027**; translation 4 weeks
(to 27 Aug), LQA 2 weeks (to 10 Sep), fixes 1 week — **done 3 Sep–10 Sep**, i.e. ≥ 3 weeks before the
24 Sep RC gate. IT/JA/KO (full game) start on the same date with a 5-week translation window.

## Translator query sheet (LOC-0050)
- Queries are asked **in the TMS** on the string (comment with the `query` label), never by email.
- **SLA: 48 hours** for an answer from the loc lead or the writer (NAR) — the loc lead triages daily.
- Every answer that clarifies meaning is **promoted into the key's note**: UI keys → the `note` field in
  `src/i18n/strings/en.meta.json`; content lines → a NAR translator note (exported as `<note from="translator">`).
  The query is then resolved in the TMS, so no translator asks it twice.

## Continuous loc builds (LOC-0051)
Nightly: the TMS integration opens a PR with the latest **approved** translations; CI runs `npm run
i18n`; on green, PLT's pipeline builds and pushes to a **password-protected Steam `loc` branch** for
reviewers. (TMS + SteamPipe setup is a handoff item; the checks exist.)

## LQA checklist and bug template (LOC-0052)
Reviewers play every screen in the `loc` build and check:
- [ ] **Truncation / overflow** — text within its panel; `npm run i18n:widths` has already flagged pixel overflows
- [ ] **Overlap** with other UI or art
- [ ] **Termbase** — approved terms used (validate report); names per the proper-name policy
- [ ] **Grammar / agreement** — gender (patients via `gender` select), plurals (Polish four forms), cases
- [ ] **Register** — style guide §4 (Ihr/vous/vos/o senhor…); period medicine, no banned modern terms
- [ ] **Fallback glyphs** — no tofu/boxes; mixed fonts noticed (glyph report)
- [ ] **Untranslated text** — English showing in a translated build (key, or content not yet localised)
- [ ] **Placeholders** — no `{name}` or raw keys on screen; numbers formatted for the locale
- [ ] **Punctuation** — FR spacing, ES ¿¡, quotation marks per language
Bugs use the GitHub issue form `.github/ISSUE_TEMPLATE/loc-bug.md` (labels `loc` + `lang:<code>`).
**Severity mapping** to the QA taxonomy: S1 = text blocks progress or is offensive/legal risk (wrong
content warning, slur); S2 = meaning wrong or unreadable on a common path, truncation hiding meaning,
missing glyphs; S3 = grammar/register/termbase errors; S4 = style preferences.

## LQA navigation (LOC-0053)
Reach any Ch I–II line in ≤ 30 s:
- Language: **Options → Language** (also in the pause menu → Options) or URL/launch option `?lang=<code>`.
- Operations: `?op=<opId>` (e.g. `?op=op1-3`) opens the briefing; the **Operating Theatre** lists all
  reached operations.
- Story scenes and operation phases: the ENG dev console commands `story <id>`, `op <id>`, `phase <n>`
  (ENG dev console task) — **pending ENG**; until then the Operating Theatre + `?op=` cover operations.
- Timing check: 10 random keys from `loc/export/content.en.json`, each reached in ≤ 30 s (handoff LOC-0053).

## Per-language demo sign-off (LOC-0054)
The lead reviewer copies [signoff/TEMPLATE.md](signoff/TEMPLATE.md) to `docs/loc/signoff/<code>-demo.md`
and signs it. Only then may the loc lead set `shipped: true` for that locale in `src/i18n/locales.ts`
(`tests/i18n.test.ts` fails if a locale is shipped without its sign-off file, or has one but is not
shipped) and tick the language in Steamworks. Languages without sign-off stay hidden from the language
menu and the Steamworks list (decision D-0015).

## Translation-memory ownership (LOC-0055)
On the first working day of each month, export from the TMS: **TMX** (translation memory, all
languages) and **TBX** (termbase) into `loc/tm/<yyyy-mm>/` via a PR. Vendor contracts state the studio
owns the TM and termbase (contractor agreement Schedule D).

## Post-launch (LOC-0104 … LOC-0109)
- **Patch notes (LOC-0104):** template below; English notes are published with the patch, translations
  within **48 h** in every shipped language.
- **String pipeline (LOC-0105):** patch/update strings batched **weekly** into one TMS handoff; new
  content ships localised on day one — never English-first.
- **LQA regression (LOC-0106):** each patch touching text gets a spot-check per language on the changed
  keys (`wordcount` delta lists them) before release.
- **Community translations (LOC-0107):** a public TMS project for fan languages (e.g. UK, TR, CS, HU)
  under a contributor licence agreement; shipped labelled "community" after moderator review.
- **Language review (LOC-0108):** at launch + 3 months, sales and wishlists by language decide new
  languages (e.g. Latin-American Spanish, Traditional Chinese).
- **DLC/free updates (LOC-0109):** every update ships in all 1.0 languages on day one; loc budget and
  schedule added to each update's plan.

### Patch-notes template (LOC-0104)
```
# Suture & Steel — patch {version} ({date})
## Fixes
- {fix, player-facing wording}
## Changes
- {change}
## Known issues
- {issue}
```
Keep each bullet one sentence; no internal ids; the same bullet order in every language.
