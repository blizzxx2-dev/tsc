import type { Vec } from '../core/math';
import { hex } from './color';
import type { Gfx } from './gfx';

export type FxKind = 'blood' | 'pus' | 'spark' | 'smoke' | 'mote' | 'gold' | 'dust' | 'curl' | 'knot';

/** Seconds of the knot-tie flourish when a stitch line is finished (GAM-0039). */
export const KNOT_SECONDS = 0.6;

/** Seconds a seared grub takes to curl up and char (GAM-0085). */
export const CURL_SECONDS = 0.4;

export interface FxEvent {
  kind: FxKind;
  pos: Vec;
  n: number;
  /** Preferred direction in radians; omitted = radial burst. */
  dir?: number;
  spread?: number;
  speed?: number;
}

interface P {
  kind: FxKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  seed: number;
}

const MAX = 3000;

/**
 * Pooled CPU particles, rendered through the batched renderer. Blood and pus
 * droplets also feed the fluid layer (so spray merges into pools) and leave stains.
 */
export class Particles {
  private ps: P[] = [];

  spawn(e: FxEvent): void {
    const base: Record<FxKind, { speed: number; life: number; size: number; spread: number }> = {
      blood: { speed: 180, life: 0.55, size: 3.2, spread: 0.9 },
      pus: { speed: 120, life: 0.5, size: 3.5, spread: 1.0 },
      spark: { speed: 260, life: 0.35, size: 1.6, spread: 1.4 },
      smoke: { speed: 25, life: 1.6, size: 10, spread: 3.14 },
      mote: { speed: 30, life: 2.2, size: 2.2, spread: 3.14 },
      gold: { speed: 90, life: 0.9, size: 2, spread: 3.14 },
      dust: { speed: 20, life: 3, size: 1.5, spread: 3.14 },
      curl: { speed: 0, life: CURL_SECONDS, size: 9, spread: 0 },
      knot: { speed: 0, life: KNOT_SECONDS, size: 8, spread: 0 },
    };
    const b = base[e.kind];
    if (e.kind === 'curl' || e.kind === 'knot') {
      // One still flourish on the spot for exactly its life; `dir` is its heading.
      if (this.ps.length < MAX) this.ps.push({ kind: e.kind, x: e.pos.x, y: e.pos.y, vx: 0, vy: 0, life: b.life, max: b.life, size: b.size, seed: e.dir ?? 0 });
      return;
    }
    for (let i = 0; i < e.n && this.ps.length < MAX; i++) {
      const a = e.dir !== undefined ? e.dir + (Math.random() - 0.5) * 2 * (e.spread ?? b.spread) : Math.random() * Math.PI * 2;
      const sp = (e.speed ?? b.speed) * (0.35 + Math.random() * 0.9);
      const life = b.life * (0.6 + Math.random() * 0.8);
      this.ps.push({ kind: e.kind, x: e.pos.x, y: e.pos.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life, size: b.size * (0.6 + Math.random() * 0.9), seed: Math.random() * 100 });
    }
  }

  /** Advance; `onLand` receives where each liquid droplet comes to rest. */
  update(dt: number, onLand: (p: Vec, kind: FxKind, size: number) => void): void {
    for (const p of this.ps) {
      p.life -= dt;
      const drag = p.kind === 'blood' || p.kind === 'pus' ? 5 : p.kind === 'spark' ? 2.5 : 1;
      p.vx *= Math.exp(-drag * dt);
      p.vy *= Math.exp(-drag * dt);
      if (p.kind === 'smoke') p.vy -= 18 * dt;
      if (p.kind === 'mote') {
        p.vx += Math.sin(p.seed + p.life * 3) * 20 * dt;
        p.vy -= 10 * dt;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0 && (p.kind === 'blood' || p.kind === 'pus')) onLand({ x: p.x, y: p.y }, p.kind, p.size);
    }
    this.ps = this.ps.filter((p) => p.life > 0);
  }

  /** Visible particles (world layer, after entities). */
  draw(g: Gfx): void {
    for (const p of this.ps) {
      const t = p.life / p.max;
      switch (p.kind) {
        case 'blood':
          g.circle(p.x, p.y, p.size * (0.6 + 0.4 * t), hex('#6a0208', 0.95));
          break;
        case 'pus':
          g.circle(p.x, p.y, p.size * (0.6 + 0.4 * t), hex('#b8a848', 0.9));
          break;
        case 'smoke':
          g.circleGrad(p.x, p.y, p.size * (2 - t), hex('#9a9088', 0.18 * t), hex('#9a9088', 0));
          break;
        case 'curl':
          drawCurl(g, p.x, p.y, p.seed, 1 - t);
          break;
        case 'knot':
          drawKnot(g, p.x, p.y, p.seed, 1 - t);
          break;
        default:
          break;
      }
    }
    g.setBlend('add');
    for (const p of this.ps) {
      const t = p.life / p.max;
      if (p.kind === 'spark') {
        g.line({ x: p.x, y: p.y }, { x: p.x - p.vx * 0.03, y: p.y - p.vy * 0.03 }, p.size, hex('#ffc070', t));
        g.circleGrad(p.x, p.y, 6, hex('#ff8030', 0.4 * t), hex('#ff8030', 0));
      } else if (p.kind === 'mote') g.circleGrad(p.x, p.y, p.size * 3, hex('#c080ff', 0.7 * Math.sin(t * Math.PI)), hex('#c080ff', 0)); // curse-violet: curse motes
      else if (p.kind === 'gold') g.circleGrad(p.x, p.y, p.size * 3, hex('#ffe090', 0.9 * t), hex('#ffe090', 0));
      else if (p.kind === 'dust') g.circleGrad(p.x, p.y, p.size * 3, hex('#fff0c0', 0.35 * Math.sin(t * Math.PI)), hex('#fff0c0', 0));
    }
    g.setBlend('alpha');
  }

  /** Airborne droplets feed the fluid layer so spray merges with pools. */
  drawFluid(g: Gfx): void {
    for (const p of this.ps) {
      if (p.kind === 'blood') g.circleGrad(p.x, p.y, p.size * 2.2, hex('#ff0000', 0.9), hex('#000000', 0));
      else if (p.kind === 'pus') g.circleGrad(p.x, p.y, p.size * 2.2, hex('#00ff00', 0.9), hex('#000000', 0));
    }
  }

  get count(): number {
    return this.ps.length;
  }
}

/**
 * The knot-tie flourish (GAM-0039): a loop of gut thread throws round the last stitch, cinches
 * tight (0 → 0.6), and the tails are snipped with a glint (0.6 → 1).
 */
export function drawKnot(g: Gfx, x: number, y: number, heading: number, k: number): void {
  const cinch = Math.min(1, k / 0.6);
  const r = 11 * (1 - cinch) + 3;
  g.arc(x, y, r, 1.6, hex('#efe6c4', 0.95), Math.min(1, cinch * 1.4 + 0.3));
  g.circle(x, y, 2.5 + cinch * 1.5, hex('#efe6c4'));
  const tail = 16 * (k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4 * 0.7);
  for (const s of [-1, 1]) {
    const a = heading + s * 0.7;
    g.line({ x, y }, { x: x + Math.cos(a) * tail, y: y + Math.sin(a) * tail }, 1.2, hex('#d9cfa8', 0.9));
  }
  if (k > 0.6) g.circle(x + Math.cos(heading) * 10, y + Math.sin(heading) * 10, 3 * (1 - k) / 0.4 + 0.5, hex('#fff6d0', 0.8));
}

/**
 * A seared grub's death-curl (GAM-0085): its segments wind from a straight body into a tight
 * charred coil as `k` goes 0 → 1, blackening as it goes.
 */
export function drawCurl(g: Gfx, x: number, y: number, heading: number, k: number): void {
  const n = 6;
  const bend = k * 2.6; // radians of total curl
  let a = heading;
  let px = x - Math.cos(heading) * 12;
  let py = y - Math.sin(heading) * 12;
  const shade = Math.round(0xe8 - k * 0xb0);
  const col = `#${shade.toString(16).padStart(2, '0')}${Math.round(shade * 0.92).toString(16).padStart(2, '0')}${Math.round(shade * 0.7).toString(16).padStart(2, '0')}`;
  for (let i = 0; i < n; i++) {
    g.circle(px, py, 5.5 - i * 0.5, hex(col, 1 - k * 0.3));
    a += bend / n;
    px += Math.cos(a) * 5;
    py += Math.sin(a) * 5;
  }
}
