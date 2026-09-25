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

/** Species shift the flesh: dwarfs ruddy and dense, elves pale, orcs green-grey, halflings rosy. */
const RACE_TINT: Record<NonNullable<OperationDef['race']>, RGB> = {
  human: [1, 1, 1],
  dwarf: [1.08, 0.92, 0.85],
  elf: [1.05, 1.02, 1.08],
  halfling: [1.1, 0.98, 0.95],
  orc: [0.78, 1.05, 0.72],
};

/** Membrane edge softness per organ: crisp alveoli, softer fat lobules. */
const CELL_SOFT: Record<OrganKind, number> = { flesh: 0.1, heart: 0.08, lung: 0.05, gut: 0.09, liver: 0.07, brain: 0.08, bone: 0.12 };

export function organPalette(def: OperationDef): { kind: number; base: RGB; deep: RGB; vein: RGB; cellSoft: number } {
  const o = ORGAN[def.organ];
  const t = RACE_TINT[def.race ?? 'human'];
  const tint = (c: RGB): RGB => [Math.min(1, c[0] * t[0]), Math.min(1, c[1] * t[1]), Math.min(1, c[2] * t[2])];
  return { kind: KIND_INDEX[def.organ], base: tint(vec3(o.base)), deep: tint(vec3(o.deep)), vein: vec3(o.vein), cellSoft: CELL_SOFT[def.organ] };
}
