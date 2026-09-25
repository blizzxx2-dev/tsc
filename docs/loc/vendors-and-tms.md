# Vendor selection and TMS setup (LOC-0045 … LOC-0047)

Prepared material; contracting, paid tests and TMS accounts are human steps (handoff).

## Vendor RFP (LOC-0045)
Send to **three games-specialised LSPs** by 16 Oct 2026; responses by 30 Oct; paid tests 2–13 Nov;
decision 20 Nov; contract by 27 Nov (before the 11 Dec handoff).

**RFP text**
> *Suture & Steel: The Malison Hours* — PC surgery-action game in an archaic, grimdark early-modern
> register. Demo scope: ≈ 2,750 words of game text (UI, story, callouts, barks) + ≈ 700 words store +
> ≈ 3,200 words legal (legal translator), into **DE, FR, ES-ES, PL, PT-BR** (stretch RU, ZH-Hans);
> full game ≈ 20,000 words into those plus IT, JA, KO (Beta). Format: XLIFF 1.2 with ICU MessageFormat
> placeholders, pixel budgets and context notes; TMS: Crowdin or Lokalise (we host). Please quote per
> language: translation + review per word, LQA hourly rate and estimated hours for a 60–90 min demo,
> rush/weekend rates, minimum fees, and your team's experience with period/archaic fiction. Include: NDA
> acceptance, IP assignment and TM/termbase ownership by us, LQA scope (in-context play-through,
> bug reports in our template), availability 14 Dec 2026 – 29 Jan 2027 (holiday coverage).

**Paid test:** 500 words per language — the Prologue (`prologue.*`) + op1-2 callouts
(`op1-2.p*`) + 10 UI keys, from `loc/export/*.xliff`. Pay the test at the vendor's rate.

**Blind scoring:** an independent native reviewer per language (not from any bidding LSP) scores
anonymised tests 1–5 on accuracy, register (style guide §4), terminology (termbase), fluency and
placeholder/format correctness. Weighted: register 30 %, accuracy 25 %, fluency 20 %, terminology 15 %,
format 10 %. Price breaks ties within 0.3 points.

| LSP | DE | FR | ES | PL | PT-BR | Price (demo, all core) | Total score | Notes |
|---|---|---|---|---|---|---|---|---|
| A | | | | | | | | |
| B | | | | | | | | |
| C | | | | | | | | |

**Contract:** contractor agreement + Schedule D (loc): NDA, IP assignment, TM/termbase ownership,
LQA scope and turnaround.

## TMS setup (LOC-0046)
Crowdin or Lokalise (compare: GitHub integration, ICU support with plural preview per language,
XLIFF 1.2, screenshots, TM/TB export in TMX/TBX, reviewer roles, price for ~10 languages).
- **GitHub integration** syncs the sources: `src/i18n/strings/en.json` (+ context from `en.meta.json`,
  pushed as key descriptions and max-length) and `loc/export/content.en.xliff` (story/callouts/barks).
  Translations return as **PRs** to `src/i18n/strings/<lang>.json` and `loc/content/<lang>.json` (the
  import script does the same conversion for XLIFF deliveries).
- Attach: termbase (`docs/loc/termbase.csv` → TBX import), style guide, period-medicine reference.
- Roles: translator and **reviewer (proofreader) per language**; the loc lead as manager.
- QA checks enabled: placeholders, ICU syntax, length (from `maxPx`/`charLimit`), glossary.
- Example Crowdin config (adjust paths if the TMS differs):
```yaml
project_id_env: CROWDIN_PROJECT_ID
api_token_env: CROWDIN_TOKEN
preserve_hierarchy: true
files:
  - source: /src/i18n/strings/en.json
    translation: /src/i18n/strings/%locale%.json
    type: json_icu
  - source: /loc/export/content.en.xliff
    translation: /loc/export/content.%locale%.xliff
```

## Context screenshots (LOC-0047)
QAT's localised capture run (`node scripts/shoot.mjs` / the QAT capture suite) produces one PNG per
screen (`docs/loc/screens/<scene>.png`, the path in each key's `screenshot` metadata). Upload them via
the TMS screenshot API and tag each with the keys visible on it (the `scene` field of `en.meta.json`
lists which keys belong to which screen). Automation depends on the TMS account (handoff).
