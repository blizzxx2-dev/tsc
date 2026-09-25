/**
 * Curse-corruption looks per Malison Hour (ART-0183) and the corruption's flow target (ART-0182).
 * Every Hour shares the curse-violet veining (bible §curse-violet, reserved for Malison content);
 * each keys its vein tint and its secondary colour — the necrosis and the hatched sigil scars — to
 * that Malison's colour story in the art bible v2. Values are linear-ish RGB for the flesh shader.
 */
import type { Vec } from '../core/math';
import type { Entity } from '../surgery/entity';
import { LaudsMalison } from '../surgery/lauds';
import { Malison, MalisonShard } from '../surgery/malison';
import { ComplineMalison } from '../surgery/bosses/compline';
import { NoneMalison } from '../surgery/bosses/none';
import { PrimeMalison } from '../surgery/bosses/prime';
import { SextMalison } from '../surgery/bosses/sext';
import { TerceMalison } from '../surgery/bosses/terce';
import { VespersMalison } from '../surgery/bosses/vespers';

export type Hour = 'matins' | 'lauds' | 'prime' | 'terce' | 'sext' | 'none' | 'vespers' | 'compline';

export interface CurseLook {
  /** Vein glow. */
  vein: readonly [number, number, number];
  /** Necrosis and scar-hatching colour. */
  accent: readonly [number, number, number];
}

export const HOUR_CURSE: Record<Hour, CurseLook> = {
  /** Matins: the night vigil — violet veins over candle-wax pallor and bruise-black. */
  matins: { vein: [0.62, 0.3, 0.95], accent: [0.14, 0.04, 0.16] },
  /** Lauds: the dawn hymn — violet shot with sunrise gold; necrosis a burnt rose. */
  lauds: { vein: [0.78, 0.5, 1.0], accent: [0.42, 0.2, 0.12] },
  /** Prime: the first hour's ledger — ink-violet veins and iron-gall black scars. */
  prime: { vein: [0.5, 0.28, 0.85], accent: [0.05, 0.04, 0.09] },
  /** Terce: the fire hour — violet veins with ember-orange cores; charred necrosis. */
  terce: { vein: [0.8, 0.36, 0.72], accent: [0.3, 0.07, 0.03] },
  /** Sext: the noon of stone — pale violet veins, grey petrified scarring. */
  sext: { vein: [0.66, 0.52, 0.9], accent: [0.28, 0.27, 0.3] },
  /** None: the burrowing hour — deep violet veins, loam-brown rot. */
  none: { vein: [0.48, 0.22, 0.7], accent: [0.2, 0.13, 0.06] },
  /** Vespers: the lamp-lighting — violet veins through tallow amber; waxy yellow necrosis. */
  vespers: { vein: [0.7, 0.36, 0.86], accent: [0.46, 0.34, 0.1] },
  /** Compline: the last office — violet veins into night blue; the necrosis is starless black. */
  compline: { vein: [0.45, 0.35, 1.0], accent: [0.03, 0.04, 0.12] },
};

/**
 * Each Hour's secondary colour (ART-0226): curse-violet is shared, this is the Hour's own — its rim
 * light, its eye and its effects. Distinct in hue and value so the eight read apart in silhouette.
 */
export const HOUR_SECONDARY: Record<Hour, readonly [number, number, number]> = {
  matins: [0.9, 0.84, 0.66], // candle-wax ivory
  lauds: [1.0, 0.74, 0.42], // dawn gold
  prime: [0.86, 0.28, 0.22], // rubric vermilion
  terce: [1.0, 0.52, 0.1], // furnace orange
  sext: [0.96, 0.96, 0.9], // bleached noon white
  none: [0.6, 0.5, 0.3], // loam ochre
  vespers: [0.92, 0.78, 0.32], // tallow gold
  compline: [0.34, 0.42, 0.95], // night blue
};

/** The Hours in canonical order. */
export const HOURS: readonly Hour[] = ['matins', 'lauds', 'prime', 'terce', 'sext', 'none', 'vespers', 'compline'];

/** The Hour a curse-bearing entity belongs to, or null. */
export function hourOf(e: Entity): Hour | null {
  if (e instanceof Malison || e instanceof MalisonShard) return 'matins';
  if (e instanceof LaudsMalison) return 'lauds';
  if (e instanceof PrimeMalison) return 'prime';
  if (e instanceof TerceMalison) return 'terce';
  if (e instanceof SextMalison) return 'sext';
  if (e instanceof NoneMalison) return 'none';
  if (e instanceof VespersMalison) return 'vespers';
  if (e instanceof ComplineMalison) return 'compline';
  return null;
}

/** Where the corruption flows (the living Malison) and in which Hour's colours; null when no Malison is on the table. */
export function curseSource(entities: readonly Entity[]): { at: Vec; hour: Hour; look: CurseLook } | null {
  let shard: { at: Vec; hour: Hour } | null = null;
  for (const e of entities) {
    if (!e.alive) continue;
    const hour = hourOf(e);
    if (!hour) continue;
    if (e instanceof MalisonShard) shard ??= { at: e.pos, hour };
    else return { at: e.pos, hour, look: HOUR_CURSE[hour] };
  }
  return shard ? { ...shard, look: HOUR_CURSE[shard.hour] } : null;
}
