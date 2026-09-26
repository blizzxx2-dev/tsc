/**
 * Surface detail sets for the flesh pass (ART-0367): which scanned maps an operation samples, and the
 * rule that only one set is resident at a time. A set is skin detail + tone mottle + drape linen +
 * table wood; the species and venue pick the skin and tone. The Low tier samples none and keeps the
 * procedural detail.
 */
import { MANIFEST, type AssetId } from '../assets/manifest.gen';
import type { Quality } from './quality';

export interface SurfaceSetIds {
  skin: AssetId;
  tone: AssetId;
  linen: AssetId;
  wood: AssetId;
}

/** Resident budget for one set, RGBA8 with mips: the ~5.3 MB of a 1024² compressed organ set. */
export const SURFACE_SET_BUDGET = 5.3 * 2 ** 20;

/** Orc, hornfolk and giant patients get a thick scarred hide (Skin 09); a forensic corpse, rot marbling (Skin 05). */
export function surfaceSetFor(race: string, venue: string, quality: Quality): SurfaceSetIds | null {
  if (quality === 'low') return null;
  const hide = race === 'orc' || race === 'hornfolk' || race === 'giant';
  return {
    skin: hide ? 'textures/hide-detail' : 'textures/skin-detail',
    tone: venue === 'forensic' ? 'textures/rot-mottle' : hide ? 'textures/hide-mottle' : 'textures/skin-mottle',
    linen: 'textures/linen-detail',
    wood: 'textures/wood-table',
  };
}

/** GPU bytes a set holds once uploaded (RGBA8 plus a full mip chain). */
export function surfaceSetBytes(set: SurfaceSetIds): number {
  let n = 0;
  for (const id of Object.values(set) as AssetId[]) {
    const e = MANIFEST[id];
    n += (e.w ?? 0) * (e.h ?? 0) * 4 * (4 / 3);
  }
  return Math.round(n);
}

/** Tracks the resident set and releases maps the next set doesn't share. */
export class SurfaceSetCache {
  private resident: string[] = [];

  /** Make `urls` the resident set; returns the urls that were released. */
  swap(urls: readonly string[], release: (url: string) => void): string[] {
    const freed = this.resident.filter((u) => !urls.includes(u));
    for (const u of freed) release(u);
    this.resident = [...urls];
    return freed;
  }

  get urls(): readonly string[] {
    return this.resident;
  }
}
