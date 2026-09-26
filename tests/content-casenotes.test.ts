import { allCampaignOperations } from '../src/content/campaign';
import { describe, expect, it } from 'vitest';
import { CHAPTER_1 } from '../src/content/chapter1';
import { CHAPTER_2 } from '../src/content/chapter2';
import { CASE_NOTES, caseNote, caseNoteText, renderCaseNote } from '../src/content/casenotes';
import { EPIGRAPHS, pickEpigraph, REMEMBERED_TEACHINGS } from '../src/content/epigraphs';
import { wordCount } from '../src/content/codex';
import type { Rank } from '../src/surgery/types';

const demoOps = [...CHAPTER_1.steps, ...CHAPTER_2.steps].flatMap((s) => (s.kind === 'op' ? [s.op] : []));
const RANKS: Rank[] = ['XS', 'S', 'A', 'B', 'C'];

describe('case notes (NAR-0087, NAR-0088)', () => {
  it('one note per campaign operation, demo first, naming the patient the op names (NAR-0170)', () => {
    const ops = allCampaignOperations();
    expect(CASE_NOTES.slice(0, demoOps.length).map((n) => n.op)).toEqual(demoOps.map((d) => d.id));
    expect(new Set(CASE_NOTES.map((n) => n.op))).toEqual(new Set(ops.map((d) => d.id)));
    for (const d of ops) {
      const n = caseNote(d.id)!;
      const first = d.patient.split(/[, ]/)[0];
      expect(n.patient, d.id).toContain(first === 'A' ? 'lay-cantor' : first);
    }
  });

  it('template: patient, presenting complaint, procedure, outcome per rank band, one observation', () => {
    for (const n of CASE_NOTES) {
      for (const f of [n.patient, n.presenting, n.procedure, n.observation, n.outcome.high, n.outcome.mid, n.outcome.low])
        expect(f.trim().length, n.op).toBeGreaterThan(0);
      expect(new Set([n.outcome.high, n.outcome.mid, n.outcome.low]).size, n.op).toBe(3);
      expect(n.observation.split(/(?<=[.!?])\s/).length, `${n.op} observation`).toBeLessThanOrEqual(2);
    }
  });

  it('every variant is ≤ 120 words; the outcome sentence follows the rank', () => {
    for (const n of CASE_NOTES) {
      for (const r of RANKS) expect(wordCount(caseNoteText(n, r)), `${n.op} ${r}`).toBeLessThanOrEqual(120);
      expect(renderCaseNote(n, 'XS').outcome).toBe(n.outcome.high);
      expect(renderCaseNote(n, 'S').outcome).toBe(n.outcome.high);
      expect(renderCaseNote(n, 'A').outcome).toBe(n.outcome.mid);
      expect(renderCaseNote(n, 'B').outcome).toBe(n.outcome.mid);
      expect(renderCaseNote(n, 'C').outcome).toBe(n.outcome.low);
      expect(renderCaseNote(n, null).outcome).toBe(n.outcome.mid);
      // A low-rank outcome still records a living patient; failure has its own scene.
      expect(n.outcome.low, n.op).toMatch(/lives|mend|keep|carry/);
    }
  });

  it('no exotic glyphs, no failure jokes, hexstone never green', () => {
    for (const n of CASE_NOTES) {
      const text = caseNoteText(n, 'C');
      expect(text, n.op).not.toMatch(/[→★]/);
      expect(text, n.op).not.toMatch(/\bgreen\b/i);
    }
  });
});

describe('epigraphs (NAR-0069) and Remembered Teachings (NAR-0053)', () => {
  it('eight title-screen epigraphs, each short, each with a source', () => {
    expect(EPIGRAPHS).toHaveLength(8);
    for (const e of EPIGRAPHS) {
      expect(e.text.length).toBeLessThanOrEqual(90);
      expect(e.source.length).toBeGreaterThan(0);
      expect(e.text).not.toMatch(/[→★]/);
    }
    expect(new Set(EPIGRAPHS.map((e) => e.text)).size).toBe(8);
    expect(pickEpigraph(() => 0)).toBe(EPIGRAPHS[0]);
    expect(pickEpigraph(() => 0.999)).toBe(EPIGRAPHS[7]);
    expect(pickEpigraph(() => 1)).toBe(EPIGRAPHS[7]);
  });

  it('the Litany is explained in-fiction by Haller in at most two prompts, then the maxims', () => {
    const litany = REMEMBERED_TEACHINGS.filter((t) => t.id.startsWith('litany'));
    expect(litany).toHaveLength(2);
    expect(litany[0].maxim).toMatch(/star/);
    expect(litany[0].gloss).toMatch(/five-pointed star/);
    expect(REMEMBERED_TEACHINGS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(REMEMBERED_TEACHINGS.map((t) => t.id)).size).toBe(REMEMBERED_TEACHINGS.length);
    for (const t of REMEMBERED_TEACHINGS) {
      expect(t.maxim.length, t.id).toBeLessThanOrEqual(140);
      expect(t.gloss.length, t.id).toBeLessThanOrEqual(160);
    }
  });
});
