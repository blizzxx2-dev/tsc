/** How the entities of `surgery/ailments/frost.ts` draw (GAM-0012: moved out of the simulation). */
import { drawer } from './registry';
import { hex } from '../color';
import { surfDisc } from '../../surgery/entities';
import { FrostPatch, IceCrystal } from '../../surgery/ailments/frost';

drawer(FrostPatch, {
  surface(g, e) {
    surfDisc(g, e.pos, e.radius * 1.4, 0, 0.05, 0.25 * (1 - e.thaw), 0.1);
  },
  draw(g, e) {
    const a = 1 - e.thaw;
    g.circleGrad(e.pos.x, e.pos.y, e.radius, hex('#d8ecff', 0.55 * a), hex('#90b8e0', 0.2 * a));
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      g.line(e.pos, { x: e.pos.x + Math.cos(ang) * e.radius * 0.8, y: e.pos.y + Math.sin(ang) * e.radius * 0.8 }, 1.5, hex('#f0f8ff', 0.6 * a));
    }
    g.arc(e.pos.x, e.pos.y, e.radius + 5, 3, hex('#ff9040', 0.8), e.thaw);
  },
});

drawer(IceCrystal, {
  draw(g, e) {
    for (let i = 0; i < 3; i++) {
      const x = e.pos.x + (i - 1) * 7;
      g.tri(x, e.pos.y - 7, x - 4, e.pos.y + 4, x + 4, e.pos.y + 4, hex('#e8f6ff', 0.9));
    }
  },
});
