# Demo playtest round plan (QAT-0117, 0118, 0119, 0120, 0121, 0122 … 0125)

Three dated demo rounds share **one build per round and one survey**, so the CON external rounds, the UIX
fresh-player study, the BOS boss gates and the GAM rank validation never duplicate sessions. Dates are relative to the
demo RC date R (see `docs/qa/demo-test-plan.md` § 6); the producer fills the calendar dates.

## Access channels (QAT-0117)

| Channel | Used for | Access | Revocation |
|---|---|---|---|
| Private Steam branch `playtest` on the demo app (password) | moderated rounds 1–2, Deck and accessibility rounds | keys + branch password mailed per wave | change the branch password after each round; remove keys from the partner site |
| Steam Playtest app (unmoderated) | round 3 and the RC round | waves of 50 through the Playtest sign-up, approved from the tester pool first | end the Playtest wave in Steamworks; playtest builds expire with the wave |

Waves: W1 = 15 moderated (round 1), W2 = 20 moderated (round 2), W3 = 50 unmoderated (round 3), RC = 30 unmoderated.
Record every key/wave in the "Playtest access" sheet (tester, channel, wave, granted, revoked).

## Rounds (QAT-0118)

| Round | When | Build | Who | Covers (owner) | Format |
|---|---|---|---|---|---|
| 1 | R − 6 w | playtest-1 | 15 fresh players (0 veterans) | UIX fresh-player study, tutorials; CON op1-1…op1-5 survey | moderated, recorded, 90 min |
| 2 | R − 4 w | playtest-2 | 20 (⅓ veterans) | BOS boss gates (Matins, Lauds), GAM rank validation (steady/novice bot comparison), CON Ch2 survey | moderated, recorded, 2 h |
| 3 | R − 2 w | playtest-3 | 50 via Steam Playtest | whole-demo funnel, crash-free rate, wishlist intent | unmoderated + survey |
| Deck (0123) | R − 2 w | playtest-3 | 5 Deck owners | default controls; stitching precision and star-gesture success per op | remote, recorded |
| Accessibility (0124) | R − 2 w | playtest-3 | ≥ 3: one-handed setup, trackball, colour-vision deficiency | UIX accessibility table | moderated |
| Localisation (0125) | R − 3 w | playtest-2 | 2 natives per demo language | Chapter I tone and clarity via the LQA template | unmoderated |
| RC (0122) | R − 1 w | the RC | 30 via Steam Playtest | exit gates below | unmoderated |

**RC round gates (QAT-0122):** ≥ 85 % of players reach Lauds (op2-5 started), median session ≥ 40 min, "would you
wishlist" ≥ 60 % yes, **0 crashes**. Data: telemetry funnel (opt-in players) + survey + crash reports.

## Session survey (QAT-0119) — identical every round

1. System Usability Scale (10 standard SUS items, 1–5).
2. "Would you wishlist Suture & Steel after this demo?" (yes / maybe / no) and why (short text).
3. Session length (auto from telemetry; ask as fallback: < 20 min / 20–40 / 40–60 / > 60).
4. "What was the most confusing moment?" (free text) — and which operation (dropdown op1-1 … op2-5, story, menus).
5. Hardware and input used (prefilled from the screener where possible).
The CON per-op survey is appended unchanged after these five.

## Session recordings (QAT-0120)

OBS profile: 1080p30, game capture + webcam off by default + microphone, **input overlay** (Input Overlay plugin,
mouse + keys layout) so gestures are visible. Moderated sessions only, with recorded consent at the start. Within 48 h of
each session the moderator tags confusion moments in the shared sheet: `tester | round | timestamp | op/phase | what
happened | severity guess`. Recordings live in the restricted QA drive; deleted 6 months after the round.

## Findings pipeline (QAT-0121)

Each distinct finding → a GitHub issue through the bug form with labels `playtest` + area + severity, the round, and
frequency **n/N** ("7/15 players stitched through the pool in op1-1"). The round report (`docs/handoff/QAT/playtest/
round-report-template.md`) lists what changed since the previous round and re-measures the previous top findings.
