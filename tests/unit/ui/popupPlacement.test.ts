import { describe, expect, it } from 'vitest';
import { computeView } from '../../../src/render/viewport';
import { viewRect } from '../../../src/ui/layout';
import { clearOfHud, operationHud, overlaps, popupBox } from '../../../src/ui/popupPlacement';
import { FIELD } from '../../../src/surgery/operation';
import { BOSS_BAR } from '../../../src/surgery/bosses/hud';

/** The Hours' HP bar, with room for its Fraktur name above. */
const bossBar = { x: BOSS_BAR.cx - BOSS_BAR.w / 2, y: BOSS_BAR.y - 24, w: BOSS_BAR.w, h: BOSS_BAR.h + 28 };

describe('GAM-0144: rating popups never overlap the HUD', () => {
  for (const [w, h] of [
    [1280, 720],
    [3840, 2160],
  ] as const) {
    it(`at ${w}×${h}: COOL/GOOD/BAD/MISS stamps and the chain "×N" clear every plate, anywhere on the field`, () => {
      const v = computeView(w, h);
      const view = { w: v.w, h: v.h, ox: v.ox, oy: v.oy };
      const bounds = viewRect(view);
      let checked = 0;
      for (const tools of [3, 6, 8])
        for (const traySide of ['left', 'right'] as const)
          for (const callout of [false, true]) {
            const hud = operationHud({ tools, traySide, litany: true, callout, extra: [bossBar], view });
            // Anchors across (and just beyond) the operating field, at every height a popup rises or stacks to.
            for (let x = FIELD.cx - FIELD.rx - 60; x <= FIELD.cx + FIELD.rx + 60; x += 20)
              for (let y = FIELD.cy - FIELD.ry - 150; y <= FIELD.cy + FIELD.ry + 40; y += 20) {
                const p = clearOfHud(x, y, hud, bounds);
                const box = popupBox(p.x, p.y);
                for (const r of hud)
                  expect(overlaps(box, r), `${tools} tools, ${traySide}, callout ${callout}: popup at ${x},${y} → ${p.x},${p.y}`).toBe(false);
                checked++;
              }
          }
      expect(checked).toBeGreaterThan(1000);
    });
  }

  it('a popup already clear of the HUD is not moved', () => {
    const hud = operationHud({ tools: 8, traySide: 'left', litany: true, callout: false });
    expect(clearOfHud(FIELD.cx, FIELD.cy, hud)).toEqual({ x: FIELD.cx, y: FIELD.cy });
  });
});
