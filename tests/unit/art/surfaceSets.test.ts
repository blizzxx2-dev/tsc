/** ART-0367: one surface set resident, within the flesh texture budget; Low keeps procedural detail. */
import { describe, expect, it } from 'vitest';
import { MANIFEST, type AssetId } from '../../../src/assets/manifest.gen';
import { SURFACE_SET_BUDGET, SurfaceSetCache, surfaceSetBytes, surfaceSetFor } from '../../../src/render/surfaceSets';

const RACES = ['human', 'dwarf', 'elf', 'orc', 'hornfolk', 'giant'];
const VENUES = ['hospice', 'field', 'forensic'];

describe('surface sets', () => {
  it('every set fits the resident budget and uses square power-of-two maps ≤ 1024²', () => {
    for (const r of RACES)
      for (const v of VENUES)
        for (const q of ['medium', 'high'] as const) {
          const set = surfaceSetFor(r, v, q)!;
          expect(surfaceSetBytes(set)).toBeLessThanOrEqual(SURFACE_SET_BUDGET);
          for (const id of Object.values(set) as AssetId[]) {
            const e = MANIFEST[id];
            expect(e.w, id).toBe(e.h);
            expect(e.w! & (e.w! - 1), id).toBe(0);
            expect(e.w!, id).toBeLessThanOrEqual(1024);
          }
        }
  });

  it('picks hide for orc, hornfolk and giant, rot for the forensic corpse, none on Low', () => {
    expect(surfaceSetFor('orc', 'hospice', 'high')!.skin).toBe('textures/hide-detail');
    expect(surfaceSetFor('giant', 'field', 'medium')!.tone).toBe('textures/hide-mottle');
    expect(surfaceSetFor('human', 'hospice', 'high')!.skin).toBe('textures/skin-detail');
    expect(surfaceSetFor('elf', 'forensic', 'high')!.tone).toBe('textures/rot-mottle');
    expect(surfaceSetFor('human', 'hospice', 'low')).toBeNull();
  });

  it('swapping sets releases only the maps the new set does not share', () => {
    const c = new SurfaceSetCache();
    const released: string[] = [];
    c.swap(['skin', 'tone', 'linen', 'wood'], (u) => released.push(u));
    expect(released).toEqual([]);
    c.swap(['hide', 'hideTone', 'linen', 'wood'], (u) => released.push(u));
    expect(released).toEqual(['skin', 'tone']);
    c.swap([], (u) => released.push(u));
    expect(released).toEqual(['skin', 'tone', 'hide', 'hideTone', 'linen', 'wood']);
    expect(c.urls).toEqual([]);
  });
});
