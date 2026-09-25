/**
 * Collects per-operation bot results and writes them to `reports/sim-report.json` (a CI artefact)
 * instead of printing a console line per op. Each suite owns one key in the file.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll } from 'vitest';
import type { Operation } from '../../src/surgery/operation';

export interface SimRow {
  op: string;
  status: string;
  lostReason?: string;
  score: number;
  rank: string;
  vitals: number;
  timeLeft: number;
  counts: Record<string, number>;
  maxCombo: number;
  phase: string;
  left: string[];
  [extra: string]: unknown;
}

export const REPORT_FILE = resolve(process.env.SIM_REPORT_FILE ?? 'reports/sim-report.json');
/** Per-suite parts (test files run in parallel workers); the sim project's global teardown merges them. */
export const PARTS_DIR = resolve('reports/.sim-parts');

/** A compact, human-readable summary of an operation's end state (used in assertion messages too). */
export function simRow(op: Operation, extra: Record<string, unknown> = {}): SimRow {
  return {
    op: op.def.id,
    status: op.status,
    ...(op.lostReason ? { lostReason: op.lostReason } : {}),
    score: op.score,
    rank: op.rank(),
    vitals: Math.round(op.vitals),
    timeLeft: Math.round(op.timeLeft),
    counts: { ...op.counts },
    maxCombo: op.maxCombo,
    phase: `${op.phase}/${op.phaseCount}`,
    left: op.entities.filter((e) => e.alive).map((e) => e.constructor.name),
    ...extra,
  };
}

export const describeRow = (r: SimRow): string =>
  `${r.op}: ${r.status}${r.lostReason ? ` (${r.lostReason})` : ''} score=${r.score} rank=${r.rank} vitals=${r.vitals} time=${r.timeLeft}s counts=${JSON.stringify(r.counts)} phase=${r.phase} left=${r.left.join(',')}`;

/** Register a suite; rows added to the returned array are flushed to the report after the file runs. */
export function simReport(suite: string): SimRow[] {
  const rows: SimRow[] = [];
  afterAll(() => {
    if (!rows.length) return;
    mkdirSync(PARTS_DIR, { recursive: true });
    const body = { generatedAt: new Date().toISOString(), rows: [...rows].sort((a, b) => a.op.localeCompare(b.op)) };
    writeFileSync(join(PARTS_DIR, `${suite}.json`), JSON.stringify(body, null, 2));
  });
  return rows;
}
