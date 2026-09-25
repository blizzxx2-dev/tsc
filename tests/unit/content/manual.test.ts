import { describe, expect, it } from 'vitest';
import { MANUAL_PAGES, manualId, manualPageOf, watchManual } from '../../../src/content/manual';
import { hasKey } from '../../../src/i18n';
import type { Gfx } from '../../../src/render/gfx';
import { BloodPool, Grub, Laceration } from '../../../src/surgery/entities';
import { TOOL_INFO } from '../../../src/surgery/types';
import { drawDiagram, frameAt, FRAME_SECONDS } from '../../../src/ui/manualDiagram';
import { at, start, wait } from '../../harness';

/** A Gfx that records every call with its arguments. */
function recorder(): { g: Gfx; calls: string[] } {
  const calls: string[] = [];
  const g = new Proxy(
    {},
    {
      get:
        (_t, k) =>
        (...args: unknown[]) =>
          void calls.push(
            `${String(k)}(${args.map((a) => (typeof a === 'number' ? a.toFixed(1) : typeof a === 'object' ? JSON.stringify(a) : String(a))).join(',')})`,
          ),
    },
  ) as unknown as Gfx;
  return { g, calls };
}

describe("GAM-0209: the Surgeon's Manual", () => {
  it('has a page for every instrument and every demo ailment, each with its text', () => {
    for (const t of TOOL_INFO)
      expect(
        MANUAL_PAGES.find((p) => p.id === t.id && p.kind === 'tool'),
        t.id,
      ).toBeDefined();
    const ailments = MANUAL_PAGES.filter((p) => p.kind === 'ailment').map((p) => p.id);
    expect(ailments).toEqual(expect.arrayContaining(['laceration', 'pool', 'incision', 'embedded', 'burn', 'bubo', 'rot', 'venom', 'grub', 'sigil']));
    for (const p of MANUAL_PAGES) {
      const keys = p.kind === 'tool' ? [`tool.${p.id}.name`, `tool.${p.id}.hint`] : [`manual.${p.id}.title`, `manual.${p.id}.body`];
      for (const k of keys) expect(hasKey(k), k).toBe(true);
    }
  });

  it('every diagram animates through three distinct frames', () => {
    expect([0, 1, 2, 3].map((i) => frameAt(i * FRAME_SECONDS + 0.01))).toEqual([0, 1, 2, 0]);
    for (const p of MANUAL_PAGES) {
      const frames = ([0, 1, 2] as const).map((f) => {
        const r = recorder();
        drawDiagram(r.g, p, f, { x: 0, y: 0, w: 400, h: 260 });
        return r.calls.join(';');
      });
      expect(new Set(frames).size, p.id).toBe(3);
    }
  });

  it('pages unlock on first encounter: the kit at once, each ailment when it first appears', () => {
    const got: string[] = [];
    const op = start(() => [new Laceration(at(0, 0), 0, 80, 0.4)], { tools: ['thread', 'leech'] });
    watchManual(op, (id) => got.push(id));
    expect(got).toEqual([manualId('thread'), manualId('leech'), manualId('laceration')]);
    op.spawn(new BloodPool(at(60, 40), 20));
    op.spawn(new BloodPool(at(-60, 40), 20));
    wait(op, 0.1);
    expect(got.filter((id) => id === manualId('pool'))).toHaveLength(1);
    expect(manualPageOf(new Grub(at(0, 0), op, 0))).toBe('grub');
  });
});
