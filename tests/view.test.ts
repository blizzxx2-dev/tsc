import { describe, expect, it } from 'vitest';
import { mapPointer } from '../src/core/input';
import { Camera2D, EASE, Shake } from '../src/render/camera';
import { computeView, effectiveUiScale } from '../src/render/viewport';
import { anchor, anchorShift, viewRect } from '../src/ui/layout';
import { Entity } from '../src/surgery/entity';
import { Operation, type OperationDef } from '../src/surgery/operation';
import type { Pointer, ToolId } from '../src/surgery/types';

describe('aspect policy and pointer mapping (ENG-0182–0185)', () => {
  const cases: [string, number, number][] = [
    ['16:9', 1920, 1080],
    ['16:10', 1280, 800],
    ['21:9', 2560, 1080],
    ['32:9', 5120, 1440],
    ['4:3', 1024, 768],
  ];

  it('the safe area is always fully visible and the extra space extends the view', () => {
    for (const [, w, h] of cases) {
      const v = computeView(w, h);
      expect(v.w).toBeGreaterThanOrEqual(1280);
      expect(v.h).toBeGreaterThanOrEqual(720);
      expect(v.w * v.scale).toBeLessThanOrEqual(w + 1e-6);
      expect(v.h * v.scale).toBeLessThanOrEqual(h + 1e-6);
      // No letterbox bars within the supported range: the canvas fills the window.
      expect(Math.max(Math.abs(v.w * v.scale - w), Math.abs(v.h * v.scale - h))).toBeLessThan(1e-6);
    }
    expect(computeView(1280, 800)).toMatchObject({ w: 1280, h: 800, ox: 0, oy: 40 });
    expect(computeView(2560, 1080).oy).toBe(0);
  });

  it('beyond 32:9 the view stops growing and bars appear instead', () => {
    const v = computeView(7680, 1080);
    expect(v.w / v.h).toBeCloseTo(32 / 9, 6);
    expect(v.w * v.scale).toBeLessThan(7680);
  });

  it('client pixels map to safe-area coordinates under every aspect, letterbox and DPR', () => {
    for (const [, w, h] of cases) {
      const v = computeView(w, h);
      const cssW = v.w * v.scale;
      const cssH = v.h * v.scale;
      // Canvas centred in the window (letterbox offsets), any backbuffer size.
      const rect = { left: (w - cssW) / 2 + 3, top: (h - cssH) / 2 + 7, width: cssW, height: cssH };
      const toClient = (x: number, y: number) => [rect.left + ((x + v.ox) / v.w) * cssW, rect.top + ((y + v.oy) / v.h) * cssH];
      for (const [x, y] of [
        [0, 0],
        [640, 360],
        [1280, 720],
        [-v.ox, -v.oy],
      ]) {
        const [cx, cy] = toClient(x, y);
        const p = mapPointer(cx, cy, rect, v);
        expect(p.x).toBeCloseTo(x, 6);
        expect(p.y).toBeCloseTo(y, 6);
      }
    }
  });

  it('UI scale (UIX-0015/ENG-0188): 0.8 zooms out around the safe area, 1.0 is the base view, 1.25 is clamped so the safe area still fits', () => {
    for (const [, w, h] of cases) {
      const base = computeView(w, h);
      const small = computeView(w, h, 1280, 720, 0.8);
      const large = computeView(w, h, 1280, 720, 1.25);
      // 80 %: the HUD is four fifths the size and the view shows the extra world symmetrically around the safe area.
      expect(small.scale).toBeCloseTo(base.scale * 0.8, 9);
      expect(small.w).toBeCloseTo(base.w / 0.8, 6);
      expect(small.h).toBeCloseTo(base.h / 0.8, 6);
      expect(small.ox).toBeCloseTo((small.w - 1280) / 2, 6);
      expect(small.oy).toBeCloseTo((small.h - 720) / 2, 6);
      // The canvas box does not change with the UI scale, and the safe area is always inside the view.
      for (const v of [small, large]) {
        expect(v.w * v.scale).toBeCloseTo(base.w * base.scale, 6);
        expect(v.h * v.scale).toBeCloseTo(base.h * base.scale, 6);
        expect(v.w).toBeGreaterThanOrEqual(1280 - 1e-9);
        expect(v.h).toBeGreaterThanOrEqual(720 - 1e-9);
        expect(v.ox).toBeGreaterThanOrEqual(-1e-9);
        expect(v.oy).toBeGreaterThanOrEqual(-1e-9);
      }
      // 100 % is exactly the base policy; 125 % never crops: the safe area already fills one axis, so it is clamped.
      expect(computeView(w, h, 1280, 720, 1)).toEqual(base);
      expect(large.scale).toBeLessThanOrEqual(Math.min(w / 1280, h / 720) + 1e-9);
      expect(effectiveUiScale(w, h, 0.8)).toBeCloseTo(0.8, 9);
      expect(effectiveUiScale(w, h, 1)).toBeCloseTo(1, 9);
      expect(effectiveUiScale(w, h, 1.25)).toBeLessThanOrEqual(1.25 + 1e-9);
    }
    // 16:10 (Steam Deck 1280×800) at 0.8: 1600×1000 virtual units with 160/140 margins, HUD anchors on the screen edges.
    const deck = computeView(1280, 800, 1280, 720, 0.8);
    expect(deck).toMatchObject({ w: 1600, h: 1000, ox: 160, oy: 140 });
    expect(deck.scale).toBeCloseTo(0.8, 9);
    expect(anchor('top-left', 0, 0, deck)).toEqual({ x: 0, y: -140 });
    expect(anchor('bottom-right', 0, 0, deck)).toEqual({ x: 1280, y: 860 });
    expect(anchorShift('bottom', deck)).toBe(140);
    expect(computeView(1280, 800, 1280, 720, 1.25)).toEqual(computeView(1280, 800));
    expect(effectiveUiScale(1280, 800, 1.25)).toBeCloseTo(1, 9);
    // Out-of-range values are clamped to the setting's range; a non-number means 100 %.
    expect(computeView(1920, 1080, 1280, 720, 0.1)).toEqual(computeView(1920, 1080, 1280, 720, 0.8));
    expect(computeView(1920, 1080, 1280, 720, NaN)).toEqual(computeView(1920, 1080));
  });

  it('anchors: horizontal edges stay on the safe area, vertical edges follow the visible view (ENG-0184)', () => {
    const tall = { ...computeView(1024, 768) };
    expect(anchor('top-left', 14, 10, tall)).toEqual({ x: 14, y: -120 + 10 });
    expect(anchor('bottom-right', -10, -5, tall)).toEqual({ x: 1270, y: 840 - 5 });
    expect(anchorShift('bottom', tall)).toBe(120);
    const wide = computeView(2560, 1080);
    expect(anchor('top-right', 0, 0, wide)).toEqual({ x: 1280, y: 0 });
    expect(viewRect(wide).x).toBeCloseTo(-wide.ox, 6);
    expect(anchor('center', 0, 0, wide)).toEqual({ x: 640, y: 360 });
  });
});

class Target extends Entity {
  hits = 0;
  constructor(
    pos: { x: number; y: number },
    readonly r: number,
  ) {
    super(pos);
  }
  onPress(_op: Operation, ptr: Pointer, _tool: ToolId): boolean {
    if (Math.hypot(ptr.pos.x - this.pos.x, ptr.pos.y - this.pos.y) > this.r) return false;
    this.hits++;
    return true;
  }
  draw(): void {}
}

describe('Camera2D (ENG-0045/0046/0047/0049)', () => {
  it('toWorld and toView are inverses at any zoom, pan and rotation', () => {
    const c = new Camera2D();
    c.x = 700;
    c.y = 380;
    c.zoom = 2.5;
    c.rotation = 0.3;
    for (const p of [
      { x: 0, y: 0 },
      { x: 640, y: 360 },
      { x: 1200, y: 90 },
    ]) {
      const w = c.toWorld(p);
      const v = c.toView(w);
      expect(v.x).toBeCloseTo(p.x, 6);
      expect(v.y).toBeCloseTo(p.y, 6);
    }
  });

  it('a click at 2× zoom with an offset pan lands on the entity under the cursor', () => {
    const def = {
      id: 't',
      title: 't',
      patient: 'p',
      diagnosis: 'd',
      organ: 'flesh',
      timeLimit: 99,
      tools: ['tongs'],
      phases: [{ spawn: () => [] }],
      ranks: { S: 1, A: 1, B: 1 },
    } as unknown as OperationDef;
    const op = new Operation(def);
    for (let i = 0; i < 200 && op.status !== 'running'; i++) op.update(1 / 60);
    const a = new Target({ x: 600, y: 400 }, 12);
    const b = new Target({ x: 640, y: 400 }, 12);
    op.spawn(a, b);
    const cam = new Camera2D();
    cam.focus({ x: 620, y: 400 }, 2, 0);
    // On screen, `a` (world 600) is at view x = 640 + (600 − 620)·2 = 600.
    const world = cam.toWorld({ x: 600, y: 360 });
    op.handlePointer({ pos: world, prev: world, down: true, pressed: true, released: false }, 1 / 120);
    expect(a.hits).toBe(1);
    expect(b.hits).toBe(0);
    // Without the camera mapping the same click would hit nothing at y=360.
    expect(Math.abs(world.y - 400)).toBeLessThan(1e-9);
  });

  it('focus tweens ease between states and end exactly on target', () => {
    const c = new Camera2D();
    c.focus({ x: 800, y: 500 }, 2, 1, 'inOutCubic');
    c.update(0.5);
    expect(c.zoom).toBeCloseTo(1.5, 6);
    c.update(0.6);
    expect(c).toMatchObject({ x: 800, y: 500, zoom: 2 });
    expect(c.tweening).toBe(false);
    for (const e of Object.values(EASE)) {
      expect(e(0)).toBeCloseTo(0, 9);
      expect(e(1)).toBeCloseTo(1, 9);
    }
  });

  it('bounds clamp keeps the view inside the drape', () => {
    const c = new Camera2D();
    c.bounds = { x: 0, y: 0, w: 1280, h: 720 };
    c.focus({ x: 0, y: 0 }, 2, 0);
    const tl = c.toWorld({ x: 0, y: 0 });
    expect(tl.x).toBeGreaterThanOrEqual(-1e-9);
    expect(tl.y).toBeGreaterThanOrEqual(-1e-9);
    c.zoom = 0.5;
    c.clamp();
    expect(c.zoom).toBe(1);
  });

  it('trauma shake is smooth, decays to zero and is reproducible (no Math.random)', () => {
    const run = () => {
      const s = new Shake(14, 0.02, 1.6, 3);
      s.add(0.8);
      const out: number[] = [];
      for (let i = 0; i < 120; i++) {
        s.update(1 / 120);
        out.push(s.sample(1).x);
      }
      return out;
    };
    const a = run();
    expect(run()).toEqual(a);
    for (let i = 1; i < a.length; i++) expect(Math.abs(a[i] - a[i - 1])).toBeLessThan(3);
    const s = new Shake();
    s.add(1);
    for (let i = 0; i < 240; i++) s.update(1 / 120);
    expect(s.sample(1)).toMatchObject({ x: 0, y: 0 });
  });
});
