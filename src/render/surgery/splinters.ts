/** How the entities of `surgery/ailments/splinters.ts` draw (GAM-0012: moved out of the simulation). */
import { drawer } from './registry';
import { dist } from '../../core/math';
import { hex } from '../color';
import { GlassCluster, WoodSplinter } from '../../surgery/ailments/splinters';

drawer(GlassCluster, {
  draw(g, e, op) {
    for (const s of e.slivers) {
      if (s.taken) continue;
      if (s.seen) {
        g.tri(s.pos.x, s.pos.y - 4, s.pos.x - 3, s.pos.y + 3, s.pos.x + 3, s.pos.y + 2, hex('#e0f4ff', 0.9));
        g.glow(s.pos.x, s.pos.y, 8, hex('#ffffff', 0.3 + 0.3 * Math.sin(op.elapsed * 9 + s.pos.x)));
      } else if (op.tool === 'lens' && dist(s.pos, op.cursor) < op.tuning.lens.radius) {
        g.circle(s.pos.x, s.pos.y, 2, hex('#b9d7ff', 0.5 + 0.5 * Math.sin(op.elapsed * 12 + s.pos.y)));
      }
    }
  },
});

drawer(WoodSplinter, {
  draw(g, e) {
    const tail = { x: e.pos.x + Math.cos(e.grain) * e.len, y: e.pos.y + Math.sin(e.grain) * e.len };
    g.line(e.pos, tail, 5, hex('#8a6a40'));
    // Grain lines.
    for (let i = 1; i < 4; i++) {
      const t = i / 4;
      const p = { x: e.pos.x + (tail.x - e.pos.x) * t, y: e.pos.y + (tail.y - e.pos.y) * t };
      g.line(p, { x: p.x + Math.cos(e.grain) * 5, y: p.y + Math.sin(e.grain) * 5 }, 1, hex('#4a3420'));
    }
  },
});
