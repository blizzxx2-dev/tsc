/**
 * Serialisable operation data (CON-0001…CON-0004).
 *
 * An operation's phases are written as plain data — entity ids plus parameters — instead of
 * `spawn` closures. `defineOp` compiles the data into an `OperationDef` through the entity
 * registry, so the same seeded run is reproduced exactly (tests/golden-ops.test.ts), and
 * `validateOp` checks every phase before it ever reaches a player: unknown entity ids, bad
 * parameters, positions off the operating field, and entities the op's instruments cannot resolve.
 *
 * Positions are `[dx, dy]` offsets from the centre of the operating field (the `at()` convention).
 */
import { ChoirMagus, DeadPulse, FrostWight, GhoulClaw, Sellsword, WormMatriarch } from '../surgery/bosses/alphaElites';
import type { Vec } from '../core/math';
import { BloodPool, Bubo, Burn, Embedded, Grub, Incision, Laceration, Rot, SALVE_MAX, Sigil, SIGILS, Venom, type EmbeddedKind } from '../surgery/entities';
import type { Entity } from '../surgery/entity';
import { EggSac, LaudsMalison } from '../surgery/lauds';
import { Malison } from '../surgery/malison';
import { CantorKnot, EggCluster, FangNest, MatinsHerald } from '../surgery/bosses/elites';
import { FIELD, onBody, type Operation, type OperationDef, type PhaseDef } from '../surgery/operation';
import type { ToolId } from '../surgery/types';

export type Pt = readonly [number, number];

/** Parameters common to every entity spec. */
interface Common {
  /** Starts hidden beneath the flesh: needs the Scrying Lens. */
  hidden?: boolean;
  /** Override whether the entity holds up the phase. */
  required?: boolean;
}

export type EntitySpec =
  | ({ e: 'laceration'; at: Pt; angle: number; len: number; bleed?: number } & Common)
  | ({ e: 'incision'; path: readonly Pt[] } & Common)
  | ({ e: 'embedded'; at: Pt; kind: EmbeddedKind; angle?: number; barbed?: boolean } & Common)
  | ({ e: 'burn'; at: Pt; r: number; source?: 'fire' | 'acid' | 'hexfire' } & Common)
  | ({ e: 'bubo'; at: Pt; r?: number; maxR?: number } & Common)
  | ({ e: 'rot'; at: Pt; r: number; spread?: number } & Common)
  | ({ e: 'venom'; at: Pt; rate?: number } & Common)
  | ({ e: 'grub'; at: Pt; speed?: number } & Common)
  | ({ e: 'sigil'; at: Pt; shape: keyof typeof SIGILS; size?: number; lashEvery?: number } & Common)
  | ({ e: 'pool'; at: Pt; r: number; ichor?: 'blood' | 'pus' | 'blackbile' } & Common)
  | ({ e: 'eggsac'; at: Pt; brood?: number; hatchIn?: number } & Common)
  | ({ e: 'malison-matins'; at: Pt; hp?: number } & Common)
  | ({ e: 'malison-lauds'; at: Pt } & Common)
  | ({ e: 'elite-broodcluster'; at: Pt; hatchIn?: number } & Common)
  | ({ e: 'elite-cantor'; at: Pt; every?: number } & Common)
  | ({ e: 'elite-fangnest'; path: readonly Pt[]; angles: readonly number[] } & Common)
  | ({ e: 'elite-matriarch'; at: Pt; segments?: number } & Common)
  | ({ e: 'elite-sellsword'; path: readonly Pt[] } & Common)
  | ({ e: 'elite-deadpulse'; path: readonly Pt[]; sigil: Pt; period?: number } & Common)
  | ({ e: 'elite-frostwight'; at: Pt; count?: number } & Common)
  | ({ e: 'elite-ghoulclaw'; at: Pt; armpit: Pt } & Common)
  | ({ e: 'elite-magus'; at: Pt } & Common)
  | ({ e: 'herald'; at: Pt } & Common);

export type EntityId = EntitySpec['e'];

/** Seeded variety: `n` specs (a count or an inclusive [min, max] range) chosen from `of` with the op's rng. */
export interface PickSpec {
  e: 'pick';
  n: number | readonly [number, number];
  of: readonly EntitySpec[];
}

export type SpawnSpec = EntitySpec | PickSpec;

export interface PhaseData {
  /** Lines the assistant says when the phase begins. */
  callout?: string[];
  /** Short objective for the phase banner (UIX-0061). */
  objective?: string;
  /** Entities placed when the phase begins. */
  spawn?: readonly SpawnSpec[];
  /** Close the incision opened earlier with the thread (the shared final phase). */
  close?: boolean;
  /** Tutorial safety net: vitals never fall below this until the surgeon's first COOL/GOOD in the phase. */
  floor?: number;
}

/** An operation written as data. */
export type OperationData = Omit<OperationDef, 'phases'> & { phases: readonly PhaseData[] };

/** A compiled phase keeps its data for validation and tooling. */
export interface DataPhaseDef extends PhaseDef {
  data: PhaseData;
}

// ------------------------------------------------------------------ registry

type ParamType = 'number' | 'numbers' | 'boolean' | 'pt' | 'path' | 'string';

interface Param {
  type: ParamType;
  optional?: boolean;
  /** Allowed values (strings) or inclusive numeric range. */
  oneOf?: readonly string[];
  range?: readonly [number, number];
}

export interface RegistryEntry<S extends EntitySpec = EntitySpec> {
  params: Record<string, Param>;
  /** Instruments needed to resolve it: every inner list must share at least one tool with the op. */
  needs(spec: S): ToolId[][];
  /** The entity, or a group led by its core (an elite and the wounds it binds). */
  make(spec: S, op: Operation): Entity | Entity[];
}

const P = (x: Pt): Vec => ({ x: FIELD.cx + x[0], y: FIELD.cy + x[1] });
const num = (optional = false, range?: readonly [number, number]): Param => ({ type: 'number', optional, range });
const COMMON: Record<string, Param> = { hidden: { type: 'boolean', optional: true }, required: { type: 'boolean', optional: true } };
const EMBED_KINDS: readonly EmbeddedKind[] = ['arrow', 'bolt', 'shot', 'tooth', 'shard', 'glass', 'hexstone'];

type Entry<K extends EntityId> = RegistryEntry<Extract<EntitySpec, { e: K }>>;

/** Entity id → constructor with typed parameters (CON-0002). */
export const ENTITY_REGISTRY: { [K in EntityId]: Entry<K> } = {
  laceration: {
    params: { at: { type: 'pt' }, angle: num(), len: num(false, [8, 400]), bleed: num(true, [0, 3]) },
    needs: (s) => [s.len <= SALVE_MAX ? ['thread', 'salve'] : ['thread']],
    make: (s) => new Laceration(P(s.at), s.angle, s.len, s.bleed),
  },
  incision: {
    params: { path: { type: 'path' } },
    needs: () => [['lancet'], ['thread']],
    make: (s) => new Incision(s.path.map(P)),
  },
  embedded: {
    params: { at: { type: 'pt' }, kind: { type: 'string', oneOf: EMBED_KINDS }, angle: num(true), barbed: { type: 'boolean', optional: true } },
    needs: (s) => ((s.barbed ?? s.kind === 'arrow') ? [['tongs'], ['lancet']] : [['tongs']]),
    make: (s) => new Embedded(P(s.at), s.kind, s.angle ?? 0, s.barbed ?? s.kind === 'arrow'),
  },
  burn: {
    params: { at: { type: 'pt' }, r: num(false, [8, 120]), source: { type: 'string', optional: true, oneOf: ['fire', 'acid', 'hexfire'] } },
    needs: () => [['tongs'], ['salve']],
    make: (s, op) => new Burn(P(s.at), s.r, op, s.source),
  },
  bubo: {
    params: { at: { type: 'pt' }, r: num(true, [6, 60]), maxR: num(true, [10, 80]) },
    needs: () => [['lancet'], ['leech'], ['salve']],
    make: (s) => new Bubo(P(s.at), s.r, s.maxR),
  },
  rot: {
    params: { at: { type: 'pt' }, r: num(false, [8, 120]), spread: num(true, [0, 3]) },
    needs: () => [['salve']],
    make: (s) => new Rot(P(s.at), s.r, s.spread),
  },
  venom: {
    params: { at: { type: 'pt' }, rate: num(true, [0, 30]) },
    needs: () => [['tincture']],
    make: (s, op) => new Venom(P(s.at), op, s.rate),
  },
  grub: {
    params: { at: { type: 'pt' }, speed: num(true, [0, 200]) },
    needs: () => [['brand', 'tongs']],
    make: (s, op) => new Grub(P(s.at), op, s.speed),
  },
  sigil: {
    params: { at: { type: 'pt' }, shape: { type: 'string', oneOf: Object.keys(SIGILS) }, size: num(true, [16, 140]), lashEvery: num(true, [0.5, 9999]) },
    needs: () => [['brand']],
    make: (s) => new Sigil(P(s.at), SIGILS[s.shape], s.size, s.lashEvery),
  },
  pool: {
    params: { at: { type: 'pt' }, r: num(false, [4, 90]), ichor: { type: 'string', optional: true, oneOf: ['blood', 'pus', 'blackbile'] } },
    needs: () => [['leech']],
    make: (s) => new BloodPool(P(s.at), s.r, s.ichor),
  },
  eggsac: {
    params: { at: { type: 'pt' }, brood: num(true, [1, 8]), hatchIn: num(true, [2, 9999]) },
    needs: () => [['lancet'], ['brand']],
    make: (s) => new EggSac(P(s.at), s.brood, s.hatchIn),
  },
  'malison-matins': {
    params: { at: { type: 'pt' }, hp: num(true, [1, 1000]) },
    needs: () => [['brand'], ['tongs'], ['thread']],
    make: (s, op) => new Malison(P(s.at), op, 'matins', s.hp),
  },
  'malison-lauds': {
    params: { at: { type: 'pt' } },
    needs: () => [['brand'], ['lens'], ['tongs']],
    make: (s, op) => new LaudsMalison(P(s.at), op),
  },
  // Demo elites (BOS-0147..0150): each spawns its core with the wounds it binds.
  'elite-broodcluster': {
    params: { at: { type: 'pt' }, hatchIn: num(true, [4, 9999]) },
    needs: () => [['lancet'], ['brand']],
    make: (s, op) => new EggCluster(P(s.at), op, s.hatchIn).all,
  },
  'elite-cantor': {
    params: { at: { type: 'pt' }, every: num(true, [2, 30]) },
    needs: () => [['brand']],
    make: (s, op) => new CantorKnot(P(s.at), op, s.every).all,
  },
  'elite-fangnest': {
    params: { path: { type: 'path' }, angles: { type: 'numbers' } },
    needs: () => [['tongs']],
    make: (s, op) => new FangNest(op, s.path.map((p, i) => [P(p), s.angles[i] ?? 0] as [Vec, number])).all,
  },
  // Alpha elites (BOS-0153, BOS-0157..0161).
  'elite-matriarch': {
    params: { at: { type: 'pt' }, segments: num(true, [2, 8]) },
    needs: () => [['tongs']],
    make: (s, op) => new WormMatriarch(P(s.at), op, s.segments).all,
  },
  'elite-sellsword': {
    params: { path: { type: 'path' } },
    needs: () => [['tongs'], ['lancet']],
    make: (s, op) => new Sellsword(op, s.path.map(P)).all,
  },
  'elite-deadpulse': {
    params: { path: { type: 'path' }, sigil: { type: 'pt' }, period: num(true, [10, 120]) },
    needs: () => [['lancet'], ['lens']],
    make: (s, op) => new DeadPulse(op, s.path.map(P), P(s.sigil), s.period).all,
  },
  'elite-frostwight': {
    params: { at: { type: 'pt' }, count: num(true, [3, 6]) },
    needs: () => [['brand']],
    make: (s, op) => new FrostWight(P(s.at), op, s.count).all,
  },
  'elite-ghoulclaw': {
    params: { at: { type: 'pt' }, armpit: { type: 'pt' } },
    needs: () => [['brand'], ['lancet']],
    make: (s, op) => new GhoulClaw(P(s.at), op, P(s.armpit)).all,
  },
  'elite-magus': {
    params: { at: { type: 'pt' } },
    needs: () => [['tongs'], ['lens']],
    make: (s, op) => new ChoirMagus(P(s.at), op).all,
  },
  herald: {
    params: { at: { type: 'pt' } },
    needs: () => [['brand']],
    make: (s, op) => new MatinsHerald(P(s.at), op),
  },
};

/** Build the entities for one spec: usually one, or an elite's core followed by what it binds. */
export function makeEntities(spec: EntitySpec, op: Operation): Entity[] {
  const entry = ENTITY_REGISTRY[spec.e] as RegistryEntry | undefined;
  if (!entry) throw new Error(`Unknown entity id "${(spec as { e: string }).e}"`);
  const made = entry.make(spec, op);
  const list = Array.isArray(made) ? made : [made];
  const core = list[0];
  if (spec.hidden) core.hidden = true;
  if (spec.required !== undefined) core.required = spec.required;
  return list;
}

/** Build one entity from its spec (an elite's core; its bound wounds are dropped — use `makeEntities`). */
export function makeEntity(spec: EntitySpec, op: Operation): Entity {
  return makeEntities(spec, op)[0];
}

/** Resolve a phase's spawn list (picks consume the op's seeded rng, in order). */
export function spawnAll(list: readonly SpawnSpec[], op: Operation): Entity[] {
  const out: Entity[] = [];
  for (const s of list) {
    if (s.e !== 'pick') {
      out.push(...makeEntities(s, op));
      continue;
    }
    const n = typeof s.n === 'number' ? s.n : op.rng.int(s.n[0], s.n[1]);
    const pool = [...s.of];
    for (let i = 0; i < n && pool.length; i++) out.push(...makeEntities(pool.splice(Math.floor(op.rng.next() * pool.length), 1)[0], op));
  }
  return out;
}

// ------------------------------------------------------------------ compile

/** Keeps vitals above a floor until the surgeon lands a COOL or GOOD in this phase (tutorial phases). */
class VitalsFloor {
  constructor(readonly floor: number) {}
  attach(op: Operation): void {
    let active = true;
    const off = op.events.on('rate', ({ rating }) => {
      if (rating === 'cool' || rating === 'good') {
        active = false;
        off();
      }
    });
    const offHurt = op.events.on('hurt', () => {
      if (!active) return offHurt();
      if (op.vitals < this.floor) op.vitals = this.floor;
    });
  }
}

const incisionOf = (op: Operation): Incision | undefined => op.entities.find((e): e is Incision => e instanceof Incision);

function compilePhase(data: PhaseData): DataPhaseDef {
  return {
    data,
    callout: data.callout,
    objective: data.objective,
    spawn(op: Operation): Entity[] {
      if (data.floor) new VitalsFloor(data.floor).attach(op);
      if (data.close) incisionOf(op)?.beginClosing();
      return spawnAll(data.spawn ?? [], op);
    },
  };
}

/** Compile operation data into a playable definition. */
export function defineOp(data: OperationData): OperationDef & { phases: readonly DataPhaseDef[] } {
  return { ...data, phases: data.phases.map(compilePhase) };
}

/** True when a compiled operation came from data (and can be validated statically). */
export const isDataOp = (def: OperationDef): def is OperationDef & { phases: readonly DataPhaseDef[] } =>
  def.phases.length > 0 && def.phases.every((p) => 'data' in p);

/** The data an operation was compiled from, or null for a closure-built operation. */
export function opData(def: OperationDef): OperationData | null {
  if (!isDataOp(def)) return null;
  const phases = def.phases as readonly DataPhaseDef[];
  return { ...def, phases: phases.map((p) => p.data) };
}

// ------------------------------------------------------------------ validation

/** Distance inside the field edge an entity's anchor must keep (so nothing sits on the rim). */
export const FIELD_MARGIN = 0.92;

const inField = (p: Pt): boolean => {
  const dx = p[0] / (FIELD.rx * FIELD_MARGIN);
  const dy = p[1] / (FIELD.ry * FIELD_MARGIN);
  return dx * dx + dy * dy <= 1 && onBody(P(p));
};

function checkParam(name: string, v: unknown, p: Param): string | null {
  if (v === undefined) return p.optional ? null : `missing "${name}"`;
  const isPt = (x: unknown) => Array.isArray(x) && x.length === 2 && x.every((n) => typeof n === 'number' && Number.isFinite(n));
  switch (p.type) {
    case 'number':
      if (typeof v !== 'number' || !Number.isFinite(v)) return `"${name}" must be a number`;
      if (p.range && (v < p.range[0] || v > p.range[1])) return `"${name}" ${v} outside ${p.range[0]}…${p.range[1]}`;
      return null;
    case 'numbers':
      return Array.isArray(v) && v.every((n) => typeof n === 'number' && Number.isFinite(n)) ? null : `"${name}" must be a list of numbers`;
    case 'boolean':
      return typeof v === 'boolean' ? null : `"${name}" must be true/false`;
    case 'string':
      if (typeof v !== 'string') return `"${name}" must be a string`;
      return p.oneOf && !p.oneOf.includes(v) ? `"${name}" "${v}" is not one of ${p.oneOf.join(', ')}` : null;
    case 'pt':
      if (!isPt(v)) return `"${name}" must be [dx, dy]`;
      return inField(v as Pt) ? null : `"${name}" [${(v as Pt).join(', ')}] is off the operating field`;
    case 'path':
      if (!Array.isArray(v) || v.length < 2 || !v.every(isPt)) return `"${name}" must be two or more [dx, dy] points`;
      return (v as Pt[]).every(inField) ? null : `"${name}" leaves the operating field`;
  }
}

/** Problems with one entity spec, prefixed with where it sits. */
export function validateSpec(spec: unknown, tools: readonly ToolId[], where: string): string[] {
  const s = spec as { e?: unknown };
  if (!s || typeof s !== 'object' || typeof s.e !== 'string') return [`${where}: not an entity spec`];
  if (s.e === 'pick') {
    const p = spec as PickSpec;
    const errs: string[] = [];
    const [lo, hi] = typeof p.n === 'number' ? [p.n, p.n] : p.n;
    if (!Array.isArray(p.of) || p.of.length === 0) errs.push(`${where}: pick has no candidates`);
    else if (!(lo >= 0 && hi >= lo && hi <= p.of.length)) errs.push(`${where}: pick n ${JSON.stringify(p.n)} does not fit ${p.of.length} candidates`);
    (p.of ?? []).forEach((c, i) => errs.push(...validateSpec(c, tools, `${where}.of[${i}]`)));
    return errs;
  }
  const entry = (ENTITY_REGISTRY as Record<string, RegistryEntry>)[s.e];
  if (!entry) return [`${where}: unknown entity id "${s.e}"`];
  const errs: string[] = [];
  const params = { ...entry.params, ...COMMON };
  for (const k of Object.keys(spec as object)) {
    if (k === 'e') continue;
    if (!(k in params)) errs.push(`${where} (${s.e}): unknown parameter "${k}"`);
  }
  for (const [k, p] of Object.entries(params)) {
    const err = checkParam(k, (spec as Record<string, unknown>)[k], p);
    if (err) errs.push(`${where} (${s.e}): ${err}`);
  }
  if (errs.length) return errs;
  const needs = [...entry.needs(spec as EntitySpec), ...((spec as Common).hidden ? [['lens'] as ToolId[]] : [])];
  for (const any of needs) if (!any.some((t) => tools.includes(t))) errs.push(`${where} (${s.e}): needs ${any.join(' or ')}, which the op does not provide`);
  return errs;
}

/**
 * Briefing mismatches (GAM-0062): only small lacerations (length ≤ SALVE_MAX, under 25 px from the
 * centre to either end) close under the Salve; larger ones need the Thread. A phase whose callout
 * sends the surgeon to the Salve for a cut that is too long to salve gets a warning (not an error:
 * the op still plays, the briefing is just wrong).
 */
export function opWarnings(data: OperationData): string[] {
  const warns: string[] = [];
  data.phases.forEach((ph, i) => {
    const text = (ph.callout ?? []).join(' ');
    if (!/salve/i.test(text) || !/\b(cut|cuts|laceration|lacerations|gash|slash)\b/i.test(text)) return;
    const cuts = (ph.spawn ?? []).filter((s): s is EntitySpec & { len: number } => s.e === 'laceration' && typeof (s as { len?: unknown }).len === 'number');
    if (cuts.length && cuts.every((c) => c.len > SALVE_MAX)) warns.push(`${data.id}.p${i}: the callout sends the Salve to a cut, but every laceration here is longer than ${SALVE_MAX} px and needs the Thread`);
  });
  return warns;
}

/** Every problem in an operation's data (empty = valid). */
export function validateOp(data: OperationData): string[] {
  const errs: string[] = [];
  const id = data.id;
  if (!data.phases.length) errs.push(`${id}: no phases`);
  let incision = false;
  data.phases.forEach((ph, i) => {
    const where = `${id}.p${i}`;
    (ph.spawn ?? []).forEach((s, j) => {
      errs.push(...validateSpec(s, data.tools, `${where}.spawn[${j}]`));
      if (s.e === 'incision') incision = true;
    });
    if (ph.close && !incision) errs.push(`${where}: closes an incision that was never opened`);
    if (!ph.close && !(ph.spawn ?? []).length) errs.push(`${where}: phase spawns nothing`);
    if (ph.floor !== undefined && !(ph.floor > 0 && ph.floor < 99)) errs.push(`${where}: floor ${ph.floor} out of range`);
  });
  if (data.ranks.S <= data.ranks.A || data.ranks.A <= data.ranks.B) errs.push(`${id}: rank thresholds must satisfy S > A > B`);
  return errs;
}
