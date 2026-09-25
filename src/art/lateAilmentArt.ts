/**
 * Chapter III–V ailment art drawn with the batcher.
 *
 * - Petrification (ART-0221): the creeping stone crust in four stages by age (a grey film, then
 *   scaled plates, then fissured slabs, then deep-cracked stone), and a 6-frame crack-apart
 *   flipbook for each plate the lancet breaks (shards flying out, dust settling).
 * - Tallow clots (ART-0194): a lumpy, waxy clot with a candle-wax sheen; under the Brand it
 *   softens, glosses and runs in drips — a melt that visibly slumps as the leech draws it off.
 */
import type { Vec } from '../core/math';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { FPS } from './timing';

/** Seconds of age for each crust stage (0..3). */
export const CRUST_STAGE_S = 2.5;
export const crustStage = (age: number): 0 | 1 | 2 | 3 => Math.min(3, Math.max(0, Math.floor(age / CRUST_STAGE_S))) as 0 | 1 | 2 | 3;

const STONE = ['#a8a49a', '#9a968c', '#8a8680', '#76726c'] as const;

/** The crust along `pts` (oldest first); `ages[i]` seconds since the stone reached point i. */
export function petrifyCrustArt(g: Gfx, pts: readonly Vec[], ages: readonly number[], seed = 0): void {
  if (pts.length < 2) return;
  // One continuous shadow, then each run of equal stage as one stroke (thicker and darker with age).
  g.polyline([...pts], 36, hex('#3a3830', 0.3));
  let run: Vec[] = [pts[0]];
  let runSt = crustStage(ages[0]);
  const flush = () => {
    if (run.length > 1) g.polyline(run, 22 + runSt * 5, hex(STONE[runSt], 0.6 + runSt * 0.1));
  };
  for (let i = 1; i < pts.length; i++) {
    const st = crustStage(ages[i]);
    run.push(pts[i]);
    if (st !== runSt) {
      flush();
      run = [pts[i]];
      runSt = st;
    }
  }
  flush();
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const st = crustStage(ages[i]);
    const w = 22 + st * 5;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const k = (i * 7919 + seed * 31) % 97;
    // Stage 1+: scale plates; stage 2+: a fissure across; stage 3: deep dark cracks and flecks.
    if (st >= 1) g.ellipse(mx + ((k % 7) - 3), my + ((k % 5) - 2), w * 0.32, w * 0.22, k * 0.1, hex('#bab6aa', 0.6));
    if (st >= 2) {
      const ang = (k / 97) * Math.PI;
      g.line({ x: mx - Math.cos(ang) * w * 0.45, y: my - Math.sin(ang) * w * 0.45 }, { x: mx + Math.cos(ang) * w * 0.45, y: my + Math.sin(ang) * w * 0.45 }, 1.4, hex('#3a3630', 0.7));
    }
    if (st >= 3) {
      g.line({ x: mx, y: my }, { x: mx + ((k % 11) - 5) * 1.6, y: my + w * 0.4 }, 2.2, hex('#1e1c18', 0.8));
      g.circle(mx - w * 0.2, my - w * 0.15, 1.6, hex('#e8e4d8', 0.7));
    }
  }
}

/** Frames in the crack-apart flipbook. */
export const PLATE_CRACK_FRAMES = 6;

/**
 * A crust plate. `crackAge` < 0: whole, with its order number; otherwise the crack-apart flipbook
 * plays for PLATE_CRACK_FRAMES at the woodcut rate, then nothing is drawn.
 */
export function petrifyPlateArt(g: Gfx, pos: Vec, r: number, o: { index: number; next: boolean; crackAge: number; seed?: number }): void {
  if (o.crackAge < 0) {
    g.circle(pos.x + 1.5, pos.y + 2, r, hex('#000000', 0.3));
    g.circle(pos.x, pos.y, r, hex('#b0aca0'));
    g.line({ x: pos.x - r * 0.6, y: pos.y - r * 0.2 }, { x: pos.x + r * 0.3, y: pos.y + r * 0.5 }, 1.2, hex('#5a564c', 0.6));
    g.arc(pos.x, pos.y, r, 2, hex(o.next ? '#f5d76e' : '#5a564c'));
    g.text(String(o.index + 1), pos.x, pos.y + 6, { size: 16, color: hex('#2a2620'), align: 'center', shadow: false });
    return;
  }
  const f = Math.floor(o.crackAge * FPS.woodcut);
  if (f >= PLATE_CRACK_FRAMES) return;
  const k = f / (PLATE_CRACK_FRAMES - 1);
  // Five wedges fly out and tumble; a dust puff swells and fades.
  g.circleGrad(pos.x, pos.y, r * (1 + k * 1.4), hex('#d8d4c8', 0.35 * (1 - k)), hex('#d8d4c8', 0));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + (o.seed ?? 0);
    const d = r * 0.35 + k * r * 1.6;
    const cx = pos.x + Math.cos(a) * d;
    const cy = pos.y + Math.sin(a) * d + k * k * 8;
    const rot = a + k * 2;
    const s = r * 0.55 * (1 - k * 0.4);
    g.tri(cx + Math.cos(rot) * s, cy + Math.sin(rot) * s, cx + Math.cos(rot + 2.2) * s * 0.7, cy + Math.sin(rot + 2.2) * s * 0.7, cx + Math.cos(rot - 2.2) * s * 0.7, cy + Math.sin(rot - 2.2) * s * 0.7, hex('#a8a498', 1 - k * 0.7));
  }
}

/** A tallow clot: `soft` 0..1 (warmed by the Brand), `drawn` 0..1 (drawn off by the leech). */
export function tallowClotArt(g: Gfx, pos: Vec, r: number, o: { soft: number; drawn: number; t: number; seed?: number; scorched?: boolean }): void {
  const seed = o.seed ?? 0;
  const k = Math.max(0, 1 - o.drawn);
  const rr = r * (0.35 + 0.65 * k);
  // The clot slumps as it softens: lower and wider.
  const sy = 1 - 0.25 * o.soft;
  const sx = 1 + 0.15 * o.soft;
  g.ellipse(pos.x + 2, pos.y + 3, rr * sx * 1.05, rr * sy * 0.95, 0, hex('#000000', 0.25));
  const lumps = 5;
  for (let i = 0; i < lumps; i++) {
    const a = (i / lumps) * Math.PI * 2 + seed;
    const lx = pos.x + Math.cos(a) * rr * 0.4 * sx;
    const ly = pos.y + Math.sin(a) * rr * 0.35 * sy;
    g.circleGrad(lx, ly, rr * 0.62, hex(o.soft > 0.5 ? '#f2dc98' : '#e8e0c8'), hex(o.scorched ? '#8a6a3a' : '#b0a078', 0.9));
  }
  // Wax sheen: a broad dull highlight when set, a wet sharp one when molten.
  g.ellipse(pos.x - rr * 0.25, pos.y - rr * 0.3, rr * (0.35 - 0.15 * o.soft), rr * (0.18 - 0.08 * o.soft), -0.5, hex('#fffaf0', 0.35 + 0.45 * o.soft));
  if (o.soft > 0) {
    g.glow(pos.x, pos.y, rr * 1.5, hex('#ffb040', 0.12 * o.soft + 0.04 * Math.sin(o.t * 6)));
    // Drips run down and lengthen with the melt.
    for (let i = 0; i < 3; i++) {
      const x = pos.x + (i - 1) * rr * 0.45;
      const top = pos.y + rr * 0.5 * sy;
      const len = rr * (0.3 + 0.5 * o.soft) * (0.7 + 0.3 * Math.sin(seed + i * 2.1)) * k;
      g.line({ x, y: top }, { x, y: top + len }, 3, hex('#f0d890', 0.9));
      g.circle(x, top + len, 2.6, hex('#f6e4a8'));
    }
  }
}
