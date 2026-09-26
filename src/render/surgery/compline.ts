/** How the entities of `surgery/bosses/compline.ts` draw (GAM-0012: moved out of the simulation). */
import { drawer } from './registry';
import { hex } from '../color';
import { surfDisc } from '../../surgery/entities';
import { TAU } from '../../surgery/bosses/common';
import { drawBossRing } from './bossRing';
import { SilenceNode, ComplineMalison } from '../../surgery/bosses/compline';

drawer(SilenceNode, {
  draw(g, e, op) {
    const { x, y } = e.pos;
    g.glow(x, y, 44, hex('#8090c0', 0.25 + 0.1 * Math.sin(op.elapsed * 2 + e.id)));
    g.circle(x, y, 15, hex('#202438'));
    g.arc(x, y, 15, 2, hex('#c0c8f0', 0.8));
    g.line({ x: x - 8, y }, { x: x + 8, y }, 2, hex('#c0c8f0', 0.8));
    if (e.heat > 0) g.arc(x, y, 22, 3, hex('#ff9040'), e.heat / e.holdTime);
  },
});

drawer(ComplineMalison, {
  surface(g, e) {
    surfDisc(g, e.pos, e.radius * 2, 0, 0.1, 0.25, 0.6);
  },
  draw(g, e, op) {
    const { x, y } = e.pos;
    const t = op.elapsed;
    const r = e.radius;
    g.glow(x, y, r * 2.6, hex(e.comboOpen ? '#ffd080' : '#6070a0', 0.25));
    g.circleGrad(x, y, r, e.hurtFlash > 0 ? hex('#e0e8ff') : hex('#303a58'), hex('#080a14', 0.6));
    // A closed, sleeping eye, and a shroud of still air.
    g.line({ x: x - r * 0.5, y }, { x: x + r * 0.5, y }, 3, hex('#c0c8f0', 0.8));
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + t * 0.1;
      g.arc(x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.2, r * (1.3 + 0.1 * i), 1, hex('#8090c0', 0.08));
    }
    if (e.comboOpen) g.arc(x, y, r + 14, 3, hex('#ffd080'), 1 - (op.elapsed - e.comboOpenAt) / e.comboWindow(op));
    if (e.stage === 1 && e.echo) g.arc(x, y, r + 20, 2, hex('#b478ff', 0.6), e.echoT / e.tune.echoTime);
    if (e.litanyStolen) {
      // The stolen star, cracked and black.
      const pts = [0, 2, 4, 1, 3, 0].map((i) => ({ x: x + Math.cos(-Math.PI / 2 + (i * TAU) / 5) * (r + 32), y: y + Math.sin(-Math.PI / 2 + (i * TAU) / 5) * (r + 32) }));
      g.polyline(pts, 2, hex(e.stolenT > 0 ? '#f5d76e' : '#202020', 0.6));
    }
    if (e.muted) g.text('[silence]', x, y - r - 40, { size: 18, font: 'italic', color: hex('#c0c8f0', 0.8), align: 'center' });
    drawBossRing(g, e.pos, r + 8, e.hp / e.maxHp, [0.7, 0.35], '#a0b0e0');
  },
});
