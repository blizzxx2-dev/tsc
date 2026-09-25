# Localisation budget (OPS-0035)

Owner: Loc lead; approved by the Owner **before vendor contracts are signed** (LOC-0045).

## Word counts (from `npm run i18n:wordcount`, 2026-09-25)
| Scope | Words | Source |
|---|---:|---|
| UI (menus, HUD, options, results) | 371 | `src/i18n/strings/en.json` |
| Chapter I story + operations + callouts | 1,131 | `loc/export/content.en.xliff` |
| Chapter II story + operations + callouts | 984 | 〃 |
| Names, epithets, barks (global) | 248 | 〃 |
| **Demo game text** | **2,736** | re-counted at the 11 Dec string freeze |
| Store (full-game page, demo page, capsule text, event-post template) | ≈ 700 | [docs/production/store](../store/) |
| Legal (privacy notice, consent, content warnings; EULA supplement only if D-0019 changes) | ≈ 3,200 | [docs/production/legal](../legal/) |

## Demo cost per language
Rates are games-LSP translation + review estimates, replaced by the RFP quotes (LOC-0045). Legal text is
priced at a legal translator's rate. **+20 %** covers LQA fixes and late changes, as the task requires;
the native LQA play-through (≈ 16 h per language) is quoted separately by the vendor and sits inside the
same +20 % unless the quote exceeds it.

| Language | Game + store words | Rate (USD/word) | Game + store | Legal (3,200 words @ 0.20) | Subtotal | +20 % LQA & late changes | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| de | 3,436 | 0.14 | 481 | 640 | 1,121 | 224 | 1,345 |
| fr | 3,436 | 0.14 | 481 | 640 | 1,121 | 224 | 1,345 |
| es-ES | 3,436 | 0.13 | 447 | 640 | 1,087 | 217 | 1,304 |
| pl | 3,436 | 0.11 | 378 | 640 | 1,018 | 204 | 1,222 |
| pt-BR | 3,436 | 0.11 | 378 | 640 | 1,018 | 204 | 1,222 |
| **Core set total** | | | | | | | **6,438** |
| ru (stretch) | 3,436 | 0.10 | 344 | 640 | 984 | 197 | 1,180 |
| zh-Hans (stretch) | 3,436 | 0.13 | 447 | 640 | 1,087 | 217 | 1,304 |
| **Stretch total (only on a go)** | | | | | | | **2,484** |

Plus vendor test translations (3 LSPs × 5 languages × 500 words ≈ USD 1,050) and the TMS subscription
(≈ USD 150/month). The budget model carries these as separate rows.

## Full game (Beta)
Estimated 20,000 words for Chapters I–V, codex, achievements, challenge mode and disciplines (re-counted at
Alpha). Beyond-demo words for the five core languages and the two stretch languages, plus the full game
for IT, JA and KO: ≈ USD 27,900 including the TMS — see the `1.0` rows of `budget-model.csv`.

## Incremental quotes
After each handoff run `node scripts/i18n/wordcount.mjs --baseline`; the next run reports only new or
changed words, which is what the vendor quotes against.
