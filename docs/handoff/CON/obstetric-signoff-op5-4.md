# Obstetric sign-off — op5-4 "Under the Hollow Moon" (CON-0183)

A qualified obstetrician or midwife must approve the visuals and text of op5-4 before Beta.

## What to review
- Scene s5-8 (`src/content/chapter5.ts`, `STORY_5_8`) and operation `OP_5_4`.
- The mechanic (`Infant` in `src/surgery/ailments/hollownight.ts`): a low incision; the child is
  lifted with forceps — grip held still ≥ 0.6 s, not > 2.5 s, carried slowly off the table; two
  vessels tied or seared; the incision closed. The child's vigour ebbs at 0.5/s while undelivered.
- In-game capture: build (`npx vite build`, `npx vite preview`) and open `?op=op5-4`.

## Questions for the consultant
1. Is the sequence recognisably a historical caesarean on a living mother (period-appropriate, no
   modern technique shown as period practice)?
2. Is anything distressing beyond what the scene needs (gore level, the child's vigour meter, the
   failure state "The child could not be saved")? Should the failure state be removed?
3. Wording of the callouts and of the midwives' superstition in s5-8.

## Record
Consultant name, date, decision, required changes (with commit links once made).
