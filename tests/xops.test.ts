/** The X-op ladder (GAM-0215) and each Hour's remix (BOS-0164..0171). */
import { describe, expect, it } from 'vitest';
import { X_OPS, xOp, xOpDef, xOpOptions, xUnlocked, type XOp } from '../src/content/challenge';
import { LATER_X_BASES } from '../src/content/challengeLater';
import { BOSS_OPS } from '../src/surgery/bosses/codex';
import { ComplineMalison } from '../src/surgery/bosses/compline';
import { NoneMalison } from '../src/surgery/bosses/none';
import { PrimeMalison } from '../src/surgery/bosses/prime';
import { SextMalison } from '../src/surgery/bosses/sext';
import { TerceMalison } from '../src/surgery/bosses/terce';
import { VespersMalison } from '../src/surgery/bosses/vespers';
import type { Entity } from '../src/surgery/entity';
import { LaudsMalison } from '../src/surgery/lauds';
import { Malison } from '../src/surgery/malison';
import { Operation } from '../src/surgery/operation';
import { freshProgress, recordChapter, recordRun } from '../src/surgery/progress';
import { playWithBot } from './bot';

const baseOf = (x: XOp) => x.base ?? LATER_X_BASES[x.id as keyof typeof LATER_X_BASES];
const defOf = (id: string) => {
  const x = xOp(id)!;
  return xOpDef(x, baseOf(x));
};

/** Start an X-op and skip ahead (clearing what stands before it) until its Malison is on the table. */
function bossOf<T extends Entity>(id: string, cls: abstract new (...a: never[]) => T): { op: Operation; boss: T } {
  const x = xOp(id)!;
  const op = new Operation(defOf(id), xOpOptions(x));
  for (let i = 0; i < 60 * 600; i++) {
    op.update(1 / 60);
    const b = op.entities.find((e): e is T => e instanceof cls && e.alive);
    if (b) return { op, boss: b };
    for (const e of op.entities) if (e.required && !e.boss) e.kill();
  }
  throw new Error(`${id}: no boss`);
}

describe('GAM-0215: the full X-op ladder', () => {
  it('one X-op per Malison Hour; X2–X8 unlock by clearing their chapter with an A on its Hour', () => {
    expect(X_OPS.map((x) => x.hour)).toEqual(['matins', 'lauds', 'prime', 'terce', 'sext', 'none', 'vespers', 'compline']);
    for (const x of X_OPS.slice(1)) {
      expect(x.unlock.rank, x.id).toBe('A');
      expect(BOSS_OPS[x.unlock.bossOp!], x.id).toBe(x.hour);
      expect(baseOf(x)?.id, x.id).toBe(x.unlock.bossOp);
    }
    const x5 = xOp('x5')!;
    const p = freshProgress('full');
    for (let c = 1; c <= 4; c++) recordChapter(p, c);
    // Demo edition (the test build): Chapters III–V are not in the bundle, so their X-ops are not built.
    expect(x5.base).toBeNull();
    expect(xUnlocked(p, { ...x5, base: baseOf(x5) })).toBe(false);
    recordRun(p, { opId: 'op4-7', won: true, rank: 'B', score: 1, difficulty: 'surgeon', flags: [] });
    expect(xUnlocked(p, { ...x5, base: baseOf(x5) })).toBe(false);
    recordRun(p, { opId: 'op4-7', won: true, rank: 'A', score: 2, difficulty: 'surgeon', flags: [] });
    expect(xUnlocked(p, { ...x5, base: baseOf(x5) })).toBe(true);
  });

  it('the expert bot clears every rung', () => {
    for (const x of X_OPS) {
      const op = playWithBot(xOpDef(x, baseOf(x)), { profile: 'expert', ...xOpOptions(x) }).op;
      expect(op.status, x.id).toBe('won');
    }
  });
});

describe('Hour remixes', () => {
  it('BOS-0164: X1 — 1.5× HP, 3 s / 2 s rhythm, the Eye from the start; the expert clears 20 seeds', () => {
    const { boss } = bossOf('x1', Malison);
    expect(boss.maxHp).toBeCloseTo(150);
    expect([boss.veilTime, boss.openTime]).toEqual([3, 2]);
    expect(boss.phase.key).toBe('vigil');
    expect(boss.eyeOut).toBe(true);
    const x = xOp('x1')!;
    for (let s = 1; s <= 20; s++)
      expect(playWithBot(xOpDef(x), { profile: 'expert', seed: 4100 + s, botSeed: s, ...xOpOptions(x) }).op.status, `seed ${s}`).toBe('won');
  });

  it('BOS-0165: X2 — six Voices, a 1.0 s response window, a dawn flare every 8 s', () => {
    const { boss } = bossOf('x2', LaudsMalison);
    expect(boss.tune.voices).toBe(6);
    expect(boss.voices.filter((v) => v.alive).length).toBe(6);
    expect(boss.tune.response).toBe(1);
    expect(boss.tune.flareEvery).toBe(8);
  });

  it('BOS-0166: X3 — four names in parallel from the start; ink writes after 5 s', () => {
    const { op, boss } = bossOf('x3', PrimeMalison);
    for (let i = 0; i < 60 * 5; i++) op.update(1 / 60);
    expect(boss.phaseNo).toBe(1);
    expect(boss.living.length).toBe(4);
    expect(boss.tune.inkWrites).toBe(5);
  });

  it('BOS-0167: X4 — the salve pot back to 46; tongues leap every 3.5 s', () => {
    const { op, boss } = bossOf('x4', TerceMalison);
    expect(op.tuning.salve.capacity).toBe(46);
    expect(boss.tune.leapEvery).toBe(3.5);
  });

  it('BOS-0168: X5 — torpor starts at 150 ms; the false vitals are permanent', () => {
    const { boss } = bossOf('x5', SextMalison);
    expect(boss.lag).toBeCloseTo(0.15);
    expect(boss.tune.permanentFalse).toBe(true);
  });

  it('BOS-0169: X6 — five split segments; heart contact always instant loss', () => {
    const { boss } = bossOf('x6', NoneMalison);
    expect(boss.tune.segments).toBe(5);
    expect(boss.tune.segmentsLethal).toBe(true);
  });

  it('BOS-0170: X7 — only three lamps, dimming over 9 s', () => {
    const { boss } = bossOf('x7', VespersMalison);
    expect(boss.lamps.length).toBe(3);
    for (const l of boss.lamps) expect(l.dimTime).toBe(9);
  });

  it('BOS-0171: X8 — no silence nodes, the Litany stolen for good, a 0.4 s combo window', () => {
    const { boss } = bossOf('x8', ComplineMalison);
    expect(boss.tune.noNodes).toBe(true);
    expect(boss.tune.comboWindow).toBe(0.4);
  });
});
