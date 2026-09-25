# Demo asset tracker (ART-0345)

`demo-assets.csv` has one row per Demo asset task in [06-art.md](../../roadmap/06-art.md), with
these columns: **asset ID, vendor, stage, due, cost, approved-by**, plus the task text, class,
priority and size. Open it in any spreadsheet. The art lead owns it and updates it after each
weekly review.

- `node scripts/art/asset-tracker.mjs` regenerates the rows from the roadmap. It keeps what
  people typed in vendor, stage, due, cost and approved-by, adds new Demo tasks, and marks rows
  whose roadmap task is ticked as `done`.
- **Stage** is one of: `not started`, `thumbnail`, `rough`, `line`, `colour`, `in-engine`, `done`
  ([pipeline.md](../pipeline.md#approval-stages-art-0029)).
- **Vendor** is `in-house (procedural)` for art the engine draws, a vendor name from the contract
  list, or `TBD`.
- **Due** comes from the schedule ([budget-schedule.md](../outsourcing/budget-schedule.md)): the
  last portrait and background batch is commissioned by 30 Oct 2026, and store assets are final at
  T-10 weeks (14 Dec 2026).
- **Cost** is in USD, the agreed quote. Procedural work is `0`.
- **Approved by** is the art director's name and date once the in-engine stage passes review.
