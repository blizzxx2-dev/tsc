# Marketing art

| Deliverable | Task | Where |
| --- | --- | --- |
| Announce trailer beat sheet | ART-0332 | [announce-trailer.md](announce-trailer.md) |
| Trailer capture scene list (seeds, replays) | ART-0334 | [capture-list.md](capture-list.md) |
| Trailer title card and end slates | ART-0335 | `renders/title.png`, `renders/slate-demo.png`, `renders/slate.png` |
| Steam autoplay 30 s storyboard | ART-0336 | [autoplay-cut.md](autoplay-cut.md) |
| Key-art crop map (safe areas per store size) | ART-0313 | [key-art-crop-map.md](key-art-crop-map.md) |
| Store section-header banners (616 px) | ART-0325 | `renders/banner-operate.png`, `renders/banner-malison.png`, `renders/banner-kessendorf.png` |
| Launch trailer (90 s) storyboard | ART-0338 | [launch-trailer.md](launch-trailer.md) |
| Gameplay deep-dive trailer storyboard | ART-0339 | [deep-dive-trailer.md](deep-dive-trailer.md) |
| Accolades trailer template | ART-0340 | [accolades-template.md](accolades-template.md) |
| DLC / free-update trailer template | ART-0341 | [update-trailer-template.md](update-trailer-template.md) |
| Capsule compliance checklist (to sign) | ART-0321 | [capsule-compliance.md](capsule-compliance.md) |
| Social kit: avatar, X/Bluesky banner 1500×500, YouTube banner 2560×1440, Discord icon 512 and banner 960×540 | ART-0328 | `renders/social-avatar.png`, `renders/x-banner.png`, `renders/youtube-banner.png`, `renders/discord-icon.png`, `renders/discord-banner.png` |
| Livestream overlays: frame, lower third, "Wishlist" bug (transparent PNG) | ART-0337 | `renders/stream-frame.png`, `renders/stream-lower-third.png`, `renders/stream-wishlist.png` |
| Six Wound Man promo plates (one per demo ailment family), 1080×1080 | ART-0330 | `renders/promo-*.png` |
| Store screenshots (10, 1920×1080) | ART-0323 | `screenshots/*.jpg` (`npm run build:qa && node scripts/art/store-screenshots.mjs`) |

The cards and banners are drawn in-engine in the woodcut style (`src/art/marketingCards.ts`).
Review one at `?scene=cards&card=<id>` and re-export them all at their delivery sizes with
`npx vite build && node scripts/art/export-cards.mjs`: 1920×1080 cards (drawn over the
1280×720 view at 1.5× device scale) 616×120 banners, the social kit and 1080² promo plates. The stream overlays are exported with real
transparency: each is rendered over black and over white and the alpha is recovered by difference
matting. English text only. For another language,
change the strings in `drawCard` and re-export. The rating box on the end slates is a placeholder
until the rating mark is issued.
