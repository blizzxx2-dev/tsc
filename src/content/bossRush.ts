/**
 * Boss Rush (BOS-0178): all eight Hours back to back in one operation, so the patient's vitals carry
 * from one to the next, with a single Litany for the whole night. Each Hour keeps every phase but
 * comes at reduced strength. Unlocked once the story is finished.
 */
import type { Vec } from '../core/math';
import { ComplineMalison, COMPLINE_DEFAULT } from '../surgery/bosses/compline';
import { NoneMalison, NONE_DEFAULT } from '../surgery/bosses/none';
import { PrimeMalison, PRIME_DEFAULT } from '../surgery/bosses/prime';
import { SextMalison, SEXT_DEFAULT } from '../surgery/bosses/sext';
import { TerceMalison, TERCE_DEFAULT } from '../surgery/bosses/terce';
import { VespersMalison, VESPERS_DEFAULT } from '../surgery/bosses/vespers';
import { LaudsMalison } from '../surgery/lauds';
import { Malison } from '../surgery/malison';
import { FIELD, type Operation, type OperationDef } from '../surgery/operation';
import type { Progress } from '../surgery/progress';

const at = (dx: number, dy: number): Vec => ({ x: FIELD.cx + dx, y: FIELD.cy + dy });
const ALL = ['lancet', 'tongs', 'leech', 'thread', 'salve', 'tincture', 'brand', 'lens'] as const;

/** Each Hour's strength in the rush (its full phases, less to cut through). */
export const RUSH_HP = 50;

/** The eight Hours in canonical order, as the rush sings them. */
export const RUSH_ORDER = ['matins', 'lauds', 'prime', 'terce', 'sext', 'none', 'vespers', 'compline'] as const;

export const BOSS_RUSH: OperationDef = {
  id: 'bossrush',
  title: 'The Eight Hours',
  patient: 'The Hospice’s last patient of the night',
  diagnosis: 'Every Hour of the Office, one after another, in one body. Keep him alive until dawn.',
  organ: 'flesh',
  timeLimit: 2400,
  baseDrain: 0.05,
  tools: ALL,
  // Calibrated on the expert bot (the rush is a post-game challenge): S = 96 % of its clear.
  ranks: { S: 28640, A: 22910, B: 17180 },
  litany: true,
  litanyUses: 1,
  seed: 88,
  phases: [
    { callout: ['Matins first — the Night Vigil. One Litany for the whole night, Doctor. Spend it well.'], spawn: (op: Operation) => [new Malison(at(0, 0), op, 'matins', RUSH_HP)] },
    { callout: ['Lauds — the choir. Silence the Voices.'], spawn: (op: Operation) => [new LaudsMalison(at(0, 30), op, { hp: RUSH_HP })] },
    { callout: ['Prime — the names. Newest ink first.'], spawn: (op: Operation) => [new PrimeMalison(at(0, 20), op, { ...PRIME_DEFAULT, hp: RUSH_HP })] },
    { callout: ['Terce — the fire. Salve, never the brand.'], spawn: (op: Operation) => [new TerceMalison(op, { ...TERCE_DEFAULT, hp: RUSH_HP })] },
    { callout: ['Sext — the noon torpor. Tincture when your hands slow.'], spawn: (op: Operation) => [new SextMalison(at(30, 30), op, { ...SEXT_DEFAULT, hp: RUSH_HP })] },
    { callout: ['None — the burrower. Keep it from his heart.'], spawn: (op: Operation) => [new NoneMalison(op, { ...NONE_DEFAULT, hp: RUSH_HP })] },
    { callout: ['Vespers — the lamps. Keep them lit.'], spawn: (op: Operation) => [new VespersMalison(at(0, 0), op, { ...VESPERS_DEFAULT, hp: RUSH_HP })] },
    { callout: ['Compline — the last. Don’t let him go quietly.'], spawn: (op: Operation) => [new ComplineMalison(at(0, 0), op, { ...COMPLINE_DEFAULT, hp: RUSH_HP })] },
  ],
};

/** The rush opens once the story is finished. */
export const bossRushUnlocked = (p: Progress): boolean => p.chaptersCleared >= 5;
