/** How the entities of `surgery/bosses/base.ts` draw (GAM-0012: moved out of the simulation). */
import { drawer } from './registry';
import { MATINS_DEATH_FRAMES, matinsDeathEye, matinsUnravel } from '../../art/bossVfx';
import { FPS, frameOf } from '../../art/timing';
import { hex } from '../color';
import { BossDeath, DEATH_SECONDS, WITHER_SECONDS } from '../../surgery/bosses/base';

drawer(BossDeath, {
  draw(g, e) {
    const [mode, size] = e.look;
    if (mode === 0 && e.t < DEATH_SECONDS) {
      // Matins (ART-0233): 24 stepped frames — the shroud unravels into threads and motes, then the eye closes.
      const f = frameOf(e.t, FPS.woodcut, MATINS_DEATH_FRAMES);
      g.creature(0, e.pos.x, e.pos.y, size, { seed: e.id, dissolve: f / (MATINS_DEATH_FRAMES - 1), open: matinsDeathEye(f), health: 0.6 });
      matinsUnravel(g, e.pos.x, e.pos.y, size, f, e.id);
    } else if (e.t < DEATH_SECONDS) g.creature(mode, e.pos.x, e.pos.y, size, { seed: e.id, dissolve: Math.min(1, e.t / DEATH_SECONDS), health: 0.6 });
    const w = Math.max(0, 1 - e.t / WITHER_SECONDS);
    for (const p of e.ghosts) {
      g.circle(p.x, p.y, 3 + 7 * w, hex('#2a2018', 0.7 * w));
      g.arc(p.x, p.y, 10 * w + 2, 1.5, hex('#8a7a60', 0.5 * w));
    }
  },
});
