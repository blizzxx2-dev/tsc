/**
 * In-field instrument sprites (ART-0269) and their hotspots (ART-0270). While an instrument works
 * the field, it is drawn at the pointer in its own 64×64 sprite frame, placed so the sprite's tip
 * pixel (`TOOL_TIPS`) sits exactly on the pointer — the point every hit-test uses. The debug overlay
 * (`op.debug`) draws `drawTipDebug`: a crosshair at the pointer and a box round the tip pixel.
 */
import type { Vec } from '../core/math';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { SWATCHES } from '../render/palette';
import type { ToolId } from '../surgery/types';

export const TOOL_SPRITE_SIZE = 64;

/** Tip (hotspot) pixel of each sprite, in its 64×64 frame. */
export const TOOL_TIPS: Record<ToolId, Vec> = {
  lancet: { x: 4, y: 60 },
  tongs: { x: 5, y: 59 },
  leech: { x: 4, y: 60 },
  thread: { x: 5, y: 59 },
  salve: { x: 6, y: 58 },
  tincture: { x: 3, y: 61 },
  brand: { x: 6, y: 58 },
  lens: { x: 24, y: 24 },
};

export interface FieldToolState {
  /** Tongs: jaws closed on something. */
  closed?: boolean;
  /** Brand heat 0..1 (glow). */
  heat?: number;
  /** Gut Thread: recent pointer positions (world), newest last, for the trailing thread. */
  trail?: Vec[];
  /** Tincture colour. */
  tint?: string;
}

/** Top-left of the sprite frame for a pointer at p. */
export const spriteOrigin = (tool: ToolId, p: Vec): Vec => ({ x: p.x - TOOL_TIPS[tool].x, y: p.y - TOOL_TIPS[tool].y });

/** Where the tip pixel lands for a pointer at p (always p: the contract ART-0270 tests). */
export const tipAt = (tool: ToolId, p: Vec): Vec => {
  const o = spriteOrigin(tool, p);
  return { x: o.x + TOOL_TIPS[tool].x, y: o.y + TOOL_TIPS[tool].y };
};

const steel = (a = 1) => hex('#d8dce0', a);
const steelLo = (a = 1) => hex('#6a7078', a);
const shadow = hex('#000000', 0.35);

/** Draw `tool` at pointer p, tip on p. */
export function drawFieldTool(g: Gfx, tool: ToolId, p: Vec, s: FieldToolState = {}, t = 0): void {
  if (tool === 'thread' && s.trail && s.trail.length > 1) {
    // The thread trails behind the needle eye in world space.
    g.polyline(s.trail, 2.2, hex(SWATCHES.soot, 0.4));
    g.polyline(s.trail, 1.2, hex(SWATCHES.linen, 0.9));
  }
  const o = spriteOrigin(tool, p);
  g.save();
  g.translate(o.x, o.y);
  const L = (ax: number, ay: number, bx: number, by: number, w: number, c: number) => g.line({ x: ax, y: ay }, { x: bx, y: by }, w, c);
  // Drop shadow: the whole instrument offset down-right.
  const sh = (fn: () => void) => {
    g.save();
    g.translate(3, 4);
    fn();
    g.restore();
  };
  switch (tool) {
    case 'lancet':
      sh(() => L(4, 60, 58, 6, 6, shadow));
      g.poly([{ x: 4, y: 60 }, { x: 15, y: 43 }, { x: 22, y: 42 }, { x: 21, y: 49 }], steel(), steelLo());
      L(8, 56, 19, 45, 0.8, hex('#ffffff', 0.8));
      L(22, 42, 58, 6, 6, hex(SWATCHES.bone));
      L(22, 42, 58, 6, 1.5, hex(SWATCHES.foxing, 0.8));
      for (let i = 0; i < 4; i++) L(30 + i * 7, 34 - i * 7, 33 + i * 7, 37 - i * 7, 1, hex(SWATCHES.inkDark, 0.6));
      break;
    case 'tongs': {
      const open = s.closed ? 0 : 5;
      sh(() => L(5, 59, 58, 6, 6, shadow));
      L(5 - open * 0.7, 59 - open * 0.7, 52, 8, 3, steel());
      L(5 + open * 0.7, 59 + open * 0.7, 58, 14, 3, steel());
      L(5 - open * 0.7, 59 - open * 0.7, 12 - open * 0.3, 52 - open * 0.8, 3.5, steelLo());
      L(5 + open * 0.7, 59 + open * 0.7, 12 + open * 0.8, 52 + open * 0.3, 3.5, steelLo());
      g.circle(55, 11, 4, hex(SWATCHES.brass));
      g.circle(55, 11, 1.5, hex(SWATCHES.brassLo));
      break;
    }
    case 'leech':
      sh(() => L(4, 60, 50, 14, 7, shadow));
      L(4, 60, 14, 50, 4, hex(SWATCHES.brassLo));
      L(12, 52, 44, 20, 7, hex(SWATCHES.brass));
      L(12, 52, 44, 20, 2, hex(SWATCHES.brassHi, 0.8));
      g.ellipse(50, 14, 11, 8, -0.78, hex('#5a1a1a'), hex('#2a0808'));
      g.circle(47, 11, 2.5, hex('#ffb0a0', 0.35));
      break;
    case 'thread':
      sh(() => g.quadCurve({ x: 5, y: 59 }, { x: 10, y: 38 }, { x: 30, y: 34 }, 3, shadow));
      g.quadCurve({ x: 5, y: 59 }, { x: 10, y: 38 }, { x: 30, y: 34 }, 2.2, steel(), 10);
      g.quadCurve({ x: 6, y: 57 }, { x: 11, y: 39 }, { x: 29, y: 35 }, 0.7, hex('#ffffff', 0.7), 10);
      g.arc(30, 34, 2.2, 1, steelLo());
      break;
    case 'salve':
      sh(() => L(6, 58, 58, 6, 7, shadow));
      g.ellipse(10, 54, 9, 5, -0.78, hex('#c8a870'), hex('#8a6a3a'));
      g.ellipse(8, 56, 6, 3.5, -0.78, hex('#f0e8c8', 0.95), hex('#d8cca0', 0.9));
      L(16, 48, 58, 6, 4, hex('#8a6a3a'));
      L(16, 48, 58, 6, 1, hex('#c8a870', 0.8));
      break;
    case 'tincture': {
      const tint = hex(s.tint ?? SWATCHES.verdigris, 0.85);
      sh(() => L(3, 61, 56, 8, 8, shadow));
      L(3, 61, 16, 48, 1.4, steel());
      L(16, 48, 20, 44, 5, hex(SWATCHES.brass));
      L(20, 44, 42, 22, 9, hex('#e8f0f0', 0.35));
      L(21, 43, 34, 30, 6, tint);
      L(20, 44, 42, 22, 1, hex('#ffffff', 0.6));
      L(42, 22, 46, 18, 10, hex(SWATCHES.brass));
      L(46, 18, 56, 8, 2.5, hex(SWATCHES.brassLo));
      L(52, 4, 60, 12, 3, hex(SWATCHES.brass));
      break;
    }
    case 'brand': {
      const heat = Math.max(0, Math.min(1, s.heat ?? 0.6));
      sh(() => L(6, 58, 58, 6, 6, shadow));
      L(12, 52, 44, 20, 3.5, hex('#3a3634'));
      L(44, 20, 58, 6, 6, hex(SWATCHES.oak));
      g.poly([{ x: 2, y: 56 }, { x: 8, y: 50 }, { x: 14, y: 56 }, { x: 8, y: 62 }], hex('#2a2220'));
      g.setBlend('add');
      const flick = 0.85 + 0.15 * Math.sin(t * 23);
      g.circleGrad(7, 57, 10 + 6 * heat, hex('#ff8030', 0.7 * heat * flick), hex('#ff4010', 0));
      g.poly([{ x: 3, y: 56 }, { x: 8, y: 51 }, { x: 13, y: 56 }, { x: 8, y: 61 }], hex('#ffb060', 0.9 * heat));
      g.setBlend('alpha');
      break;
    }
    case 'lens':
      sh(() => L(33, 33, 60, 60, 6, shadow));
      L(33, 33, 60, 60, 6, hex(SWATCHES.oak));
      g.arc(24, 24, 13, 4, hex(SWATCHES.brass));
      g.arc(24, 24, 13, 1, hex(SWATCHES.brassHi));
      g.circle(24, 24, 11, hex(SWATCHES.frost, 0.12));
      g.arc(24, 24, 8, 1.5, hex('#ffffff', 0.5), 0.2, -2.4);
      break;
  }
  g.restore();
}

/** Debug crosshair (ART-0270): magenta cross at the pointer, cyan box round the sprite's tip pixel. */
export function drawTipDebug(g: Gfx, tool: ToolId, p: Vec): void {
  const tip = tipAt(tool, p);
  g.line({ x: p.x - 12, y: p.y }, { x: p.x + 12, y: p.y }, 1, hex('#ff40ff'));
  g.line({ x: p.x, y: p.y - 12 }, { x: p.x, y: p.y + 12 }, 1, hex('#ff40ff'));
  g.rectLine(tip.x - 1.5, tip.y - 1.5, 3, 3, 1, hex('#40ffff'));
  const o = spriteOrigin(tool, p);
  g.rectLine(o.x, o.y, TOOL_SPRITE_SIZE, TOOL_SPRITE_SIZE, 1, hex('#40ffff', 0.35));
}
