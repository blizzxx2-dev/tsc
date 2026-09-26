/** How the entities of `surgery/bosses/terce.ts` draw (GAM-0012: moved out of the simulation). */
import { drawer } from './registry';
import { hex } from '../color';
import { surfDisc } from '../../surgery/entities';
import { TAU } from '../../surgery/bosses/common';
import { drawBossRing } from './bossRing';
import { assistsOf } from '../../surgery/bosses/signals';
import { FlameTongue, TerceMalison } from '../../surgery/bosses/terce';

drawer(FlameTongue, {
  surface(g, e) {
    surfDisc(g, e.pos, e.radius * 1.6, 0, 0.2, 0.5 * (1 - e.cov.fraction), 0.4);
  },
  draw(g, e, op) {
    const { x, y } = e.pos;
    const t = op.elapsed;
    if (e.state === 'flame') {
      const live = 1 - e.cov.fraction * 0.8;
      g.glow(x, y, e.radius * 2.2, hex('#c060ff', 0.3 * live));
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.35;
        const h = e.radius * (1 + 0.5 * Math.sin(t * 9 + i * 1.7)) * live;
        g.quadCurve({ x: x + (i - 3) * 5, y }, { x: x + Math.cos(a) * h * 0.5 + Math.sin(t * 6 + i) * 4, y: y - h * 0.6 }, { x: x + Math.cos(a) * h * 0.3, y: y - h * 1.2 }, 4, hex(i % 2 ? '#e080ff' : '#ffb0f0', 0.7 * live));
      }
      for (const c of e.cov.cells) if (c.done) g.circleGrad(x + c.x, y + c.y, 10, hex('#bff0c8', 0.3), hex('#bff0c8', 0));
    } else {
      g.glow(x, y, 26, hex('#ff7040', 0.35 + 0.2 * Math.sin(t * 7)));
      g.circle(x, y, 7, hex('#ffb060'));
      g.circle(x, y, 3, hex('#fff0c0'));
    }
  },
});

drawer(TerceMalison, {
  surface(g, e) {
    surfDisc(g, e.pos, e.radius * 2, 0, 0.15, 0.6, 0.5);
  },
  draw(g, e, op) {
    const t = op.elapsed;
    if (e.tellZone >= 0) {
      const z = e.zones[e.tellZone];
      g.glow(z.x, z.y, 80, hex('#ff8020', 0.35 + 0.25 * Math.sin(t * 20)));
    }
    const { x, y } = e.pos;
    if (e.stage < 3) {
      // Hidden in the organ: only a sullen glow beneath the flesh.
      g.glow(x, y, 70, hex('#a040ff', 0.15 + 0.08 * Math.sin(t * 4)));
      return;
    }
    if (e.hazed) {
      if (assistsOf(op).hazeOutline) {
        // Accessible haze (BOS-0069): an orange outline instead of shimmer, and a ghost of where the instrument really lands.
        g.arc(x, y, 150, 2, hex('#ff9040', 0.7));
        g.circle(op.pointer.x, op.pointer.y, 6, hex('#ffb070', 0.5));
        g.arc(op.pointer.x, op.pointer.y, 10, 1.5, hex('#ffb070', 0.8));
      } else for (let i = 0; i < 5; i++) g.glow(x + Math.sin(t * 2 + i) * 60, y - 30 - i * 14, 70, hex('#ffa060', 0.06));
    }
    g.glow(x, y, e.radius * 2.6, hex('#ff6020', 0.3));
    g.circleGrad(x, y, e.radius, e.hurtFlash > 0 ? hex('#fff0c0') : hex('#ff9040'), hex('#801000', 0.6));
    g.circle(x, y, e.radius * 0.4, hex('#fff8e0', 0.9));
    g.dashed(
      Array.from({ length: 33 }, (_, i) => ({ x: x + Math.cos((i / 32) * TAU) * 70, y: y + Math.sin((i / 32) * TAU) * 70 })),
      2,
      hex('#ffd0a0', 0.35),
      8,
      8,
      t * 20,
    );
    if (e.hazeClearT > 0) g.arc(x, y, e.radius + 16, 2, hex('#b9d7ff', 0.7), e.hazeClearT / 4);
    drawBossRing(g, e.pos, e.radius + 8, e.hp / e.maxHp, [0.65, 0.3], '#ff9040');
  },
});
