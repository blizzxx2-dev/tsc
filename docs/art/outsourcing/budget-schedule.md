# Demo art budget and schedule (ART-0350)

Cost and weeks per asset class for the Chapters 1–2 demo, with a **15 % contingency**. Unit costs
match the Art lines of the production budget model
([docs/production/budget/budget-model.csv](../../production/budget/budget-model.csv), source
`ART-0350`). The schedule fits the production calendar
([docs/production/schedule.md](../../production/schedule.md)): the last portrait and background
batch is commissioned by **30 Oct 2026**, and store assets are final at **T-10 weeks (14 Dec 2026)**.

Much of the demo's art is drawn by the engine (backdrops, flesh, ailments, VFX, UI kit), so the
outsourced spend is mostly portraits, a painted pass on backgrounds, boss and ailment callouts,
and store art. The in-house rows are the art lead's and the render engineer's time, which is
already budgeted as salary. They are listed for the schedule, not the cash total.

## Cost per asset class

| Class | Scope | Basis | Qty | Unit (USD) | Cost (USD) | Weeks | Who |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Portraits | 6 cast × 3 expressions (demo set) | per expression | 18 | 1,000 | 18,000 | 8 (2 batches × 4) | Vendor A |
| Backgrounds | 6 painted layer sets over the shader scenes | per background | 6 | 600 | 3,600 | 5 | Vendor B |
| Flesh sets, ailments, Matins and Lauds | Boss callouts, ailment paint-ups, detail textures | lump sum | 1 | 9,000 | 9,000 | 6 | Vendor B + in-house |
| UI art | Polish pass over the procedural kit, icons | lump sum | 1 | 3,000 | 3,000 | 3 | Vendor C |
| Store and marketing | Key art, capsules, library assets, banners | lump sum | 1 | 4,500 | 4,500 | 4 | Key-art illustrator |
| **Subtotal** | | | | | **38,100** | | |
| **Contingency 15 %** | revisions past round 2, a replacement vendor, rush fees | | | | **5,715** | | |
| **Total** | | | | | **43,815** | | |

In-house (no cash, schedule only): procedural backdrops, flesh sets and VFX (ongoing, 1 render
engineer); art QA, budgets and tooling (the art lead, about 20 % of the time).

## Schedule

| Weeks (from vendor start) | Portraits | Backgrounds | Bosses and ailments | UI | Store |
| --- | --- | --- | --- | --- | --- |
| 1–2 | Test task (ART-0343), batch 1 thumbnails | — | Callout sheets | — | — |
| 3–4 | Batch 1 rough → colour | Thumbnails, roughs | Callouts approved | Icon roughs | — |
| 5–6 | Batch 1 in-engine; batch 2 start | Colour | Paint-ups | Final icons | Key-art sketch |
| 7–8 | Batch 2 rough → colour | In-engine | In-engine | In-engine | Key art colour |
| 9–10 | Batch 2 in-engine | — | — | — | Capsules, library, banners |
| 11 | Buffer (contingency weeks) | Buffer | Buffer | — | Store-asset lock |

With vendor start on **21 Sep 2026**, week 11 ends on 6 Dec 2026, a week ahead of the T-10
store-asset date. Each class carries one buffer week inside its span. The contingency money buys
extra rounds or a second vendor, not more calendar time.

## Tracking

Every asset has a row in [../tracker/demo-assets.csv](../tracker/demo-assets.csv) (ART-0345). Actual
spend is logged against these lines each month in the production budget. An overrun of more than
10 % on any class goes to the producer as a change request.
