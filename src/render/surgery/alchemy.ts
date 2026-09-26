/** How the entities of `surgery/ailments/alchemy.ts` draw (GAM-0012: moved out of the simulation). */
import { drawer } from './registry';
import { hex } from '../color';
import { surfDisc } from './paint';
import { TINCTURE_HEX } from '../../surgery/operation';
import { AlchemicalAcid, CompoundPoison, GasPocket, ALCHEMY } from '../../surgery/ailments/alchemy';

drawer(AlchemicalAcid, {
  surface(g, e) {
    surfDisc(g, e.pos, e.r * 1.4, 0.3, 0.4, 0.2, 0);
  },
  draw(g, e, op) {
    g.circleGrad(e.pos.x, e.pos.y, e.r, hex(e.neutralised ? '#a0a070' : '#c0f040', 0.8), hex('#406010', 0.3));
    if (!e.neutralised) for (let i = 0; i < 4; i++) g.circle(e.pos.x + Math.sin(op.elapsed * 3 + i * 2) * e.r * 0.5, e.pos.y + Math.cos(op.elapsed * 2 + i) * e.r * 0.4, 3, hex('#f0ffb0', 0.7));
  },
});

drawer(CompoundPoison, {
  draw(g, e) {
    g.polyline(e.vein, 2, hex('#140a1e', 0.4));
    for (const m of e.motes) {
      const p = e.motePos(m);
      g.glow(p.x, p.y, 14, hex(TINCTURE_HEX[m.colour], 0.5));
      g.circle(p.x, p.y, 5, hex(TINCTURE_HEX[m.colour]));
    }
    g.circle(e.pos.x, e.pos.y, 8, hex('#2a1030'));
  },
});

drawer(GasPocket, {
  draw(g, e, op) {
    const s = 1 + Math.sin(op.elapsed * 2 + e.id) * 0.06;
    g.circleGrad(e.pos.x, e.pos.y, ALCHEMY.gasR * s * (e.vented ? 0.6 : 1), hex('#c8d890', 0.6), hex('#6a7a40', 0.2));
  },
});
