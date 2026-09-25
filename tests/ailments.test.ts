import { describe, expect, it } from 'vitest';
import { BloodPool, Bubo, Burn, EMBED_SPEC, Embedded, Grub, Incision, Laceration, Rot, Sigil, SIGILS, Venom, Wadding, type EmbeddedKind } from '../src/surgery/entities';
import { LEAD_DISH, TRAY_DISH, WoundFever, type Operation } from '../src/surgery/operation';
import { Anchor, at, Hand, OFF, running, testDef, wait } from './harness';
import { Operation as Op } from '../src/surgery/operation';

const lastRated = (op: Operation) => [...op.events].reverse().find((e) => e.kind === 'rated') as { rating: string; label?: string } | undefined;
const alive = (op: Operation, cls: new (...a: never[]) => unknown) => op.entities.filter((e) => e instanceof cls && e.alive);

/** Pull an embedded object cleanly out along its axis into a dish. */
function extract(h: Hand, e: Embedded, dest = TRAY_DISH): void {
  const grip = e.spec.len > 0 ? { x: e.origin.x + (e.handle.x - e.origin.x) * 0.7, y: e.origin.y + (e.handle.y - e.origin.y) * 0.7 } : e.pos;
  const p1 = { x: grip.x + Math.cos(e.axis) * 36, y: grip.y + Math.sin(e.axis) * 36 };
  h.drag('tongs', [grip, p1], 200, false);
  if (e.kind === 'bolt') h.hold('tongs', p1, 0.4);
  h.drag('tongs', [p1, dest], 300, false);
  h.hold('tongs', dest, 0.2);
  h.release();
}

describe('GAM-D Incision & Laceration', () => {
  it('GAM-0059: deep incisions have a second layer whose guide appears after the first is open', () => {
    const op = running(() => [new Incision([at(-100, 0), at(100, 0)], 2), new Anchor()]);
    const inc = op.entities[0] as Incision;
    const h = new Hand(op);
    h.drag('lancet', [at(-100, 0), at(100, 0)], 300);
    expect(inc.state).toBe('mark');
    expect(inc.depth).toBe(1);
    expect(lastRated(op)?.label).toBe('Skin');
    h.drag('lancet', [at(-100, 0), at(100, 0)], 300);
    expect(inc.state).toBe('open');
    expect(lastRated(op)?.label).toBe('Fascia');
  });

  it('GAM-0060: an open incision with no work inside bleeds 0.2/s', () => {
    const op = running(() => {
      const inc = new Incision([at(-100, 0), at(100, 0)]);
      inc.state = 'open';
      return [inc, new Anchor()];
    });
    const inc = op.entities[0] as Incision;
    expect(inc.drain(op)).toBe(0); // the anchor is still "work inside"
    op.entities[1].kill();
    expect(inc.drain(op)).toBeCloseTo(0.2);
  });

  it('GAM-0061: bleed scales 0.01/s per px; a pool is fed every 4 s until stitched', () => {
    const op = running(() => [new Laceration(at(0, 0), 0, 40), new Laceration(at(0, 120), 0, 70), new Anchor()]);
    const [l40, l70] = op.entities as Laceration[];
    expect(l70.drain(op) - l40.drain(op)).toBeCloseTo(0.3);
    expect(alive(op, BloodPool).length).toBe(0);
    wait(op, 3.9);
    expect(alive(op, BloodPool).length).toBe(0);
    wait(op, 0.2);
    expect(alive(op, BloodPool).length).toBe(2);
  });

  it('GAM-0063: claw rakes carve a ragged edge, blades a clean one', () => {
    const claw = new Laceration(at(0, 0), 0, 80, 1, 'claw');
    expect(claw.source).toBe('claw');
    expect(new Laceration(at(0, 0), 0, 80).source).toBe('blade');
  });
});

describe('GAM-D Embedded objects', () => {
  it('GAM-0064: an un-nicked barb tears (1.6× bleed laceration + BAD); two lancet nicks first allow a clean pull', () => {
    const torn = running(() => [new Embedded(at(0, 0), 'arrow', 0), new Anchor()]);
    extract(new Hand(torn), torn.entities[0] as Embedded);
    expect(torn.counts.bad).toBeGreaterThanOrEqual(1);
    const lac = torn.entities.find((e): e is Laceration => e instanceof Laceration && e.spawnedBy === 'penalty')!;
    expect(lac.bleed).toBeCloseTo(1.6);

    const clean = running(() => [new Embedded(at(0, 0), 'arrow', 0), new Anchor()]);
    const e = clean.entities[0] as Embedded;
    const h = new Hand(clean);
    h.tap('lancet', at(4, 4));
    h.tap('lancet', at(4, 4));
    extract(h, e);
    expect(e.alive).toBe(false);
    expect(clean.counts.bad).toBe(0);
    expect(lastRated(clean)?.label).toBe('Arrow');
  });

  it('GAM-0065: a bolt needs a two-stage pull (40 %, pause 0.3 s, finish) or it snaps, leaving a hidden head for the lens', () => {
    const op = running(() => [new Embedded(at(0, 0), 'bolt', 0, false), new Anchor()]);
    const e = op.entities[0] as Embedded;
    const h = new Hand(op);
    const grip = e.handle;
    h.drag('tongs', [grip, { x: grip.x + Math.cos(e.axis) * 60, y: grip.y }, OFF], 400);
    expect(e.snapped).toBe(true);
    expect(op.events.some((x) => x.kind === 'rated' && x.label === 'Snapped' && x.rating === 'bad')).toBe(true);
    const head = op.entities.find((x): x is Embedded => x instanceof Embedded && x !== e)!;
    expect(head.hidden).toBe(true);
    expect(head.spawnedBy).toBe('penalty');

    const ok = running(() => [new Embedded(at(0, 0), 'bolt', 0, false), new Anchor()]);
    const b = ok.entities[0] as Embedded;
    extract(new Hand(ok), b);
    expect(b.staged).toBe(true);
    expect(b.alive).toBe(false);
    expect(lastRated(ok)).toMatchObject({ rating: 'cool', label: 'Bolt' });
  });

  it('GAM-0066: lead shot leaves wadding (lens-hidden); left in at closing it triggers a 20 s wound-fever at 0.4/s', () => {
    const def = testDef(() => [new Embedded(at(0, 0), 'shot')], {}, [{ spawn: () => [new Embedded(at(0, 0), 'shot')] }]);
    const op = new Op(def);
    while (op.status === 'intro') op.update(1 / 60);
    const h = new Hand(op);
    extract(h, op.entities[0] as Embedded);
    const w = op.entities.find((e): e is Wadding => e instanceof Wadding)!;
    expect(w).toBeDefined();
    expect(w.hidden).toBe(true);
    // Close the shot's wound; the wadding stays in.
    for (const e of alive(op, Laceration)) (e as Laceration).kill();
    wait(op, 2.5);
    const fever = op.entities.find((e): e is WoundFever => e instanceof WoundFever);
    expect(fever).toBeDefined();
    expect(fever!.drain(op)).toBeCloseTo(0.4);
    expect(op.status).toBe('running');
    wait(op, 21);
    expect(op.status).toBe('won');
  });

  it('GAM-0067: glass dragged faster than 500 px/s slices a nick', () => {
    const fast = running(() => [new Embedded(at(0, 0), 'glass', 0, false), new Anchor()]);
    const g = fast.entities[0] as Embedded;
    new Hand(fast).drag('tongs', [g.handle, { x: g.handle.x - 200, y: g.handle.y }], 900);
    expect(lastRated(fast)).toMatchObject({ rating: 'bad', label: 'Sliced' });
    const slow = running(() => [new Embedded(at(0, 0), 'glass', 0, false), new Anchor()]);
    extract(new Hand(slow), slow.entities[0] as Embedded);
    expect(slow.counts.bad).toBe(0);
  });

  it('GAM-0069: hexstone writhes until branded 0.5 s, whispers (−2) per 2 s held in tongs, and only the lead dish takes it', () => {
    const op = running(() => [new Embedded(at(0, 0), 'hexstone', 0, false), new Anchor()], { vitals: 90 });
    const e = op.entities[0] as Embedded;
    const moved = new Set<string>();
    for (let i = 0; i < 20; i++) {
      op.update(1 / 60);
      moved.add(`${Math.round(e.pos.x)},${Math.round(e.pos.y)}`);
    }
    expect(moved.size).toBeGreaterThan(3);
    const h = new Hand(op);
    h.hold('brand', e.pos, 0.55);
    h.release();
    expect(e.calmed).toBe(true);
    expect(e.pos).toEqual(e.origin);
    // Wrong dish: back it goes.
    extract(h, e, TRAY_DISH);
    expect(e.alive).toBe(true);
    const v = op.vitals;
    h.press('tongs', e.handle);
    h.hold('tongs', e.handle, 2.05);
    expect(v - op.vitals).toBeGreaterThanOrEqual(2);
    h.release();
    extract(h, e, LEAD_DISH);
    expect(e.alive).toBe(false);
  });

  it('GAM-0070: every embedded kind pays out with its own label when removed', () => {
    for (const kind of Object.keys(EMBED_SPEC) as EmbeddedKind[]) {
      const op = running(() => [new Embedded(at(0, 0), kind, 0, false), new Anchor()]);
      const e = op.entities[0] as Embedded;
      const h = new Hand(op);
      if (kind === 'hexstone') {
        h.hold('brand', e.pos, 0.55);
        h.release();
      }
      extract(h, e, kind === 'hexstone' ? LEAD_DISH : TRAY_DISH);
      expect(e.alive, kind).toBe(false);
      expect(lastRated(op)?.label, kind).toBe(EMBED_SPEC[kind].label);
    }
  });
});

describe('GAM-D Burns', () => {
  it('GAM-0071: grade-3 fire burns need the black core excised with the lancet before salve', () => {
    const op = running((o) => [new Burn(at(0, 0), 50, o), new Anchor()]);
    const b = op.entities[0] as Burn;
    expect(b.charCore).toBe(true);
    const h = new Hand(op);
    h.drag('salve', [at(-40, 0), at(40, 0)], 600);
    expect(b.healed()).toBe(0);
    h.drag('lancet', [at(-20, 0), at(20, 0), at(-20, 5)], 300);
    expect(b.charCore).toBe(false);
    expect(lastRated(op)?.label).toBe('Char excised');
    expect(new Burn(at(0, 0), 40, op).charCore).toBe(false);
  });

  it('GAM-0072: acid spreads 6 px/s until the leech-pipe neutralises it; salving first is BAD', () => {
    const op = running((o) => [new Burn(at(0, 0), 30, o, 'acid'), new Anchor()]);
    const b = op.entities[0] as Burn;
    wait(op, 2);
    expect(b.radiusNow).toBeCloseTo(42, 0);
    const h = new Hand(op);
    h.drag('salve', [at(-30, 0), at(30, 0)], 600);
    expect(lastRated(op)).toMatchObject({ rating: 'bad', label: 'Salve on acid' });
    h.hold('leech', at(0, 0), 1.05);
    expect(b.acidLive).toBe(false);
    const r = b.radiusNow;
    wait(op, 1);
    expect(b.radiusNow).toBe(r);
  });

  it('GAM-0073: hexfire rekindles 3 s after salving unless its ember is branded out (green tell 0.8 s before)', () => {
    const op = running((o) => [new Burn(at(0, 0), 30, o, 'hexfire'), new Anchor()]);
    const b = op.entities[0] as Burn;
    b.flakes.length = 0;
    const h = new Hand(op);
    const rows = [];
    for (let y = -36; y <= 36; y += 12) rows.push(at(-40, y), at(40, y));
    h.drag('salve', rows, 900);
    expect(b.alive).toBe(true);
    const left = b.smoulder;
    expect(left).toBeGreaterThan(0.9);
    wait(op, left - 0.85);
    expect(op.flags.has('hex-tell')).toBe(false);
    wait(op, 0.1);
    expect(op.flags.has('hex-tell')).toBe(true);
    wait(op, 0.8);
    expect(b.healed()).toBe(0);
    h.drag('salve', rows, 900);
    h.hold('brand', b.ember!, 0.55);
    expect(b.alive).toBe(false);
  });
});

describe('GAM-D Bubo, Rot, Venom, Grub', () => {
  it('GAM-0075: a short cut across the crown lances; longer than the diameter is BAD and spills', () => {
    const cut = (from: number, to: number) => {
      const op = running(() => [new Bubo(at(0, 0), 22), new Anchor()]);
      new Hand(op).drag('lancet', [at(from, 0), at(to, 0)], 300);
      return op;
    };
    expect(lastRated(cut(-15, 15))).toMatchObject({ rating: 'cool', label: 'Lanced' });
    const over = cut(-20, 40);
    expect(lastRated(over)).toMatchObject({ rating: 'bad', label: 'Overcut' });
    expect(over.entities.filter((e) => e instanceof BloodPool).length).toBe(2);
    const prick = running(() => [new Bubo(at(0, 0), 22), new Anchor()]);
    new Hand(prick).tap('lancet', at(0, 0));
    expect((prick.entities[0] as Bubo).lanced).toBe(false);
  });

  it('GAM-0076: an unlanced bubo swells for 30 s, then bursts into pus and rot-prone cuts', () => {
    const op = running(() => [new Bubo(at(0, 0), 22, 40), new Anchor()]);
    const b = op.entities[0] as Bubo;
    wait(op, 29.5);
    expect(b.lanced).toBe(false);
    wait(op, 0.6);
    expect(b.lanced).toBe(true);
    expect(op.counts.miss).toBe(1);
    expect(op.entities.some((e) => e instanceof BloodPool && e.ichor === 'pus' && e.spawnedBy === 'penalty')).toBe(true);
  });

  it('GAM-0077: pus seeping into an open laceration turns it to rot after 5 s', () => {
    const op = running(() => [new Laceration(at(0, 0), 0, 50, 0.1), new BloodPool(at(10, 0), 30, 'pus'), new Anchor()]);
    wait(op, 4.9);
    expect(alive(op, Laceration).length).toBe(1);
    wait(op, 0.2);
    expect(alive(op, Laceration).length).toBe(0);
    expect(alive(op, Rot).length).toBe(1);
    expect(lastRated(op)?.label).toBe('Festered');
  });

  it('GAM-0078: rot spreads 2 px/s to 60 px and dies only at 95 % coverage', () => {
    const op = running(() => [new Rot(at(0, 0), 30, 0), new Anchor()]);
    const r = op.entities[0] as Rot;
    wait(op, 5);
    expect(r.r).toBeCloseTo(40, 0);
    wait(op, 20);
    expect(r.r).toBe(60);
  });

  it('GAM-0080/0081: venom motes run the vein to the heart (−10); brand or leech catches them; a ligature stops them', () => {
    const op = running((o) => [new Venom(at(-150, 60), o, 4), new Anchor()], { vitals: 90 });
    const v = op.entities[0] as Venom;
    wait(op, 5.05);
    expect(v.motes.length).toBe(1);
    const before = op.vitals;
    wait(op, v.veinLen / 38 + 0.2);
    expect(before - op.vitals).toBeGreaterThan(10);

    const op2 = running((o) => [new Venom(at(-150, 60), o, 4), new Anchor()]);
    const v2 = op2.entities[0] as Venom;
    wait(op2, 5.5);
    const m = v2.motes[0];
    new Hand(op2).hold('brand', v2.motePos(m), 0.05);
    expect(v2.motes.length).toBe(0);

    const op3 = running((o) => [new Venom(at(-150, 60), o, 4), new Anchor()], { vitals: 90 });
    const v3 = op3.entities[0] as Venom;
    const mid = v3.vein[4];
    const n = { x: -(v3.vein[5].y - v3.vein[3].y), y: v3.vein[5].x - v3.vein[3].x };
    const l = Math.hypot(n.x, n.y);
    new Hand(op3).drag('thread', [{ x: mid.x + (n.x / l) * 20, y: mid.y + (n.y / l) * 20 }, { x: mid.x - (n.x / l) * 20, y: mid.y - (n.y / l) * 20 }], 200);
    expect(v3.ligature).toBeLessThan(v3.veinLen);
    const vit = op3.vitals;
    wait(op3, 12);
    // Only base venom drain, no -10 hits.
    expect(vit - op3.vitals).toBeLessThan(9);
  });

  it('GAM-0083: grubs crawl toward open wounds and burrow after 6 s (only when a lens is at hand)', () => {
    const op = running((o) => [new Grub(at(-200, 0), o, 40), new Laceration(at(100, 0), 0, 60, 0.1), new Anchor()]);
    const g = op.entities[0] as Grub;
    const d0 = Math.abs(g.pos.x - at(100, 0).x);
    wait(op, 3);
    expect(Math.abs(g.pos.x - at(100, 0).x)).toBeLessThan(d0 - 40);
    wait(op, 3.2);
    expect(g.hidden).toBe(true);
    const noLens = running((o) => [new Grub(at(-200, 0), o, 40), new Anchor()], { tools: ['brand', 'tongs'] });
    wait(noLens, 7);
    expect(noLens.entities[0].hidden).toBe(false);
  });

  it('GAM-0084: releasing the brand between 0.15 and 0.4 s splits the grub into two small ones (BAD)', () => {
    const op = running((o) => [new Grub(at(0, 0), o, 0), new Anchor()]);
    const g = op.entities[0] as Grub;
    const h = new Hand(op);
    h.hold('brand', g.pos, 0.25);
    h.release();
    expect(g.alive).toBe(false);
    const kids = alive(op, Grub) as Grub[];
    expect(kids.length).toBe(2);
    expect(kids.every((k) => k.small && k.spawnedBy === 'penalty')).toBe(true);
    expect(lastRated(op)).toMatchObject({ rating: 'bad', label: 'Split' });
    const full = running((o) => [new Grub(at(0, 0), o, 0), new Anchor()]);
    new Hand(full).hold('brand', full.entities[0].pos, 0.85);
    expect(lastRated(full)).toMatchObject({ rating: 'cool', label: 'Seared' });
  });
});

describe('GAM-D Curse-sigils', () => {
  it('GAM-0086: strokes in order — node held 1 s catches a stroke; touching a later stroke first snaps (BAD + lash)', () => {
    const op = running(() => [new Sigil(at(0, 0), SIGILS.key, 60, 99), new Anchor()]);
    const s = op.entities[0] as Sigil;
    const h = new Hand(op);
    // Stroke 3 first: snap.
    h.drag('brand', [s.nodes[2], { x: s.nodes[2].x, y: s.nodes[2].y + 20 }], 200);
    expect(lastRated(op)).toMatchObject({ rating: 'bad', label: 'Wrong stroke' });
    expect(op.entities.some((e) => e instanceof Laceration && e.spawnedBy === 'penalty')).toBe(true);
    for (let i = 0; i < s.strokeCount; i++) {
      h.hold('brand', s.nodes[i], 1.05);
      expect(s.ignited[i]).toBe(true);
      for (const seg of s.segs.filter((x) => x.stroke === i)) h.drag('brand', [seg.a, seg.b], 250);
      h.release();
    }
    expect(s.alive).toBe(false);
    expect(lastRated(op)?.label).toBe('Curse broken');
  });

  it('GAM-0087: at least six original glyphs, each stroke with ≥ 2 distinct points', () => {
    const names = Object.keys(SIGILS);
    expect(names.length).toBeGreaterThanOrEqual(6);
    for (const [name, strokes] of Object.entries(SIGILS)) {
      expect(strokes.length, name).toBeGreaterThan(0);
      for (const st of strokes) {
        expect(st.length, name).toBeGreaterThanOrEqual(2);
        for (let i = 1; i < st.length; i++) expect(st[i].x !== st[i - 1].x || st[i].y !== st[i - 1].y, name).toBe(true);
        for (const p of st) expect(Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1, name).toBe(true);
      }
    }
  });

  it('GAM-0088: a half-traced sigil regresses one stroke every 4 s untouched', () => {
    const op = running(() => [new Sigil(at(0, 0), SIGILS.trident, 60, 99), new Anchor()]);
    const s = op.entities[0] as Sigil;
    const h = new Hand(op);
    h.hold('brand', s.nodes[0], 1.05);
    for (const seg of s.segs.filter((x) => x.stroke === 0)) h.drag('brand', [seg.a, seg.b], 250);
    expect(s.strokeDone(0)).toBe(true);
    h.idle(3.8);
    expect(s.strokeDone(0)).toBe(true);
    h.idle(0.4);
    expect(s.strokeDone(0)).toBe(false);
    expect(s.ignited[0]).toBe(false);
  });
});
