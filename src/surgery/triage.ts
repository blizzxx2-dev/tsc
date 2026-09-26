/**
 * Field triage (CON-0226, CON-0227): the stretchers come in faster than one surgeon can work. Each
 * patient arrives with visible wounds and signs, and a life clock running down; the Doctor tags each
 * (Immediate / Delayed / Walking / Beyond Help) and does what short work the wounds allow — a
 * tourniquet, a pack, a splint — one at a time, each taking the hands for a few seconds.
 *
 * Pure and seeded; the scene draws it. Scored by lives saved and tags right.
 */
import type { Rank } from './types';

export type TriageTag = 'immediate' | 'delayed' | 'walking' | 'beyond';
export type FieldProcedure = 'tourniquet' | 'pack' | 'splint';

export const TRIAGE_TAGS: readonly TriageTag[] = ['immediate', 'delayed', 'walking', 'beyond'];
export const FIELD_PROCEDURES: readonly FieldProcedure[] = ['tourniquet', 'pack', 'splint'];

/** Seconds of the surgeon's hands each procedure takes, and life seconds a procedure that fits buys. */
export const TRIAGE = {
  cost: { tourniquet: 3, pack: 5, splint: 6 } as Record<FieldProcedure, number>,
  /** A wrong procedure still takes the hands this long. */
  fumble: 3,
  /** Below this fraction of its life a patient is failing (the card pulses). */
  failing: 0.3,
  points: { saved: 300, tag: 100, wrongBeyond: -200, time: 2 },
};

/** A patient card (CON-0228): what the Doctor can see, and the truth behind it. */
export interface TriageCard {
  id: string;
  name: string;
  /** What is visible on the stretcher. */
  wounds: string;
  /** Breathing, pulse, colour: the signs to read the tag from. */
  signs: string;
  /** The right tag. */
  truth: TriageTag;
  /** Seconds left untreated. Walking and delayed patients outlast the field; the beyond-help do not. */
  life: number;
  /** The procedures that stabilise this patient, in any order (immediate patients). */
  needs?: readonly FieldProcedure[];
  /** Seconds into the scenario the stretcher arrives (0: at the start). */
  arrives?: number;
  /** The last-rites vignette when tagged Beyond Help (CON-0229): two lines. */
  rites?: readonly [string, string];
}

export interface TriageScenario {
  id: string;
  title: string;
  place: string;
  intro: string;
  /** Seconds the field is worked before the wagons take whoever is left. */
  clock: number;
  cards: readonly TriageCard[];
  /** Teaching prompts shown in order as the scenario opens (CON-0230). */
  tutorial?: readonly string[];
}

export type PatientState = 'waiting' | 'stable' | 'dead';

export interface TriagePatientState {
  card: TriageCard;
  life: number;
  tag: TriageTag | null;
  done: FieldProcedure[];
  state: PatientState;
  arrived: boolean;
}

export interface TriageOutcome {
  saved: number;
  savable: number;
  lost: string[];
  tagsRight: number;
  /** Patients tagged wrongly, with the tag given and the right one (shown in results, CON-0229). */
  wrongTags: { id: string; name: string; given: TriageTag | null; truth: TriageTag }[];
  score: number;
  rank: Rank;
}

export class TriageField {
  readonly patients: TriagePatientState[];
  clock: number;
  /** The procedure in hand: who, what and how long is left. */
  busy: { id: string; proc: FieldProcedure; left: number; fits: boolean } | null = null;
  /** The transcript: what was done and said, newest last. */
  readonly log: string[] = [];
  outcome: TriageOutcome | null = null;
  private elapsed = 0;

  constructor(readonly scenario: TriageScenario) {
    this.clock = scenario.clock;
    this.patients = scenario.cards.map((card) => ({ card, life: card.life, tag: null, done: [], state: 'waiting', arrived: (card.arrives ?? 0) <= 0 }));
    this.log.push(scenario.intro);
  }

  get(id: string): TriagePatientState | undefined {
    return this.patients.find((p) => p.card.id === id);
  }

  /** Patients on the ground now. */
  present(): TriagePatientState[] {
    return this.patients.filter((p) => p.arrived);
  }

  get finished(): boolean {
    return this.outcome !== null;
  }

  /** Every arrival in and seen to: nothing more the hands can change. */
  get settled(): boolean {
    return (
      this.patients.every((p) => p.arrived) &&
      !this.busy &&
      this.patients.every((p) => p.state !== 'waiting' || (p.tag !== null && (p.card.truth !== 'immediate' || p.tag === 'beyond')))
    );
  }

  tick(dt: number): void {
    if (this.outcome) return;
    this.elapsed += dt;
    this.clock = Math.max(0, this.clock - dt);
    for (const p of this.patients) {
      if (!p.arrived && this.elapsed >= (p.card.arrives ?? 0)) {
        p.arrived = true;
        this.log.push(`A stretcher: ${p.card.name}.`);
      }
      if (!p.arrived || p.state !== 'waiting') continue;
      if (this.busy?.id === p.card.id) continue; // under the Doctor's hands, the clock holds
      p.life -= dt;
      if (p.life <= 0) {
        p.life = 0;
        p.state = 'dead';
        this.log.push(`${p.card.name} is gone.`);
      }
    }
    if (this.busy) {
      this.busy.left -= dt;
      if (this.busy.left <= 0) this.complete();
    }
    if (this.clock <= 0) this.end();
  }

  tag(id: string, tag: TriageTag): readonly [string, string] | null {
    const p = this.get(id);
    if (!p || !p.arrived || this.outcome || p.state === 'dead') return null;
    p.tag = tag;
    if (tag !== 'beyond') return null;
    const rites = p.card.rites ?? ([`The Doctor kneels by ${p.card.name} a moment, and says the words.`, 'Then he stands, and goes to the next.'] as const);
    this.log.push(...rites);
    return rites;
  }

  /** Begin a procedure; false when the hands are busy or the patient is past it or tagged away. */
  treat(id: string, proc: FieldProcedure): boolean {
    const p = this.get(id);
    if (!p || !p.arrived || this.outcome || this.busy || p.state !== 'waiting' || p.tag === 'beyond') return false;
    const needs = p.card.needs ?? [];
    const fits = needs.includes(proc) && !p.done.includes(proc);
    this.busy = { id, proc, left: fits ? TRIAGE.cost[proc] : TRIAGE.fumble, fits };
    return true;
  }

  private complete(): void {
    const b = this.busy!;
    this.busy = null;
    const p = this.get(b.id)!;
    if (p.state !== 'waiting') return;
    if (!b.fits) {
      this.log.push(p.card.truth === 'beyond' ? `Nothing will hold. ${p.card.name} is past it.` : `The ${b.proc} does nothing for ${p.card.name}.`);
      return;
    }
    p.done.push(b.proc);
    this.log.push(`${p.card.name}: ${b.proc} on.`);
    if ((p.card.needs ?? []).every((n) => p.done.includes(n))) {
      p.state = 'stable';
      this.log.push(`${p.card.name} will last the wagon.`);
    }
  }

  /** The wagons come: whoever is still waiting on work they needed does not last the road. */
  end(): TriageOutcome {
    if (this.outcome) return this.outcome;
    this.busy = null;
    for (const p of this.patients) {
      if (p.state !== 'waiting') continue;
      p.state = p.card.truth === 'immediate' || p.card.truth === 'beyond' ? 'dead' : 'stable';
    }
    const savable = this.patients.filter((p) => p.card.truth !== 'beyond');
    const saved = savable.filter((p) => p.state === 'stable').length;
    const wrongTags = this.patients.filter((p) => p.tag !== p.card.truth).map((p) => ({ id: p.card.id, name: p.card.name, given: p.tag, truth: p.card.truth }));
    const tagsRight = this.patients.length - wrongTags.length;
    const wrongBeyond = this.patients.filter((p) => p.tag === 'beyond' && p.card.truth !== 'beyond').length;
    const P = TRIAGE.points;
    const score = Math.max(0, saved * P.saved + tagsRight * P.tag + wrongBeyond * P.wrongBeyond + Math.round(this.clock) * P.time);
    const frac = savable.length ? saved / savable.length : 1;
    const tagFrac = this.patients.length ? tagsRight / this.patients.length : 1;
    const rank: Rank = frac >= 1 && tagFrac >= 1 ? 'XS' : frac >= 0.9 && tagFrac >= 0.8 ? 'S' : frac >= 0.75 ? 'A' : frac >= 0.5 ? 'B' : 'C';
    const lost = savable.filter((p) => p.state === 'dead').map((p) => p.card.name);
    this.outcome = { saved, savable: savable.length, lost, tagsRight, wrongTags, score, rank };
    return this.outcome;
  }
}
