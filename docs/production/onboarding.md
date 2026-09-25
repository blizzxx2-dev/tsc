# Contractor onboarding pack (OPS-0012)

Goal: a new contractor ships a first accepted deliverable in **week 1**. Owner: Producer.

## Before day 1 (producer)
- [ ] Contract signed with the company-wide agreement and the discipline schedule (ART/AUD/writing/loc)
      — see [legal/contractor-agreement-outline.md](legal/contractor-agreement-outline.md); NDA included
- [ ] Statement of work with milestones and acceptance criteria ([budget/sow-template.md](budget/sow-template.md))
- [ ] Credit wording recorded in [budget/credit-obligations.csv](budget/credit-obligations.csv)
- [ ] A first task sized **S** with a clear acceptance criterion, due by day 5

## Access checklist (least privilege; revoke on contract end)
| System | Who gets it | Level | Notes |
|---|---|---|---|
| GitHub | everyone | Read; Write for code/content contributors (via PRs only) | 2FA required by org policy |
| Shared drive | everyone | Their discipline folder + `bibles/` read-only | Deliverables uploaded to `incoming/<name>/` |
| Discord (team server) | everyone | `#production`, their discipline channel | Not the community server moderator role unless moderating |
| Steamworks | only if needed (build testing, store assets) | *Edit app metadata* or *View* roles; never *Admin* | Added by one of the two admins (OPS-0013) |
| Password manager | only if they need a shared credential | Single shared vault item | Never send credentials in chat |
| TMS (translators/LSP) | loc vendors | Per-language translator/reviewer roles | See docs/loc/process.md |

## Read first (bibles)
1. `docs/roadmap/_brief.md` — the game in one page
2. Your discipline's roadmap file (`docs/roadmap/0x-*.md`) and the tasks assigned to you
3. Tone and IP rules: `docs/research/warhammer-fantasy-tone.md`, [legal/marketing-reference-rules.md](legal/marketing-reference-rules.md),
   [legal/ip-name-review.md](legal/ip-name-review.md) (no Games Workshop or Atlus/SEGA names, art or footage)
4. Localisation: `docs/loc/keys.md` (developers/writers), `docs/loc/style-guide.md` (writers/translators)
5. [definition-of-done.md](definition-of-done.md)

## File naming
`<area>_<subject>_<variant>_v<nn>.<ext>` in lower-case with hyphens inside fields, e.g.
`portrait_ilse_neutral_v03.png`, `music_op-theatre_loop_v02.wav`, `trailer_announce_1080p60_v05.mp4`.
Final approved files drop nothing and gain `_final` only when accepted in review.

## Review slots
- Art/audio/writing reviews: Tuesday and Thursday 15:00 (30 min, async comments allowed).
- Feedback within 2 working days of delivery; acceptance or a numbered change list — never "make it better".
- Two revision rounds are included in every SOW milestone; a third round is a change request.

## Week-1 plan
| Day | Contractor | Producer |
|---|---|---|
| 1 | Access check, read bibles, kickoff call (30 min) | Walk through the first task |
| 2–4 | First S task | Answer questions within 4 working hours |
| 5 | Deliver | Review in the Thursday/Friday slot; accept or return a numbered list |
