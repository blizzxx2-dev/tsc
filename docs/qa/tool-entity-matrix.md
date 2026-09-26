# Tool × entity response matrix

Generated and enforced by `tests/characterisation/tool-matrix.test.ts` (QAT-0049). Each cell is the
response to pressing, dragging ~30 px, holding and releasing that tool on the entity, compared with
the same op left alone: **acts** (rating or state change), **hint(flag)** (a callout flag was set),
**penalty(…)** (BAD/MISS rating or extra vitals lost), **·** (ignored). Regenerate with
`npx vitest run tests/characterisation/tool-matrix.test.ts -u` and review the diff.

| Entity | Lancet | Tongs | Leech-Pipe | Gut Thread | Saint’s Salve | Tincture | Cautery Brand | Scrying Lens |
|---|---|---|---|---|---|---|---|---|
| Incision (marked) | acts | hint(wrong-tongs-Incision) | hint(wrong-leech-Incision) | hint(wrong-thread-Incision) | hint(wrong-salve-Incision) | hint(wrong-tincture-Incision,inject-waste) penalty(BAD) | hint(wrong-brand-Incision,brand-flesh) penalty(BAD) | hint(wrong-lens-Incision) |
| Incision (closing) | · | · | · | · | · | hint(inject-waste) penalty(BAD) | hint(brand-flesh) penalty(BAD) | · |
| Laceration | hint(wrong-lancet-Laceration) | hint(wrong-tongs-Laceration) | hint(wrong-leech-Laceration) | · | hint(wrong-salve-Laceration) | hint(wrong-tincture-Laceration,inject-wound) penalty(MISS) | hint(wrong-brand-Laceration,brand-flesh) penalty(BAD) | hint(wrong-lens-Laceration) |
| Laceration (nick) | hint(wrong-lancet-Laceration) | hint(wrong-tongs-Laceration) | hint(wrong-leech-Laceration) | acts | acts | hint(wrong-tincture-Laceration,inject-wound) penalty(MISS) | hint(wrong-brand-Laceration,brand-flesh) penalty(BAD) | hint(wrong-lens-Laceration) |
| BloodPool | hint(wrong-lancet-BloodPool) | hint(wrong-tongs-BloodPool) | acts | hint(wrong-thread-BloodPool) | hint(wrong-salve-BloodPool) | hint(wrong-tincture-BloodPool,inject-waste) penalty(BAD) | hint(wrong-brand-BloodPool,brand-flesh) penalty(BAD) | hint(wrong-lens-BloodPool) |
| Embedded arrow (barbed) | acts | acts hint(barbs,drop-off) penalty(BAD) | hint(wrong-leech-Embedded) | hint(wrong-thread-Embedded) | hint(wrong-salve-Embedded) | hint(wrong-tincture-Embedded,inject-waste) penalty(BAD) | hint(wrong-brand-Embedded,brand-flesh) penalty(BAD) | hint(wrong-lens-Embedded) |
| Embedded shot | hint(wrong-lancet-Embedded) penalty(MISS) | acts hint(drop-off) | hint(wrong-leech-Embedded) | hint(wrong-thread-Embedded) | hint(wrong-salve-Embedded) | hint(wrong-tincture-Embedded,inject-waste) penalty(BAD) | hint(wrong-brand-Embedded,brand-flesh) penalty(BAD) | hint(wrong-lens-Embedded) |
| Embedded hexstone (hidden) | penalty(MISS) | penalty(MISS) | · | · | · | hint(inject-waste) penalty(BAD) | hint(brand-flesh) penalty(BAD) | acts |
| Burn | hint(wrong-lancet-Burn) | acts | hint(wrong-leech-Burn) | hint(wrong-thread-Burn) | acts hint(wrong-salve-Burn,burn-eschar) penalty(BAD) | hint(wrong-tincture-Burn,inject-waste) penalty(BAD) | hint(wrong-brand-Burn,brand-flesh) penalty(BAD) | hint(wrong-lens-Burn) |
| Bubo | acts | hint(wrong-tongs-Bubo) penalty(MISS) | hint(wrong-leech-Bubo) | hint(wrong-thread-Bubo) | hint(wrong-salve-Bubo) | hint(wrong-tincture-Bubo,inject-waste) penalty(BAD) | hint(wrong-brand-Bubo,brand-flesh) penalty(BAD) | hint(wrong-lens-Bubo) |
| Rot | hint(wrong-lancet-Rot) | hint(wrong-tongs-Rot) | hint(wrong-leech-Rot) | hint(wrong-thread-Rot) | acts | hint(wrong-tincture-Rot,inject-waste) penalty(BAD) | hint(wrong-brand-Rot,brand-flesh) penalty(BAD) | hint(wrong-lens-Rot) |
| Venom | hint(wrong-lancet-Venom) penalty(MISS) | hint(wrong-tongs-Venom) penalty(MISS) | hint(wrong-leech-Venom) | hint(wrong-thread-Venom) | hint(wrong-salve-Venom) | acts | hint(wrong-brand-Venom) | hint(wrong-lens-Venom) |
| Grub | hint(wrong-lancet-Grub) | acts | hint(wrong-leech-Grub) | hint(wrong-thread-Grub) | hint(wrong-salve-Grub) | hint(wrong-tincture-Grub,inject-waste) penalty(BAD) | acts hint(brand-flesh) | hint(wrong-lens-Grub) |
| SpiderlingGrub | · | · | · | · | · | hint(inject-waste) penalty(BAD) | acts hint(brand-flesh) penalty(BAD) | · |
| Sigil | hint(wrong-lancet-Sigil) penalty(MISS) | hint(wrong-tongs-Sigil) penalty(MISS) | hint(wrong-leech-Sigil) | hint(wrong-thread-Sigil) | hint(wrong-salve-Sigil) | hint(wrong-tincture-Sigil,inject-waste) penalty(BAD) | acts hint(brand-flesh) penalty(BAD) | hint(wrong-lens-Sigil) |
| EggSac | acts hint(eggsac-lanced) | penalty(MISS) | · | · | · | hint(inject-waste) penalty(BAD) | hint(brand-flesh) penalty(BAD) | · |
| Malison (veiled) | · | · | · | · | · | hint(inject-waste) penalty(BAD) | acts penalty(MISS) | · |
| Malison (open) | · | · | · | · | · | hint(inject-waste) penalty(BAD) | acts | · |
| MalisonShard | · | acts | · | · | · | hint(inject-waste) penalty(BAD) | hint(brand-flesh) penalty(BAD) | · |
| LaudsMalison (shielded) | · | · | · | · | · | hint(inject-waste) penalty(BAD) | hint(lauds-shielded) | · |
| ChoirVoice | · | · | · | · | · | hint(inject-waste) penalty(BAD) | acts hint(lauds-voice-trace) | · |
