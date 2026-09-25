import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allOperations } from '../src/content/campaign';
import { ACHIEVEMENTS, awardAchievements, reputation, unlockedByReputation } from '../src/surgery/achievements';
import { Embedded, Laceration, Rot } from '../src/surgery/entities';
import { eligible, prepareSubmission, verifySubmission } from '../src/surgery/leaderboard';
import { Operation, terse } from '../src/surgery/operation';
import { freshProgress, recordRun } from '../src/surgery/progress';
import { AILMENT_SCHEMA, buildAilments, validateAilments, type AilmentSpec } from '../src/surgery/schema';
import { CUE_TELLS, HAZARD_TELLS } from '../src/surgery/tells';
import { FIRST_HINTS, TUTORIALS } from '../src/surgery/tutorial';
import { LOOM_MODULES } from '../src/content/challenge';
import { playWithBot } from './bot';
import { Anchor, at, DT, Hand, running, testDef, wait, zig } from './harness-gameplay';

const byId = (id: string) => allOperations().find((d) => d.id === id)!;

describe('GAM-B data-driven ailments', () => {
  it('GAM-0020: ailment records are validated at load; bad content fails', () => {
    const good: AilmentSpec[] = [
      { kind: 'laceration', pos: [-100, 0], params: { angle: 0.3, length: 90, bleed: 0.6 } },
      { kind: 'embedded', pos: [50, 20], params: { object: 'arrow', angle: -0.5 } },
      { kind: 'sigil', pos: [0, -60], params: { glyph: 'eye', size: 50 } },
      { kind: 'fracture', pos: [120, 60], params: { fragments: 3 } },
      { kind: 'growth', pos: [-150, 60], params: { feeders: 2, variant: 'eye' } },
    ];
    expect(validateAilments(good)).toEqual([]);
    const op = running(() => [new Anchor()]);
    expect(buildAilments(op, good).length).toBeGreaterThanOrEqual(5);
    const bad: AilmentSpec[] = [
      { kind: 'laceratoin', pos: [0, 0] },
      { kind: 'laceration', pos: [900, 0], params: { angle: 0, length: 5 } },
      { kind: 'embedded', pos: [0, 0], params: { object: 'spoon' } },
      { kind: 'sigil', pos: [0, 0], params: { glyph: 'eye', colour: 'red' } },
    ];
    const errs = validateAilments(bad);
    expect(errs.join('\n')).toMatch(/unknown ailment kind "laceratoin"/);
    expect(errs.join('\n')).toMatch(/off the body/);
    expect(errs.join('\n')).toMatch(/length: 5 outside/);
    expect(errs.join('\n')).toMatch(/"spoon" is not one of/);
    expect(errs.join('\n')).toMatch(/colour: not a parameter/);
    expect(() => buildAilments(op, bad)).toThrow(/Invalid ailment data/);
    expect(Object.keys(AILMENT_SCHEMA).length).toBeGreaterThanOrEqual(20);
  });
});

describe('GAM-F leaderboard hook', () => {
  it('GAM-0157: only replay-validated scores are submitted; a tampered claim is rejected', () => {
    const def = byId('op1-2');
    const op = playWithBot(def, { profile: 'steady', record: true }).op;
    const sub = prepareSubmission(op)!;
    expect(sub).not.toBeNull();
    expect(verifySubmission(def, sub)).toBe(true);
    expect(verifySubmission(def, { ...sub, score: sub.score + 100 })).toBe(false);
    const assisted = playWithBot(def, { profile: 'steady', record: true, assists: { bigHitboxes: true } }).op;
    expect(eligible(assisted)).toBe(false);
    expect(prepareSubmission(assisted)).toBeNull();
  });
});

describe('GAM-M achievements & reputation', () => {
  it('GAM-0232: gameplay achievement hooks fire once each', () => {
    const p = freshProgress();
    const boss = playWithBot(byId('op1-5'), { profile: 'expert' }).op;
    const got = awardAchievements(p, boss);
    expect(got).toContain('first-malison');
    expect(awardAchievements(p, boss)).toEqual([]);
    const clean = playWithBot(byId('op1-1'), { profile: 'steady' }).op;
    awardAchievements(p, clean);
    expect(p.achievements).toContain('never-bad');
    expect(Object.keys(ACHIEVEMENTS)).toEqual(expect.arrayContaining(['first-xs', 'combo-50', 'no-litany-boss', 'all-x-ops', 'never-bad']));
    p.xBest = { x1: { rank: 'A', score: 1, time: 1 } };
    expect(awardAchievements(p, clean, { allXOps: ['x1', 'x2'] })).not.toContain('all-x-ops');
    p.xBest.x2 = { rank: 'B', score: 1, time: 1 };
    expect(awardAchievements(p, clean, { allXOps: ['x1', 'x2'] })).toContain('all-x-ops');
  });

  it('GAM-0231: hospice reputation sums best ranks and unlocks cosmetics and codex pages', () => {
    const p = freshProgress();
    expect(reputation(p)).toBe(0);
    recordRun(p, { opId: 'a', won: true, rank: 'S', score: 1, difficulty: 'surgeon', flags: [] });
    recordRun(p, { opId: 'b', won: true, rank: 'B', score: 1, difficulty: 'novice', flags: [] });
    recordRun(p, { opId: 'b', won: true, rank: 'A', score: 1, difficulty: 'master', flags: [] });
    expect(reputation(p)).toBe(4 + 3);
    expect(unlockedByReputation(p).map((u) => u.id)).toEqual(['candles']);
  });
});

describe('GAM-K tutorialisation', () => {
  it('GAM-0204: guided op1-1 — each step prompts, highlights, and holds the bleeding until done', () => {
    const def = byId('op1-1');
    const op = new Operation(def, { tutorial: true });
    wait(op, 2.1);
    expect(op.tutorial?.id).toBe('stitch');
    expect(op.tutorial?.highlight?.(op)).not.toBeNull();
    const v = op.vitals;
    wait(op, 5);
    expect(op.vitals).toBe(v);
    const lac = op.entities.find((e): e is Laceration => e instanceof Laceration)!;
    new Hand(op).drag('thread', zig(lac.a, lac.b, lac.stitch.needed + 1), 300);
    wait(op, DT);
    expect(op.tutorial).toBeNull();
    wait(op, 1);
    expect(op.vitals).toBeLessThan(v);
    // The whole guided op is still completable.
    const bot = playWithBot(def, { profile: 'steady', tutorial: true }).op;
    expect(bot.status).toBe('won');
    expect(bot.tutorialStep).toBe(TUTORIALS['op1-1'].length);
  });

  it('GAM-0206: Litany practice before the first Malison — three attempts, then it is spoken for you', () => {
    const op = new Operation(byId('op1-5'), { tutorial: true });
    for (let i = 0; i < 60 * 300 && !op.litanyPractice; i++) {
      op.update(1 / 60);
      if (op.phase < 2) for (const e of op.entities) if (e.required) e.kill();
    }
    expect(op.litanyPractice).toEqual({ attempts: 3 });
    const t = op.timeLeft;
    wait(op, 3);
    expect(op.timeLeft).toBe(t);
    op.practiceStar(false);
    op.practiceStar(false);
    expect(op.litanyUsed).toBe(false);
    op.practiceStar(false);
    expect(op.litanyPractice).toBeNull();
    expect(op.litanyUsed).toBe(true);
    const ok = new Operation(byId('op1-5'), { tutorial: true });
    for (let i = 0; i < 60 * 300 && !ok.litanyPractice; i++) {
      ok.update(1 / 60);
      if (ok.phase < 2) for (const e of ok.entities) if (e.required) e.kill();
    }
    ok.practiceStar(true);
    expect(ok.litanyTime).toBeGreaterThan(7);
  });

  it('GAM-0207: first-time hints — one per mechanic, not repeated once the save has seen them', () => {
    const op = running(() => [new Embedded(at(0, 0), 'arrow', 0), new Rot(at(100, 0), 30, 0), new Anchor()]);
    expect(op.hintsShown).toEqual(expect.arrayContaining(['barb', 'rot']));
    const again = running(() => [new Embedded(at(0, 0), 'arrow', 0), new Rot(at(100, 0), 30, 0), new Anchor()], {}, { hintsSeen: ['barb', 'rot'] });
    expect(again.hintsShown).toEqual([]);
    expect(FIRST_HINTS.map((h) => h.id)).toEqual(['barb', 'bolt', 'wadding', 'rot', 'sigil', 'hexstone', 'venom']);
  });

  it('GAM-0210: the Practice Theatre scores nothing and cannot lose the patient', () => {
    const op = running(() => [new Laceration(at(0, 0), 0, 200, 5), new Laceration(at(0, 100), 0, 44, 0.1)], { vitals: 20 }, { practice: true });
    wait(op, 10);
    expect(op.status).toBe('running');
    expect(op.vitals).toBe(1);
    const lac = op.entities[1] as Laceration;
    new Hand(op).drag('thread', zig(lac.a, lac.b, 3), 300);
    expect(op.counts.cool + op.counts.good).toBe(1);
    expect(op.score).toBe(0);
  });
});

describe('GAM-I Master flavour', () => {
  it('GAM-0182: on Master, Ilse is terse (first sentence only)', () => {
    expect(terse('Barbed! Nick the flesh at the entry with the lancet before you pull.')).toBe('Barbed!');
    expect(terse('The venom first — hold the tincture on the bite until it takes.')).toBe('The venom first.');
    const m = running(() => [new Anchor()], {}, { difficulty: 'master' });
    m.callouts.length = 0;
    m.say('Two deep cuts. Take the gut thread and zig-zag across each wound.');
    expect(m.callouts).toEqual(['Two deep cuts.']);
  });
});

describe('GAM-N accessibility of mechanics', () => {
  it('GAM-0234: hold-to-toggle — a click starts a held tool, the next click stops it', () => {
    const op = running(() => [new Anchor()], { vitals: 30 }, { assists: { holdToggle: true } });
    const h = new Hand(op);
    h.tap('tincture', at(200, 100));
    h.idle(0.8);
    expect(op.vitals).toBeGreaterThan(50);
    h.tap('tincture', at(200, 100));
    expect(op.injectT).toBe(0);
  });

  it('GAM-0235: every audio cue and hazard tell has a visual twin', () => {
    const dir = join(__dirname, '../src/surgery');
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.ts'))
      .map((f) => join(dir, f));
    for (const f of readdirSync(join(dir, 'ailments'))) files.push(join(dir, 'ailments', f));
    const cues = new Set<string>();
    for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(/cues\.push\('([a-z]+)'\)/g)) cues.add(m[1]);
    for (const c of cues) {
      const t = (CUE_TELLS as Record<string, { audio: string; visual: string }>)[c];
      expect(t, c).toBeDefined();
      expect(t.audio.length && t.visual.length, c).toBeTruthy();
    }
    for (const t of HAZARD_TELLS) expect(t.audio.length > 0 && t.visual.length > 0, t.id).toBe(true);
  });

  it('GAM-0237: game speed 70–100 % slows everything and flags the result', () => {
    const slow = running(() => [new Laceration(at(0, 0), 0, 100, 1), new Anchor()], { vitals: 90 }, { assists: { gameSpeed: 0.7 } });
    const norm = running(() => [new Laceration(at(0, 0), 0, 100, 1), new Anchor()], { vitals: 90 });
    wait(slow, 5);
    wait(norm, 5);
    expect(90 - slow.vitals).toBeCloseTo((90 - norm.vitals) * 0.7, 1);
    expect(slow.resultFlags()).toContain('speed 70%');
    expect(eligible(slow)).toBe(false);
  });

  it('GAM-0238: simplified gestures — click-per-stitch, tap-and-hold excision', () => {
    const op = running(() => [new Laceration(at(0, 0), 0, 66, 0.1), new Anchor()], {}, { assists: { simpleGestures: true } });
    const lac = op.entities[0] as Laceration;
    const h = new Hand(op);
    for (const x of [-22, 0, 22]) h.tap('thread', at(x, 0));
    expect(lac.alive).toBe(false);
  });
});

describe('Loom content is schema-clean', () => {
  it('all twelve loom modules build on a fresh operation', () => {
    const op = new Operation(testDef(() => []));
    for (const m of LOOM_MODULES) expect(m.spawn(op, at(0, 0)).length, m.id).toBeGreaterThan(0);
  });
});
