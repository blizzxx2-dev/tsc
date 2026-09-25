import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeStar, type StarOptions } from '../src/surgery/gesture';
import { syntheticCorpus, type CorpusStroke } from './fixtures/starCorpus';

/**
 * Recogniser benchmark (INP-0056). Runs over the synthetic corpus and, once they
 * exist, every recorded stroke in tests/fixtures/stars/*.json (INP-0055; format:
 * CorpusStroke[]). CI fails if the true-positive rate drops below 95 % or the
 * false-positive rate exceeds 1 %.
 */
function recordedCorpus(): CorpusStroke[] {
  const dir = join(__dirname, 'fixtures', 'stars');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as CorpusStroke[]);
}

const optsFor = (s: CorpusStroke): StarOptions => ({ profile: s.device === 'gamepad' ? 'gamepad' : 'pointer' });

function score(corpus: CorpusStroke[]) {
  let tp = 0,
    fn = 0,
    fp = 0,
    tn = 0;
  const misses: string[] = [];
  for (const s of corpus) {
    const r = analyzeStar(s.points, optsFor(s));
    if (s.label === 'star') {
      if (r.ok) tp++;
      else {
        fn++;
        misses.push(`${s.device}:${r.reason}`);
      }
    } else if (r.ok) {
      fp++;
      misses.push(`FP ${s.kind}`);
    } else tn++;
  }
  return { tpr: tp / Math.max(1, tp + fn), fpr: fp / Math.max(1, fp + tn), n: corpus.length, misses };
}

describe('star recogniser benchmark', () => {
  const synthetic = syntheticCorpus();

  it('synthetic corpus: TPR ≥ 95 %, FPR ≤ 1 %', () => {
    const s = score(synthetic);
    expect(s.n).toBeGreaterThanOrEqual(600);
    expect(s.tpr, s.misses.join(', ')).toBeGreaterThanOrEqual(0.95);
    expect(s.fpr, s.misses.join(', ')).toBeLessThanOrEqual(0.01);
  });

  it('gamepad subset meets the same bar with the gamepad profile', () => {
    const s = score(synthetic.filter((c) => c.device === 'gamepad'));
    expect(s.tpr).toBeGreaterThanOrEqual(0.95);
    expect(s.fpr).toBeLessThanOrEqual(0.01);
  });

  const recorded = recordedCorpus();
  it.skipIf(recorded.length === 0)('recorded corpus (tests/fixtures/stars): TPR ≥ 95 %, FPR ≤ 1 %', () => {
    const s = score(recorded);
    expect(s.tpr).toBeGreaterThanOrEqual(0.95);
    expect(s.fpr).toBeLessThanOrEqual(0.01);
  });
});
