import type { Operation, OperationDef } from './operation';
import { replay, takeLog, type InputLog } from './replay';

/**
 * Leaderboard hook: a score is only submitted with the replay that produced it,
 * and the replay is re-simulated headlessly before it is accepted. The platform
 * layer (Steam) calls `prepareSubmission` after an eligible run and uploads the
 * result; the validator runs `verifySubmission` (the same code) on receipt.
 */
export interface Submission {
  board: string;
  score: number;
  rank: string;
  log: InputLog;
}

/** Runs with assists, upgrades, checkpoints or a slowed game never reach a board. */
export function eligible(op: Operation): boolean {
  return op.status === 'won' && op.resultFlags().filter((f) => f !== 'Novice' && f !== 'Master').length === 0 && op.difficulty !== 'novice';
}

export function prepareSubmission(op: Operation, board = op.def.id): Submission | null {
  if (!op.log || !eligible(op)) return null;
  return { board, score: op.score, rank: op.rank(), log: takeLog(op) };
}

/** Re-simulate the replay; accept only if it reproduces the claimed score and rank exactly. */
export function verifySubmission(def: OperationDef, sub: Submission): boolean {
  try {
    const op = replay(def, sub.log);
    return op.status === 'won' && op.score === sub.score && op.rank() === sub.rank && eligible(op);
  } catch {
    return false;
  }
}
