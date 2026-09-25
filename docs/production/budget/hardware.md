# Test hardware (OPS-0037)

Owner: Producer. Purchases are budgeted in `budget-model.csv` (Hardware rows, USD 2,538). The inventory
below is filled in as devices arrive; every device has one owner responsible for it and a location.

| Device | Why | Spec to buy | Budget (USD) | Serial / asset tag | Owner | Location | Arrived |
|---|---|---|---:|---|---|---|---|
| Steam Deck LCD | Deck Verified self-test, 40 fps floor, 1280×800 legibility | 64 GB or 256 GB LCD | 399 | | | | |
| Steam Deck OLED | Different panel/refresh (90 Hz), HDR off check | 512 GB OLED | 549 | | | | |
| Intel UHD 620 laptop | Min-spec integrated GPU for WebGL2 (ENG perf budget) | i5-8250U class, 8 GB RAM, refurbished | 350 | | | | |
| Hybrid-graphics laptop | iGPU/dGPU switching, Electron GPU selection bugs | Intel iGPU + NVIDIA dGPU (Optimus) | 900 | | | | |
| Older NVIDIA GTX desktop card | Driver/ANGLE path on older NVIDIA | GTX 1060 class, used | 120 | | | | |
| AMD RDNA desktop card | AMD driver path | RX 6600 class | 220 | | | | |
| Apple-silicon Mac | **Only if a Mac build is greenlit** (PLT) | Mac mini M-series base | (599, not budgeted) | | | | |

Rules: devices stay on the latest stable OS/driver except one "old driver" snapshot per GPU vendor noted
in the QA matrix; loaned devices are signed out in this table.
