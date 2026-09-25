import { describe, expect, it } from 'vitest';
import { AudioEngine } from '../../src/audio/engine';
import { Ducker, DUCKING, resolveMix, SnapshotStack, SNAPSHOTS, MUTE_DB } from '../../src/audio/mixer';
import { pickVariation, VoiceManager } from '../../src/audio/voices';
import { FakeContext, FakeNode, type FakeParam } from './fake-context';

function fakeEngine(): { engine: AudioEngine; ctx: FakeContext } {
  const ctx = new FakeContext();
  const engine = new AudioEngine(() => ctx as unknown as BaseAudioContext);
  engine.offline = true;
  engine.prefs.muted = false;
  engine.prefs.mono = false;
  engine.unlock();
  return { engine, ctx };
}

const reaches = (from: FakeNode, to: FakeNode, depth = 12): boolean => {
  if (from === to) return true;
  if (depth === 0) return false;
  return from.outputs.some((o) => o instanceof FakeNode && reaches(o, to, depth - 1));
};

describe('bus graph', () => {
  it('routes world and hud through sfx, and every bus through the master safety chain', () => {
    const { engine, ctx } = fakeEngine();
    const b = engine.buses as unknown as Record<string, { input: FakeNode; out: FakeNode }>;
    const sfx = engine.sfxBus as unknown as { input: FakeNode; out: FakeNode };
    const master = engine.masterIn as unknown as FakeNode;
    expect(reaches(b.world.out, sfx.input, 1)).toBe(true);
    expect(reaches(b.hud.out, sfx.input, 1)).toBe(true);
    expect(reaches(sfx.out, master, 1)).toBe(true);
    for (const bus of ['music', 'ui', 'vo', 'ambience']) expect(reaches(b[bus].out, master, 1), bus).toBe(true);
    // world must not bypass sfx straight to master.
    expect(b.world.out.outputs.includes(master)).toBe(false);
    // master → range compressor → limiter → ceiling → mono → balance → focus → destination
    const kinds: string[] = [];
    let n: FakeNode | undefined = master;
    while (n && kinds.length < 10) {
      kinds.push(n.kind);
      n = n.outputs.find((o): o is FakeNode => o instanceof FakeNode);
    }
    expect(kinds).toEqual(['gain', 'compressor', 'compressor', 'shaper', 'gain', 'panner', 'gain', 'destination']);
    expect(reaches(b.world.out, ctx.destination)).toBe(true);
  });

  it('safety limiter: −6 dB threshold, 20:1, 3 ms attack, 100 ms release', () => {
    const { engine } = fakeEngine();
    const l = engine.limiter as unknown as Record<string, FakeParam>;
    expect(l.threshold.value).toBe(-6);
    expect(l.ratio.value).toBe(20);
    expect(l.attack.value).toBeCloseTo(0.003);
    expect(l.release.value).toBeCloseTo(0.1);
  });

  it('applies persisted 0–100 bus volumes live', () => {
    const { engine } = fakeEngine();
    engine.prefs.music = 50;
    engine.prefs.ambience = 0;
    engine.applyPrefs();
    const music = (engine.buses.music.input.gain as unknown as FakeParam).target;
    const amb = (engine.buses.ambience.input.gain as unknown as FakeParam).target;
    expect(music).toBeGreaterThan(0);
    expect(music).toBeLessThan(0.3);
    expect(amb).toBe(0);
    engine.muted = true;
    expect((engine.masterIn!.gain as unknown as FakeParam).target).toBe(0);
    engine.muted = false;
  });

  it('mono folds the master to one channel', () => {
    const { engine, ctx } = fakeEngine();
    engine.prefs.mono = true;
    engine.applyPrefs();
    const mono = ctx.nodes.find((n) => n.kind === 'gain' && n.channelCountMode === 'explicit')!;
    expect(mono.channelCount).toBe(1);
    engine.prefs.mono = false;
    engine.applyPrefs();
    expect(mono.channelCount).toBe(2);
  });
});

describe('voice manager', () => {
  const add = (vm: VoiceManager, event: string, prio: number, start: number, log: string[]) =>
    vm.add({ event, prio, start, end: 100, bus: 'world', stop: () => log.push(`${event}@${start}`) });

  it('steals the oldest voice of an event at its limit', () => {
    const vm = new VoiceManager();
    const log: string[] = [];
    for (let i = 0; i < 4; i++) {
      expect(vm.admit('stitch', 50, 4, i)).toBe(true);
      add(vm, 'stitch', 50, i, log);
    }
    expect(vm.admit('stitch', 50, 4, 5)).toBe(true);
    expect(log).toEqual(['stitch@0']);
    expect(vm.count('stitch')).toBe(3);
  });

  it('at the global cap steals the lowest priority, then the oldest; refuses a lower-priority newcomer', () => {
    const vm = new VoiceManager(3);
    const log: string[] = [];
    add(vm, 'a', 50, 0, log);
    add(vm, 'b', 10, 1, log);
    add(vm, 'c', 10, 2, log);
    expect(vm.admit('d', 60, 8, 3)).toBe(true);
    expect(log).toEqual(['b@1']);
    add(vm, 'd', 60, 3, log);
    expect(vm.admit('e', 5, 8, 4)).toBe(false);
    expect(vm.admit('e', 10, 8, 4)).toBe(true);
    expect(log).toEqual(['b@1', 'c@2']);
  });

  it('caps the whole engine at 48 voices', () => {
    const { engine } = fakeEngine();
    for (let i = 0; i < 200; i++) engine.play('sfx.lancet.cut', { priority: 50 + (i % 5) });
    for (let i = 0; i < 200; i++) engine.play('ui.hover');
    expect(engine.voices.count()).toBeLessThanOrEqual(48);
  });

  it('never repeats a variation immediately', () => {
    let last: number | undefined;
    for (let i = 0; i < 500; i++) {
      const v = pickVariation(4, last);
      expect(v).not.toBe(last);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(4);
      last = v;
    }
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) seen.add(pickVariation(4, undefined));
    expect(seen.size).toBe(4);
  });
});

describe('loops', () => {
  it('1 000 hold/release cycles leave no active loops or voices', () => {
    const { engine } = fakeEngine();
    for (let i = 0; i < 1000; i++) {
      const h = engine.startLoop(i % 2 ? 'loop.leech.suck' : 'loop.brand.sizzle', { intensity: 0.5 });
      expect(h).not.toBeNull();
      engine.setParam(h, 'intensity', 0.8);
      engine.stopLoop(h);
    }
    expect(engine.activeLoops).toBe(0);
    expect(engine.voices.count()).toBe(0);
  });

  it('stops within 50 ms of release', () => {
    const { engine } = fakeEngine();
    let t = 1;
    engine.clock = () => t;
    const h = engine.startLoop('loop.lancet.cut', { speed: 1 });
    t = 2;
    engine.stopLoop(h);
    const g = (h as unknown as { gain: { gain: FakeParam } }).gain.gain;
    const last = g.events[g.events.length - 1];
    expect(last.value).toBe(0);
    expect(last.time - 2).toBeLessThanOrEqual(0.05);
  });
});

describe('snapshots', () => {
  it('resolve by priority, per parameter', () => {
    const m = resolveMix(['default', 'lowVitals', 'litany']);
    expect(m.worldRate).toBeCloseTo(0.6);
    expect(m.bus.world.lpf).toBe(1200);
    expect(m.shelfDb).toBe(-6);
    expect(m.reverbDb).toBe(6);
    const p = resolveMix(['default', 'litany', 'pause']);
    expect(p.bus.world.db).toBe(MUTE_DB);
    expect(p.bus.music.lpf).toBe(800);
    expect(p.bus.music.db).toBe(-6);
    expect(p.bus.ambience.db).toBe(-12);
    expect(p.bus.ui.db).toBe(0);
    expect(p.bus.vo.db).toBe(0);
  });

  it('stack transitions carry the entering/exiting snapshot fade', () => {
    const st = new SnapshotStack();
    st.push('litany');
    expect(st.fade).toBeCloseTo(0.4);
    expect(st.list()[0]).toBe('litany');
    st.push('pause');
    expect(st.list()).toEqual(['pause', 'litany', 'default']);
    st.pop('pause');
    expect(st.fade).toBeCloseTo(SNAPSHOTS.pause.exit);
    st.pop('litany');
    expect(st.fade).toBeCloseTo(0.6);
    st.pop('default');
    expect(st.list()).toEqual(['default']);
    const v = st.version;
    st.push('menu');
    st.push('menu');
    expect(st.version).toBe(v + 1);
  });

  it('every snapshot fades in 300 ms unless specified', () => {
    for (const id of ['default', 'pause', 'vn', 'results', 'menu'] as const) expect(SNAPSHOTS[id].enter).toBeCloseTo(0.3);
  });
});

describe('ducking', () => {
  it('barks duck music −8 dB and ambience −6 dB with 80 ms attack and 400 ms release', () => {
    const d = new Ducker();
    d.trigger('bark', 0, 1);
    expect(d.level('music', 0.04)).toBeCloseTo(-4, 1);
    expect(d.level('music', 0.5)).toBeCloseTo(-8);
    expect(d.level('ambience', 0.5)).toBeCloseTo(-6);
    expect(d.level('world', 0.5)).toBe(0);
    expect(d.level('music', 1.2)).toBeCloseTo(-4, 1);
    expect(d.level('music', 1.41)).toBe(0);
  });

  it('rating stings dip music −3 dB for 250 ms; the deepest duck wins', () => {
    const d = new Ducker();
    d.trigger('sting', 0);
    expect(d.level('music', 0.1)).toBeCloseTo(-3);
    d.trigger('bark', 0.1, 1);
    expect(d.level('music', 0.3)).toBeCloseTo(-8);
    expect(DUCKING.sting.hold).toBeCloseTo(0.25);
  });
});
