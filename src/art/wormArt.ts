/**
 * The parasite worm (ART-0218): a long, whip-like gut worm for the Chapter 3 marsh operations,
 * used by both worm entities (the tongs-drawn GutWorm and the Kiln-rows Worm).
 *
 * - Body: a tapering chain of banded segments from a tail sunk in the wound to the head, with a
 *   shadow underside and a wet highlight along the back.
 * - Ripple: a travelling wave runs from the head down to the tail in 12 woodcut frames
 *   (`WORM_FRAMES` at FPS.woodcut); the wave is pinned at both ends, so the head never leaves the
 *   point the tongs hold and the tail stays in the wound.
 * - The tail end fades as it sinks into the flesh; a torn worm shows a ragged stump instead.
 */
import type { Vec } from '../core/math';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { FPS } from './timing';

/** Frames in one ripple cycle. */
export const WORM_FRAMES = 12;
/** Length of body kept below the surface behind the wound opening, px. */
export const WORM_SUNK = 46;
const SEGMENTS = 20;

/** The ripple frame (0..11) at time `t` seconds, stepped at the woodcut rate. */
export const wormFrame = (t: number): number => ((Math.floor(t * FPS.woodcut) % WORM_FRAMES) + WORM_FRAMES) % WORM_FRAMES;

/** Ripple amplitude envelope along the body (0 tail .. 1 head): zero at both ends, widest behind the middle. */
export const wormEnvelope = (s: number): number => Math.pow(Math.max(0, Math.sin(Math.PI * s)), 0.7);

/**
 * Spine points from `tail` to `head` (SEGMENTS + 1 of them) for ripple `frame`. `amp` is the
 * peak sideways swing in px; the wave has 1.5 crests along the body and travels head → tail.
 */
export function wormSpine(tail: Vec, head: Vec, frame: number, amp = 7): Vec[] {
  const dx = head.x - tail.x;
  const dy = head.y - tail.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const phase = (frame / WORM_FRAMES) * Math.PI * 2;
  const pts: Vec[] = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    const s = i / SEGMENTS;
    const w = amp * wormEnvelope(s) * Math.sin(s * Math.PI * 3 + phase);
    pts.push({ x: tail.x + dx * s + nx * w, y: tail.y + dy * s + ny * w });
  }
  return pts;
}

export interface WormLook {
  /** Where the worm leaves the flesh (its tail runs WORM_SUNK px further in, away from the head). */
  origin: Vec;
  /** The head (the point the tongs hold). */
  head: Vec;
  /** World time, for the ripple. */
  t: number;
  /** Body thickness at its widest, px. */
  width?: number;
  /** Torn: only a ragged stump shows at the wound (the body regrows a head). */
  torn?: boolean;
  /** Per-worm variation. */
  seed?: number;
  /** Held in the tongs: the ripple tightens and quickens. */
  held?: boolean;
}

const BODY = '#e6cdb4';
const BAND = '#c29f86';
const SHADE = '#5a3428';
const GLOSS = '#fff4e4';

export function wormArt(g: Gfx, o: WormLook): void {
  const width = o.width ?? 7;
  const seed = o.seed ?? 0;
  // The sunk tail points away from the head (or along the seed's heading while the head is at the wound).
  const hx = o.head.x - o.origin.x;
  const hy = o.head.y - o.origin.y;
  const hl = Math.hypot(hx, hy);
  const ang = hl > 4 ? Math.atan2(hy, hx) : seed * 2.399;
  const tail = { x: o.origin.x - Math.cos(ang) * WORM_SUNK, y: o.origin.y - Math.sin(ang) * WORM_SUNK };
  if (o.torn) {
    // A ragged stump: a short banded length and a torn, bleeding end.
    const stump = wormSpine(tail, o.origin, wormFrame(o.t), 2);
    drawBody(g, stump, width * 0.9, 0.55);
    g.circle(o.origin.x, o.origin.y, width * 0.75, hex('#7a1a18', 0.9));
    for (let k = 0; k < 3; k++) {
      const a = ang + (k - 1) * 0.8;
      g.line(o.origin, { x: o.origin.x + Math.cos(a) * width * 0.9, y: o.origin.y + Math.sin(a) * width * 0.9 }, 1.4, hex('#e6cdb4', 0.8));
    }
    return;
  }
  const head = o.head;
  const frame = wormFrame(o.t * (o.held ? 1.5 : 1) + seed);
  const pts = wormSpine(tail, head, frame, o.held ? 4 : Math.min(9, 4 + Math.hypot(head.x - tail.x, head.y - tail.y) * 0.03));
  drawBody(g, pts, width, 1);
  // Head: a darker, blunt bulb with a ringed mouth and two hooks.
  const a = Math.atan2(head.y - pts[SEGMENTS - 1].y, head.x - pts[SEGMENTS - 1].x);
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  g.circle(head.x + 1.5, head.y + 2, width * 1.15, hex(SHADE, 0.5));
  g.circle(head.x, head.y, width * 1.12, hex('#b47c62'));
  g.circle(head.x + ca * width * 0.45, head.y + sa * width * 0.45, width * 0.5, hex('#3a1a16'));
  g.arc(head.x + ca * width * 0.45, head.y + sa * width * 0.45, width * 0.62, 1.2, hex('#e8b8a0', 0.8));
  for (const s of [-1, 1]) {
    const b = { x: head.x + ca * width * 0.9 - sa * s * width * 0.5, y: head.y + sa * width * 0.9 + ca * s * width * 0.5 };
    g.line(b, { x: b.x + ca * 4 + sa * s * 2.5, y: b.y + sa * 4 - ca * s * 2.5 }, 1.3, hex('#2a1210'));
  }
  g.circle(head.x - ca * 2 - sa * 2, head.y - sa * 2 + ca * 2, width * 0.28, hex(GLOSS, 0.5));
}

/** The banded, tapering body: shadow, segments tail → head, then a wet highlight along the back. */
function drawBody(g: Gfx, pts: readonly Vec[], width: number, alpha: number): void {
  const n = pts.length - 1;
  const radius = (s: number) => width * (0.45 + 0.55 * Math.pow(Math.sin(Math.PI * (0.15 + s * 0.8)), 0.6));
  // The tail end is still under the surface: it fades in over the first fifth of the body.
  const vis = (s: number) => alpha * Math.min(1, 0.15 + s * 5);
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    g.circle(pts[i].x + 1.2, pts[i].y + 2, radius(s) * 1.05, hex(SHADE, 0.35 * vis(s)));
  }
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    g.circle(pts[i].x, pts[i].y, radius(s), hex(i % 3 === 0 ? BAND : BODY, vis(s)));
  }
  const back: Vec[] = [];
  for (let i = Math.floor(n * 0.2); i <= n; i++) {
    const p = pts[i];
    const q = pts[Math.min(n, i + 1)];
    const r = pts[Math.max(0, i - 1)];
    const tx = q.x - r.x;
    const ty = q.y - r.y;
    const tl = Math.hypot(tx, ty) || 1;
    const off = radius(i / n) * 0.4;
    back.push({ x: p.x + (ty / tl) * off, y: p.y - (tx / tl) * off });
  }
  if (back.length > 1) g.polyline(back, Math.max(1, width * 0.22), hex(GLOSS, 0.45 * alpha));
}
