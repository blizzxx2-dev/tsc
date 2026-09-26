/** How the entities of `surgery/bosses/elites.ts` draw (GAM-0012: moved out of the simulation). */
import { drawer } from './registry';
import type { Vec } from '../../core/math';
import { hex } from '../color';
import { Embedded } from '../../surgery/entities';
import { surfDisc } from './paint';
import { fxRange, TAU } from '../../surgery/bosses/common';
import { EggCluster, CantorKnot, FangNest, MatinsHerald } from '../../surgery/bosses/elites';

drawer(EggCluster, {
  surface(g, e) {
    if (!e.cut) surfDisc(g, e.pos, 70, 0, 0.12, 0, 0.5);
  },
  draw(g, e, op) {
    if (e.cut) return;
    const { x, y } = e.pos;
    g.arc(x, y, 62, 2, hex('#d8d0b8', 0.35 + 0.1 * Math.sin(op.elapsed * 2)));
    g.dashed(
      Array.from({ length: 41 }, (_, i) => ({ x: x + Math.cos((i / 40) * TAU) * 85, y: y + Math.sin((i / 40) * TAU) * 85 })),
      1.5,
      hex('#f0e0c0', 0.3),
      6,
      8,
    );
    if (e.stroking) g.arc(x, y, 85, 3, hex('#ffb080', 0.8), e.encircled);
  },
});

drawer(CantorKnot, {
  draw(g, e, op) {
    if (!e.humming) return;
    const k = 0.5 + 0.5 * Math.sin(op.elapsed * 18);
    g.glow(e.pos.x, e.pos.y, 90, hex('#c080ff', 0.2 + 0.2 * k));
  },
});

drawer(FangNest, {
  surface(g, e) {
    for (const f of e.fangs) if (f.alive) surfDisc(g, f.origin, 30, 0, 0.2, 0.1, 0.2);
  },
  draw(g, e, op) {
    const live = e.fangs.filter((f) => f.alive);
    for (let i = 0; i < live.length; i++)
      for (let j = i + 1; j < live.length; j++) g.line(live[i].origin, live[j].origin, 2, hex('#6a7a30', 0.45 + 0.1 * Math.sin(op.elapsed * 3 + i)));
    const numerals = ['I', 'II', 'III', 'IV'];
    e.fangs.forEach((f, i) => {
      if (!f.alive) return;
      const due = i === e.fangs.indexOf(e.due as Embedded);
      g.text(numerals[i] ?? '', f.origin.x + 16, f.origin.y - 14, { size: due ? 18 : 14, font: 'display', color: hex(due ? '#f0e0a0' : '#a09070', 0.9), align: 'center' });
    });
  },
});

drawer(MatinsHerald, {
  draw(g, e, op) {
    const { x, y } = e.pos;
    const flick = 0.6 + 0.4 * Math.sin(op.elapsed * 15 + e.id);
    const fade = Math.min(1, e.life / 3);
    g.glow(x, y, 36, hex('#b060ff', 0.35 * fade));
    const pts: Vec[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + op.elapsed * 2;
      const rr = i % 2 ? 7 : 14;
      pts.push({ x: x + Math.cos(a) * rr + fxRange(-0.5, 0.5), y: y + Math.sin(a) * rr });
    }
    g.poly(pts, hex('#8c3cc8', flick * fade), hex('#ffe0ff', flick * fade));
    if (e.heat > 0) g.arc(x, y, 20, 3, hex('#ff9040'), e.heat / 0.5);
  },
});
