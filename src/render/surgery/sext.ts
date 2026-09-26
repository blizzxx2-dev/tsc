/** How the entities of `surgery/bosses/sext.ts` draw (GAM-0012: moved out of the simulation). */
import { drawer } from './registry';
import { hex } from '../color';
import { surfDisc } from './paint';
import { TAU } from '../../surgery/bosses/common';
import { drawBossRing } from './bossRing';
import { CrustPlate, OrganGlyph, SunDial, SextMalison } from '../../surgery/bosses/sext';

drawer(CrustPlate, {
  draw(g, e) {
    const { x, y } = e.pos;
    const pts = [0, 1, 2, 3, 4].map((i) => {
      const a = e.angle + (i / 5) * TAU;
      const r = 17 - (i % 2) * 3;
      return { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r };
    });
    g.poly(pts, hex('#8c8478'), hex('#b8b0a0'));
    if (e.hits > 0) g.line({ x: x - 10, y: y - 6 }, { x: x + 8, y: y + 9 }, 2, hex('#2a2620'));
  },
});

drawer(OrganGlyph, {
  draw(g, e) {
    const { x, y } = e.pos;
    const ink = hex(e.petrified ? '#8c8478' : '#d8b870', e.petrified ? 0.9 : 0.55);
    if (e.petrified) g.circle(x, y, 13, hex('#6c665c', 0.85));
    g.arc(x, y, 14, 1.6, ink);
    // The organ's sign: a heart's lobes, the lung's paired leaves, the liver's single wedge.
    if (e.organ === 'heart') {
      g.circle(x - 3.5, y - 2, 3.5, ink);
      g.circle(x + 3.5, y - 2, 3.5, ink);
      g.tri(x - 7, y - 1, x + 7, y - 1, x, y + 7, ink);
    } else if (e.organ === 'lung') {
      g.line({ x, y: y - 8 }, { x, y: y + 2 }, 1.4, ink);
      g.circle(x - 4, y + 2, 3.5, ink);
      g.circle(x + 4, y + 2, 3.5, ink);
    } else g.tri(x - 8, y - 4, x + 8, y - 4, x - 2, y + 7, ink);
    if (e.petrified) {
      g.line({ x: x - 9, y: y - 6 }, { x: x + 2, y: y + 1 }, 1.2, hex('#2a2620'));
      g.line({ x: x + 2, y: y + 1 }, { x: x + 8, y: y + 8 }, 1.2, hex('#2a2620'));
    }
  },
});

drawer(SunDial, {
  draw(g, e, op) {
    const { x, y } = e.pos;
    g.glow(x, y, 40, hex('#ffe080', 0.3));
    g.circle(x, y, 16, hex('#d8c070'));
    g.line({ x, y }, { x: x + Math.cos(op.elapsed * 0.3) * 14, y: y + Math.sin(op.elapsed * 0.3) * 14 }, 2, hex('#3a2a10'));
    if (e.heat > 0) g.arc(x, y, 22, 3, hex('#ff9040'), e.heat / e.holdTime);
  },
});

drawer(SextMalison, {
  surface(g, e) {
    surfDisc(g, e.pos, e.radius * 2, 0, 0.1, 0.1, 0.6);
  },
  draw(g, e, op) {
    const { x, y } = e.pos;
    const t = op.elapsed;
    const r = e.radius;
    // The stone front (BOS-0080): a grey crust creeping out over the flesh.
    if (e.stone > r) {
      g.circleGrad(x, y, e.stone, hex('#6c665c', 0.28), hex('#6c665c', 0.12));
      g.arc(x, y, e.stone, 2, hex('#a8a090', 0.5));
    }
    g.glow(x, y, r * 2.4, hex(e.exposed ? '#ffd060' : '#a09070', 0.22));
    g.circleGrad(x, y, r, e.hurtFlash > 0 ? hex('#fff0c0') : hex('#c8a860'), hex('#504020', 0.6));
    // A heavy-lidded sun-face, dozing.
    const lid = e.stillborn ? 0.05 : 0.15 + 0.1 * Math.sin(t * 0.8);
    g.ellipse(x, y - 2, r * 0.5, r * lid, 0, hex('#2a1a08'));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + t * 0.05;
      g.line({ x: x + Math.cos(a) * r * 1.05, y: y + Math.sin(a) * r * 1.05 }, { x: x + Math.cos(a) * r * 1.4, y: y + Math.sin(a) * r * 1.4 }, 3, hex('#d8b870', 0.6));
    }
    if (e.stillborn) g.arc(x, y, r + 20, 4, hex('#fff0a0', 0.5 + 0.3 * Math.sin(t * 3)));
    if (e.stunT > 0) g.arc(x, y, r + 14, 3, hex('#f5d76e'), e.stunT / 4);
    // Torpor tell: a slow ring that fills as the lag grows.
    const lagF = e.lag / Math.max(e.tune.lagMax, e.tune.stillLag);
    if (lagF > 0.05) g.arc(x, y, r + 26, 2, hex('#8ab8ff', 0.3 + 0.4 * lagF), lagF);
    if (e.truthT > 0 && e.trueVitals !== null) g.text(`true pulse ${Math.ceil(e.trueVitals)}`, e.heart.x, e.heart.y - 40, { size: 18, color: hex('#ff6050'), align: 'center' });
    drawBossRing(g, e.pos, r + 8, e.hp / e.maxHp, [0.6, 0.3], '#e0c060');
  },
});
