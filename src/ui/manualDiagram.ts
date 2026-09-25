/**
 * The Surgeon's Manual diagrams (GAM-0209): three frames per page — the ailment as found, the
 * instrument at work, the result — cycling like a woodcut flip-book. Drawn with plain Gfx
 * primitives in a box; purely presentational.
 */
import type { Vec } from '../core/math';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import type { DiagramKind, ManualPage } from '../content/manual';
import { toolIcon } from './widgets';

/** Seconds each frame holds. */
export const FRAME_SECONDS = 0.9;
export const FRAMES = 3;

export const frameAt = (time: number): 0 | 1 | 2 => (Math.floor(time / FRAME_SECONDS) % FRAMES) as 0 | 1 | 2;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const INK = '#2a1a10';
const BLOOD = '#8a1016';

/** Where the instrument sits in each frame (fractions of the box), per diagram. */
const TOOL_PATH: Record<DiagramKind, readonly [Vec, Vec, Vec]> = {
  incision: [
    { x: 0.18, y: 0.3 },
    { x: 0.5, y: 0.42 },
    { x: 0.84, y: 0.36 },
  ],
  embedded: [
    { x: 0.58, y: 0.3 },
    { x: 0.52, y: 0.42 },
    { x: 0.78, y: 0.12 },
  ],
  pool: [
    { x: 0.72, y: 0.28 },
    { x: 0.55, y: 0.45 },
    { x: 0.55, y: 0.45 },
  ],
  laceration: [
    { x: 0.22, y: 0.36 },
    { x: 0.5, y: 0.6 },
    { x: 0.8, y: 0.4 },
  ],
  rot: [
    { x: 0.3, y: 0.3 },
    { x: 0.5, y: 0.55 },
    { x: 0.72, y: 0.4 },
  ],
  venom: [
    { x: 0.75, y: 0.25 },
    { x: 0.5, y: 0.45 },
    { x: 0.5, y: 0.45 },
  ],
  grub: [
    { x: 0.78, y: 0.25 },
    { x: 0.52, y: 0.45 },
    { x: 0.52, y: 0.45 },
  ],
  hidden: [
    { x: 0.2, y: 0.4 },
    { x: 0.45, y: 0.48 },
    { x: 0.5, y: 0.5 },
  ],
  burn: [
    { x: 0.7, y: 0.25 },
    { x: 0.5, y: 0.45 },
    { x: 0.45, y: 0.55 },
  ],
  bubo: [
    { x: 0.75, y: 0.25 },
    { x: 0.52, y: 0.46 },
    { x: 0.52, y: 0.46 },
  ],
  sigil: [
    { x: 0.3, y: 0.3 },
    { x: 0.55, y: 0.5 },
    { x: 0.7, y: 0.7 },
  ],
};

/** Draw one frame of a page's diagram inside `box`. */
export function drawDiagram(g: Gfx, page: ManualPage, frame: 0 | 1 | 2, box: Box, time = 0): void {
  const at = (fx: number, fy: number): Vec => ({ x: box.x + box.w * fx, y: box.y + box.h * fy });
  // Parchment and a patch of flesh.
  g.rect(box.x, box.y, box.w, box.h, hex('#d8c8a0', 0.95));
  const c = at(0.5, 0.5);
  g.circleGrad(c.x, c.y, Math.min(box.w, box.h) * 0.42, hex('#e8b8a0'), hex('#c89078'));
  drawSubject(g, page.diagram, frame, at, time);
  // Three pips: which frame this is.
  for (let i = 0; i < FRAMES; i++) g.circle(box.x + box.w - 18 - (FRAMES - 1 - i) * 14, box.y + box.h - 14, i === frame ? 4.5 : 3, hex(INK, i === frame ? 0.9 : 0.35));
  const p = at(TOOL_PATH[page.diagram][frame].x, TOOL_PATH[page.diagram][frame].y);
  // The instrument approaches (frame 1), works (frame 2, lit as selected) and withdraws (frame 3).
  toolIcon(g, page.tool, p.x, p.y, frame === 1 ? 0.95 : 0.8, time, frame === 1 ? 'selected' : 'idle');
}

function drawSubject(g: Gfx, kind: DiagramKind, frame: 0 | 1 | 2, at: (fx: number, fy: number) => Vec, time: number): void {
  switch (kind) {
    case 'incision': {
      const pts = [at(0.18, 0.5), at(0.4, 0.46), at(0.62, 0.5), at(0.84, 0.46)];
      g.dashed(pts, 2, hex(INK, 0.8), 8, 6, 0);
      const cut = frame === 0 ? 0 : frame === 1 ? 2 : 4;
      if (cut > 1) g.polyline(pts.slice(0, cut), 4, hex(BLOOD, 0.9));
      break;
    }
    case 'embedded': {
      const base = at(0.5, 0.55);
      const tip = frame === 2 ? at(0.72, 0.2) : at(0.58, 0.4);
      const tail = frame === 2 ? at(0.64, 0.35) : base;
      g.line(tail, tip, 6, hex('#6a6a70'));
      g.circle(base.x, base.y, 7, hex(BLOOD, frame === 2 ? 0.8 : 0.5));
      if (frame === 1) g.dashed([base, at(0.8, 0.1)], 1.5, hex(INK, 0.6), 6, 6, 0); // the pull axis
      break;
    }
    case 'pool': {
      const r = [0.26, 0.16, 0.0][frame];
      const c = at(0.5, 0.52);
      if (r > 0) g.circleGrad(c.x, c.y, 120 * r * 2, hex(BLOOD, 0.95), hex('#4a0a0c', 0.9));
      if (frame === 2) g.arc(c.x, c.y, 18, 2, hex(INK, 0.5));
      break;
    }
    case 'laceration': {
      const a = at(0.22, 0.52);
      const b = at(0.8, 0.46);
      g.line(a, b, 5, hex(BLOOD, frame === 2 ? 0.45 : 0.9));
      const n = frame === 0 ? 0 : frame === 1 ? 3 : 7;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / 7;
        const m = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        g.line({ x: m.x - 6, y: m.y - 12 }, { x: m.x + 6, y: m.y + 12 }, 1.8, hex('#efe6c4'));
      }
      break;
    }
    case 'rot': {
      const spots = [at(0.35, 0.42), at(0.5, 0.58), at(0.64, 0.44), at(0.46, 0.34)];
      const left = [4, 2, 0][frame];
      spots.slice(0, left).forEach((s, i) => g.circle(s.x, s.y, 22 - i * 2, hex('#5a7a30', 0.85)));
      if (frame > 0) spots.slice(left).forEach((s) => g.circle(s.x, s.y, 20, hex('#f0f0d8', 0.35)));
      break;
    }
    case 'venom': {
      const c = at(0.5, 0.5);
      const reach = [1, 0.6, 0.15][frame];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        g.line(c, { x: c.x + Math.cos(a) * 90 * reach, y: c.y + Math.sin(a) * 60 * reach }, 3, hex('#7a3a9a', 0.85));
      }
      g.circle(c.x, c.y, 8, hex('#5a1a6a'));
      break;
    }
    case 'grub': {
      const c = at(0.5, 0.52);
      if (frame < 2) {
        for (let i = 0; i < 4; i++) g.circle(c.x - 18 + i * 12, c.y + Math.sin(time * 8 + i) * 2, 7, hex('#e8e0b8'));
        if (frame === 1) g.glow(c.x, c.y, 40, hex('#ff8030', 0.5));
      } else g.circle(c.x, c.y, 12, hex('#3a3028', 0.8));
      break;
    }
    case 'hidden': {
      const c = at(0.5, 0.5);
      if (frame === 1) g.arc(c.x, c.y, 16 + Math.sin(time * 6) * 3, 2, hex('#5a88c8', 0.8));
      if (frame === 2) {
        g.line(at(0.44, 0.56), at(0.58, 0.42), 6, hex('#4a8a5a'));
        g.glow(c.x, c.y, 30, hex('#8ab8ff', 0.4));
      }
      break;
    }
    case 'burn': {
      const c = at(0.5, 0.5);
      g.circle(c.x, c.y, 46, hex('#b04030', 0.8));
      if (frame === 0) for (let i = 0; i < 5; i++) g.circle(c.x - 24 + i * 12, c.y + (i % 2) * 10 - 4, 9, hex('#2a1a14', 0.95));
      if (frame === 1) for (let i = 0; i < 2; i++) g.circle(c.x - 12 + i * 24, c.y, 9, hex('#2a1a14', 0.95));
      if (frame === 2) g.circle(c.x, c.y, 46, hex('#f0f0d8', 0.35));
      break;
    }
    case 'bubo': {
      const c = at(0.52, 0.5);
      const r = [30, 30, 14][frame];
      g.circleGrad(c.x, c.y, r, hex('#e8d070'), hex('#a08030'));
      if (frame === 1) g.line({ x: c.x - 10, y: c.y }, { x: c.x + 10, y: c.y }, 2, hex(BLOOD));
      if (frame === 2) g.circle(c.x + 20, c.y + 16, 9, hex('#d8c060', 0.6));
      break;
    }
    case 'sigil': {
      const pts = [at(0.3, 0.3), at(0.5, 0.7), at(0.7, 0.3), at(0.3, 0.55), at(0.7, 0.55)];
      g.polyline(pts, 3, hex('#8030c0', frame === 2 ? 0.25 : 0.85)); // curse-violet: the Curse-Sigil page draws the curse itself
      const seared = frame === 0 ? 0 : frame === 1 ? 3 : 5;
      if (seared > 1) g.polyline(pts.slice(0, seared), 5, hex('#ff8030', 0.8));
      break;
    }
  }
}
