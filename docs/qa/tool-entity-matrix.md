# Tool × entity response matrix

Generated and enforced by `tests/characterisation/tool-matrix.test.ts` (QAT-0049). Each cell is the
response to pressing, dragging ~30 px, holding and releasing that tool on the entity, compared with
the same op left alone: **acts** (rating or state change), **hint(flag)** (a callout flag was set),
**penalty(…)** (BAD/MISS rating or extra vitals lost), **·** (ignored). Regenerate with
`npx vitest run tests/characterisation/tool-matrix.test.ts -u` and review the diff.

| Entity | Lancet | Tongs | Leech-Pipe | Gut Thread | Saint’s Salve | Tincture | Cautery Brand | Scrying Lens |
|---|---|---|---|---|---|---|---|---|
| Incision (marked) | acts | · | · | · | · | · | hint(brand-flesh) penalty(-4) | · |
| Incision (closing) | penalty(MISS) | · | · | · | · | · | hint(brand-flesh) penalty(-4) | · |
| Laceration | penalty(MISS) | · | · | · | · | · | hint(brand-flesh) penalty(-4) | · |
| Laceration (nick) | penalty(MISS) | · | · | · | acts | · | hint(brand-flesh) penalty(-4) | · |
| BloodPool | penalty(MISS) | · | acts | · | · | · | hint(brand-flesh) penalty(-4) | · |
| Embedded arrow (barbed) | acts | acts hint(barbs) penalty(BAD) | · | · | · | · | hint(brand-flesh) penalty(-4) | · |
| Embedded shot | penalty(MISS) | acts | · | · | · | · | hint(brand-flesh) penalty(-4) | · |
| Embedded hexstone (hidden) | penalty(MISS) | · | · | · | · | · | hint(brand-flesh) penalty(-4) | acts |
| Burn | penalty(MISS) | acts | · | · | hint(burn-eschar) | · | hint(brand-flesh) penalty(-4) | · |
| Bubo | acts | · | · | · | · | · | hint(brand-flesh) penalty(-4) | · |
| Rot | penalty(MISS) | · | · | · | acts | · | hint(brand-flesh) penalty(-4) | · |
| Venom | penalty(MISS) | · | · | · | · | acts | hint(brand-flesh) penalty(-4) | · |
| Grub | penalty(MISS) | acts | · | · | · | · | acts hint(brand-flesh) | · |
| SpiderlingGrub | penalty(MISS) | · | · | · | · | · | acts hint(brand-flesh) | · |
| Sigil | penalty(MISS) | · | · | · | · | · | acts hint(brand-flesh) | · |
| EggSac | acts hint(eggsac-lanced) | · | · | · | · | · | hint(brand-flesh) penalty(-4) | · |
| Malison (veiled) | penalty(MISS) | · | · | · | · | · | hint(malison-veiled) | · |
| Malison (open) | penalty(MISS) | · | · | · | · | · | acts | · |
| MalisonShard | penalty(MISS) | acts | · | · | · | · | hint(brand-flesh) penalty(-4) | · |
| LaudsMalison (shielded) | penalty(MISS) | · | · | · | · | · | hint(lauds-shielded) | · |
| ChoirVoice | penalty(MISS) | · | · | · | · | · | acts hint(brand-flesh) | · |
