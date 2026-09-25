/**
 * Multi-seed balance sweep and report (GAM-0185/0186/0188).
 *
 * Every demo op × 5 bot profiles × 20 seeds. Asserts win rates, writes a CSV
 * report, and compares per-op/profile medians to the committed baseline:
 * a shift of more than 10 % fails (re-baseline with `UPDATE_BASELINE=1 npm run balance`).
 * `npm run balance` writes docs/balance/report.csv.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allOperations } from '../src/content/campaign';
import { playWithBot, type Profile } from './bot';

const PROFILES: Profile[] = ['novice', 'steady', 'expert', 'farm', 'sloppy'];
const SEEDS = 20;
const BASELINE = join(__dirname, 'balance-baseline.csv');
const REPORT_DIR = join(__dirname, '..', 'docs', 'balance');

interface Row {
  op: string;
  profile: Profile;
  seed: number;
  status: string;
  score: number;
  rank: string;
  timeUsed: number;
  minVitals: number;
  litany: boolean;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

describe('balance sweep (20 seeds × 5 profiles × every demo op)', () => {
  const rows: Row[] = [];
  const t0 = Date.now();
  for (const def of allOperations())
    for (const profile of PROFILES)
      for (let seed = 1; seed <= SEEDS; seed++) {
        const op = playWithBot(def, { profile, seed: (def.seed ?? 1) * 1000 + seed, botSeed: seed }).op;
        rows.push({
          op: def.id,
          profile,
          seed,
          status: op.status,
          score: op.score,
          rank: op.rank(),
          timeUsed: Math.round(op.timeLimit - op.timeLeft),
          minVitals: Math.round(op.minVitals),
          litany: op.litanyUsed,
        });
      }
  const elapsed = (Date.now() - t0) / 1000;

  it('GAM-0188: the full 10-op × 5-profile × 20-seed sweep runs in under 60 s', () => {
    expect(rows.length).toBe(allOperations().length * PROFILES.length * SEEDS);
    expect(elapsed).toBeLessThan(60);
  });

  it('GAM-0185: steady wins 100 % of seeds and novice ≥ 95 % on every op', () => {
    for (const def of allOperations()) {
      const rate = (p: Profile) => rows.filter((r) => r.op === def.id && r.profile === p && r.status === 'won').length / SEEDS;
      expect(rate('steady'), `${def.id} steady`).toBe(1);
      expect(rate('novice'), `${def.id} novice`).toBeGreaterThanOrEqual(0.95);
    }
  });

  it('GAM-0187: an expert can reach XS on every demo op', () => {
    for (const def of allOperations()) {
      const xs = rows.filter((r) => r.op === def.id && r.profile === 'expert' && r.rank === 'XS');
      expect(xs.length, def.id).toBeGreaterThan(0);
    }
  });

  it('GAM-0149: across seeds the farm bot never out-scores a steady clear on a boss op', () => {
    for (const id of ['op1-5', 'op2-5']) {
      const med = (p: Profile) => median(rows.filter((r) => r.op === id && r.profile === p && r.status === 'won').map((r) => r.score));
      expect(med('farm'), id).toBeLessThanOrEqual(med('steady') * 0.95);
    }
  });

  it('GAM-0186: balance report CSV, diffed against the committed baseline (> 10 % shift flags)', () => {
    if (!existsSync(REPORT_DIR)) mkdirSync(REPORT_DIR, { recursive: true });
    const csv = ['op,profile,seed,status,score,rank,time_used,min_vitals,litany', ...rows.map((r) => [r.op, r.profile, r.seed, r.status, r.score, r.rank, r.timeUsed, r.minVitals, r.litany ? 1 : 0].join(','))].join('\n');
    writeFileSync(join(REPORT_DIR, 'report.csv'), csv + '\n');
    // Medians per op × profile.
    const summary: string[] = ['op,profile,median_score,median_time_used,median_min_vitals,win_rate'];
    for (const def of allOperations())
      for (const p of PROFILES) {
        const rs = rows.filter((r) => r.op === def.id && r.profile === p);
        summary.push([def.id, p, median(rs.map((r) => r.score)), median(rs.map((r) => r.timeUsed)), median(rs.map((r) => r.minVitals)), (rs.filter((r) => r.status === 'won').length / rs.length).toFixed(2)].join(','));
      }
    const text = summary.join('\n') + '\n';
    if (process.env.UPDATE_BASELINE || !existsSync(BASELINE)) {
      writeFileSync(BASELINE, text);
      return;
    }
    const base = new Map(
      readFileSync(BASELINE, 'utf8')
        .trim()
        .split('\n')
        .slice(1)
        .map((l) => {
          const [op, p, score, time, vit] = l.split(',');
          return [`${op}/${p}`, { score: +score, time: +time, vit: +vit }];
        }),
    );
    const shifts: string[] = [];
    for (const l of summary.slice(1)) {
      const [op, p, score] = l.split(',');
      const b = base.get(`${op}/${p}`);
      if (!b) continue;
      const d = Math.abs(+score - b.score) / Math.max(1, b.score);
      if (d > 0.1) shifts.push(`${op}/${p}: median score ${b.score} → ${score} (${Math.round(d * 100)} %)`);
    }
    expect(shifts, shifts.join('\n')).toEqual([]);
  });
});
