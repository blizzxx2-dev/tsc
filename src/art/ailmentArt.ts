/**
 * Typed wrappers over AILMENT_FS (src/render/shaders/ailment.ts): the painted look of every lodged
 * object, burn, disease, vermin and wound state. Each takes the entity's own geometry (centre,
 * direction, radius) so callers never touch shader parameter slots.
 *
 * Flipbooks (frame counts per the art spec, ART-0038 convention of a fixed fps):
 * grab wobble 4 f, hexstone pulse 6 f, acid bubbling 6 f, hexfire tongues 8 f, bubo burst 6 f,
 * grub crawl 8 f / squirm 4 f, egg-sac pulse 8 f / hatch 8 f, incision opening 6 f,
 * stitch pull 2 f, arterial spurt 6 f.
 */
import type { Vec } from '../core/math';
import type { Gfx } from '../render/gfx';

export const AIL = {
  missile: 0,
  shot: 1,
  powder: 2,
  fang: 3,
  glass: 4,
  hexstone: 5,
  fire: 6,
  acid: 7,
  hexfire: 8,
  bubo: 9,
  rot: 10,
  pox: 11,
  venom: 12,
  grub: 13,
  eggSac: 14,
  wound: 15,
  stitch: 16,
  scar: 17,
  salve: 18,
  spurt: 19,
  silk: 20,
  pool: 21,
} as const;

export type MissileKind = 'arrow' | 'barbed' | 'bolt' | 'bolt-leather';
const MISSILE_KIND: Record<MissileKind, number> = { arrow: 0, barbed: 1, bolt: 2, 'bolt-leather': 3 };

/** Signed distance from `from` to `to` along the direction `angle`. */
function along(from: Vec, to: Vec, angle: number): number {
  return (to.x - from.x) * Math.cos(angle) + (to.y - from.y) * Math.sin(angle);
}

/**
 * An arrow or crossbow bolt. `pos` is where the head meets the shaft; the shaft trails back
 * against `angle` for `len` px. `entry` is the wound in the skin: whatever lies beyond it along
 * `angle` is still inside the flesh and is hidden.
 */
export function missileArt(g: Gfx, pos: Vec, angle: number, len: number, entry: Vec, o: { kind: MissileKind; wobble?: number; nicks?: number; torn?: boolean; snapped?: boolean; seed?: number; alpha?: number }): void {
  const s = (len + 34) * 2;
  g.ailment(AIL.missile, pos.x, pos.y, s, s, {
    rot: angle,
    seed: o.seed,
    alpha: o.alpha,
    a: [len, along(pos, entry, angle), o.wobble ?? 0, MISSILE_KIND[o.kind]],
    b: [o.nicks ?? 0, o.torn ? 1 : 0, o.snapped ? 1 : 0, 0],
  });
}

/** A lead ball: `radius` 5/7/9 px for the three calibres; `flattened` where it struck bone; `sunk` into the wound. */
export function shotArt(g: Gfx, pos: Vec, radius: number, o: { flattened?: number; sunk?: number; seed?: number } = {}): void {
  const s = radius * 2 + 14;
  g.ailment(AIL.shot, pos.x, pos.y, s, s, { seed: o.seed, a: [radius, o.flattened ?? 0, o.sunk ?? 0, 0] });
}

/** Powder tattooing around a gunshot entry (`grains` 0) or a powder burn with embedded black grains (`grains` 1). */
export function powderArt(g: Gfx, pos: Vec, radius: number, o: { grains?: number; scorch?: number; seed?: number; alpha?: number } = {}): void {
  const s = radius * 3;
  g.ailment(AIL.powder, pos.x, pos.y, s, s, { seed: o.seed, alpha: o.alpha, a: [radius, o.grains ?? 0, o.scorch ?? 0, 0] });
}

/** A lodged fang: the broken root trails back against `angle`; the tip is in the flesh past `entry`. */
export function fangArt(g: Gfx, pos: Vec, angle: number, len: number, entry: Vec, o: { spider?: boolean; venom?: boolean; seed?: number } = {}): void {
  const s = len * 2 + 40;
  g.ailment(AIL.fang, pos.x, pos.y, s, s, { rot: angle, seed: o.seed, a: [len, along(pos, entry, angle), 0, o.spider ? 1 : 0], b: [o.venom ? 1 : 0, 0, 0, 0] });
}

/** A glass shard, one of five silhouettes (`shape` 0–4), rim-lit. */
export function glassArt(g: Gfx, pos: Vec, angle: number, len: number, entry: Vec, o: { shape?: number; seed?: number } = {}): void {
  const s = len * 2 + 40;
  g.ailment(AIL.glass, pos.x, pos.y, s, s, { rot: angle, seed: o.seed, a: [len, along(pos, entry, angle), 0, (o.shape ?? 0) % 5] });
}

/** The hexstone: black-violet crystal with a 6-frame pulse; `crackle` on grab, `dissolve` on removal, `stilled` once branded. */
export function hexstoneArt(g: Gfx, pos: Vec, angle: number, len: number, o: { crackle?: number; dissolve?: number; stilled?: number; seed?: number } = {}): void {
  const s = len * 1.6 + 30;
  g.ailment(AIL.hexstone, pos.x, pos.y, s, s, { rot: angle, seed: o.seed, a: [len, o.crackle ?? 0, o.dissolve ?? 0, o.stilled ?? 0] });
}

/** Fire burn by severity (0 reddened, 0.5 blistered, 1 charred), cooling toward pink as salve takes. */
export function fireBurnArt(g: Gfx, pos: Vec, radius: number, severity: number, cooled: number, seed = 0): void {
  const s = radius * 2.8;
  g.ailment(AIL.fire, pos.x, pos.y, s, s, { seed, a: [radius, severity, cooled, 0] });
}

/** Acid burn: etched, bubbling (6 f) until neutralised. */
export function acidBurnArt(g: Gfx, pos: Vec, radius: number, neutralised: number, seed = 0): void {
  const s = radius * 2.4;
  g.ailment(AIL.acid, pos.x, pos.y, s, s, { seed, a: [radius, neutralised, 0, 0] });
}

/** Hexfire: a violet-cored ring of licking flame (8 f). */
export function hexfireEdgeArt(g: Gfx, pos: Vec, radius: number, intensity: number, seed = 0): void {
  const s = radius * 3.2;
  g.ailment(AIL.hexfire, pos.x, pos.y, s, s, { seed, a: [radius, intensity, 0, 0] });
}

/** A plague bubo: ripening shine, a 6-frame lance-open burst and the drained, deflated state. */
export function buboArt(g: Gfx, pos: Vec, radius: number, o: { ripe?: number; burst?: number; drained?: number; seed?: number } = {}): void {
  const s = radius * 3.4 + 8;
  g.ailment(AIL.bubo, pos.x, pos.y, s, s, { seed: o.seed, a: [radius, o.ripe ?? 0, o.burst ?? 0, o.drained ?? 0] });
}

/** Rot or gangrene: spreads through 4 growth stages; `debrided` scrapes it back to a clean bed. */
export function rotArt(g: Gfx, pos: Vec, radius: number, growth: number, debrided: number, seed = 0): void {
  const s = radius * 2.6;
  g.ailment(AIL.rot, pos.x, pos.y, s, s, { seed, a: [radius, growth, debrided, 0] });
}

/** A cluster of pox pustules (Symptom Loom reuse); `lanced` pops a share of them. */
export function poxArt(g: Gfx, pos: Vec, radius: number, lanced = 0, seed = 0): void {
  const s = radius * 2.4;
  g.ailment(AIL.pox, pos.x, pos.y, s, s, { seed, a: [radius, lanced, 0, 0] });
}

/** Venom's spreading vein web, fading once the tincture neutralises it. */
export function venomArt(g: Gfx, pos: Vec, spread: number, neutralised: number, ink: readonly [number, number, number], seed = 0): void {
  const s = spread * 2.4 + 20;
  g.ailment(AIL.venom, pos.x, pos.y, s, s, { seed, col: ink, a: [spread, neutralised, 0, 0] });
}

/** A grub heading along `angle`: 8-frame crawl, burrow in/out (`burrowed` 0..1), 4-frame squirm in tongs. */
export function grubArt(g: Gfx, pos: Vec, angle: number, len: number, o: { burrowed?: number; squirm?: number; heat?: number; seed?: number } = {}): void {
  const s = len * 2.2;
  g.ailment(AIL.grub, pos.x, pos.y, s, s, { rot: angle, seed: o.seed, a: [len, o.burrowed ?? 0, o.squirm ?? 0, o.heat ?? 0] });
}

/** A brood egg sac: 8-frame pulse, an 8-frame hatch as grubs emerge, and the lifted-in-tongs state. */
export function eggSacArt(g: Gfx, pos: Vec, radius: number, o: { hatch?: number; lifted?: number; swell?: number; seed?: number } = {}): void {
  const s = radius * 3.6;
  g.ailment(AIL.eggSac, pos.x, pos.y, s, s, { seed: o.seed, a: [radius, o.hatch ?? 0, o.lifted ?? 0, o.swell ?? 0] });
}

/**
 * A cut drawn along a polyline: skin lips, the fat layer and a bleeding gap, opening over
 * 6 frames (`open`), clean (blade) or ragged (claw), with a heartbeat-pulsed bleed.
 */
export function woundArt(g: Gfx, pts: readonly Vec[], halfWidth: number, o: { open?: number; claw?: boolean; bleed?: number; beat?: number; seed?: number; alpha?: number } = {}): void {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  let at = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1) continue;
    // Segments overlap by a pixel at the joints; the taper runs over the whole cut (b.z, b.w).
    const lx = len + (i < pts.length - 1 ? 1.5 : 0);
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const cx = a.x + Math.cos(ang) * (lx / 2);
    const cy = a.y + Math.sin(ang) * (lx / 2);
    // The quad is axis-aligned: the art turns inside a square large enough to hold it.
    const s = lx + halfWidth * 2 + 24;
    g.ailment(AIL.wound, cx, cy, s, s, { rot: ang, seed: o.seed, alpha: o.alpha, a: [lx, halfWidth, o.open ?? 1, o.claw ? 1 : 0], b: [o.bleed ?? 0, o.beat ?? 0, at, total] });
    at += len;
  }
}

/** One gut-thread stitch across a wound running along `woundAngle`; `tight` 0 slack → 1 drawn taut. */
export function stitchArt(g: Gfx, at: Vec, woundAngle: number, span: number, tight: number, seed = 0): void {
  const s = span * 2 + 18;
  g.ailment(AIL.stitch, at.x, at.y, s, s, { rot: woundAngle, seed, a: [span, tight, 0, 0] });
}

/** A sutured scar along a polyline (`age` 0 fresh, 1 healed); persists to the results screen. */
export function scarArt(g: Gfx, pts: readonly Vec[], width: number, age: number, alpha = 1): void {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1) continue;
    const s = len + width * 2 + 16;
    g.ailment(AIL.scar, (a.x + b.x) / 2, (a.y + b.y) / 2, s, s, { rot: Math.atan2(b.y - a.y, b.x - a.x), alpha, a: [len + (pts.length > 2 ? width * 2 : 0), width, age, 0] });
  }
}

/** Saint's Salve paste: pale gold with a glisten, thinning as it is absorbed. */
export function salveArt(g: Gfx, pos: Vec, radius: number, absorbed: number, seed = 0): void {
  const s = radius * 2.4;
  g.ailment(AIL.salve, pos.x, pos.y, s, s, { seed, a: [radius, absorbed, 0, 0] });
}

/** Arterial spurt: a 6-frame jet from a severed vessel along `angle`. */
export function spurtArt(g: Gfx, from: Vec, angle: number, len: number, phase: number, seed = 0): void {
  const s = len * 2 + 20;
  g.ailment(AIL.spurt, from.x, from.y, s, s, { rot: angle, seed, a: [len, phase, 0, 0] });
}

/** A bundle of brood silk strands from `a` to `b`; `cut` recoils the halves. */
export function silkArt(g: Gfx, a: Vec, b: Vec, cut: number, seed = 0): void {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const s = len + 30;
  g.ailment(AIL.silk, (a.x + b.x) / 2, (a.y + b.y) / 2, s, s, { rot: Math.atan2(b.y - a.y, b.x - a.x), seed, a: [len, cut, 0, 0] });
}

/** A small painted pool (blood 0, pus 1, black bile 2) for trays and look-dev. */
export function poolArt(g: Gfx, pos: Vec, radius: number, kind: 0 | 1 | 2, seed = 0): void {
  const s = radius * 2.6;
  g.ailment(AIL.pool, pos.x, pos.y, s, s, { seed, a: [radius, kind, 0, 0] });
}
