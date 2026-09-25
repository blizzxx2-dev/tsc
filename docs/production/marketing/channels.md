# Owned channels: website, newsletter, social (OPS-0094 … OPS-0096)

## Website (OPS-0094)
Single landing page at `suture-and-steel.com` (static hosting):
- Hero: key art, logo, **Steam wishlist widget** (loaded on click only — [website consent](../legal/README.md#website-consent-ops-0070)), announce trailer (YouTube privacy-enhanced embed, click-to-load).
- Newsletter signup (double opt-in, privacy-notice link).
- Links: press kit (`/press`), privacy notice (`/privacy`), Discord, socials, streaming policy, FAQ.
- No tracking cookies; cookieless first-party page counts only.
- **Acceptance:** Lighthouse performance **and** accessibility ≥ 90 on mobile and desktop (run in CI or
  by hand before each publish; store the report with the release).

## Newsletter (OPS-0095)
- Provider with double opt-in, EU data region and a DPA (see [ropa.md](../legal/ropa.md)).
- Welcome email (sent on confirmation):
  <!-- loc:start -->
  > **Subject:** Welcome to the Hospice
  > Thank you for signing up. You'll hear from us only when something happens: the trailer, the free
  > demo for Steam Next Fest in February, and launch. In the meantime, the hospice's Discord is open:
  > [link]. If you'd like to help us most, wishlist the game on Steam: [link]. — The Suture & Steel team
  <!-- loc:end -->
- Scheduled sends: **announce** (17 Nov 2026), **Next Fest** (demo live 15 Feb 2027 + festival start
  22 Feb), **launch** (21 Oct 2027); at most one extra send per quarter.
- Subscriber count goes into the weekly status note.

## Social cadence (OPS-0096)
Channels: X, Bluesky, YouTube Shorts, TikTok, Reddit (r/SutureAndSteel + relevant subreddits within
their self-promotion rules). **Three posts a week**, scheduled **two weeks ahead** in a scheduling tool,
using the ART social kit (templates, safe crops, watermark):
| Day | Post type | Example |
|---|---|---|
| Tuesday | **Operation GIF** (6–10 s, subtitled) | "Nick the barbs twice, then pull. Cleanly." — barbed arrow extraction |
| Thursday | **Lore snippet** (painting + 1–3 lines) | "The Ash Tribunal keeps a ledger of every miracle performed in Kessendorf. Yours is growing." |
| Saturday | **#screenshotsaturday** dev note | Before/after of the flesh shader; the tool tray in brass |

### First two weeks after announce (drafts)
| Date | Channel(s) | Post |
|---|---|---|
| Tue 17 Nov 2026 | all | Announce trailer + wishlist link |
| Thu 19 Nov | X, Bluesky | Lore: "In Kessendorf, the pyres outside the east gate have not gone out since autumn." + hospice painting |
| Sat 21 Nov | X, Bluesky, Reddit | #screenshotsaturday: op1-1 stitched incision close-up |
| Tue 24 Nov | all | GIF: leech-pipe draining a blood pool |
| Thu 26 Nov | X, Bluesky | Lore: Sister Ilse — "I keep the instruments, the ledgers, and the Master's temper." |
| Sat 28 Nov | X, Bluesky, Reddit | #screenshotsaturday: the Litany ripple in sepia |
Posting is a human task; the calendar lives in the scheduling tool once accounts exist.
