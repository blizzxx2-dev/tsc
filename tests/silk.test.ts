import { describe, expect, it } from 'vitest';
import { WebSilk } from '../src/surgery/ailments/silk';
import { start } from './harness';

describe('brood silk (ART-0217, CON-0066)', () => {
  it('each lancet stroke across a strand cuts it; the last cut frees the field', () => {
    const op = start(() => []);
    const w = new WebSilk({ x: 660, y: 400 }, op, 3, 100);
    op.spawn(w);
    const stroke = (i: number, tool: 'lancet' | 'tongs' = 'lancet') => {
      const s = w.strands[i];
      const m = { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 };
      const dx = s.b.x - s.a.x;
      const dy = s.b.y - s.a.y;
      const l = Math.hypot(dx, dy);
      w.onSweep(
        op,
        {
          pos: { x: m.x + (-dy / l) * 20, y: m.y + (dx / l) * 20 },
          prev: { x: m.x - (-dy / l) * 20, y: m.y - (dx / l) * 20 },
          down: true,
          pressed: false,
          released: false,
        },
        tool,
      );
    };
    stroke(0, 'tongs');
    expect(w.left).toBe(3);
    stroke(0);
    expect(w.left).toBe(2);
    stroke(1);
    stroke(2);
    expect(w.left).toBe(0);
    expect(w.alive).toBe(false);
  });
});
