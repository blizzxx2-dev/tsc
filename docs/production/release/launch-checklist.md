# Launch — marketing plan, checklist, day-one patch, launch week (OPS-0135 … OPS-0141)

Technical launch items (builds, depots, branches, certification) stay in the **PLT release checklist**;
this document covers the commercial and communications side.

## Launch marketing plan (OPS-0135) — dated beats tied to wishlist targets
| Date | Beat | Wishlist target at that point |
|---|---|---|
| 26 Aug 2027 | **Release-date reveal** (trailer cut-down, Steam event, press release) | 55,000 |
| Early Sep | Preview coverage wave (press build, embargo 15 Sep) | — |
| 30 Sep | Launch trailer | 70,000 |
| 7 Oct | Review copies to press (T-2 wk) | — |
| 14 Oct | Review copies to creators (T-1 wk) | — |
| 20 Oct 15:00 UTC | **Review embargo lifts** (T-1 day) | — |
| 21 Oct 17:00 UTC | **Launch** + launch stream | 90,000 |
| 21–28 Oct | Launch week streams, AMA, creator co-streams | — |

## Commercial & comms launch checklist (OPS-0136)
### T-14 days
- [ ] Price and **launch discount** set in Steamworks; regional prices reviewed
- [ ] 1.0 store page update approved (OPS-0090) — screenshots, trailer, achievements count, Deck status
- [ ] Press embargo date/time confirmed and in every key email
- [ ] Review-copy wave confirmed: press keys (7 Oct), creator keys (14 Oct) sent via key platform
- [ ] Launch press release counsel-checked and translated (OPS-0103, LOC-0103)
### T-3 days
- [ ] Social posts queued for launch day (all channels, all languages available)
- [ ] Steam launch announcement drafted in every shipped language; Discord launch event scheduled
- [ ] Launch-week community rota (moderators, review replies) staffed
### Launch day
- [ ] Release button pressed at 17:00 UTC; "Buy" visible logged-out; price and discount correct in 3 regions
- [ ] Press release out; newsletter sent; socials live; Discord event live
- [ ] Dashboards open: Steamworks sales/wishlist conversion, refunds, reviews, crash reporting, Discord bug channel
- [ ] Day-one summary to the production channel at 23:00 UTC

## Day-one patch plan (OPS-0137)
- Patch branch cut **from the RC tag** at the gold-master gate (8 Oct).
- **Contents frozen 5 days before launch (16 Oct)**; only S1 fixes after that, with owner sign-off.
- Patch notes drafted in English and sent for translation on freeze day (LOC-0104).
- QA verification of the patch on the `qa` branch scheduled for 18–19 Oct; published to default by
  launch hour (the release build *is* the patched build if Steam allows).

## Launch-week analytics review (OPS-0138)
Daily 10:00 UTC: sales (units, gross), refunds (count, %, reasons), review score and volume, wishlist
conversion (Steamworks "wishlist conversion"), crash rate, top 5 issues. **Day-7 report** (28 Oct)
compares against the revenue forecast scenarios and lists actions (patch priorities, marketing).

## Launch streams (OPS-0139)
Co-stream schedule with 5–10 creators from the creator list (launch day to +3), and two dev streams
(launch day 17:00 UTC; +3 days).

## Final credits check (OPS-0140)
Before the RC gate: compare the in-game credits line by line with
[../budget/credit-obligations.csv](../budget/credit-obligations.csv) and every contract's credit clause;
mark `verified_in_build` per row.

## First payout reconciliation (OPS-0141)
When the first Steam payout arrives (about 30 days after the end of the launch month): match the payout
to the Steamworks sales report (gross, refunds, chargebacks, VAT, Valve share, currency conversion) and
to the forecast; explain variances in the monthly business review.
