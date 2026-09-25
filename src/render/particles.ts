import type { Vec } from '../core/math';
import { hex } from './color';
import type { Gfx } from './gfx';

export type FxKind = 'blood' | 'pus' | 'spark' | 'smoke' | 'mote' | 'gold' | 'dust';

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
    };
    const b = base[e.kind];
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
      } else if (p.kind === 'mote') g.circleGrad(p.x, p.y, p.size * 3, hex('#c080ff', 0.7 * Math.sin(t * Math.PI)), hex('#c080ff', 0));
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
