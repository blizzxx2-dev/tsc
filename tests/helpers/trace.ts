/**
 * Characterisation harness (QAT-0032). Instruments an `Operation` instance (never the source)
 * and records an event trace: ratings with labels, hurts ≥ 1, spawns, callouts and flags, popups
 * and cues, plus explicit checkpoints. Traces are compared with committed snapshots; the GAM tuning
 * extraction and the sim/draw split must leave them identical unless the PR carries the
 * `behaviour-change` label (enforced by .github/workflows/behaviour-change.yml).
 */
import type { Entity } from '../../src/surgery/entity';
import type { Operation } from '../../src/surgery/operation';
import { isolate } from './sim';
import { Probe } from './probe';
import type { OperationDef } from '../../src/surgery/operation';

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
const xy = (p: { x: number; y: number }) => `(${Math.round(p.x)},${Math.round(p.y)})`;

/** The properties worth pinning for each spawned entity, keyed by what exists on it. */
function describeEntity(e: Entity): string {
  const o = e as unknown as Record<string, unknown>;
  const bits: string[] = [e.constructor.name];
  for (const k of ['kind', 'ichor', 'source', 'hour']) if (typeof o[k] === 'string') bits.push(`${k}=${o[k] as string}`);
  for (const k of ['length', 'bleed', 'r', 'radius', 'hp', 'brood', 'speed']) if (typeof o[k] === 'number') bits.push(`${k}=${r1(o[k] as number)}`);
  if (o.barbed === true) bits.push('barbed');
  if (e.hidden) bits.push('hidden');
  if (!e.required) bits.push('optional');
  bits.push(`@${xy(e.pos)}`);
  return bits.join(' ');
}

export interface Trace {
  readonly lines: string[];
  /** Add a checkpoint line with the op's headline state and any extra values. */
  note(label: string, extra?: Record<string, unknown>): void;
  text(): string;
}

export function traceOp(op: Operation): Trace {
  const lines: string[] = [];
  const t = () => r2(op.elapsed).toFixed(2);
  const log = (s: string) => lines.push(`${t()} ${s}`);

  const rate = op.rate.bind(op);
  op.rate = (r, pos, label) => {
    const before = op.score;
    rate(r, pos, label);
    log(`rate ${r.toUpperCase()}${label ? ` "${label}"` : ''} +${op.score - before} combo=${op.combo}`);
  };
  const hurt = op.hurt.bind(op);
  op.hurt = (amount, pos) => {
    if (amount >= 1 && op.status === 'running') log(`hurt ${r1(amount)}`);
    hurt(amount, pos);
  };
  const spawn = op.spawn.bind(op);
  op.spawn = (...es) => {
    for (const e of es) log(`spawn ${describeEntity(e)}`);
    spawn(...es);
  };
  const say = op.say.bind(op);
  op.say = (...ls) => {
    for (const l of ls) log(`say "${l}"`);
    say(...ls);
  };
  const sayOnce = op.sayOnce.bind(op);
  op.sayOnce = (flag, line) => {
    if (!op.flags.has(flag)) log(`flag ${flag}`);
    sayOnce(flag, line);
  };
  const popup = op.popup.bind(op);
  op.popup = (text, pos, color) => {
    log(`popup "${text}"`);
    popup(text, pos, color);
  };
  const lose = op.lose.bind(op);
  op.lose = (reason) => {
    log(`lose "${reason}"`);
    lose(reason);
  };
  const cues = op.cues;
  const push = cues.push.bind(cues);
  cues.push = (...cs) => {
    // Rating cues are implied by the rate line; keep the rest (cut, squelch, burn, inject…).
    const extra = cs.filter((c) => !['cool', 'good', 'bad', 'miss', 'select'].includes(c));
    if (extra.length) log(`cue ${extra.join(',')}`);
    return push(...cs);
  };

  return {
    lines,
    note(label, extra = {}) {
      const liveKinds = op.entities.filter((e) => e.alive && !(e instanceof Probe)).map((e) => e.constructor.name);
      const kv = Object.entries(extra)
        .map(([k, v]) => `${k}=${typeof v === 'number' ? r2(v) : JSON.stringify(v)}`)
        .join(' ');
      lines.push(
        `${t()} -- ${label}: status=${op.status} vitals=${r1(op.vitals)} score=${op.score} combo=${op.combo} counts=${op.counts.cool}/${op.counts.good}/${op.counts.bad}/${op.counts.miss} live=[${liveKinds.join(',')}]${kv ? ' ' + kv : ''}`,
      );
    },
    text: () => lines.join('\n') + '\n',
  };
}

/**
 * An isolated op for one characterisation scenario: the entities under test plus an inert,
 * required anchor far from them (so the phase never ends mid-scenario), traced from the first frame.
 */
export function scenario<T extends Entity>(spawn: (op: Operation) => T[], overrides: Partial<OperationDef> = {}) {
  const { op, ents } = isolate((o) => [...spawn(o), new Probe({ x: 1060, y: 410 }) as unknown as T], overrides);
  const trace = traceOp(op);
  const subjects = ents.slice(0, -1) as T[];
  for (const e of subjects) trace.lines.push(`${op.elapsed.toFixed(2)} initial ${describeEntity(e)}`);
  return { op, ents: subjects, trace };
}
