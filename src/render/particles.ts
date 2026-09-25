import type { Vec } from '../core/math';
import type { Rng } from '../core/math';
import { hex } from './color';
import { CurveAtlas } from './curves';
import { EMITTERS, emitterRng, PRIORITY_RANK, spawnOffset, type EmitterDef, type FxPriority } from './fx/emitters';
import type { Gfx } from './gfx';
import type { Quality } from './quality';
import { PARTICLE_SHAPES, PARTICLE_SIZE_RANGE } from './shaders/particle';

/** Built-in effect kinds the simulation emits (`op.emit`); every one is an entry in fx/emitters.json. */
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

/** Particle budget per quality tier (ENG-0128). */
export const PARTICLE_BUDGET: Record<Quality, number> = { high: 16000, medium: 8000, low: 4000 };
/** Emission multiplier per tier for non-gameplay effects (ENG-0145); gameplay-readable bursts keep full count. */
export const PARTICLE_EMISSION: Record<Quality, number> = { high: 1, medium: 0.7, low: 0.4 };

/** Floats per instance: pos.xy vel.xy | size rot age shape | colourV sizeV alphaV alphaMul. */
export const PARTICLE_STRIDE = 12;

interface P {
  def: EmitterDef;
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  rot: number;
  seed: number;
}

/** Curve-texture rows per emitter. */
interface Rows {
  color: number;
  size: number;
  alpha: number;
}

/**
 * Pooled CPU-simulated particles drawn by the instanced renderer (ENG-0124): one draw per blend per
 * layer. Emitters come from data (ENG-0126), their RNG is seeded per operation and emitter
 * (ENG-0131), the pool is capped per quality tier with priority classes (ENG-0128), and emission
 * of non-gameplay effects scales with the tier (ENG-0145). Blood and pus droplets also feed the fluid
 * layer (so spray merges into pools) and leave stains where they land.
 */
export class Particles {
  /** One pool per priority class; eviction takes the lowest class first. */
  private pools: Record<FxPriority, P[]> = { ambient: [], feedback: [], gameplay: [] };
  private rngs = new Map<string, Rng>();
  private opSeed = 1;
  private curves = new CurveAtlas();
  private rows = new Map<string, Rows>();
  private inst = { alpha: new Float32Array(0), add: new Float32Array(0) };
  quality: Quality = 'high';
  /** Particles refused or evicted because the budget was full, per class (debug overlay). */
  readonly culled: Record<FxPriority, number> = { ambient: 0, feedback: 0, gameplay: 0 };

  constructor(
    private defs: Readonly<Record<string, EmitterDef>> = EMITTERS,
    seed = 1,
  ) {
    this.seed(seed);
  }

  /** Re-seed every emitter stream from the operation seed (ENG-0131). */
  seed(opSeed: number): void {
    this.opSeed = opSeed >>> 0;
    this.rngs.clear();
  }

  private rng(id: string): Rng {
    let r = this.rngs.get(id);
    if (!r) this.rngs.set(id, (r = emitterRng(this.opSeed, id)));
    return r;
  }

  get max(): number {
    return PARTICLE_BUDGET[this.quality];
  }

  spawn(e: FxEvent): void {
    this.burst(e.kind, e.pos, e.n, e);
  }

  /** Emit `n` particles of emitter `id` (a key of the emitter table) at `pos`. */
  burst(id: string, pos: Vec, n?: number, o: { dir?: number; spread?: number; speed?: number } = {}): void {
    const def = this.defs[id];
    if (!def) return;
    const rng = this.rng(id);
    let count = n ?? def.burst;
    // Tier scaling (ENG-0145): fractional counts round stochastically on the emitter's own stream.
    if (def.priority !== 'gameplay') {
      const want = count * PARTICLE_EMISSION[this.quality];
      count = Math.floor(want) + (rng.next() < want - Math.floor(want) ? 1 : 0);
    }
    const [j0, j1] = def.speedJitter ?? [1, 1];
    const dir = o.dir ?? def.dir;
    const cone = o.spread ?? def.cone;
    for (let i = 0; i < count; i++) {
      if (!this.admit(def.priority)) return;
      const [ox, oy] = spawnOffset(def.shape, rng);
      const a = dir !== undefined ? dir + (rng.next() - 0.5) * 2 * cone : rng.next() * Math.PI * 2;
      const sp = (o.speed ?? def.speed) * rng.range(j0, j1);
      const life = rng.range(def.life[0], def.life[1]);
      const rot = def.rotation ? rng.range(def.rotation[0], def.rotation[1]) : rng.next() * Math.PI * 2;
      this.pools[def.priority].push({ def, id, x: pos.x + ox, y: pos.y + oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life, size: rng.range(def.size[0], def.size[1]), rot, seed: rng.next() * 100 });
    }
  }

  /** Continuous emitters: `rate × dt` particles this tick (fractions carried on the RNG). */
  emitContinuous(id: string, pos: Vec, dt: number, scale = 1, o: { dir?: number; spread?: number; speed?: number } = {}): void {
    const def = this.defs[id];
    if (!def?.rate) return;
    const want = def.rate * dt * scale;
    const n = Math.floor(want) + (this.rng(id).next() < want - Math.floor(want) ? 1 : 0);
    if (n > 0) this.burst(id, pos, n, o);
  }

  /** Shorten every live particle of emitter `id` to at most `seconds` of remaining life (effects that end). */
  expire(id: string, seconds: number): void {
    for (const pool of Object.values(this.pools))
      for (const p of pool)
        if (p.id === id && p.life > seconds) {
          // Keep the age fraction continuous so the fade curve carries on from where it was.
          const age = 1 - p.life / p.max;
          p.life = seconds;
          p.max = seconds / Math.max(0.05, 1 - age);
        }
  }

  /** Make room for one particle of class `p`: evict the oldest of a lower class, or refuse (ENG-0128). */
  private admit(p: FxPriority): boolean {
    if (this.count < this.max) return true;
    const rank = PRIORITY_RANK[p];
    for (const cls of ['ambient', 'feedback'] as const) {
      if (PRIORITY_RANK[cls] >= rank) break;
      const pool = this.pools[cls];
      if (pool.length) {
        pool.shift();
        this.culled[cls]++;
        return true;
      }
    }
    this.culled[p]++;
    return false;
  }

  /** Advance; `onLand` receives where each liquid droplet comes to rest. */
  update(dt: number, onLand: (p: Vec, kind: FxKind, size: number) => void): void {
    for (const pool of Object.values(this.pools)) {
      let w = 0;
      for (let i = 0; i < pool.length; i++) {
        const p = pool[i];
        const d = p.def;
        p.life -= dt;
        const k = Math.exp(-(d.drag ?? 0) * dt);
        p.vx *= k;
        p.vy *= k;
        if (d.gravity) p.vy += d.gravity * dt;
        if (d.wobble) p.vx += Math.sin(p.seed + p.life * 3) * d.wobble * dt;
        if (d.spin) p.rot += d.spin * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.life > 0) pool[w++] = p;
        else if (d.fluid) onLand({ x: p.x, y: p.y }, d.fluid, p.size);
      }
      pool.length = w;
    }
  }

  private rowsFor(id: string, d: EmitterDef): Rows {
    let r = this.rows.get(id);
    if (!r) {
      const c = this.curves;
      c.addGradient(`${id}.color`, d.color);
      c.addCurve(`${id}.size`, d.sizeOverLife, [0, PARTICLE_SIZE_RANGE]);
      c.addCurve(`${id}.alpha`, d.alphaOverLife, [0, 1]);
      r = { color: c.index(`${id}.color`), size: c.index(`${id}.size`), alpha: c.index(`${id}.alpha`) };
      this.rows.set(id, r);
    }
    return r;
  }

  /**
   * Instance data for one blend of one layer, written into a reused buffer; returns the count.
   * Exposed for tests and the dev panel; `draw` uses it.
   */
  instances(blend: 'alpha' | 'add', layer: EmitterDef['layer'] = 'Particles'): { data: Float32Array; count: number } {
    let n = 0;
    for (const pool of Object.values(this.pools)) for (const p of pool) if (p.def.blend === blend && p.def.layer === layer) n++;
    let buf = this.inst[blend];
    if (buf.length < n * PARTICLE_STRIDE) buf = this.inst[blend] = new Float32Array(Math.max(n, 256) * PARTICLE_STRIDE * 2);
    // Register rows first so the texture height (and so every v coordinate) is final.
    for (const pool of Object.values(this.pools)) for (const p of pool) this.rowsFor(p.id, p.def);
    const h = this.curves.height;
    let o = 0;
    for (const pool of Object.values(this.pools))
      for (const p of pool) {
        const d = p.def;
        if (d.blend !== blend || d.layer !== layer) continue;
        const r = this.rowsFor(p.id, d);
        const age = 1 - p.life / p.max;
        let shape = PARTICLE_SHAPES[d.particle];
        if (d.frames) shape = PARTICLE_SHAPES[d.frames.shapes[Math.floor((p.max - p.life) * d.frames.fps) % d.frames.shapes.length]];
        buf[o++] = p.x;
        buf[o++] = p.y;
        buf[o++] = d.particle === 'streak' ? p.vx * (d.stretch ?? 0.03) * 33.3 : p.vx;
        buf[o++] = d.particle === 'streak' ? p.vy * (d.stretch ?? 0.03) * 33.3 : p.vy;
        buf[o++] = p.size;
        buf[o++] = p.rot;
        buf[o++] = age;
        buf[o++] = shape;
        buf[o++] = (r.color + 0.5) / h;
        buf[o++] = (r.size + 0.5) / h;
        buf[o++] = (r.alpha + 0.5) / h;
        buf[o++] = 1;
      }
    return { data: buf, count: n };
  }

  /** Visible particles (world layer, after entities): one instanced draw per blend. */
  draw(g: Gfx, layer: EmitterDef['layer'] = 'Particles'): void {
    this.quality = g.shaderQuality;
    for (const blend of ['alpha', 'add'] as const) {
      const { data, count } = this.instances(blend, layer);
      if (count) g.drawParticles(data, count, blend, this.curves);
    }
  }

  /** Airborne droplets feed the fluid layer so spray merges with pools. */
  drawFluid(g: Gfx): void {
    for (const p of this.pools.gameplay) {
      if (p.def.fluid === 'blood') g.circleGrad(p.x, p.y, p.size * 2.2, hex('#ff0000', 0.9), hex('#000000', 0));
      else if (p.def.fluid === 'pus') g.circleGrad(p.x, p.y, p.size * 2.2, hex('#00ff00', 0.9), hex('#000000', 0));
    }
  }

  /** Live particles by class. */
  counts(): Record<FxPriority, number> {
    return { ambient: this.pools.ambient.length, feedback: this.pools.feedback.length, gameplay: this.pools.gameplay.length };
  }

  get count(): number {
    return this.pools.ambient.length + this.pools.feedback.length + this.pools.gameplay.length;
  }

  clear(): void {
    for (const pool of Object.values(this.pools)) pool.length = 0;
  }
}
