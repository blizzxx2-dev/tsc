/** How the entities of `surgery/disciplines.ts` draw (GAM-0012: moved out of the simulation). */
import { drawer, drawAs } from './registry';
import { hex } from '../color';
import { Fracture } from '../../surgery/ailments/fracture';
import { ClosedReduction, TRACTION } from '../../surgery/disciplines';

drawer(ClosedReduction, {
  draw(g, e, op) {
    drawAs(Fracture, 'draw', g, e, op);
    g.circle(e.tractionPoint.x, e.tractionPoint.y, 12, hex('#c8a060', 0.8));
    g.arc(e.tractionPoint.x, e.tractionPoint.y, 18, 3, hex(e.traction >= TRACTION.needed ? '#9fd3a8' : '#f0c060'), e.traction);
  },
});
