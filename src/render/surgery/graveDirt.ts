/** How the entities of `surgery/ailments/graveDirt.ts` draw (GAM-0012: moved out of the simulation). */
import { drawer } from './registry';
import { hex } from '../color';
import { GraveDirt, GRAVE_DIRT } from '../../surgery/ailments/graveDirt';

drawer(GraveDirt, {
  draw(g, e) {
    const { x, y } = e.pos;
    // Sealed under the salve: a dull bruise that darkens toward the fester.
    if (e.sealed >= 0) return g.circle(x, y, GRAVE_DIRT.r * 0.8, hex('#4a3a2a', 0.3 + 0.4 * Math.min(1, e.sealed / GRAVE_DIRT.festerAfter)));
    const left = 1 - Math.min(1, e.drawn / GRAVE_DIRT.leech);
    g.circle(x, y, GRAVE_DIRT.r, hex('#2a2218', 0.25 * left));
    for (const c of e.clumps) g.circle(x + c.x, y + c.y, c.r * (0.5 + 0.5 * left), hex('#3b3326', 0.85));
    if (e.drawn > 0) g.arc(x, y, GRAVE_DIRT.r + 4, 2, hex('#b04040', 0.8), 1 - left);
  },
});
