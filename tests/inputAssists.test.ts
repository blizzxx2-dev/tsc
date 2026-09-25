import { describe, expect, it } from 'vitest';
import { Input, PRECISION_SCALE } from '../src/core/input';
import { dist, type Vec } from '../src/core/math';
import { hoveredGraspable } from '../src/input/assist';
import { Bindings } from '../src/input/bindings';
import { glyphFor } from '../src/input/glyphs';
import { addTray, HudLayer, TRAY, trayFrame, traySide, traySlot, trayX } from '../src/input/hud';
import { CHATTER_MS } from '../src/input/opinput';
import { applyPreset, presetById, presetChanges } from '../src/input/presets';
import { HoldToRetry, RETRY_HOLD } from '../src/input/retry';
import type { InputEvent, InputEventBody } from '../src/input/types';
import { BloodPool, Bubo, Burn, Embedded, Grub, Laceration, Rot, Sigil, SIGILS, StitchLine, Venom } from '../src/surgery/entities';
import type { Entity } from '../src/surgery/entity';
import { FIELD, strokeCrosses, type Operation } from '../src/surgery/operation';
import { freshProgress, hasOperated, recordRun } from '../src/surgery/progress';
import type { Pointer, ToolId } from '../src/surgery/types';
import { VIEW_W } from '../src/ui/layout';
import { defWith, fakePad, Harness, line } from './inputHarness';

const C = { x: 660, y: 410 };
const off = (dx: number, dy = 0) => ({ x: C.x + dx, y: C.y + dy });
/** Somewhere on the body with nothing on it (the required Rot keeps the phase open). */
const FAR = off(300, 0);

function harness(spawn: (op: Operation) => Entity[], tools?: ToolId[], extra: Parameters<typeof defWith>[2] = {}) {
  return new Harness(defWith(spawn, tools, extra));
}
const first = <T>(h: Harness, cls: new (...a: never[]) => T): T => h.op.entities.find((e) => e instanceof cls) as T;

function frame(input: Input, t: number, evs: InputEventBody[], dt = 1 / 60): void {
  evs.forEach((e, i) => input.push({ ...e, t: t - 10 + i * 0.1 } as InputEvent));
  input.beginFrame(t, dt);
}

// ------------------------------------------------------------------ INP-0047

describe('HUD hit-test layer (INP-0047)', () => {
  const withTray = (tools?: ToolId[]) => {
    const h = harness(() => [new Rot(FAR, 20)], tools);
    const layer = new HudLayer();
    addTray(layer, h.op.def.tools);
    h.hud = layer.hit;
    return { h, layer };
  };

  it('a press on a tray slot selects that instrument and never reaches the field', () => {
    const { h } = withTray(['lancet', 'tongs', 'leech']);
    const s = traySlot(1);
    h.move({ x: s.x + s.w / 2, y: s.y + s.h / 2 }).down().up('mouse:0', 5).tick();
    expect(h.op.tool).toBe('tongs');
    expect(h.op.pressId).toBe(0);
  });

  it('a press in the gap between two slots is swallowed by the tray frame; a press beside the tray reaches the field', () => {
    const { h } = withTray(['lancet', 'tongs', 'leech']);
    const s0 = traySlot(0);
    const gap = { x: s0.x + s0.w / 2, y: s0.y + s0.h + TRAY.gap / 2 };
    h.move(gap).down().tick();
    h.run(0.4);
    h.up().tick();
    expect(h.op.pressId).toBe(0);
    expect(h.op.counts.miss).toBe(0);
    // Just outside the frame: the field gets it.
    const frame = trayFrame(3);
    h.move({ x: frame.x + frame.w + 12, y: gap.y }).down().up('mouse:0', 5).tick();
    expect(h.op.pressId).toBe(1);
  });

  it('the callout panel is click-through; the Litany reliquary swallows presses', () => {
    const h = harness(() => [new Rot(FAR, 20)]);
    const layer = new HudLayer();
    layer.add({ kind: 'callout', rect: { x: 240, y: 620, w: 800, h: 80 }, clickThrough: true });
    layer.add({ kind: 'litany', rect: { x: VIEW_W - 100, y: 624, w: 80, h: 80 } });
    h.hud = layer.hit;
    h.move({ x: 640, y: 660 }).down().up('mouse:0', 5).tick();
    expect(h.op.pressId).toBe(1);
    h.move({ x: VIEW_W - 60, y: 664 }).down().up('mouse:0', 5).tick();
    expect(h.op.pressId).toBe(1);
    expect(layer.at({ x: 640, y: 660 })?.kind).toBe('callout');
    expect(layer.hit({ x: 640, y: 660 })).toBeNull();
    expect(layer.hit({ x: VIEW_W - 60, y: 664 })).toBe('consume');
  });

  it('the tray mirrors to the right edge in left-handed mode (INP-0069)', () => {
    const b = new Bindings(null);
    expect(traySide(b)).toBe('left');
    expect(trayX('left')).toBe(TRAY.margin);
    b.prefs.leftHanded = true;
    expect(traySide(b)).toBe('right');
    expect(trayX('right')).toBe(VIEW_W - TRAY.margin - TRAY.w);
    const layer = new HudLayer();
    addTray(layer, ['lancet', 'tongs'], 'right');
    expect(layer.hit({ x: VIEW_W - TRAY.margin - TRAY.w / 2, y: TRAY.y + 10 })).toBe('lancet');
    expect(layer.hit({ x: TRAY.margin + TRAY.w / 2, y: TRAY.y + 10 })).toBeNull();
  });
});

// ------------------------------------------------------------------ INP-0035

describe('Brand healthy-flesh grace (INP-0035)', () => {
  /** Vitals after holding (or merely hovering) the Brand on bare flesh for `seconds`; the Rot's drain is the same in both. */
  const bareFlesh = (seconds: number, hold: boolean) => {
    const h = harness(() => [new Rot(FAR, 20)]);
    h.op.setTool('brand');
    h.move(C).tick();
    if (hold) h.down().tick();
    else h.tick();
    h.run(seconds - 1 / 60);
    return h.op.vitals;
  };

  it('100 ms on bare flesh does no damage; a longer hold does', () => {
    expect(bareFlesh(0.1, true)).toBeCloseTo(bareFlesh(0.1, false), 6);
    expect(bareFlesh(0.3, true)).toBeLessThan(bareFlesh(0.3, false));
    expect(new Harness(defWith(() => [new Rot(FAR, 20)])).op.tuning.brand.fleshGrace).toBe(0.12);
  });

  it('brief contact between two grubs is not penalised', () => {
    // Sear the first grub, then sweep across 160 px of flesh in 80 ms to the second, with and without the grace.
    const sweep = (grace: number) => {
      const h = harness((op) => [new Grub(off(-80), op, 0), new Grub(off(80), op, 0)], undefined, { tuning: { brand: { fleshGrace: grace } } });
      h.op.setTool('brand');
      h.move(off(-80)).down().tick();
      h.run(0.3);
      for (const p of line(off(-80), off(80), 4).slice(1)) h.move(p).tick(0.02);
      return h.op.vitals;
    };
    const control = sweep(10);
    expect(sweep(0.12)).toBeCloseTo(control, 2);
    expect(control - sweep(0)).toBeGreaterThan(0.2);
  });
});

// ------------------------------------------------------------------ INP-0034

describe('button-chatter debounce (INP-0034)', () => {
  it('a release/press bounce within 60 ms does not reset Tincture injection or start a new stroke', () => {
    const h = harness(() => [new Rot(FAR, 20)], undefined, { vitals: 50 });
    h.op.setTool('tincture');
    h.move(C).down().tick();
    h.run(0.4);
    expect(h.op.injectT).toBeGreaterThan(0.35);
    // Worn switch: the button lifts for 30 ms without the pointer moving.
    h.up('mouse:0', 1).down('mouse:0', 31).tick();
    expect(h.op.injectT).toBeGreaterThan(0.4);
    expect(h.op.pressId).toBe(1);
    h.run(0.4);
    expect(h.op.vitals).toBeGreaterThan(50);
  });

  it('a bounce mid-stitch keeps the closure a single stroke (COOL)', () => {
    const h = harness(() => [new Laceration(C, 0, 88, 0), new Rot(FAR, 20)]);
    h.op.setTool('thread');
    const zig = (x: number, up: boolean) => off(x, up ? -14 : 14);
    h.move(zig(-40, true)).down().tick();
    h.move(zig(-33, false)).tick();
    h.move(zig(-11, true)).tick();
    h.up('mouse:0', 1).down('mouse:0', 9).tick();
    h.move(zig(11, false)).tick();
    h.move(zig(33, true)).tick();
    h.up().tick();
    expect(first(h, Laceration)).toBeUndefined();
    expect(h.op.counts.cool).toBe(1);
    expect(h.op.pressId).toBe(1);
  });

  it('a press after the window, or after the pointer moved, is a new stroke', () => {
    const h = harness(() => [new Rot(FAR, 20)]);
    h.op.setTool('tincture');
    h.move(C).down().tick();
    h.up().tick();
    h.run(CHATTER_MS / 1000 + 0.05);
    h.down().tick();
    expect(h.op.pressId).toBe(2);
    h.up('mouse:0', 1).move(off(10), 5).down('mouse:0', 9).tick();
    expect(h.op.pressId).toBe(3);
  });

  it('a bounced click in toggle-hold mode does not toggle the hold straight back off', () => {
    const h = harness((op) => [new Grub(C, op, 0), new Rot(FAR, 20)]);
    h.b.prefs.holdMode = 'toggle';
    h.op.setTool('brand');
    h.move(C).down().up('mouse:0', 5).down('mouse:0', 30).up('mouse:0', 35).tick();
    expect(h.ctl.latched).toBe(true);
  });
});

// ------------------------------------------------------------------ INP-0042 / INP-0044

describe('Tongs grab snapping, hover outline and click-to-toggle (INP-0042, INP-0044)', () => {
  it('the hovered graspable is the nearest grab zone within the radius × Target Size', () => {
    const h = harness((op) => [new Embedded(C, 'bolt', 0, false), new Grub(off(200), op, 0)]);
    const e = first(h, Embedded);
    const beside = (d: number) => ({ x: e.handle.x, y: e.handle.y + d });
    expect(hoveredGraspable(h.op, beside(15))?.entity).toBe(e);
    expect(hoveredGraspable(h.op, beside(26))).toBeNull();
    expect(hoveredGraspable(h.op, beside(26), 1.5)?.entity).toBe(e);
    expect(hoveredGraspable(h.op, off(200 + 12))?.entity).toBe(first(h, Grub));
    h.op.setTool('lancet');
    expect(hoveredGraspable(h.op, beside(15))?.entity).toBe(e);
  });

  it('click-to-toggle: one click seizes, the next lets go; extraction thresholds unchanged', () => {
    const h = harness(() => [new Embedded(C, 'shard', 0, false), new Rot(FAR, 20)]);
    h.b.prefs.grabMode = 'toggle';
    h.op.setTool('tongs');
    const e = first(h, Embedded);
    h.move(e.handle).down().up('mouse:0', 5).tick();
    expect(e.grabbed).toBe(true);
    expect(h.ctl.grabLatched).toBe(true);
    // Carry it off the body with no button held, then click to release.
    for (const p of line(e.handle, { x: e.handle.x, y: FIELD.cy - FIELD.ry - 80 }, 12).slice(1)) h.move(p).tick();
    expect(e.grabbed).toBe(true);
    h.down().up('mouse:0', 5).tick();
    expect(e.alive).toBe(false);
    expect(h.ctl.grabLatched).toBe(false);
  });

  it('click-to-toggle on empty flesh lets go at once: no lingering hold, no MISS', () => {
    const h = harness(() => [new Rot(FAR, 20)]);
    h.b.prefs.grabMode = 'toggle';
    h.op.setTool('tongs');
    h.move(C).down().up('mouse:0', 5).tick();
    expect(h.ctl.grabLatched).toBe(false);
    h.run(0.6);
    expect(h.op.counts.miss).toBe(0);
  });

  it('switching instruments while toggled puts the object back', () => {
    const h = harness(() => [new Embedded(C, 'shard', 0, false), new Rot(FAR, 20)]);
    h.b.prefs.grabMode = 'toggle';
    h.op.setTool('tongs');
    const e = first(h, Embedded);
    h.move(e.handle).down().up('mouse:0', 5).tick();
    h.move({ x: e.handle.x - 30, y: e.handle.y }).tick();
    h.key('Digit1').tick();
    expect(e.grabbed).toBe(false);
    expect(dist(e.pos, e.origin)).toBeLessThan(1);
    expect(h.ctl.grabLatched).toBe(false);
  });
});

// ------------------------------------------------------------------ INP-0048

describe('unavailable-tool feedback (INP-0048)', () => {
  it('a hotkey for an instrument not in the kit shakes the tray and says so once, with no select cue', () => {
    const h = harness(() => [new Rot(FAR, 20)], ['lancet', 'tongs']);
    const popups: string[] = [];
    h.op.events.on('popup', (p) => popups.push(p.text));
    h.cues.length = 0;
    h.key('Digit7').tick();
    expect(h.op.tool).toBe('lancet');
    expect(popups).toEqual(['Not in this case’s kit.']);
    expect(h.ctl.trayShake).toBeGreaterThan(0);
    expect(h.cues).not.toContain('select');
    h.run(0.5);
    expect(h.ctl.trayShake).toBe(0);
    h.key('Digit5').tick();
    expect(popups.length).toBe(1);
    expect(h.ctl.trayShake).toBeGreaterThan(0);
    expect(h.cues).not.toContain('select');
  });
});

// ------------------------------------------------------------------ INP-0052

describe('auto-tool assist: suggest tool on press (INP-0052)', () => {
  const cases: { name: string; spawn: (op: Operation) => Entity[]; tool: ToolId }[] = [
    { name: 'pool → Leech-Pipe', spawn: () => [new BloodPool(C, 24), new Rot(FAR, 20)], tool: 'leech' },
    { name: 'open laceration → Gut Thread', spawn: () => [new Laceration(C, 0, 120, 0)], tool: 'thread' },
    { name: 'grub → Brand', spawn: (op) => [new Grub(C, op, 0)], tool: 'brand' },
    { name: 'lodged shot → Tongs', spawn: () => [new Embedded(C, 'shot')], tool: 'tongs' },
    { name: 'barbed arrow → Lancet first', spawn: () => [new Embedded(C, 'arrow', 0, true)], tool: 'lancet' },
    { name: 'bubo → Lancet', spawn: () => [new Bubo(C, 22)], tool: 'lancet' },
    { name: 'venom → Tincture', spawn: (op) => [new Venom(C, op, 0)], tool: 'tincture' },
    { name: 'rot → Saint’s Salve', spawn: () => [new Rot(C, 36)], tool: 'salve' },
    { name: 'burn flakes → Tongs', spawn: (op) => [new Burn(C, 40, op)], tool: 'tongs' },
    { name: 'sigil → Brand', spawn: () => [new Sigil(C, SIGILS.eye, 60)], tool: 'brand' },
  ];
  for (const c of cases) {
    it(c.name, () => {
      const results = [false, true].map((on) => {
        const h = harness(c.spawn);
        h.b.prefs.autoTool = on;
        h.op.setTool('lens');
        h.move(C).down().tick();
        return h.op.tool;
      });
      expect(results).toEqual(['lens', c.tool]);
    });
  }

  it('off by default, and the right instrument is kept', () => {
    expect(new Bindings(null).prefs.autoTool).toBe(false);
    const h = harness((op) => [new Grub(C, op, 0)]);
    h.b.prefs.autoTool = true;
    h.op.setTool('tongs');
    h.move(C).down().tick();
    expect(h.op.tool).toBe('tongs');
  });
});

// ------------------------------------------------------------------ INP-0067

describe('precision modifier (INP-0067)', () => {
  it('mouse travel is scaled by 0.5 while held and eases back onto the pointer afterwards', () => {
    const input = new Input(null, 1280, 720, new Bindings(null));
    frame(input, 100, [{ type: 'move', x: 100, y: 100, src: 'kbm' }]);
    frame(input, 120, [{ type: 'down', code: 'key:ControlLeft' }, { type: 'move', x: 200, y: 140, src: 'kbm' }]);
    expect(input.act('op.precision')).toBe(true);
    expect(input.pos.x).toBeCloseTo(100 + 100 * PRECISION_SCALE);
    expect(input.pos.y).toBeCloseTo(100 + 40 * PRECISION_SCALE);
    frame(input, 140, [{ type: 'move', x: 300, y: 140, src: 'kbm' }]);
    expect(input.pos.x).toBeCloseTo(200);
    // The recorded frame keeps the raw sample.
    expect(input.frame.events.find((e) => e.type === 'move')).toMatchObject({ x: 300, y: 140 });
    frame(input, 160, [{ type: 'up', code: 'key:ControlLeft' }]);
    let t = 180;
    for (let i = 0; i < 40; i++) frame(input, (t += 16), [{ type: 'move', x: 300 + i, y: 140, src: 'kbm' }]);
    expect(input.pos.x).toBeCloseTo(339, 0);
  });

  it('halves the gamepad cursor speed', () => {
    const speed = (precise: boolean) => {
      const h = harness(() => [new Rot(FAR, 20)]);
      h.move({ x: 100, y: 100 }).tick();
      h.setPads([fakePad({ axes: [1, 0, 0, 0], buttons: precise ? { 10: 1 } : {} })]);
      h.run(0.2);
      const x0 = h.input.pos.x;
      h.tick(0.01);
      return h.input.pos.x - x0;
    };
    expect(speed(true) / speed(false)).toBeCloseTo(PRECISION_SCALE, 1);
  });
});

// ------------------------------------------------------------------ INP-0069

describe('left-handed mode (INP-0069)', () => {
  it('swaps the instrument and the star between the mouse buttons, independently of the stored bindings', () => {
    const b = new Bindings(null);
    b.prefs.leftHanded = true;
    expect(b.effective('primary')).toEqual(['mouse:2', 'pad:7']);
    expect(b.effective('litany.draw')).toEqual(['mouse:0', 'pad:6']);
    expect(b.get('primary').kbm).toEqual(['mouse:0']);
    expect(b.shown('primary').kbm).toEqual(['mouse:2']);
    expect(glyphFor('primary', 'kbm', b)).toBe('Right-click');
    expect(glyphFor('litany.draw', 'kbm', b)).toBe('Left-click');
  });

  it('in an operation the right button uses the instrument and the left draws the star', () => {
    const h = new Harness(defWith(() => [new Bubo(C, 22)]), { assists: { simpleGestures: true } });
    h.b.prefs.leftHanded = true;
    h.move(C).down('mouse:2').up('mouse:2', 5).tick();
    expect(first(h, Bubo).lanced).toBe(true);
    h.move(off(-100, -100)).down('mouse:0').tick();
    h.move(off(100, -100)).tick();
    expect(h.ctl.starTrail.length).toBeGreaterThan(1);
  });
});

// ------------------------------------------------------------------ INP-0113

describe('hold-to-restart (INP-0113)', () => {
  it('fires once after R has been held for a second, and re-arms on release', () => {
    const input = new Input(null, 1280, 720, new Bindings(null));
    const r = new HoldToRetry();
    const dt = 1 / 60;
    let t = 1000;
    const step = (evs: InputEventBody[] = []) => {
      frame(input, (t += dt * 1000), evs, dt);
      return r.update(input, dt);
    };
    expect(step()).toBe(false);
    expect(step([{ type: 'down', code: 'key:KeyR' }])).toBe(false);
    let fired = 0;
    let frames = 0;
    for (let i = 0; i < 90; i++) {
      frames++;
      if (step()) {
        fired++;
        break;
      }
    }
    expect(fired).toBe(1);
    expect(frames * dt).toBeGreaterThanOrEqual(RETRY_HOLD - dt);
    expect(r.progress).toBe(1);
    for (let i = 0; i < 30; i++) expect(step()).toBe(false);
    expect(step([{ type: 'up', code: 'key:KeyR' }])).toBe(false);
    expect(r.progress).toBe(0);
    step([{ type: 'down', code: 'key:KeyR' }]);
    fired = 0;
    for (let i = 0; i < 90; i++) if (step()) fired++;
    expect(fired).toBe(1);
  });

  it('the gamepad View button is the pad binding', () => {
    expect(new Bindings(null).effective('op.retry')).toEqual(['key:KeyR', 'pad:8']);
  });
});

// ------------------------------------------------------------------ INP-0075

describe('binding presets (INP-0075)', () => {
  it('previews the changes against the current setup, then applies them', () => {
    const b = new Bindings(null);
    const left = presetById('left');
    const before = presetChanges(b, left);
    expect(before.map((c) => c.action ?? c.pref)).toEqual(['tool.hold', 'tool.next', 'tool.prev', 'leftHanded']);
    expect(before.find((c) => c.pref === 'leftHanded')).toMatchObject({ from: 'false', to: 'true' });
    applyPreset(b, left);
    expect(presetChanges(b, left)).toEqual([]);
    expect(b.prefs.leftHanded).toBe(true);
    expect(b.effective('primary')).toEqual(['mouse:2', 'pad:7']);
    expect(b.get('tool.hold').kbm).toEqual(['key:ShiftRight']);
    // Back to Default: everything returns, including the preference.
    const def = presetById('default');
    expect(presetChanges(b, def).length).toBe(4);
    applyPreset(b, def);
    expect(b.isDefault('tool.hold')).toBe(true);
    expect(b.prefs.leftHanded).toBe(false);
    expect(presetChanges(b, def)).toEqual([]);
  });

  it('the Trackpad preset toggles holds and grabs, puts the Litany on a key and the wheel on F', () => {
    const b = new Bindings(null);
    b.prefs.hitScale = 1.5;
    const tp = presetById('trackpad');
    const changes = presetChanges(b, tp);
    expect(changes.map((c) => c.action ?? c.pref)).toEqual(['tool.radial', 'holdMode', 'hitScale', 'litanyInput', 'grabMode']);
    applyPreset(b, tp);
    expect(b.prefs.holdMode).toBe('toggle');
    expect(b.prefs.grabMode).toBe('toggle');
    expect(b.prefs.litanyInput).toBe('both');
    expect(b.prefs.hitScale).toBe(1);
    expect(b.effective('tool.radial')).toEqual(['key:KeyF', 'mouse:1', 'pad:3']);
  });
});

// ------------------------------------------------------------------ GAM-0208

describe('operated before? (GAM-0208)', () => {
  it('is false on a fresh save and true after any finished operation', () => {
    const p = freshProgress();
    expect(hasOperated(p)).toBe(false);
    recordRun(p, { opId: 'op1-1', won: false, rank: 'C', score: 0, difficulty: 'surgeon', flags: [] });
    expect(hasOperated(p)).toBe(true);
    const q = freshProgress();
    recordRun(q, { opId: 'op1-1', won: true, rank: 'A', score: 900, difficulty: 'surgeon', flags: [] });
    expect(hasOperated(q)).toBe(true);
  });
});

// ------------------------------------------------------------------ INP-0037

describe('fast-swipe stitching robustness (INP-0037)', () => {
  /** A 500 px/s zig-zag across the wound, sampled at `hz`, as consecutive pointer segments. */
  function zigzag(a: Vec, b: Vec, amp: number, period: number, hz: number, speed = 500): Vec[] {
    const pts: Vec[] = [];
    const len = dist(a, b) + 24;
    const ux = (b.x - a.x) / dist(a, b);
    const uy = (b.y - a.y) / dist(a, b);
    const step = speed / hz;
    for (let s = 0; s <= len; s += step) {
      const x = s - 12;
      const ph = ((x % period) + period) % period;
      const tri = ph < period / 2 ? -1 + (4 * ph) / period : 3 - (4 * ph) / period;
      pts.push({ x: a.x + ux * x - uy * amp * tri, y: a.y + uy * x + ux * amp * tri });
    }
    return pts;
  }

  it('registers ≥ 95 % of the geometric crossings with sub-frame samples', () => {
    const h = harness(() => [new Rot(FAR, 20)]);
    const a = off(-100);
    const b = off(100);
    const sl = new StitchLine([a, b]);
    const reach = h.op.tuning.stitch.endReach;
    const ext = { a: { x: a.x - reach, y: a.y }, b: { x: b.x + reach, y: b.y } };
    const pts = zigzag(a, b, 14, 24, 125);
    let geometric = 0;
    let registered = 0;
    h.op.pressId = 1;
    for (let i = 1; i < pts.length; i++) {
      if (strokeCrosses(pts[i - 1], pts[i], ext.a, ext.b)) geometric++;
      const ptr: Pointer = { pos: pts[i], prev: pts[i - 1], down: true, pressed: false, released: false };
      const before = sl.count;
      sl.sweep(h.op, ptr);
      if (sl.count > before) registered++;
    }
    expect(geometric).toBeGreaterThanOrEqual(15);
    expect(registered / geometric).toBeGreaterThanOrEqual(0.95);
    // Marks sit on the wound, not at the sample that happened to land past it.
    for (const m of sl.marks) expect(Math.abs(m.y - a.y)).toBeLessThan(0.01);
  });

  it('a crossing within 4 px beyond a wound end still counts; further out it does not', () => {
    const h = harness(() => [new Rot(FAR, 20)]);
    const a = off(-60);
    const b = off(60);
    const cross = (x: number) => {
      const sl = new StitchLine([a, b]);
      h.op.pressId++;
      sl.sweep(h.op, { pos: { x, y: a.y + 10 }, prev: { x, y: a.y - 10 }, down: true, pressed: false, released: false });
      return sl.count;
    };
    expect(cross(a.x - 2)).toBe(1);
    expect(cross(b.x + 3)).toBe(1);
    expect(cross(a.x - 6)).toBe(0);
    expect(cross(b.x + 6)).toBe(0);
  });

  it('through the input pipeline at 30 fps a 500 px/s zig-zag closes a laceration in one COOL stroke', () => {
    const h = harness(() => [new Laceration(C, 0, 120, 0), new Rot(FAR, 20)]);
    h.op.setTool('thread');
    const pts = zigzag(off(-60), off(60), 14, 24, 120);
    h.move(pts[0]).down().tick(1 / 30);
    // Four coalesced samples per 30 fps frame.
    for (let i = 1; i < pts.length; i += 4) {
      const chunk = pts.slice(i, i + 4);
      chunk.forEach((p, k) => h.move(p, 4 + k * 8));
      h.tick(1 / 30);
    }
    h.up().tick(1 / 30);
    expect(first(h, Laceration)).toBeUndefined();
    expect(h.op.counts.cool).toBe(1);
  });
});
