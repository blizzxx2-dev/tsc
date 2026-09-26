/** How the entities of `surgery/ailments/gangrene.ts` draw (GAM-0012: moved out of the simulation). */
import { drawer } from './registry';
import { bloodOf } from '../../surgery/species';
import { drawDrape } from '../../art/drape';
import { dist } from '../../core/math';
import { hex } from '../color';
import { drawCoverage, surfLine } from '../../surgery/entities';
import { Gangrene, GANGRENE, Amputation } from '../../surgery/ailments/gangrene';

drawer(Gangrene, {
  surface(g, e) {
    surfLine(g, [e.tip, e.frontPos], GANGRENE.width, 0, 0.2, 0.6, 0);
  },
  draw(g, e, op) {
    if (!e.debrided) g.line(e.tip, e.frontPos, GANGRENE.width * 0.8, hex('#140c10', 0.8));
    else if (e.cov) drawCoverage(g, e.cov);
    // The demarcation line: the lens shows where hope ends.
    if (op.tool === 'lens' && dist(op.cursor, e.along(e.line)) < op.tuning.lens.radius) {
      const c = e.along(e.line);
      const a = Math.atan2(e.root.y - e.tip.y, e.root.x - e.tip.x) + Math.PI / 2;
      g.dashed([{ x: c.x - Math.cos(a) * 40, y: c.y - Math.sin(a) * 40 }, { x: c.x + Math.cos(a) * 40, y: c.y + Math.sin(a) * 40 }], 2, hex('#b9d7ff', 0.8), 6, 5, 0);
    }
  },
});

drawer(Amputation, {
  draw(g, e, op) {
    // Tone guard (GAM-0126): the limb stays under the drapes; only the strip being sawn shows.
    drawDrape(g, e.sawA, e.sawB, { window: 40, overhang: 40, material: op.def.drape });
    if (!e.sawn) {
      g.dashed([e.sawA, e.sawB], 3, hex('#ffebbe', 0.7), 8, 6, -op.elapsed * 10);
      g.arc(e.pos.x, e.pos.y, 18, 3, hex('#ffebbe'), e.strokes / GANGRENE.strokes);
      return;
    }
    g.line(e.sawA, e.sawB, 18, hex(bloodOf(op.def.race, '#7a1a1a')));
    for (const v of e.vessels) g.line(v.a, v.b, 4, hex(v.tied ? '#efe6c4' : '#c02030'));
    if (e.sealT <= GANGRENE.ligatureWindow) g.arc(e.pos.x, e.pos.y, 60, 2, hex('#efe6c4', 0.5), 1 - e.sealT / GANGRENE.ligatureWindow);
  },
});
