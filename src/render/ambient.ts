/**
 * Ambient backdrop particles for story scenes (ENG-0143): candle flames that gutter in place, dust
 * motes turning in shafts of light, and incense curling up from censers. All deterministic in time
 * (no state, no randomness) so a backdrop looks the same on every visit and in every replay.
 */
import type { Vec } from '../core/math';
import { hex } from './color';
import type { Gfx } from './gfx';

export interface Shaft {
  /** Where the shaft enters at the top of the view, px. */
  x: number;
  /** Lean from vertical, radians (positive leans right going down). */
  lean: number;
  /** Width at the top, px. */
  w: number;
}

export interface Ambience {
  candles?: readonly Vec[];
  shafts?: readonly Shaft[];
  incense?: readonly Vec[];
}

/** Per-backdrop ambience (1280×720 view px, placed against the painted sets). */
export const AMBIENCE: Record<string, Ambience> = {
  // Candles sit on the sets' own candlesticks; shafts fall from their windows and lamps.
  chapel: { candles: [{ x: 567, y: 414 }, { x: 712, y: 414 }], shafts: [{ x: 600, lean: 0.05, w: 150 }], incense: [{ x: 640, y: 440 }] },
  hospice: { candles: [{ x: 256, y: 407 }, { x: 640, y: 407 }, { x: 1018, y: 402 }] },
  apothecary: { shafts: [{ x: 360, lean: 0.3, w: 90 }], incense: [{ x: 780, y: 380 }] },
  theatre: { shafts: [{ x: 640, lean: 0, w: 170 }] },
  guildhall: { shafts: [{ x: 640, lean: 0, w: 150 }] },
  dawn: { shafts: [{ x: 620, lean: 0.35, w: 140 }, { x: 900, lean: -0.2, w: 100 }] },
};

/** Motes per shaft at full density. */
export const MOTES_PER_SHAFT = 26;

/** A candle flame's height scale at time t (0.75..1.15): a slow sway with a quick gutter. */
export function flameFlicker(t: number, i: number): number {
  return 0.95 + 0.12 * Math.sin(t * 7.3 + i * 1.7) + 0.08 * Math.sin(t * 17.1 + i * 3.1) * Math.max(0, Math.sin(t * 0.9 + i));
}

/** Dust mote k of a shaft at time t: drifting slowly down and across inside the shaft. */
export function motePos(s: Shaft, k: number, t: number, h = 720): Vec {
  const u = (k * 0.618034) % 1;
  const depth = ((k * 0.381966 + t * (0.012 + (k % 4) * 0.004)) % 1) * h * 0.85;
  const spread = (u - 0.5) * (s.w + depth * 0.25) + Math.sin(t * 0.6 + k) * 6;
  return { x: s.x + Math.tan(s.lean) * depth + spread, y: depth + Math.cos(t * 0.5 + k * 2.1) * 4 };
}

/** Draw a backdrop's ambience; `density` 0..1 scales mote and smoke counts with the art quality. */
export function drawAmbience(g: Gfx, key: string, t: number, density = 1): void {
  const a = AMBIENCE[key];
  if (!a) return;
  g.setBlend('add');
  for (const s of a.shafts ?? []) {
    // The shaft itself: a faint wedge of light, then the motes that turn in it.
    const len = 620;
    const bx = s.x + Math.tan(s.lean) * len;
    g.line({ x: s.x, y: 0 }, { x: bx, y: len }, s.w, hex('#fff2d0', 0.06));
    const n = Math.round(MOTES_PER_SHAFT * density);
    for (let k = 0; k < n; k++) {
      const p = motePos(s, k, t);
      const tw = 0.5 + 0.5 * Math.sin(t * 2.3 + k * 1.3);
      g.circleGrad(p.x, p.y, 1.6 + (k % 3) * 0.6, hex('#fff0cc', 0.4 + 0.45 * tw), hex('#fff0cc', 0));
    }
  }
  a.candles?.forEach((c, i) => {
    const f = flameFlicker(t, i);
    g.circleGrad(c.x, c.y - 10, 46 * f, hex('#ffb060', 0.16), hex('#ffb060', 0));
    g.ellipse(c.x, c.y - 9 * f, 3.4, 9 * f, Math.sin(t * 3 + i) * 0.08, hex('#ffd890', 0.85), hex('#ff8a30', 0.2));
    g.ellipse(c.x, c.y - 6 * f, 1.6, 4 * f, 0, hex('#fffbe8', 0.9));
  });
  g.setBlend('alpha');
  for (const src of a.incense ?? []) {
    // Incense: soft puffs rising and widening, curling side to side as they climb.
    const n = Math.round(14 * density);
    for (let k = 0; k < n; k++) {
      const life = (k / n + t * 0.07) % 1;
      const y = src.y - life * 360;
      const x = src.x + Math.sin(life * 7 + t * 0.4 + k) * (10 + life * 40);
      g.circleGrad(x, y, 10 + life * 38, hex('#c8c0b4', 0.22 * (1 - life) * Math.min(1, life * 6)), hex('#c8c0b4', 0));
    }
  }
}
