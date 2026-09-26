/** How the entities of `surgery/operation.ts` draw (GAM-0012: moved out of the simulation). */
import { drawer } from './registry';
import { bloodOf } from '../../surgery/species';
import { DEFAULT_TUNING } from '../../surgery/tuning';
import { hex } from '../color';
import { SimpleBurn, Reopened, WoundFever, FIELD } from '../../surgery/operation';

drawer(SimpleBurn, {
  draw(g, e) {
    g.circleGrad(e.pos.x, e.pos.y, 16, hex('#3a1408', 0.7), hex('#3a1408', 0));
  },
});

drawer(Reopened, {
  draw(g, e, op) {
    g.line(e.a, e.b, 3, hex(bloodOf(op.def.race), 0.9));
    for (const m of e.marks) g.rect(m.x - 2, m.y - 2, 4, 4, hex('#efe6c4'));
  },
});

drawer(WoundFever, {
  draw(g, e, op) {
    g.glow(FIELD.cx, FIELD.cy, 300, hex('#ff6020', 0.06 + 0.03 * Math.sin(op.elapsed * 3)));
    g.arc(FIELD.cx, FIELD.cy - FIELD.ry - 20, 18, 3, hex('#ff8040'), e.left / DEFAULT_TUNING.fever.duration);
  },
});
