/**
 * QAT-0094/0095 schema and validation, QAT-0097 batching, QAT-0098 kill switch (client side),
 * QAT-0101 funnel events: every event the observer emits while bots play the whole demo validates
 * against schema v1; unknown or missing fields fail.
 */
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { allOperations } from '../../../src/content/campaign';
import { OP_1_1, OP_1_2 } from '../../../src/content/chapter1';
import { Operation } from '../../../src/surgery/operation';
import { allows, loadPrefs, parseConfig, PREFS_KEY, readConfig, storageConfigSource, CONFIG_OVERRIDE_KEY } from '../../../src/telemetry/config';
import { EventFactory, quantise, uuid, type EventProps, type TelemetryEvent } from '../../../src/telemetry/events';
import { TelemetryObserver, type SceneInfo } from '../../../src/telemetry/observer';
import { MemoryStore, TelemetryQueue, LocalTransport, type Transport } from '../../../src/telemetry/queue';
import { EVENT_NAMES, eventSchema, type EventName } from '../../../src/telemetry/schema';
import { applyBotEvents, BotDriver } from '../../bot';
import { DT } from '../../helpers/sim';

const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
addFormats(ajv);
const validate = ajv.compile(eventSchema());

const factory = () => new EventFactory({ session: uuid(), install: uuid(), build: '0.1.0-test', flavour: 'qa', now: () => new Date('2026-09-25T12:00:00Z') });

/** Play an op with the bot while an observer records every event. */
function observe(def = OP_1_1, opts: { quitAfter?: number; loseBy?: 'timer' } = {}): TelemetryEvent[] {
  const f = factory();
  const events: TelemetryEvent[] = [];
  const obs = new TelemetryObserver(
    (e, p) => events.push(f.make(e, p)),
    () => ({ timer: 1, litanyKey: false }),
  );
  obs.onScene({ name: 'title' });
  obs.onScene({ name: 'story', story: { id: 'prologue', line: 0, lines: 10, chapter: 1, prologue: true } });
  obs.storyLine(4);
  const op = new Operation(opts.loseBy === 'timer' ? { ...def, timeLimit: 5 } : def);
  obs.onScene({ name: 'operation', op } satisfies SceneInfo);
  const bot = new BotDriver(op);
  for (let f2 = 0; f2 < 60 * 900 && (op.status === 'intro' || op.status === 'running'); f2++) {
    if (opts.quitAfter && f2 === opts.quitAfter) break;
    if (op.status === 'running' && !opts.loseBy) applyBotEvents(op, bot.tick());
    op.update(DT);
    obs.tick();
  }
  if (opts.quitAfter) obs.onScene({ name: 'title' });
  else obs.onScene({ name: 'demoend' });
  obs.onQuit();
  return events;
}

describe('schema v1', () => {
  it('covers every event name with a props schema', () => {
    const schema = eventSchema() as { allOf: unknown[] };
    expect(schema.allOf).toHaveLength(EVENT_NAMES.length);
  });

  it('matches the published JSON file (run scripts/qa/telemetry-schema.mjs after changing it)', () => {
    const published = JSON.parse(readFileSync('docs/qa/telemetry/events.v1.schema.json', 'utf8'));
    expect(published).toEqual(JSON.parse(JSON.stringify(eventSchema())));
  });

  it('rejects unknown fields, missing fields and wrong types', () => {
    const f = factory();
    const ok = f.make('tool_select', { op: 'op1-1', tool: 'lancet' });
    expect(validate(ok), JSON.stringify(validate.errors)).toBe(true);
    expect(validate({ ...ok, extra: 1 })).toBe(false);
    expect(validate({ ...ok, props: { op: 'op1-1', tool: 'lancet', x: 1 } })).toBe(false);
    expect(validate({ ...ok, props: { op: 'op1-1' } })).toBe(false);
    expect(validate({ ...ok, props: { op: 'op1-1', tool: 'spoon' } })).toBe(false);
    const { seq: _seq, ...noSeq } = ok;
    expect(validate(noSeq)).toBe(false);
    expect(validate({ ...ok, event: 'made_up' })).toBe(false);
    const r = f.make('rating', { op: 'op1-1', tool: 'thread', entity: 'Laceration', rating: 'cool', x: 33, y: 64 } as EventProps['rating']);
    expect(validate(r)).toBe(false);
  });
});

describe('observer events validate against the schema', () => {
  it.each(allOperations().map((d) => [d.id, d] as const))('%s bot run', (_id, def) => {
    const events = observe(def);
    const names = new Set(events.map((e) => e.event));
    for (const n of ['title_view', 'new_game', 'chapter_start', 'op_start', 'op_end', 'rating', 'tool_select', 'story_skip', 'demo_end_view'] as EventName[]) {
      if (n === 'tool_select' && def.tools.length === 1) continue;
      expect(names, `${def.id} missing ${n}`).toContain(n);
    }
    for (const e of events) expect(validate(e), `${e.event}: ${JSON.stringify(validate.errors)}`).toBe(true);
    const end = events.find((e): e is TelemetryEvent<'op_end'> => e.event === 'op_end')!;
    expect(end.props.result).toBe('won');
    expect(end.props.counts.cool + end.props.counts.good).toBeGreaterThan(0);
    const ratings = events.filter((e): e is TelemetryEvent<'rating'> => e.event === 'rating');
    expect(ratings.every((r) => r.props.x % 32 === 0 && r.props.y % 32 === 0)).toBe(true);
    expect(ratings.length).toBe(end.props.counts.cool + end.props.counts.good + end.props.counts.bad + end.props.counts.miss);
  });

  it('a lost operation emits op_end(lost) and op_fail with the reason, phase and live kinds', () => {
    const events = observe(OP_1_2, { loseBy: 'timer' });
    const fail = events.find((e): e is TelemetryEvent<'op_fail'> => e.event === 'op_fail')!;
    expect(fail.props).toMatchObject({ op: 'op1-2', reason: 'timer', phase: 0 });
    expect(fail.props.liveKinds).toContain('Embedded');
    for (const e of events) expect(validate(e)).toBe(true);
  });

  it('leaving mid-operation records a quit', () => {
    const events = observe(OP_1_1, { quitAfter: 300 });
    const end = events.find((e): e is TelemetryEvent<'op_end'> => e.event === 'op_end')!;
    expect(end.props.result).toBe('quit');
    expect(events.find((e) => e.event === 'op_fail')?.props).toMatchObject({ reason: 'quit' });
  });

  it('numbers events in sequence and quantises positions', () => {
    const events = observe(OP_1_1);
    expect(events.map((e) => e.seq)).toEqual(events.map((_, i) => i));
    expect(quantise(33, 1280)).toBe(32);
    expect(quantise(-5, 1280)).toBe(0);
    expect(quantise(5000, 1280)).toBe(1280);
  });

  it('observing costs well under 0.1 ms per frame', () => {
    const f = factory();
    let n = 0;
    const obs = new TelemetryObserver(
      () => n++,
      () => ({ timer: 1, litanyKey: false }),
    );
    const op = new Operation(OP_1_1);
    obs.onScene({ name: 'operation', op });
    const bot = new BotDriver(op);
    let observed = 0;
    let frames = 0;
    while ((op.status === 'intro' || op.status === 'running') && frames < 60 * 300) {
      if (op.status === 'running') applyBotEvents(op, bot.tick());
      op.update(DT);
      const t = performance.now();
      obs.tick();
      observed += performance.now() - t;
      frames++;
    }
    expect(f).toBeDefined();
    expect(n).toBeGreaterThan(0);
    expect(observed / frames).toBeLessThan(0.1);
  });
});

describe('client batching', () => {
  const ev = (f: EventFactory, i: number) => f.make('tool_select', { op: `op${i % 10}`, tool: 'lancet' });

  function setup(transport: Transport, opts = {}) {
    let now = 0;
    const store = new MemoryStore();
    const q = new TelemetryQueue(transport, { now: () => now, storage: store, ...opts });
    return { q, store, advance: (ms: number) => (now += ms), f: factory() };
  }

  it('flushes every 60 s, not before', async () => {
    const sent: TelemetryEvent[][] = [];
    const { q, f, advance } = setup({ send: async (b) => void sent.push(b) });
    q.push(ev(f, 1));
    advance(59_000);
    q.tick();
    await Promise.resolve();
    expect(sent).toHaveLength(0);
    advance(1_000);
    q.tick();
    await new Promise((r) => setTimeout(r, 0));
    expect(sent).toHaveLength(1);
    expect(q.size).toBe(0);
  });

  it('caps the offline queue at 1 MB, dropping the oldest', () => {
    const { q, f } = setup({ send: async () => undefined });
    for (let i = 0; i < 20_000; i++) q.push(ev(f, i));
    expect(q.sizeBytes).toBeLessThanOrEqual(1_000_000);
    expect(q.dropped).toBeGreaterThan(0);
    expect(q.snapshot()[0].seq).toBe(q.dropped);
  });

  it('backs off exponentially after failures and keeps the queue', async () => {
    let fail = true;
    const { q, f, advance } = setup({ send: async () => (fail ? Promise.reject(new Error('offline')) : undefined) });
    q.push(ev(f, 1));
    expect(await q.flush()).toBe(false);
    expect(q.failureCount).toBe(1);
    expect(q.backoffDelay(1)).toBe(2_000);
    expect(q.backoffDelay(2)).toBe(4_000);
    expect(q.backoffDelay(3)).toBe(8_000);
    expect(q.backoffDelay(30)).toBe(300_000);
    // Inside the backoff window nothing is attempted.
    advance(1_000);
    expect(await q.flush()).toBe(false);
    expect(q.failureCount).toBe(1);
    advance(1_500);
    expect(await q.flush()).toBe(false);
    expect(q.failureCount).toBe(2);
    fail = false;
    advance(4_000);
    expect(await q.flush()).toBe(true);
    expect(q.failureCount).toBe(0);
    expect(q.size).toBe(0);
  });

  it('persists the offline queue and restores it next session; flushOnQuit delivers', async () => {
    const { q, store, f } = setup({ send: async () => Promise.reject(new Error('offline')) });
    q.push(ev(f, 1));
    q.push(ev(f, 2));
    await q.flushOnQuit();
    const local = new LocalTransport(store);
    const q2 = new TelemetryQueue(local, { storage: store, now: () => 0 });
    expect(q2.size).toBe(2);
    await q2.flushOnQuit();
    expect(local.read()).toHaveLength(2);
    expect(q2.size).toBe(0);
  });
});

describe('consent and kill switch', () => {
  it('starts unasked with a random install id and keeps it', () => {
    const store = new MemoryStore();
    const a = loadPrefs(store);
    expect(a.consent).toBe('unasked');
    expect(a.install).toMatch(/^[0-9a-f-]{36}$/);
    expect(loadPrefs(store)).toEqual(a);
    store.set(PREFS_KEY, '{bad json');
    expect(loadPrefs(store).install).not.toBe(a.install);
  });

  it('config can disable all telemetry or single events; malformed config keeps defaults', async () => {
    const store = new MemoryStore();
    expect(await readConfig(storageConfigSource(store))).toEqual({ enabled: true, disabledEvents: [] });
    store.set(CONFIG_OVERRIDE_KEY, JSON.stringify({ enabled: true, disabledEvents: ['rating', 'bogus'] }));
    const c = await readConfig(storageConfigSource(store));
    expect(c.disabledEvents).toEqual(['rating']);
    expect(allows(c, 'rating')).toBe(false);
    expect(allows(c, 'op_end')).toBe(true);
    expect(allows(parseConfig({ enabled: false }), 'op_end')).toBe(false);
    store.set(CONFIG_OVERRIDE_KEY, '{nope');
    expect(await readConfig(storageConfigSource(store))).toEqual({ enabled: true, disabledEvents: [] });
    expect(await readConfig(async () => Promise.reject(new Error('network')))).toEqual({ enabled: true, disabledEvents: [] });
  });
});
