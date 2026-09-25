import { describe, expect, it } from 'vitest';
import { rakeGroups } from '../../../src/art/clawRake';
import { clawRake } from '../../../src/content/ops/ch2';

describe('claw rakes as one wound (ART-0187)', () => {
  it('groups parallel, close claw cuts; leaves a lone or crossing cut alone', () => {
    const cuts = clawRake(0, 0, -0.5, 100).map((s) => {
      const sp = s as unknown as { at: [number, number]; angle: number; len: number };
      const dx = (Math.cos(sp.angle) * sp.len) / 2;
      const dy = (Math.sin(sp.angle) * sp.len) / 2;
      return { a: { x: sp.at[0] - dx, y: sp.at[1] - dy }, b: { x: sp.at[0] + dx, y: sp.at[1] + dy } };
    });
    expect(cuts.length).toBeGreaterThanOrEqual(3);
    const lone = { a: { x: 400, y: 400 }, b: { x: 480, y: 400 } };
    const crossing = { a: { x: -10, y: -50 }, b: { x: 10, y: 50 } };
    const groups = rakeGroups([...cuts, lone, crossing]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(cuts.length);
  });
});
