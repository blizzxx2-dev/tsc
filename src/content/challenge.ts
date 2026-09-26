/**
 * Challenge mode ("X-Operations"), the Symptom Loom and challenge mutators.
 *
 * X-ops remix a Malison hour: Master drain, harder boss numbers, no assists,
 * no checkpoints, no retry-at-Novice, the Litany once. Each declares its
 * modifiers as data. The Loom stitches three adjacent "verses" from twelve
 * symptom modules into a procedural operation, identified by a shareable code.
 */
import type { Vec } from '../core/math';
import { Rng } from '../core/math';
import { Bubo, Burn, Embedded, Grub, Laceration, Rot, Sigil, SIGILS, Venom } from '../surgery/entities';
import type { Entity } from '../surgery/entity';
import type { Modifiers } from '../surgery/difficulty';
import { Malison } from '../surgery/malison';
import { FIELD, type MutatorId, type OperationDef, type OperationOptions, type PhaseDef } from '../surgery/operation';
import type { Progress } from '../surgery/progress';
import type { Rank } from '../surgery/types';
import { RainDrips } from '../surgery/ailments/environment';
import { fractureSite } from '../surgery/ailments/fracture';
import { FrostPatch, IceCrystal } from '../surgery/ailments/frost';
import { Growth } from '../surgery/ailments/growth';
import { GutWorm, Tick } from '../surgery/ailments/parasites';
import { trollWound } from '../surgery/ailments/regen';
import { EggSac, LaudsMalison } from '../surgery/lauds';
import { PrimeMalison, PRIME_DEFAULT } from '../surgery/bosses/prime';
import { TerceMalison, TERCE_DEFAULT } from '../surgery/bosses/terce';
import { SextMalison, SEXT_DEFAULT } from '../surgery/bosses/sext';
import { NoneMalison, NONE_DEFAULT } from '../surgery/bosses/none';
import { VespersMalison, VESPERS_DEFAULT } from '../surgery/bosses/vespers';
import { ComplineMalison, COMPLINE_DEFAULT } from '../surgery/bosses/compline';
import { BOSS_OPS, type CodexBoss } from '../surgery/bosses/codex';
import type { TuningOverride } from '../surgery/tuning';
import { EDITION } from '../platform/build';
import { OP_1_5 } from './chapter1';
import { OP_2_5 } from './chapter2';
import { LATER_X_BASES } from './challengeLater';

const at = (dx: number, dy: number): Vec => ({ x: FIELD.cx + dx, y: FIELD.cy + dy });
const ALL_TOOLS = ['lancet', 'tongs', 'leech', 'thread', 'salve', 'tincture', 'brand', 'lens'] as const;

// ====================================================================== X-operations

export type XModifiers = Pick<Modifiers, 'drain' | 'time' | 'hp' | 'tellSpeed' | 'addCadence'>;

export interface XOp {
  id: string;
  /** The Malison hour it remixes. */
  hour: 'matins' | 'lauds' | 'prime' | 'terce' | 'sext' | 'none' | 'vespers' | 'compline';
  title: string;
  blurb: string;
  mods: XModifiers;
  /** Story chapter whose clearing unlocks it, and the rank needed on that chapter's boss op (Alpha rule). */
  unlock: { chapter: number; bossOp?: string; rank?: Rank };
  /** Built only once its Malison exists (Chapters III–V are after the demo). */
  base: OperationDef | null;
  /** Adjust the boss as it spawns (rhythms and the like). */
  tuneBoss?: (e: Entity) => void;
  /** The remixed boss (BOS-0164..0171): replaces the spawn of the base op's boss phase. */
  boss?: { phase: number; make: (op: Parameters<PhaseDef['spawn']>[0]) => Entity[] };
  /** Tuning the remix sets on the whole operation. */
  tuning?: TuningOverride;
}

/** The story op whose boss an Hour's X-op remixes (the Alpha unlock rule: clear it at A or better). */
const bossOpOf = (hour: CodexBoss): string | undefined => Object.keys(BOSS_OPS).find((id) => BOSS_OPS[id] === hour);

/** Later-chapter bases exist only in the full edition (demo bundles tree-shake them out). */
const later = (id: keyof typeof LATER_X_BASES): OperationDef | null => (EDITION === 'full' ? LATER_X_BASES[id] : null);

/** The X-op ladder: one per Malison hour. X1 ships with the demo. */
export const X_OPS: readonly XOp[] = [
  {
    id: 'x1',
    hour: 'matins',
    title: 'X1 — Matins, Unveiled',
    blurb: 'The Night Vigil, remembered wrong: half again as hard to unmake, its shroud parting faster.',
    mods: { drain: 1, time: 1, hp: 1.5, tellSpeed: 1, addCadence: 1 },
    unlock: { chapter: 2 },
    base: OP_1_5,
    // BOS-0164: 1.5× HP, a 3 s veil / 2 s open rhythm, and the Eye out from the start alongside the shroud.
    tuneBoss: (e) => {
      if (e instanceof Malison) {
        e.veilTime = 3;
        e.openTime = 2;
        e.tune.eyeFromStart = true;
      }
    },
  },
  {
    id: 'x2',
    hour: 'lauds',
    title: 'X2 — Lauds, Rekindled',
    blurb: 'The choir returns hoarse and hungry: tougher, quicker to sing, quicker to rekindle.',
    mods: { drain: 0.85, time: 1, hp: 1.15, tellSpeed: 1.2, addCadence: 1.25 },
    unlock: { chapter: 2, bossOp: 'op2-5', rank: 'A' },
    base: OP_2_5,
    // BOS-0165: six Voices, a 1.0 s response window, a dawn flare every 8 s.
    boss: { phase: 1, make: (op) => [new LaudsMalison(at(0, 30), op, { voices: 6, response: 1.0, flareEvery: 8 })] },
  },
  {
    id: 'x3',
    hour: 'prime',
    title: 'X3 — Prime, Recounted',
    blurb: 'The roll is read four names at a time from the first stroke, and spilt ink starts writing within five seconds.',
    mods: { drain: 1.1, time: 0.9, hp: 1.4, tellSpeed: 1.2, addCadence: 1.2 },
    unlock: { chapter: 3, bossOp: bossOpOf('prime'), rank: 'A' },
    base: later('x3'),
    // BOS-0166: four names in parallel from the start; ink blots become strokes after 5 s.
    boss: { phase: 0, make: (op) => [new PrimeMalison(at(0, 20), op, { ...PRIME_DEFAULT, parallelFromStart: 4, inkWrites: 5 })] },
  },
  {
    id: 'x4',
    hour: 'terce',
    title: 'X4 — Terce, Rekindled',
    blurb: 'The salve pot is back to its old size, and the tongues leap every three and a half seconds.',
    mods: { drain: 1.1, time: 0.9, hp: 1.4, tellSpeed: 1.25, addCadence: 1.2 },
    unlock: { chapter: 3, bossOp: bossOpOf('terce'), rank: 'A' },
    base: later('x4'),
    // BOS-0167: salve capacity back to 46 (the Terce op's 70 does not apply); tongues leap every 3.5 s.
    boss: { phase: 0, make: (op) => [new TerceMalison(op, { ...TERCE_DEFAULT, leapEvery: 3.5 })] },
    tuning: { salve: { capacity: 46, refillIdle: 3 } },
  },
  {
    id: 'x5',
    hour: 'sext',
    title: 'X5 — Sext at Noon',
    blurb: 'The torpor never lifts below 150 ms, and the monitors lie from first to last.',
    mods: { drain: 1.15, time: 0.9, hp: 1.5, tellSpeed: 1.25, addCadence: 1.25 },
    unlock: { chapter: 4, bossOp: bossOpOf('sext'), rank: 'A' },
    base: later('x5'),
    // BOS-0168: torpor starts at 150 ms; the false vitals are permanent.
    boss: { phase: 0, make: (op) => [new SextMalison(at(30, 30), op, { ...SEXT_DEFAULT, lagFloor: 0.15, permanentFalse: true })] },
  },
  {
    id: 'x6',
    hour: 'none',
    title: 'X6 — None, Unending',
    blurb: 'It splits five ways, and any piece that reaches the heart ends it.',
    mods: { drain: 1.15, time: 0.85, hp: 1.5, tellSpeed: 1.3, addCadence: 1.25 },
    unlock: { chapter: 4, bossOp: bossOpOf('none'), rank: 'A' },
    base: later('x6'),
    // BOS-0169: five split segments; heart contact is always instant loss.
    boss: { phase: 0, make: (op) => [new NoneMalison(op, { ...NONE_DEFAULT, segments: 5, segmentsLethal: true })] },
  },
  {
    id: 'x7',
    hour: 'vespers',
    title: 'X7 — Vespers Relit',
    blurb: 'Only three lamps, and they gutter out in nine seconds.',
    mods: { drain: 1.2, time: 0.85, hp: 1.6, tellSpeed: 1.3, addCadence: 1.3 },
    unlock: { chapter: 5, bossOp: bossOpOf('vespers'), rank: 'A' },
    base: later('x7'),
    // BOS-0170: only 3 lamps, each dimming over 9 s.
    boss: { phase: 0, make: (op) => [new VespersMalison(at(0, 0), op, { ...VESPERS_DEFAULT, lamps: 3, dimTime: 9 })] },
  },
  {
    id: 'x8',
    hour: 'compline',
    title: 'X8 — Compline, Unsilenced',
    blurb: 'No silence-nodes: the Litany stays stolen, and the lancet and brand must strike within 0.4 s.',
    mods: { drain: 1.2, time: 0.85, hp: 1.75, tellSpeed: 1.35, addCadence: 1.35 },
    unlock: { chapter: 5, bossOp: bossOpOf('compline'), rank: 'A' },
    base: later('x8'),
    // BOS-0171: no silence nodes; the Litany permanently stolen; two-tool combo window 0.4 s.
    boss: { phase: 0, make: (op) => [new ComplineMalison(at(0, 0), op, { ...COMPLINE_DEFAULT, noNodes: true, comboWindow: 0.4 })] },
  },
];

export const xOp = (id: string): XOp | undefined => X_OPS.find((x) => x.id === id);

const RANK_ORDER: Rank[] = ['C', 'B', 'A', 'S', 'XS'];

/** Is this X-op playable and unlocked on this save? */
export function xUnlocked(p: Progress, x: XOp): boolean {
  if (!x.base || p.chaptersCleared < x.unlock.chapter) return false;
  if (!x.unlock.rank || !x.unlock.bossOp) return true;
  const best = p.best[x.unlock.bossOp];
  const top = best ? Object.values(best).reduce<Rank | null>((a, b) => (b && (!a || RANK_ORDER.indexOf(b.rank) > RANK_ORDER.indexOf(a)) ? b.rank : a), null) : null;
  return !!top && RANK_ORDER.indexOf(top) >= RANK_ORDER.indexOf(x.unlock.rank);
}

/** The operation definition for an X-op (the story op with its boss retuned). */
export function xOpDef(x: XOp, base: OperationDef | null = x.base): OperationDef {
  if (!base) throw new Error(`${x.id} is not built yet`);
  const phases: PhaseDef[] = base.phases.map((p, i) => ({
    callout: p.callout,
    spawn: (op) => {
      const es = x.boss && x.boss.phase === i ? x.boss.make(op) : p.spawn(op);
      if (x.tuneBoss) for (const e of es) x.tuneBoss(e);
      return es;
    },
  }));
  const tuning = x.tuning ? { ...base.tuning, ...x.tuning } : base.tuning;
  return { ...base, id: `${base.id}-${x.id}`, title: x.title, phases, litany: true, litanyUses: 1, ...(tuning ? { tuning } : {}) };
}

/**
 * X-op rules: Master drain and time, the X-op's boss modifiers, no assists, no
 * upgrades, no checkpoints, the Litany once. (The operation enforces the rest
 * when `challenge` is set.)
 */
export function xOpOptions(x: XOp, extra: OperationOptions = {}): OperationOptions {
  return { ...extra, challenge: x.id, difficulty: 'master', mods: { ...x.mods }, assists: {}, upgrades: [], checkpoint: undefined };
}

// ====================================================================== mutators

export interface MutatorInfo {
  id: MutatorId;
  name: string;
  effect: string;
}

export const MUTATORS: Record<MutatorId, MutatorInfo> = {
  candle: { id: 'candle', name: 'Candle-Only', effect: 'The candle lights only the middle of the table; the lens sees 30 % less.' },
  cart: { id: 'cart', name: 'Moving Cart', effect: 'The field sways 12 px on the road. Your aim is judged as ever.' },
  rain: { id: 'rain', name: 'Field Tent in Rain', effect: 'Drips thin the blood into small pools every 5 s.' },
  mud: { id: 'mud', name: 'Field Mud', effect: 'Every wound comes in fouled. Salve it clean before the thread will take.' },
  stroh: { id: 'stroh', name: 'Stroh Watches', effect: 'The Inquisitor is in the room. Invoke the Litany and the operation ends.' },
};

/** Apply mutators to a definition + options (Rain adds its drips to the first phase). */
export function withMutators(def: OperationDef, opts: OperationOptions, mutators: readonly MutatorId[]): { def: OperationDef; opts: OperationOptions } {
  const rain = mutators.includes('rain');
  const phases = rain ? def.phases.map((p, i) => (i === 0 ? { ...p, spawn: (op: Parameters<PhaseDef['spawn']>[0]) => [...p.spawn(op), new RainDrips()] } : p)) : def.phases;
  return { def: { ...def, phases, ...(rain ? { venue: 'field' as const } : {}) }, opts: { ...opts, mutators: [...(opts.mutators ?? []), ...mutators] } };
}

// ====================================================================== the Symptom Loom

export interface LoomModule {
  id: string;
  name: string;
  callout: string;
  spawn: (op: Parameters<PhaseDef['spawn']>[0], c: Vec) => Entity[];
}

/** Twelve symptom "verses". Adjacent verses share a theme so any three flow together. */
export const LOOM_MODULES: readonly LoomModule[] = [
  { id: 'brawl', name: 'Tavern Brawl', callout: 'Knife-work. Stitch the cuts, draw off the blood.', spawn: (_op, c) => [new Laceration({ x: c.x - 70, y: c.y }, 0.3, 90, 0.6), new Laceration({ x: c.x + 80, y: c.y + 40 }, -0.4, 70, 0.6)] },
  { id: 'arrows', name: 'Arrow Storm', callout: 'Arrows and a bolt — nick the barbs, ease the bolt.', spawn: (_op, c) => [new Embedded({ x: c.x - 60, y: c.y }, 'arrow', -0.5), new Embedded({ x: c.x + 90, y: c.y + 30 }, 'bolt', 0.4, false)] },
  { id: 'powder', name: 'Powder Burns', callout: 'Powder burns and shot.', spawn: (op, c) => [new Burn({ x: c.x - 80, y: c.y - 20 }, 40, op), new Embedded({ x: c.x + 80, y: c.y + 20 }, 'shot')] },
  { id: 'plague', name: 'Plague Humours', callout: 'Buboes and rot. Lance, drain, salve.', spawn: (_op, c) => [new Bubo({ x: c.x - 80, y: c.y }, 22), new Bubo({ x: c.x + 60, y: c.y - 40 }, 20), new Rot({ x: c.x + 40, y: c.y + 60 }, 30, 0.4)] },
  { id: 'brood', name: 'Brood', callout: 'A bite, a sac, a grub.', spawn: (op, c) => [new Venom({ x: c.x - 90, y: c.y }, op, 5), new EggSac({ x: c.x + 60, y: c.y + 20 }, 2, 24), new Grub({ x: c.x, y: c.y - 60 }, op, 35)] },
  { id: 'hexstone', name: 'Black Seam', callout: 'Hexstone under the skin — the lens, then the lead dish.', spawn: (_op, c) => {
    const h = new Embedded({ x: c.x - 40, y: c.y }, 'hexstone', 0.6, false);
    h.hidden = true;
    return [h, new Rot({ x: c.x + 80, y: c.y + 20 }, 26, 0.4)];
  } },
  { id: 'curse', name: 'Curse Script', callout: 'A sigil — node by node, stroke by stroke.', spawn: (_op, c) => [new Sigil({ x: c.x, y: c.y }, SIGILS.trident, 55, 6)] },
  { id: 'frost', name: 'Frostbite', callout: 'Frost-cursed — tap-thaw it, then the crystals.', spawn: (_op, c) => [new FrostPatch({ x: c.x - 60, y: c.y }, 40), new IceCrystal({ x: c.x - 55, y: c.y + 8 })] },
  { id: 'troll', name: 'Troll Hide', callout: 'It heals as you watch — sear the rim, then the shard.', spawn: (_op, c) => trollWound({ x: c.x, y: c.y }, 'shard') },
  { id: 'bone', name: 'Broken Bone', callout: 'A fracture — set the pieces, pin them.', spawn: (op, c) => fractureSite(op, { x: c.x, y: c.y }, { fragments: 2, splinters: 1 }) },
  { id: 'worms', name: 'Worms', callout: 'A worm and its ticks — slow and steady.', spawn: (op, c) => [new GutWorm({ x: c.x - 40, y: c.y }), new Tick({ x: c.x + 60, y: c.y + 20 }, op)] },
  { id: 'growth', name: 'Growth', callout: 'A growth, fed by two vessels. Tie them, cut round, lift.', spawn: (op, c) => [new Growth({ x: c.x, y: c.y }, op, 24, 2)] },
];

const CODE_PREFIX = 'LOOM-';

export const loomCode = (seed: number): string => `${CODE_PREFIX}${(seed >>> 0).toString(36).toUpperCase()}`;

export function parseLoomCode(code: string): number | null {
  const c = code.trim().toUpperCase();
  if (!c.startsWith(CODE_PREFIX)) return null;
  const n = parseInt(c.slice(CODE_PREFIX.length), 36);
  return Number.isFinite(n) ? n >>> 0 : null;
}

/** The three adjacent verses a seed chooses. */
export function loomVerses(seed: number): LoomModule[] {
  const start = new Rng(seed).int(0, LOOM_MODULES.length - 1);
  return [0, 1, 2].map((i) => LOOM_MODULES[(start + i) % LOOM_MODULES.length]);
}

/** A procedural challenge operation from a seed. */
export function loomOp(seed: number): OperationDef {
  const verses = loomVerses(seed);
  return {
    id: `loom-${seed >>> 0}`,
    title: `The Symptom Loom — ${loomCode(seed)}`,
    patient: 'A stranger from the road',
    diagnosis: verses.map((v) => v.name).join(', then ') + '.',
    organ: 'flesh',
    timeLimit: 360,
    baseDrain: 0.1,
    tools: ALL_TOOLS,
    ranks: { S: 6500, A: 5200, B: 3900 },
    seed: seed >>> 0,
    litany: true,
    noClose: true,
    phases: verses.map((v) => ({ callout: [v.callout], spawn: (op) => v.spawn(op, at(0, 20)) })),
  };
}

/** The Daily Loom: everyone gets the same op on the same (UTC) day. */
export function dailySeed(date: Date | string): number {
  const day = typeof date === 'string' ? date.slice(0, 10) : date.toISOString().slice(0, 10);
  let h = 2166136261;
  for (const ch of `daily:${day}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

export const dailyBoardId = (date: Date | string): string => `loom-${typeof date === 'string' ? date.slice(0, 10) : date.toISOString().slice(0, 10)}`;

// ====================================================================== custom challenges (post-launch)

export interface CustomChallenge {
  opId: string;
  mods: XModifiers;
  mutators: MutatorId[];
}

const MUT_ORDER: readonly MutatorId[] = ['candle', 'cart', 'rain', 'stroh'];

/** Share code for a custom challenge: op id, five modifiers (percent), mutator bits. */
export function encodeChallenge(c: CustomChallenge): string {
  const m = c.mods;
  const pct = [m.drain, m.time, m.hp, m.tellSpeed, m.addCadence].map((v) => Math.round(v * 100).toString(36));
  const bits = c.mutators.reduce((a, id) => a | (1 << MUT_ORDER.indexOf(id)), 0);
  return [c.opId, ...pct, bits.toString(36)].join('.');
}

export function decodeChallenge(code: string): CustomChallenge | null {
  const parts = code.trim().split('.');
  if (parts.length !== 7) return null;
  const [opId, ...rest] = parts;
  const nums = rest.map((p) => parseInt(p, 36));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  const [drain, time, hp, tellSpeed, addCadence] = nums.slice(0, 5).map((n) => n / 100);
  const bits = nums[5];
  return { opId, mods: { drain, time, hp, tellSpeed, addCadence }, mutators: MUT_ORDER.filter((_, i) => bits & (1 << i)) };
}
