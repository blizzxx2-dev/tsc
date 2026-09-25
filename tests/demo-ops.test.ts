/** Per-operation demo tuning checks (GAM-J) and bot-harness coverage. */
import { describe, expect, it } from 'vitest';
import { allOperations } from '../src/content/campaign';
import { Sigil } from '../src/surgery/entities';
import { Entity } from '../src/surgery/entity';
import { Operation } from '../src/surgery/operation';
import { playWithBot } from './bot';
import { testDef } from './harness-gameplay';

const byId = (id: string) => allOperations().find((d) => d.id === id)!;
const seeds = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe('GAM-J harness', () => {
  it('GAM-0184: the bot fails loudly on an entity kind it does not know', () => {
    class Mystery extends Entity {
      draw(): void {}
    }
    expect(() => playWithBot(testDef(() => [new Mystery({ x: 600, y: 400 })]))).toThrow(/unknown entity kind Mystery/);
  });

  it('GAM-0184: the bot handles barb nicks, two-stage bolts, wadding and the lead dish', () => {
    const events: string[] = [];
    const collect = (e: { kind: string; label?: string }) => e.kind === 'rated' && e.label && events.push(e.label);
    expect(playWithBot(byId('op1-2'), { profile: 'steady', collect }).op.status).toBe('won');
    expect(events).toEqual(expect.arrayContaining(['Barbs freed', 'Arrow', 'Bolt']));
    expect(events).not.toContain('Snapped');
    expect(playWithBot(byId('op1-3'), { profile: 'steady', collect }).op.status).toBe('won');
    expect(events).toContain('Wadding');
    expect(playWithBot(byId('op2-5'), { profile: 'steady', collect }).op.status).toBe('won');
    expect(events).toContain('Hexstone');
  });
});

describe('GAM-J per-operation tuning (demo)', () => {
  it('GAM-0193: op1-3 — steady within 70 % of the time; a novice who leaves the wadding survives the fever', () => {
    const steady = playWithBot(byId('op1-3'), { profile: 'steady' }).op;
    expect(steady.timeLimit - steady.timeLeft).toBeLessThanOrEqual(steady.timeLimit * 0.7);
    for (const s of seeds(5)) {
      const op = playWithBot(byId('op1-3'), { profile: 'novice', mistakes: ['wadding'], seed: 13000 + s, botSeed: s }).op;
      expect(op.status, `seed ${s}`).toBe('won');
    }
  });

  it('GAM-0194: op1-4 — buboes swell ≥ 30 s; the novice lances every one before it bursts on ≥ 18/20 seeds', () => {
    let clean = 0;
    for (const s of seeds(20)) {
      const op = playWithBot(byId('op1-4'), { profile: 'novice', seed: 14000 + s, botSeed: s }).op;
      if (op.status === 'won' && op.counts.miss === 0) clean++;
    }
    expect(clean).toBeGreaterThanOrEqual(18);
  });

  it('GAM-0196: op2-2 — hexstone whispers never alone kill a novice (min vitals ≥ 25)', () => {
    for (const s of seeds(10)) {
      const op = playWithBot(byId('op2-2'), { profile: 'novice', seed: 22000 + s, botSeed: s }).op;
      expect(op.status).toBe('won');
      expect(op.minVitals, `seed ${s}`).toBeGreaterThanOrEqual(25);
    }
  });

  it('GAM-0198: op2-4 — sigils of 4–7 strokes; the 4 s regress never catches a novice', () => {
    const op = new Operation(byId('op2-4'));
    for (let i = 0; i < 200 && op.phase < 1; i++) op.update(1 / 60);
    const sigils = byId('op2-4')
      .phases[1].spawn(op)
      .filter((e): e is Sigil => e instanceof Sigil);
    for (const s of sigils) expect(s.segs.length).toBeGreaterThanOrEqual(4);
    for (const s of sigils) expect(s.segs.length).toBeLessThanOrEqual(7);
    for (const s of seeds(10)) {
      let regress = 0;
      const run = playWithBot(byId('op2-4'), {
        profile: 'novice',
        seed: 24000 + s,
        botSeed: s,
        collect: (e) => e.kind === 'hint' && e.key === 'sigil-regress' && regress++,
      }).op;
      expect(run.status).toBe('won');
      expect(regress, `seed ${s}`).toBe(0);
    }
  });
});
