/** How the entities of `surgery/ailments/vennmark.ts` draw (GAM-0012: moved out of the simulation). */
import { drawer } from './registry';
import { petrifyCrustArt, petrifyPlateArt } from '../../art/lateAilmentArt';
import { dist, type Vec } from '../../core/math';
import { hex } from '../color';
import { surfDisc, surfLine } from '../../surgery/entities';
import { FIELD } from '../../surgery/operation';
import { pointAlong } from '../../surgery/bosses/common';
import { Artery, Tick, TAU, Contamination, Nodule, NoCutZone, Lockbox, Retractor, StilledHeart, BiteChannel, PetrifyFront, RainDrip } from '../../surgery/ailments/vennmark';

drawer(Artery, {
  surface(g, e) {
    surfLine(g, e.stitch.points, 10, 0.2, 0, 0, 0.3);
  },
  draw(g, e, op) {
    const [a, b] = e.stitch.points;
    const pulse = 0.7 + 0.3 * Math.sin(op.elapsed * 7);
    g.line(a, b, 9, hex('#a01020', 0.9));
    g.line(a, b, 4, hex('#ff5060', 0.5 * pulse));
    e.stitch.draw(g);
    if (e.clamped) {
      const { x, y } = e.pos;
      g.line({ x: x - 12, y: y - 12 }, { x: x + 12, y: y + 12 }, 3, hex('#c8c8d0'));
      g.line({ x: x + 12, y: y - 12 }, { x: x - 12, y: y + 12 }, 3, hex('#c8c8d0'));
    }
  },
});

drawer(Tick, {
  draw(g, e, op) {
    const { x, y } = e.pos;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.sin(op.elapsed * 16 + i) * 0.2;
      g.line({ x, y }, { x: x + Math.cos(a) * 9, y: y + Math.sin(a) * 9 }, 1.2, hex('#2a1a10'));
    }
    g.ellipse(x, y, 7, 5, e.heading, hex('#4a3020'));
    if (!e.burrowed) g.arc(x, y, 13, 2, hex('#e05040', 0.6), 1 - e.life / e.burrowAfter);
  },
});

drawer(Contamination, {
  surface(g, e) {
    surfDisc(g, e.pos, e.r * 1.5, 0, 0.5 * (1 - e.flushT / 1.5), 0.3, 0.3);
  },
  draw(g, e) {
    const { x, y } = e.pos;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + e.id;
      g.circle(x + Math.cos(a) * e.r * 0.55, y + Math.sin(a) * e.r * 0.45, 5, hex('#4a3a20', 0.7 * (1 - e.flushT / 1.5)));
    }
    if (e.flushT > 0) g.arc(x, y, e.r, 3, hex('#8ab8ff'), e.flushT / 1.5);
  },
});

drawer(Nodule, {
  surface(g, e) {
    surfDisc(g, e.pos, e.radius * 2, 0, 0.1, 0.3, 0.4);
  },
  draw(g, e, op) {
    const { x, y } = e.pos;
    const r = e.radius;
    const pts = [0, 1, 2, 3, 4, 5].map((i) => ({ x: x + Math.cos((i / 6) * TAU + e.id) * r * (i % 2 ? 0.7 : 1), y: y + Math.sin((i / 6) * TAU + e.id) * r * (i % 2 ? 0.7 : 1) }));
    g.poly(pts, hex(e.cracked ? '#806070' : '#a8c8e0', 0.9), hex('#f0f8ff'));
    g.glow(x, y, r * 2, hex('#b0e0ff', 0.1 + 0.05 * Math.sin(op.elapsed * 3 + e.id)));
    for (let i = 0; i < e.stage; i++) g.circle(x - 6 + i * 6, y + r + 8, 2, hex('#e0f0ff', 0.8));
    if (e.heat > 0 && !e.cracked) g.arc(x, y, r + 6, 2, hex('#ff9040'), e.heat / 0.6);
  },
});

drawer(NoCutZone, {
  draw(g, e) {
    g.ellipse(e.pos.x, e.pos.y, e.rx, e.ry, 0, hex('#8a5a30', 0.25));
    g.dashed(
      Array.from({ length: 41 }, (_, i) => ({ x: e.pos.x + Math.cos((i / 40) * TAU) * e.rx, y: e.pos.y + Math.sin((i / 40) * TAU) * e.ry })),
      2,
      hex('#e8c080', 0.4),
      6,
      6,
    );
  },
});

drawer(Lockbox, {
  draw(g, e, op) {
    const { x, y } = e.pos;
    g.rect(x - 56, y - 30, 112, 60, hex('#5a4020'));
    g.rectLine(x - 56, y - 30, 112, 60, 3, hex('#c8a060'));
    for (let i = 0; i < 3; i++) {
      const p = e.pinPos(i);
      const pin = e.pins[i];
      g.circle(p.x, p.y, 12, hex(pin.set ? '#9fd3a8' : '#2a1a08'));
      g.line(p, { x: p.x + Math.cos(pin.angle) * 11, y: p.y + Math.sin(pin.angle) * 11 }, 3, hex('#f0d890'));
      g.line({ x: p.x, y: p.y - 16 }, { x: p.x, y: p.y - 12 }, 2, hex('#f0d890', 0.7 + 0.3 * Math.sin(op.elapsed * 6)));
    }
  },
});

drawer(Retractor, {
  draw(g, e) {
    const { x, y } = e.pos;
    if (e.open) {
      g.ellipse(x - 150, y, 20, 70, 0, hex('#8a3040', 0.8));
      return;
    }
    const off = e.held && e.drag ? Math.min(80, dist(e.drag, e.pos)) : 0;
    g.ellipse(x - off, y, 130, 80, 0, hex('#a04050', 0.85), hex('#c06070', 0.9));
    g.circle(x - off, y, 10, hex('#e8dcc0', 0.8));
  },
});

drawer(StilledHeart, {
  draw(g, e, op) {
    const { x, y } = e.pos;
    const beat = e.inBeat ? 1 - e.beatT / e.window : 0;
    g.glow(x, y, 60, hex('#ff3040', 0.1 + 0.4 * beat));
    g.circleGrad(x, y, 22 + 6 * beat, hex('#a01828'), hex('#400810', 0.7));
    g.arc(x, y, 34, 2, hex('#e0a0a0', 0.6), e.beatT / e.every);
    for (let i = 0; i < e.need; i++) g.circle(x - 6 + i * 12, y + 44, 3, hex(i < e.restarts ? '#9fd3a8' : '#503030'));
    if (e.holdT > 0) g.arc(x, y, 28, 3, hex('#9fd3a8'), e.holdT / 0.8);
    void op;
  },
});

drawer(BiteChannel, {
  surface(g, e) {
    surfDisc(g, e.pos, 30, 0.6, 0.2, 0, 0.3);
  },
  draw(g, e, op) {
    const { x, y } = e.pos;
    g.circle(x - 6, y, 3, hex('#300408'));
    g.circle(x + 6, y, 3, hex('#300408'));
    g.glow(x, y, 30, hex('#c02040', 0.15 + 0.1 * Math.sin(op.elapsed * 2)));
    if (e.heat > 0) g.arc(x, y, 18, 3, hex('#ff9040'), e.heat / 0.6);
  },
});

drawer(PetrifyFront, {
  surface(g, e) {
    const pts: Vec[] = [];
    for (let s = 0; s <= e.s; s += 12) pts.push(pointAlong(e.path, s));
    pts.push(e.frontPos);
    if (pts.length > 1) surfLine(g, pts, 40, 0, 0.1, 0.2, 0.3);
  },
  draw(g, e, op) {
    // The crust in four stages by age (ART-0221): a point the front passed d px ago has been stone d/speed seconds.
    const pts: Vec[] = [];
    const ages: number[] = [];
    for (let s = 0; s <= e.s; s += 12) {
      pts.push(pointAlong(e.path, s));
      ages.push((e.s - s) / Math.max(0.1, e.speed));
    }
    pts.push(e.frontPos);
    ages.push(0);
    if (pts.length > 1) petrifyCrustArt(g, pts, ages, e.id);
    g.dashed(e.path, 1.5, hex('#e8dcc0', 0.2), 5, 7);
    const f = e.frontPos;
    g.glow(f.x, f.y, 30, hex('#d0d0c0', 0.3 + 0.1 * Math.sin(op.elapsed * 4)));
    e.plates.forEach((p, i) => petrifyPlateArt(g, p.pos, 14, { index: i, next: i === e.next, crackAge: p.cracked ? op.elapsed - (p.crackedAt ?? -99) : -1, seed: i * 1.3 }));
    if (e.margin) for (const c of e.margin.cells) if (c.done) g.circleGrad(e.margin.center.x + c.x, e.margin.center.y + c.y, 10, hex('#bff0c8', 0.35), hex('#bff0c8', 0));
  },
});

drawer(RainDrip, {
  draw(g, _e, op) {
    for (let i = 0; i < 12; i++) {
      const x = FIELD.cx - FIELD.rx + ((i * 97 + op.elapsed * 40) % (FIELD.rx * 2));
      const y = FIELD.cy - FIELD.ry + ((i * 53 + op.elapsed * 320) % (FIELD.ry * 2));
      g.line({ x, y }, { x: x - 2, y: y + 10 }, 1, hex('#b0c8e0', 0.25));
    }
  },
});
