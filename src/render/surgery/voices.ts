/** How the entities of `surgery/bosses/voices.ts` draw (GAM-0012: moved out of the simulation). */
import { drawer } from './registry';
import { hex } from '../color';
import { VoiceLine } from '../../surgery/bosses/voices';

drawer(VoiceLine, {
  draw(g, e) {
    const a = Math.min(1, e.t * 3, (e.life - e.t) * 2);
    g.text(e.text, e.pos.x, e.pos.y - e.t * 8, { size: 18, font: 'italic', color: hex(e.color, 0.85 * a), align: 'center' });
  },
});
