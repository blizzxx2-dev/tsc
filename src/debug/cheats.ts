/**
 * Operation cheats for dev and QA builds (GAM-0019), DOM-free so tests can drive them: freeze the
 * drain, and spawn any content entity at the cursor. (Skip phase and set vitals live on DebugApi.)
 * Loaded only through ./hooks.ts, so release bundles never contain them.
 */
import type { Vec } from '../core/math';
import { ENTITY_REGISTRY, makeEntities, type EntityId, type EntitySpec } from '../content/schema';
import type { Entity } from '../surgery/entity';
import { FIELD, type Operation } from '../surgery/operation';

/** Seconds of grace that stand for "frozen until switched off". */
const FOREVER = 1e9;

/** Freeze (or release) all vitals drain on the running operation. Returns the new state. */
export function freezeDrain(op: Operation, on: boolean): boolean {
  if (on) op.graceTime(FOREVER);
  else op.endGrace();
  return on;
}

/** Sensible parameters for each entity id, so `spawn <id>` needs nothing but the id. */
const SPAWN_DEFAULTS: { [K in EntityId]: Omit<Extract<EntitySpec, { e: K }>, 'e' | 'at' | 'path'> & Record<string, unknown> } = {
  laceration: { angle: 0.4, len: 90, bleed: 0.6 },
  incision: {},
  embedded: { kind: 'shard', angle: 0.6, barbed: false },
  burn: { r: 36 },
  bubo: { r: 20 },
  rot: { r: 34, spread: 0.3 },
  venom: { rate: 6 },
  grub: { speed: 40 },
  sigil: { shape: 'eye', size: 70 },
  pool: { r: 28 },
  silk: { strands: 5, r: 100 },
  eggsac: { brood: 3, hatchIn: 16 },
  'malison-matins': {},
  'malison-lauds': {},
  'malison-prime': {},
  'malison-terce': {},
  'malison-sext': {},
  'malison-none': {},
  'malison-vespers': {},
  'malison-compline': {},
  'elite-broodcluster': {},
  'elite-cantor': {},
  'elite-fangnest': { angles: [0.9, 1.2, 0.6] },
  'elite-matriarch': { segments: 5 },
  'elite-sellsword': {},
  'elite-deadpulse': { sigil: [0, 0], period: 20 }, // sigil is placed by the cursor below
  'elite-frostwight': { count: 5 },
  'elite-ghoulclaw': { armpit: [220, -150] },
  'elite-magus': {},
  herald: {},
  fracture: { fragments: 3, splinters: 1, wrap: 3 },
  reduction: { pull: [-160, 0], fragments: 2, wrap: 3 },
};

/** Every id `spawn` accepts. */
export const SPAWN_IDS = Object.keys(ENTITY_REGISTRY) as EntityId[];

/** Spawn a content entity (and anything it binds) at `pos` — the cursor — on the running operation. */
export function spawnAt(op: Operation, id: string, pos: Vec = op.cursor): Entity[] {
  if (!(id in ENTITY_REGISTRY)) throw new Error(`unknown entity "${id}" (one of: ${SPAWN_IDS.join(', ')})`);
  const at: [number, number] = [pos.x - FIELD.cx, pos.y - FIELD.cy];
  const extra = SPAWN_DEFAULTS[id as EntityId] as Record<string, unknown>;
  const spec = {
    e: id,
    ...extra,
    ...(id === 'incision'
      ? { path: [at, [at[0] + 120, at[1] + 10]] }
      : id === 'elite-fangnest' || id === 'elite-sellsword'
        ? { path: [at, [at[0] + 50, at[1] + 30], [at[0] + 70, at[1] - 20]] }
        : id === 'elite-deadpulse'
          ? { path: [at, [at[0] + 140, at[1] + 10]], sigil: [at[0] + 40, at[1] - 50] }
          : { at }),
  } as EntitySpec;
  const made = makeEntities(spec, op);
  for (const e of made) op.spawn(e);
  return made;
}
