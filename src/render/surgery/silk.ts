/** How the entities of `surgery/ailments/silk.ts` draw (GAM-0012: moved out of the simulation). */
import { drawer } from './registry';
import { silkArt } from '../../art/ailmentArt';
import { WebSilk } from '../../surgery/ailments/silk';

/** Seconds a cut strand takes to spring apart and fade. */
const SILK_PART_S = 0.6;

drawer(WebSilk, {
  draw(g, e, op) {
    e.strands.forEach((s, i) => {
      const cut = s.cutAt < 0 ? 0 : Math.min(1, (op.elapsed - s.cutAt) / SILK_PART_S);
      if (cut < 1) silkArt(g, s.a, s.b, cut, e.id * 7 + i);
    });
  },
});
