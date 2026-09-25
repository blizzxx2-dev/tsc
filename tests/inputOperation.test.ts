import { describe, expect, it } from 'vitest';
import { dist } from '../src/core/math';
import { lancetSnap, magnet, zonesFor } from '../src/input/assist';
import { BloodPool, Bubo, Embedded, Grub, Incision, Laceration, Rot, Venom } from '../src/surgery/entities';
import type { Entity } from '../src/surgery/entity';
import { FIELD, type Operation, type OperationOptions } from '../src/surgery/operation';
import type { ToolId } from '../src/surgery/types';
import { defWith, fakePad, Harness, line } from './inputHarness';

const C = { x: 660, y: 410 };
const off = (dx: number, dy = 0) => ({ x: C.x + dx, y: C.y + dy });

function harness(spawn: (op: Operation) => Entity[], tools?: ToolId[]) {
  return new Harness(defWith(spawn, tools));
}
const first = <T>(h: Harness, cls: new (...a: never[]) => T): T => h.op.entities.find((e) => e instanceof cls) as T;

describe('timestamped event queue (INP-0013, INP-0019)', () => {
  it('hold time is measured from the event time, not the frame', () => {
    const h = harness(() => [new Rot(off(200, 100), 20)]);
    h.op.setTool('tincture');
    // One 100 ms frame; the press lands 90 ms into it.
    h.move(C, 1).down('mouse:0', 90).tick(0.1, false);
    expect(h.op.injectT).toBeGreaterThan(0.005);
    expect(h.op.injectT).toBeLessThan(0.015);
  });

  it('a short cut that presses and releases inside one frame still lances a bubo', () => {
    const h = harness(() => [new Bubo(C, 22)]);
    h.move(off(-10), 1).down('mouse:0', 2).move(off(10), 2.5).up('mouse:0', 3).tick();
    expect(first(h, Bubo).lanced).toBe(true);
  });

  it('a tool hotkey pressed just before the click applies first (Digit2 then click grabs with the Tongs)', () => {
    const h = harness(() => [new Embedded(C, 'shot')]);
    h.move(C, 1).key('Digit2', 2).down('mouse:0', 4).tick();
    expect(h.op.tool).toBe('tongs');
    expect(first(h, Embedded).grabbed).toBe(true);
    // The other order: the click lands with the Lancet first.
    const h2 = harness(() => [new Embedded(C, 'shot'), new Rot(off(300, 0), 20)]);
    h2.move(C, 1).down('mouse:0', 2).key('Digit2', 4).tick();
    expect(first(h2, Embedded).grabbed).toBe(false);
  });
});

describe('pointer robustness (INP-0006, INP-0017, INP-0064)', () => {
  const extractionSetup = () => {
    const h = harness(() => [new Embedded(C, 'shard', 0, false)]);
    h.op.setTool('tongs');
    const e = first(h, Embedded);
    h.move(e.handle).down().tick();
    // Pull it clear of the body (anything left on the body sinks back in).
    for (const p of line(e.handle, { x: e.handle.x, y: FIELD.cy - FIELD.ry - 80 }, 12).slice(1)) h.move(p).tick();
    return { h, e };
  };

  it('a normal release after pulling it off the body extracts', () => {
    const { h, e } = extractionSetup();
    h.up().tick();
    expect(e.alive).toBe(false);
  });

  it('pointercancel mid-drag is a release that snaps the object back, unrated', () => {
    const { h, e } = extractionSetup();
    const rated = h.op.counts.cool + h.op.counts.good + h.op.counts.bad;
    h.input.mouse.down(0, 0, 0, 0); // mirror the held button in the adapter
    h.input.mouse.cancel(h.t + 2);
    h.tick();
    expect(e.alive).toBe(true);
    expect(e.grabbed).toBe(false);
    expect(dist(e.pos, e.origin)).toBeLessThan(1);
    expect(h.op.counts.cool + h.op.counts.good + h.op.counts.bad).toBe(rated);
    expect(h.input.down).toBe(false);
    expect(h.captured()).toBeNull();
  });

  it('a > 200 px jump breaks the stroke instead of drawing a giant segment', () => {
    const h = harness(() => [new Laceration(C, 0, 120, 0)]);
    h.op.setTool('thread');
    h.move(off(-200, -30)).down().tick();
    h.move(off(200, 30)).tick();
    const lac = first(h, Laceration);
    expect(lac.stitch.count).toBe(0);
    // Still holding: nothing more is dispatched until the button is pressed again.
    h.move(off(200, -30)).tick();
    expect(lac.stitch.count).toBe(0);
  });

  it('starting a star while the Tongs hold something puts it back and records the star', () => {
    const h = harness(() => [new Embedded(C, 'shard', 0, false)]);
    h.op.setTool('tongs');
    const e = first(h, Embedded);
    h.move(e.handle).down().tick();
    h.move({ x: e.handle.x - 40, y: e.handle.y }).tick();
    h.down('mouse:2').tick();
    expect(e.grabbed).toBe(false);
    expect(dist(e.pos, e.origin)).toBeLessThan(1);
    h.move({ x: 500, y: 300 }).tick();
    expect(h.ctl.starTrail.length).toBeGreaterThan(1);
  });
});

describe('Target Size assist: hit-scale 1.5× on every interaction (INP-0066)', () => {
  type Case = {
    name: string;
    tool: ToolId;
    spawn: (op: Operation) => Entity[];
    at: (h: Harness) => { x: number; y: number };
    hold?: number;
    opts?: OperationOptions;
    ok: (h: Harness) => boolean;
  };
  const cases: Case[] = [
    {
      name: 'Incision start (22 px)',
      tool: 'lancet',
      spawn: () => [new Incision([off(-100), off(100)])],
      at: () => off(-100, 22 * 1.3),
      ok: (h) => h.captured() instanceof Incision,
    },
    {
      name: 'Tongs on an arrow shaft (20 px)',
      tool: 'tongs',
      spawn: () => [new Embedded(C, 'bolt', 0, false)],
      at: (h) => ({ x: first(h, Embedded).handle.x, y: first(h, Embedded).handle.y + 20 * 1.3 }),
      ok: (h) => first(h, Embedded).grabbed,
    },
    {
      name: 'Lancet nick on a barbed arrow (30 px)',
      tool: 'lancet',
      spawn: () => [new Embedded(C, 'arrow', 0, true)],
      at: () => off(0, 30 * 1.3),
      ok: (h) => first(h, Embedded).nicks === 1,
    },
    {
      name: 'Leech-Pipe on a pool (r + 10 px)',
      tool: 'leech',
      spawn: () => [new BloodPool(C, 20), new Rot(off(300), 20)],
      at: () => off(30 * 1.3),
      hold: 0.1,
      ok: (h) => (first(h, BloodPool)?.r ?? 0) < 19,
    },
    {
      name: 'Salve brush (24–26 px)',
      tool: 'salve',
      spawn: () => [new Rot(C, 36)],
      at: () => off(36 + 18 + 8),
      hold: 0.05,
      ok: (h) => first(h, Rot).cov.cells.some((c) => c.done),
    },
    {
      name: 'Brand on a grub (20 px)',
      tool: 'brand',
      spawn: (op) => [new Grub(C, op, 0)],
      at: () => off(20 * 1.3),
      hold: 0.1,
      ok: (h) => first(h, Grub).heat > 0,
    },
    {
      name: 'Tongs on a grub (18 px)',
      tool: 'tongs',
      spawn: (op) => [new Grub(C, op, 0)],
      at: () => off(18 * 1.3),
      ok: (h) => h.cues.includes('pluck'),
    },
    {
      name: 'Lancet on a bubo (r + 6 px)',
      tool: 'lancet',
      spawn: () => [new Bubo(C, 22)],
      at: () => off(28 * 1.3),
      // A single press lances only with the simple-gestures assist (otherwise it takes a short cut).
      opts: { assists: { simpleGestures: true } },
      ok: (h) => first(h, Bubo).lanced,
    },
    {
      name: 'Tincture on venom (26 px)',
      tool: 'tincture',
      spawn: (op) => [new Venom(C, op, 0)],
      at: () => off(26 * 1.3),
      hold: 1.0,
      ok: (h) => !first(h, Venom),
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const results = [1, 1.5].map((scale) => {
        const h = new Harness(defWith(c.spawn), c.opts);
        h.b.prefs.hitScale = scale as 1 | 1.5;
        h.op.setTool(c.tool);
        h.cues.length = 0;
        h.move(c.at(h)).down().tick();
        if (c.hold) h.run(c.hold);
        return c.ok(h);
      });
      expect(results).toEqual([false, true]);
    });
  }

  it('Scrying Lens reveal (90 px)', () => {
    const results = [1, 1.5].map((scale) => {
      const h = harness(() => {
        const r = new Rot(C, 20);
        r.hidden = true;
        return [r, new Rot(off(300), 20)];
      });
      h.b.prefs.hitScale = scale as 1 | 1.5;
      h.op.setTool('lens');
      h.move(off(90 * 1.3)).tick();
      h.run(0.6);
      return !h.op.entities.find((e) => e instanceof Rot && e.pos.x === C.x)!.hidden;
    });
    expect(results).toEqual([false, true]);
  });

  it('trace tolerance scales too: 34 px slip becomes 51 px', () => {
    const h = harness(() => [new Incision([off(-150), off(150)])]);
    h.b.prefs.hitScale = 1.5;
    h.op.setTool('lancet');
    h.move(off(-150)).down().tick();
    for (let x = -140; x <= 0; x += 10) h.move(off(x, 45)).tick();
    expect(h.op.counts.bad).toBe(0);
    expect(first(h, Incision).progress).toBeGreaterThan(100);
  });

  it('magnet is the identity at 1×', () => {
    const h = harness((op) => [new Grub(C, op, 0)]);
    const z = zonesFor(h.op, 'brand');
    expect(magnet(off(25), z, 1, ['hold']).p).toEqual(off(25));
  });
});

describe('Toggle-hold and the hold key (INP-0032, INP-0033)', () => {
  it('Brand toggle sears a grub without the button held', () => {
    const h = harness((op) => [new Grub(C, op, 0), new Rot(off(300), 20)]);
    h.b.prefs.holdMode = 'toggle';
    h.op.setTool('brand');
    h.move(C).down().up('mouse:0', 5).tick();
    expect(h.ctl.latched).toBe(true);
    h.run(1.0);
    expect(first(h, Grub)).toBeUndefined();
    // A second click stops it.
    h.down().up('mouse:0', 5).tick();
    expect(h.ctl.latched).toBe(false);
  });

  it('moving off the body stops a toggled hold', () => {
    const h = harness(() => [new Rot(off(300), 20)]);
    h.b.prefs.holdMode = 'toggle';
    h.op.setTool('tincture');
    h.move(C).down().up('mouse:0', 5).tick();
    h.move({ x: 50, y: 50 }).tick();
    expect(h.ctl.latched).toBe(false);
  });

  it('the hold key acts as the primary button for hold tools', () => {
    const h = harness((op) => [new Grub(C, op, 0), new Rot(off(300), 20)]);
    h.op.setTool('brand');
    h.move(C).down('key:ShiftLeft').tick();
    h.run(1.0);
    expect(first(h, Grub)).toBeUndefined();
  });
});

describe('assisted stitching (INP-0039)', () => {
  const runAlong = (on: boolean) => {
    const h = harness(() => [new Laceration(C, 0, 88, 0), new Rot(off(300), 20)]);
    h.b.prefs.assistedStitch = on ? 'on' : 'off';
    h.op.setTool('thread');
    // Hold and slide along the wound 10 px above it, never crossing it.
    h.move(off(-50, -10)).down().tick();
    for (let x = -50; x <= 50; x += 4) h.move(off(x, -10)).tick();
    h.up().tick();
    return h;
  };
  it('running along the wound places the stitches, capped at GOOD', () => {
    const h = runAlong(true);
    expect(first(h, Laceration)).toBeUndefined();
    expect(h.op.counts.good).toBe(1);
    expect(h.op.counts.cool).toBe(0);
  });
  it('without the assist the same movement stitches nothing', () => {
    const h = runAlong(false);
    expect(first(h, Laceration).stitch.count).toBe(0);
  });
});

describe('tool switching (INP-0049, INP-0051, INP-0050, INP-0086)', () => {
  it('quick-swap: 1 → 4 → Tab returns to Lancet, Tab again returns to Gut Thread', () => {
    const h = harness(() => [new Rot(off(300), 20)]);
    h.key('Digit1').tick();
    h.key('Digit4').tick();
    expect(h.op.tool).toBe('thread');
    h.key('Tab').tick();
    expect(h.op.tool).toBe('lancet');
    h.key('Tab').tick();
    expect(h.op.tool).toBe('thread');
  });

  it('wheel wraps around the tray unless wrapping is off', () => {
    const h = harness(() => [new Rot(off(300), 20)], ['lancet', 'tongs']);
    h.at(1, { type: 'wheel', code: 'wheel:up' } as never).tick();
    expect(h.op.tool).toBe('tongs');
    h.b.prefs.wrapWheel = false;
    h.at(1, { type: 'wheel', code: 'wheel:down' } as never).tick();
    expect(h.op.tool).toBe('tongs');
  });

  it('radial menu: hold middle, flick towards a tool, release to take it; a tiny flick cancels', () => {
    const h = harness(() => [new Rot(off(300), 20)], ['lancet', 'tongs', 'leech', 'thread']);
    h.move(C).down('mouse:1').tick();
    expect(h.ctl.radial.isOpen).toBe(true);
    h.move(off(80, 0)).tick(); // right = slot 3 of 8 (clockwise from the top: lancet, tongs, leech…)
    h.up('mouse:1').tick();
    expect(h.op.tool).toBe('leech');
    h.move(C).down('mouse:1').tick();
    h.move(off(5, 5)).tick();
    h.up('mouse:1').tick();
    expect(h.op.tool).toBe('leech');
  });

  it('GAM-0056: the wheel has 8 slots, runs the world at 0.35× while open (not stacking with the Litany)', () => {
    const h = harness(() => [new Rot(off(300), 20)], ['lancet', 'tongs', 'leech', 'thread']);
    h.move(C).down('mouse:1').tick();
    expect(h.ctl.radial.tools.length).toBe(8);
    expect(h.op.wheelOpen).toBe(true);
    expect(h.op.timeScale).toBeCloseTo(0.35);
    h.op.litanyTime = 5;
    expect(h.op.timeScale).toBeCloseTo(Math.min(0.35, h.op.tuning.litany.scale));
    h.op.litanyTime = 0;
    // A slot outside the kit (the Tincture, lower left) cannot be taken.
    h.move(off(-60, 60)).tick();
    h.up('mouse:1').tick();
    expect(h.op.tool).toBe('lancet');
    expect(h.op.wheelOpen).toBe(false);
    expect(h.op.timeScale).toBe(1);
  });

  it('GAM-0056: tapping Q steps back one instrument; holding it opens the wheel', () => {
    const h = harness(() => [new Rot(off(300), 20)], ['lancet', 'tongs', 'leech', 'thread']);
    h.op.setTool('leech');
    h.key('KeyQ').tick();
    expect(h.op.tool).toBe('tongs');
    expect(h.ctl.radial.isOpen).toBe(false);
    h.move(C).down('key:KeyQ').tick();
    expect(h.op.tool).toBe('lancet');
    for (let i = 0; i < 20; i++) h.tick();
    expect(h.ctl.radial.isOpen).toBe(true);
    expect(h.op.tool).toBe('tongs'); // the hold undid its own step back
    h.move(off(60, 60)).tick(); // lower right = slot 4 of 8 (thread)
    h.up('key:KeyQ').tick();
    expect(h.op.tool).toBe('thread');
    expect(h.ctl.radial.isOpen).toBe(false);
  });

  it('gamepad: RB cycles on release; LB+RB held 0.6 s speaks the Litany without cycling', () => {
    const h = harness(() => [new Rot(off(300), 20)], ['lancet', 'tongs', 'leech']);
    h.setPads([fakePad({ buttons: { 5: 1 } })]).tick();
    expect(h.op.tool).toBe('lancet');
    h.setPads([fakePad()]).tick();
    expect(h.op.tool).toBe('tongs');
    h.setPads([fakePad({ buttons: { 4: 1, 5: 1 } })]);
    h.run(0.7);
    expect(h.op.litanyUsed).toBe(true);
    h.setPads([fakePad()]).tick();
    expect(h.op.tool).toBe('tongs');
  });
});

describe('gamepad cursor and aim assist (INP-0083, INP-0084, INP-0085)', () => {
  it('RT presses at the virtual cursor', () => {
    const h = new Harness(
      defWith(() => [new Bubo(C, 22)]),
      { assists: { simpleGestures: true } },
    );
    h.move(C).tick();
    h.setPads([fakePad({ buttons: { 7: 1 } })]).tick();
    expect(first(h, Bubo).lanced).toBe(true);
  });

  it('aim assist halves cursor speed within 30 px of a valid target', () => {
    const speed = (near: boolean) => {
      const h = harness((op) => [new Grub(C, op, 0)]);
      h.op.setTool('brand');
      h.move(near ? off(10) : off(-300)).tick();
      h.setPads([fakePad({ axes: [1, 0, 0, 0] })]);
      h.tick().tick(); // ramp up, and let the controller install the assist hook
      const x0 = h.input.pos.x;
      h.tick(0.01);
      return h.input.pos.x - x0;
    };
    expect(speed(true) / speed(false)).toBeCloseTo(0.5, 1);
  });

  it('with the Lancet, a gamepad press snaps onto the incision progress node', () => {
    const h = harness(() => [new Incision([off(-100), off(100)])]);
    expect(lancetSnap(h.op, off(-80, 30))).toEqual(off(-100));
    h.move(off(-80, 30)).tick();
    h.setPads([fakePad({ buttons: { 7: 1 } })]).tick();
    expect(h.input.pos).toEqual(off(-100));
    expect(h.cues).toContain('cut');
  });
});

describe('pause and focus (INP-0007, INP-0077)', () => {
  it('focus loss and controller disconnects request a pause; the notice clears on reconnect', () => {
    const h = harness(() => [new Rot(off(300), 20)]);
    h.input.focusChange(true, h.t + 1);
    h.tick();
    expect(h.ctl.pauseRequest(h.input)).toBe('pause');
    h.setPads([fakePad()]).tick();
    h.setPads([]).tick();
    expect(h.ctl.pauseRequest(h.input)).toBe('pause');
    expect(h.ctl.disconnectNotice).toBe(true);
    h.setPads([fakePad()]).tick();
    h.ctl.pauseRequest(h.input);
    expect(h.ctl.disconnectNotice).toBe(false);
  });
});
