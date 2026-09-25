import type { Vec } from '../core/math';
import type { Rng } from '../core/math';
import { hex } from './color';
import { CurveAtlas } from './curves';
import { EMITTERS, emitterRng, PRIORITY_RANK, spawnOffset, type EmitterDef, type FxPriority } from './fx/emitters';
import type { Gfx } from './gfx';
import type { Quality } from './quality';
import { PARTICLE_SHAPES, PARTICLE_SIZE_RANGE } from './shaders/particle';

/** Built-in effect kinds the simulation emits (`op.emit`); every one is an entry in fx/emitters.json. */
export type FxKind = 'blood' | 'pus' | 'spark' | 'smoke' | 'mote' | 'gold' | 'dust' | 'curl' | 'knot' | 'suck' | 'leaf' | 'ember';

/** Seconds of the knot-tie flourish when a stitch line is finished (GAM-0039). */
export const KNOT_SECONDS = 0.6;

/** Seconds a seared grub takes to curl up and char (GAM-0085). */
export const CURL_SECONDS = 0.4;

/** Hand-drawn one-off effects that are not emitter-table particles (knot, grub curl, leech suction). */
const FLOURISH: Partial<Record<FxKind, { life: number; size: number; speed: number; spread: number }>> = {
  curl: { life: CURL_SECONDS, size: 9, speed: 0, spread: 0 },
  knot: { life: KNOT_SECONDS, size: 8, speed: 0, spread: 0 },
  suck: { life: 0.3, size: 1.8, speed: 60, spread: 0.25 },
};
interface Flourish {
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
/**
 * Live-particle caps per decorative family (ART-0373): a burst past the cap is trimmed, never the
 * oldest. Gameplay-readable emitters (blood, pus) are never trimmed; the tier budget governs them.
 */
export const PARTICLE_CAPS: Partial<Record<string, number>> = { spark: 48, mote: 32, leaf: 40, ember: 40, gold: 48 };

export class Particles {
  /** One pool per priority class; eviction takes the lowest class first. */
  private pools: Record<FxPriority, P[]> = { ambient: [], feedback: [], gameplay: [] };
  private rngs = new Map<string, Rng>();
  private opSeed = 1;
  private curves = new CurveAtlas();
  private rows = new Map<string, Rows>();
  private inst = { alpha: new Float32Array(0), add: new Float32Array(0) };
  quality: Quality = 'high';
  /** Per-family live caps (ART-0373); an empty table measures raw tier scaling. */
  caps: Partial<Record<string, number>> = PARTICLE_CAPS;
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
    const f = FLOURISH[e.kind];
    if (f) return this.flourish(e, f);
    this.burst(e.kind, e.pos, e.n, e);
  }

  private flourishes: Flourish[] = [];

  private flourish(e: FxEvent, f: NonNullable<(typeof FLOURISH)[FxKind]>): void {
    if (e.kind !== 'suck') {
      // One still flourish on the spot for exactly its life; `dir` is its heading.
      this.flourishes.push({ kind: e.kind, x: e.pos.x, y: e.pos.y, vx: 0, vy: 0, life: f.life, max: f.life, size: f.size, seed: e.dir ?? 0 });
      return;
    }
    const rng = this.rng('suck');
    for (let i = 0; i < e.n && this.flourishes.length < 512; i++) {
      const a = (e.dir ?? 0) + (rng.next() - 0.5) * 2 * (e.spread ?? f.spread);
      const sp = (e.speed ?? f.speed) * (0.35 + rng.next() * 0.9);
      const life = f.life * (0.6 + rng.next() * 0.8);
      this.flourishes.push({ kind: 'suck', x: e.pos.x, y: e.pos.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life, size: f.size * (0.6 + rng.next() * 0.9), seed: 0 });
    }
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
    const cap = this.caps[id];
    if (cap !== undefined) count = Math.min(count, Math.max(0, cap - this.countOf(id)));
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
    let w = 0;
    for (const f of this.flourishes) {
      f.life -= dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.life > 0) this.flourishes[w++] = f;
    }
    this.flourishes.length = w;
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
    if (layer === 'Particles')
      for (const p of this.flourishes) {
        const k = 1 - p.life / p.max;
        if (p.kind === 'curl') drawCurl(g, p.x, p.y, p.seed, k);
        else if (p.kind === 'knot') drawKnot(g, p.x, p.y, p.seed, k);
        // Blood drawn up the Leech-Pipe (GAM-0035): a droplet streaking toward the pipe's mouth.
        else g.line({ x: p.x, y: p.y }, { x: p.x - p.vx * 0.04, y: p.y - p.vy * 0.04 }, p.size, hex('#7a0a10', 0.85 * (1 - k)));
      }
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

  /** Live particles of one emitter family. */
  countOf(id: string): number {
    let n = 0;
    for (const pool of Object.values(this.pools)) for (const p of pool) if (p.id === id) n++;
    return n;
  }

  get count(): number {
    return this.pools.ambient.length + this.pools.feedback.length + this.pools.gameplay.length + this.flourishes.length;
  }

  clear(): void {
    for (const pool of Object.values(this.pools)) pool.length = 0;
    this.flourishes.length = 0;
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
