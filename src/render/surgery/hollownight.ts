/** How the entities of `surgery/ailments/hollownight.ts` draw (GAM-0012: moved out of the simulation). */
import { drawer, drawAs } from './registry';
import { hex } from '../color';
import { Embedded } from '../../surgery/entities';
import { surfDisc } from './paint';
import { LEAD_DISH } from '../../surgery/operation';
import { VocalFold, Remnant, TAU, Cyst, Infant, HexBall, Bud } from '../../surgery/ailments/hollownight';

const BUD_KINDS = ['tooth', 'finger', 'eye'] as const;

drawer(VocalFold, {
  draw(g, e, op) {
    const { x, y } = e.pos;
    const sing = e.singing;
    const w = sing ? 1 + 0.2 * Math.sin(op.elapsed * 30) : 1;
    g.ellipse(x - 8, y, 6 * w, 18, 0.1, hex('#e0a0a8'), hex('#a05060'));
    g.ellipse(x + 8, y, 6 * w, 18, -0.1, hex('#e0a0a8'), hex('#a05060'));
    if (sing) g.glow(x, y, 40, hex('#b060ff', 0.25)); // curse-violet: Choir vocal fold
    // Visual metronome: how far through the verse or the rest.
    const cyc = e.verse + e.rest;
    const c = e.t % cyc;
    g.arc(x, y, 26, 3, hex(sing ? '#b060ff' : '#9fd3a8', 0.8), sing ? c / e.verse : (c - e.verse) / e.rest); // curse-violet: Choir vocal fold
  },
});

drawer(Remnant, {
  draw(g, e, op) {
    const { x, y } = e.pos;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + Math.sin(op.elapsed * 10 + i) * 0.3;
      g.line({ x, y }, { x: x + Math.cos(a) * 14, y: y + Math.sin(a) * 14 }, 2, hex('#6a3040'));
    }
    g.circle(x, y, 10, hex('#8a4050'));
    g.ellipse(x, y + 2, 5, 2, 0, hex('#200008'));
    g.arc(x, y, 18, 2, hex('#ff9040', 0.7), e.hp / 40);
  },
});

drawer(Cyst, {
  surface(g, e) {
    surfDisc(g, e.origin, e.r * 1.8, e.freed ? 0.8 : 0, 0.2, 0, 0.8);
  },
  draw(g, e, op) {
    const { x, y } = e.pos;
    const breath = 1 + 0.04 * Math.sin(op.elapsed * 2);
    g.circleGrad(x, y, e.r * breath, hex('#d8c0a8'), hex('#8a6a5a', 0.9));
    // A mouth, talking.
    const talk = 0.3 + 0.7 * Math.abs(Math.sin(op.elapsed * 7));
    g.ellipse(x, y + 4, e.r * 0.45, e.r * 0.15 * talk, 0, hex('#300810'));
    if (!e.freed)
      g.dashed(
        Array.from({ length: 41 }, (_, i) => ({ x: x + Math.cos((i / 40) * TAU) * (e.r + 24), y: y + Math.sin((i / 40) * TAU) * (e.r + 24) })),
        1.5,
        hex('#f0e0c0', 0.35),
        6,
        6,
      );
    if (e.integrity < 1) g.arc(x, y, e.r + 6, 2, hex('#ff5040'), e.integrity);
  },
});

drawer(Infant, {
  draw(g, e, op) {
    const { x, y } = e.pos;
    g.glow(x, y, 50, hex('#ffe0c0', 0.2 + 0.05 * Math.sin(op.elapsed * 2)));
    g.ellipse(x, y, 30, 22, 0.2, hex('#e8b8a0'), hex('#f8d8c8'));
    g.circle(x + 18, y - 12, 13, hex('#f0c8b0'));
    // Vigour bar: the child's own vitals.
    g.rect(x - 30, y + 30, 60, 5, hex('#301010', 0.8));
    g.rect(x - 30, y + 30, (60 * e.vigour) / 100, 5, hex(e.vigour > 40 ? '#8fe0a0' : '#ff6040'));
    if (e.held && !e.moving) g.arc(x, y, 38, 3, hex(e.grip > 2.5 ? '#ff4030' : e.grip >= 0.6 ? '#9fd3a8' : '#f5d76e'), Math.min(1, e.grip / 2.5));
  },
});

drawer(HexBall, {
  draw(g, e, op) {
    const d = LEAD_DISH;
    g.ellipse(d.x, d.y, 44, 20, 0, hex('#6a6a70'), hex('#9a9aa0'));
    g.text('lead dish', d.x, d.y + 38, { size: 14, font: 'italic', color: hex('#c8c8d0', 0.7), align: 'center' });
    drawAs(Embedded, 'draw', g, e, op);
  },
});

drawer(Bud, {
  draw(g, e, op) {
    const { x, y } = e.pos;
    const s = 0.6 + 0.4 * Math.min(1, 1 - e.rootT / 8);
    const k = BUD_KINDS[e.kind];
    if (k === 'tooth') g.tri(x - 6 * s, y + 6, x + 6 * s, y + 6, x, y - 12 * s, hex('#f0ead8'));
    else if (k === 'finger') g.ellipse(x, y - 4 * s, 5 * s, 13 * s, 0.3, hex('#e0b8a0'), hex('#c89880'));
    else {
      g.circle(x, y, 9 * s, hex('#f0f0e8'));
      g.circle(x + Math.sin(op.elapsed * 2) * 2, y, 4 * s, hex('#304060'));
    }
    if (!e.rooted) g.arc(x, y, 16, 2, hex('#e05040', 0.6), e.rootT / 8);
    else g.arc(x, y, 16, 2, hex('#6a2030', 0.8));
    if (e.heat > 0) g.arc(x, y, 20, 3, hex('#ff9040'), e.heat / 0.8);
  },
});
