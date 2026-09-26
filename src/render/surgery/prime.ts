/** How the entities of `surgery/bosses/prime.ts` draw (GAM-0012: moved out of the simulation). */
import { drawer } from './registry';
import { hex } from '../color';
import { surfDisc, surfLine } from './paint';
import { samplePath, TAU } from '../../surgery/bosses/common';
import { drawBossRing } from './bossRing';
import { NameSigil, NAME_WRITE_FRAMES, InkBlot, PrimeMalison } from '../../surgery/bosses/prime';

drawer(NameSigil, {
  surface(g, e) {
    for (let i = 0; i < e.written; i++) surfLine(g, e.strokes[i], 7, 0.25, 0, 0.9);
  },
  draw(g, e, op) {
    const ink = e.red ? '#8a0a14' : '#140a1c';
    for (let i = 0; i < e.count; i++) {
      const s = e.strokes[i];
      if (i < e.written) {
        g.polyline(s, 5, hex(ink, 0.95));
        if (i === e.written - 1) g.polyline(s, 9, hex(e.red ? '#ff4040' : '#b478ff', 0.18 + 0.12 * Math.sin(op.elapsed * 8)));
      } else if (i === e.written) {
        // The stroke being written, and a faint indentation of the path it will take.
        g.dashed(s, 1.5, hex('#e8dcc0', 0.25), 4, 5);
        const total = samplePath(s, 4);
        // The write-on runs as a 20-frame woodcut flipbook (ART-0222).
        const upto = Math.max(1, Math.floor(total.length * (Math.floor(e.writeT * NAME_WRITE_FRAMES) / NAME_WRITE_FRAMES)));
        if (upto > 1) g.polyline(total.slice(0, upto), 5, hex(ink, 0.9));
        const nib = total[Math.min(total.length - 1, upto)];
        g.circle(nib.x, nib.y, 3, hex('#f0e0ff', 0.8));
      } else if (i === e.written + 1 && (1 - e.writeT) * e.strokeTime < 0.8) {
        // Nib glint where the next stroke will begin.
        g.glow(s[0].x, s[0].y, 18, hex('#f0e0ff', 0.7));
      } else g.dashed(s, 1, hex('#e8dcc0', 0.12), 3, 6);
    }
    if (e.tracing >= 0) {
      const ss = e.samples[e.tracing];
      ss.forEach((p, k) => e.covered[k] && g.circle(p.x, p.y, 2.5, hex('#ffd080', 0.9)));
    }
    const pr = e.written / e.count;
    // Completion warning: the whole name glows as its last stroke is written.
    if (e.written === e.count - 1) g.glow(e.pos.x, e.pos.y, 110, hex('#ff5040', 0.12 + 0.08 * Math.sin(op.elapsed * 10)));
    g.text(e.name, e.pos.x, e.pos.y + 44, { size: 15, font: 'italic', color: hex(e.red ? '#ff9080' : '#d8c8f0', 0.5 + 0.5 * pr), align: 'center' });
  },
});

drawer(InkBlot, {
  draw(g, e, op) {
    const writes = e.prime.tune.inkWrites ?? 8;
    if (g && op && e.age > writes - 3) g.arc(e.pos.x, e.pos.y, e.r + 6, 2, hex('#b478ff', 0.4 + 0.3 * Math.sin(op.elapsed * 10)), 1 - (e.age - (writes - 3)) / 3);
  },
});

drawer(PrimeMalison, {
  surface(g, e) {
    surfDisc(g, e.pos, e.radius * 1.8, 0.05, 0.3, 0.3, 0.5);
  },
  draw(g, e, op) {
    const { x, y } = e.pos;
    const r = e.radius;
    const t = op.elapsed;
    g.glow(x, y, r * 2.4, hex(e.exposed ? '#ff9050' : '#9060d0', 0.22));
    // A feathered quill-mass: vanes around a dark nib.
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU + t * 0.3;
      const l = r * (1.2 + 0.25 * Math.sin(t * 3 + i));
      g.line({ x, y }, { x: x + Math.cos(a) * l, y: y + Math.sin(a) * l * 0.8 }, 3, hex('#2a1838', 0.8));
    }
    g.circleGrad(x, y, r, e.hurtFlash > 0 ? hex('#ffc080') : hex('#3c2450'), hex('#0e0616', 0.5));
    g.tri(x - 6, y - r * 0.7, x + 6, y - r * 0.7, x, y + r * 0.9, hex(e.exposed ? '#ffb070' : '#d8c8f0'));
    if (e.exposed) g.arc(x, y, r + 12, 3, hex('#ff8040'), e.exposedT / e.tune.exposure);
    drawBossRing(g, e.pos, r + 6, e.hp / e.maxHp, [0.6, 0.25]);
  },
});
