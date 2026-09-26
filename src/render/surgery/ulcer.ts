/** How the entities of `surgery/ailments/ulcer.ts` draw (GAM-0012: moved out of the simulation). */
import { drawer } from './registry';
import { hex } from '../color';
import { surfDisc } from './paint';
import { Ulcer, ULCER, Spill } from '../../surgery/ailments/ulcer';

drawer(Ulcer, {
  surface(g, e) {
    surfDisc(g, e.pos, e.radius * 1.2, 0.6, 0.3, 0.1, 0.1);
  },
  draw(g, e, op) {
    for (let i = 0; i < ULCER.rings; i++) {
      const r = e.radius - i * ULCER.ringW;
      const done = i < e.healed;
      g.circle(e.pos.x, e.pos.y, r, hex(done ? '#c89888' : i === 0 ? '#8a3a30' : i === 1 ? '#6a2020' : '#3a0a0a', done ? 0.5 : 0.9));
    }
    if (e.healed < ULCER.rings) g.arc(e.pos.x, e.pos.y, e.radius - e.healed * ULCER.ringW - ULCER.ringW / 2, 2, hex('#bff0c8', 0.4 + 0.3 * Math.sin(op.elapsed * 4)));
  },
});

drawer(Spill, {
  draw(g, e) {
    g.circleGrad(e.pos.x, e.pos.y, 26, hex('#304010', 0.8), hex('#304010', 0));
    g.arc(e.pos.x, e.pos.y, 28, 2, hex('#d0c040', 0.8), 1 - e.age / ULCER.spillRot);
  },
});
