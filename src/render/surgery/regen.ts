/** How the entities of `surgery/ailments/regen.ts` draw (GAM-0012: moved out of the simulation). */
import { drawer } from './registry';
import { hex } from '../color';
import { surfDisc } from './paint';
import { RegenWound, REGEN } from '../../surgery/ailments/regen';

drawer(RegenWound, {
  surface(g, e) {
    surfDisc(g, e.pos, REGEN.rimR * 1.4, e.open ? 0.8 : 0, 0.3, 0, e.open ? 0.1 : 0.9);
  },
  draw(g, e, op) {
    if (!e.open) {
      g.circleGrad(e.pos.x, e.pos.y, REGEN.rimR, hex('#6a8050'), hex('#3a4a28'));
      return;
    }
    for (let i = 0; i < REGEN.bins; i++) {
      const a0 = (i / REGEN.bins) * Math.PI * 2;
      const p = { x: e.pos.x + Math.cos(a0) * REGEN.rimR, y: e.pos.y + Math.sin(a0) * REGEN.rimR };
      g.circle(p.x, p.y, 4, hex(e.rim[i] ? '#2a1a14' : '#90c070', e.rim[i] ? 1 : 0.7));
    }
    if (!e.sealed) g.arc(e.pos.x, e.pos.y, REGEN.rimR + 10, 3, hex('#90c070'), 1 - e.closeT / e.closeTime(op));
  },
});
