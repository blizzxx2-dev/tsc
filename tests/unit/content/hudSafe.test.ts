/**
 * CON-0031: no wound is placed under a HUD plate — every spawn anchor of every data operation lies
 * clear of the vitals, clock, score, tray, Litany seal and callout plate, at 16:9, 16:10 and on the
 * Steam Deck's 1280×800, with the tray on either side.
 */
import { describe, expect, it } from 'vitest';
import { allCampaignOperations } from '../../../src/content/campaign';
import { opData } from '../../../src/content/schema';
import { FIELD } from '../../../src/surgery/operation';
import { operationHud } from '../../../src/ui/popupPlacement';

const VIEWS = { '16:9': { w: 1280, h: 720, ox: 0, oy: 0 }, '16:10 / Deck': { w: 1280, h: 800, ox: 0, oy: 40 } };

describe('CON-0031: wounds clear of the HUD', () => {
  it('every data op’s spawn anchors stay off the HUD plates', () => {
    const bad: string[] = [];
    for (const def of allCampaignOperations()) {
      const data = opData(def);
      if (!data) continue;
      const pts: [number, number][] = [];
      for (const p of data.phases)
        for (const s of (p.spawn ?? []) as unknown as Record<string, unknown>[]) {
          if (Array.isArray(s.at)) pts.push(s.at as [number, number]);
          if (Array.isArray(s.path)) pts.push(...(s.path as [number, number][]));
        }
      for (const [name, view] of Object.entries(VIEWS))
        for (const traySide of ['left', 'right'] as const) {
          const hud = operationHud({ tools: def.tools.length, traySide, litany: def.litany !== false, callout: true, view });
          for (const [x, y] of pts) {
            const px = FIELD.cx + x;
            const py = FIELD.cy + y;
            if (hud.some((b) => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h)) bad.push(`${def.id} at(${x}, ${y}) ${name} tray ${traySide}`);
          }
        }
    }
    expect(bad).toEqual([]);
  });
});
