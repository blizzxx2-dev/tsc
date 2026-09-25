# Legal workstream (OPS-E, OPS-F prep)

**Nothing in this folder is legal advice.** These are drafts, checklists and briefs prepared so that the
studio's games-IP counsel can work quickly. Every item that needs a lawyer, a signature, a filing or a
payment is listed in `docs/handoff/OPS/README.md`.

| Document | Task | Status |
|---|---|---|
| [ip-name-review.md](ip-name-review.md) — every name in `src/content` + automated blocklist scan | OPS-0052 | ready for counsel |
| [trauma-center-comparison.md](trauma-center-comparison.md) — side-by-side expression/trade-dress table | OPS-0049/0050 | ready for counsel |
| [marketing-reference-rules.md](marketing-reference-rules.md) | OPS-0051 | in force as draft; counsel to approve |
| [trademark-and-brand.md](trademark-and-brand.md) — clearance checklist, fallback titles, filings, domains, rebrand audit | OPS-0058…0062 | searches/filings pending |
| [privacy-policy-draft.md](privacy-policy-draft.md) | OPS-0068 | counsel review |
| [eula-draft.md](eula-draft.md) — recommendation: SSA only | OPS-0067 | counsel review (D-0019) |
| [ropa.md](ropa.md) — records of processing, DPA checklist | OPS-0069 | to complete per processor |
| [nda-template.md](nda-template.md) | OPS-0066 | counsel review |
| [contractor-agreement-outline.md](contractor-agreement-outline.md) | OPS-0039 | counsel drafting |
| [streaming-policy.md](streaming-policy.md) | OPS-0071 | statement ready; licences to confirm |
| [steam-ai-disclosure-draft.md](steam-ai-disclosure-draft.md) | OPS-0063 | answer at each gate |
| [ip-claim-procedure.md](ip-claim-procedure.md) | OPS-0056 | counsel review; DMCA agent to register |
| [independent-creation-archive.md](independent-creation-archive.md) + `scripts/ops/archive-snapshot.mjs` | OPS-0055 | first snapshot at M0 |

## Counsel engagement brief (OPS-0048)
Send to 2–3 games-IP firms/solo practitioners; engage one by **2 October 2026**.

> We are an independent studio making *Suture & Steel: The Malison Hours*, a PC surgery-action game
> (Steam demo February 2027, release 2027). We need, under one engagement letter with a fixed or capped
> fee: (1) a trademark clearance opinion for "Suture & Steel" / "The Malison Hours" in classes 9/41 (US,
> EU, UK, JP, KR) and the filings in the EU and US; (2) a memo on similarity to Atlus/SEGA's *Trauma
> Center* series (rating words, rank labels, star-drawn time-slow, HUD) and to Games Workshop's
> Warhammer Fantasy tone, with required changes; (3) review of our name register; (4) a contractor
> agreement template with discipline schedules; (5) review of our privacy notice and a EULA decision;
> (6) a sign-off letter before 1.0. Materials attached: ip-name-review.md, trauma-center-comparison.md,
> privacy-policy-draft.md, eula-draft.md, contractor-agreement-outline.md.
Budget line: USD 12,000 for the demo phase (budget model).

## Errors-and-omissions insurance (OPS-0057)
Request quotes for media liability / E&O cover including IP infringement from two brokers before the
announce; compare limit, retention, exclusions (prior acts, known claims, trademark), annual premium.
Record the buy/no-buy decision in the decision log.

## Legal entity and Steamworks onboarding (OPS-0065)
- [ ] Company entity confirmed; registered name and number recorded in [../team.md](../team.md)
- [ ] All IP assigned to the entity by the founders (assignment deed, including pre-incorporation work and the repository)
- [ ] Steamworks partner agreement accepted by the entity's authorised signatory
- [ ] Tax interview completed; bank account verified
- [ ] Steam Direct fee (USD 100) paid for the full-game app; demo app created under it (free)

## Open-source and font notices (OPS-0064)
PLT generates the third-party notices (runtime, npm, OFL fonts). Counsel checks them against the OFL
1.1 conditions (fonts not sold on their own; copyright + licence included; Reserved Font Names not used
for modified fonts — relevant if ENG subsets and renames IM Fell/UnifrakturMaguntia: **subsetting may
count as modification under the OFL; keep the original names only if counsel confirms, otherwise rename
the subset families**) and npm licences (MIT/ISC/Apache notices). Gaps are filed to PLT before the demo RC.

## Website consent (OPS-0070)
The website ([../marketing/website.md](../marketing/website.md)) uses no analytics or tracking cookies
without consent: cookieless, first-party page-view counting only; the Steam wishlist widget is loaded
only after a click (it sets Valve cookies); the newsletter form links the privacy notice and uses
double opt-in.

## Trade-dress re-review and 1.0 sign-off (OPS-0072, OPS-0073)
Before Beta art lock (Aug 2027) the challenge-mode, discipline and Ch3–5 HUD screens are added to the
comparison table and sent to counsel; before the RC gate counsel issues a sign-off letter covering
title, trade dress, EULA/privacy and store copy, filed with the name-register sign-off (re-run
`node scripts/ops/ip-scan.mjs`) and the ART asset IP audit.
