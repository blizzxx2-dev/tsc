/**
 * Boss VFX drawn by the Hours themselves (pure drawing, no simulation imports): the Lauds
 * light-thread (ART-0237) and the Lauds dawn flare (ART-0238, spec in docs/art/vfx/dawn-flare.md).
 */
import type { Vec } from '../core/math';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { SWATCHES } from '../render/palette';
import { EASE } from './timing';

/** Seconds the sever recoil plays, and the reweave tie-off before the link returns. */
export const THREAD_SEVER_S = 0.5;
export const THREAD_TIE_S = 0.6;

export interface ThreadState {
  /** 0..1 brightness (dim beat ≈ 0.18, blazing 0.75). */
  bright: number;
  /** 0..1 progress of the sever recoil, or null. */
  sever: number | null;
  /** 0..1 progress of the tie-off (the ends reach and knot), or null. */
  tie: number | null;
}

const lerp = (a: Vec, b: Vec, k: number): Vec => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });

/**
 * The light-thread (ART-0237): a beam that stretches to any length between two points, with
 * pulses travelling from A to B (the call) and back (the answer). Severed, the halves recoil
 * and fray back to their bodies; rewoven, the ends reach across and a knot flares where they tie.
 */
export function lightThread(g: Gfx, a: Vec, b: Vec, t: number, s: ThreadState): void {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const nx = -(b.y - a.y) / len;
  const ny = (b.x - a.x) / len;
  g.setBlend('add');
  if (s.sever !== null || s.tie !== null) {
    // Two halves: recoiling (sever) or reaching back (tie-off).
    const reach = s.sever !== null ? 0.5 * (1 - EASE.outCubic(s.sever)) : 0.5 * EASE.outCubic(s.tie ?? 0);
    const alpha = s.sever !== null ? 1 - s.sever : 0.4 + 0.6 * (s.tie ?? 0);
    for (const [from, to] of [
      [a, b],
      [b, a],
    ] as const) {
      const end = lerp(from, to, reach);
      const pts: Vec[] = [];
      for (let i = 0; i <= 10; i++) {
        const k = i / 10;
        const wob = Math.sin(t * 30 + i * 1.7) * 6 * k * (s.sever !== null ? 1 : 0.3);
        const p = lerp(from, end, k);
        pts.push({ x: p.x + nx * wob, y: p.y + ny * wob });
      }
      g.polyline(pts, 7, hex('#ffd8a0', 0.25 * alpha));
      g.polyline(pts, 2, hex('#fff0d0', 0.9 * alpha));
      // Frayed filaments at the cut end.
      if (s.sever !== null)
        for (let f = -2; f <= 2; f++) g.line(end, { x: end.x + nx * f * 5 + (to.x - from.x) * 0.02, y: end.y + ny * f * 5 + (to.y - from.y) * 0.02 }, 1, hex(SWATCHES.gilt, 0.7 * alpha));
    }
    if (s.sever !== null && s.sever < 0.4) {
      const m = lerp(a, b, 0.5);
      g.circleGrad(m.x, m.y, 40 * (1 + s.sever * 2), hex(SWATCHES.tallowHi, 0.8 * (1 - s.sever / 0.4)), hex(SWATCHES.gilt, 0));
    }
    if (s.tie !== null && s.tie > 0.8) {
      // The knot: a bright bead with two loops.
      const m = lerp(a, b, 0.5);
      const k = (s.tie - 0.8) / 0.2;
      g.circleGrad(m.x, m.y, 26 * k, hex(SWATCHES.tallowHi, 0.9), hex(SWATCHES.gilt, 0));
      g.arc(m.x - 5, m.y, 6, 1.5, hex('#fff0d0', 0.9 * k));
      g.arc(m.x + 5, m.y, 6, 1.5, hex('#fff0d0', 0.9 * k));
    }
    g.setBlend('alpha');
    return;
  }
  const br = s.bright;
  g.line(a, b, 12, hex('#ffd8a0', br * 0.18));
  g.line(a, b, 5, hex('#ffd8a0', br * 0.35));
  g.line(a, b, 2, hex('#fff0d0', br));
  // Travelling pulses: three calls A→B, and one answer B→A, spaced by the beam's length.
  const speed = 260;
  for (let i = 0; i < 3; i++) {
    const k = ((t * speed) / len + i / 3) % 1;
    const p = lerp(a, b, k);
    g.circleGrad(p.x, p.y, 10 + 4 * br, hex(SWATCHES.tallowHi, 0.7 * br * Math.sin(k * Math.PI)), hex(SWATCHES.gilt, 0));
  }
  const ka = ((t * speed * 0.6) / len) % 1;
  const pa = lerp(b, a, ka);
  g.circleGrad(pa.x, pa.y, 8, hex(SWATCHES.ember, 0.6 * br * Math.sin(ka * Math.PI)), hex(SWATCHES.ember, 0));
  g.setBlend('alpha');
}

/**
 * Dawn-flare intensity (ART-0238) at `age` seconds into a flare lasting `dur`: a 0.12 s attack to
 * full, a hold to 0.35 s, then a quadratic fall to 0 at `dur`. See docs/art/vfx/dawn-flare.md.
 */
export const FLARE = { attack: 0.12, hold: 0.35, peak: 0.85, lensWhiteout: 0.95, tellGlow: 0.35 } as const;

export function flareIntensity(age: number, dur: number): number {
  if (age < 0 || age >= dur) return 0;
  if (age < FLARE.attack) return EASE.outCubic(age / FLARE.attack);
  if (age < FLARE.hold) return 1;
  return (1 - (age - FLARE.hold) / Math.max(0.01, dur - FLARE.hold)) ** 2;
}

/**
 * The dawn flare over the whole view: a gold bloom burst from the horizon, and a white-out of the
 * Scrying Lens if one is up. `tell` (0..1) is the horizon glow before it; `soften` is the
 * reduced-flashing factor (0.35) or 1.
 */
export function dawnFlare(g: Gfx, view: { x: number; y: number; w: number; h: number }, horizon: Vec, k: number, tell: number, soften: number, lens?: Vec, lensR = 95): void {
  g.setBlend('add');
  if (tell > 0) g.circleGrad(horizon.x, horizon.y - 40, 520, hex('#ffc860', FLARE.tellGlow * tell * soften), hex('#ffc860', 0));
  if (k > 0) {
    const a = k * soften;
    g.rect(view.x, view.y, view.w, view.h, hex('#ffe0a0', FLARE.peak * 0.45 * a));
    g.circleGrad(horizon.x, horizon.y, 900, hex('#fff0c0', FLARE.peak * 0.6 * a), hex('#ffc860', 0));
    // Low sun rays fanning up from the horizon.
    for (let i = 0; i < 9; i++) {
      const ang = -Math.PI / 2 + (i - 4) * 0.28;
      g.line(horizon, { x: horizon.x + Math.cos(ang) * 1200, y: horizon.y + Math.sin(ang) * 1200 }, 40, hex('#fff0c0', 0.08 * a));
    }
    if (lens) g.circleGrad(lens.x, lens.y, lensR, hex('#fffbe8', FLARE.lensWhiteout * a), hex('#fff0c0', 0.6 * a));
  }
  g.setBlend('alpha');
}

/** Lauds body states (ART-0236). */
export type ChoirState = 'idle' | 'call' | 'answer' | 'hurt' | 'heal';
/** Mouths in each body's choir, and frames in the call/answer flipbooks. */
export const CHOIR_MOUTHS = 7;
export const CHOIR_FRAMES = 8;

/** Openness 0..1 of mouth `i` in `state` at flipbook `frame` (idle breathes smoothly on `t`). */
export function choirMouth(state: ChoirState, i: number, frame: number, t: number): number {
  // Where the singing wave is on the ring this frame: the call runs clockwise, the answer back.
  const at = (frame / CHOIR_FRAMES) * CHOIR_MOUTHS;
  const d = (k: number) => Math.min(Math.abs(k - at), CHOIR_MOUTHS - Math.abs(k - at));
  switch (state) {
    case 'call':
      return 0.15 + 0.85 * Math.max(0, 1 - d(i) / 1.5);
    case 'answer':
      return 0.15 + 0.85 * Math.max(0, 1 - d(CHOIR_MOUTHS - 1 - i) / 1.5);
    case 'hurt':
      return 0.05;
    case 'heal':
      return 0.9;
    default:
      return 0.25 + 0.15 * Math.sin(t * 1.5 + i * 0.9);
  }
}

/**
 * The choir of mouths round a Lauds body (ART-0236): seven lipped mouths on the rim. Idle they
 * breathe; "call" and "answer" are 8-frame flipbooks at 12 fps (a singing wave running round the
 * ring one way, then back), "hurt" clenches every mouth and jolts the ring, and "heal" (the
 * heal-answer) opens them all in a gold glow. `toward` aims the sound arcs of the call and answer.
 */
export function laudsChoir(g: Gfx, x: number, y: number, r: number, state: ChoirState, t: number, toward?: Vec): void {
  const frame = Math.floor(t * 12) % CHOIR_FRAMES;
  const jolt = state === 'hurt' ? Math.sin(t * 60) * 3 : 0;
  if (state === 'heal') {
    g.setBlend('add');
    g.circleGrad(x, y, r * 2.2, hex(SWATCHES.gilt, 0.35), hex(SWATCHES.gilt, 0));
    g.setBlend('alpha');
  }
  for (let i = 0; i < CHOIR_MOUTHS; i++) {
    const a = (i / CHOIR_MOUTHS) * Math.PI * 2 - Math.PI / 2;
    const mx = x + Math.cos(a) * r * 0.82 + jolt;
    const my = y + Math.sin(a) * r * 0.82;
    const open = choirMouth(state, i, frame, t);
    const w = r * 0.24;
    g.ellipse(mx, my, w, w * (0.2 + 0.55 * open), a + Math.PI / 2, hex('#e8c8c8', 0.9), hex('#b08890', 0.9));
    g.ellipse(mx, my, w * 0.75, w * 0.55 * open, a + Math.PI / 2, hex('#1a0408', 0.95));
  }
  // Sound arcs leave the singing side toward the other body.
  if ((state === 'call' || state === 'answer') && toward) {
    const ang = Math.atan2(toward.y - y, toward.x - x);
    g.setBlend('add');
    for (let k = 0; k < 3; k++) {
      const u = ((t * 1.6 + k / 3) % 1) * 1;
      const rr = r * (1.1 + u * 1.4);
      const c = state === 'call' ? '#ffe0a0' : '#f0d8ff';
      for (let s = -3; s <= 3; s++) {
        const a0 = ang + (s / 3) * 0.45;
        const a1 = ang + ((s + 1) / 3) * 0.45;
        if (s === 3) break;
        g.line({ x: x + Math.cos(a0) * rr, y: y + Math.sin(a0) * rr }, { x: x + Math.cos(a1) * rr, y: y + Math.sin(a1) * rr }, 2, hex(c, 0.6 * (1 - u)));
      }
    }
    g.setBlend('alpha');
  }
}

/** Matins' death (ART-0233): 24 woodcut frames at 12 fps. */
export const MATINS_DEATH_FRAMES = 24;

/**
 * Eye openness over the Matins death: wide through the unravelling, then it closes over the last
 * six frames (the final eye-close).
 */
export const matinsDeathEye = (frame: number): number => (frame < 18 ? 1 : Math.max(0, 1 - (frame - 17) / 6));

/**
 * The shroud unravelling (ART-0233): candle-wax threads peel off the body's rim and drift outward
 * and up, a little longer and looser each frame, shedding motes at their free ends.
 */
export function matinsUnravel(g: Gfx, x: number, y: number, size: number, frame: number, seed = 1): void {
  const k = frame / (MATINS_DEATH_FRAMES - 1);
  const r0 = size * 0.22;
  const fade = 1 - Math.max(0, (k - 0.7) / 0.3);
  for (let i = 0; i < 14; i++) {
    const a0 = (i / 14) * Math.PI * 2 + seed;
    const len = size * (0.08 + 0.45 * k) * (0.7 + 0.3 * Math.sin(i * 2.3 + seed));
    const pts: Vec[] = [];
    for (let j = 0; j <= 8; j++) {
      const u = j / 8;
      const curl = Math.sin(u * 5 + i + k * 4) * 10 * u * (0.5 + k);
      const r = r0 * (1 - 0.2 * k) + len * u;
      const a = a0 + u * 0.6 * (i % 2 ? 1 : -1) * k;
      pts.push({ x: x + Math.cos(a) * r + curl * Math.sin(a), y: y + Math.sin(a) * r * 0.8 - curl * Math.cos(a) - u * len * 0.35 * k });
    }
    g.polyline(pts, 2.2 * (1 - 0.5 * k), hex(SWATCHES.linen, 0.75 * fade));
    g.polyline(pts, 0.9, hex(SWATCHES.tallowHi, 0.6 * fade));
    const end = pts[pts.length - 1];
    g.setBlend('add');
    g.circleGrad(end.x, end.y, 6, hex(SWATCHES.curseViolet, 0.6 * fade), hex(SWATCHES.curseViolet, 0));
    g.setBlend('alpha');
  }
  // The great eye outlives the shroud: from frame 13 it hangs alone, then the lids close over it.
  if (frame >= 12) {
    const open = matinsDeathEye(frame);
    const w = size * 0.2;
    const h = size * 0.09 * open;
    const a = frame === MATINS_DEATH_FRAMES - 1 ? 0.5 : 1;
    if (open > 0) {
      g.ellipse(x, y, w, h, 0, hex(SWATCHES.bone, 0.95 * a), hex('#b8a88a', 0.95 * a));
      g.circleGrad(x, y, Math.min(h, size * 0.05), hex('#c01020', a), hex('#4a0610', a));
      g.ellipse(x, y, size * 0.008, Math.min(h, size * 0.045), 0, hex('#050203', a));
    }
    // Upper and lower lids meeting on the seam.
    g.quadCurve({ x: x - w, y }, { x, y: y - h * 2 }, { x: x + w, y }, 3, hex('#2a1030', a), 16);
    g.quadCurve({ x: x - w, y }, { x, y: y + h * 2 }, { x: x + w, y }, 3, hex('#2a1030', a), 16);
    if (open === 0) g.line({ x: x - w, y }, { x: x + w, y }, 2, hex(SWATCHES.curseDeep, a));
  }
}
