# Vendor feedback protocol (ART-0346)

How we give notes to art vendors and freelancers, and what they can expect from us. It is part
of every brief pack (ART-0342) and is referenced in the contract terms (ART-0344).

## 1. Notes are paintovers

- Every note that concerns shape, value, colour or composition is given as a **paintover** on the
  submitted image: a copy of the file with a separate layer drawn over it, exported as
  `<asset-id>_r<round>_notes.png` next to the submission in the delivery folder.
- Paintovers use one colour per kind of note: **red** = must change, **blue** = suggestion,
  **green** = keep this, it works.
- Numbered callouts on the paintover match a numbered list in the review row
  (`docs/art/reviews/<yyyy>-<ww>.md`). Each item is one sentence and says *what* to change, and *why* when that isn't obvious.
- Text-only notes are allowed only for naming, export or technical issues (wrong size, alpha
  fringe, palette out of range). These come from the automated delivery check where possible.
- Reference images go in the review row as links. Never paint over someone else's copyrighted image.

## 2. Stages and revision rounds

Stages follow the pipeline: **thumbnail → rough → line → colour → in-engine**
([pipeline.md](../pipeline.md#approval-stages-art-0029)).

- **At most 2 revision rounds per stage.** Round 1 gives the full set of notes. Round 2 only
  checks round 1 and may not add new notes, except where a round-1 fix caused a new problem.
- A third round is paid work: the art lead raises it as a change request with a cost and a date,
  and the producer approves it (change control).
- A stage is approved in writing in the review row ("Approved — <name>, <date>"). Work on the next
  stage starts only after that.
- If we change the brief mid-stage, the round counter restarts and the change is paid.

## 3. Our response time (SLA)

- **We review within 48 hours** (two working days) of a submission landing in the delivery
  folder and passing the automated check. The clock pauses at weekends and on public holidays
  in the art lead's location.
- A submission that fails the automated check is returned at once with the check's report. It
  doesn't start the 48 h clock.
- If we miss the 48 h, the vendor's due date for that asset moves by the same amount, with no
  penalty to them.
- The art lead is the single voice to the vendor. Director or producer notes reach the vendor
  only through the art lead's consolidated paintover.

## 4. What a vendor sends per round

- The layered master (PSD/KRA) and a flat PNG export at the spec size, named to the convention
  (`<category>/<subject-variant-state>.png`).
- A one-line changelog per numbered note ("3 — raised the collar, darker shadow side").
- For the in-engine stage: a screenshot from `?scene=artview` or the relevant scene, taken with
  the build we supply.

## 5. Escalation

If a vendor and the art lead disagree after round 2, the art director decides within 48 hours,
and the decision is recorded in the review row. If quality or schedule keeps slipping, the kill
fee and replacement clause in the contract (ART-0344) applies.
