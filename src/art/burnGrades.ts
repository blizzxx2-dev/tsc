/**
 * Burn grades (GAM-0074): one table for how a fire burn of each grade looks, shared by the field
 * (`Burn.draw` → fireBurnArt) and the briefing chart, so a "charred" burn on the chart is the same
 * picture the surgeon then meets on the table.
 *
 * Grade 3 (charred): a black eschar core — fire burns of radius ≥ the grade-3 radius.
 * Grade 2 (blistered): raised, weeping blisters with eschar flakes still on.
 * Grade 1 (pink): reddened, debrided flesh once the flakes are off.
 */
export type BurnGrade = 1 | 2 | 3;

export const BURN_GRADES: Record<BurnGrade, { key: 'pink' | 'blistered' | 'charred'; severity: number }> = {
  1: { key: 'pink', severity: 0.35 },
  2: { key: 'blistered', severity: 0.62 },
  3: { key: 'charred', severity: 1 },
};

/** Field severity for fireBurnArt: the grade's, with a blistered burn easing toward pink as its flakes come off. */
export function burnSeverity(grade: BurnGrade, flakesLeft = 1): number {
  if (grade !== 2) return BURN_GRADES[grade].severity;
  return BURN_GRADES[1].severity + (BURN_GRADES[2].severity - BURN_GRADES[1].severity) * (0.4 + 0.6 * flakesLeft);
}

/** The grade a freshly spawned fire burn of `radius` arrives with. */
export const spawnGrade = (radius: number, grade3Radius: number): BurnGrade => (radius >= grade3Radius ? 3 : 2);
