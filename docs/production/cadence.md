# Production cadence

Owner: Producer. Applies to employees and contractors alike (contractors attend reviews for the work
they deliver). Decision: D-0001.

## Two-week sprint (OPS-0001)

| Day | Ceremony | Length | Output |
|---|---|---|---|
| Mon, week 1 | **Planning** | 60 min | Sprint goal (one sentence) and committed issues recorded on the GitHub Project *before* the sprint's first working day ends; each committed issue has an assignee and a size |
| Daily | Async check-in in the production channel | 5 min each | Yesterday / today / blocked |
| Wed, week 2 | **Mid-sprint check** | 20 min | Scope adjusted if the burn-up shows the goal at risk; any drop is recorded on the issue |
| Fri, week 2 | **Review on a playable build** | 45 min | The sprint-review build (below) is played live — no slides; accepted/rejected per committed issue |
| Fri, week 2 | **Retro** | 30 min | ≤ 3 actions, each an issue with an owner |

Rules:
- Only issues with an acceptance criterion (the roadmap task line) can be committed.
- The sprint goal and the list of committed issues are set as the GitHub Project iteration fields; the
  roadmap sync (`scripts/ops/roadmap-sync.mjs`) keeps issue titles, labels and `[x]` state in step with
  `docs/roadmap/`.
- Unfinished issues return to the backlog at the end of the sprint; they are not silently carried.

## Sprint-review build (OPS-0002)

Every sprint ends with a tagged build on the Steam `qa` branch:

1. Tag `sprint-<n>` on `main` after the last merge of the sprint (Friday 12:00).
2. The PLT pipeline builds the tag and pushes it to the Steam `qa` branch (SteamPipe, PLT-owned).
3. The producer writes a one-page note from [templates/sprint-review-note.md](templates/sprint-review-note.md)
   — *what changed / what to test / known issues* — saved as `docs/production/reviews/sprint-<n>.md`
   and linked from the review invite.
4. The review is played on that build, never on a developer machine.

## Weekly status note (OPS-0003)

Every Friday by 16:00 the producer posts the status note (template:
[status/TEMPLATE.md](status/TEMPLATE.md)) to the production channel and commits it as
`docs/production/status/<yyyy-mm-dd>.md`. It covers: burn-up versus forecast
(`node scripts/ops/burnup.mjs`), risks that moved ([risks.md](risks.md)), decisions needed (linking
[decisions.md](decisions.md) entries in `Proposed`), next week's focus, and the hours check below.

## Sustainable pace (OPS-0005)

- Planned load is **≤ 40 hours per person per week**; sprint planning sums each person's committed
  sizes (S ≈ 4 h, M ≈ 16 h, L ≈ 60 h spread across sprints) against 32 h of plannable time per week (the
  rest is meetings, review and support).
- Everyone logs weekly hours in the status note's hours table (self-reported, no tracking software).
- **Two consecutive weeks above 45 h for anyone** trigger a scope review in the next status note: the
  producer proposes cuts or date moves through [change-control.md](change-control.md). Crunch is not an
  accepted mitigation for any risk in the register.
- Launch and festival weeks are planned in advance with time off in lieu the following week.

## Milestone retrospectives (OPS-0006)

After every gate (M0, Demo, Alpha, Beta, Release) the producer runs a 60-minute retrospective using
[templates/milestone-retro.md](templates/milestone-retro.md): what we planned vs what happened
(burn-up snapshot), what to keep, what to change. It produces **at most five actions**, each an issue
labelled `retro:<gate>` with an owner and due date; open retro actions are listed in every status note
until closed.
