/** How the entities of `surgery/bosses/alphaElites.ts` draw (GAM-0012: moved out of the simulation). */
import { drawer } from './registry';
import { dist, type Vec } from '../../core/math';
import { hex } from '../color';
import type { Gfx } from '../gfx';
import { wormArt } from '../../art/wormArt';
import { surfDisc } from '../../surgery/entities';
import { TAU } from '../../surgery/bosses/common';
import { WormMatriarch, Sellsword, DeadPulse, DEAD_PULSE, FrostWight, GhoulClaw, GHOUL, ChoirMagus, MAGUS } from '../../surgery/bosses/alphaElites';

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI'];

function numeral(g: Gfx, i: number, at: Vec, due: boolean): void {
  g.text(NUMERALS[i] ?? '', at.x + 18, at.y - 16, { size: due ? 18 : 14, font: 'display', color: hex(due ? '#f0e0a0' : '#a09070', 0.9), align: 'center' });
}

drawer(WormMatriarch, {
  surface(g, e) {
    surfDisc(g, e.origin, 26, 0, 0.3, 0.1, 0.1);
  },
  draw(g, e, op) {
    wormArt(g, { origin: e.origin, head: e.head, t: op.elapsed, held: e.grabbed, seed: e.id, width: 11 });
    // Segment rings along the drawn-out body; a strain arc warns before a tear.
    const d = dist(e.head, e.origin);
    for (let i = 1; i < e.segments && d > 8; i++) {
      const k = i / e.segments;
      g.circle(e.origin.x + (e.head.x - e.origin.x) * k, e.origin.y + (e.head.y - e.origin.y) * k, 3, hex('#8a5a44', 0.8));
    }
    if (e.grabbed && e.strain > 0.05) g.arc(e.head.x, e.head.y, 20, 3, hex(e.strain > 0.8 ? '#ff4030' : '#f5d76e'), Math.min(1, e.strain));
  },
});

drawer(Sellsword, {
  surface(g, e) {
    e.shards.forEach((s, i) => s.alive && surfDisc(g, s.origin, 22, 0, 0.25 * (1 - e.callus[i]), 0.05, 0));
  },
  draw(g, e, op) {
    e.shards.forEach((s, i) => {
      if (!s.alive) return;
      const k = e.callus[i];
      // The callus: pale new skin closing in from the rim; sealed, a ridged scar lid.
      g.circle(s.origin.x, s.origin.y, 6 + 12 * k, hex('#d8b8a0', 0.25 + 0.6 * k));
      if (k >= 1) g.arc(s.origin.x, s.origin.y, 18, 2, hex('#8a6a58', 0.9));
      else g.arc(s.origin.x, s.origin.y, 21, 2, hex('#b0e050', 0.6), k);
    });
    if (e.spray.telling) g.glow(e.pos.x, e.pos.y, 60, hex('#a8e040', 0.25 + 0.15 * Math.sin(op.elapsed * 18)));
  },
});

drawer(DeadPulse, {
  draw(g, e, op) {
    const p0 = e.incision.points[0];
    // The beat: a slow countdown ring at the head of the line, and a red flush when it lands.
    if (e.beating) g.glow(p0.x, p0.y, 70, hex('#ff5040', 0.3));
    else g.arc(p0.x, p0.y, 26, 3, hex('#e0c0b0', 0.7), 1 - e.untilBeat / (e.period - DEAD_PULSE.window));
    if (op.tool === 'lens' && e.sigil.hidden) g.glow(e.sigil.pos.x, e.sigil.pos.y, 30, hex('#a080ff', 0.08));
  },
});

drawer(FrostWight, {
  draw(g, e, op) {
    // The curse's veins from the bite to every patch still standing.
    e.patches.forEach((p, i) => {
      if (p?.alive) g.line(e.pos, e.ring[i], 2, hex('#b8d8ff', 0.35 + 0.1 * Math.sin(op.elapsed * 2 + i)));
      if (p?.alive || e.refreeze.has(i)) numeral(g, i, e.ring[i], i === e.next);
    });
    g.circle(e.pos.x, e.pos.y, 8, hex('#e8f4ff', 0.9));
  },
});

drawer(GhoulClaw, {
  draw(g, e, op) {
    g.circle(e.armpit.x, e.armpit.y, 10, hex('#5a2a30', 0.6));
    if (e.amputation) return;
    e.lines.forEach((l, i) => {
      if (l.dead) return;
      const f = e.front(i);
      g.line(l.from, f, 3, hex('#1a1210', 0.85));
      g.circle(f.x, f.y, 5 + Math.sin(op.elapsed * 8 + i) * 1.2, hex('#3a2a20'));
      if (l.burn > 0) g.arc(f.x, f.y, 14, 3, hex('#ff9040'), l.burn / GHOUL.burnHold);
    });
  },
});

drawer(ChoirMagus, {
  draw(g, e, op) {
    g.arc(e.pos.x, e.pos.y, MAGUS.orbit, 1, hex('#8a60c0', 0.3));
    const show = e.scried(op);
    for (let s = 0; s < 3; s++) {
      if (!e.present[s]) continue;
      const p = e.stonePos(s);
      g.poly(
        Array.from({ length: 6 }, (_, i) => ({ x: p.x + Math.cos((i / 6) * TAU) * 13, y: p.y + Math.sin((i / 6) * TAU) * 13 })),
        hex('#3a2a4a'),
        hex('#a080d0', 0.8),
      );
      if (show && s === e.truth) g.glow(p.x, p.y, 34, hex('#e0b0ff', 0.5 + 0.2 * Math.sin(op.elapsed * 6)));
    }
  },
});
