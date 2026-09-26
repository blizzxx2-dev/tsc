/**
 * Campaign flags (CON-0008), branch steps (CON-0007), line conditions (CON-0009), choice nodes
 * (CON-0010), the s2-4 choice (NAR-0062), the chapter flag contracts (NAR-0116/0131/0145) and
 * the demo carry-over of flags (CON-0093).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { FULL_CAMPAIGN, nextOpenStep, stepId, stepOpen, type Chapter, type Step } from '../../../src/content/campaign';
import { CHAPTER_2, STORY_2_4 } from '../../../src/content/chapter2';
import { STORY_3_1, STORY_3_2, STORY_3_9 } from '../../../src/content/chapter3';
import { CHAPTER_4, STORY_4_5, STORY_4_8, STORY_4_END } from '../../../src/content/chapter4';
import { strohTrust } from '../../../src/content/endings';
import { describeLine, lineShown, lineShownNow, resolveStory } from '../../../src/content/conditions';
import {
  applyOpFlags,
  conditionReads,
  describeCondition,
  ENGINE_FLAG_WRITES,
  evalCondition,
  flags,
  FlagStore,
  licenceKept,
  noteGuildRank,
  OP_FLAG_WRITES,
  type FlagCondition,
} from '../../../src/content/flags';
import { choose, n, onlyIf, say, type StoryDef } from '../../../src/content/story';
import { choiceEntries, storyEntries } from '../../../src/content/export';
import { encode, freshProfile, migrate, readProfile, sanitizeFlags, sanitizeProfile } from '../../../src/core/save/codec';
import { FLAG_LIMITS, SAVE_VERSION, type FlagRecord } from '../../../src/core/save/schema';
import { importDemoProfile, indexCampaign } from '../../../src/platform/carryover';
import { Input } from '../../../src/core/input';
import type { Game, Scene } from '../../../src/core/scene';
import { bindings } from '../../../src/input/bindings';
import { StoryScene } from '../../../src/scenes/story';

beforeEach(() => {
  flags.listener = null;
  flags.clear();
});

describe('FlagStore (CON-0008)', () => {
  it('get/set/has/truthy over booleans, numbers and strings', () => {
    const f = new FlagStore();
    expect(f.has('cantorMercy')).toBe(false);
    expect(f.get('cantorMercy')).toBeUndefined();
    expect(f.set('cantorMercy', true)).toBe(true);
    expect(f.set('litanySeenCount', 2)).toBe(true);
    expect(f.set('hallerFate', 'scarred')).toBe(true);
    expect(f.get('cantorMercy')).toBe(true);
    expect(f.has('litanySeenCount')).toBe(true);
    expect(f.truthy('hallerFate')).toBe(true);
    f.set('zero', 0);
    f.set('empty', '');
    f.set('no', false);
    expect(f.truthy('zero')).toBe(false);
    expect(f.truthy('empty')).toBe(false);
    expect(f.truthy('no')).toBe(false);
    expect(f.truthy('missing')).toBe(false);
    expect(f.all()).toEqual({ cantorMercy: true, litanySeenCount: 2, hallerFate: 'scarred', zero: 0, empty: '', no: false });
  });

  it('count() increments a numeric flag from nothing', () => {
    const f = new FlagStore();
    expect(f.count('litanySeenCount')).toBe(1);
    expect(f.count('litanySeenCount')).toBe(2);
    expect(f.count('litanySeenCount', 3)).toBe(5);
    f.set('litanySeenCount', 'oops');
    expect(f.count('litanySeenCount')).toBe(1);
  });

  it('rejects invalid keys and values and enforces the flag budget', () => {
    const f = new FlagStore();
    expect(f.set('', true)).toBe(false);
    expect(f.set('k'.repeat(FLAG_LIMITS.key + 1), true)).toBe(false);
    expect(f.set('nan', Number.NaN)).toBe(false);
    expect(f.set('long', 'x'.repeat(FLAG_LIMITS.string + 1))).toBe(false);
    expect(f.set('obj', {} as unknown as string)).toBe(false);
    for (let i = 0; i < FLAG_LIMITS.count; i++) f.set(`f${i}`, i);
    expect(f.set('one-too-many', 1)).toBe(false);
    expect(f.set('f0', 'still writable')).toBe(true);
    expect(Object.keys(f.all())).toHaveLength(FLAG_LIMITS.count);
  });

  it('binds through a getter so a replaced profile (New Game) is followed, and notifies writes', () => {
    let rec: FlagRecord = { cantorMercy: true };
    const f = new FlagStore(() => rec);
    const writes: [string, unknown][] = [];
    f.listener = (k, v) => writes.push([k, v]);
    expect(f.get('cantorMercy')).toBe(true);
    rec = {}; // New Game replaced the profile
    expect(f.has('cantorMercy')).toBe(false);
    f.set('thirstChoice', 'salve');
    expect(rec).toEqual({ thirstChoice: 'salve' });
    f.delete('thirstChoice');
    f.delete('never-set');
    expect(rec).toEqual({});
    f.set('a', 1);
    f.clear();
    expect(rec).toEqual({});
    expect(writes).toEqual([
      ['thirstChoice', 'salve'],
      ['thirstChoice', undefined],
      ['a', 1],
      ['', undefined],
    ]);
  });

  it('serialises: the flags round-trip through the profile envelope', () => {
    const p = freshProfile('demo', 'test');
    const f = new FlagStore(() => p.flags);
    f.set('cantorMercy', false);
    f.set('litanySeenCount', 3);
    f.set('choice.s2-4', 'awake');
    const back = readProfile(encode('profile', p), 'demo', 'test')!.profile;
    expect(back.flags).toEqual({ cantorMercy: false, litanySeenCount: 3, 'choice.s2-4': 'awake' });
  });
});

describe('save schema v3 (CON-0008)', () => {
  it('a fresh profile has no flags and the current version', () => {
    const p = freshProfile('demo', 'test');
    expect(SAVE_VERSION).toBe(3);
    expect(p.version).toBe(3);
    expect(p.flags).toEqual({});
  });

  it('migrates v2 → v3 with empty flags, keeping everything else', () => {
    const v2 = {
      version: 2,
      edition: 'demo',
      build: 'b',
      contentIds: 1,
      progress: { chapter: 1, step: 4 },
      best: { 'op1-1': { rank: 'A', score: 10 } },
      unlocks: ['x'],
      playtime: 9,
      createdAt: 'c',
      updatedAt: 'u',
    };
    const { data, from } = migrate(v2);
    expect(from).toBe(2);
    expect(data.version).toBe(3);
    expect(data.flags).toEqual({});
    expect(data.best).toEqual(v2.best);
    expect(data.progress).toEqual({ chapter: 1, step: 4 });
    // The chain from v1 reaches v3 too.
    const fromV1 = migrate({ version: 1, progress: { chapter: 0, step: 0 }, best: {}, volume: 0.5 });
    expect(fromV1.data.version).toBe(3);
    expect(fromV1.data.flags).toEqual({});
    expect('volume' in fromV1.data).toBe(false);
  });

  it('a v2 envelope loads as a v3 profile with empty flags (codec round trip)', () => {
    const v2 = {
      version: 2,
      edition: 'demo',
      build: 'b',
      contentIds: 1,
      progress: { chapter: 0, step: 2 },
      best: {},
      unlocks: [],
      playtime: 0,
      createdAt: 'c',
      updatedAt: 'u',
    };
    const r = readProfile(encode('profile', v2), 'demo', 'test')!;
    expect(r.migratedFrom).toBe(2);
    expect(r.profile.version).toBe(3);
    expect(r.profile.flags).toEqual({});
    const again = readProfile(encode('profile', r.profile), 'demo', 'test')!;
    expect(again.migratedFrom).toBeNull();
    expect(again.profile.flags).toEqual({});
  });

  it('sanitises flags: bad keys, values and overflow are dropped, never thrown', () => {
    expect(sanitizeFlags(null)).toEqual({});
    expect(sanitizeFlags([1, 2])).toEqual({});
    const dirty: Record<string, unknown> = {
      ok: true,
      n: 1.5,
      s: 'x',
      nan: Number.NaN,
      inf: Infinity,
      obj: { a: 1 },
      arr: [1],
      nul: null,
      '': true,
      long: 'y'.repeat(FLAG_LIMITS.string + 1),
    };
    dirty['k'.repeat(FLAG_LIMITS.key + 1)] = true;
    expect(sanitizeFlags(dirty)).toEqual({ ok: true, n: 1.5, s: 'x' });
    const many: Record<string, number> = {};
    for (let i = 0; i < FLAG_LIMITS.count + 50; i++) many[`f${i}`] = i;
    expect(Object.keys(sanitizeFlags(many))).toHaveLength(FLAG_LIMITS.count);
    expect(sanitizeProfile({ flags: 'nope' }, 'demo', 'b').flags).toEqual({});
  });
});

describe('conditions (CON-0009)', () => {
  it('declarative conditions: truthy, equality, unset, all/any/not', () => {
    const f = new FlagStore();
    f.set('a', true);
    f.set('b', 'turned');
    f.set('c', 0);
    const cases: [FlagCondition, boolean][] = [
      [{ flag: 'a' }, true],
      [{ flag: 'c' }, false],
      [{ flag: 'zz' }, false],
      [{ flag: 'b', is: 'turned' }, true],
      [{ flag: 'b', is: 'natural' }, false],
      [{ flag: 'c', is: 0 }, true],
      [{ flag: 'zz', unset: true }, true],
      [{ flag: 'c', unset: true }, false],
      [{ all: [{ flag: 'a' }, { flag: 'b', is: 'turned' }] }, true],
      [{ all: [{ flag: 'a' }, { flag: 'c' }] }, false],
      [{ any: [{ flag: 'c' }, { flag: 'a' }] }, true],
      [{ any: [{ flag: 'c' }, { flag: 'zz' }] }, false],
      [{ not: { flag: 'c' } }, true],
      [(r) => Number(r.get('c')) === 0, true],
    ];
    for (const [c, want] of cases) expect(evalCondition(c, f), describeCondition(c)).toBe(want);
    expect(describeCondition({ all: [{ flag: 'a' }, { not: { flag: 'b', is: 'x' } }, { flag: 'q', unset: true }] })).toBe(
      '`a` is set and not (`b` is "x") and `q` is unset',
    );
    expect(describeCondition(() => true)).toBe('a scripted flag condition');
    expect(conditionReads({ any: [{ flag: 'a' }, { all: [{ not: { flag: 'b' } }, () => true] }] })).toEqual(['a', 'b']);
  });

  it('lines with `if` are kept by resolveStory and decided live by lineShownNow', () => {
    const story: StoryDef = {
      id: 't',
      place: 'p',
      backdrop: 'hospice',
      lines: [n('always'), ...onlyIf({ flag: 'x' }, say('ilse', 'only with x')), ...onlyIf({ flag: 'x', is: false }, say('ilse', 'only without x'))],
    };
    expect(resolveStory(story).lines).toHaveLength(3);
    expect(lineShown(story.lines[1])).toBe(true); // no reader: outcome conditions only
    expect(lineShownNow(story.lines[1])).toBe(false);
    expect(lineShownNow(story.lines[2])).toBe(false); // unset ≠ false
    flags.set('x', true);
    expect(lineShownNow(story.lines[1])).toBe(true);
    flags.set('x', false);
    expect(lineShownNow(story.lines[1])).toBe(false);
    expect(lineShownNow(story.lines[2])).toBe(true);
    expect(describeLine(story.lines[1])).toBe('Variant line: shown only if `x` is set.');
    expect(describeLine(story.lines[0])).toBeUndefined();
  });

  it('onlyIf does not mutate the lines it marks', () => {
    const base = say('ilse', 'hello');
    const [marked] = onlyIf({ flag: 'x' }, base);
    expect(base.if).toBeUndefined();
    expect(marked.if).toEqual({ flag: 'x' });
    expect(marked.text).toBe('hello');
  });
});

describe('campaign branch nodes (CON-0007)', () => {
  const st: StoryDef = { id: 'x', place: 'p', backdrop: 'hospice', lines: [n('a')] };
  const ch: Chapter = {
    id: 't',
    numeral: 'T',
    title: 't',
    steps: [
      { kind: 'story', story: st },
      { kind: 'story', story: { ...st, id: 'mercy-only' }, if: { flag: 'cantorMercy' } },
      { kind: 'story', story: { ...st, id: 'awake-only' }, if: { flag: 'cantorMercy', is: false } },
      { kind: 'story', story: { ...st, id: 'end' } },
    ],
  };

  it('a step with a failing condition is skipped and later indices are unchanged', () => {
    const f = new FlagStore();
    expect(nextOpenStep(ch, 0, f)).toBe(0);
    expect(nextOpenStep(ch, 1, f)).toBe(3); // neither branch until the flag exists
    f.set('cantorMercy', true);
    expect(nextOpenStep(ch, 1, f)).toBe(1);
    expect(nextOpenStep(ch, 2, f)).toBe(3);
    f.set('cantorMercy', false);
    expect(nextOpenStep(ch, 1, f)).toBe(2);
    expect(nextOpenStep(ch, 4, f)).toBe(4); // past the end stays past the end
    expect(stepId(ch.steps[1])).toBe('mercy-only');
    expect(stepOpen(ch.steps[3], f)).toBe(true);
  });

  it('only the dead man’s pulse (NAR-0136) and the three ending scenes carry a step condition', () => {
    const conditional = FULL_CAMPAIGN.flatMap((c) => c.steps.filter((s) => (s as Step).if).map(stepId));
    expect(conditional).toEqual(['op4-5', 's5-end', 's5-end-pyre', 's5-end-exile']);
  });
});

describe('choice nodes (CON-0010) and s2-4 (NAR-0062)', () => {
  it('s2-4: Stroh demands the cantor live; Kreuzer has two replies that set cantorMercy', () => {
    const choice = STORY_2_4.lines.find((l) => l.choice);
    expect(choice).toBeDefined();
    expect(STORY_2_4.lines.slice(0, STORY_2_4.lines.indexOf(choice!)).some((l) => l.who === 'stroh' && /keep him alive/.test(l.text))).toBe(true);
    expect(choice!.choice).toHaveLength(2);
    expect(choice!.choice!.map((o) => o.set)).toEqual([{ cantorMercy: true }, { cantorMercy: false }]);
    for (const o of choice!.choice!) expect(o.text.length).toBeLessThanOrEqual(140);
    // Each reply has its own Stroh line, and both paths end on the same beat.
    const mercy = STORY_2_4.lines.filter((l) => l.if && evalCondition(l.if, { get: () => true, has: () => true, truthy: () => true }));
    const awake = STORY_2_4.lines.filter((l) => l.if && evalCondition(l.if, { get: () => false, has: () => true, truthy: () => false }));
    expect(mercy).toHaveLength(1);
    expect(awake).toHaveLength(1);
    expect(mercy[0].who).toBe('stroh');
    expect(awake[0].who).toBe('stroh');
    expect(STORY_2_4.lines[STORY_2_4.lines.length - 1].text).toBe('On the table. Now.');
    expect(CHAPTER_2.flags).toEqual({ reads: ['cantorMercy'], writes: ['cantorMercy'] });
  });

  it('the loc export lists reply options as <line>.o<k> with their flag writes in the context', () => {
    const i = STORY_2_4.lines.findIndex((l) => l.choice);
    const opts = choiceEntries(STORY_2_4, i, 'ch2');
    expect(opts.map((o) => o.id)).toEqual([`s2-4.${String(i + 1).padStart(3, '0')}.o1`, `s2-4.${String(i + 1).padStart(3, '0')}.o2`]);
    expect(opts[0].context).toContain('`cantorMercy` = true');
    expect(opts[0].speaker).toBe('Dr. Kreuzer');
    const all = storyEntries(STORY_2_4, 'ch2', 'Story scene');
    expect(all.filter((e) => e.id.endsWith('.o1') || e.id.endsWith('.o2'))).toHaveLength(2);
    expect(all.find((e) => e.id === `s2-4.${String(i + 1).padStart(3, '0')}`)!.context).toContain('Choice prompt');
    expect(choiceEntries(STORY_2_4, 0, 'ch2')).toEqual([]);
  });

  /** A StoryScene driven by frames; the pushed choice overlay is captured rather than rendered. */
  function drive(story: StoryDef, withPush = true) {
    const input = new Input(null, 1280, 720, bindings);
    let pushed: Scene | null = null;
    let done = false;
    const game: Game = {
      input,
      audio: { play: () => undefined } as unknown as Game['audio'],
      gfx: null as unknown as Game['gfx'],
      go: () => undefined,
      ...(withPush ? { push: (s: Scene) => void (pushed = s), pop: () => void (pushed = null) } : {}),
    };
    const scene = new StoryScene(story, () => (done = true));
    let t = 1000;
    const frame = (dt = 1) => {
      t += dt * 1000;
      input.beginFrame(t, dt);
      scene.update(dt, game);
    };
    const peek = () => scene as unknown as { i: number; picks: Map<number, number>; backlog(): { who: string; text: string }[] };
    return { scene, game, frame, peek, pushed: () => pushed, done: () => done };
  }

  const scripted: StoryDef = {
    id: 'tc',
    place: 'p',
    backdrop: 'hospice',
    lines: [
      say('stroh', 'Keep him alive.'),
      choose('narrator', 'Stroh waits.', [
        { id: 'mercy', text: 'He is a patient.', set: { cantorMercy: true } },
        { id: 'awake', text: 'Alive and awake.', set: { cantorMercy: false } },
      ]),
      ...onlyIf({ flag: 'cantorMercy' }, say('stroh', 'Mercy, then.')),
      ...onlyIf({ flag: 'cantorMercy', is: false }, say('stroh', 'Good.')),
      say('kreuzer', 'On the table.'),
    ],
  };

  it('the scene offers the replies once the prompt is read, records the pick, writes its flags and skips the other branch', () => {
    const d = drive(scripted);
    // Read line 0 and advance past it (a long frame types everything out; a second finishes the click).
    frameThrough(d, 0);
    expect(d.peek().i).toBe(1);
    expect(d.pushed()).toBeNull();
    d.frame(2); // the prompt types out and the choice opens
    expect(d.pushed()).not.toBeNull();
    d.frame(1); // waiting on the answer: nothing advances
    expect(d.peek().i).toBe(1);
    d.scene.choose(1, d.game);
    expect(flags.get('cantorMercy')).toBe(false);
    expect(flags.get('choice.tc')).toBe('awake');
    expect(d.peek().picks.get(1)).toBe(1);
    expect(d.peek().i).toBe(3); // the mercy line was skipped
    expect(scripted.lines[d.peek().i].text).toBe('Good.');
    expect(d.scene.choose(0, d.game)).toBeUndefined(); // a choice cannot be answered twice
    expect(flags.get('cantorMercy')).toBe(false);
    // The backlog carries the reply as Kreuzer's line.
    expect(
      d
        .peek()
        .backlog()
        .map((l) => l.text),
    ).toEqual(['Keep him alive.', 'Stroh waits.', 'Alive and awake.', 'Good.']);
    frameThrough(d, 3);
    expect(scripted.lines[d.peek().i].text).toBe('On the table.');
    frameThrough(d, 4);
    expect(d.done()).toBe(true);
  });

  it('without a scene stack the first reply is taken; a scene resumed with the flag set skips straight to its branch', () => {
    const d = drive(scripted, false);
    frameThrough(d, 0);
    d.frame(2);
    expect(flags.get('cantorMercy')).toBe(true);
    expect(scripted.lines[d.peek().i].text).toBe('Mercy, then.');
    // A scene whose first lines are conditional opens on the first line that holds.
    const tail: StoryDef = { ...scripted, id: 'tail', lines: scripted.lines.slice(2) };
    const e = drive(tail);
    expect(tail.lines[e.peek().i].text).toBe('Mercy, then.');
    expect(
      e
        .peek()
        .backlog()
        .map((l) => l.text),
    ).toEqual(['Mercy, then.']);
    // And a scene where nothing holds ends at once.
    flags.clear();
    const none: StoryDef = { ...scripted, id: 'none', lines: [...onlyIf({ flag: 'never' }, n('unseen'))] };
    const f = drive(none);
    f.frame(0.1);
    expect(f.done()).toBe(true);
  });

  /** Type the current line out and click past it. */
  function frameThrough(d: ReturnType<typeof drive>, expectAt: number): void {
    expect(d.peek().i).toBe(expectAt);
    d.frame(5); // long enough to type any test line
    (d.game.input as Input).pressed = true;
    d.scene.update(0.05, d.game);
    (d.game.input as Input).pressed = false;
  }
});

describe('chapter flag contracts (NAR-0116, NAR-0131, NAR-0145)', () => {
  const reader = (f: FlagStore) => f;
  const declaredWrites = new Set(FULL_CAMPAIGN.flatMap((c) => c.flags?.writes ?? []));
  const allWriters = new Set([...declaredWrites, ...ENGINE_FLAG_WRITES]);

  it('every chapter declares its flag io', () => {
    for (const c of FULL_CAMPAIGN) expect(c.flags, c.id).toBeDefined();
  });

  it.each(FULL_CAMPAIGN.map((c) => [c.id, c] as const))(
    '%s: declared writes match the choices and operations that write, declared reads cover every condition',
    (_id, c) => {
      const actualWrites = new Set<string>();
      const actualReads = new Set<string>();
      for (const s of c.steps) {
        if (s.if) for (const r of conditionReads(s.if)) actualReads.add(r);
        if (s.kind === 'op') {
          const w = OP_FLAG_WRITES[s.op.id];
          if (w) for (const rank of ['XS', 'S', 'A', 'B', 'C'] as const) for (const k of Object.keys(w(rank))) actualWrites.add(k);
          continue;
        }
        for (const l of s.story.lines) {
          if (l.if) for (const r of conditionReads(l.if)) actualReads.add(r);
          for (const o of l.choice ?? []) for (const k of Object.keys(o.set ?? {})) actualWrites.add(k);
        }
      }
      expect([...actualWrites].sort()).toEqual([...(c.flags?.writes ?? [])].sort());
      for (const r of actualReads) expect(c.flags?.reads, `${c.id} reads ${r} without declaring it`).toContain(r);
    },
  );

  it('every flag a chapter reads is written by some chapter or by the engine', () => {
    for (const c of FULL_CAMPAIGN) for (const r of c.flags?.reads ?? []) expect(allWriters.has(r), `${c.id} reads ${r}, which nothing writes`).toBe(true);
  });

  it('every choice has 2–3 distinct replies with ids, and every reply writes at least one flag', () => {
    for (const c of FULL_CAMPAIGN)
      for (const s of c.steps) {
        if (s.kind !== 'story') continue;
        for (const l of s.story.lines) {
          if (!l.choice) continue;
          expect(l.choice.length, `${s.story.id}: ${l.text}`).toBeGreaterThanOrEqual(2);
          expect(l.choice.length).toBeLessThanOrEqual(3);
          expect(new Set(l.choice.map((o) => o.id)).size).toBe(l.choice.length);
          for (const o of l.choice) {
            expect(o.id, `${s.story.id} reply "${o.text}" needs an id`).toBeDefined();
            expect(Object.keys(o.set ?? {}).length, `${s.story.id} reply "${o.text}" writes nothing`).toBeGreaterThan(0);
            expect(o.text.length).toBeLessThanOrEqual(140);
          }
        }
      }
  });

  it('s3-1 answers the s2-4 choice and the Litany count; s3-2 branches on the certificate', () => {
    const f = new FlagStore();
    const shown = (s: StoryDef) => s.lines.filter((l) => lineShown(l, {}, reader(f))).map((l) => l.text);
    f.set('cantorMercy', true);
    expect(shown(STORY_3_1).some((t) => /poppy/.test(t))).toBe(true);
    expect(shown(STORY_3_1).some((t) => /talked/.test(t))).toBe(false);
    expect(shown(STORY_3_1).some((t) => /candle/.test(t))).toBe(false);
    f.set('cantorMercy', false);
    f.set('litanySeenCount', 2);
    expect(shown(STORY_3_1).some((t) => /talked/.test(t))).toBe(true);
    expect(shown(STORY_3_1).some((t) => /candle/.test(t))).toBe(true);
    f.set('hornchildCertificate', 'turned');
    expect(shown(STORY_3_2).some((t) => /She is seven/.test(t))).toBe(true);
    expect(shown(STORY_3_2).some((t) => /Two signatures/.test(t))).toBe(false);
    f.set('hornchildCertificate', 'natural');
    expect(shown(STORY_3_2).some((t) => /Two signatures/.test(t))).toBe(true);
  });

  it('operation outcomes write flags by rank (CON-0129, CON-0136)', () => {
    const f = new FlagStore();
    applyOpFlags('op3-9', 'C', f);
    expect(f.get('strohTooth')).toBe(true);
    applyOpFlags('op3-11', 'XS', f);
    expect(f.get('hallerFate')).toBe('hands');
    applyOpFlags('op3-11', 'B', f);
    expect(f.get('hallerFate')).toBe('scarred');
    applyOpFlags('op3-11', 'C', f);
    expect(f.get('hallerFate')).toBe('lost');
    applyOpFlags('op1-1', 'S', f);
    expect(Object.keys(f.all())).toEqual(['strohTooth', 'strohToothFine', 'hallerFate']);
  });
});

describe('demo carry-over of flags (CON-0093)', () => {
  it('a demo profile’s flags arrive verbatim in the full-game profile and are listed in the report', () => {
    const demo = freshProfile('demo', 'demo-build');
    demo.progress = { chapter: 2, step: 0 };
    demo.flags = { cantorMercy: true, 'choice.s2-4': 'mercy', litanySeenCount: 2 };
    const steps = FULL_CAMPAIGN.map((c) => c.steps.map(stepId));
    const { profile, report } = importDemoProfile(demo, indexCampaign(steps), 'full-build');
    expect(profile.flags).toEqual(demo.flags);
    expect(profile.flags).not.toBe(demo.flags);
    expect(report.flags.sort()).toEqual(['cantorMercy', 'choice.s2-4', 'litanySeenCount']);
    // Read back through the codec, the flags are still there.
    expect(readProfile(encode('profile', profile), 'full', 'full-build')!.profile.flags).toEqual(demo.flags);
  });
});

describe('NAR-0126 licence vote', () => {
  const texts = (st: FlagStore) => STORY_3_9.lines.filter((l) => lineShown(l, {}, st)).map((l) => l.text);

  it('tallies Chapters I–III campaign wins only, and carries the vote at an A average', () => {
    const st = new FlagStore();
    expect(licenceKept(st)).toBe(true);
    noteGuildRank('op1-1', 'S', st);
    noteGuildRank('op2-3', 'B', st);
    noteGuildRank('op4-1', 'C', st);
    expect([st.get('guildMarks'), st.get('guildOps')]).toEqual([4, 2]);
    expect(licenceKept(st)).toBe(true);
    noteGuildRank('op3-1', 'C', st);
    expect(licenceKept(st)).toBe(false);
  });

  it('s3-9 reads out exactly one tally, matching the average', () => {
    const kept = new FlagStore();
    noteGuildRank('op1-1', 'XS', kept);
    const lost = new FlagStore();
    noteGuildRank('op1-1', 'C', lost);
    const k = texts(kept).join(' ');
    const l = texts(lost).join(' ');
    expect(k).toContain('The licence stands');
    expect(k).not.toContain('suspended');
    expect(l).toContain('suspended');
    expect(l).not.toContain('The licence stands');
  });
});

describe('Chapter IV verdict and trust branches (NAR-0136, NAR-0139, NAR-0143)', () => {
  const shown = (st: StoryDef, f: FlagStore) =>
    st.lines
      .filter((l) => lineShown(l, {}, f))
      .map((l) => l.text)
      .join(' ');
  const op45 = CHAPTER_4.steps.find((s) => stepId(s) === 'op4-5')!;

  it('certifying von Salm dead closes op4-5, burns him, and moves Stroh’s trust', () => {
    const dead = new FlagStore();
    dead.set('deadManVerdict', 'dead');
    const alive = new FlagStore();
    alive.set('deadManVerdict', 'entranced');
    expect(stepOpen(op45, dead)).toBe(false);
    expect(stepOpen(op45, alive)).toBe(true);
    expect(shown(STORY_4_5, dead)).toContain('He breathed');
    expect(shown(STORY_4_5, alive)).not.toContain('He breathed');
    expect(strohTrust(dead) - strohTrust(alive)).toBe(1);
  });

  it('Stroh takes the charter lapse and serves the warrant by trust', () => {
    const high = new FlagStore();
    high.set('strohTooth', true);
    const low = new FlagStore();
    expect(shown(STORY_4_8, high)).toContain('honest ledger');
    expect(shown(STORY_4_8, low)).toContain('share a patron');
    expect(shown(STORY_4_END, high)).toContain('prisoner of the Ash Tribunal');
    expect(shown(STORY_4_END, high)).not.toContain('hands where I can see');
    expect(shown(STORY_4_END, low)).toContain('hands where I can see');
  });
});
