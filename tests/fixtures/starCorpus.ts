/**
 * Synthetic star-stroke corpus. Real human strokes (INP-0055) need people with
 * mice, trackpads, pens and pads — see docs/handoff/INP/. Until that corpus exists
 * this generator produces a deterministic, deliberately messy stand-in so the
 * recogniser's accept/reject behaviour is benchmarked on hundreds of strokes:
 *
 * positives: pentagrams from any start vertex, either winding, rotated ±45°,
 * squashed to aspect 0.6, with wobble, overshoot and rounded corners, unclosed
 * tails, uneven sample spacing and sizes 70–320 px; a gamepad subset is smoother
 * and rounder (stick-driven cursor).
 *
 * negatives: circles, ellipses, spirals, checks, zig-zags, stitching strokes along
 * a wound, triangles, squares, figure-eights, scribbles and tiny stars.
 */
import { Rng, type Vec } from '../../src/core/math';

export interface CorpusStroke {
  label: 'star' | 'other';
  kind: string;
  device: 'mouse' | 'trackpad' | 'pen' | 'gamepad';
  points: Vec[];
}

const TAU = Math.PI * 2;

/** Walk a polyline emitting samples at varying spacing (fast in the middle of strokes, slow at corners). */
function trace(rng: Rng, corners: Vec[], opts: { spacing: number; wobble: number; round: number }): Vec[] {
  const out: Vec[] = [];
  const round = opts.round;
  // Optionally round corners with a quadratic blend around each interior vertex.
  const path: Vec[] = [corners[0]];
  for (let i = 1; i < corners.length - 1; i++) {
    const a = corners[i - 1],
      b = corners[i],
      c = corners[i + 1];
    if (round <= 0) {
      path.push(b);
      continue;
    }
    const p0 = { x: b.x + (a.x - b.x) * round, y: b.y + (a.y - b.y) * round };
    const p2 = { x: b.x + (c.x - b.x) * round, y: b.y + (c.y - b.y) * round };
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      path.push({
        x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * b.x + t * t * p2.x,
        y: (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * b.y + t * t * p2.y,
      });
    }
  }
  path.push(corners[corners.length - 1]);
  let phase = rng.range(0, TAU);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.round(len / (opts.spacing * rng.range(0.6, 1.6))));
    const nx = len ? -(b.y - a.y) / len : 0;
    const ny = len ? (b.x - a.x) / len : 0;
    for (let s = 0; s < n; s++) {
      // Ease in/out along each segment: denser samples near the ends.
      const u = s / n;
      const t = u * u * (3 - 2 * u);
      phase += rng.range(0.2, 0.6);
      const w = Math.sin(phase) * opts.wobble + rng.range(-0.5, 0.5) * opts.wobble * 0.6;
      out.push({ x: a.x + (b.x - a.x) * t + nx * w, y: a.y + (b.y - a.y) * t + ny * w });
    }
  }
  out.push(path[path.length - 1]);
  return out;
}

function transform(pts: Vec[], cx: number, cy: number, rot: number, sx: number, sy: number): Vec[] {
  const c = Math.cos(rot),
    s = Math.sin(rot);
  return pts.map((p) => ({ x: cx + (p.x * sx) * c - (p.y * sy) * s, y: cy + (p.x * sx) * s + (p.y * sy) * c }));
}

/** Unit pentagram vertices in drawing order, from a chosen start vertex and winding. */
function pentagram(start: number, dir: 1 | -1, jitter: (v: Vec) => Vec): Vec[] {
  const pts: Vec[] = [];
  for (let k = 0; k <= 5; k++) {
    const idx = (((start + dir * k * 2) % 5) + 5) % 5;
    const a = -Math.PI / 2 + idx * (TAU / 5);
    pts.push(jitter({ x: Math.cos(a), y: Math.sin(a) }));
  }
  return pts;
}

export function makeStar(rng: Rng, device: CorpusStroke['device']): CorpusStroke {
  const pad = device === 'gamepad';
  const size = rng.range(pad ? 90 : 70, pad ? 260 : 320) / 2;
  const vj = pad ? 0.1 : 0.12;
  const corners = pentagram(rng.int(0, 4), rng.next() < 0.5 ? 1 : -1, (v) => ({ x: v.x + rng.range(-vj, vj), y: v.y + rng.range(-vj, vj) }));
  // Hurried endings: some strokes stop short of the start or overshoot it.
  const end = corners[5];
  const prev = corners[4];
  const tail = rng.range(pad ? 0.8 : 0.82, 1.08);
  corners[5] = { x: prev.x + (end.x - prev.x) * tail, y: prev.y + (end.y - prev.y) * tail };
  const unit = trace(rng, corners, {
    spacing: rng.range(0.03, 0.09),
    wobble: rng.range(0, pad ? 0.035 : 0.03),
    round: pad ? rng.range(0.05, 0.16) : rng.next() < 0.3 ? rng.range(0.02, 0.1) : 0,
  });
  const aspect = rng.range(0.6, 1);
  const [sx, sy] = rng.next() < 0.5 ? [aspect, 1] : [1, aspect];
  const rot = rng.range(-Math.PI / 4, Math.PI / 4);
  return { label: 'star', kind: 'pentagram', device, points: transform(unit, 640, 360, rot, size * sx, size * sy) };
}

const DEVICES: CorpusStroke['device'][] = ['mouse', 'trackpad', 'pen', 'gamepad'];

export function makeNegative(rng: Rng, i: number): CorpusStroke {
  const device = DEVICES[i % DEVICES.length];
  const size = rng.range(80, 300) / 2;
  const kinds = ['circle', 'ellipse', 'spiral', 'check', 'zigzag', 'stitch', 'triangle', 'square', 'figure8', 'scribble', 'tinyStar', 'line', 'wave', 'pentagon', 'closedScribble'] as const;
  const kind = kinds[i % kinds.length];
  const wob = rng.range(0, 0.02);
  let unit: Vec[] = [];
  const loop = (f: (t: number) => Vec, turns = 1, n = 40) => {
    const pts: Vec[] = [];
    for (let k = 0; k <= n * turns; k++) pts.push(f((k / n) * TAU));
    return pts;
  };
  switch (kind) {
    case 'circle':
      unit = loop((t) => ({ x: Math.cos(t), y: Math.sin(t) }), rng.range(0.9, 1.15));
      break;
    case 'ellipse':
      unit = loop((t) => ({ x: Math.cos(t), y: Math.sin(t) * rng.range(0.4, 0.7) }), rng.range(0.95, 1.2));
      break;
    case 'spiral':
      unit = loop((t) => ({ x: Math.cos(t) * (0.3 + t / 20), y: Math.sin(t) * (0.3 + t / 20) }), 2.2);
      break;
    case 'check':
      unit = [{ x: -0.6, y: 0 }, { x: -0.1, y: 0.6 }, { x: 0.9, y: -0.9 }];
      break;
    case 'zigzag': {
      const n = rng.int(4, 9);
      for (let k = 0; k <= n; k++) unit.push({ x: -1 + (2 * k) / n, y: k % 2 ? 0.5 : -0.5 });
      break;
    }
    case 'stitch': {
      // Stitching a wound: many short crossings along a line.
      const n = rng.int(6, 14);
      for (let k = 0; k <= n; k++) unit.push({ x: -1 + (2 * k) / n, y: (k % 2 ? 0.18 : -0.18) + rng.range(-0.04, 0.04) });
      break;
    }
    case 'triangle':
      unit = [{ x: 0, y: -1 }, { x: 0.9, y: 0.7 }, { x: -0.9, y: 0.7 }, { x: 0, y: -1 }];
      break;
    case 'square':
      unit = [{ x: -1, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }, { x: -1, y: -1 }];
      break;
    case 'figure8':
      unit = loop((t) => ({ x: Math.sin(t), y: Math.sin(t) * Math.cos(t) }), 1);
      break;
    case 'scribble': {
      let p = { x: 0, y: 0 };
      let a = rng.range(0, TAU);
      for (let k = 0; k < 30; k++) {
        a += rng.range(-0.6, 0.6);
        p = { x: p.x + Math.cos(a) * 0.12, y: p.y + Math.sin(a) * 0.12 };
        unit.push(p);
      }
      break;
    }
    case 'tinyStar':
      unit = pentagram(0, 1, (v) => v);
      return { label: 'other', kind, device, points: transform(trace(rng, unit, { spacing: 0.05, wobble: 0.01, round: 0 }), 640, 360, rng.range(-0.5, 0.5), 22, 22) };
    case 'pentagon':
      for (let k = 0; k <= 5; k++) unit.push({ x: Math.cos(-Math.PI / 2 + (k * TAU) / 5), y: Math.sin(-Math.PI / 2 + (k * TAU) / 5) });
      break;
    case 'closedScribble': {
      // Wanders off and comes home: closed, crosses itself now and then, but has no star points.
      let p = { x: 0, y: 0 };
      let a = rng.range(0, TAU);
      for (let k = 0; k < 24; k++) {
        a += rng.range(-0.5, 0.5);
        p = { x: p.x + Math.cos(a) * 0.12, y: p.y + Math.sin(a) * 0.12 };
        unit.push(p);
      }
      unit.push({ x: 0, y: 0 });
      break;
    }
    case 'line':
      unit = [{ x: -1, y: rng.range(-0.3, 0.3) }, { x: 1, y: rng.range(-0.3, 0.3) }];
      break;
    case 'wave':
      for (let k = 0; k <= 40; k++) unit.push({ x: -1 + k / 20, y: Math.sin(k / 3) * 0.4 });
      break;
  }
  const pts = trace(rng, unit, { spacing: 0.05, wobble: wob, round: 0 });
  return { label: 'other', kind, device, points: transform(pts, 640, 360, rng.range(-Math.PI, Math.PI), size, size * rng.range(0.7, 1)) };
}

/** Deterministic corpus: `n` positives spread over the four devices and `n` negatives. */
export function syntheticCorpus(n = 320, seed = 7): CorpusStroke[] {
  const rng = new Rng(seed);
  const out: CorpusStroke[] = [];
  for (let i = 0; i < n; i++) out.push(makeStar(rng, DEVICES[i % DEVICES.length]));
  for (let i = 0; i < n; i++) out.push(makeNegative(rng, i));
  return out;
}
