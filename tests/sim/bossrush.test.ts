/** BOS-0178: Boss Rush — all eight Hours back to back, vitals carried, one Litany for the night. */
import { describe, expect, it } from 'vitest';
import { BOSS_RUSH, bossRushUnlocked, RUSH_ORDER } from '../../src/content/bossRush';
import { freshProgress, recordChapter } from '../../src/surgery/progress';
import { Operation } from '../../src/surgery/operation';
import { playWithBot } from '../bot';

describe('BOS-0178 Boss Rush', () => {
  it('eight Hours in order, one Litany, unlocked by finishing the story', () => {
    expect(BOSS_RUSH.phases.length).toBe(RUSH_ORDER.length);
    expect(new Operation(BOSS_RUSH).litanyAllowed).toBe(1);
    const p = freshProgress('full');
    for (let c = 1; c <= 4; c++) recordChapter(p, c);
    expect(bossRushUnlocked(p)).toBe(false);
    recordChapter(p, 5);
    expect(bossRushUnlocked(p)).toBe(true);
  });

  it('the vitals carry from Hour to Hour, and the expert bot clears the night', { timeout: 300_000 }, () => {
    const encounters: string[] = [];
    const atPhase: number[] = [];
    const op = playWithBot(BOSS_RUSH, {
      profile: 'expert',
      maxSeconds: 2400,
      onOp: (o) => {
        o.events.on('boss', (e) => e.kind === 'encounter' && encounters.push(e.boss));
        o.events.on('phase', () => atPhase.push(Math.round(o.vitals)));
      },
    }).op;
    expect(
      op.status,
      `${op.lostReason} phase ${op.phase} t=${Math.round(op.elapsed)} ${op.entities
        .filter((e) => e.alive && e.required)
        .map((e) => e.constructor.name)
        .join(',')}`,
    ).toBe('won');
    expect(op.litanyUses).toBeLessThanOrEqual(1);
    // The patient does not start each Hour fresh.
    expect(atPhase.some((v) => v < 95)).toBe(true);
    expect(encounters.slice(0, 2)).toEqual(['matins', 'lauds']);
  });
});
