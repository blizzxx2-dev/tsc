import type { Vec } from '../core/math';
import { Bubo, Burn, Embedded, Grub, Incision, Laceration, Rot, Sigil, SIGILS, Venom, type EmbeddedKind } from './entities';
import type { Entity } from './entity';
import { FIELD, type Operation } from './operation';
import { FrostPatch, IceCrystal } from './ailments/frost';
import { Fracture } from './ailments/fracture';
import { Growth, MutationBud } from './ailments/growth';
import { Ulcer } from './ailments/ulcer';
import { RegenWound } from './ailments/regen';
import { BiteChannel } from './ailments/vampire';
import { Gangrene } from './ailments/gangrene';
import { GutWorm, Tick } from './ailments/parasites';

/**
 * Data-driven ailments: content may declare `{kind, pos, params}` records
 * instead of constructing classes. Every record is validated against the
 * schema below at load; tests validate all declared content so bad data
 * fails CI rather than a player's session.
 */
export interface AilmentSpec {
  kind: string;
  /** Offset from the field centre. */
  pos: [number, number];
  params?: Record<string, unknown>;
}

type Field = { type: 'number'; min?: number; max?: number; optional?: boolean } | { type: 'boolean'; optional?: boolean } | { type: 'enum'; values: readonly string[]; optional?: boolean } | { type: 'points'; optional?: boolean };

interface Kind {
  params: Record<string, Field>;
  build: (op: Operation, at: Vec, p: Record<string, unknown>) => Entity[];
}

const num = (min?: number, max?: number, optional = false): Field => ({ type: 'number', min, max, optional });
const opt = <F extends Field>(f: F): F => ({ ...f, optional: true });
const n = (p: Record<string, unknown>, k: string, d: number): number => (typeof p[k] === 'number' ? (p[k] as number) : d);
const pts = (p: Record<string, unknown>, k: string): Vec[] => ((p[k] as [number, number][]) ?? []).map(([x, y]) => ({ x: FIELD.cx + x, y: FIELD.cy + y }));

const EMBED_KINDS: readonly EmbeddedKind[] = ['arrow', 'bolt', 'shot', 'tooth', 'shard', 'glass', 'hexstone'];

export const AILMENT_SCHEMA: Record<string, Kind> = {
  laceration: {
    params: { angle: num(-7, 7), length: num(10, 300), bleed: opt(num(0, 5)), source: opt({ type: 'enum', values: ['blade', 'claw'] }) },
    build: (_op, at, p) => [new Laceration(at, n(p, 'angle', 0), n(p, 'length', 60), n(p, 'bleed', 1), (p.source as 'blade' | 'claw') ?? 'blade')],
  },
  incision: {
    params: { points: { type: 'points' }, layers: opt(num(1, 3)) },
    build: (_op, _at, p) => [new Incision(pts(p, 'points'), n(p, 'layers', 1))],
  },
  embedded: {
    params: { object: { type: 'enum', values: EMBED_KINDS }, angle: opt(num(-7, 7)), barbed: opt({ type: 'boolean' }), hidden: opt({ type: 'boolean' }) },
    build: (_op, at, p) => {
      const e = new Embedded(at, p.object as EmbeddedKind, n(p, 'angle', 0), (p.barbed as boolean | undefined) ?? p.object === 'arrow');
      e.hidden = !!p.hidden;
      return [e];
    },
  },
  burn: {
    params: { radius: num(10, 100), source: opt({ type: 'enum', values: ['fire', 'acid', 'hexfire'] }) },
    build: (op, at, p) => [new Burn(at, n(p, 'radius', 40), op, (p.source as 'fire' | 'acid' | 'hexfire') ?? 'fire')],
  },
  bubo: { params: { r: opt(num(10, 40)), maxR: opt(num(20, 60)) }, build: (_op, at, p) => [new Bubo(at, n(p, 'r', 22), n(p, 'maxR', 40))] },
  rot: { params: { r: num(10, 60), spread: opt(num(0, 2)) }, build: (_op, at, p) => [new Rot(at, n(p, 'r', 30), n(p, 'spread', 0.6))] },
  venom: { params: { rate: opt(num(0, 20)), color: opt({ type: 'enum', values: ['green', 'violet'] }) }, build: (op, at, p) => [new Venom(at, op, n(p, 'rate', 6), (p.color as 'green' | 'violet') ?? 'violet')] },
  grub: { params: { speed: opt(num(0, 120)) }, build: (op, at, p) => [new Grub(at, op, n(p, 'speed', 40))] },
  sigil: {
    params: { glyph: { type: 'enum', values: Object.keys(SIGILS) }, size: opt(num(30, 90)), lashEvery: opt(num(2, 999)) },
    build: (_op, at, p) => [new Sigil(at, SIGILS[p.glyph as keyof typeof SIGILS], n(p, 'size', 60), n(p, 'lashEvery', 5))],
  },
  fracture: { params: { axis: opt(num(-7, 7)), fragments: opt(num(2, 5)), compound: opt({ type: 'boolean' }) }, build: (op, at, p) => [new Fracture(at, op, n(p, 'axis', 0), n(p, 'fragments', 3), !!p.compound)] },
  frost: { params: { radius: opt(num(20, 90)) }, build: (_op, at, p) => [new FrostPatch(at, n(p, 'radius', 40))] },
  ice: { params: {}, build: (_op, at) => [new IceCrystal(at)] },
  growth: { params: { r: opt(num(12, 50)), feeders: opt(num(0, 4)), variant: opt({ type: 'enum', values: ['plain', 'tooth', 'finger', 'eye'] }) }, build: (op, at, p) => [new Growth(at, op, n(p, 'r', 28), n(p, 'feeders', 0), (p.variant as 'plain') ?? 'plain')] },
  bud: { params: {}, build: (_op, at) => [new MutationBud(at)] },
  ulcer: { params: {}, build: (_op, at) => [new Ulcer(at)] },
  regen: {
    params: { object: opt({ type: 'enum', values: EMBED_KINDS }), gut: opt({ type: 'boolean' }) },
    build: (_op, at, p) => {
      const w = new RegenWound(at, (p.object as EmbeddedKind) ?? 'shard', !!p.gut);
      return [w, w.shard];
    },
  },
  bite: { params: { angle: opt(num(-7, 7)) }, build: (_op, at, p) => [new BiteChannel(at, n(p, 'angle', 0))] },
  gangrene: {
    params: { root: { type: 'points' }, start: opt(num(0, 300)), line: opt(num(20, 400)) },
    build: (_op, at, p) => [new Gangrene(at, pts(p, 'root')[0], n(p, 'start', 40), n(p, 'line', 150))],
  },
  worm: { params: {}, build: (_op, at) => [new GutWorm(at)] },
  tick: { params: {}, build: (op, at) => [new Tick(at, op)] },
};

/** Validate records; returns human-readable errors (empty = valid). */
export function validateAilments(specs: readonly AilmentSpec[], where = 'content'): string[] {
  const errs: string[] = [];
  specs.forEach((s, i) => {
    const at = `${where}[${i}]`;
    const k = AILMENT_SCHEMA[s.kind];
    if (!k) return errs.push(`${at}: unknown ailment kind "${s.kind}"`);
    if (!Array.isArray(s.pos) || s.pos.length !== 2 || !s.pos.every((v) => typeof v === 'number' && Number.isFinite(v))) errs.push(`${at}: pos must be [dx, dy]`);
    else if ((s.pos[0] / FIELD.rx) ** 2 + (s.pos[1] / FIELD.ry) ** 2 > 1) errs.push(`${at}: pos [${s.pos}] lies off the body`);
    const params = s.params ?? {};
    for (const key of Object.keys(params)) if (!k.params[key]) errs.push(`${at}.${key}: not a parameter of ${s.kind}`);
    for (const [key, f] of Object.entries(k.params)) {
      const v = params[key];
      if (v === undefined) {
        if (!f.optional) errs.push(`${at}.${key}: required`);
        continue;
      }
      if (f.type === 'number') {
        if (typeof v !== 'number' || !Number.isFinite(v)) errs.push(`${at}.${key}: must be a number`);
        else if ((f.min !== undefined && v < f.min) || (f.max !== undefined && v > f.max)) errs.push(`${at}.${key}: ${v} outside ${f.min}…${f.max}`);
      } else if (f.type === 'boolean' && typeof v !== 'boolean') errs.push(`${at}.${key}: must be true/false`);
      else if (f.type === 'enum' && !f.values.includes(v as string)) errs.push(`${at}.${key}: "${String(v)}" is not one of ${f.values.join(', ')}`);
      else if (f.type === 'points' && !(Array.isArray(v) && v.length >= 1 && v.every((q) => Array.isArray(q) && q.length === 2 && q.every((x) => typeof x === 'number')))) errs.push(`${at}.${key}: must be a list of [dx, dy]`);
    }
  });
  return errs;
}

/** Build validated records into entities (throws on invalid data). */
export function buildAilments(op: Operation, specs: readonly AilmentSpec[], where = 'content'): Entity[] {
  const errs = validateAilments(specs, where);
  if (errs.length) throw new Error(`Invalid ailment data:\n${errs.join('\n')}`);
  return specs.flatMap((s) => AILMENT_SCHEMA[s.kind].build(op, { x: FIELD.cx + s.pos[0], y: FIELD.cy + s.pos[1] }, s.params ?? {}));
}
