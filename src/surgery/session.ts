import { awardAchievements, type AchievementId } from './achievements';
import { TIP_AFTER_FAILURES, tipFor } from './hints';
import { unlockedLitanies } from './litany';
import { Operation, type OperationDef, type OperationOptions } from './operation';
import { DIFFICULTIES } from './difficulty';
import { loadProgress, recordChapter, recordRun, storeProgress, type Progress } from './progress';
import { TUTORIALS } from './tutorial';

/**
 * The live meta-progression for this session (loaded once; saved after every
 * change) and the glue the scenes use: which options an operation starts with,
 * and what a finished operation writes back.
 */
export const progress: Progress = loadProgress();

/** Options for starting an operation from the player's save (difficulty, assists, kit, hints, tutorial). */
export function operationOptions(def: OperationDef, extra: OperationOptions = {}): OperationOptions {
  const rites = unlockedLitanies(progress.chaptersCleared + 1);
  return {
    difficulty: progress.difficulty,
    assists: { ...progress.assists },
    litanyVariant: rites.includes(progress.litany) ? progress.litany : 'stillness',
    upgrades: [...progress.upgrades],
    tinctures: progress.tincture !== 'red' ? [progress.tincture] : [],
    hintsSeen: [...progress.hintsSeen],
    tutorial: !!TUTORIALS[def.id] && !progress.tutorialSkip && !progress.best[def.id],
    ...extra,
  };
}

export interface RunSummary {
  newBest: boolean;
  fee: number;
  achievements: AchievementId[];
  /** A strategy tip after repeated failures on this op. */
  tip: string | null;
}

/** Record a finished (won or lost) operation on the save. */
export function finishOperation(op: Operation): RunSummary {
  const won = op.status === 'won';
  const { newBest, fee } = recordRun(progress, {
    opId: op.def.id,
    won,
    rank: op.rank(),
    score: op.score,
    difficulty: op.difficulty,
    flags: op.resultFlags(),
    challenge: op.opts.challenge,
    time: Math.round(op.timeLimit - op.timeLeft),
  });
  for (const h of op.hintsShown) if (!progress.hintsSeen.includes(h)) progress.hintsSeen.push(h);
  const achievements = awardAchievements(progress, op);
  const fails = progress.fails[op.def.id] ?? 0;
  const tip = !won && fails >= TIP_AFTER_FAILURES ? (tipFor(op)?.text ?? null) : null;
  storeProgress(progress);
  return { newBest, fee, achievements, tip };
}

/** A chapter's last step was reached. */
export function finishChapter(chapter: number): void {
  if (recordChapter(progress, chapter)) storeProgress(progress);
}

export function saveProgress(): void {
  storeProgress(progress);
}

/** Notes for the patient chart: difficulty, whether the lens will be needed, the Litany, constitution. */
export function briefingNotes(def: OperationDef, difficulty = progress.difficulty): string[] {
  const out = [`Difficulty: ${DIFFICULTIES[difficulty].name}`];
  // Spawn every phase into a scratch operation to see what hides.
  try {
    const scratch = new Operation(def, { difficulty });
    let hidden = false;
    for (let i = 0; i < def.phases.length && !hidden; i++) {
      scratch.phase = i;
      hidden = def.phases[i].spawn(scratch).some((e) => e.hidden);
    }
    if (hidden && def.tools.includes('lens')) out.push('Something hides beneath the skin: the Scrying Lens will be needed.');
  } catch {
    // Content that needs a live operation to spawn: no lens note.
  }
  if (def.litany === false) out.push('The Litany is not yet known — or is sealed for this patient.');
  if (def.constitution === 'frail') out.push('Frail: he cannot bear as much (max vitals ×0.8).');
  if (def.constitution === 'hardy') out.push('Hardy: he shrugs off some of the bleeding.');
  if (def.fakeVitals) out.push('His pulse lies. Trust the lens over the heart.');
  return out;
}
