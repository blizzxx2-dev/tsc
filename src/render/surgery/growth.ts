/** How the entities of `surgery/ailments/growth.ts` draw (GAM-0012: moved out of the simulation). */
import { drawer } from './registry';
import { hex } from '../color';
import { surfDisc } from './paint';
import { Growth, MutationBud, GROWTH } from '../../surgery/ailments/growth';

drawer(Growth, {
  surface(g, e) {
    surfDisc(g, e.pos, e.r * 1.6, 0, 0.2, 0, 0.6);
  },
  draw(g, e, op) {
    const pulse = 1 + Math.sin(op.elapsed * 3 + e.id) * 0.05;
    const r = e.r * pulse;
    for (const v of e.vessels) g.line(v.a, v.b, 4, hex(v.tied ? '#6a4a40' : '#8a1020'));
    for (const v of e.vessels) if (v.tied) g.circle((v.a.x + v.b.x) / 2, (v.a.y + v.b.y) / 2, 3, hex('#efe6c4'));
    g.circleGrad(e.pos.x, e.pos.y, r, hex('#b06868'), hex('#6a2a30'));
    if (e.variant === 'tooth') g.tri(e.pos.x - 5, e.pos.y + 4, e.pos.x + 5, e.pos.y + 4, e.pos.x, e.pos.y - 10, hex('#efe8d8'));
    if (e.variant === 'finger') g.line(e.pos, { x: e.pos.x + r * 0.6, y: e.pos.y - r * 0.5 }, 7, hex('#d8a898'));
    if (e.variant === 'eye') {
      // The eye-bud follows the surgeon's hand.
      const dx = op.cursor.x - e.pos.x;
      const dy = op.cursor.y - e.pos.y;
      const l = Math.hypot(dx, dy) || 1;
      g.circle(e.pos.x, e.pos.y, r * 0.45, hex('#f0ece0'));
      g.circle(e.pos.x + (dx / l) * r * 0.2, e.pos.y + (dy / l) * r * 0.2, r * 0.18, hex('#2a1a10'));
    }
    if (e.excised) g.arc(e.pos.x, e.pos.y, r + 6, 2, hex('#ffebbe', 0.6));
    else if (op.guides) g.arc(e.pos.x, e.pos.y, r + 14, 1.5, hex('#ffebbe', 0.25));
    if (e.path.length > 1) g.polyline(e.path, 2, hex('#ff9090', 0.6));
  },
});

drawer(MutationBud, {
  draw(g, e, op) {
    const r = GROWTH.budR * (1 + Math.sin(op.elapsed * 5 + e.id) * 0.08);
    g.circleGrad(e.pos.x, e.pos.y, r, hex(e.rooted ? '#a06020' : '#d0a040'), hex('#5a3010'));
    if (!e.rooted) g.arc(e.pos.x, e.pos.y, r + 6, 2, hex('#ff8040', 0.6), 1 - e.age / GROWTH.budRoot);
    if (e.rooted) for (let i = 0; i < 4; i++) g.line(e.pos, { x: e.pos.x + Math.cos(i * 1.6) * r * 2, y: e.pos.y + Math.sin(i * 1.6) * r * 2 }, 2, hex('#5a3010', 0.7));
    if (e.path.length > 1) g.polyline(e.path, 2, hex('#ff9090', 0.6));
  },
});
