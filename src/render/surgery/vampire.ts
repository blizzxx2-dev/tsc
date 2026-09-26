/** How the entities of `surgery/ailments/vampire.ts` draw (GAM-0012: moved out of the simulation). */
import { drawer } from './registry';
import { bloodOf } from '../../surgery/species';
import { hex } from '../color';
import { surfDisc } from './paint';
import { BiteChannel, BITE, DonorBowl } from '../../surgery/ailments/vampire';

drawer(BiteChannel, {
  surface(g, e) {
    surfDisc(g, e.pos, 40, 0, 0.3, 0.1, 0.1);
  },
  draw(g, e, op) {
    g.line(e.punctures[0], e.punctures[1], 2, hex('#6a0a30', 0.5 + 0.3 * Math.sin(op.elapsed * 3)));
    e.punctures.forEach((p, i) => {
      g.circle(p.x, p.y, 5, hex('#1a0005'));
      if (e.seared[i] > 0) g.arc(p.x, p.y, 10, 2, hex('#ff9040'), Math.min(1, e.seared[i] / BITE.sear));
    });
  },
});

drawer(DonorBowl, {
  draw(g, e, op) {
    g.circleGrad(e.pos.x, e.pos.y, 34, hex('#c0b090'), hex('#6a5a40'));
    g.circle(e.pos.x, e.pos.y, 26 * (e.volume / BITE.bowlVolume), hex(bloodOf(op.def.race, '#8a0a10'), 0.9));
  },
});
