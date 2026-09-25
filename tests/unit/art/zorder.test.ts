/**
 * ART-0362 z-order and overlap audit: (1) ailment sprites never draw under blood pools — pools and
 * spray live in the fluid layer, which is composited before any entity sprite; (2) at 16:10 no HUD
 * element overlaps a Malison weak point anywhere the boss can stand.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIELD } from '../../../src/surgery/operation';
import { anchorShift, VIEW_W } from '../../../src/ui/layout';
import { TRAY } from '../../../src/input/hud';

const SRC = join(__dirname, '../../../src');

describe('z-order (ART-0362)', () => {
  it('the fluid layer (pools, spray) is composited before any entity sprite is drawn', () => {
    const scene = readFileSync(join(SRC, 'scenes/operation.ts'), 'utf8');
    const render = scene.slice(scene.indexOf('  render(g: Gfx, game: Game): void {'));
    const composite = render.indexOf('g.fluidComposite(');
    const sprites = render.indexOf('for (const e of ents) e.draw(g, op);');
    expect(composite).toBeGreaterThan(0);
    expect(sprites).toBeGreaterThan(composite);
  });

  it('a blood pool draws no liquid of its own over sprites (only bone dust)', () => {
    const ents = readFileSync(join(SRC, 'surgery/entities.ts'), 'utf8');
    const pool = ents.slice(
      ents.indexOf('export class BloodPool'),
      ents.indexOf('// ============================================================ lacerations'),
    );
    const draw = pool.slice(pool.indexOf('  draw(g: Gfx'));
    expect(draw).toMatch(/bonedust/);
  });
});

type Rect = { x: number; y: number; w: number; h: number };
const overlaps = (cx: number, cy: number, r: number, b: Rect): boolean => {
  const dx = Math.max(b.x - cx, 0, cx - (b.x + b.w));
  const dy = Math.max(b.y - cy, 0, cy - (b.y + b.h));
  return dx * dx + dy * dy < r * r;
};

describe('HUD never covers a Malison weak point at 16:10 (ART-0362)', () => {
  // 1280×800: the visible view is 800 high, 40 px revealed above and below the 720 safe area.
  const view = { w: 1280, h: 800, ox: 0, oy: 40 };
  const top = anchorShift('top', view);
  const bottom = anchorShift('bottom', view);
  const hud: [string, Rect][] = [
    ['vitals', { x: 16, y: 14 + top, w: 316, h: 86 + 40 }],
    ['clock + phase lozenges + objective', { x: VIEW_W / 2 - 200, y: 14 + top, w: 400, h: 70 + 60 }],
    ['score + combo', { x: VIEW_W - 16 - 250, y: 14 + top, w: 250, h: 70 + 44 }],
    ['pause button', { x: VIEW_W - 16 - 250 - 8 - 44, y: 14 + top, w: 44, h: 44 }],
    ['tray (8 slots)', { x: TRAY.margin - TRAY.frame, y: TRAY.y - TRAY.frame, w: TRAY.w + TRAY.frame * 2, h: 8 * (TRAY.h + TRAY.gap) }],
    ['callout panel', { x: VIEW_W / 2 - 400, y: 704 - 78 + bottom, w: 800, h: 78 }],
    ['Litany reliquary', { x: VIEW_W - 100, y: 624 + bottom, w: 80, h: 80 }],
    // Left-handed mode mirrors the tray and the reliquary.
    ['tray (mirrored)', { x: VIEW_W - TRAY.margin - TRAY.w - TRAY.frame, y: TRAY.y - TRAY.frame, w: TRAY.w + TRAY.frame * 2, h: 8 * (TRAY.h + TRAY.gap) }],
    ['Litany reliquary (mirrored)', { x: 20, y: 624 + bottom, w: 80, h: 80 }],
  ];

  // Every boss body is kept at least 40 px + its radius inside the field ellipse (clampToField).
  const bodies: [string, number][] = [
    ['Matins (full health)', 50],
    ['Matins (near death)', 34],
    ['Lauds core', 42],
    ['Lauds second body', 42 * 0.85],
  ];

  for (const [name, r] of bodies)
    it(`${name}: no overlap anywhere on its reachable rim`, () => {
      const m = 40 + r;
      const hits: string[] = [];
      for (let i = 0; i < 360; i++) {
        const a = (i / 360) * Math.PI * 2;
        const cx = FIELD.cx + Math.cos(a) * (FIELD.rx - m);
        const cy = FIELD.cy + Math.sin(a) * (FIELD.ry - m);
        for (const [label, rect] of hud) if (overlaps(cx, cy, r, rect)) hits.push(`${label} at ${i}°`);
      }
      expect(hits).toEqual([]);
    });
});
