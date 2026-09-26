/** How the entities of `surgery/bosses/vespers.ts` draw (GAM-0012: moved out of the simulation). */
import { drawer } from './registry';
import { tallowClotArt } from '../../art/lateAilmentArt';
import { hex } from '../color';
import { surfDisc, surfLine } from './paint';
import { FIELD } from '../../surgery/operation';
import { TAU } from '../../surgery/bosses/common';
import { drawBossRing } from './bossRing';
import { assistsOf } from '../../surgery/bosses/signals';
import { LampNode, WickFilament, TallowClot, VespersMalison } from '../../surgery/bosses/vespers';

/** Shade of a dark quadrant under the minimum-brightness assist (keeps ≥ 45 % brightness). */
const VESPERS_MIN_BRIGHT_SHADE = 0.55;

drawer(LampNode, {
  draw(g, e, op) {
    const { x, y } = e.pos;
    const f = e.light;
    const lean = e.gutterT > 0 ? Math.sin(op.elapsed * 30) * 6 : 0;
    g.glow(x, y - 10, 30 + 90 * f, hex('#ffc060', 0.1 + 0.3 * f));
    g.ellipse(x, y + 6, 14, 6, 0, hex('#6a5030'));
    g.rect(x - 3, y - 6, 6, 12, hex('#e8dcc0'));
    if (f > 0) g.ellipse(x + lean, y - 14, 4 + 3 * f, 7 + 7 * f, lean * 0.03, hex('#ffe0a0', 0.5 + 0.5 * f), hex('#ff8030', 0.3));
    g.arc(x, y, 22, 2, hex('#ffc060', 0.6), f);
  },
});

drawer(WickFilament, {
  surface(g, e) {
    surfLine(g, [e.a, e.b], 6, 0, 0.2, 0.1, 0.4);
  },
  draw(g, e, op) {
    g.line(e.a, e.b, 3, hex('#e8d8a0', 0.8));
    g.line(e.a, e.b, 7, hex('#ffe0a0', 0.12 + 0.08 * Math.sin(op.elapsed * 5 + e.id)));
  },
});

drawer(TallowClot, {
  surface(g, e) {
    surfDisc(g, e.pos, e.r * 1.6, 0, 0.3, 0, 0.5);
  },
  draw(g, e, op) {
    // Waxy clot that softens, glosses and runs under the Brand (ART-0194).
    tallowClotArt(g, e.pos, e.r, { soft: e.softened ? Math.min(1, 0.5 + e.heat) : Math.min(0.45, e.heat * 1.5), drawn: e.draw_ / 0.9, t: op.elapsed, seed: e.id, scorched: e.scorched });
  },
});

drawer(VespersMalison, {
  surface(g, e) {
    if (e.stage >= 2) surfDisc(g, e.pos, e.radius * 1.8, 0, 0.3, 0.1, 0.6);
    if (e.stage === 3) surfLine(g, e.wick, 8, 0, 0.3, 0.2, 0.4);
  },
  draw(g, e, op) {
    const t = op.elapsed;
    const { x, y } = e.pos;
    if (e.stage >= 2) {
      const lit = e.bodyLit;
      g.glow(x, y, e.radius * 2.2, hex(lit ? '#ffb060' : '#403020', 0.25));
      g.circleGrad(x, y, e.radius, e.hurtFlash > 0 ? hex('#fff0c0') : hex(lit ? '#d8c8a0' : '#3a3024'), hex('#201810', 0.6));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + t * 0.4;
        g.line({ x, y }, { x: x + Math.cos(a) * e.radius * 1.5, y: y + Math.sin(a) * e.radius * 1.5 }, 2, hex('#e8d8a0', lit ? 0.6 : 0.1));
      }
      drawBossRing(g, e.pos, e.radius + 8, e.hp / e.maxHp, [0.6, 0.25], '#ffc060');
    }
    if (e.stage === 3) {
      const wickLit = e.litAt(e.wick[0]) || e.litAt(e.root);
      g.polyline(e.wick, 3, hex('#f0e0b0', wickLit ? 0.8 : 0.15));
      e.wickSamples.forEach((p, k) => e.traced[k] && g.circle(p.x, p.y, 3, hex('#ffd080')));
      g.circle(e.root.x, e.root.y, 10, hex(e.rootBare ? '#ff9040' : '#6a5030', wickLit || e.rootBare ? 1 : 0.3));
    }
    // The dark: unlit quadrants fall to a fifth of their light (or, with the
    // minimum-brightness assist, never below 45 %, with Vespers outlined — BOS-0112).
    const minBright = !!assistsOf(op).minBrightness;
    const shade = minBright ? VESPERS_MIN_BRIGHT_SHADE : 0.8;
    const dark = (q: number) => {
      const qx = q % 2 === 0 ? FIELD.cx - FIELD.rx - 20 : FIELD.cx;
      const qy = q < 2 ? FIELD.cy - FIELD.ry - 20 : FIELD.cy;
      g.rect(qx, qy, FIELD.rx + 20, FIELD.ry + 20, hex('#000000', shade));
    };
    if (e.stage < 3) {
      for (let q = 0; q < 4; q++) if (!e.lamps.some((l) => l.alive && l.lit && l.quadrant === q)) dark(q);
    } else {
      const l = e.lamps.find((o) => o.alive);
      g.rect(FIELD.cx - FIELD.rx - 20, FIELD.cy - FIELD.ry - 20, (FIELD.rx + 20) * 2, (FIELD.ry + 20) * 2, hex('#000000', l && l.lit ? 0.45 : shade));
      if (l && l.lit) g.glow(l.pos.x, l.pos.y, 200, hex('#ffc060', 0.12));
    }
    if (minBright && e.stage >= 2) g.arc(x, y, e.radius + 4, 2, hex('#f0e0b0', 0.8));
  },
});
