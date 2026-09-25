import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Input } from '../src/core/input';
import { ActionState } from '../src/input/actionState';
import { DEFAULT_BINDINGS } from '../src/input/actions';
import { Bindings, BINDINGS_KEY, migrate, type StorageLike } from '../src/input/bindings';
import { codeLabel, detectGlyphSet, dragGlyphFor, glyphFor, keyLabel, setLayoutLabels, toolKeyLabel } from '../src/input/glyphs';
import { MouseAdapter } from '../src/input/mouse';
import type { InputEvent, InputEventBody } from '../src/input/types';
import { WheelNormaliser } from '../src/input/wheel';

function memStorage(init: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...init };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

function frame(input: Input, t: number, evs: InputEventBody[], dt = 1 / 60): void {
  evs.forEach((e, i) => input.push({ ...e, t: t - 10 + i * 0.1 } as InputEvent));
  input.beginFrame(t, dt);
}

describe('action map (INP-0004)', () => {
  it('no scene reads physical keys: no key()/keyPressed() calls with literals anywhere in src', () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith('.ts')) files.push(p);
      }
    };
    walk(join(__dirname, '..', 'src'));
    const offenders = files.filter((f) => /\.(keyPressed|key)\(\s*['"`]/.test(readFileSync(f, 'utf8')) || (/['"](Key[A-Z]|Digit\d)['"]/.test(readFileSync(f, 'utf8')) && !f.endsWith(join('input', 'actions.ts')) && !f.endsWith(join('surgery', 'types.ts'))));
    expect(offenders).toEqual([]);
  });

  it('keys map to actions with press/release edges', () => {
    const input = new Input(null, 1280, 720, new Bindings(null));
    frame(input, 100, [{ type: 'down', code: 'key:Digit3' }]);
    expect(input.actPressed('tool.select.3')).toBe(true);
    expect(input.act('tool.select.3')).toBe(true);
    frame(input, 120, [{ type: 'up', code: 'key:Digit3' }]);
    expect(input.actReleased('tool.select.3')).toBe(true);
    expect(input.act('tool.select.3')).toBe(false);
  });

  it('a press and a release inside one frame both register (INP-0013)', () => {
    const input = new Input(null, 1280, 720, new Bindings(null));
    frame(input, 100, [
      { type: 'down', code: 'mouse:0' },
      { type: 'up', code: 'mouse:0' },
    ]);
    expect(input.pressed).toBe(true);
    expect(input.released).toBe(true);
    expect(input.down).toBe(false);
    expect(input.timeline.flatMap((e) => e.edges.map((x) => x.kind))).toEqual(['press', 'release']);
  });

  it('wheel steps pulse tool.next / tool.prev', () => {
    const input = new Input(null, 1280, 720, new Bindings(null));
    frame(input, 100, [{ type: 'wheel', code: 'wheel:down' }]);
    expect(input.actPressed('tool.next')).toBe(true);
    expect(input.wheel).toBe(1);
  });

  it('LB/RB cycle on release; the LB+RB chord casts after 0.6 s and never cycles (INP-0086/0087)', () => {
    const s = new ActionState((id) => [...DEFAULT_BINDINGS[id].kbm, ...DEFAULT_BINDINGS[id].pad]);
    const z = { lx: 0, ly: 0, rx: 0, ry: 0 };
    s.beginFrame();
    expect(s.feed({ t: 0, type: 'down', code: 'pad:4' }).filter((e) => e.action.startsWith('tool.'))).toEqual([]);
    s.beginFrame();
    const rel = s.feed({ t: 50, type: 'up', code: 'pad:4' });
    expect(rel.filter((e) => e.action === 'tool.prev').map((e) => e.kind)).toEqual(['press', 'release']);

    s.beginFrame();
    s.feed({ t: 100, type: 'down', code: 'pad:4' });
    s.feed({ t: 110, type: 'down', code: 'pad:5' });
    s.endFrame(400, z);
    expect(s.pressed('litany.key')).toBe(false);
    s.beginFrame();
    s.endFrame(720, z);
    expect(s.pressed('litany.key')).toBe(true);
    s.beginFrame();
    const ups = [...s.feed({ t: 800, type: 'up', code: 'pad:4' }), ...s.feed({ t: 810, type: 'up', code: 'pad:5' })];
    expect(ups.some((e) => e.action === 'tool.prev' || e.action === 'tool.next')).toBe(false);
  });

  it('menu directions repeat after 180 ms every 80 ms, from keys and the left stick (INP-0079)', () => {
    const s = new ActionState((id) => [...DEFAULT_BINDINGS[id].kbm, ...DEFAULT_BINDINGS[id].pad]);
    const z = { lx: 0, ly: 0, rx: 0, ry: 0 };
    const fired: number[] = [];
    s.beginFrame();
    s.feed({ t: 0, type: 'down', code: 'key:ArrowDown' });
    s.endFrame(0, z);
    if (s.repeated('ui.down')) fired.push(0);
    for (let t = 16; t <= 400; t += 16) {
      s.beginFrame();
      s.endFrame(t, z);
      if (s.repeated('ui.down')) fired.push(t);
    }
    expect(fired[0]).toBe(0);
    expect(fired[1]).toBeGreaterThanOrEqual(180);
    expect(fired[1]).toBeLessThan(200);
    expect(fired[2] - fired[1]).toBeGreaterThanOrEqual(64);
    expect(fired[2] - fired[1]).toBeLessThanOrEqual(96);
    const s2 = new ActionState((id) => [...DEFAULT_BINDINGS[id].kbm, ...DEFAULT_BINDINGS[id].pad]);
    s2.beginFrame();
    s2.endFrame(0, { lx: 0.8, ly: 0, rx: 0, ry: 0 });
    expect(s2.pressed('ui.right')).toBe(true);
  });

  it('Nintendo layout swaps confirm and back', () => {
    const b = new Bindings(null);
    b.prefs.nintendoLayout = true;
    const input = new Input(null, 1280, 720, b);
    frame(input, 100, [{ type: 'down', code: 'pad:1' }]);
    expect(input.actPressed('ui.confirm')).toBe(true);
    expect(input.actPressed('ui.back')).toBe(false);
  });
});

describe('wheel normalisation (INP-0008)', () => {
  it('30 trackpad events of 4 px produce at most 2 steps', () => {
    const w = new WheelNormaliser();
    let steps = 0;
    for (let i = 0; i < 30; i++) steps += Math.abs(w.feed(4, 0, i * 8));
    expect(steps).toBeGreaterThanOrEqual(1);
    expect(steps).toBeLessThanOrEqual(2);
  });
  it('one mouse notch (100 px or 3 lines) is one step; separate notches each step', () => {
    const w = new WheelNormaliser();
    expect(w.feed(100, 0, 0)).toBe(1);
    expect(w.feed(100, 0, 60)).toBe(1);
    expect(w.feed(-3, 1, 400)).toBe(-1);
  });
  it('a long trackpad flick with momentum is one step', () => {
    const w = new WheelNormaliser();
    let steps = 0;
    for (let i = 0; i < 12; i++) steps += w.feed(30 - i * 2, 0, i * 9);
    expect(steps).toBe(1);
  });
  it('the mouse adapter emits normalised wheel events (and honours invert)', () => {
    const evs: InputEvent[] = [];
    const m = new MouseAdapter((e) => evs.push(e));
    m.wheelDelta(120, 0, 0);
    m.invertWheel = true;
    m.wheelDelta(120, 0, 300);
    expect(evs.map((e) => (e.type === 'wheel' ? e.code : ''))).toEqual(['wheel:down', 'wheel:up']);
  });
});

describe('mouse adapter (INP-0006, INP-0011)', () => {
  it('pointercancel releases every held button as a cancel', () => {
    const evs: InputEvent[] = [];
    const m = new MouseAdapter((e) => evs.push(e));
    m.down(0, 10, 10, 1);
    m.down(2, 10, 10, 2);
    m.cancel(3);
    expect(evs.filter((e) => e.type === 'up').map((e) => (e.type === 'up' ? [e.code, e.cancel] : null))).toEqual([
      ['mouse:0', true],
      ['mouse:2', true],
    ]);
    expect(m.held.size).toBe(0);
  });
  it('middle and side buttons are bindable inputs', () => {
    const evs: InputEvent[] = [];
    const m = new MouseAdapter((e) => evs.push(e));
    for (const b of [1, 3, 4]) m.down(b, 0, 0, b);
    expect(evs.filter((e) => e.type === 'down').map((e) => (e.type === 'down' ? e.code : ''))).toEqual(['mouse:1', 'mouse:3', 'mouse:4']);
    const input = new Input(null, 1280, 720, new Bindings(null));
    frame(input, 100, [{ type: 'down', code: 'mouse:3' }]);
    expect(input.actPressed('tool.quickSwap')).toBe(true);
  });
  it('focus loss releases held keys and buttons', () => {
    const input = new Input(null, 1280, 720, new Bindings(null));
    input.mouse.down(0, 5, 5, 90);
    input.keyboard.down('ShiftLeft', 91);
    input.beginFrame(100, 1 / 60);
    expect(input.down).toBe(true);
    input.focusChange(true, 105);
    input.beginFrame(116, 1 / 60);
    expect(input.focusLost).toBe(true);
    expect(input.down).toBe(false);
    expect(input.act('tool.hold')).toBe(false);
  });
});

describe('bindings model (INP-0071, INP-0073)', () => {
  it('defaults come from code; each action has ≤ 2 kbm and ≤ 1 pad binding', () => {
    const b = new Bindings(null);
    for (const { set } of b.all()) {
      expect(set.kbm.length).toBeLessThanOrEqual(2);
      expect(set.pad.length).toBeLessThanOrEqual(1);
    }
    expect(b.get('tool.select.1').kbm).toEqual(['key:Digit1']);
  });

  it('persists overrides under its own versioned key and reloads them', () => {
    const st = memStorage();
    const b = new Bindings(st);
    expect(b.assign('tool.select.1', { kind: 'kbm', index: 0 }, 'key:KeyZ')).toEqual({ ok: true });
    b.prefs.hitScale = 1.5;
    b.save();
    const saved = JSON.parse(st.data[BINDINGS_KEY]);
    expect(saved.version).toBe(2);
    expect(Object.keys(saved.bindings)).toEqual(['tool.select.1']);
    const b2 = new Bindings(st);
    expect(b2.get('tool.select.1').kbm).toEqual(['key:KeyZ']);
    expect(b2.prefs.hitScale).toBe(1.5);
  });

  it('migrates version 1 (flat lists, renamed actions, Litany-on-Space flag)', () => {
    const v2 = migrate({ version: 1, bindings: { 'litany.space': ['key:KeyF', 'pad:3'], 'tool.swap': ['key:KeyR'], bogus: ['key:KeyX'] }, litanySpace: true });
    expect(v2.version).toBe(2);
    expect(v2.bindings['litany.key']).toEqual({ kbm: ['key:KeyF'], pad: ['pad:3'] });
    expect(v2.bindings['tool.quickSwap']).toEqual({ kbm: ['key:KeyR'], pad: [] });
    expect(v2.prefs.litanyInput).toBe('both');
    expect(migrate({ version: 99 })).toEqual({ version: 2, bindings: {}, prefs: {} });
    expect(migrate('garbage')).toEqual({ version: 2, bindings: {}, prefs: {} });
  });

  it('conflicts in a shared context are reported, and Swap trades the bindings', () => {
    const b = new Bindings(null);
    const r = b.assign('tool.select.1', { kind: 'kbm', index: 0 }, 'key:KeyE');
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason === 'conflict' && r.conflicts[0].action).toBe('tool.next');
    expect(b.assign('tool.select.1', { kind: 'kbm', index: 0 }, 'key:KeyE', 'swap')).toEqual({ ok: true });
    expect(b.get('tool.select.1').kbm).toEqual(['key:KeyE']);
    expect(b.get('tool.next').kbm).toEqual(['key:Digit1', 'wheel:down']);
    // Different contexts never conflict (Story vs Operation).
    expect(b.assign('vn.log', { kind: 'kbm', index: 0 }, 'key:KeyQ')).toEqual({ ok: true });
  });

  it('reserved inputs cannot be unbound or stolen', () => {
    const b = new Bindings(null);
    expect(b.clear('pause', { kind: 'kbm', index: 0 }).ok).toBe(false);
    expect(b.assign('pause', { kind: 'kbm', index: 0 }, 'key:KeyP').ok).toBe(false);
    expect(b.clear('primary', { kind: 'kbm', index: 0 }).ok).toBe(false);
    expect(b.clear('pause', { kind: 'pad', index: 0 }).ok).toBe(false);
    const steal = b.assign('tool.quickSwap', { kind: 'kbm', index: 0 }, 'mouse:0');
    expect(steal.ok === false && steal.reason).toBe('reserved');
    expect(b.assign('tool.next', { kind: 'kbm', index: 0 }, 'key:F11').ok).toBe(false);
    expect(b.assign('tool.next', { kind: 'pad', index: 0 }, 'key:KeyX').ok).toBe(false);
  });

  it('per-action and global reset', () => {
    const b = new Bindings(null);
    b.assign('tool.select.2', { kind: 'kbm', index: 0 }, 'key:KeyX');
    b.assign('tool.select.3', { kind: 'kbm', index: 0 }, 'key:KeyC');
    b.reset('tool.select.2');
    expect(b.isDefault('tool.select.2')).toBe(true);
    expect(b.isDefault('tool.select.3')).toBe(false);
    b.resetAll();
    expect(b.isDefault('tool.select.3')).toBe(true);
  });
});

describe('glyphs from bindings (INP-0074, INP-0009, INP-0080)', () => {
  it('rebinding tool.select.1 to KeyZ changes the tray label to "Z"', () => {
    const b = new Bindings(null);
    expect(toolKeyLabel(1, b)).toBe('1');
    b.assign('tool.select.1', { kind: 'kbm', index: 0 }, 'key:KeyZ');
    expect(toolKeyLabel(1, b)).toBe('Z');
  });
  it('prompts name mouse drags, keys and pad buttons', () => {
    const b = new Bindings(null);
    expect(dragGlyphFor('litany.draw', 'kbm', b)).toBe('Right-drag');
    expect(dragGlyphFor('litany.draw', 'pad', b)).toBe('Hold LT');
    expect(glyphFor('litany.key', 'kbm', b)).toBe('Space');
    expect(glyphFor('litany.key', 'pad', b)).toBe('LB+RB');
    expect(codeLabel('pad:0', 'playstation')).toBe('Cross');
    expect(detectGlyphSet('DualSense Wireless Controller (Vendor: 054c Product: 0ce6)')).toBe('playstation');
    expect(detectGlyphSet('Steam Deck Controller (Vendor: 28de)')).toBe('deck');
  });
  it('uses the keyboard layout map for key caps (AZERTY), falling back to US names', () => {
    setLayoutLabels(new Map([['KeyQ', 'a'], ['Digit1', '&']]));
    expect(keyLabel('KeyQ')).toBe('A');
    expect(keyLabel('Digit1')).toBe('&');
    setLayoutLabels(null);
    expect(keyLabel('KeyQ')).toBe('Q');
  });
  it('last-used device switches on pad input and back only after > 4 px of mouse travel', () => {
    const input = new Input(null, 1280, 720, new Bindings(null));
    frame(input, 100, [{ type: 'move', x: 100, y: 100, src: 'kbm' } as never]);
    expect(input.device).toBe('kbm');
    frame(input, 120, [{ type: 'down', code: 'pad:0' }]);
    expect(input.device).toBe('pad');
    frame(input, 140, [{ type: 'move', x: 102, y: 101, src: 'kbm' } as never]);
    expect(input.device).toBe('pad');
    frame(input, 160, [{ type: 'move', x: 106, y: 101, src: 'kbm' } as never]);
    expect(input.device).toBe('kbm');
  });
});
