import type { OperationDef, OrganKind } from '../surgery/operation';
import { vec3 } from './color';

type RGB = [number, number, number];

const KIND_INDEX: Record<OrganKind, number> = { flesh: 0, heart: 1, lung: 2, gut: 3, liver: 4, brain: 5, bone: 6 };

const ORGAN: Record<OrganKind, { base: string; deep: string; vein: string }> = {
  flesh: { base: '#c46a5c', deep: '#7a2a28', vein: '#4a1030' },
  heart: { base: '#b83a3a', deep: '#5a0e14', vein: '#3a0a30' },
  lung: { base: '#d08a90', deep: '#8a4a58', vein: '#5a2040' },
  gut: { base: '#d09878', deep: '#8a4a3a', vein: '#6a2a3a' },
  liver: { base: '#8a2a2a', deep: '#40080c', vein: '#200410' },
  brain: { base: '#d8a8a0', deep: '#9a6a70', vein: '#8a2030' },
  bone: { base: '#c89880', deep: '#6a3a30', vein: '#5a1a20' },
};

/** Folk shift the flesh: mountain-folk ruddy and dense, horn-folk dun and weathered, giants sallow and coarse. */
const RACE_TINT: Record<NonNullable<OperationDef['race']>, RGB> = {
  human: [1, 1, 1],
  mountainfolk: [1.08, 0.92, 0.85],
  hornfolk: [0.96, 0.9, 0.8],
  giant: [1.02, 0.97, 0.88],
};

/** Membrane edge softness per organ: crisp alveoli, softer fat lobules. */
const CELL_SOFT: Record<OrganKind, number> = { flesh: 0.1, heart: 0.08, lung: 0.05, gut: 0.09, liver: 0.07, brain: 0.08, bone: 0.12 };
/** Base roughness per organ: glossy serosa and heart, matte skin and bone. */
const ROUGH: Record<OrganKind, number> = { flesh: 0.55, heart: 0.38, lung: 0.45, gut: 0.35, liver: 0.4, brain: 0.5, bone: 0.6 };

export function organPalette(def: OperationDef): { kind: number; base: RGB; deep: RGB; vein: RGB; cellSoft: number; rough: number } {
  const o = ORGAN[def.organ];
  const t = RACE_TINT[def.race ?? 'human'];
  const tint = (c: RGB): RGB => [Math.min(1, c[0] * t[0]), Math.min(1, c[1] * t[1]), Math.min(1, c[2] * t[2])];
  return { kind: KIND_INDEX[def.organ], base: tint(vec3(o.base)), deep: tint(vec3(o.deep)), vein: vec3(o.vein), cellSoft: CELL_SOFT[def.organ], rough: ROUGH[def.organ] };
}
