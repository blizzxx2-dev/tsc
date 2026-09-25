import { describe, expect, it } from 'vitest';
import { allOperations } from '../src/content/campaign';
import { Incision } from '../src/surgery/entities';
import { unlockedLitanies } from '../src/surgery/litany';
import {
  buyUpgrade,
  CHAPTER_FEE,
  freshProgress,
  migrateProgress,
  RANK_FEE,
  recordChapter,
  recordRun,
  setDifficulty,
  UPGRADE_TOTAL,
  UPGRADES,
  type UpgradeId,
} from '../src/surgery/progress';
import { Operation } from '../src/surgery/operation';
import { playWithBot } from './bot';
import { at, Hand, running } from './harness-gameplay';

describe('GAM-F/M progression', () => {
  it('GAM-0155: bests are kept per difficulty; results know when it is a NEW BEST', () => {
    const p = freshProgress();
    expect(recordRun(p, { opId: 'op1-1', won: true, rank: 'B', score: 3000, difficulty: 'surgeon', flags: [] }).newBest).toBe(true);
    expect(recordRun(p, { opId: 'op1-1', won: true, rank: 'C', score: 9000, difficulty: 'surgeon', flags: [] }).newBest).toBe(false);
    expect(recordRun(p, { opId: 'op1-1', won: true, rank: 'C', score: 1000, difficulty: 'novice', flags: [] }).newBest).toBe(true);
    expect(p.best['op1-1'].surgeon?.rank).toBe('B');
    expect(p.best['op1-1'].novice?.rank).toBe('C');
    expect(recordRun(p, { opId: 'op1-1', won: true, rank: 'B', score: 3100, difficulty: 'surgeon', flags: [] }).newBest).toBe(true);
  });

  it('GAM-0176: Master unlocks after Chapter II and is stored per save', () => {
    const p = freshProgress();
    expect(setDifficulty(p, 'master')).toBe(false);
    recordChapter(p, 1);
    expect(setDifficulty(p, 'master')).toBe(false);
    recordChapter(p, 2);
    expect(setDifficulty(p, 'master')).toBe(true);
    expect(migrateProgress(JSON.parse(JSON.stringify(p))).difficulty).toBe('master');
  });

  it('GAM-0227: instrument upgrades — one tier each, bought with fees, with their effects in the sim', () => {
    const p = freshProgress();
    p.fees = 5000;
    for (const id of Object.keys(UPGRADES) as UpgradeId[]) expect(buyUpgrade(p, id)).toBe(true);
    expect(buyUpgrade(p, 'fine-lancet')).toBe(false);
    expect(p.fees).toBe(5000 - UPGRADE_TOTAL);
    // Fine Lancet: +2 px incision tolerance.
    const trace = (upgrades: string[]) => {
      const op = running(() => [new Incision([at(-120, 0), at(120, 0)])], {}, { upgrades });
      new Hand(op).drag('lancet', [at(-120, 7), at(120, 7)], 300);
      return op.counts;
    };
    expect(trace([]).good).toBe(1);
    expect(trace(['fine-lancet']).cool).toBe(1);
    // Deep Leech draws 20 % faster; Waxed Thread widens spacing.
    const op = running(() => [], {}, { upgrades: ['waxed-thread'] });
    expect(op.tuning.stitch.goodMax).toBeCloseTo(48);
  });

  it('GAM-0228: upgrades are ignored in X-ops and flag results as "upgraded kit" elsewhere', () => {
    const def = allOperations()[0];
    expect(new Operation(def, { upgrades: ['deep-leech'] }).resultFlags()).toContain('upgraded kit');
    const x = new Operation(def, { upgrades: ['deep-leech'], challenge: 'x1' });
    expect(x.upgrades.size).toBe(0);
    expect(x.resultFlags()).not.toContain('upgraded kit');
  });

  it('GAM-0229: fees XS 300 / S 200 / A 120 / B 70 / C 30; a B-average player can own every upgrade by Chapter V', () => {
    expect(RANK_FEE).toEqual({ XS: 300, S: 200, A: 120, B: 70, C: 30 });
    expect(UPGRADE_TOTAL).toBe(2400);
    const p = freshProgress();
    for (let ch = 1; ch <= 4; ch++) {
      for (let i = 1; i <= 5; i++) recordRun(p, { opId: `op${ch}-${i}`, won: true, rank: 'B', score: 1, difficulty: 'surgeon', flags: [] });
      recordChapter(p, ch);
    }
    expect(p.fees).toBe(20 * 70 + 4 * CHAPTER_FEE);
    expect(p.fees).toBeGreaterThanOrEqual(UPGRADE_TOTAL);
    // Replaying at the same rank pays nothing more; improving pays the difference.
    const before = p.fees;
    expect(recordRun(p, { opId: 'op1-1', won: true, rank: 'B', score: 2, difficulty: 'surgeon', flags: [] }).fee).toBe(0);
    expect(recordRun(p, { opId: 'op1-1', won: true, rank: 'S', score: 3, difficulty: 'surgeon', flags: [] }).fee).toBe(130);
    expect(p.fees).toBe(before + 130);
  });

  it('GAM-0230: kit loadout — Litany rites unlock by chapter; the op runs with the chosen rite', () => {
    expect(unlockedLitanies(2)).toEqual(['stillness']);
    expect(unlockedLitanies(5)).toEqual(['stillness', 'vigil', 'mercy', 'wrath']);
    const op = running(() => [], { litany: true }, { litanyVariant: 'mercy' });
    expect(op.litanyVariant).toBe('mercy');
  });

  it('GAM-0233: demo progress (the original v1 save) carries into the full game', () => {
    const v1 = {
      version: 1,
      progress: { chapter: 1, step: 3 },
      best: { 'op1-1': { rank: 'A', score: 4000 }, 'op2-5': { rank: 'S', score: 7000 } },
      volume: 0.5,
    };
    const full = migrateProgress(v1, 'full');
    expect(full.edition).toBe('full');
    expect(full.best['op1-1'].surgeon).toEqual({ rank: 'A', score: 4000, flags: [] });
    expect(full.best['op2-5'].surgeon?.rank).toBe('S');
    const demo2 = freshProgress('demo');
    recordRun(demo2, { opId: 'op1-2', won: true, rank: 'S', score: 5000, difficulty: 'novice', flags: [] });
    const carried = migrateProgress(JSON.parse(JSON.stringify(demo2)), 'full');
    expect(carried.best['op1-2'].novice?.rank).toBe('S');
    expect(carried.fees).toBe(200);
  });

  it('GAM-0180: failures are counted per op (tips after two), cleared on a win', () => {
    const p = freshProgress();
    recordRun(p, { opId: 'op1-4', won: false, rank: 'C', score: 0, difficulty: 'surgeon', flags: [] });
    recordRun(p, { opId: 'op1-4', won: false, rank: 'C', score: 0, difficulty: 'surgeon', flags: [] });
    expect(p.fails['op1-4']).toBe(2);
    recordRun(p, { opId: 'op1-4', won: true, rank: 'B', score: 1, difficulty: 'surgeon', flags: [] });
    expect(p.fails['op1-4']).toBe(0);
  });

  it('GAM-0181: every demo op — novice bot wins on Novice with vitals ≥ 40 left; steady bot wins on Master', () => {
    for (const def of allOperations()) {
      const n = playWithBot(def, { profile: 'novice', difficulty: 'novice' }).op;
      expect(n.status, def.id).toBe('won');
      expect(n.vitals, def.id).toBeGreaterThanOrEqual(40);
      const m = playWithBot(def, { profile: 'steady', difficulty: 'master' }).op;
      expect(m.status, `${def.id} master`).toBe('won');
    }
  });
});
