# Title, trademark and brand (prepares OPS-0058 … OPS-0062)

**Status: preparation for counsel and the Owner — not legal advice.** Filings, payments and account
registrations are human actions listed in `docs/handoff/OPS/README.md`.

## Marks to clear (OPS-0058)
| Mark | Type | Classes (Nice) | Notes |
|---|---|---|---|
| **Suture & Steel** | word | 9 (downloadable game software), 41 (online game services, entertainment), 28 (only if physical merchandise/board game is planned) | Primary title |
| Suture and Steel | word (variant) | 9, 41 | Searched as a variant; not filed separately unless counsel advises |
| The Malison Hours | word | 9, 41 | Subtitle; search only — filing optional |
| Logo (ART) | figurative | 9, 41 | File only if the final logo is distinctive (ART delivery) |

### Knock-out search checklist (first pass; counsel then gives the written clearance opinion)
Search each mark exactly, without "&"/"and", and phonetic/visual variants ("Suture n Steel", "Sutures &
Steel", "Steel & Suture"):
- [ ] USPTO Trademark Search (tmsearch.uspto.gov) — classes 9, 28, 41, live and dead marks
- [ ] EUIPO eSearch plus (euipo.europa.eu) — EU marks; also TMview for national EU marks
- [ ] UKIPO trade mark search
- [ ] WIPO Global Brand Database (Madrid designations)
- [ ] J-PlatPat (Japan) and KIPRIS (Korea) — important given Atlus/SEGA's home market and the KO release
- [ ] Steam store, itch.io, Epic, GOG, Nintendo eShop, PlayStation Store, Xbox store, App Store, Google Play
- [ ] Web and social: exact-phrase search, domain WHOIS, handles on X/Bluesky/YouTube/TikTok/Reddit/Discord
Record each result (date, database, query, hits, relevance) in `docs/legal/trademark-search-<date>.md`.

## Fallback title shortlist (OPS-0059)
Pre-screen each with the same knock-out list so a late conflict does not stall the announce. The
subtitle *The Malison Hours* is kept in every option.
| # | Title | Why it fits | Pre-screen result |
|---|---|---|---|
| 1 | **Gut & Cautery** | Two period instruments, same "X & Y" rhythm as the primary | pending search |
| 2 | **The Lancet Hours** | Ties the instrument to the canonical-hours device | pending search |
| 3 | **Tallow & Thread** | Material honesty pillar (candle-lit surgery, gut thread) | pending search |

## Filings (OPS-0060)
Before the public announce (17 Nov 2026): file **"Suture & Steel"** word mark with **EUIPO** and
**USPTO** in classes 9 and 41 (and the logo if distinctive). Receipts and application numbers go to
`docs/legal/` (a private folder if the repository becomes public). Budget: EUIPO ≈ USD 1,150 for up to
three classes, USPTO USD 350 per class, plus counsel time — see the budget model.

## Domains and handles (OPS-0061)
Register to the **company** account (role mailbox, 2FA, two admins — [account-security.md](../account-security.md)):
| Asset | Preferred | Alternates |
|---|---|---|
| Domain | suture-and-steel.com | sutureandsteel.com, suture-and-steel.de / .eu / .co.uk (chosen ccTLDs) |
| Steam developer / publisher name | "<Company name>" | — |
| X | @SutureAndSteel | @SutureSteelGame |
| Bluesky | @sutureandsteel.com (domain handle) | @sutureandsteel.bsky.social |
| YouTube | @SutureAndSteel | |
| TikTok | @sutureandsteel | @sutureandsteelgame |
| Reddit | r/SutureAndSteel (+ u/SutureAndSteelDev) | |
| Discord vanity URL | discord.gg/sutureandsteel (needs server boost level 3 or partner) | invite link until then |

## Rebrand audit outside code (OPS-0062)
Audit run 2026-09-25 with `grep -ri "grim apothecary\|grim-surgeon\|grim-apothecary"` over the repository
(excluding `node_modules`):
- **Documents:** no occurrences outside roadmap task text that *describes* the legacy identifiers
  (PLT-0002/0077/0081, OPS-0062). All production, store and press drafts in `docs/production/` read
  "Suture & Steel — The Malison Hours".
- **Store drafts, press assets:** [../store/store-page.md](../store/store-page.md), [../marketing/press-kit.md](../marketing/press-kit.md) — correct title.
- **Code identifiers** (package name, save key, `<title>`): owned by PLT-0077/0081.
- **Outside the repository** (human check, handoff): Steamworks app names for the full-game and demo
  apps, social bios, Discord server name, newsletter sender name, any pitch decks or emails already sent.
