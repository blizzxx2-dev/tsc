import { dist, type Vec } from '../core/math';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { Fracture } from './ailments/fracture';
import type { Operation } from './operation';
import type { Pointer, ToolId } from './types';

/**
 * Cores for the other "disciplines" (Trauma Team-style modes). Each is pure
 * logic the scenes drive; none uses vitals except triage's micro-ops.
 */

// ====================================================================== diagnosis

export interface Finding {
  id: string;
  pos: Vec;
  /** How the finding is noticed: lingering the lens, or a palpating press. */
  via: 'lens' | 'palpate';
  text: string;
}

export interface DiagnosisOption {
  id: string;
  name: string;
}

/**
 * A still patient: collect findings with the lens (hover) or palpation (press),
 * then choose the ailment from four options. A wrong answer costs time in the
 * next operation.
 */
export class DiagnosisCase {
  found = new Set<string>();
  answered: string | null = null;
  private dwell = new Map<string, number>();

  constructor(
    readonly findings: readonly Finding[],
    readonly options: readonly DiagnosisOption[],
    readonly answer: string,
    readonly wrongPenalty = 20,
  ) {
    if (options.length !== 4) throw new Error('a diagnosis offers exactly four options');
    if (!options.some((o) => o.id === answer)) throw new Error('the answer must be one of the options');
  }

  /** Lens hover for dt seconds at p (0.4 s reveals), or a palpating press. */
  examine(p: Vec, how: 'lens' | 'palpate', dt = 0): Finding | null {
    for (const f of this.findings) {
      if (this.found.has(f.id) || f.via !== how || dist(f.pos, p) > 30) continue;
      if (how === 'lens') {
        const t = (this.dwell.get(f.id) ?? 0) + dt;
        this.dwell.set(f.id, t);
        if (t < 0.4) continue;
      }
      this.found.add(f.id);
      return f;
    }
    return null;
  }

  /** Commit an answer: returns the seconds the next operation loses (0 when right). */
  choose(optionId: string): number {
    if (this.answered) throw new Error('already answered');
    this.answered = optionId;
    return optionId === this.answer ? 0 : this.wrongPenalty;
  }

  get correct(): boolean {
    return this.answered === this.answer;
  }
}

// ====================================================================== forensic / inquisition

export interface Evidence {
  id: string;
  pos: Vec;
  /** The tag an inquisitor should give it. */
  tag: string;
}

/**
 * Examine a corpse against the clock: tag evidence points, then present a
 * verdict to Inquisitor Stroh. No vitals; a timer and a ledger.
 */
export class ForensicCase {
  tags = new Map<string, string>();
  timeLeft: number;
  verdict: string | null = null;

  constructor(
    readonly evidence: readonly Evidence[],
    readonly truth: string,
    timeLimit = 120,
  ) {
    this.timeLeft = timeLimit;
  }

  tick(dt: number): void {
    this.timeLeft = Math.max(0, this.timeLeft - dt);
  }

  get expired(): boolean {
    return this.timeLeft <= 0;
  }

  /** Tag the evidence at p. Returns whether the tag is the right one (null if nothing there). */
  tag(p: Vec, tag: string): boolean | null {
    if (this.expired) return null;
    const e = this.evidence.find((x) => dist(x.pos, p) < 24);
    if (!e) return null;
    this.tags.set(e.id, tag);
    return e.tag === tag;
  }

  present(verdict: string): { correct: boolean; score: number } {
    this.verdict = verdict;
    const right = this.evidence.filter((e) => this.tags.get(e.id) === e.tag).length;
    const wrong = [...this.tags.entries()].filter(([id, t]) => this.evidence.find((e) => e.id === id)?.tag !== t).length;
    const correct = verdict === this.truth;
    return { correct, score: Math.max(0, right * 150 - wrong * 75 + (correct ? 600 : 0) + Math.round(this.timeLeft) * 5) };
  }
}

// ====================================================================== field triage

export type Priority = 'immediate' | 'urgent' | 'delayed';
const PRIORITY_RANK: Record<Priority, number> = { immediate: 0, urgent: 1, delayed: 2 };

export interface TriagePatient {
  id: string;
  /** The true priority. */
  truth: Priority;
  /** Seconds of the shared clock the micro-op may take at most. */
  microOp: number;
}

/**
 * Field triage: 3–5 patients. Tag each with a priority, then treat them in
 * tag order in 30 s micro-operations against one shared clock.
 */
export class TriageSession {
  tags = new Map<string, Priority>();
  clock: number;
  treated: string[] = [];

  constructor(
    readonly patients: readonly TriagePatient[],
    sharedTime = 150,
  ) {
    if (patients.length < 3 || patients.length > 5) throw new Error('triage is for three to five patients');
    this.clock = sharedTime;
  }

  tagPatient(id: string, p: Priority): void {
    this.tags.set(id, p);
  }

  get allTagged(): boolean {
    return this.patients.every((p) => this.tags.has(p.id));
  }

  /** Treatment order by tag (ties keep arrival order). */
  order(): TriagePatient[] {
    return [...this.patients].sort((a, b) => PRIORITY_RANK[this.tags.get(a.id) ?? 'delayed'] - PRIORITY_RANK[this.tags.get(b.id) ?? 'delayed']);
  }

  /** Time the next micro-op may take (30 s, or whatever is left of the shared clock). */
  nextBudget(): number {
    const next = this.order().find((p) => !this.treated.includes(p.id));
    return next ? Math.min(next.microOp, this.clock) : 0;
  }

  /** A micro-op finished having used `used` seconds. */
  finish(id: string, used: number): void {
    this.treated.push(id);
    this.clock = Math.max(0, this.clock - used);
  }

  /** Triage accuracy: 1 per correct tag, minus 1 for each immediate patient tagged delayed. */
  accuracy(): number {
    let s = 0;
    for (const p of this.patients) {
      const t = this.tags.get(p.id);
      if (t === p.truth) s++;
      if (p.truth === 'immediate' && t === 'delayed') s--;
    }
    return s;
  }
}

// ====================================================================== closed bone-setting

export const TRACTION = { build: 1, decay: 0.25, needed: 0.5, reach: 26 };

/**
 * Bone-setting without an incision: the fragments move only while traction is
 * applied — hold the tongs on the traction point (the limb's end) to fill the
 * traction meter, then set the fragments before it slackens.
 */
export class ClosedReduction extends Fracture {
  traction = 0;
  private pulling = false;

  constructor(
    pos: Vec,
    op: Operation,
    public tractionPoint: Vec,
    axis = 0,
    count = 2,
  ) {
    super(pos, op, axis, count, false);
    this.noun = 'the limb';
  }

  override update(op: Operation, dt: number): void {
    super.update(op, dt);
    if (this.pulling) this.traction = Math.min(1, this.traction + TRACTION.build * dt);
    else this.traction = Math.max(0, this.traction - TRACTION.decay * dt);
    this.pulling = false;
  }

  override wants(): readonly ToolId[] {
    return ['tongs'];
  }

  override onSweep(op: Operation, ptr: Pointer, tool: ToolId): void {
    if (tool === 'tongs' && dist(ptr.pos, this.tractionPoint) < TRACTION.reach + op.hitPad) this.pulling = true;
  }

  override onPress(op: Operation, ptr: Pointer, tool: ToolId): boolean {
    if (tool === 'tongs' && dist(ptr.pos, this.tractionPoint) < TRACTION.reach + op.hitPad) return false; // traction is a sweep
    if (tool === 'tongs' && this.traction < TRACTION.needed) {
      op.sayOnce('traction', 'Pull on the limb first — traction, or the ends grind.');
      return false;
    }
    return super.onPress(op, ptr, tool);
  }

  override draw(g: Gfx, op: Operation): void {
    super.draw(g, op);
    g.circle(this.tractionPoint.x, this.tractionPoint.y, 12, hex('#c8a060', 0.8));
    g.arc(this.tractionPoint.x, this.tractionPoint.y, 18, 3, hex(this.traction >= TRACTION.needed ? '#9fd3a8' : '#f0c060'), this.traction);
  }
}
