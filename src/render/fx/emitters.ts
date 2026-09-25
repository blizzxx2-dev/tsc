/**
 * Emitter definitions as data (ENG-0126). Every particle effect is a JSON entry (./emitters.json):
 * emission (burst count, continuous rate), spawn shape (point, line, arc, ellipse, path), velocity
 * cone and speed, gravity, drag, size/colour/alpha-over-life curves, frame sequence, blend, layer
 * and budget priority. `validateEmitters` rejects malformed data with the offending path.
 */
import { Rng } from '../../core/math';
import type { CurveDef, GradientDef } from '../curves';
import { PARTICLE_SHAPES, type ParticleShape } from '../shaders/particle';
import RAW from './emitters.json';

/** Budget classes (ENG-0128): gameplay-readable effects are culled last, ambient first. */
export type FxPriority = 'gameplay' | 'feedback' | 'ambient';
export const PRIORITY_RANK: Record<FxPriority, number> = { ambient: 0, feedback: 1, gameplay: 2 };

export type SpawnShape =
  | { kind: 'point' }
  /** Segment from the emit position to +(dx, dy). */
  | { kind: 'line'; dx: number; dy: number }
  /** Arc of radius r from a0 to a1 (radians) around the emit position. */
  | { kind: 'arc'; r: number; a0: number; a1: number }
  /** Filled ellipse. */
  | { kind: 'ellipse'; rx: number; ry: number }
  /** Polyline offsets from the emit position; spawn uniformly along its length. */
  | { kind: 'path'; points: [number, number][] };

export interface EmitterDef {
  priority: FxPriority;
  blend: 'alpha' | 'add';
  /** Render layer (ENG-0041 names). */
  layer: 'Particles' | 'WorldFX' | 'UI';
  shape: SpawnShape;
  /** Particles per burst when the event names no count. */
  burst: number;
  /** Continuous emission (particles/s) for `Particles.emitContinuous`. */
  rate?: number;
  /** Base speed (px/s) and its random multiplier range. */
  speed: number;
  speedJitter?: [number, number];
  /** Default direction (radians, 0 = +x, y down); omitted = radial. */
  dir?: number;
  /** Half-angle of the velocity cone around the direction (radians). */
  cone: number;
  life: [number, number];
  /** Base radius range (px). */
  size: [number, number];
  /** Initial rotation range and spin (rad/s). */
  rotation?: [number, number];
  spin?: number;
  /** Downward acceleration (px/s², negative rises). */
  gravity?: number;
  /** Exponential velocity damping per second. */
  drag?: number;
  /** Sideways sway amplitude (px/s²). */
  wobble?: number;
  /** Streak length per unit speed (streak shape). */
  stretch?: number;
  particle: ParticleShape;
  /** Frame sequence: shapes cycled at `fps` over the particle's life. */
  frames?: { shapes: ParticleShape[]; fps: number };
  color: GradientDef;
  sizeOverLife: CurveDef;
  alphaOverLife: CurveDef;
  /** Liquid droplets also feed the fluid layer and land as stains. */
  fluid?: 'blood' | 'pus';
}

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isRange = (x: unknown): x is [number, number] => Array.isArray(x) && x.length === 2 && isNum(x[0]) && isNum(x[1]) && x[0] <= x[1];
const isColor = (x: unknown): x is string => typeof x === 'string' && /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(x);
const isCurve = (x: unknown): boolean => isNum(x) || (Array.isArray(x) && x.length > 0 && x.every((k) => Array.isArray(k) && k.length === 2 && isNum(k[0]) && k[0] >= 0 && k[0] <= 1 && isNum(k[1])));
const isGradient = (x: unknown): boolean =>
  isColor(x) || (Array.isArray(x) && x.length > 0 && x.every((k) => Array.isArray(k) && (k.length === 2 || k.length === 3) && isNum(k[0]) && isColor(k[1]) && (k.length === 2 || isNum(k[2]))));
const SHAPE_KINDS = ['point', 'line', 'arc', 'ellipse', 'path'];

/** Problems in a set of emitter definitions (empty when valid). */
export function validateEmitters(defs: Record<string, unknown>): string[] {
  const errs: string[] = [];
  for (const [id, raw] of Object.entries(defs)) {
    const d = raw as Record<string, unknown>;
    const bad = (field: string, why: string) => errs.push(`${id}.${field}: ${why}`);
    if (!d || typeof d !== 'object') {
      errs.push(`${id}: not an object`);
      continue;
    }
    if (!['gameplay', 'feedback', 'ambient'].includes(d.priority as string)) bad('priority', 'gameplay | feedback | ambient');
    if (!['alpha', 'add'].includes(d.blend as string)) bad('blend', 'alpha | add');
    if (!['Particles', 'WorldFX', 'UI'].includes(d.layer as string)) bad('layer', 'Particles | WorldFX | UI');
    const sh = d.shape as Record<string, unknown> | undefined;
    if (!sh || !SHAPE_KINDS.includes(sh.kind as string)) bad('shape', `kind one of ${SHAPE_KINDS.join(', ')}`);
    else if (sh.kind === 'line' && !(isNum(sh.dx) && isNum(sh.dy))) bad('shape', 'line needs dx, dy');
    else if (sh.kind === 'arc' && !(isNum(sh.r) && isNum(sh.a0) && isNum(sh.a1))) bad('shape', 'arc needs r, a0, a1');
    else if (sh.kind === 'ellipse' && !(isNum(sh.rx) && isNum(sh.ry))) bad('shape', 'ellipse needs rx, ry');
    else if (sh.kind === 'path' && !(Array.isArray(sh.points) && sh.points.length >= 2 && sh.points.every((p) => Array.isArray(p) && p.length === 2 && isNum(p[0]) && isNum(p[1]))))
      bad('shape', 'path needs ≥2 [x, y] points');
    if (!(isNum(d.burst) && d.burst >= 0)) bad('burst', 'number ≥ 0');
    if (d.rate !== undefined && !(isNum(d.rate) && d.rate >= 0)) bad('rate', 'number ≥ 0');
    if (!(isNum(d.speed) && d.speed >= 0)) bad('speed', 'number ≥ 0');
    if (d.speedJitter !== undefined && !isRange(d.speedJitter)) bad('speedJitter', '[min, max]');
    if (d.dir !== undefined && !isNum(d.dir)) bad('dir', 'radians');
    if (!(isNum(d.cone) && d.cone >= 0)) bad('cone', 'radians ≥ 0');
    if (!(isRange(d.life) && d.life[0] > 0)) bad('life', '[min, max] seconds > 0');
    if (!(isRange(d.size) && d.size[0] >= 0)) bad('size', '[min, max] px ≥ 0');
    if (d.rotation !== undefined && !isRange(d.rotation)) bad('rotation', '[min, max]');
    for (const k of ['spin', 'gravity', 'drag', 'wobble', 'stretch']) if (d[k] !== undefined && !isNum(d[k])) bad(k, 'number');
    if (!(d.particle as string in PARTICLE_SHAPES)) bad('particle', Object.keys(PARTICLE_SHAPES).join(' | '));
    const fr = d.frames as { shapes?: unknown; fps?: unknown } | undefined;
    if (fr !== undefined && !(Array.isArray(fr.shapes) && fr.shapes.length > 0 && fr.shapes.every((s) => (s as string) in PARTICLE_SHAPES) && isNum(fr.fps) && fr.fps > 0)) bad('frames', '{ shapes: [...], fps > 0 }');
    if (!isGradient(d.color)) bad('color', "'#hex' or [[t, '#hex', alpha?], …]");
    if (!isCurve(d.sizeOverLife)) bad('sizeOverLife', 'number or [[t, v], …]');
    if (!isCurve(d.alphaOverLife)) bad('alphaOverLife', 'number or [[t, v], …]');
    if (d.fluid !== undefined && !['blood', 'pus'].includes(d.fluid as string)) bad('fluid', 'blood | pus');
  }
  return errs;
}

/** The shipped emitter table (validated at load; a broken entry fails loudly in dev and tests). */
export const EMITTERS: Readonly<Record<string, EmitterDef>> = (() => {
  const errs = validateEmitters(RAW as Record<string, unknown>);
  if (errs.length) throw new Error(`emitters.json: ${errs.join('; ')}`);
  return RAW as unknown as Record<string, EmitterDef>;
})();

/**
 * Deterministic emitter RNG (ENG-0131): seeded from the operation seed and the emitter id (FNV-1a),
 * so the same run spawns the same particles in replays and golden screenshots.
 */
export function emitterRng(opSeed: number, emitterId: string): Rng {
  let h = 0x811c9dc5 ^ (opSeed >>> 0);
  for (let i = 0; i < emitterId.length; i++) h = Math.imul(h ^ emitterId.charCodeAt(i), 0x01000193);
  return new Rng(h >>> 0);
}

/** A spawn offset from the emit position for `shape`. */
export function spawnOffset(shape: SpawnShape, rng: Rng): [number, number] {
  switch (shape.kind) {
    case 'point':
      return [0, 0];
    case 'line': {
      const t = rng.next();
      return [shape.dx * t, shape.dy * t];
    }
    case 'arc': {
      const a = rng.range(shape.a0, shape.a1);
      return [Math.cos(a) * shape.r, Math.sin(a) * shape.r];
    }
    case 'ellipse': {
      const a = rng.next() * Math.PI * 2;
      const r = Math.sqrt(rng.next());
      return [Math.cos(a) * shape.rx * r, Math.sin(a) * shape.ry * r];
    }
    case 'path': {
      const p = shape.points;
      let total = 0;
      for (let i = 1; i < p.length; i++) total += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
      let at = rng.next() * total;
      for (let i = 1; i < p.length; i++) {
        const seg = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
        if (at <= seg || i === p.length - 1) {
          const t = seg > 0 ? Math.min(1, at / seg) : 0;
          return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t];
        }
        at -= seg;
      }
      return [p[0][0], p[0][1]];
    }
  }
}
