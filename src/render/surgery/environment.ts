/** How the entities of `surgery/ailments/environment.ts` draw (GAM-0012: moved out of the simulation). */
import { drawer } from './registry';
import { hex } from '../color';
import { MudSmear } from '../../surgery/ailments/environment';

drawer(MudSmear, {
  draw(g, e) {
    for (const c of e.cov.cells) if (!c.done) g.circle(e.pos.x + c.x, e.pos.y + c.y, 7, hex('#4a3a22', 0.75));
  },
});
