/**
 * Stable entity kind names for automation. Class names are mangled by the production minifier,
 * so the debug API and state hashes identify entities with `instanceof` against this list.
 * Order matters: subclasses before their bases.
 */
import { BloodPool, Bubo, Burn, Embedded, Grub, Incision, Laceration, Rot, Sigil, Venom } from '../surgery/entities';
import type { Entity } from '../surgery/entity';
import { ChoirVoice, EggSac, LaudsMalison, SpiderlingGrub } from '../surgery/lauds';
import { Malison, MalisonShard } from '../surgery/malison';

type Ctor = abstract new (...args: never[]) => Entity;

export const ENTITY_KINDS: readonly [string, Ctor][] = [
  ['Incision', Incision],
  ['Laceration', Laceration],
  ['BloodPool', BloodPool],
  ['Embedded', Embedded],
  ['Burn', Burn],
  ['Bubo', Bubo],
  ['Rot', Rot],
  ['Venom', Venom],
  ['Grub', Grub],
  ['Sigil', Sigil],
  ['Malison', Malison],
  ['MalisonShard', MalisonShard],
  ['LaudsMalison', LaudsMalison],
  ['ChoirVoice', ChoirVoice],
  ['EggSac', EggSac],
  ['SpiderlingGrub', SpiderlingGrub],
];

export function kindOf(e: Entity): string {
  for (const [name, ctor] of ENTITY_KINDS) if (e instanceof ctor) return name;
  return 'Entity';
}
