# Beta test plan — content complete (QAT-0156)

Beta goal (brief): content complete; final art/audio/VO integrated; balancing; localisation; platform integration;
broad testing.

## Scope

| Area | Suites |
|---|---|
| Final content, Chapters I–V | final-content regression (QAT-0157) against the Alpha suites; visual baselines regenerated per chapter (Docker, `npm run visual:update`) |
| Disciplines | field triage (QAT-0158), diagnosis (0159), forensic/inquisition (0160), bone-setting (0161) — win/loss, scoring, flags |
| Challenge mode | every challenge op, leaderboards, ties, offline queue, plausibility bound (QAT-0162) |
| Long runs | full-campaign renderer run with bots, weekly (QAT-0163) |
| Localisation | full-game functional pass per shipped language (QAT-0164); pseudo-loc captures nightly |
| Compatibility | the full `docs/qa/compat-matrix.md`, including macOS if shipped |
| Accessibility | UIX accessibility table re-verified; accessibility round |
| Performance | perf-protocol captures for every chapter's worst scene on Deck and min-spec |

## Entry criteria

Alpha exit criteria met; all content in (no placeholder art/audio left in shipped paths — ART/AUD checklists);
all shipped languages imported; Steamworks features integrated behind real app ids.

## Exit criteria for the 1.0 RC

1. 0 open S1/S2; ≤ 25 S3 with owner sign-off.
2. Crash-free sessions ≥ 99.5 % in the Beta playtest round (QAT-0127) and in the last two weeks of the Steam Playtest.
3. Performance budgets met on every reference machine in the matrix.
4. Every suite above executed on the RC build; `docs/qa/cert-1.0.md` all green.
5. Balance: GAM bot sweeps and player rank distributions within one rank band of prediction for every op.
