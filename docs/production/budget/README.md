# Studio budget model (OPS-0034)

Owner: Owner (approves), Producer (maintains). The model is one spreadsheet:
[`budget-model.csv`](budget-model.csv) (import into any spreadsheet tool; one row per line item with
phase, category, basis, quantity, unit cost, amount, owner and the roadmap task it comes from). It rolls
up the ART and AUD budgets (their tasks ART-0350/0348 and the AUD plan replace the estimate rows when
they land), writing/editing, localisation, legal/trademark, ratings, marketing, QA contractors,
hardware, software, the Steam Direct fee and a **15 % contingency** per phase.

All figures are **USD estimates dated 2026-09-25**, external cash spend only. **Team labour (salaries,
founder draw) is not in the model** — the Owner adds it as a `People` category once the team roster
([team.md](../team.md)) and funding route (D-0017) are set. Each estimate is replaced by the accepted
quote when a contract is signed.

## Summary (from budget-model.csv)

| Category | Demo (USD) | 1.0 (USD) | Total (USD) |
|---|---:|---:|---:|
| Art | 38,100 | 74,000 | 112,100 |
| Audio | 11,250 | 24,500 | 35,750 |
| Writing | 1,200 | 4,000 | 5,200 |
| Localisation | 7,165 | 27,865 | 35,030 |
| Legal | 15,350 | 10,000 | 25,350 |
| Ratings | 2,000 | 3,000 | 5,000 |
| Marketing | 13,500 | 19,800 | 33,300 |
| QA | 4,000 | 12,000 | 16,000 |
| Hardware | 2,538 | 0 | 2,538 |
| Software | 370 | 592 | 962 |
| Platform | 100 | 0 | 100 |
| Contingency (15 %) | 14,336 | 26,364 | 40,700 |
| **Total** | **109,909** | **202,121** | **312,030** |

Not yet in the model (decision pending): errors-and-omissions insurance (quotes, OPS-0057); Mac test
hardware (only if a Mac build is greenlit); paid user acquisition beyond the tests listed.

## Monthly actuals vs plan
Every month the producer adds the month's invoices to `actuals-<yyyy-mm>.csv` (same columns plus
`invoice`, `paid_on`, `milestone`) and reports plan vs actual per category in the first status note of
the next month. A category more than 10 % over plan two months running raises risk R-14.

## Payment rule (OPS-0041)
Every statement of work lists deliverables and acceptance criteria ([sow-template.md](sow-template.md)).
**Invoices are paid only against milestones accepted in review** (the acceptance is a comment on the
deliverable's issue linking the files). The actuals sheet records the milestone id for every payment;
a payment with no accepted milestone is not approved.

Related: [localisation budget](localisation.md) · [revenue forecast and wishlist targets](revenue-forecast.md) ·
[test hardware](hardware.md) · [funding route](funding.md) · [credit obligations](credit-obligations.csv).
