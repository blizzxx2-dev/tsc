import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/math';
import { allCampaignOperations } from '../src/content/campaign';
import { CHAPTER_1 } from '../src/content/chapter1';
import { CHAPTER_2 } from '../src/content/chapter2';
import {
  BARK_COOLDOWN,
  BARK_LIMITS,
  BARK_TRIGGERS,
  BARK_URGENT,
  BARKS,
  MALISON_WHISPERS,
  NO_REPEAT_WINDOW,
  PATIENT_BARKS,
  pickBark,
  pickLine,
  RANK_QUIPS,
  rankQuip,
  resetBarkHistory,
  speakerFor,
  STROH_PRESENT,
  type BarkSpeaker,
  type BarkTrigger,
} from '../src/content/barks';
import { BarkDirector } from '../src/content/barkDirector';
import type { Rank } from '../src/surgery/types';
import { playWithBot } from './bot';

const demoOps = [...CHAPTER_1.steps, ...CHAPTER_2.steps].flatMap((s) => (s.kind === 'op' ? [s.op] : []));
const allLines = (): { where: string; line: string }[] => {
  const out: { where: string; line: string }[] = [];
  for (const [who, set] of Object.entries(BARKS))
    for (const [t, lines] of Object.entries(set)) for (const line of lines ?? []) out.push({ where: `${who}:${t}`, line });
  for (const [op, set] of Object.entries(PATIENT_BARKS))
    for (const [t, lines] of Object.entries(set)) for (const line of lines ?? []) out.push({ where: `${op}:${t}`, line });
  for (const [hour, lines] of Object.entries(MALISON_WHISPERS)) for (const line of lines) out.push({ where: hour, line });
  for (const [who, ranks] of Object.entries(RANK_QUIPS))
    for (const [r, lines] of Object.entries(ranks)) for (const line of lines) out.push({ where: `quip:${who}:${r}`, line });
  return out;
};

describe('bark sets (NAR-0071…0076)', () => {
  it('NAR-0071: Sister Ilse has at least six variants for every trigger (≈ 90 lines)', () => {
    let n = 0;
    for (const t of BARK_TRIGGERS) {
      expect(BARKS.ilse[t]?.length ?? 0, t).toBeGreaterThanOrEqual(6);
      n += BARKS.ilse[t]!.length;
    }
    expect(n).toBeGreaterThanOrEqual(90);
  });

  it('NAR-0072: Master Haller has at least three variants per trigger and supervises op1-1 and op1-2', () => {
    for (const t of BARK_TRIGGERS) expect(BARKS.haller[t]?.length ?? 0, t).toBeGreaterThanOrEqual(3);
    expect(speakerFor('op1-1')).toBe('haller');
    expect(speakerFor('op1-2')).toBe('haller');
    expect(speakerFor('op1-3')).toBe('ilse');
  });

  it('NAR-0073: Captain Mauer has 30 lines for the camp operations', () => {
    const n = Object.values(BARKS.mauer).reduce((a, l) => a + (l?.length ?? 0), 0);
    expect(n).toBeGreaterThanOrEqual(30);
    for (const id of ['op2-1', 'op2-2', 'op2-3', 'op2-5']) expect(speakerFor(id)).toBe('mauer');
    expect(BARKS.mauer.phase!.join(' ')).toContain('Is he fit to march?');
  });

  it('NAR-0074: Inquisitor Stroh has 20 lines, only for the Litany, boss temper, phases and outcomes', () => {
    const n = Object.values(BARKS.stroh).reduce((a, l) => a + (l?.length ?? 0), 0);
    expect(n).toBeGreaterThanOrEqual(20);
    expect(Object.keys(BARKS.stroh).sort()).toEqual(['enraged', 'fail', 'litany', 'phase', 'success']);
    expect(STROH_PRESENT).toEqual(['op1-4', 'op1-5', 'op2-4', 'op2-5']);
  });

  it('NAR-0075: every demo patient has 4–6 lines covering first incision, extraction or pain, and closing', () => {
    for (const op of demoOps) {
      const set = PATIENT_BARKS[op.id];
      expect(set, op.id).toBeDefined();
      const n = Object.values(set).reduce((a, l) => a + (l?.length ?? 0), 0);
      expect(n, op.id).toBeGreaterThanOrEqual(4);
      expect(n, op.id).toBeLessThanOrEqual(6);
      expect(set['first-cut']?.length, op.id).toBeGreaterThan(0);
      expect(set.closing?.length, op.id).toBeGreaterThan(0);
    }
  });

  it('NAR-0076: Matins whispers 8 vigil verses; Lauds calls and answers in 12', () => {
    expect(MALISON_WHISPERS.matins).toHaveLength(8);
    expect(MALISON_WHISPERS.lauds).toHaveLength(12);
    expect(MALISON_WHISPERS.lauds[0]).toBe('Who keeps the watch before the sun?');
    expect(MALISON_WHISPERS.lauds[1]).toBe('The one who wakes, and wakes alone.');
  });

  it('NAR-0078: four quips per rank per speaker', () => {
    for (const who of Object.keys(RANK_QUIPS) as BarkSpeaker[])
      for (const r of ['XS', 'S', 'A', 'B', 'C'] as Rank[]) expect(RANK_QUIPS[who][r], `${who} ${r}`).toHaveLength(4);
    expect(RANK_QUIPS.haller.XS).toContain(rankQuip('op1-1', 'XS'));
    expect(RANK_QUIPS.mauer.C).toContain(rankQuip('op2-1', 'C'));
  });

  it('every line is ≤ 90 characters, uses no exotic glyphs, and no failure line jokes', () => {
    for (const { where, line } of allLines()) {
      expect(line.length, `${where}: ${line}`).toBeLessThanOrEqual(90);
      expect(line, where).not.toMatch(/[→★]/);
      expect(line.trim(), where).toBe(line);
    }
    for (const who of Object.keys(BARKS) as BarkSpeaker[]) for (const line of BARKS[who].fail ?? []) expect(line, who).not.toMatch(/ha ha|joke|pie/i);
  });

  it('no line is duplicated within a trigger', () => {
    const seen = new Map<string, Set<string>>();
    for (const { where, line } of allLines()) {
      const set = seen.get(where) ?? new Set();
      expect(set.has(line), `${where}: ${line}`).toBe(false);
      set.add(line);
      seen.set(where, set);
    }
  });
});

describe('anti-repeat rule (NAR-0077)', () => {
  it('1000 fires per trigger: no line repeats within 3 fires, and every variant is heard', () => {
    const rng = new Rng(7);
    const r = () => rng.next();
    for (const who of Object.keys(BARKS) as BarkSpeaker[]) {
      for (const t of Object.keys(BARKS[who]) as BarkTrigger[]) {
        resetBarkHistory();
        const variants = BARKS[who][t]!;
        const heard = new Set<string>();
        const recent: string[] = [];
        for (let i = 0; i < 1000; i++) {
          const line = pickBark(who, t, r)!;
          expect(line, `${who}:${t}`).toBeDefined();
          const window = Math.min(NO_REPEAT_WINDOW, variants.length - 1);
          expect(recent.slice(-window), `${who}:${t} fire ${i}`).not.toContain(line);
          recent.push(line);
          heard.add(line);
        }
        expect(heard.size, `${who}:${t}`).toBe(variants.length);
      }
    }
  });

  it('a single-line set still speaks; the history is reset per operation', () => {
    resetBarkHistory();
    expect(pickLine('one', ['only'], () => 0)).toBe('only');
    expect(pickLine('one', ['only'], () => 0.99)).toBe('only');
    expect(pickLine('two', ['a', 'b'], () => 0)).toBe('a');
    expect(pickLine('two', ['a', 'b'], () => 0)).toBe('b');
    expect(pickLine('two', ['a', 'b'], () => 0)).toBe('a');
    resetBarkHistory();
    expect(pickLine('two', ['a', 'b'], () => 0)).toBe('a');
    expect(pickLine('none', [], () => 0)).toBeUndefined();
  });
});

describe('bark director', () => {
  const play = (id: string, speaker?: BarkSpeaker) => {
    const def = allCampaignOperations().find((d) => d.id === id)!;
    const rng = new Rng(3);
    let director!: BarkDirector;
    const times: number[] = [];
    const res = playWithBot(def, {
      think: 1.0,
      onOp: (op) => {
        director = new BarkDirector(op, { rng: () => rng.next(), speaker });
        const say = op.say.bind(op);
        op.say = (...args) => {
          times.push(op.elapsed);
          say(...args);
        };
      },
    });
    return { op: res.op, director, times };
  };

  it('speaks during op1-1 in Haller’s voice, never floods, and observes the 6 s cooldown', () => {
    const { op, director } = play('op1-1');
    expect(op.status).toBe('won');
    expect(director.speaker).toBe('haller');
    expect(director.spoken.length).toBeGreaterThan(2);
    const spoken = director.spoken;
    // No trigger beyond its limit; every observer line is one of Haller's.
    const counts = new Map<string, number>();
    for (const s of spoken) counts.set(s.trigger, (counts.get(s.trigger) ?? 0) + 1);
    for (const [key, n] of counts) {
      const [who, t] = key.split(':') as [string, BarkTrigger];
      if (who === 'haller') {
        expect(n, key).toBeLessThanOrEqual(BARK_LIMITS[t]);
        expect(BARKS.haller[t], key).toContain(spoken.find((s) => s.trigger === key)!.line);
      }
    }
    expect(spoken.some((s) => s.trigger === 'haller:success')).toBe(true);
    expect(spoken.some((s) => s.trigger.startsWith('ilse:'))).toBe(false);
  });

  it('keeps at least the cooldown between non-urgent barks', () => {
    const def = allCampaignOperations().find((d) => d.id === 'op1-3')!;
    const rng = new Rng(11);
    const stamps: { t: number; urgent: boolean }[] = [];
    let director!: BarkDirector;
    playWithBot(def, {
      think: 1.0,
      onOp: (op) => {
        director = new BarkDirector(op, { rng: () => rng.next() });
        const orig = director.fire.bind(director);
        director.fire = (t, who) => {
          const line = orig(t, who);
          if (line) stamps.push({ t: op.elapsed, urgent: BARK_URGENT.includes(t) });
          return line;
        };
      },
    });
    for (let i = 1; i < stamps.length; i++) if (!stamps[i].urgent) expect(stamps[i].t - stamps[i - 1].t).toBeGreaterThanOrEqual(BARK_COOLDOWN - 1e-6);
  });

  it('Stroh adds lines on op1-5 (Litany, phases, outcome) and the Hour whispers', () => {
    const { op, director } = play('op1-5');
    expect(op.status).toBe('won');
    const triggers = director.spoken.map((s) => s.trigger);
    expect(triggers.some((t) => t.startsWith('stroh:'))).toBe(true);
    expect(triggers.some((t) => t.startsWith('ilse:'))).toBe(true);
    expect(triggers).toContain('whisper');
    for (const s of director.spoken) if (s.trigger === 'whisper') expect(MALISON_WHISPERS.matins).toContain(s.line);
  });

  it('every demo op still wins with the director attached', () => {
    for (const def of demoOps) {
      const res = playWithBot(def, { think: 1.0, onOp: (op) => new BarkDirector(op) });
      expect(res.op.status, def.id).toBe('won');
    }
  });
});

describe('Whisper-band barks (NAR-0166)', () => {
  it('after the star, a Suspected or Accused Kreuzer draws a remark; an Unremarked one does not', async () => {
    const { WHISPER_BAND_BARKS } = await import('../src/content/barks');
    const { start } = await import('./harness');
    const all = Object.values(WHISPER_BAND_BARKS).flatMap((b) => [...b.ilse, ...b.stroh]);
    expect(new Set(all).size).toBe(8);
    for (const [band, expectLine] of [
      ['unremarked', false],
      ['suspected', true],
      ['accused', true],
    ] as const) {
      const op = start();
      const d = new BarkDirector(op, { rng: () => 0, whisper: band });
      (op.events.emit as (k: string, p: unknown) => void)('litany', {});
      expect(
        d.spoken.some((s) => s.trigger === 'whisper-band' && all.includes(s.line)),
        band,
      ).toBe(expectLine);
    }
  });
});

describe('environment barks (NAR-0164)', () => {
  it('Ilse warns of rain, a moving cart and one candle as the operation opens — six lines each', async () => {
    const { ENV_BARKS } = await import('../src/content/barks');
    const { Operation } = await import('../src/surgery/operation');
    for (const k of ['rain', 'cart', 'candle'] as const) expect(new Set(ENV_BARKS[k]).size).toBe(6);
    const def = allCampaignOperations().find((o) => o.id === 'op1-1')!;
    const op = new Operation(def, { mutators: ['rain', 'candle'] });
    const d = new BarkDirector(op, { rng: () => 0 });
    expect(d.spoken.filter((s) => s.trigger.startsWith('env:')).map((s) => s.trigger)).toEqual(['env:rain', 'env:candle']);
    const plain = new BarkDirector(new Operation(def), { rng: () => 0 });
    expect(plain.spoken.some((s) => s.trigger.startsWith('env:'))).toBe(false);
  });
});

describe('challenge-mode examiner (NAR-0167)', () => {
  it('at least thirty neutral lines with no names, spoken in X-operations', async () => {
    const { BARKS } = await import('../src/content/barks');
    const { CAST } = await import('../src/content/characters');
    const { Operation } = await import('../src/surgery/operation');
    const lines = Object.values(BARKS.examiner).flat();
    expect(lines.length).toBeGreaterThanOrEqual(30);
    expect(new Set(lines).size).toBe(lines.length);
    const names = [
      'Kreuzer',
      'Ilse',
      'Haller',
      'Stroh',
      'Mauer',
      'Malison',
      'Choir',
      'Litany',
      ...Object.values(CAST).map((c) => c.name.split(' ').pop() ?? ''),
    ].filter((n) => n.length > 2);
    for (const l of lines) for (const n of names) expect(l.includes(n), `${l} names ${n}`).toBe(false);
    const def = allCampaignOperations().find((o) => o.id === 'op1-1')!;
    expect(new BarkDirector(new Operation(def, { challenge: {} as never }), { rng: () => 0 }).speaker).toBe('examiner');
    expect(new BarkDirector(new Operation(def), { rng: () => 0 }).speaker).not.toBe('examiner');
  });
});
