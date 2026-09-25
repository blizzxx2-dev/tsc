import type { Vec } from '../core/math';
import { hex } from './color';
import type { Gfx } from './gfx';
import { SWATCHES } from './palette';

export type FxKind = 'blood' | 'pus' | 'spark' | 'smoke' | 'mote' | 'gold' | 'dust' | 'leaf' | 'ember';

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
  /** Sprite variant (blood droplets 0–5, curse motes 0–3, leaf 0–2). */
  v: number;
  /** Trailing wisp for curse motes: the last few positions. */
  trail?: Vec[];
}

const MAX = 3000;

/**
 * Live-particle caps per effect family (ART-0373, docs/art/vfx/README.md): a burst that would
 * exceed its cap spawns only up to it, so the hot area never piles up additive overdraw.
 * Kinds without an entry share the global pool limit.
 */
export const PARTICLE_CAPS: Partial<Record<FxKind, number>> = { blood: 64, spark: 48, mote: 32, leaf: 40, gold: 40, ember: 40 };

/** Blood droplet sprite count (ART-0275) and curse-mote sprite count (ART-0282). */
export const BLOOD_DROPLETS = 6;
export const MOTE_SPRITES = 4;

const BASE: Record<FxKind, { speed: number; life: number; size: number; spread: number }> = {
  blood: { speed: 180, life: 0.55, size: 3.2, spread: 0.9 },
  pus: { speed: 120, life: 0.5, size: 3.5, spread: 1.0 },
  spark: { speed: 260, life: 0.35, size: 1.6, spread: 1.4 },
  smoke: { speed: 25, life: 1.6, size: 10, spread: 3.14 },
  mote: { speed: 30, life: 2.2, size: 2.2, spread: 3.14 },
  gold: { speed: 90, life: 0.9, size: 2, spread: 3.14 },
  dust: { speed: 20, life: 3, size: 1.5, spread: 3.14 },
  leaf: { speed: 70, life: 1.6, size: 4, spread: 3.14 },
  ember: { speed: 30, life: 1.1, size: 1.6, spread: 0.5 },
};

/**
 * Pooled CPU particles, rendered through the batched renderer. Blood and pus
 * droplets also feed the fluid layer (so spray merges into pools) and leave stains.
 */
export class Particles {
  private ps: P[] = [];
  private live: Partial<Record<FxKind, number>> = {};

  spawn(e: FxEvent): void {
    const b = BASE[e.kind];
    const cap = PARTICLE_CAPS[e.kind] ?? MAX;
    let have = this.live[e.kind] ?? 0;
    for (let i = 0; i < e.n && this.ps.length < MAX && have < cap; i++, have++) {
      const a = e.dir !== undefined ? e.dir + (Math.random() - 0.5) * 2 * (e.spread ?? b.spread) : Math.random() * Math.PI * 2;
      const sp = (e.speed ?? b.speed) * (0.35 + Math.random() * 0.9);
      const life = b.life * (0.6 + Math.random() * 0.8);
      const v = Math.floor(Math.random() * (e.kind === 'blood' ? BLOOD_DROPLETS : e.kind === 'mote' ? MOTE_SPRITES : 3));
      this.ps.push({ kind: e.kind, x: e.pos.x, y: e.pos.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life, size: b.size * (0.6 + Math.random() * 0.9), seed: Math.random() * 100, v, trail: e.kind === 'mote' ? [] : undefined });
    }
    this.live[e.kind] = have;
  }

  /** Live particles of one kind (for the caps test and the profiler). */
  countOf(kind: FxKind): number {
    return this.live[kind] ?? 0;
  }

  /** Advance; `onLand` receives where each liquid droplet comes to rest. */
  update(dt: number, onLand: (p: Vec, kind: FxKind, size: number) => void): void {
    for (const p of this.ps) {
      p.life -= dt;
      const drag = p.kind === 'blood' || p.kind === 'pus' ? 5 : p.kind === 'spark' ? 2.5 : p.kind === 'leaf' ? 2 : 1;
      p.vx *= Math.exp(-drag * dt);
      p.vy *= Math.exp(-drag * dt);
      if (p.kind === 'smoke') p.vy -= 18 * dt;
      if (p.kind === 'mote') {
        p.trail!.unshift({ x: p.x, y: p.y });
        if (p.trail!.length > 6) p.trail!.length = 6;
        p.vx += Math.sin(p.seed + p.life * 3) * 20 * dt;
        p.vy -= 10 * dt;
      }
      // Gold leaf flutters down; embers rise off seared strokes.
      if (p.kind === 'leaf') {
        p.vy += 60 * dt;
        p.vx += Math.sin(p.seed + p.life * 5) * 90 * dt;
      }
      if (p.kind === 'ember') {
        p.vy -= 40 * dt;
        p.vx += Math.sin(p.seed + p.life * 7) * 30 * dt;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0 && (p.kind === 'blood' || p.kind === 'pus')) onLand({ x: p.x, y: p.y }, p.kind, p.size);
    }
    this.ps = this.ps.filter((p) => p.life > 0);
    this.live = {};
    for (const p of this.ps) this.live[p.kind] = (this.live[p.kind] ?? 0) + 1;
  }

  /** Visible particles (world layer, after entities). */
  draw(g: Gfx): void {
    for (const p of this.ps) {
      const t = p.life / p.max;
      switch (p.kind) {
        case 'blood':
          bloodDroplet(g, p, t);
          break;
        case 'pus':
          g.circle(p.x, p.y, p.size * (0.6 + 0.4 * t), hex('#b8a848', 0.9));
          break;
        case 'smoke':
          g.circleGrad(p.x, p.y, p.size * (2 - t), hex('#9a9088', 0.18 * t), hex('#9a9088', 0));
          break;
        case 'leaf':
          goldLeaf(g, p, t);
          break;
        default:
          break;
      }
    }
    g.setBlend('add');
    for (const p of this.ps) {
      const t = p.life / p.max;
      if (p.kind === 'spark') sparkSprite(g, p, t);
      else if (p.kind === 'mote') curseMote(g, p, t);
      else if (p.kind === 'gold') g.circleGrad(p.x, p.y, p.size * 3, hex('#ffe090', 0.9 * t), hex('#ffe090', 0));
      else if (p.kind === 'dust') g.circleGrad(p.x, p.y, p.size * 3, hex('#fff0c0', 0.35 * Math.sin(t * Math.PI)), hex('#fff0c0', 0));
      else if (p.kind === 'ember') {
        const k = Math.sin(t * Math.PI);
        g.circleGrad(p.x, p.y, p.size * 3.2, hex(SWATCHES.gilt, 0.55 * k), hex(SWATCHES.ember, 0));
        g.circle(p.x, p.y, p.size * 0.6, hex(SWATCHES.tallowHi, 0.9 * k));
      }
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
 * The six blood droplet sprites (ART-0275), drawn procedurally: round bead, teardrop stretched along
 * the flight, twin bead, flattened splash, crescent and a fine mist cluster. A bright wet speck
 * sits on the lit (upper-left) side of each.
 */
function bloodDroplet(g: Gfx, p: P, t: number): void {
  const r = p.size * (0.6 + 0.4 * t);
  const dark = hex(SWATCHES.gore, 0.95);
  const body = hex('#6a0208', 0.95);
  const sp = Math.hypot(p.vx, p.vy);
  const a = Math.atan2(p.vy, p.vx);
  switch (p.v) {
    case 0:
      g.circle(p.x, p.y, r, body);
      break;
    case 1:
      g.ellipse(p.x, p.y, r * (1 + Math.min(1.6, sp / 120)), r * 0.75, a, body, dark);
      break;
    case 2:
      g.circle(p.x, p.y, r, body);
      g.circle(p.x - Math.cos(a) * r * 1.8, p.y - Math.sin(a) * r * 1.8, r * 0.55, body);
      break;
    case 3:
      g.ellipse(p.x, p.y, r * 1.3, r * 0.6, a + Math.PI / 2, body, dark);
      break;
    case 4:
      g.circle(p.x, p.y, r, body);
      g.circle(p.x + Math.cos(a) * r * 0.4, p.y + Math.sin(a) * r * 0.4, r * 0.7, dark);
      break;
    default:
      for (let i = 0; i < 3; i++) g.circle(p.x + Math.cos(p.seed + i * 2.1) * r, p.y + Math.sin(p.seed + i * 2.1) * r, r * 0.45, body);
      return;
  }
  g.circle(p.x - r * 0.3, p.y - r * 0.3, Math.max(0.6, r * 0.25), hex('#ff9080', 0.45 * t));
}

/** Cautery sparks (ART-0276): an 8-frame spark star at 24 fps — a streak with a cross that shrinks each frame. */
function sparkSprite(g: Gfx, p: P, t: number): void {
  const frame = Math.min(7, Math.floor((1 - t) * 8));
  const k = 1 - frame / 8;
  g.line({ x: p.x, y: p.y }, { x: p.x - p.vx * 0.03, y: p.y - p.vy * 0.03 }, p.size, hex('#ffc070', t));
  g.circleGrad(p.x, p.y, 6 * k, hex('#ff8030', 0.4 * t), hex('#ff8030', 0));
  if (frame < 4) {
    const s = p.size * 2.2 * k;
    g.line({ x: p.x - s, y: p.y }, { x: p.x + s, y: p.y }, 0.8, hex('#fff0c0', 0.8 * k));
    g.line({ x: p.x, y: p.y - s }, { x: p.x, y: p.y + s }, 0.8, hex('#fff0c0', 0.8 * k));
  }
}

/**
 * Curse motes (ART-0282): four violet sprites — a soft orb, a split seed, a hooked comma and a
 * four-point glint — each dragging a fading wisp of its last positions.
 */
function curseMote(g: Gfx, p: P, t: number): void {
  const a = Math.sin(t * Math.PI);
  const c = SWATCHES.curseViolet;
  const tr = p.trail ?? [];
  for (let i = 1; i < tr.length; i++) g.line(tr[i - 1], tr[i], p.size * (1.2 - i * 0.15), hex(c, 0.28 * a * (1 - i / tr.length)));
  const r = p.size;
  g.circleGrad(p.x, p.y, r * 3, hex(c, 0.7 * a), hex(c, 0));
  switch (p.v) {
    case 1:
      g.circle(p.x - r * 0.5, p.y, r * 0.5, hex('#e8d0ff', 0.8 * a));
      g.circle(p.x + r * 0.5, p.y, r * 0.5, hex('#e8d0ff', 0.8 * a));
      break;
    case 2:
      g.circle(p.x, p.y, r * 0.6, hex('#e8d0ff', 0.85 * a));
      g.line({ x: p.x, y: p.y }, { x: p.x + r * 1.1, y: p.y + r * 1.2 }, r * 0.35, hex('#e8d0ff', 0.6 * a));
      break;
    case 3: {
      const s = r * 1.8;
      g.line({ x: p.x - s, y: p.y }, { x: p.x + s, y: p.y }, 0.9, hex('#e8d0ff', 0.8 * a));
      g.line({ x: p.x, y: p.y - s }, { x: p.x, y: p.y + s }, 0.9, hex('#e8d0ff', 0.8 * a));
      break;
    }
    default:
      g.circle(p.x, p.y, r * 0.7, hex('#e8d0ff', 0.8 * a));
  }
}

/** Gold leaf (ART-0288): a tumbling flake whose width follows its spin, catching light on the turn. */
function goldLeaf(g: Gfx, p: P, t: number): void {
  const spin = Math.cos(p.seed + (p.max - p.life) * (6 + p.v * 2));
  const w = p.size * Math.max(0.15, Math.abs(spin));
  const a = Math.min(1, t * 2.5);
  const pts = [
    { x: p.x - w, y: p.y - p.size * 0.3 },
    { x: p.x - w * 0.2, y: p.y - p.size * 0.7 },
    { x: p.x + w, y: p.y + p.size * 0.2 },
    { x: p.x + w * 0.1, y: p.y + p.size * 0.7 },
  ];
  g.poly(pts, hex(spin > 0 ? SWATCHES.gilt : SWATCHES.giltLo, 0.95 * a), hex(SWATCHES.brassHi, a));
}
