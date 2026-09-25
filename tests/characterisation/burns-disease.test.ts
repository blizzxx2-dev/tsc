/** QAT-0039 burns, QAT-0040 buboes, QAT-0041 rot & coverage, QAT-0042 venom. */
import { describe, expect, it } from 'vitest';
import { at } from '../../src/content/chapter1';
import { Coverage } from '../../src/surgery/coverage';
import { BloodPool, Bubo, Burn, Laceration, Rot, Venom } from '../../src/surgery/entities';
import { DT, holdAt, live, raster, step, strokePath, tap } from '../helpers/sim';
import { scenario } from '../helpers/trace';

// Acid (neutralise with the leech-pipe first) and hexfire (brand out the ember) follow their own
// rules since the GAM pass: see GAM-0072 / GAM-0073 in tests/ailments-gameplay.test.ts.
describe('Burn', () => {
  it.each(['fire'] as const)(
    '%s: salve first says burn-eschar; each pluck GOOD "Debrided"; last flake says burn-salve; full salve COOL "Burn dressed"',
    (source) => {
      const { op, ents, trace } = scenario((o) => [new Burn(at(0, 0), 44, o, source)]);
      const burn = ents[0];
      const flakes = burn.flakes.length;
      expect(flakes).toBe(Math.max(3, Math.round(44 / 12)));
      expect(burn.drain(op)).toBeCloseTo(0.3 + flakes * 0.06, 9);
      strokePath(op, 'salve', raster(burn.pos, burn.radius), { speed: 900 });
      trace.note('salve before debriding', { fraction: burn.cov.fraction });
      expect(burn.cov.fraction).toBe(0);
      expect(op.flags.has('burn-eschar')).toBe(true);
      while (burn.flakes.length) tap(op, 'tongs', burn.flakes[0]);
      trace.note('debrided');
      expect(op.counts.good).toBe(flakes);
      expect(op.flags.has('burn-salve')).toBe(true);
      strokePath(op, 'salve', raster(burn.pos, burn.radius), { speed: 900 });
      trace.note('dressed');
      expect(burn.alive).toBe(false);
      expect(op.counts.cool).toBe(1);
      expect(trace.text()).toMatchSnapshot();
    },
  );
});

/** A short cut across the crown (a prick no longer opens a bubo). */
const lance = (op: Parameters<typeof strokePath>[0], b: Bubo) =>
  strokePath(
    op,
    'lancet',
    [
      { x: b.pos.x - 15, y: b.pos.y },
      { x: b.pos.x + 15, y: b.pos.y },
    ],
    { speed: 300 },
  );

describe('Bubo', () => {
  it('lancing below 75 % of max radius is COOL "Lanced" and spills a pus pool; salving undrained pus says "pus"; drained (COOL) + salved is GOOD "Cleansed"', () => {
    const { op, ents, trace } = scenario(() => [new Bubo(at(0, 0), 22)]);
    const bubo = ents[0];
    lance(op, bubo);
    trace.note('lanced', { r: bubo.r });
    expect(op.counts.cool).toBe(1);
    const pus = live(op, BloodPool)[0];
    expect(pus.ichor).toBe('pus');
    strokePath(op, 'salve', raster(bubo.cov.center, bubo.cov.radius), { speed: 900 });
    expect(op.flags.has('pus')).toBe(true);
    expect(bubo.alive).toBe(true);
    holdAt(op, 'leech', pus.pos, 1.2);
    strokePath(op, 'salve', raster(bubo.cov.center, bubo.cov.radius), { speed: 900 });
    trace.note('cleansed');
    expect(bubo.alive).toBe(false);
    // Lanced and a quick draw-off are COOL; the cleansing salve is GOOD.
    expect(op.counts.cool).toBe(2);
    expect(op.counts.good).toBe(1);
    expect(trace.text()).toMatchSnapshot();
  });

  it('lancing a ripe bubo (≥ 75 % of max radius) is GOOD "Lanced"', () => {
    const { op, ents, trace } = scenario(() => [new Bubo(at(0, 0), 22)]);
    const bubo = ents[0];
    while (bubo.r < bubo.maxR * 0.75) op.update(DT);
    trace.note('ripe', { r: bubo.r });
    lance(op, bubo);
    expect(op.counts.good).toBe(1);
    expect(trace.text()).toMatchSnapshot();
  });

  it('a burst costs 10 vitals, pops "It burst!", spawns a pus pool and a 40 px laceration and counts a MISS', () => {
    const { op, ents, trace } = scenario(() => [new Bubo(at(0, 0), 22)]);
    const bubo = ents[0];
    op.combo = 3;
    let frames = 0;
    while (!bubo.lanced && frames++ < 60 * 60) op.update(DT);
    trace.note('burst', { r: bubo.r });
    expect(op.counts.miss).toBe(1);
    expect(op.combo).toBe(0);
    expect(live(op, BloodPool).map((p) => [p.ichor, p.r])).toEqual([['pus', 40]]);
    expect(live(op, Laceration).map((l) => l.length)).toEqual([40]);
    expect(trace.lines.some((l) => l.includes('hurt 10'))).toBe(true);
    expect(trace.text()).toMatchSnapshot();
  });
});

describe('Rot & Coverage', () => {
  it('Coverage cell counts for radii 0/12/46/100', () => {
    const counts = [0, 12, 46, 100].map((r) => new Coverage({ x: 0, y: 0 }, r, 12).cells.length);
    expect(counts).toMatchInlineSnapshot(`
      [
        1,
        5,
        43,
        214,
      ]
    `);
  });

  it('brush counts only newly covered cells; fraction tracks coverage', () => {
    const cov = new Coverage({ x: 100, y: 100 }, 46, 12);
    const first = cov.brush({ x: 100, y: 100 }, 24);
    expect(first).toBeGreaterThan(0);
    expect(cov.brush({ x: 100, y: 100 }, 24)).toBe(0);
    expect(cov.fraction).toBeCloseTo(first / cov.cells.length, 12);
    expect(cov.brush({ x: 1000, y: 1000 }, 24)).toBe(0);
  });

  it('contains(p, pad) is inclusive at radius + pad', () => {
    const cov = new Coverage({ x: 0, y: 0 }, 40, 12);
    expect(cov.contains({ x: 40, y: 0 })).toBe(true);
    expect(cov.contains({ x: 40.01, y: 0 })).toBe(false);
    expect(cov.contains({ x: 58, y: 0 }, 18)).toBe(true);
    expect(cov.contains({ x: 58.01, y: 0 }, 18)).toBe(false);
    expect(cov.contains({ x: 0, y: -40 })).toBe(true);
  });

  it('partial salve regrows at the spread rate; a full salve purges: GOOD "Rot purged"', () => {
    const { op, ents, trace } = scenario(() => [new Rot(at(0, 0), 50, 0.6)]);
    const rot = ents[0];
    strokePath(op, 'salve', raster(rot.pos, rot.r).slice(0, 6), { speed: 1100 });
    const partial = rot.fraction;
    trace.note('partial salve', { fraction: partial });
    expect(partial).toBeGreaterThan(0);
    expect(partial).toBeLessThan(0.9);
    step(op, 10);
    trace.note('10 s later', { fraction: rot.fraction });
    expect(rot.fraction).toBeLessThan(partial);
    strokePath(op, 'salve', raster(rot.pos, rot.r), { speed: 1100 });
    trace.note('full salve');
    expect(rot.alive).toBe(false);
    expect(op.counts.good).toBe(1);
    expect(trace.text()).toMatchSnapshot();
  });
});

describe('Venom', () => {
  it('untreated drain rises monotonically at the op rate; tincture is COOL "Antidote" below spread 50, else GOOD', () => {
    const { op, ents, trace } = scenario((o) => [new Venom(at(-100, 0), o, 6), new Venom(at(100, 0), o, 6)]);
    const [early, late] = ents;
    let last = early.drain(op);
    for (let i = 0; i < 60 * 4; i++) {
      op.update(DT);
      const d = early.drain(op);
      expect(d).toBeGreaterThanOrEqual(last);
      last = d;
    }
    expect(early.spreadR).toBeCloseTo(16 + 6 * 4, 6);
    holdAt(op, 'tincture', early.pos, 1);
    trace.note('early antidote', { spread: early.spreadR });
    expect(op.counts.cool).toBe(1);
    while (late.spreadR < 50) op.update(DT);
    holdAt(op, 'tincture', late.pos, 1);
    trace.note('late antidote', { spread: late.spreadR });
    expect(op.counts.good).toBe(1);
    expect(trace.text()).toMatchSnapshot();
  });

  it('spread caps at 120', () => {
    const { op, ents } = scenario((o) => [new Venom(at(0, 0), o, 9)]);
    step(op, 30);
    expect(ents[0].spreadR).toBe(120);
  });
});
