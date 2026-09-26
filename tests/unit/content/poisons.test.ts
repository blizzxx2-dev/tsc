import { describe, expect, it } from 'vitest';
import '../../../src/render/surgery';
import { drawEntity } from '../../../src/render/surgery/registry';
import { POISONS, poisonFor } from '../../../src/content/poisons';
import { makeEntity, validateSpec } from '../../../src/content/schema';
import type { Gfx } from '../../../src/render/gfx';
import { Venom } from '../../../src/surgery/entities';
import { ALL, start } from '../../harness';

describe('poison variants (ENG-0267)', () => {
  it('the look follows the poison from content data; the antidote colour picks the default', () => {
    expect(poisonFor('violet')).toBe(POISONS.spider);
    expect(poisonFor('green')).toBe(POISONS.serpent);
    expect(poisonFor('violet', 'wyrm')).toBe(POISONS.wyrm);
    expect(validateSpec({ e: 'venom', at: [0, 0], poison: 'nightshade' }, ALL, 'v')).toEqual([]);
    expect(validateSpec({ e: 'venom', at: [0, 0], poison: 'hemlock' } as never, ALL, 'v').join()).toMatch(/hemlock|poison/);
    const op = start();
    const v = makeEntity({ e: 'venom', at: [0, 0], poison: 'wyrm' }, op) as Venom;
    const colours: string[] = [];
    const g = new Proxy(
      {},
      {
        get:
          (_t, k) =>
          (...a: unknown[]) => {
            if (k === 'circle' || k === 'polyline') colours.push(JSON.stringify(a[a.length - 1]));
          },
      },
    ) as unknown as Gfx;
    drawEntity(g, v, op);
    const spider = makeEntity({ e: 'venom', at: [0, 0] }, op) as Venom;
    const other: string[] = [];
    const g2 = new Proxy(
      {},
      {
        get:
          (_t, k) =>
          (...a: unknown[]) => {
            if (k === 'circle' || k === 'polyline') other.push(JSON.stringify(a[a.length - 1]));
          },
      },
    ) as unknown as Gfx;
    drawEntity(g2, spider, op);
    expect(colours).not.toEqual(other);
  });
});
