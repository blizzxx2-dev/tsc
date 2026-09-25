import { hex, vec3 } from '../render/color';
import type { Gfx } from '../render/gfx';
import type { Backdrop } from '../content/story';
import type { Character } from '../content/characters';
import { VIEW_H, VIEW_W } from '../ui/layout';
import type { Vec } from '../core/math';

/** SCENE_FS program per location (see src/render/shaders/scene.ts). */
export const SCENE_KIND: Record<Backdrop | 'title', number> = {
  hospice: 0,
  street: 1,
  theatre: 2,
  chapel: 3,
  night: 4,
  camp: 5,
  apothecary: 6,
  alley: 7,
  guildhall: 8,
  tent: 9,
  graveyard: 10,
  orecamp: 11,
  forest: 12,
  abbey: 13,
  dawn: 14,
  title: 15,
};

export type Lighting = 'day' | 'dusk' | 'night';
const LIGHT: Record<Lighting, number> = { night: 0, dusk: 1, day: 2 };

/** Default lighting per location, as the Chapter 1–2 scripts stage them. */
export const DEFAULT_LIGHT: Record<Backdrop | 'title', Lighting> = {
  hospice: 'night',
  street: 'dusk',
  theatre: 'night',
  chapel: 'night',
  night: 'night',
  camp: 'dusk',
  apothecary: 'day',
  alley: 'dusk',
  guildhall: 'night',
  tent: 'dusk',
  graveyard: 'night',
  orecamp: 'dusk',
  forest: 'night',
  abbey: 'night',
  dawn: 'day',
  title: 'night',
};

/** Locations lit by open flame get drifting embers in front of the set. */
const EMBERS = new Set<string>(['camp', 'tent', 'orecamp', 'hospice', 'theatre', 'guildhall']);

// Dev preview overrides: ?light=day|dusk|night, ?variant=1 (burned ward / rain), ?sceneScale=0.5.
const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
const PREVIEW_LIGHT = params?.get('light') as Lighting | null | undefined;
const PREVIEW_VARIANT = Number(params?.get('variant') ?? 0);
const PREVIEW_SCALE = Number(params?.get('sceneScale') ?? 0);

/** Art quality tiers: backdrop render scale and ember density (Low for integrated GPUs). */
export type ArtQuality = 'low' | 'medium' | 'high';
export const QUALITY: Record<ArtQuality, { sceneScale: number; embers: number }> = {
  low: { sceneScale: 0.5, embers: 12 },
  medium: { sceneScale: 0.75, embers: 20 },
  high: { sceneScale: 1, embers: 30 },
};
let quality: ArtQuality = 'high';
export function setArtQuality(q: ArtQuality): void {
  quality = q;
}

export interface BackdropOpts {
  lighting?: Lighting;
  /** Pointer position in virtual pixels, for a 2% parallax shift. */
  pointer?: Vec;
  /** 1 = the ward burned (late story) or rain at night. */
  variant?: number;
}

/**
 * Story scenery: a shader-rendered location (raymarched interiors, layered 2.5D exteriors),
 * with its lighting variant, pointer parallax and a front layer of embers where fire burns.
 * Drawn in the world layer.
 */
export function drawBackdrop(g: Gfx, kind: Backdrop | 'title' | 'results', t: number, opts: BackdropOpts = {}): void {
  const key: Backdrop | 'title' = kind === 'results' ? 'chapel' : kind;
  const lighting = PREVIEW_LIGHT && PREVIEW_LIGHT in LIGHT ? PREVIEW_LIGHT : (opts.lighting ?? DEFAULT_LIGHT[key]);
  const p = opts.pointer;
  const parallax: [number, number] = p ? [Math.max(-1, Math.min(1, (p.x / VIEW_W) * 2 - 1)), Math.max(-1, Math.min(1, 1 - (p.y / VIEW_H) * 2))] : [0, 0];
  const tier = QUALITY[quality];
  g.sceneField(SCENE_KIND[key] ?? 0, { light: LIGHT[lighting], parallax, variant: PREVIEW_VARIANT || opts.variant || 0, scale: PREVIEW_SCALE || tier.sceneScale });
  if (!EMBERS.has(key)) return;
  g.setBlend('add');
  for (let i = 0; i < tier.embers; i++) {
    const ex = (i * 97 + Math.sin(t * 0.5 + i) * 40 - parallax[0] * 26) % VIEW_W;
    const ey = VIEW_H - ((t * (14 + (i % 5) * 7) + i * 53) % VIEW_H);
    g.circleGrad(ex, ey, 3, hex(i % 3 ? '#ffa050' : '#fff0d0', 0.35), hex('#ffa050', 0));
  }
  g.setBlend('alpha');
}

const STYLE: Record<Character['silhouette'], number> = { hood: 0, coif: 1, cap: 2, hat: 3, helm: 4, bare: 5, none: 5 };

/** A character portrait: a raymarched, candle-lit bust (PORTRAIT_FS). */
export function drawPortrait(g: Gfx, c: Character, x: number, y: number, t: number, active: boolean, talking = false): void {
  if (c.silhouette === 'none') return;
  const w = 420;
  const h = 540;
  g.glow(x, y - 200, 260, hex(c.color, 0.16 * (active ? 1 : 0.5)));
  g.portrait(x - w / 2, y - h + 70, w, h, {
    style: STYLE[c.silhouette],
    rim: vec3(c.color),
    cloth: vec3(c.cloth ?? '#3a3028'),
    skin: vec3(c.skin ?? '#c89a80'),
    active: active ? 1 : 0,
    seed: c.name.length * 1.7,
    talk: talking ? 0.5 + 0.5 * Math.sin(t * 16) : 0,
    beard: c.beard ?? 0,
    hair: vec3(c.hair ?? '#2a1c14'),
  });
}
