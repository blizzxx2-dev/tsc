import { describe, expect, it } from 'vitest';
import { BloodPool, Embedded, Grub, Incision, Laceration, Rot, Sigil, SIGILS } from '../src/surgery/entities';
import { analyseLoop, circlePath, loopRating } from '../src/surgery/gesture';
import { LEAD_DISH, onBody, Reopened, SimpleBurn, TRAY_DISH, type Operation } from '../src/surgery/operation';
import { Anchor, at, Hand, OFF, running, wait, zig } from './harness';

const lastRated = (op: Operation) => [...op.events].reverse().find((e) => e.kind === 'rated') as { rating: string; label?: string } | undefined;
const count = (op: Operation, cls: new (...a: never[]) => unknown) => op.entities.filter((e) => e instanceof cls && e.alive).length;

describe('GAM-C Lancet', () => {
  const line = () => new Incision([at(-120, 0), at(120, 0)]);
  const trace = (offset: number, speed = 300) => {
    const op = running(() => [line(), new Anchor()]);
    new Hand(op).drag('lancet', [at(-120, offset), at(120, offset)], speed);
    return op;
  };

  it('GAM-0021: incision rated by mean path error (≤ 6 COOL, ≤ 14 GOOD, else BAD)', () => {
    expect(lastRated(trace(3))?.rating).toBe('cool');
    expect(lastRated(trace(10))?.rating).toBe('good');
    expect(lastRated(trace(20))?.rating).toBe('bad');
  });

  it('GAM-0021: overshooting the end by > 20 px nicks the flesh', () => {
    const op = running(() => [line(), new Anchor()]);
    new Hand(op).drag('lancet', [at(-120, 0), at(120, 0), at(160, 0)], 300);
    expect(op.entities.some((e) => e instanceof Laceration && e.spawnedBy === 'penalty')).toBe(true);
    const clean = running(() => [line(), new Anchor()]);
    new Hand(clean).drag('lancet', [at(-120, 0), at(130, 0)], 300);
    expect(count(clean, Laceration)).toBe(0);
  });

  it('GAM-0022: rushed strokes (> 1400 px/s) rate BAD; very slow ones (< 60 px/s) cap at GOOD', () => {
    const rushed = trace(0, 2000);
    expect(lastRated(rushed)).toMatchObject({ rating: 'bad', label: 'Rushed' });
    expect(lastRated(trace(0, 40))?.rating).toBe('good');
    expect(lastRated(trace(0, 300))?.rating).toBe('cool');
  });

  it('GAM-0023: guides fade in over 0.3 s and are hidden on Master', () => {
    expect(running(() => [line()]).guides).toBe(true);
    expect(running(() => [line()], {}, { difficulty: 'master' }).guides).toBe(false);
    expect(running(() => [line()], {}, { difficulty: 'master', assists: { guides: true } }).guides).toBe(true);
  });

  it('GAM-0024: encircle-excise — closed loop (gap ≤ 18 px) around a growth; > 25 % through healthy tissue is BAD', () => {
    const c = at(0, 0);
    const good = analyseLoop(circlePath(c, 40), c, 30);
    expect(good).toMatchObject({ closed: true, encloses: true });
    expect(loopRating(good)).toBe('cool');
    const wide = analyseLoop(circlePath(c, 90), c, 30);
    expect(loopRating(wide)).toBe('bad');
    const open = analyseLoop(circlePath(c, 40).slice(0, 36), c, 30);
    expect(open.closed).toBe(false);
    // Gap of 15 px still closes.
    const gappy = circlePath(c, 40, 48).slice(0, 46);
    expect(analyseLoop(gappy, c, 30).closed).toBe(true);
  });

  it('GAM-0025: cutting across a stitched line reopens it (no re-stitch farming: reopened wounds pay nothing)', () => {
    const op = running(() => [new Laceration(at(0, 0), 0, 60, 0.2), new Anchor()]);
    const h = new Hand(op);
    h.drag('thread', zig(at(-30, 0), at(30, 0), 4), 300);
    expect(op.scars.length).toBe(1);
    const before = op.score;
    h.drag('lancet', [at(0, -40), at(0, 40)], 300);
    expect(op.scars.length).toBe(0);
    expect(lastRated(op)).toMatchObject({ rating: 'bad', label: 'Reopened' });
    const re = op.entities.find((e): e is Reopened => e instanceof Reopened)!;
    expect(re.spawnedBy).toBe('penalty');
    const mid = op.score;
    h.drag('thread', zig(re.a, re.b, 4), 300);
    expect(count(op, Reopened)).toBe(0);
    expect(op.score).toBe(mid);
    expect(mid).toBeGreaterThanOrEqual(before);
  });
});

describe('GAM-C Tongs', () => {
  it('GAM-0027: grab radius 22 px (+6 with the assist); empty-flesh MISS only after 0.25 s held', () => {
    const grabAt = (d: number, assist = false) => {
      const op = running(() => [new Embedded(at(0, 0), 'shot'), new Anchor()], {}, { assists: { bigHitboxes: assist } });
      const e = op.entities[0] as Embedded;
      new Hand(op).press('tongs', at(d, 0));
      return e.grabbed;
    };
    expect(grabAt(21)).toBe(true);
    expect(grabAt(24)).toBe(false);
    expect(grabAt(27, true)).toBe(true);

    const op = running(() => [new Embedded(at(0, 0), 'shot')]);
    const h = new Hand(op);
    h.tap('tongs', at(200, 50));
    expect(op.counts.miss).toBe(0);
    h.hold('tongs', at(200, 50), 0.2);
    h.release();
    expect(op.counts.miss).toBe(0);
    h.hold('tongs', at(200, 50), 0.4);
    h.release();
    expect(op.counts.miss).toBe(1);
  });

  it('GAM-0028: extraction angle — ±25° COOL, ±50° GOOD, beyond tears (laceration + BAD) for arrow, bolt and tooth', () => {
    const pull = (kind: 'arrow' | 'bolt' | 'tooth', dev: number) => {
      const op = running(() => [new Embedded(at(0, 0), kind, 0, false), new Anchor()]);
      const e = op.entities[0] as Embedded;
      const h = new Hand(op);
      const grip = e.spec.len > 0 ? { x: e.origin.x + (e.handle.x - e.origin.x) * 0.7, y: e.origin.y + (e.handle.y - e.origin.y) * 0.7 } : e.pos;
      const a = e.axis + (dev * Math.PI) / 180;
      const p1 = { x: grip.x + Math.cos(a) * 30, y: grip.y + Math.sin(a) * 30 };
      h.drag('tongs', [grip, p1], 200, false);
      if (kind === 'bolt') h.hold('tongs', p1, 0.4);
      h.drag('tongs', [p1, TRAY_DISH], 400, false);
      h.hold('tongs', TRAY_DISH, 0.2);
      h.release();
      return { op, e };
    };
    for (const kind of ['arrow', 'bolt', 'tooth'] as const) {
      const cool = pull(kind, 10);
      expect(cool.e.alive, kind).toBe(false);
      expect(lastRated(cool.op)?.rating, kind).toBe('cool');
      expect(lastRated(pull(kind, 40).op)?.rating, kind).toBe('good');
      const torn = pull(kind, 80);
      expect(torn.op.counts.bad, kind).toBeGreaterThanOrEqual(1);
      expect(torn.op.entities.some((x) => x instanceof Laceration && x.spawnedBy === 'penalty'), kind).toBe(true);
    }
  });

  it('GAM-0029: objects count only when dragged off the body; released on the body they re-embed shallowly', () => {
    const op = running(() => [new Embedded(at(0, 0), 'shard', 0, false), new Anchor()]);
    const e = op.entities[0] as Embedded;
    const h = new Hand(op);
    const drainBefore = e.drain();
    h.drag('tongs', [e.handle, { x: e.handle.x - 120, y: e.handle.y }], 300);
    expect(e.alive).toBe(true);
    expect(e.pos).toEqual(e.origin);
    expect(e.shallow).toBe(true);
    expect(e.drain()).toBeCloseTo(drainBefore / 2);
    h.drag('tongs', [e.handle, { x: e.handle.x - 30, y: e.handle.y }, OFF], 400);
    expect(e.alive).toBe(false);
  });

  it('GAM-0030: heavy objects (bolts, shot) lag the hand ~60 ms; light ones (glass) do not', () => {
    for (const [kind, lags] of [
      ['shot', true],
      ['glass', false],
    ] as const) {
      const op = running(() => [new Embedded(at(0, 0), kind, 0, false), new Anchor()]);
      const e = op.entities[0] as Embedded;
      const h = new Hand(op);
      const g = e.spec.len > 0 ? e.handle : e.pos;
      h.press('tongs', g);
      h.frame('tongs', { x: g.x - 30, y: g.y }, true);
      if (lags) expect(Math.abs(e.pos.x - (at(0, 0).x - 30))).toBeGreaterThan(10);
      else expect(e.pos.x).toBeCloseTo(at(0, 0).x - 30, 0);
      // After 0.3 s of holding still, the heavy object has caught up.
      h.hold('tongs', { x: g.x - 30, y: g.y }, 0.3);
      expect(Math.abs(e.pos.x - (at(0, 0).x - 30))).toBeLessThan(1);
    }
  });
});

describe('GAM-C Leech-Pipe', () => {
  it('GAM-0032: drains ~1 pool-unit (25 px) per 0.9 s at the centre, 40 % at the rim; small remnants auto-clear GOOD/COOL', () => {
    const centre = running(() => [new BloodPool(at(0, 0), 60), new Anchor()]);
    const p = centre.entities[0] as BloodPool;
    new Hand(centre).hold('leech', at(0, 0), 0.9);
    expect(60 - p.r).toBeCloseTo(25, 0);
    // Rate at the very rim of a fresh pool, over one frame.
    const rate = (dx: number) => {
      const op = running(() => [new BloodPool(at(0, 0), 60), new Anchor()]);
      const q = op.entities[0] as BloodPool;
      new Hand(op).frame('leech', at(dx, 0), true);
      return 60 - q.r;
    };
    expect(rate(69.9) / rate(0)).toBeCloseTo(0.4, 1);
    const small = running(() => [new BloodPool(at(0, 0), 30), new Anchor()]);
    new Hand(small).hold('leech', at(0, 0), 1.2);
    expect(count(small, BloodPool)).toBe(0);
    expect(small.counts.cool + small.counts.good).toBe(1);
  });

  it('GAM-0033: a pool cleared within 1.5 s of first contact is COOL, within 3 s GOOD', () => {
    const fast = running(() => [new BloodPool(at(0, 0), 30), new Anchor()]);
    new Hand(fast).hold('leech', at(0, 0), 1.5);
    expect(lastRated(fast)?.rating).toBe('cool');
    const slow = running(() => [new BloodPool(at(0, 0), 60), new Anchor()]);
    new Hand(slow).hold('leech', at(0, 0), 3);
    expect(lastRated(slow)?.rating).toBe('good');
  });

  it('GAM-0034: pools over an open wound refill; the third refill prompts "stitch first"', () => {
    const op = running(() => [new Laceration(at(0, 0), 0, 80, 2), new BloodPool(at(0, 0), 50), new Anchor()]);
    const h = new Hand(op);
    for (let i = 0; i < 3; i++) {
      expect(op.flags.has('stitch-first')).toBe(false);
      h.hold('leech', at(0, 0), 0.1);
      h.release();
      wait(op, 4.1);
    }
    expect(op.flags.has('stitch-first')).toBe(true);
  });
});

describe('GAM-C Gut Thread', () => {
  it('GAM-0036/0037: ceil(len/22) stitches; even 10–28 px spacing in one stroke is COOL; gaps > 40 px keep it bleeding at 30 %', () => {
    expect(new Laceration(at(0, 0), 0, 120).stitch.needed).toBe(6);
    expect(new Laceration(at(0, 0), 0, 100).stitch.needed).toBe(5);
    expect(new Laceration(at(0, 0), 0, 44).stitch.needed).toBe(2);

    const even = running(() => [new Laceration(at(0, 0), 0, 120, 0.1), new Anchor()]);
    new Hand(even).drag('thread', zig(at(-60, 0), at(60, 0), 7), 300);
    expect(lastRated(even)).toMatchObject({ rating: 'cool', label: 'Stitched' });

    const twice = running(() => [new Laceration(at(0, 0), 0, 120, 0.1), new Anchor()]);
    const h2 = new Hand(twice);
    h2.drag('thread', zig(at(-60, 0), at(0, 0), 4), 300);
    h2.drag('thread', zig(at(0, 0), at(60, 0), 4), 300);
    expect(lastRated(twice)?.rating).toBe('good');

    // Six stitches bunched in the left half leave a gap: not closed, bleeding at 30 %.
    const gap = running(() => [new Laceration(at(0, 0), 0, 120, 1), new Anchor()]);
    const lac = gap.entities[0] as Laceration;
    const full = lac.drain(gap);
    new Hand(gap).drag('thread', zig(at(-60, 0), at(10, 0), 6, 20), 300);
    expect(lac.alive).toBe(true);
    expect(lac.stitch.count).toBeGreaterThanOrEqual(6);
    expect(lac.drain(gap)).toBeCloseTo(full * 0.3);
    new Hand(gap).drag('thread', zig(at(0, 0), at(60, 0), 4), 300);
    expect(lac.alive).toBe(false);
  });

  it('GAM-0038: closing the incision cleanly is one COOL action worth a 200 bonus', () => {
    const op = running(() => {
      const inc = new Incision([at(-100, 0), at(100, 0)]);
      inc.state = 'open';
      inc.beginClosing();
      return [inc, new Anchor()];
    });
    const before = op.score;
    new Hand(op).drag('thread', zig(at(-100, 0), at(100, 0), 11), 300);
    expect(lastRated(op)).toMatchObject({ rating: 'cool', label: 'Closed' });
    expect(op.bonus.closure).toBe(200);
    expect(op.score - before).toBeGreaterThanOrEqual(300);
    expect(op.scars.length).toBe(1);
  });
});

describe("GAM-C Saint's Salve", () => {
  it('GAM-0040: salve capacity 46 (0.5 per cell), refilled after 3 s idle', () => {
    const op = running(() => [new Rot(at(0, 0), 60, 0), new Rot(at(150, 0), 60, 0), new Anchor()]);
    expect(op.salve).toBe(46);
    const h = new Hand(op);
    const rows = (cx: number) => {
      const pts = [];
      for (let y = -60; y <= 60; y += 16) pts.push(at(cx - 70, y), at(cx + 70, y));
      return pts;
    };
    h.drag('salve', [...rows(0), ...rows(150)], 1500);
    expect(op.salve).toBeLessThan(10);
    h.idle(2.5);
    expect(op.salve).toBeLessThan(46);
    h.idle(0.6);
    expect(op.salve).toBe(46);
  });

  it('GAM-0041: ≥ 95 % coverage in one stroke is COOL, several strokes GOOD; an unfinished patch regrows', () => {
    const one = running(() => [new Rot(at(0, 0), 40, 0), new Anchor()]);
    const pts = [];
    for (let y = -44; y <= 44; y += 14) pts.push(at(-50, y), at(50, y));
    new Hand(one).drag('salve', pts, 1200);
    expect(lastRated(one)).toMatchObject({ rating: 'cool', label: 'Rot purged' });

    const part = running(() => [new Rot(at(0, 0), 40, 0), new Anchor()]);
    const rot = part.entities[0] as Rot;
    new Hand(part).drag('salve', pts.slice(0, 8), 1200);
    const f = rot.fraction;
    expect(f).toBeGreaterThan(0.3);
    wait(part, 2);
    expect(rot.fraction).toBeLessThan(f);
    new Hand(part).drag('salve', pts, 1200);
    expect(lastRated(part)?.rating).toBe('good');
  });
});

describe('GAM-C Tincture', () => {
  const inject = (vitals: number, p = at(250, 150)) => {
    const op = running(() => [new Anchor()], { vitals });
    new Hand(op).hold('tincture', p, 0.75);
    return op;
  };
  it('GAM-0044: rated by need — < 40 COOL, 40–70 GOOD, > 85 BAD (wasteful)', () => {
    expect(lastRated(inject(35))?.rating).toBe('cool');
    expect(lastRated(inject(60))?.rating).toBe('good');
    expect(lastRated(inject(95))).toMatchObject({ rating: 'bad', label: 'Wasteful' });
    expect(lastRated(inject(78))).toBeUndefined();
    expect(inject(35).vitals).toBeGreaterThan(55);
  });
  it('GAM-0045: injection must be on the body and ≥ 30 px from an open wound, else MISS', () => {
    const op = running(() => [new Laceration(at(0, 0), 0, 60, 0.1), new Anchor()], { vitals: 50 });
    new Hand(op).hold('tincture', at(0, 20), 0.75);
    expect(lastRated(op)).toMatchObject({ rating: 'miss', label: 'Into the wound' });
    expect(op.vitals).toBeLessThan(51);
    const off = inject(35, { x: 5, y: 5 });
    expect(off.vitals).toBeLessThan(36);
  });
});

describe('GAM-C Cautery Brand', () => {
  it('GAM-0049: branding healthy flesh > 0.5 s leaves a scorch (Burn) and a BAD', () => {
    const op = running(() => [new Anchor()]);
    new Hand(op).hold('brand', at(100, 100), 0.55);
    expect(lastRated(op)).toMatchObject({ rating: 'bad', label: 'Scorched' });
    expect(count(op, SimpleBurn)).toBe(1);
    const brief = running(() => [new Anchor()]);
    new Hand(brief).hold('brand', at(100, 100), 0.4);
    expect(brief.counts.bad).toBe(0);
  });
  it('GAM-0050: 6 s of continuous use overheats the brand for 2 s', () => {
    const op = running(() => [new Grub(at(0, 0), running(() => []), 0), new Anchor()]);
    const h = new Hand(op);
    h.hold('brand', { x: 5, y: 5 }, 6.05);
    expect(op.brandLock).toBeGreaterThan(1.9);
    expect(op.toolUsable('brand')).toBe(false);
    h.release();
    h.idle(2.1);
    expect(op.toolUsable('brand')).toBe(true);
  });
});

describe('GAM-C Scrying Lens', () => {
  const hidden = () => {
    const e = new Embedded(at(0, 0), 'shard', 0, false);
    e.hidden = true;
    return e;
  };
  it('GAM-0052: reveal radius 90 px, 0.4 s hover; found things stay visible', () => {
    const op = running(() => [hidden()]);
    const e = op.entities[0];
    const h = new Hand(op);
    h.frame('lens', at(95, 0), false);
    for (let i = 0; i < 30; i++) h.frame('lens', at(95, 0), false);
    expect(e.hidden).toBe(true);
    for (let i = 0; i < 20; i++) h.frame('lens', at(85, 0), false);
    expect(e.hidden).toBe(true);
    for (let i = 0; i < 12; i++) h.frame('lens', at(85, 0), false);
    expect(e.hidden).toBe(false);
    h.frame('tongs', at(300, 0), false);
    expect(e.hidden).toBe(false);
  });
  it('GAM-0053: hidden things keep draining while unfound', () => {
    const op = running(() => [hidden()]);
    const v = op.vitals;
    wait(op, 5);
    expect(op.vitals).toBeLessThan(v - 1);
  });
});

describe('GAM-C Tool switching', () => {
  it('GAM-0055: wheel steps are debounced 80 ms; switching mid-drag cancels the drag unrated', () => {
    const op = running(() => [new Embedded(at(0, 0), 'shard', 0, false), new Anchor()]);
    const start = op.tool;
    op.cycleTool(1);
    op.cycleTool(1);
    expect(op.def.tools.indexOf(op.tool)).toBe((op.def.tools.indexOf(start) + 1) % op.def.tools.length);
    wait(op, 0.1);
    op.cycleTool(1);
    expect(op.def.tools.indexOf(op.tool)).toBe((op.def.tools.indexOf(start) + 2) % op.def.tools.length);

    const e = op.entities[0] as Embedded;
    const h = new Hand(op);
    h.press('tongs', e.handle);
    expect(e.grabbed).toBe(true);
    op.setTool('lancet');
    h.frame('lancet', OFF, false);
    expect(e.alive).toBe(true);
    expect(op.counts.cool + op.counts.good + op.counts.bad + op.counts.miss).toBe(0);
  });
  it('GAM-0057: assist suggestion names the instrument an entity needs', () => {
    const op = running((o) => [new Grub(at(0, 0), o, 0), new BloodPool(at(150, 0), 30)]);
    expect(op.suggestTool(at(0, 0))).toBe('brand');
    expect(op.suggestTool(at(150, 0))).toBe('leech');
    expect(op.suggestTool(at(-300, 200))).toBeNull();
  });
  it('GAM-0058: the wrong tool on an entity gives a one-shot hint, never a MISS', () => {
    const op = running(() => [new Sigil(at(0, 0), SIGILS.eye, 60)]);
    const h = new Hand(op);
    h.hold('tongs', at(-60, 0), 0.5);
    h.release();
    h.tap('tongs', at(-60, 0));
    const hints = op.events.filter((e) => e.kind === 'hint' && e.key.startsWith('wrong-'));
    expect(hints.length).toBe(1);
    expect(op.counts.miss).toBe(0);
  });
  it('GAM-0069: the lead dish and the tray lie off the body', () => {
    expect(onBody(LEAD_DISH)).toBe(false);
    expect(onBody(TRAY_DISH)).toBe(false);
  });
});
