# Rating requirements by territory (OPS-0076, OPS-0077)

**Planning table — verify each row against the current rules before relying on it** (rules change;
handoff OPS-0076 asks the producer to confirm with the rating bodies/Valve documentation and date the
check). Steam does not participate in the IARC system; ratings a developer holds can be entered in
Steamworks and shown on the store page.

| Territory | Required for a Steam PC release? | Displayed on Steam? | Path | Cost (approx.) | Plan |
|---|---|---|---|---|---|
| **Germany (USK)** | Unrated games are not banned from sale but unrated/"no youth approval" content may be age-gated for German users; a USK rating unlocks normal visibility and removes the age-verification barrier for 16- or lower-rated content | Yes (USK badge when entered) | IARC certificate (via a participating store) carrying a USK rating, or a full USK examination | IARC: free; full USK exam: ~EUR 1,000–2,500 | **Obtain before the demo goes public** (target: submit by 11 Dec 2026). Check indexing risk: our violence is medical aftermath, not glorified — low risk; occult content is not an indexing criterion on its own |
| **Australia (ACB)** | Classification is legally required for sale; the IARC tool is recognised for digital games | Yes | IARC questionnaire (free) | free via IARC | Complete via IARC before 1.0; predicted MA15+ |
| **Brazil (ClassInd)** | Classification is required; self-classification accepted for digital games, IARC recognised | Yes | IARC / ClassInd self-classification | free | Complete before 1.0; predicted 16 |
| **South Korea (GRAC)** | Rating required for games offered to Korean users; Steam games have been blocked/hidden when unrated | Yes | GRAC via self-rating business partner or IARC-participating store | varies | **Beta (OPS-0079)** — before Korean language release |
| USA/Canada (ESRB) | Not required on Steam | Optional | IARC gives an ESRB-equivalent; full ESRB for consoles | free/paid | Optional; needed only for console |
| Europe (PEGI) | Not required on Steam | Optional | IARC gives PEGI | free | Optional |

## Germany path (OPS-0077)
1. Finish the dry run ([iarc-dry-run.md](iarc-dry-run.md)) → predicted USK 16.
2. Decide by **13 Nov 2026**: IARC certificate (fast, free) if a participating storefront build is
   practical, otherwise the full USK procedure (5-week buffered lead time).
3. Submit by **11 Dec 2026** so the certificate is entered in Steamworks before the demo goes public
   (15 Feb 2027).
4. Content check against indexing risk (BzKJ): no glorification of violence, no violence against
   defenceless people shown as rewarded, no real-world extremist symbols; the pentagram is a fictional
   prayer sign → note in the submission.
