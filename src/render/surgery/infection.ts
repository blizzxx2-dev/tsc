/** How the entities of `surgery/ailments/infection.ts` draw (GAM-0012: moved out of the simulation). */
import { drawer } from './registry';
import type { Vec } from '../../core/math';
import { hex } from '../color';
import { pointAlong } from '../../surgery/entities';
import { surfDisc } from './paint';
import { InfectionLine, INFECTION, SporeCrust, DungZone } from '../../surgery/ailments/infection';

drawer(InfectionLine, {
  draw(g, e) {
    g.polyline(e.path, 2, hex('#3a1a2a', 0.3));
    const pts: Vec[] = [e.path[0]];
    for (let s = 10; s < e.front; s += 10) pts.push(pointAlong(e.path, s));
    pts.push(pointAlong(e.path, e.front));
    g.polyline(pts, 5, hex('#200818', 0.9));
    for (const n of e.nodes) {
      const p = e.nodePos(n);
      g.circle(p.x, p.y, 7, hex(n.treated ? '#9fd3a8' : n.leeched >= INFECTION.nodeLeech ? '#f0c060' : '#6a2a4a'));
    }
  },
});

drawer(SporeCrust, {
  surface(g, e) {
    surfDisc(g, e.pos, INFECTION.crustR * 1.5, 0, 0.2, 0.2, 0);
  },
  draw(g, e) {
    g.circleGrad(e.pos.x, e.pos.y, INFECTION.crustR, hex('#8a8a50'), hex('#4a4a20'));
    for (let i = 0; i < 6; i++) g.circle(e.pos.x + Math.cos(i * 1.1) * 10, e.pos.y + Math.sin(i * 1.7) * 9, 2, hex('#e0e0a0'));
    if (e.path.length > 1) g.polyline(e.path, 2, hex('#ff9090', 0.6));
  },
});

drawer(DungZone, {
  draw(g, e) {
    g.circleGrad(e.pos.x, e.pos.y, INFECTION.dungR, hex('#4a3a18', 0.7), hex('#4a3a18', 0));
  },
});
