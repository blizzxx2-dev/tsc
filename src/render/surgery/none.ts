/** How the entities of `surgery/bosses/none.ts` draw (GAM-0012: moved out of the simulation). */
import { drawer } from './registry';
import { hex } from '../color';
import { surfDisc, surfLine } from '../../surgery/entities';
import { TAU } from '../../surgery/bosses/common';
import { drawBossRing } from './bossRing';
import { TunnelScar, BurrowRipple, BurrowSegment, NoneMalison } from '../../surgery/bosses/none';

drawer(TunnelScar, {
  surface(g, e) {
    surfLine(g, [{ x: e.pos.x - Math.cos(e.angle) * 22, y: e.pos.y - Math.sin(e.angle) * 22 }, { x: e.pos.x + Math.cos(e.angle) * 22, y: e.pos.y + Math.sin(e.angle) * 22 }], 10, 0.2, 0.2, 0, 0.3);
  },
  draw(g, e) {
    if (e.t < 2) g.circle(e.pos.x, e.pos.y, 3, hex('#ff5040', 0.6));
  },
});

drawer(BurrowRipple, {
  surface(g, e, op) {
    if (!e.owner.hidden) return;
    if (e.owner.surfacingT > 0) {
      // The bulge swells where the core will break through.
      const k = 1 - e.owner.surfacingT;
      surfDisc(g, e.pos, 30 + 26 * Math.max(0, k), 0, 0.2, 0, 1);
      return;
    }
    surfDisc(g, e.pos, 34 + 6 * Math.sin(op.elapsed * 6), 0, 0.15, 0, 0.9);
  },
  draw(g, e, op) {
    // Ninth-hour gloom over the field.
    if (e.owner.gloom) g.rect(0, 0, 1320, 820, hex('#05040c', 0.22));
    if (e.owner.surfacingT > 0) g.arc(e.pos.x, e.pos.y, 40, 2, hex('#e0a0a0', 0.6), 1 - e.owner.surfacingT);
    if (!e.owner.hidden || e.owner.stage !== 1) return;
    g.arc(e.pos.x, e.pos.y, 26 + 8 * ((op.elapsed * 1.5) % 1), 2, hex('#e0b0b0', 0.25 * (1 - ((op.elapsed * 1.5) % 1))));
  },
});

drawer(BurrowSegment, {
  surface(g, e) {
    surfDisc(g, e.pos, 26, 0.1, 0.25, 0.1, 0.8);
  },
  draw(g, e, op) {
    const { x, y } = e.pos;
    const a = op.elapsed * 12;
    for (let i = 0; i < 4; i++) g.circle(x - Math.cos(a + i) * i * 3, y - Math.sin(a + i) * i * 3, 7 - i, hex('#3a1020', 0.9));
    g.circle(x, y, 3, hex('#e04060'));
    if (e.heat > 0) g.arc(x, y, 16, 3, hex('#ff9040'), e.heat / 0.7);
  },
});

drawer(NoneMalison, {
  surface(g, e) {
    surfDisc(g, e.pos, 30, 0.15, 0.2, 0, e.hidden ? 0.9 : 0.5);
  },
  draw(g, e, op) {
    const t = op.elapsed;
    // The heart, and how near the burrower is to it.
    const eta = Math.min(e.stage === 2 ? Math.min(...e.segments.filter((s) => s.alive).map((s) => s.eta), 99) : e.eta, 30);
    const near = 1 - eta / 30;
    g.glow(e.heart.x, e.heart.y, 50, hex('#ff3040', 0.15 + 0.25 * near * (0.5 + 0.5 * Math.sin(t * (4 + near * 12)))));
    g.arc(e.heart.x, e.heart.y, 34, 3, hex(near > 0.8 ? '#ff4040' : '#e0a0a0', 0.8), near);
    const { x, y } = e.pos;
    if (e.stage === 2) return;
    const r = e.stage === 3 ? 10 + e.size * 6 : 20;
    if (e.stage === 1 && e.hidden) return;
    g.glow(x, y, r * 2.5, hex(e.exposed ? '#ff9050' : '#b04060', 0.25));
    g.circleGrad(x, y, r, e.hurtFlash > 0 ? hex('#ffc080') : hex('#5a1828'), hex('#1a0408', 0.6));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + t * 3;
      g.line({ x: x + Math.cos(a) * r * 0.5, y: y + Math.sin(a) * r * 0.5 }, { x: x + Math.cos(a) * r * 1.3, y: y + Math.sin(a) * r * 1.3 }, 2, hex('#e8c0c8', 0.7));
    }
    if (e.exposed) g.arc(x, y, r + 10, 3, hex('#ff8040'), e.exposedT / 3);
    if (e.trackedT > 0) g.arc(x, y, r + 10, 2, hex('#b9d7ff'), e.trackedT / 4);
    if (e.stage === 3 && e.size === 0) g.arc(x, y, r + 12, 3, hex('#f5d76e'), e.pullT / e.tune.pullWindow);
    drawBossRing(g, e.pos, r + 4, e.hp / e.maxHp, [0.7, 0.35], '#e06080');
  },
});
