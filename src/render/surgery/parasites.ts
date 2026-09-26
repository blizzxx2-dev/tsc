/** How the entities of `surgery/ailments/parasites.ts` draw (GAM-0012: moved out of the simulation). */
import { drawer } from './registry';
import { wormArt } from '../../art/wormArt';
import { hex } from '../color';
import { GutWorm, PARASITE, Tick } from '../../surgery/ailments/parasites';

drawer(GutWorm, {
  draw(g, e, op) {
    // The painted parasite worm (ART-0218): banded body, travelling ripple, hooked head; a torn one is a stump.
    wormArt(g, { origin: e.origin, head: e.pos, t: op.elapsed, torn: e.headless, held: e.grabbed, seed: e.id, width: 6.5 });
    if (e.headless) g.arc(e.origin.x, e.origin.y, 12, 2, hex('#c8c050'), e.regrowT / PARASITE.wormRegrow);
  },
});

drawer(Tick, {
  draw(g, e) {
    g.circle(e.pos.x, e.pos.y, 5, hex('#3a2014'));
    for (let i = 0; i < 4; i++) g.line(e.pos, { x: e.pos.x + (i < 2 ? -7 : 7), y: e.pos.y + ((i % 2) * 2 - 1) * 5 }, 1, hex('#1a0e08'));
  },
});
