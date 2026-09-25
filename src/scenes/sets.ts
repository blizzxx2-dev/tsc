/**
 * 3D sets behind the story and menu screens. A set is a glTF model from the Blender pipeline
 * (art-src/blender/models) whose named anchors place the camera (`cam`, `cam.target`, extras.fov),
 * the shadowed lamp (`key`, `key.target`) and the candles (`candle.*`). `drawBackdrop` renders the
 * set for its backdrop key once the model is loaded, and the procedural scene until then.
 */
import type { Mat4, V3 } from '../render/mat4';
import type { Model3D, PointLight, Scene3D } from '../render/renderer3d';

/** Backdrop key → model asset id. */
export const SETS: Record<string, string> = { theatre: 'models/set-theatre' };

const loaded = new Map<string, Model3D>();

export function registerSet(key: string, model: Model3D): void {
  loaded.set(key, model);
}

export function setFor(key: string): Model3D | undefined {
  const m = loaded.get(key);
  return m?.isReady ? m : undefined;
}

const pos = (m: Mat4): V3 => [m[12], m[13], m[14]];
const num = (v: unknown, d: number): number => (typeof v === 'number' ? v : d);
const rgb = (v: unknown, d: V3): V3 => (Array.isArray(v) && v.length >= 3 ? [v[0], v[1], v[2]] : d);

/** Blender's light units (W) → the realtime model's radiance: tuned so sets match their Cycles previews. */
const KEY_GAIN = 2.6;
const CANDLE_GAIN = 3.5;

/** Cap on point lights per set; nearby candles merge into one light at their centre. */
const MAX_POINTS = 6;

/**
 * The scene for a set: camera from its anchors (nudged by the pointer for parallax), the lamp as a
 * shadowed key, candles as flickering points, a cool moonlit sky over a warm floor bounce.
 */
export function setScene(model: Model3D, t: number, parallax: [number, number] = [0, 0]): Scene3D {
  const cam = model.anchor('cam');
  const tgt = model.anchor('cam.target');
  const cp = cam ? pos(cam.world) : ([0, 2, 6] as V3);
  const tp = tgt ? pos(tgt.world) : ([0, 1, 0] as V3);
  // Parallax: slide the camera a little across the view, keeping the target fixed.
  const dx = tp[0] - cp[0];
  const dz = tp[2] - cp[2];
  const len = Math.hypot(dx, dz) || 1;
  const side: V3 = [-dz / len, 0, dx / len];
  const camPos: V3 = [cp[0] + side[0] * parallax[0] * 0.28, cp[1] + parallax[1] * 0.12, cp[2] + side[2] * parallax[0] * 0.28];

  const keyA = model.anchor('key');
  const keyT = model.anchor('key.target');
  const key = keyA
    ? {
        pos: pos(keyA.world),
        target: keyT ? pos(keyT.world) : ([0, 0, 0] as V3),
        color: rgb(keyA.extras.color, [1, 0.7, 0.4]).map((c) => c * num(keyA.extras.intensity, 10) * KEY_GAIN) as V3,
        cone: num(keyA.extras.cone, 1.2),
        range: num(keyA.extras.range, 10),
        shadow: true,
      }
    : undefined;

  const candles = model.anchors('candle.').map((a) => ({
    pos: pos(a.world),
    color: rgb(a.extras.color, [1, 0.6, 0.3]).map((c) => c * num(a.extras.intensity, 1) * CANDLE_GAIN) as V3,
    range: num(a.extras.range, 5),
    flicker: 0.6,
  }));
  const lights: PointLight[] = mergeLights(candles, MAX_POINTS);
  return {
    camera: { pos: camPos, target: tp, fovY: (num(cam?.extras.fov, 45) * Math.PI) / 180, near: 0.1, far: 40 },
    key,
    lights,
    ambient: { sky: [0.075, 0.085, 0.12], ground: [0.07, 0.05, 0.036] },
    fog: { color: [0.05, 0.04, 0.035], density: 0.035 },
    exposure: 1.3,
    items: [{ model }],
    time: t,
  };
}

/** Greedy merge of the closest pair until at most `max` lights remain (intensities add). */
export function mergeLights(ls: PointLight[], max: number): PointLight[] {
  const out = ls.map((l) => ({ ...l, pos: [...l.pos] as V3, color: [...l.color] as V3, w: 1 }));
  while (out.length > max) {
    let bi = 0;
    let bj = 1;
    let bd = Infinity;
    for (let i = 0; i < out.length; i++)
      for (let j = i + 1; j < out.length; j++) {
        const d = Math.hypot(out[i].pos[0] - out[j].pos[0], out[i].pos[1] - out[j].pos[1], out[i].pos[2] - out[j].pos[2]);
        if (d < bd) [bi, bj, bd] = [i, j, d];
      }
    const a = out[bi];
    const b = out[bj];
    const w = a.w + b.w;
    a.pos = a.pos.map((p, k) => (p * a.w + b.pos[k] * b.w) / w) as V3;
    a.color = a.color.map((c, k) => c + b.color[k]) as V3;
    a.range = Math.max(a.range, b.range) + bd * 0.5;
    a.w = w;
    out.splice(bj, 1);
  }
  return out.map(({ w: _w, ...l }) => l);
}
