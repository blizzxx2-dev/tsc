/**
 * The peoples who come to the table. Each has its own skin, flesh and depth, rendered by the flesh
 * shader (skin margin, layered wound edges, scattering, blood) and felt in play (how hard the
 * lancet works, how fast they bleed and clot, how they take tinctures and pain).
 *
 *  human     the baseline.
 *  dwarf     short, dense and ruddy; a thick, coarse dermis over hard-packed muscle and dark, rich
 *            blood. The lancet must work slowly; they bleed little and endure a great deal.
 *  elf       pale and fine-grained, skin so thin it glows with the light behind it; blue-silver
 *            veins and bright scarlet blood. Easy to cut and quick to bleed, unforgiving of a
 *            stray edge, and quick to answer a tincture.
 *  orc       rare at the table: a grey-olive hide as thick as boot leather, seamed with old scars,
 *            dark near-black blood that clots fast. The blade must be slow and firm; tinctures
 *            take poorly, but they shrug off what would kill a man.
 *  hornfolk  dun and weathered; tough skin, otherwise close to human.
 *  giant     sallow, coarse and vast; slow to bleed out, slow to heal.
 *
 * These are original, generic fantasy peoples: no Games Workshop designs or iconography (see the
 * art bible's IP checklist).
 */
import type { Tuning } from './tuning';

export type Species = 'human' | 'dwarf' | 'elf' | 'orc' | 'hornfolk' | 'giant';
export const SPECIES: readonly Species[] = ['human', 'dwarf', 'elf', 'orc', 'hornfolk', 'giant'];

type RGB = [number, number, number];

export interface SpeciesLook {
  /** Multiplies the organ's base and deep flesh colours. */
  fleshTint: RGB;
  /** Epidermis colour around the opening and at wound lips (display RGB 0..1). */
  skin: RGB;
  /** Relative dermis thickness: the pale band at wound edges and the skin margin's width. */
  dermis: number;
  /** Subcutaneous fat band thickness (yellow lobules under the dermis). */
  fat: number;
  /** Subsurface colour and strength: how light glows through the tissue. */
  sss: RGB;
  sssAmount: number;
  /** Surface coarseness (pores, hair follicles, scars) 0..1. */
  coarse: number;
  /** Old scarring on the hide 0..1. */
  scars: number;
  /** Vein colour and visibility. */
  vein: RGB;
  veinAmount: number;
  /** Fresh blood (pools, wound interiors) and the dark venous tone. */
  blood: RGB;
  bloodDeep: RGB;
  /** Roughness offset: negative = glossier. */
  sheen: number;
}

export interface SpeciesBody {
  /** Hide toughness: the fastest acceptable lancet stroke is divided by this. */
  hide: number;
  /** Bleeding (laceration and pooling drain) multiplier. */
  bleed: number;
  /** Harm from stray cuts and slips. */
  fragility: number;
  /** Tincture healing multiplier. */
  tincture: number;
  /** Passive recovery multiplier. */
  endurance: number;
}

export interface SpeciesProfile {
  look: SpeciesLook;
  body: SpeciesBody;
}

const HUMAN_LOOK: SpeciesLook = {
  fleshTint: [1, 1, 1],
  skin: [0.78, 0.6, 0.5],
  dermis: 1,
  fat: 1,
  sss: [1.25, 0.35, 0.28],
  sssAmount: 1,
  coarse: 0.35,
  scars: 0,
  vein: [0.29, 0.06, 0.19],
  veinAmount: 0.45,
  blood: [0.42, 0.03, 0.05],
  bloodDeep: [0.16, 0.0, 0.02],
  sheen: 0,
};

export const SPECIES_PROFILES: Record<Species, SpeciesProfile> = {
  human: { look: HUMAN_LOOK, body: { hide: 1, bleed: 1, fragility: 1, tincture: 1, endurance: 1 } },
  dwarf: {
    look: {
      ...HUMAN_LOOK,
      fleshTint: [1.06, 0.88, 0.8],
      skin: [0.74, 0.47, 0.37],
      dermis: 1.8,
      fat: 0.8,
      sss: [1.2, 0.3, 0.2],
      sssAmount: 0.6,
      coarse: 0.8,
      scars: 0.25,
      vein: [0.32, 0.05, 0.12],
      veinAmount: 0.5,
      blood: [0.34, 0.02, 0.03],
      bloodDeep: [0.12, 0.0, 0.01],
      sheen: 0.06,
    },
    body: { hide: 1.45, bleed: 0.8, fragility: 0.8, tincture: 0.95, endurance: 1.3 },
  },
  elf: {
    look: {
      ...HUMAN_LOOK,
      fleshTint: [1.02, 1.0, 1.04],
      skin: [0.9, 0.83, 0.8],
      dermis: 0.5,
      fat: 0.45,
      sss: [1.1, 0.55, 0.62],
      sssAmount: 1.8,
      coarse: 0.08,
      scars: 0,
      vein: [0.22, 0.32, 0.52],
      veinAmount: 0.75,
      blood: [0.62, 0.04, 0.07],
      bloodDeep: [0.3, 0.01, 0.05],
      sheen: -0.1,
    },
    body: { hide: 0.75, bleed: 1.35, fragility: 1.6, tincture: 1.35, endurance: 0.85 },
  },
  orc: {
    look: {
      ...HUMAN_LOOK,
      fleshTint: [0.86, 0.84, 0.76],
      skin: [0.4, 0.44, 0.33],
      dermis: 2.6,
      fat: 0.6,
      sss: [0.8, 0.35, 0.2],
      sssAmount: 0.35,
      coarse: 1,
      scars: 0.8,
      vein: [0.2, 0.12, 0.08],
      veinAmount: 0.55,
      blood: [0.22, 0.03, 0.02],
      bloodDeep: [0.07, 0.01, 0.0],
      sheen: 0.12,
    },
    body: { hide: 1.9, bleed: 0.6, fragility: 0.6, tincture: 0.75, endurance: 1.7 },
  },
  hornfolk: {
    look: { ...HUMAN_LOOK, fleshTint: [0.96, 0.9, 0.8], skin: [0.62, 0.5, 0.38], dermis: 1.5, coarse: 0.7, scars: 0.3 },
    body: { hide: 1.25, bleed: 0.9, fragility: 0.9, tincture: 1, endurance: 1.15 },
  },
  giant: {
    look: { ...HUMAN_LOOK, fleshTint: [1.02, 0.97, 0.88], skin: [0.7, 0.6, 0.46], dermis: 2.1, fat: 1.6, coarse: 0.75, sssAmount: 0.7 },
    body: { hide: 1.6, bleed: 0.7, fragility: 0.75, tincture: 0.85, endurance: 0.9 },
  },
};

export const speciesOf = (race: Species | undefined): SpeciesProfile => SPECIES_PROFILES[race ?? 'human'];

/** Scale a merged tuning by the patient's body (applied after operation and upgrade overrides). */
export function applySpecies(t: Tuning, race: Species | undefined): Tuning {
  const b = speciesOf(race).body;
  if (race === undefined || race === 'human') return t;
  t.incision.rushedSpeed /= b.hide;
  t.incision.slipHurt *= b.fragility;
  t.miss.strayCutHurt *= b.fragility;
  t.laceration.baseDrain *= b.bleed;
  t.laceration.drainPerPx *= b.bleed;
  t.blood.baseDrain *= b.bleed;
  t.blood.drainPerPx *= b.bleed;
  t.tincture.heal *= b.tincture;
  t.vitals.passiveRecovery *= b.endurance;
  return t;
}
