/** How the entities of `surgery/bosses/office.ts` draw (GAM-0012: moved out of the simulation). */
import { drawer } from './registry';
import { hex } from '../color';
import { surfDisc } from '../../surgery/entities';
import { FIELD } from '../../surgery/operation';
import { TAU } from '../../surgery/bosses/common';
import { drawBossRing } from './bossRing';
import { OfficeMalison, HOURS, cap } from '../../surgery/bosses/office';

drawer(OfficeMalison, {
  surface(g, e) {
    surfDisc(g, e.heart, 120, 0, 0.1, 0.2, 0.4);
  },
  draw(g, e, op) {
    const t = op.elapsed;
    // The clock-face of eight hour-sigils.
    for (const h of HOURS) {
      const p = e.sigilPos(h);
      const on = e.lit.has(h);
      const active = e.trials.some((tr) => tr.hour === h);
      g.glow(p.x, p.y, active ? 60 : 36, hex(active ? '#ff9050' : on ? '#b478ff' : '#303030', active ? 0.4 : on ? 0.25 : 0.1));
      g.circle(p.x, p.y, 14, hex(on ? '#3a2050' : '#1a1a1a'));
      g.arc(p.x, p.y, 14, 2, hex(on ? '#d8b0ff' : '#606060', 0.8));
      g.text(cap(h), p.x, p.y + 30, { size: 14, font: 'italic', color: hex(on ? '#e0d0f0' : '#707070', 0.8), align: 'center' });
    }
    // The dial hand sweeping to the next Hour.
    const a0 = -Math.PI / 2 + (e.handFrom / 8) * TAU;
    let a1 = -Math.PI / 2 + (e.handTo / 8) * TAU;
    if (a1 < a0) a1 += TAU;
    const f = e.handT > 0 ? 1 - e.handT / e.handSweep : 1;
    const a = a0 + (a1 - a0) * f;
    if (e.stage < 3) g.line(e.heart, { x: e.heart.x + Math.cos(a) * FIELD.rx * 0.6, y: e.heart.y + Math.sin(a) * FIELD.ry * 0.6 }, 4, hex('#e8c080', 0.7));
    g.circleGrad(e.heart.x, e.heart.y, 22, hex('#8a2040'), hex('#200810', 0.6));
    g.glow(e.heart.x, e.heart.y, 50, hex('#ff4060', 0.15 + 0.1 * Math.sin(t * 5)));
    drawBossRing(g, e.heart, 32, 1 - e.progress, [8 / 13, 12 / 13], '#e0b0ff');
  },
});
