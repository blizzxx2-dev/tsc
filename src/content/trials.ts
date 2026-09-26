/**
 * The Trials of the Guild (CON-0201…0222, CON-0248): twenty-four X-operations in four tiers —
 * Journeyman, Master, Grand Master and the Unsung — and two trials for each of the other
 * disciplines. A tier opens once three of the tier below are cleared at S or better; the first
 * opens with Chapter II, as the demo's Trials do (CON-0096).
 *
 * Every trial is a story operation (or one written for it) with the rules layer (CON-0202) laid
 * over it: time and drain multipliers, no Litany, no lens, no salve, one life (any MISS ends it),
 * a mirrored field, and the field modifiers. Results are kept as medals (UIX-0189): bronze for B,
 * silver for A, gold for S and the Saint's medal for XS.
 */
import type { Vec } from '../core/math';
import type { Entity } from '../surgery/entity';
import { FIELD, type MutatorId, type OperationDef, type OperationOptions, type PhaseDef } from '../surgery/operation';
import type { Progress } from '../surgery/progress';
import type { Rank } from '../surgery/types';
import { Malison, MATINS_DEFAULT } from '../surgery/malison';
import { LaudsMalison } from '../surgery/lauds';
import { PrimeMalison, PRIME_DEFAULT } from '../surgery/bosses/prime';
import { TerceMalison, TERCE_DEFAULT, TERCE_ZONES } from '../surgery/bosses/terce';
import { SextMalison, SEXT_DEFAULT } from '../surgery/bosses/sext';
import { NoneMalison, NONE_DEFAULT } from '../surgery/bosses/none';
import { ComplineMalison, COMPLINE_DEFAULT } from '../surgery/bosses/compline';
import { VespersMalison, VESPERS_DEFAULT } from '../surgery/bosses/vespers';
import { Worm } from '../surgery/ailments/kilnrows';
import { PetrifyFront } from '../surgery/ailments/vennmark';
import { Embedded } from '../surgery/entities';
import { EDITION } from '../platform/build';
import { defineOp, opData, type OperationData } from './schema';
import { OP_1_5 } from './chapter1';
import { OP_2_5 } from './chapter2';
import { LATER_TRIAL_BASES, type LaterTrialBase } from './trialsLater';
import { TRIAGE_FORD, TRIAGE_HOLLOW, TRIAGE_KILNROWS } from './triage';
import { FORENSIC_COACHMAN, FORENSIC_SALM } from './forensics';
import { INTERVIEW_FOUNDERS, INTERVIEW_LIESL } from './interviews';
import { OP_3_12, OP_5_10 } from './ops/bones';
import type { TriageScenario } from '../surgery/triage';
import type { InterviewDef } from '../surgery/interview';
import { LOOM_MODULES } from './challenge';

const at = (dx: number, dy: number): Vec => ({ x: FIELD.cx + dx, y: FIELD.cy + dy });
const ALL = ['lancet', 'tongs', 'leech', 'thread', 'salve', 'tincture', 'brand', 'lens'] as const;

export type TrialTier = 'journeyman' | 'master' | 'grandmaster' | 'unsung' | 'disciplines';
export const TRIAL_TIERS: readonly TrialTier[] = ['journeyman', 'master', 'grandmaster', 'unsung', 'disciplines'];

/** The rules layer (CON-0202). */
export interface TrialRules {
  /** Time limit × this. */
  time?: number;
  /** Wound drain × this. */
  drain?: number;
  noLitany?: boolean;
  noLens?: boolean;
  noSalve?: boolean;
  /** Any MISS ends the run. */
  oneLife?: boolean;
  /** The field laid out left for right (data operations). */
  mirrored?: boolean;
  /** The assistant says nothing. */
  silent?: boolean;
  /** No sound at all. */
  muted?: boolean;
  mutators?: readonly MutatorId[];
}

export interface Trial {
  id: string;
  /** The roadmap task it answers. */
  task: string;
  tier: TrialTier;
  title: string;
  blurb: string;
  rules: TrialRules;
  /** The operation; null when its chapter is not in this edition (`full`: the later chapters are). */
  op?: (full: boolean) => OperationDef | null;
  /** Adjust each entity as the op spawns it (rhythms, regrowth…). */
  tune?: (e: Entity) => void;
  /** A discipline trial plays its own scene. */
  triage?: TriageScenario;
  interview?: InterviewDef;
  /** Secret until a story flag is set. */
  secret?: string;
}

/** A later chapter's operation, or null in the demo. */
const later = (k: LaterTrialBase, full: boolean): OperationDef | null => (full ? LATER_TRIAL_BASES[k] : null);

/** Swap the spawn of the boss's own phase (the one that spawns a Malison) for `make`. */
function withBoss(def: OperationDef | null, make: PhaseDef['spawn']): OperationDef | null {
  if (!def) return null;
  const data = opData(def);
  const i = data ? data.phases.findIndex((p) => (p.spawn ?? []).some((e) => 'e' in e && e.e.startsWith('malison-'))) : -1;
  if (i < 0) throw new Error(`${def.id}: no Malison phase`);
  return { ...def, phases: def.phases.map((p, k) => (k === i ? { ...p, spawn: make } : p)) };
}

// ------------------------------------------------------------------ operations written for the trials

const KNIFE_FIGHTS = defineOp({
  id: 'trial-knives',
  title: 'Tuesday Knife-Fights',
  patient: 'Jost, drover, again',
  diagnosis: 'Four stab wounds from a Tuesday that went badly, all bleeding at once. No salve left in the pot.',
  organ: 'flesh',
  timeLimit: 120,
  tools: ['thread', 'leech'],
  ranks: { S: 3000, A: 2400, B: 1800 },
  litany: false,
  seed: 901,
  phases: [
    {
      objective: 'Stitch all four',
      callout: ['Four at once. The deepest first — they all bleed.'],
      spawn: [
        { e: 'laceration', at: [-170, -50], angle: 0.3, len: 90, bleed: 0.9 },
        { e: 'laceration', at: [140, 60], angle: -0.4, len: 90, bleed: 0.9 },
        { e: 'laceration', at: [-60, 90], angle: 1.2, len: 70, bleed: 0.8 },
        { e: 'laceration', at: [170, -90], angle: 2.0, len: 70, bleed: 0.8 },
      ],
    },
    { objective: 'Draw off the blood', callout: ['Now the pool.'], spawn: [{ e: 'pool', at: [0, 10], r: 34, required: true }] },
  ],
});

const QUIVER = defineOp({
  id: 'trial-quiver',
  title: 'A Quiver’s Worth',
  patient: 'Pieter, militiaman, unlucky twice',
  diagnosis: 'Five barbed arrows from the same raid — two gone in deep enough to lose.',
  organ: 'flesh',
  timeLimit: 240,
  tools: ['lancet', 'tongs', 'leech', 'thread', 'lens'],
  ranks: { S: 3000, A: 2400, B: 1800 },
  litany: false,
  seed: 902,
  phases: [
    {
      objective: 'Five arrows',
      callout: ['Five arrows. Two of them you won’t see without the lens.'],
      spawn: [
        { e: 'embedded', at: [-200, -40], kind: 'arrow', angle: -0.5 },
        { e: 'embedded', at: [-40, 70], kind: 'arrow', angle: 0.6 },
        { e: 'embedded', at: [160, -60], kind: 'arrow', angle: 2.4 },
        { e: 'embedded', at: [60, -110], kind: 'arrow', angle: -1.2, hidden: true },
        { e: 'embedded', at: [220, 70], kind: 'arrow', angle: 2.8, hidden: true },
      ],
    },
    { objective: 'Drain', callout: ['The blood’s pooled.'], spawn: [{ e: 'pool', at: [-60, 0], r: 30, required: true }, { e: 'pool', at: [120, 30], r: 26, required: true }] },
  ],
});

const GILDED_GOOSE = defineOp({
  id: 'trial-goose',
  title: 'Gilded Goose Closing Time',
  patient: 'The last three drinkers at the Gilded Goose',
  diagnosis: 'Six knife wounds among them, and the floor awash. The landlord wants his tables back.',
  organ: 'flesh',
  timeLimit: 150,
  tools: ['thread', 'leech', 'salve'],
  ranks: { S: 3000, A: 2400, B: 1800 },
  litany: false,
  seed: 903,
  phases: [
    {
      objective: 'Six wounds, two pools',
      callout: ['Drain first where it’s pooled, then stitch.'],
      spawn: [
        { e: 'pool', at: [-120, 20], r: 30, required: true },
        { e: 'pool', at: [140, -20], r: 28, required: true },
        { e: 'laceration', at: [-220, -80], angle: 0.4, len: 80, bleed: 0.7 },
        { e: 'laceration', at: [-60, -100], angle: -0.2, len: 70, bleed: 0.6 },
        { e: 'laceration', at: [60, 110], angle: 1.0, len: 60, bleed: 0.6 },
        { e: 'laceration', at: [230, 60], angle: -0.9, len: 80, bleed: 0.7 },
        { e: 'laceration', at: [-230, 100], angle: 2.2, len: 36, bleed: 0.4 },
        { e: 'laceration', at: [220, -110], angle: 0.2, len: 34, bleed: 0.4 },
      ],
    },
  ],
});

const GUNSMITHS = defineOp({
  id: 'trial-gunsmiths',
  title: 'Gunsmiths’ Tuesday',
  patient: 'Anno and his master, both at the proof-bench',
  diagnosis: 'Two burst barrels in one morning: burns crusted black, and shot under both.',
  organ: 'flesh',
  timeLimit: 260,
  tools: ['lancet', 'tongs', 'leech', 'thread', 'salve', 'tincture'],
  ranks: { S: 3000, A: 2400, B: 1800 },
  litany: false,
  seed: 904,
  phases: [
    {
      objective: 'The apprentice',
      callout: ['Anno first. Cut the black away before the salve, then the shot.'],
      spawn: [
        { e: 'burn', at: [-120, -20], r: 40 },
        { e: 'embedded', at: [80, 40], kind: 'shot' },
        { e: 'embedded', at: [150, -60], kind: 'shot' },
      ],
    },
    {
      objective: 'The master',
      callout: ['Now his master. The same, and worse.'],
      spawn: [
        { e: 'burn', at: [100, 0], r: 46 },
        { e: 'burn', at: [-160, 60], r: 30 },
        { e: 'embedded', at: [-60, -70], kind: 'shot' },
        { e: 'embedded', at: [-200, -40], kind: 'shot' },
      ],
    },
  ],
});

const TANNERS = defineOp({
  id: 'trial-tanners',
  title: 'Tanners’ Rows Fever',
  patient: 'A tanner’s widow, by one candle',
  diagnosis: 'Eight buboes and a rot that grows back as fast as it is cleaned. The candle is the only light.',
  organ: 'flesh',
  timeLimit: 280,
  env: ['candle'],
  tools: ['lancet', 'leech', 'salve', 'brand', 'thread'],
  ranks: { S: 3000, A: 2400, B: 1800 },
  litany: false,
  seed: 905,
  phases: [
    {
      objective: 'Eight buboes',
      callout: ['Lance them, drain them. Keep the candle close.'],
      spawn: [
        { e: 'bubo', at: [-220, -60], r: 20 },
        { e: 'bubo', at: [-140, 60], r: 18 },
        { e: 'bubo', at: [-60, -110], r: 20 },
        { e: 'bubo', at: [20, 90], r: 18 },
        { e: 'bubo', at: [90, -60], r: 20 },
        { e: 'bubo', at: [160, 70], r: 18 },
        { e: 'bubo', at: [230, -30], r: 20 },
        { e: 'bubo', at: [-10, -10], r: 18 },
      ],
    },
    { objective: 'The rot', callout: ['And the rot — it grows back fast.'], spawn: [{ e: 'rot', at: [60, 20], r: 34, spread: 0.8 }, { e: 'rot', at: [-150, -10], r: 30, spread: 0.8 }] },
  ],
});

const BARROW_PATROL = defineOp({
  id: 'trial-barrow',
  title: 'Barrow-Field Patrol',
  patient: 'A scout of Mauer’s company',
  diagnosis: 'Bitten by a gravehound and a brood-mother on the same night patrol.',
  organ: 'flesh',
  timeLimit: 300,
  tools: ALL,
  ranks: { S: 3000, A: 2400, B: 1800 },
  litany: false,
  seed: 906,
  phases: [
    {
      objective: 'The gravehound',
      callout: ['Fangs first — the hound’s. Then the claw-marks.'],
      spawn: [
        { e: 'elite-fangnest', path: [[-200, -20], [-150, 10], [-100, -30]], angles: [0.9, 1.2, 0.6] },
        { e: 'laceration', at: [-150, 90], angle: 0.2, len: 70, bleed: 0.6 },
      ],
    },
    {
      objective: 'The brood-mother',
      callout: ['Now the spider’s bite: the venom, the sac, the grub.'],
      spawn: [
        { e: 'venom', at: [120, -40], rate: 5 },
        { e: 'eggsac', at: [180, 60], brood: 2, hatchIn: 20 },
        { e: 'grub', at: [60, 60], speed: 30 },
      ],
    },
  ],
});

const BLACK_SEAM = defineOp({
  id: 'trial-seam',
  title: 'Black Seam, Deeper',
  patient: 'A delver from the lowest gallery',
  diagnosis: 'Eight hexshards under the skin, and the spoil spreading half again as fast.',
  organ: 'flesh',
  timeLimit: 320,
  tools: ALL,
  ranks: { S: 3000, A: 2400, B: 1800 },
  litany: true,
  seed: 907,
  baseDrain: 0.08,
  phases: [
    {
      objective: 'The first four',
      callout: ['Lens for the shards, the lead dish for every one. The spoil won’t wait.'],
      spawn: [
        ...([[-220, -40], [-150, 70], [-80, -100], [-10, 40]] as const).map((p, i) => ({ e: 'embedded' as const, at: [p[0], p[1]] as [number, number], kind: 'hexstone' as const, angle: 0.4 * i, barbed: false, hidden: true })),
        { e: 'rot', at: [-110, -30], r: 36, spread: 0.6 },
      ],
    },
    {
      objective: 'Four more',
      callout: ['Four more, deeper. Keep the lens moving.'],
      spawn: [
        ...([[70, -60], [130, 90], [200, -20], [240, 70]] as const).map((p, i) => ({ e: 'embedded' as const, at: [p[0], p[1]] as [number, number], kind: 'hexstone' as const, angle: 1.2 + 0.4 * i, barbed: false, hidden: true })),
        { e: 'rot', at: [150, 20], r: 36, spread: 0.6 },
      ],
    },
  ],
});

// ------------------------------------------------------------------ the ladder

export const TRIALS: readonly Trial[] = [
  // Journeyman — the demo's own ops, remixed (CON-0096: these open with Chapter II).
  { id: 't01', task: 'CON-0097', tier: 'journeyman', title: 'Tuesday Knife-Fights', blurb: 'Four stab wounds bleeding at once, two minutes, and no salve.', rules: {}, op: () => KNIFE_FIGHTS },
  { id: 't02', task: 'CON-0098', tier: 'journeyman', title: 'A Quiver’s Worth', blurb: 'Five barbed arrows, two lost under the skin, and the blood pooling.', rules: {}, op: () => QUIVER },
  { id: 't03', task: 'CON-0204', tier: 'journeyman', title: 'Gilded Goose Closing Time', blurb: 'Six knife wounds and two pools, laid out left for right.', rules: { mirrored: true }, op: () => GILDED_GOOSE },
  { id: 't04', task: 'CON-0205', tier: 'journeyman', title: 'Gunsmiths’ Tuesday', blurb: 'Two burst barrels back to back: eschar, then shot, twice.', rules: { time: 0.9 }, op: () => GUNSMITHS },
  { id: 't05', task: 'CON-0206', tier: 'journeyman', title: 'Tanners’ Rows Fever', blurb: 'Eight buboes and a fast-growing rot, by the light of one candle.', rules: {}, op: () => TANNERS },
  { id: 't06', task: 'CON-0207', tier: 'journeyman', title: 'Barrow-Field Patrol', blurb: 'A gravehound’s fangs and a brood-mother’s bite on one patient.', rules: { drain: 1.1 }, op: () => BARROW_PATROL },
  // Master — the demo Hours returned, and the later chapters' worst days.
  {
    id: 't07',
    task: 'CON-0099',
    tier: 'master',
    title: 'Matins, Unwatched',
    blurb: 'The eye beats half again as fast, and there is no Litany to still it.',
    rules: { noLitany: true },
    op: () => withBoss(OP_1_5, (op) => [new Malison(at(0, 40), op, 'matins', 100, { beat: MATINS_DEFAULT.beat / 1.4, beat3: MATINS_DEFAULT.beat3 / 1.4, rest: MATINS_DEFAULT.rest / 1.4 })]),
  },
  {
    id: 't08',
    task: 'CON-0209',
    tier: 'master',
    title: 'Lauds, Unanswered',
    blurb: 'Answer each Voice within eight-tenths of a second — and no Litany.',
    rules: { noLitany: true },
    op: () => withBoss(OP_2_5, (op) => [new LaudsMalison(at(0, 30), op, { response: 0.8 })]),
  },
  { id: 't09', task: 'CON-0208', tier: 'master', title: 'Black Seam, Deeper', blurb: 'Eight hexshards hidden deep, and the spoil spreading fast.', rules: {}, op: () => BLACK_SEAM },
  {
    id: 't10',
    task: 'CON-0212',
    tier: 'master',
    title: 'Three Worms, One Pie',
    blurb: 'The Pieman’s three worms, and a torn one regrows in five seconds.',
    rules: { time: 0.85 },
    op: (full) => later('pieman', full),
    tune: (e) => {
      if (e instanceof Worm) e.regrow = 5;
    },
  },
  { id: 't11', task: 'CON-0213', tier: 'master', title: 'Crossbow Volley', blurb: 'A bolt by the great artery, in the rain, on a moving cart.', rules: { mutators: ['rain', 'cart'] }, op: (full) => later('gorget', full) },
  {
    id: 't12',
    task: 'BOS-0164',
    tier: 'master',
    title: 'Matins, Unveiled',
    blurb: 'Half again as hard to unmake, its shroud parting faster, the Eye out from the start.',
    rules: { drain: 1.1 },
    op: () => OP_1_5,
    tune: (e) => {
      if (e instanceof Malison) {
        e.veilTime = 3;
        e.openTime = 2;
        e.tune.eyeFromStart = true;
      }
    },
  },
  // Grand Master — the Hours, remixed.
  { id: 't13', task: 'CON-0210', tier: 'grandmaster', title: 'Roll of the Plague Dead', blurb: 'Prime writes five names at once from the first stroke.', rules: {}, op: (full) => withBoss(later('prime', full), (op) => [new PrimeMalison(at(0, 20), op, { ...PRIME_DEFAULT, parallelFromStart: 5, inkWrites: 5 })]) },
  {
    id: 't14',
    task: 'CON-0211',
    tier: 'grandmaster',
    title: 'Guildhall Ablaze',
    blurb: 'Terce leaps between five organs, not three.',
    rules: {},
    op: (full) => withBoss(later('terce', full), (op) => [new TerceMalison(op, TERCE_DEFAULT, [...TERCE_ZONES, at(-80, -110), at(90, 120)])]),
  },
  { id: 't15', task: 'CON-0214', tier: 'grandmaster', title: 'Noonday Demon', blurb: 'The monitors lie from first to last; the lens will not show the truth.', rules: {}, op: (full) => withBoss(later('sext', full), (op) => [new SextMalison(at(30, 30), op, { ...SEXT_DEFAULT, permanentFalse: true })]) },
  {
    id: 't16',
    task: 'CON-0215',
    tier: 'grandmaster',
    title: 'Stone Wedding',
    blurb: 'Two fronts of stone creep in from both hands at once.',
    rules: {},
    op: (full) => {
      const base = later('stoneBride', full);
      if (!base) return null;
      const both: PhaseDef = {
        callout: ['Both hands at once — the stone is coming from either side.'],
        spawn: () => [new PetrifyFront([at(-380, 30), at(-280, 20), at(-160, 0), at(-60, -30), at(-40, -60)], 3, 4), new PetrifyFront([at(380, 30), at(280, 20), at(160, 0), at(60, -30), at(40, -60)], 3, 4)],
      };
      return { ...base, phases: [both, ...base.phases.slice(1)] };
    },
  },
  { id: 't17', task: 'CON-0216', tier: 'grandmaster', title: 'Hollow Choir in Full Voice', blurb: 'The Choir-Throat, with no sound at all — read it by eye alone.', rules: { muted: true }, op: (full) => later('choirThroat', full) },
  {
    id: 't18',
    task: 'CON-0217',
    tier: 'grandmaster',
    title: 'Every Lamp Out',
    blurb: 'Vespers begins with one lamp lit of four.',
    rules: {},
    op: (full) => withBoss(later('vespers', full), (op) => [new VespersMalison(at(0, 0), op, { ...VESPERS_DEFAULT, startLit: 1 })]),
  },
  // The Unsung — the hardest nights.
  { id: 't19', task: 'CON-0218', tier: 'unsung', title: 'Burrower’s Race', blurb: 'None splits five ways, and any piece that reaches the heart ends it.', rules: {}, op: (full) => withBoss(later('none', full), (op) => [new NoneMalison(op, { ...NONE_DEFAULT, segments: 5, segmentsLethal: true })]) },
  { id: 't20', task: 'CON-0219', tier: 'unsung', title: 'Compline, Alone', blurb: 'No voice at your shoulder, no checkpoint behind you.', rules: { silent: true }, op: (full) => later('compline', full) },
  {
    id: 't21',
    task: 'CON-0220',
    tier: 'unsung',
    title: 'Hexstone Harvest',
    blurb: 'Three hexstone balls, and every one to the lead dish.',
    rules: {},
    op: (full) => {
      const base = later('hexstoneShot', full);
      if (!base) return null;
      const more: PhaseDef = {
        callout: ['Two more balls — into the lead dish with them, and quickly.'],
        spawn: () => [new Embedded(at(-160, 60), 'hexstone', 0.4, false), new Embedded(at(170, -40), 'hexstone', 2.6, false)],
      };
      return { ...base, phases: [more, ...base.phases] };
    },
  },
  { id: 't22', task: 'CON-0221', tier: 'unsung', title: 'Office Entire', blurb: 'All eight Hours in one night, the patient’s vitals carried through.', rules: {}, op: (full) => later('rush', full) },
  {
    id: 't23',
    task: 'BOS-0171',
    tier: 'unsung',
    title: 'Compline, Unsilenced',
    blurb: 'No silence-nodes: the Litany stays stolen, and the lancet and brand must strike within 0.4 s.',
    rules: {},
    op: (full) => withBoss(later('compline', full), (op) => [new ComplineMalison(at(0, 0), op, { ...COMPLINE_DEFAULT, noNodes: true, comboWindow: 0.4 })]),
  },
  { id: 't24', task: 'CON-0222', tier: 'unsung', title: 'The Unsung Hour', blurb: 'Every patient you lost, stitched together. They remember you.', rules: {}, op: () => null, secret: 'unsungHeard' },
  // The other disciplines (CON-0248): two each.
  { id: 'd1', task: 'CON-0248', tier: 'disciplines', title: 'Kilnrows by Night', blurb: 'The blast again, with half the time before the carts.', rules: {}, triage: { ...TRIAGE_KILNROWS, id: 'd1', tutorial: undefined, clock: 100 } },
  { id: 'd2', task: 'CON-0248', tier: 'disciplines', title: 'The Ford and the Stair', blurb: 'Both fields at once — the ford’s wounded and Hollow Night’s.', rules: {}, triage: { ...TRIAGE_FORD, id: 'd2', title: 'The Ford and the Stair', clock: 170, cards: [...TRIAGE_FORD.cards.slice(0, 5), ...TRIAGE_HOLLOW.cards.slice(5).map((c) => ({ ...c, id: `x${c.id}` }))] } },
  { id: 'd3', task: 'CON-0248', tier: 'disciplines', title: 'The Founders, Again', blurb: 'The inquiry with every contradiction to find.', rules: {}, interview: { ...INTERVIEW_FOUNDERS, id: 'd3', needed: 6 } },
  { id: 'd4', task: 'CON-0248', tier: 'disciplines', title: 'Liesl, Thoroughly', blurb: 'The late-turned child, with nothing left unexamined before the verdict.', rules: {}, interview: { ...INTERVIEW_LIESL, id: 'd4', needed: 7 } },
  { id: 'd5', task: 'CON-0248', tier: 'disciplines', title: 'A Short Candle', blurb: 'The dead man’s pulse, with half the candle.', rules: {}, interview: { ...FORENSIC_SALM, id: 'd5', candle: 60 } },
  { id: 'd6', task: 'CON-0248', tier: 'disciplines', title: 'The Coachman, Quickly', blurb: 'The coachman in the ditch, and Stroh in a hurry.', rules: {}, interview: { ...FORENSIC_COACHMAN, id: 'd6', candle: 55 } },
  { id: 'd7', task: 'CON-0248', tier: 'disciplines', title: 'Dray-Horse, Twice', blurb: 'The drayman’s shin, in half the time.', rules: { time: 0.5 }, op: () => OP_3_12 },
  { id: 'd8', task: 'CON-0248', tier: 'disciplines', title: 'The Rack, Unlit', blurb: 'The scrivener’s hands, by candle, and one miss ends it.', rules: { oneLife: true }, op: (full) => (full ? OP_5_10 : null) },
];

export const trial = (id: string): Trial | undefined => TRIALS.find((x) => x.id === id);

// ------------------------------------------------------------------ the rules layer

/** Mirror a data operation left for right (every point's x, every angle about the vertical). */
export function mirrorOp(def: OperationDef): OperationDef {
  const data = opData(def);
  if (!data) return def;
  const flip = (v: unknown, key: string): unknown => {
    if (Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number') && key !== 'angles') return [-(v[0] as number), v[1]];
    if (Array.isArray(v)) return v.map((x) => flip(x, key === 'angles' ? 'angle' : key));
    if (typeof v === 'number' && key === 'angle') return Math.PI - v;
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, flip(x, k)]));
    return v;
  };
  const phases = data.phases.map((p) => ({ ...p, spawn: p.spawn ? (p.spawn as unknown[]).map((s) => flip(s, '')) : p.spawn }));
  return defineOp({ ...(data as OperationData), phases } as OperationData);
}

/** The op and options a trial plays with its rules applied. */
export function trialRun(x: Trial, extra: OperationOptions = {}, lost: readonly string[] = [], full = EDITION === 'full'): { def: OperationDef; opts: OperationOptions } | null {
  let def = x.id === 't24' ? (full ? unsungHour(lost) : null) : (x.op?.(full) ?? null);
  if (!def) return null;
  const r = x.rules;
  if (r.mirrored) def = mirrorOp(def);
  const tools = def.tools.filter((t) => !(r.noLens && t === 'lens') && !(r.noSalve && t === 'salve'));
  const tune = x.tune;
  const phases = tune ? def.phases.map((p) => ({ ...p, spawn: (op: Parameters<PhaseDef['spawn']>[0]) => p.spawn(op).map((e) => (tune(e), e)) })) : def.phases;
  def = {
    ...def,
    id: `${def.id}-${x.id}`,
    title: x.title,
    tools,
    phases,
    timeLimit: Math.round(def.timeLimit * (r.time ?? 1)),
    litany: r.noLitany ? false : def.litany,
    ...(r.mutators ? { env: [...(def.env ?? []), ...r.mutators] } : {}),
  };
  const opts: OperationOptions = {
    ...extra,
    challenge: x.id,
    difficulty: x.tier === 'journeyman' || x.tier === 'disciplines' ? 'surgeon' : 'master',
    mods: { drain: r.drain ?? 1 },
    assists: {},
    upgrades: [],
    checkpoint: undefined,
    oneLife: r.oneLife,
    silentAssistant: r.silent,
    muted: r.muted,
  };
  return { def, opts };
}

// ------------------------------------------------------------------ the Unsung Hour (CON-0222)

/**
 * Every patient the player lost, stitched together: one verse of the Symptom Loom for each
 * operation lost in the campaign (by its kind of wound), and a curated night when none was.
 */
export function unsungHour(lost: readonly string[]): OperationDef {
  const byKind = (id: string): number => {
    let h = 0;
    for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return h % LOOM_MODULES.length;
  };
  const curated = ['brawl', 'hexstone', 'brood', 'curse', 'troll'];
  const verses = lost.length ? [...new Set(lost.map(byKind))].slice(0, 6).map((i) => LOOM_MODULES[i]) : curated.map((id) => LOOM_MODULES.find((m) => m.id === id)!);
  return {
    id: 'unsung',
    title: 'The Unsung Hour',
    patient: lost.length ? 'Everyone you could not keep' : 'The ones nobody kept',
    diagnosis: 'Remnants of the lost, stitched into one body. They remember the table.',
    organ: 'flesh',
    timeLimit: 120 + verses.length * 60,
    baseDrain: 0.12,
    tools: ALL,
    ranks: { S: 3000, A: 2400, B: 1800 },
    seed: 2424,
    litany: true,
    noClose: true,
    phases: verses.map((v) => ({ callout: [v.callout], spawn: (op) => v.spawn(op, at(0, 20)) })),
  };
}

// ------------------------------------------------------------------ unlocks and medals

export type Medal = 'bronze' | 'silver' | 'gold' | 'saint';
export const MEDAL_OF: Record<Rank, Medal | null> = { C: null, B: 'bronze', A: 'silver', S: 'gold', XS: 'saint' };
const RANK_ORDER: readonly Rank[] = ['C', 'B', 'A', 'S', 'XS'];

/** A trial's best medal on this save. */
export function medalFor(p: Progress, id: string): Medal | null {
  const b = p.xBest[id];
  return b ? MEDAL_OF[b.rank] : null;
}

/** Trials needed at S or better to open the next tier. */
export const TIER_UNLOCK = 3;

/** Is this tier open? Journeyman opens with Chapter II; each next with three S-ranks below it. */
export function tierOpen(p: Progress, tier: TrialTier): boolean {
  if (p.chaptersCleared < 2) return false;
  if (tier === 'journeyman' || tier === 'disciplines') return tier === 'journeyman' || p.chaptersCleared >= 3;
  const below = TRIAL_TIERS[TRIAL_TIERS.indexOf(tier) - 1];
  const s = TRIALS.filter((x) => x.tier === below).filter((x) => {
    const b = p.xBest[x.id];
    return b && RANK_ORDER.indexOf(b.rank) >= RANK_ORDER.indexOf('S');
  }).length;
  return s >= TIER_UNLOCK && tierOpen(p, below);
}

/** Can this trial be played on this save (its tier open, its chapter in this edition, its secret known)? */
export function trialOpen(p: Progress, x: Trial, flags: { truthy(k: string): boolean }): boolean {
  if (!tierOpen(p, x.tier)) return false;
  if (x.secret && !flags.truthy(x.secret)) return false;
  if (x.triage || x.interview) return true;
  return x.id === 't24' ? EDITION === 'full' : !!x.op?.(EDITION === 'full');
}

/** The medal the next rank up earns, and the score it needs (for the results card, UIX-0189). */
export function nextMedal(rank: Rank, ranks: { S: number; A: number; B: number }): { medal: Medal; need: number } | null {
  const order: [Rank, Medal, number][] = [
    ['B', 'bronze', ranks.B],
    ['A', 'silver', ranks.A],
    ['S', 'gold', ranks.S],
    ['XS', 'saint', Math.round(ranks.S * 1.05)],
  ];
  const next = order.find(([r]) => RANK_ORDER.indexOf(r) > RANK_ORDER.indexOf(rank));
  return next ? { medal: next[1], need: next[2] } : null;
}
