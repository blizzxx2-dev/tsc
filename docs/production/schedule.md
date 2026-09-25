# Master schedule — September 2026 to launch

Dated plan from today (Friday 25 September 2026) to Steam Next Fest (February 2027 edition, D-0002)
and 1.0 (21 October 2027). Owner: Producer. Reviewed at every sprint review; changes to a milestone
date need a decision-log entry. Gate dates are mirrored in [`gates.json`](gates.json), which the
burn-up script (`node scripts/ops/burnup.mjs`) forecasts against.

**Buffer rule:** every external dependency (vendor, Valve, rating body, trademark office, counsel)
carries **+15 %** on its quoted lead time, rounded up to whole working days, and the milestone that
depends on it is scheduled after the buffered date. Internal work is buffered through the feature lock
and the go/no-go gate instead.

> Next Fest dates are planning assumptions until Valve publishes the edition in Steamworks
> (handoff OPS-0104/0105). February editions have historically run in the second half of February;
> the plan assumes **22 Feb – 1 Mar 2027**, registration closing **early January 2027**.

## Sprint calendar (two-week sprints, D-0001)

| Sprint | Dates | Focus |
|---|---|---|
| S1 | 28 Sep – 9 Oct 2026 | M0 gate; counsel engaged; risk register live; store copy draft |
| S2 | 12 Oct – 23 Oct | Art direction lock for Ch1–2; composer test cues; name-register counsel review |
| S3 | 26 Oct – 6 Nov | Coming-soon page assets; trademark filings; rating dry run; capsule people test |
| S4 | 9 Nov – 20 Nov | **Announce (17 Nov)**: store page live, announce trailer, Discord, newsletter |
| S5 | 23 Nov – 4 Dec | Tutorials, options, save/Cloud, controller/Deck basics complete |
| S6 | 7 Dec – 18 Dec | **Demo feature lock + content lock + loc handoff (11 Dec)**; RU/ZH go/no-go |
| — | 21 Dec – 3 Jan | Holiday: reduced capacity (planned at 30 %); translators working |
| S7 | 4 Jan – 15 Jan 2027 | Polish and fixes; demo RC1 (11 Jan); Next Fest registration |
| S8 | 18 Jan – 29 Jan | **Go/no-go (18 Jan)**; Valve demo review (25 Jan); LQA; loc fixes |
| S9 | 1 Feb – 12 Feb | Language sign-offs (1 Feb); final demo build (5 Feb); press preview (8 Feb) |
| S10 | 15 Feb – 26 Feb | **Demo public (15 Feb)**; **Next Fest (22 Feb – 1 Mar)** |
| S11 | 1 Mar – 12 Mar | Post-fest retro (8 Mar); demo update; **Alpha kickoff, Ch3–5 scope lock (1 Mar)** |
| S12–S19 | 15 Mar – 2 Jul | Chapters III–V production (below); **Alpha gate 2 Jul** |
| S20–S23 | 5 Jul – 27 Aug | Content complete, final art/audio/VO, full-game loc; **Beta gate 27 Aug** |
| S24–S26 | 30 Aug – 8 Oct | Certification, RC (24 Sep), **gold master (8 Oct)** |
| — | 21 Oct 2027 | **1.0 launch** (Thursday; clear of the October Next Fest and Steam Scream Fest — confirm dates at OPS-0133) |

## Milestones and gates

| Date | Milestone | Gate document |
|---|---|---|
| 2026-10-09 | **M0 gate** — Chapter 1 playable from title; bot tests and smoke green | [gates.md](gates.md#m0) |
| 2026-11-17 | **Announce** — store page public, trailer, Discord, press release | [marketing/announce-checklist.md](marketing/announce-checklist.md) |
| 2026-12-11 | **Demo feature lock** (OPS-0017) and **content lock / NAR script lock / string freeze** (OPS-0018, LOC-0049) | [change-control.md](change-control.md) |
| 2027-01-11 | Demo RC1 (English, all features) to the Steam `qa` branch | [definition-of-done.md](definition-of-done.md#demo-ops-0016) |
| 2027-01-18 | **Demo go/no-go** (3 weeks before press preview, OPS-0019) | [gates.md](gates.md#demo-gono-go) |
| 2027-01-25 | Demo build submitted for Valve review (T-4) | PLT checklist |
| 2027-02-01 | Per-language sign-offs (LOC-0054) | [docs/loc/process.md](../loc/process.md#per-language-demo-sign-off-loc-0054) |
| 2027-02-05 | **Final demo build** (Demo gate in `gates.json`) | |
| 2027-02-08 | Press & creator preview (T-2) | [nextfest/plan.md](nextfest/plan.md) |
| 2027-02-15 | Demo public | D-0009 |
| 2027-02-22 → 03-01 | **Steam Next Fest** | [nextfest/plan.md](nextfest/plan.md) |
| 2027-03-01 | Alpha kickoff; Ch3–5 scope lock (OPS-0028) | [scope-ch3-5.md](scope-ch3-5.md) |
| 2027-07-02 | **Alpha gate** (OPS-0020) | [gates.md](gates.md#alpha) |
| 2027-07-30 | Full-game script lock, UI string freeze, loc handoff (LOC-0098) | |
| 2027-08-27 | **Beta gate** (OPS-0021) | [gates.md](gates.md#beta) |
| 2027-09-24 | **Release candidate gate** (OPS-0022) | [gates.md](gates.md#release-candidate) |
| 2027-10-08 | **Gold master go/no-go** (OPS-0023) | [gates.md](gates.md#gold-master) |
| 2027-10-21 | **1.0 launch** | [release/launch-checklist.md](release/launch-checklist.md) |

## Chapter III–V content milestones (OPS-0030…0032)

Chapters overlap by roughly three weeks; each follows outline → ops with placeholder art → story draft
→ art lock → loc handoff. The finale's Compline boss is built first within Chapter V because it carries
the most design risk.

| Milestone | Chapter III (Prime, Terce) | Chapter IV (Sext, None) | Chapter V (Vespers, Compline) |
|---|---|---|---|
| Outline lock | 2027-03-12 | 2027-04-02 | 2027-04-23 (Compline boss design first) |
| Ops playable with placeholder art | 2027-04-16 | 2027-05-07 | 2027-05-28 (Compline playable 2027-05-14) |
| Story first draft | 2027-04-23 | 2027-05-14 | 2027-06-04 |
| Art lock | 2027-06-04 | 2027-06-25 | 2027-07-16 |
| Loc handoff | 2027-07-30 (single full-game handoff, LOC-0098) | 2027-07-30 | 2027-07-30 |

## External lead times (quoted → buffered +15 %)

| Dependency | Quoted lead time | Buffered | Latest start for its milestone |
|---|---|---|---|
| Games-IP counsel: engagement + name-register and trade-dress memo | 3 weeks | 17.25 → 18 working days | 2 Oct 2026 for the 30 Oct memo |
| Trademark clearance opinion (counsel) | 2 weeks | 12 working days | 12 Oct 2026 → filing 6 Nov, before announce |
| Trademark filing (EUIPO/USPTO e-filing) | 1–2 days to file; registration 4–12 months | filing done 6 Nov | Registration is not on the critical path |
| Valve store-page review | 3–5 business days | 6 business days | Submit by 6 Nov for 17 Nov announce |
| Valve demo build review | 3–5 business days | 6 business days | Submit 25 Jan for 5 Feb final build |
| Steam Direct fee clearance + tax/bank verification | up to 30 days after payment | 35 days | Pay by 2 Oct 2026 |
| Composer (select → 6 demo cues) | 3 weeks + 8 weeks | 13 weeks | Test cues out by 2 Oct; delivery 1 Jan 2027 |
| Portrait / background art batches (ART vendors) | 4 weeks per batch | 5 weeks | Last demo batch commissioned by 30 Oct |
| Trailer editor (announce trailer) | 3 weeks | 3.5 weeks | Brief by 23 Oct for 17 Nov |
| Localisation (translation 3 wk, LQA 2 wk, fixes 1 wk) | 6 weeks | 7 weeks | Handoff 11 Dec → done 29 Jan (holiday week added) |
| Legal translation of privacy notice/EULA | 2 weeks | 2.5 weeks | Source final by 8 Jan |
| USK/IARC rating (Germany path, if required) | IARC: immediate; USK full: ~4 weeks | 5 weeks | Decide by 13 Nov; submit by 11 Dec |
| QA compatibility lab booking | 6 weeks' notice | 7 weeks | Book by 23 Nov for the 11 Jan RC |

## Next Fest marketing calendar (OPS-0107)

Relative to the festival start T-0 = 22 Feb 2027; owners per line.

| When | Date | What | Owner |
|---|---|---|---|
| T-14 wk | 16 Nov 2026 | Store page live (≥ 3 months ahead, OPS-0083); UTM links in every channel | Marketing lead |
| T-10 wk | 14 Dec 2026 | Store assets final (capsules, screenshots, GIFs); string freeze and loc handoff already done (11 Dec) | ART / Marketing lead |
| T-8 wk | 28 Dec 2026 | Localised store text and Next Fest trailer subtitles in translation; festival trailer edit locked | Loc lead |
| T-7 wk | 4 Jan 2027 | Next Fest registration submitted (deadline to confirm) | Producer |
| T-6 wk | 11 Jan 2027 | Demo RC1 on the `qa` branch | QA lead |
| T-5 wk | 18 Jan 2027 | Go/no-go gate | Owner |
| T-4 wk | 25 Jan 2027 | Demo submitted for Valve review (PLT checklist) | PLT |
| T-3 wk | 29 Jan 2027 | Press/creator outreach sent (10 days before preview, OPS-0108) | Marketing lead |
| T-2 wk | 8 Feb 2027 | Press & creator preview; follow-ups on day 3 (11 Feb) | Marketing lead |
| T-1 wk | 15 Feb 2027 | Demo public; festival livestream recorded | Marketing lead |
| T-0 | 22 Feb 2027 | Festival starts; daily operations runbook | Everyone |
| T+2 wk | 8 Mar 2027 | Post-fest retrospective | Producer |
