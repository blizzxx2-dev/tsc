# Steam demo page and store setup (OPS-0084 … OPS-0090)

## Demo page copy (English source; LOC-0071 localises it)
<!-- loc:start -->
**App name:** Suture & Steel: The Malison Hours Demo

**Short description (177 characters):** Free demo: Chapters I–II. Ten operations, two Malison hours —
Matins and Lauds — and your first nights at the Hospice of Saint Ildra. Wishlist the full game to follow
the Hours.

**About the demo:** Play the first two chapters of *Suture & Steel*: stitch knife wounds from the
Gilded Goose, free barbed arrows from a militiaman, lance plague buboes in the Tanners' Rows, and face
the first two Malisons — the living curses of Matins and Lauds. The full game continues with five
chapters and eight Malison hours. **Wishlist it now** to hear when the next Hour begins.
<!-- loc:end -->

**"FREE DEMO" capsule banner text** (LOC-0072): "FREE DEMO" — per language ≤ 12 characters, uppercase
where the script has case, delivered to ART with the localised capsule variants.

## Demo system requirements — draft (OPS-0084)
From the ENG performance targets; **to be confirmed by the QAT lab sweep** before submission.

| | Minimum | Recommended |
|---|---|---|
| OS | Windows 10 64-bit; Ubuntu 22.04 / SteamOS 3 | Windows 11 64-bit |
| Processor | Intel Core i3-6100 / AMD Ryzen 3 1200 | Intel Core i5-8400 / AMD Ryzen 5 2600 |
| Memory | 4 GB RAM | 8 GB RAM |
| Graphics | WebGL2/OpenGL ES 3.0-capable GPU with D3D11 drivers: Intel UHD 620, NVIDIA GTX 750 Ti, AMD Radeon R7 260X | NVIDIA GTX 1060 / AMD RX 580 |
| Storage | 500 MB available space | 500 MB |
| Additional notes | 1280×720 minimum resolution; mouse recommended; controller supported | |
macOS: only if a Mac build ships (PLT decision).

## Store settings for both apps (OPS-0085)
| Field | Full game | Demo |
|---|---|---|
| Supported languages | Interface + Subtitles: EN + every signed-off language (docs/loc/languages.md); Full Audio: EN | same |
| Content descriptors | Frequent Violence or Gore; General Mature Content (+ survey text) | same |
| Controller support | Partial Controller Support (upgrade to Full when UIX/INP completes) | same |
| Steam Deck | Self-report after test; target "Playable" for the demo | same |
| Steam Cloud | Yes | Yes |
| Achievements | at 1.0 | none (Should) |

## Publishing the demo page (OPS-0086)
Checklist: demo description and ≥ 5 screenshots uploaded → "Download Demo" button visible on the
main page → demo release date set to 15 Feb 2027 → both pages submitted for Valve review ≥ 6 business
days before the date (buffered) → approved.

## Capsule people test (OPS-0087)
Protocol: 30 people outside the team (Discord members after announce, friends of friends; no devs).
Show a 3-second flash of a Steam-like grid with our small capsule (231×87) among 8 competitor capsules
from the dark-fantasy/horror/indie shelf, positions randomised. Ask: "What was the game with <colour>
about?" — open answer. Pass if **≥ 70 % say "surgery" or "dark fantasy"** (or synonyms: doctor,
operation, medieval horror). Otherwise iterate with ART and re-test with 30 new people. Record answers
in `store/capsule-test-<date>.csv`.

## Weekly store-traffic review (OPS-0088)
Every Friday from the page going live, before the status note: Steamworks → Traffic → UTM and
Wishlist reports: impressions, visits (click-through rate = visits/impressions), wishlists added
(wishlist rate = wishlists/visits). Record in the status note. **Rule:** if the visit rate stays below
the genre median for three consecutive weeks (Steamworks shows percentile vs similar games), test a
new small capsule or short description for two weeks (one change at a time) and compare.

## Curator Connect (OPS-0089)
Build a list of ~50 curators (horror, indie, medical sim, dark fantasy) from Steam curator search,
checking recent activity and follower counts; send demo access via Curator Connect at the press
preview (8 Feb) and full-game keys at the review-copy wave. Track coverage in `store/curators.csv`
(name, followers, focus, sent, reviewed, link).

## 1.0 page update (OPS-0090)
At launch minus 2 weeks+: price and discount, release date, launch trailer, refreshed ART screenshots,
achievements count, Deck status, updated feature bullets; submit for review ≥ 2 weeks before launch.
