/** How the entities of `surgery/ailments/kilnrows.ts` draw (GAM-0012: moved out of the simulation). */
import { drawer } from './registry';
import { drawDrape } from '../../art/drape';
import { wormArt } from '../../art/wormArt';
import { hex } from '../color';
import { surfDisc, surfLine } from '../../surgery/entities';
import { TinctureSite, TAU, DressedBud, HornBud, ClothFragment, Vessel, Amputation, Worm, Agitation, Molar } from '../../surgery/ailments/kilnrows';

drawer(TinctureSite, {
  surface(g, e) {
    surfDisc(g, e.pos, 46, 0, 0.2, 0.25, 0.4);
  },
  draw(g, e, op) {
    const { x, y } = e.pos;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + e.id;
      const l = 26 + 6 * Math.sin(op.elapsed * 2 + i);
      g.quadCurve({ x, y }, { x: x + Math.cos(a + 0.4) * l * 0.5, y: y + Math.sin(a + 0.4) * l * 0.5 }, { x: x + Math.cos(a) * l, y: y + Math.sin(a) * l }, 3, hex(e.color, 0.7));
    }
    g.circle(x, y, 6, hex(e.color));
    if (e.holdT > 0) g.arc(x, y, 20, 3, hex('#9fd3a8'), e.holdT / e.holdTime);
  },
});

drawer(DressedBud, {
  draw(g, e) {
    const { x, y } = e.pos;
    g.circleGrad(x, y, 30, hex('#c07860', 0.5), hex('#c07860', 0));
    g.ellipse(x, y, 11, 9, -0.4, hex('#e8d8b8'), hex('#b8a080'));
    g.circle(x - 3, y - 3, 3, hex('#fff6e0', 0.7));
    if (e.holdT > 0) g.arc(x, y, 24, 3, hex('#d8f0c0'), Math.min(1, e.holdT / e.need));
  },
});

drawer(HornBud, {
  surface(g, e) {
    surfDisc(g, e.pos, 34, e.state === 'drill' ? 0 : 0.6, 0.15, 0, 0.4);
  },
  draw(g, e, op) {
    const { x, y } = e.pos;
    if (e.state === 'drill') {
      g.circle(x, y, 22, hex('#e8e0cc'));
      g.dashed(Array.from({ length: 25 }, (_, i) => ({ x: x + Math.cos((i / 24) * TAU) * 22, y: y + Math.sin((i / 24) * TAU) * 22 })), 2, hex('#6a5030', 0.7), 4, 4);
      if (e.drillT > 0) g.arc(x, y, 28, 3, hex(e.drillT > 3 ? '#ff4030' : e.drillT >= 1.5 ? '#9fd3a8' : '#ffd080'), Math.min(1, e.drillT / 3));
    }
    if (e.state !== 'bud') {
      const d = e.discPos;
      g.circle(d.x, d.y, 18, hex('#d8d0b8', e.state === 'disc' ? 1 : 0));
      if (e.state === 'disc') g.arc(d.x, d.y, 18, 2, hex('#8a7a5a'));
    }
    // The bud itself: a pale, ridged nub of horn.
    const s = e.state === 'bud' ? 1 : 0.6;
    g.ellipse(x, y - 4 * s, 9 * s, 14 * s, 0.2 + Math.sin(op.elapsed) * 0.02, hex('#c8b890', e.state === 'drill' ? 0.5 : 1), hex('#8a7a5a'));
  },
});

drawer(ClothFragment, {
  draw(g, e) {
    const { x, y } = e.pos;
    g.poly(
      [
        { x: x - 9, y: y - 6 },
        { x: x + 8, y: y - 8 },
        { x: x + 10, y: y + 5 },
        { x: x - 6, y: y + 8 },
      ],
      hex('#6a4a3a'),
      hex('#8a6a4a'),
    );
  },
});

drawer(Vessel, {
  draw(g, e) {
    const { x, y } = e.pos;
    g.circle(x, y, 8, hex('#8a1020'));
    g.circle(x, y, 4, hex('#300408'));
    e.stitch.draw(g);
    if (e.heat > 0) g.arc(x, y, 14, 3, hex('#ff9040'), e.heat / 0.5);
  },
});

drawer(Amputation, {
  surface(g, e) {
    surfLine(g, [e.a, e.b], 12, (e.strokes / e.need) * 0.8, 0.3);
  },
  draw(g, e, op) {
    // Tone guard (GAM-0126): the limb stays under the drapes; only the strip being sawn shows.
    drawDrape(g, e.a, e.b, { material: op.def.drape });
    g.dashed([e.a, e.b], 3, hex('#f0e0c0', 0.7), 10, 6);
    g.text(`${e.strokes}/${e.need}`, e.pos.x, e.pos.y - 26, { size: 18, color: hex('#f0e0c0', 0.8), align: 'center' });
  },
});

drawer(Worm, {
  draw(g, e, op) {
    const o = e.origin;
    const head = e.pos;
    // The painted parasite worm (ART-0218), shared with the gut worm.
    wormArt(g, { origin: o, head, t: op.elapsed, torn: e.torn, held: e.tension > 0.05, seed: e.id, width: 7 });
    if (e.torn) g.arc(o.x, o.y, 12, 2, hex('#e8d0c0', 0.6), 1 - e.regrowT / e.regrow);
    if (e.tension > 0.05) g.arc(head.x, head.y, 16, 3, hex(e.tension > 0.75 ? '#ff4030' : '#f5d76e'), Math.min(1, e.tension));
  },
});

drawer(Agitation, {
  draw(g, e, op) {
    const { x, y } = e.pos;
    const c = e.thrashing ? '#ff5040' : e.level > 0.45 ? '#f0c060' : '#9fd3a8';
    g.glow(x, y, 40, hex(c, 0.15 + (e.thrashing ? 0.15 * Math.sin(op.elapsed * 14) : 0)));
    g.arc(x, y, 22, 4, hex(c, 0.85), e.level);
    g.text('restless', x, y + 38, { size: 14, font: 'italic', color: hex(c, 0.8), align: 'center' });
    if (e.calmT > 0) g.arc(x, y, 28, 3, hex('#9fd3a8'), e.calmT / 0.6);
  },
});

drawer(Molar, {
  draw(g, e) {
    const { x, y } = e.pos;
    g.poly(
      [
        { x: x - 13, y: y - 10 },
        { x: x + 13, y: y - 10 },
        { x: x + 11, y: y + 8 },
        { x: x + 4, y: y + 14 },
        { x: x - 4, y: y + 14 },
        { x: x - 11, y: y + 8 },
      ],
      hex('#b8a878'),
      hex('#e8dcc0'),
    );
    g.circle(x + 3, y - 3, 4, hex('#3a2a18'));
    for (let i = 0; i < 3; i++) g.circle(x - 8 + i * 8, y - 20, 2.5, hex(i < e.rocks ? '#9fd3a8' : '#605040'));
  },
});
