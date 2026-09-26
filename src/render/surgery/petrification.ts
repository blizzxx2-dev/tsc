/** How the entities of `surgery/ailments/petrification.ts` draw (GAM-0012: moved out of the simulation). */
import { drawer } from './registry';
import { dist } from '../../core/math';
import { hex } from '../color';
import { drawCoverage, surfDisc } from './paint';
import { Petrification, STONE } from '../../surgery/ailments/petrification';

drawer(Petrification, {
  surface(g, e) {
    for (const p of e.plates) if (!p.healed) surfDisc(g, p.center, STONE.plateR * 1.5, 0, 0.1, 0.35, 0.2);
  },
  draw(g, e, op) {
    for (const p of e.plates) {
      if (p.healed) continue;
      if (!p.lifted) {
        g.circleGrad(p.center.x, p.center.y, STONE.plateR, hex('#9a968c'), hex('#5a5850'));
        for (let i = 1; i < p.nodes.length; i++) g.line(p.nodes[i - 1], p.nodes[i], 2, hex('#2a2824'));
        p.nodes.forEach((n, i) => {
          if (i < p.chipped) return;
          const next = i === p.chipped;
          g.circle(n.x, n.y, next ? 5 : 3, hex(next ? '#ffebbe' : '#d8d0c0', next ? 0.6 + 0.3 * Math.sin(op.elapsed * 6) : 0.5));
          if (op.guides) g.text(String(i + 1), n.x, n.y - 8, { size: 11, color: hex('#ffebbe', 0.8), align: 'center', shadow: false });
        });
      } else if (p.cov) {
        g.circleGrad(p.center.x, p.center.y, STONE.plateR, hex('#c04040', 0.5), hex('#c04040', 0));
        g.arc(p.center.x, p.center.y, STONE.plateR + 4, 2, hex('#ffebbe'), 1 - p.marginT / STONE.marginTime);
        drawCoverage(g, p.cov);
      }
    }
    // The organ glyph and, under the lens, the true front.
    g.circle(e.organ.x, e.organ.y, 9, hex('#c0182a', 0.7));
    if (op.tool === 'lens' && dist(op.cursor, e.pos) < op.tuning.lens.radius * 2) {
      const d = dist(e.pos, e.organ) || 1;
      const t = 1 - (e.front + STONE.lensAhead) / d;
      const f = { x: e.pos.x + (e.organ.x - e.pos.x) * t, y: e.pos.y + (e.organ.y - e.pos.y) * t };
      g.arc(e.pos.x, e.pos.y, dist(e.pos, f), 2, hex('#b0b0a8', 0.6));
    }
  },
});
