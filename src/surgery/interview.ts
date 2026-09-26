/**
 * Interview mode (CON-0231, CON-0232): examine the subject, ask from a topic list, present evidence
 * against what was said, and choose a conclusion. Pure and data-driven; the scene draws it and the
 * campaign reads the result's flags. No vitals, no clock: an interview is scored on what it found.
 */
import type { FlagRecord } from '../core/save/schema';
import type { Rank } from './types';

/** A place on the subject to examine (a body region, a document, a scar). */
export interface InterviewRegion {
  id: string;
  label: string;
  /** Position on the subject figure, 0..1 of its box. */
  at: readonly [number, number];
  /** What examining it records. */
  finding: string;
}

/** Something the interviewer holds and can present. */
export interface InterviewEvidence {
  id: string;
  label: string;
  text: string;
}

/** A question from the topic list, and the statement it draws. */
export interface InterviewTopic {
  id: string;
  label: string;
  /** Who answers, as shown. */
  speaker: string;
  answer: string;
  /** Only askable once these findings or evidence are held. */
  requires?: readonly string[];
  /** Evidence the answer hands over. */
  gives?: string;
}

/** Presenting `evidence` against the answer to `topic` exposes a contradiction. */
export interface InterviewContradiction {
  topic: string;
  evidence: string;
  text: string;
  /** Evidence (or a finding id) the contradiction yields. */
  gives?: string;
}

export interface InterviewConclusion {
  id: string;
  label: string;
  correct?: boolean;
  /** Campaign flags this conclusion writes. */
  flags?: FlagRecord;
  /** The closing line when it is chosen. */
  text: string;
}

export interface InterviewDef {
  id: string;
  title: string;
  /** Who is examined or questioned. */
  subject: string;
  place: string;
  intro: string;
  /** The question the conclusion answers. */
  question: string;
  regions?: readonly InterviewRegion[];
  topics: readonly InterviewTopic[];
  evidence?: readonly InterviewEvidence[];
  contradictions?: readonly InterviewContradiction[];
  conclusions: readonly InterviewConclusion[];
  /** Findings + contradictions needed before a conclusion may be drawn. */
  needed: number;
}

export interface InterviewResult {
  conclusion: InterviewConclusion;
  correct: boolean;
  score: number;
  rank: Rank;
  flags: FlagRecord;
  found: number;
  contradictions: number;
}

/** Points per finding, contradiction and correct conclusion, and the cost of a question asked twice. */
export const INTERVIEW_POINTS = { finding: 200, contradiction: 400, correct: 1500, wasted: 60 };

export class InterviewSession {
  /** Region ids examined, in order. */
  readonly examined: string[] = [];
  /** Topic ids asked, in order. */
  readonly asked: string[] = [];
  /** Evidence ids held (the starting inventory, then what answers and contradictions yield). */
  readonly held: string[] = [];
  /** Contradictions exposed (topic ids). */
  readonly exposed: string[] = [];
  /** The transcript: what was said, in order. */
  readonly log: { speaker: string; text: string }[] = [];
  private wasted = 0;
  result: InterviewResult | null = null;

  constructor(readonly def: InterviewDef) {
    for (const e of def.evidence ?? []) this.held.push(e.id);
    this.log.push({ speaker: '', text: def.intro });
  }

  /** Findings and contradictions so far — what `needed` counts. */
  get progress(): number {
    return this.examined.length + this.exposed.length;
  }

  get canConclude(): boolean {
    return !this.result && this.progress >= this.def.needed;
  }

  /** A finding examined, evidence held, or (for a topic's `requires`) a question already asked. */
  private has(id: string): boolean {
    return this.examined.includes(id) || this.held.includes(id) || this.asked.includes(id);
  }

  /** Topics that may be asked now. */
  topics(): InterviewTopic[] {
    return this.def.topics.filter((t) => (t.requires ?? []).every((r) => this.has(r)));
  }

  examine(regionId: string): InterviewRegion | null {
    const r = this.def.regions?.find((x) => x.id === regionId);
    if (!r || this.result) return null;
    if (this.examined.includes(r.id)) {
      this.wasted++;
      return r;
    }
    this.examined.push(r.id);
    this.log.push({ speaker: '', text: r.finding });
    return r;
  }

  ask(topicId: string): InterviewTopic | null {
    const t = this.topics().find((x) => x.id === topicId);
    if (!t || this.result) return null;
    if (this.asked.includes(t.id)) this.wasted++;
    else this.asked.push(t.id);
    this.log.push({ speaker: t.speaker, text: t.answer });
    if (t.gives && !this.held.includes(t.gives)) this.held.push(t.gives);
    return t;
  }

  /** Present evidence against an answered statement; true when it exposes a contradiction. */
  present(evidenceId: string, topicId: string): boolean {
    // Anything in the notebook may be presented: evidence held, or a finding examined.
    if (this.result || !this.has(evidenceId) || !this.asked.includes(topicId)) return false;
    const c = this.def.contradictions?.find((x) => x.topic === topicId && x.evidence === evidenceId);
    if (!c || this.exposed.includes(topicId)) {
      this.wasted++;
      this.log.push({ speaker: '', text: 'That proves nothing against it.' });
      return false;
    }
    this.exposed.push(topicId);
    this.log.push({ speaker: '', text: c.text });
    if (c.gives && !this.held.includes(c.gives)) this.held.push(c.gives);
    return true;
  }

  conclude(conclusionId: string): InterviewResult | null {
    if (!this.canConclude) return null;
    const c = this.def.conclusions.find((x) => x.id === conclusionId);
    if (!c) return null;
    const correct = !!c.correct;
    const P = INTERVIEW_POINTS;
    const score = Math.max(0, this.examined.length * P.finding + this.exposed.length * P.contradiction + (correct ? P.correct : 0) - this.wasted * P.wasted);
    const max = (this.def.regions?.length ?? 0) * P.finding + (this.def.contradictions?.length ?? 0) * P.contradiction + P.correct;
    const frac = max > 0 ? score / max : 0;
    const rank: Rank = !correct ? 'C' : frac >= 0.98 && this.wasted === 0 ? 'XS' : frac >= 0.85 ? 'S' : frac >= 0.65 ? 'A' : 'B';
    this.log.push({ speaker: '', text: c.text });
    this.result = { conclusion: c, correct, score, rank, flags: { ...(c.flags ?? {}) }, found: this.examined.length, contradictions: this.exposed.length };
    return this.result;
  }
}
