import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EmitterScheduler, EMITTER_GAP, EMITTERS } from '../../src/audio/ambience';
import { CaptionFeed, wrapSubtitle } from '../../src/audio/captions';
import { patientVoice } from '../../src/audio/director';
import { eventDef, isEventId, resolveEvent, type EventId } from '../../src/audio/events';
import { countCorners, HeartbeatScheduler, QRS_PHASE } from '../../src/audio/heartbeat';
import { RECIPES } from '../../src/audio/sfx';
import { AudioSystem } from '../../src/audio/system';
import { lineId } from '../../src/audio/vo';
import { allOperations } from '../../src/content/campaign';
import { LaudsMalison } from '../../src/surgery/lauds';
import { LITANY_DURATION, Operation } from '../../src/surgery/operation';
import { replay } from './replay';

const SURGERY = join(__dirname, '../../src/surgery');

describe('sim cue ids', () => {
  it('every id the simulation can push has a designed mapping', () => {
    const ids = new Set<string>();
    for (const f of readdirSync(SURGERY).filter((f) => f.endsWith('.ts'))) {
      const src = readFileSync(join(SURGERY, f), 'utf8');
      for (const m of src.matchAll(/cues\.push\(\s*'([^']+)'\s*\)/g)) ids.add(m[1]);
    }
    // rate() pushes the rating name itself.
    for (const r of ['cool', 'good', 'bad', 'miss']) ids.add(r);
    expect(ids.size).toBeGreaterThan(10);
    for (const id of ids) {
      expect(isEventId(id), `${id} is not an event id`).toBe(true);
      const designed = resolveEvent(id as EventId);
      expect(RECIPES[designed] ?? eventDef(designed).loop, `${id} → ${designed} has no recipe`).toBeTruthy();
    }
  });
});

describe('Ch1–2 replay through the audio director', () => {
  for (const def of allOperations()) {
    it(`${def.id}: every sound is designed (0 fallback plays)`, () => {
      const r = replay(def);
      expect(r.op.status).toBe('won');
      expect(r.sys.engine.fallbackPlays, [...r.sys.engine.fallbackIds].join(',')).toBe(0);
      const ids = new Set(r.played.map((p) => p.id));
      for (const id of ids) expect(isEventId(id), id).toBe(true);
      // Some designed action sounds beyond ratings.
      expect([...ids].filter((i) => i.startsWith('sfx.') && !i.startsWith('sfx.rate.')).length).toBeGreaterThan(3);
    });
  }

  it('op1-5 voices the Malison of Matins: hour bell, shroud, rend and unmaking', () => {
    const r = replay(allOperations().find((d) => d.id === 'op1-5')!);
    const ids = new Set(r.played.map((p) => p.id));
    for (const id of ['sfx.bell.matins', 'sfx.matins.shroud', 'sfx.malison.unmade', 'sfx.tool.brand']) expect(ids.has(id), id).toBe(true);
  });

  it('op2-5: the Hymn has its own event, telegraphed ≥ 0.5 s before its tear, and never pushes the Litany cue', () => {
    // The bot may unmake Lauds before it sings, so let it sing unopposed.
    const def = allOperations().find((d) => d.id === 'op2-5')!;
    const sys = new AudioSystem();
    const played: { t: number; id: string }[] = [];
    let t = 0;
    const orig = sys.play.bind(sys);
    sys.play = (id, o = {}) => {
      played.push({ t, id });
      orig(id, o);
    };
    const op = new Operation(def);
    op.status = 'running';
    op.spawn(new LaudsMalison({ x: 660, y: 410 }, op));
    const cues: string[] = [];
    for (; t < 12; t += 1 / 60) {
      op.update(1 / 60);
      cues.push(...op.cues);
      sys.op.frame({ op, dt: 1 / 60, paused: false, beatPhase: 0, bpm: 70, input: { pos: { x: 100, y: 100 }, down: false, pressed: false, released: false, rightDown: false }, keyPressed: () => false });
    }
    expect(cues).not.toContain('litany');
    expect(cues).toContain('sfx.lauds.hymn');
    const hymns = played.filter((p) => p.id === 'sfx.lauds.hymn');
    const blasts = played.filter((p) => p.id === 'sfx.lauds.hymnBlast');
    expect(hymns.length).toBeGreaterThan(0);
    expect(blasts.length).toBeGreaterThan(0);
    for (const b of blasts) {
      const h = [...hymns].reverse().find((x) => x.t <= b.t)!;
      expect(b.t - h.t).toBeGreaterThanOrEqual(0.5);
    }
    // In a full replay any 'litany' cue is the player's own invocation (the frame it starts).
    const r = replay(def);
    for (const c of r.cues.filter((c) => c.cue === 'litany')) expect(c.litanyTime).toBeCloseTo(LITANY_DURATION, 1);
    expect(r.played.some((p) => p.id === 'sfx.bell.lauds')).toBe(true);
  });
});

describe('low-vitals snapshot', () => {
  const def = allOperations()[0];
  const frame = (sys: AudioSystem, op: Operation) =>
    sys.op.frame({ op, dt: 1 / 60, paused: false, beatPhase: 0, bpm: 80, input: { pos: { x: 0, y: 0 }, down: false, pressed: false, released: false, rightDown: false }, keyPressed: () => false });

  it('engages below 30, holds to 35, and is off with "Reduce audio stress"', () => {
    const sys = new AudioSystem();
    sys.engine.prefs.reduceStress = false;
    const op = new Operation(def);
    op.status = 'running';
    op.vitals = 29;
    frame(sys, op);
    expect(sys.engine.snapshots.has('lowVitals')).toBe(true);
    op.vitals = 33;
    frame(sys, op);
    expect(sys.engine.snapshots.has('lowVitals')).toBe(true);
    op.vitals = 36;
    frame(sys, op);
    expect(sys.engine.snapshots.has('lowVitals')).toBe(false);
    sys.engine.prefs.reduceStress = true;
    op.vitals = 10;
    frame(sys, op);
    expect(sys.engine.snapshots.has('lowVitals')).toBe(false);
    sys.engine.prefs.reduceStress = false;
  });

  it('Litany pushes its snapshot and the Stillness treatment, and releases both', () => {
    const sys = new AudioSystem();
    const op = new Operation(def);
    op.status = 'running';
    frame(sys, op);
    op.litanyTime = 8;
    frame(sys, op);
    expect(sys.engine.snapshots.has('litany')).toBe(true);
    expect(sys.music.litany).toBe(true);
    op.litanyTime = 0;
    frame(sys, op);
    expect(sys.engine.snapshots.has('litany')).toBe(false);
    expect(sys.music.litany).toBe(false);
  });
});

describe('heartbeat scheduling', () => {
  it('lands every beat within ±5 ms of the QRS spike despite frame jitter', () => {
    const hb = new HeartbeatScheduler();
    const bpm = 120;
    const period = 60 / bpm;
    let t = 0;
    let phase = 0;
    const scheduled: number[] = [];
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    while (t < 20) {
      const dt = 0.008 + rand() * 0.03;
      t += dt;
      phase = (phase + dt / period) % 1;
      const b = hb.update(phase, bpm, t);
      if (b) scheduled.push(b.at);
    }
    expect(scheduled.length).toBeGreaterThan(35);
    for (const at of scheduled) {
      const k = Math.round((at - QRS_PHASE * period) / period);
      const qrs = k * period + QRS_PHASE * period;
      expect(Math.abs(at - qrs)).toBeLessThan(0.005);
    }
    // Never twice for the same beat.
    for (let i = 1; i < scheduled.length; i++) expect(scheduled[i] - scheduled[i - 1]).toBeGreaterThan(period * 0.9);
  });
});

describe('ambience emitters', () => {
  it('never fire two one-shots within 4 s', () => {
    for (const list of Object.values(EMITTERS)) {
      const s = new EmitterScheduler(list);
      const fired: number[] = [];
      for (let t = 0; t < 900; t += 0.05) if (s.update(0.05).length) fired.push(s.t);
      expect(fired.length).toBeGreaterThan(10);
      for (let i = 1; i < fired.length; i++) expect(fired[i] - fired[i - 1]).toBeGreaterThanOrEqual(EMITTER_GAP - 1e-6);
    }
  });
});

describe('captions and subtitles', () => {
  it('captions de-duplicate, expire and cap at three', () => {
    const c = new CaptionFeed();
    c.push('[A]');
    c.push('[A]');
    c.push('[B]', -1);
    c.push('[C]');
    c.push('[D]');
    expect(c.items.map((x) => x.text)).toEqual(['[B]', '[C]', '[D]']);
    c.update(5);
    expect(c.items).toHaveLength(0);
  });

  it('gameplay-relevant events carry captions', () => {
    for (const id of ['sfx.matins.rejoinWarn', 'sfx.lauds.hymn', 'sfx.vitals.warn30', 'sfx.heart.beat', 'sfx.litany.endWarn', 'sfx.bell.matins', 'loop.grub.chitter'] as EventId[]) expect(eventDef(id).caption, id).toBeTruthy();
  });

  it('subtitles wrap to at most two lines', () => {
    const long = 'It’s singing — every verse tears him open! Stitch the cuts as they come, Doctor, before the next verse lands on him.';
    const lines = wrapSubtitle(long, 40);
    expect(lines.length).toBeLessThanOrEqual(2);
    expect(lines.join(' ')).toBe(long);
  });
});

describe('helpers', () => {
  it('patient voice types', () => {
    expect(patientVoice('Grenn, a dwarf miner', 'dwarf')).toBe(3);
    expect(patientVoice('Mother Agathe, a widow')).toBe(1);
    expect(patientVoice('Old Tomas, a ferryman')).toBe(2);
    expect(patientVoice('Jost, a pikeman')).toBe(0);
  });

  it('counts the corners of a drawn star', () => {
    const pts: { x: number; y: number }[] = [];
    const v = [0, 2, 4, 1, 3, 0].map((i) => ({ x: 300 + 120 * Math.cos(-Math.PI / 2 + (i * 2 * Math.PI) / 5), y: 300 + 120 * Math.sin(-Math.PI / 2 + (i * 2 * Math.PI) / 5) }));
    for (let i = 1; i < v.length; i++) for (let k = 0; k < 20; k++) pts.push({ x: v[i - 1].x + ((v[i].x - v[i - 1].x) * k) / 20, y: v[i - 1].y + ((v[i].y - v[i - 1].y) * k) / 20 });
    expect(countCorners(pts)).toBe(4);
  });

  it('VO line ids are stable and typography-insensitive', () => {
    expect(lineId('It’s singing!')).toBe(lineId("It's  singing!"));
    expect(lineId('Stitch it.')).not.toBe(lineId('Stitch it!'));
    expect(lineId('x')).toMatch(/^line\.[0-9a-f]{8}$/);
  });
});
