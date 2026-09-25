/**
 * Pure, DOM-free snapshots of an operation for automation (the debug API, E2E mirrors and
 * runtime-parity checks). Shared by the browser build and Node tests so both describe and hash
 * the simulation identically.
 */
import type { Vec } from '../core/math';
import { BloodPool, Bubo, Burn, Embedded, Grub, Incision, Laceration, Rot, Sigil, Venom } from '../surgery/entities';
import type { Entity } from '../surgery/entity';
import { ChoirVoice, EggSac, LaudsMalison, SpiderlingGrub } from '../surgery/lauds';
import { Malison, MalisonShard } from '../surgery/malison';
import type { Operation } from '../surgery/operation';
import { kindOf } from '../telemetry/kinds';

export interface EntityView {
  kind: string;
  x: number;
  y: number;
  hidden: boolean;
  required: boolean;
  layer: number;
  [extra: string]: unknown;
}

export interface OpView {
  id: string;
  title: string;
  status: Operation['status'];
  phase: number;
  phaseCount: number;
  vitals: number;
  timeLeft: number;
  elapsed: number;
  score: number;
  combo: number;
  maxCombo: number;
  counts: Operation['counts'];
  tool: string;
  tools: string[];
  rank: string;
  litanyUsed: boolean;
  litanyTime: number;
  lostReason: string;
  injectCooldown: number;
  flags: string[];
  callout: string | null;
  entities: EntityView[];
}

const pt = (v: Vec) => ({ x: v.x, y: v.y });

function extras(e: Entity): Record<string, unknown> {
  if (e instanceof Incision)
    return { state: e.state, points: e.points.map(pt), progress: e.progress, stitches: e.stitch ? { count: e.stitch.count, needed: e.stitch.needed } : null };
  if (e instanceof Laceration)
    return { a: pt(e.a), b: pt(e.b), length: e.length, small: e.small, stitches: { count: e.stitch.count, needed: e.stitch.needed } };
  if (e instanceof BloodPool) return { r: e.r, ichor: e.ichor };
  if (e instanceof Embedded)
    return { type: e.kind, origin: pt(e.origin), handle: pt(e.handle), barbed: e.barbed, nicks: e.nicks, grabbed: e.grabbed, len: e.spec.len };
  if (e instanceof Burn) return { radius: e.radius, source: e.source, flakes: e.flakes.map(pt), healed: e.cov.fraction };
  if (e instanceof Bubo) return { r: e.r, maxR: e.maxR, lanced: e.lanced, healed: e.cov.fraction };
  if (e instanceof Rot) return { r: e.r, healed: e.cov.fraction };
  if (e instanceof Venom) return { spread: e.spreadR };
  if (e instanceof Grub || e instanceof SpiderlingGrub) return { heat: e.heat };
  if (e instanceof Sigil) return { size: e.size, progress: e.progress, segs: e.segs.map((s) => ({ a: pt(s.a), b: pt(s.b) })) };
  if (e instanceof Malison) return { hp: e.hp, open: e.open, radius: e.radius };
  if (e instanceof MalisonShard) return {};
  if (e instanceof LaudsMalison) return { hp: e.hp, submerged: e.submerged, voices: e.livingVoices.length, radius: e.radius };
  if (e instanceof ChoirVoice) return { silence: e.silence };
  if (e instanceof EggSac) return { brood: e.brood };
  return {};
}

export function entityView(e: Entity): EntityView {
  return { kind: kindOf(e), x: e.pos.x, y: e.pos.y, hidden: e.hidden, required: e.required, layer: e.layer, ...extras(e) };
}

export function opView(op: Operation): OpView {
  return {
    id: op.def.id,
    title: op.def.title,
    status: op.status,
    phase: op.phase,
    phaseCount: op.phaseCount,
    vitals: op.vitals,
    timeLeft: op.timeLeft,
    elapsed: op.elapsed,
    score: op.score,
    combo: op.combo,
    maxCombo: op.maxCombo,
    counts: { ...op.counts },
    tool: op.tool,
    tools: [...op.def.tools],
    rank: op.rank(),
    litanyUsed: op.litanyUsed,
    litanyTime: op.litanyTime,
    lostReason: op.lostReason,
    injectCooldown: op.injectCooldown,
    flags: [...op.flags].sort(),
    callout: op.callouts[0] ?? null,
    entities: op.entities.filter((e) => e.alive).map(entityView),
  };
}

/**
 * Canonical simulation state string: every value that decides the outcome, at full precision.
 * Identical inputs in Node, Chromium and the desktop build must give identical strings.
 */
export function canonicalState(op: Operation): string {
  const ents = op.entities.filter((e) => e.alive).map((e) => [kindOf(e), e.pos.x, e.pos.y, e.hidden, e.required, extras(e)]);
  return JSON.stringify([
    op.status,
    op.phase,
    op.vitals,
    op.timeLeft,
    op.elapsed,
    op.score,
    op.combo,
    op.maxCombo,
    op.counts,
    op.tool,
    op.litanyTime,
    op.injectCooldown,
    ents,
  ]);
}

/** 32-bit FNV-1a of the canonical state, as 8 hex digits. */
export function stateHash(op: Operation): string {
  const s = canonicalState(op);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
