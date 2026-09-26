/** Boss roadmap checks (BOS-*) that sit between the sim and the scenes: lost-patient names, story flags, assists, op tuning. */
import { describe, expect, it } from 'vitest';
import '../src/render/surgery';
import { drawDawn } from '../src/render/surgery/lauds';
import { drawEntity } from '../src/render/surgery/registry';
import { allCampaignOperations } from '../src/content/campaign';
import { bossStoryFlags, FlagStore } from '../src/content/flags';
import { NameSigil, patientName, PrimeMalison, PRIME_NAMES, primeRoll } from '../src/surgery/bosses/prime';
import type { BossEvent, BossOpDef } from '../src/surgery/bosses/signals';
import { Operation, type OperationDef } from '../src/surgery/operation';
import { lostPatientsOf } from '../src/scenes/bossAudio';
import { freshProgress, recordRun } from '../src/surgery/progress';
import { optionRows } from '../src/scenes/options';
import { at, Hand, start, wait } from './harness';
import { HeartTruth, ORGAN_RESIST, PETRIFY_SPEED, SextMalison } from '../src/surgery/bosses/sext';
import { LaudsMalison } from '../src/surgery/lauds';
import { Malison } from '../src/surgery/malison';
import { flashScale, presentation } from '../src/render/presentation';
import { alphaOf } from '../src/render/color';
import type { Gfx } from '../src/render/gfx';
import { DEFAULT_SETTINGS } from '../src/core/settings/schema';
import { NoneMalison, NONE_DEFAULT } from '../src/surgery/bosses/none';

const byId = (id: string) => allCampaignOperations().find((d) => d.id === id)!;
const boss = (o: Partial<BossOpDef>) => o as Partial<OperationDef>;

describe('Prime: the roll of the dead', () => {
  it('BOS-0055: names come from the lost-patient list first, falling back to the canned roll', () => {
    expect(lostPatientsOf({ fails: { 'op1-1': 1, 'op2-4': 2, 'op1-2': 0 } })).toEqual(['Jost']);
    // A patient lost once stays on the roll after the retry is won.
    const save = freshProgress();
    recordRun(save, { opId: 'op2-2', won: false, rank: 'C', score: 0, difficulty: 'surgeon', flags: [] });
    recordRun(save, { opId: 'op2-2', won: true, rank: 'B', score: 10, difficulty: 'surgeon', flags: [] });
    expect(lostPatientsOf(save)).toEqual(['Orsa Flintvein']);
    expect(patientName('A lay-cantor of the Hollow Choir')).toBeNull();
    expect(patientName('Orsa Flintvein, dwarf prospector')).toBe('Orsa Flintvein');
    let p!: PrimeMalison;
    const op = start((o) => [(p = new PrimeMalison(at(0, 0), o))], boss({ lostPatients: ['Jost', 'Orsa Flintvein', 'x<script>'] }));
    expect(primeRoll(op).slice(0, 2)).toEqual(['Jost', 'Orsa Flintvein']);
    expect(primeRoll(op)).not.toContain('x<script>');
    wait(op, 3);
    expect(p.names[0]?.name).toBe('Jost');
    const plain = start((o) => [new PrimeMalison(at(0, 0), o)]);
    expect(primeRoll(plain)).toBe(PRIME_NAMES);
  });

  it('BOS-0056: the monk reads each name the quill finishes', () => {
    const op = start((o) => [new NameSigil(at(0, 0), 'Aldo Brenck', o, 0.5)]);
    const sounds: string[] = [];
    op.events.on('boss', (e: BossEvent) => e.kind === 'sound' && sounds.push(e.sound));
    wait(op, 2.6);
    expect(sounds.filter((s) => s === 'reading').length).toBe(1);
  });
});

describe('story flags and assists reach the fights', () => {
  it('BOS-0139/0146: Stroh stands with the surgeon once he owes them his tooth', () => {
    const f = new FlagStore();
    expect(bossStoryFlags(f)).toEqual([]);
    f.set('strohTooth', true);
    expect(bossStoryFlags(f)).toEqual(['strohAlly']);
  });

  it('BOS-0069/0082/0085/0112: every boss assist has a row in the accessibility options', () => {
    const keys = optionRows('access').flatMap((r) => r.keys ?? []);
    for (const k of ['bossReducedLag', 'bossLagReadout', 'bossMinBrightness', 'bossHazeOutline']) expect(keys).toContain(k);
  });

  it('BOS-0067: the Hour of Terce deepens the salve pot to 70 and refills it after 2 s', () => {
    const op = new Operation(byId('op3-11'));
    expect(op.tuning.salve.capacity).toBe(70);
    expect(op.tuning.salve.refillIdle).toBe(2);
    expect(op.salve).toBe(70);
    expect(new Operation(byId('op3-10')).tuning.salve.capacity).toBe(46);
  });
});

describe('GAM-0239: shake and flash sliders reach the boss effects', () => {
  const glowAlphas = (draw: (g: Gfx) => void): number[] => {
    const out: number[] = [];
    const g = new Proxy(
      {},
      { get: (_t, k) => (k === 'glow' ? (_x: number, _y: number, _r: number, c: number) => out.push(alphaOf(c)) : () => undefined) },
    ) as Gfx;
    draw(g);
    return out;
  };

  it('flash intensity scales the Lauds dawn flare and the Matins opening; Reduce flashing caps it at 35 %', () => {
    expect(flashScale({ flashIntensity: 1, reduceFlashing: false })).toBe(1);
    expect(flashScale({ flashIntensity: 0.6, reduceFlashing: true })).toBe(0.35);
    expect(flashScale({ flashIntensity: 0.2, reduceFlashing: true })).toBe(0.2);
    let l!: LaudsMalison;
    const op = start((o) => [(l = new LaudsMalison(at(0, 0), o))], boss({ skipCinematics: true }));
    l.damage(op, 40);
    l.damage(op, 40);
    expect(l.phase.key).toBe('dawn');
    l.flareT = l.tune.flareFor;
    let m!: Malison;
    const op2 = start((o) => [(m = new Malison(at(0, 0), o))]);
    m.open = true;
    const sample = () => [...glowAlphas((g) => drawDawn(g, l, op)), ...glowAlphas((g) => drawEntity(g, m, op2))];
    presentation.flash = 1;
    const full = sample();
    presentation.flash = 0.5;
    const half = sample();
    presentation.flash = 1;
    expect(Math.max(...half)).toBeLessThan(Math.max(...full));
    expect(half[0]).toBeCloseTo(full[0] * 0.5, 1);
  });

  it('boss shakes go through the shake slider; the flash slider sits in the accessibility options', () => {
    expect(DEFAULT_SETTINGS.shake).toBe(1);
    expect(DEFAULT_SETTINGS.flashIntensity).toBe(1);
    expect(optionRows('display').flatMap((r) => r.keys ?? [])).toContain('shake');
    expect(optionRows('access').flatMap((r) => r.keys ?? [])).toContain('flashIntensity');
  });
});

describe('BOS-0090 / BOS-0177: None and the no-fail floor', () => {
  it('with the no-fail assist the burrower strikes the heart and burrows out again; without it, the patient is lost', () => {
    let n!: NoneMalison;
    const op = start((o) => [(n = new NoneMalison(o, NONE_DEFAULT))]);
    op.assists.noFail = true;
    n.s = n.total - 1;
    wait(op, 0.5);
    expect(op.status).toBe('running');
    expect(n.s).toBeLessThan(n.total / 2);
    let m!: NoneMalison;
    const op2 = start((o) => [(m = new NoneMalison(o, NONE_DEFAULT))]);
    m.s = m.total - 1;
    wait(op2, 0.5);
    expect(op2.status).toBe('lost');
  });
});

describe('GAM-0243: the auto-lens assist never strands an Hour', () => {
  it('Lauds under the skin surfaces (brandable) when the auto-lens finds it, not merely unhidden', () => {
    let l!: LaudsMalison;
    const op = start((o) => [(l = new LaudsMalison(at(0, 0), o))], boss({ skipCinematics: true }));
    op.assists.autoLens = true;
    l.damage(op, 40);
    l.damage(op, 40);
    expect(l.phase.key).toBe('dawn');
    l.surfacedT = 0;
    wait(op, 0.1);
    expect(l.submerged).toBe(true);
    expect(l.hidden).toBe(true);
    wait(op, 4.2);
    expect([l.hidden, l.submerged]).toEqual([false, false]);
    // It dives again later, and the auto-lens clock starts over: it stays under for a while first.
    l.surfacedT = 0;
    wait(op, 1);
    expect(l.submerged).toBe(true);
  });

  it('Sext’s heart keeps answering the Lens after the auto-lens has passed over it', () => {
    let s!: SextMalison;
    const op = start((o) => [(s = new SextMalison(at(0, 0), o))]);
    op.assists.autoLens = true;
    s.trueVitals = 40;
    wait(op, 5);
    const truth = op.entities.find((e) => e instanceof HeartTruth)!;
    expect(truth.hidden).toBe(true);
    new Hand(op).hold('lens', s.heart, 0.3);
    expect(s.lastSeenAt).toBeGreaterThan(4);
  });
});

describe('BOS-0080 Sext petrification', () => {
  it('stone spreads 3 px/s from the crust; an organ it reaches loses half its drain resistance', () => {
    let s!: SextMalison;
    const op = start((o) => [(s = new SextMalison(at(0, 0), o))]);
    expect(s.glyphs.map((g) => g.organ)).toEqual(['heart', 'lung', 'liver']);
    expect(s.stoneFactor).toBe(1);
    const drain0 = s.drain();
    wait(op, 10);
    expect(s.stone).toBeCloseTo(10 * PETRIFY_SPEED, 0);
    // The nearest organ petrifies once the front reaches it.
    const near = [...s.glyphs].sort((a, b) => Math.hypot(a.pos.x - s.pos.x, a.pos.y - s.pos.y) - Math.hypot(b.pos.x - s.pos.x, b.pos.y - s.pos.y))[0];
    const reach = (Math.hypot(near.pos.x - s.pos.x, near.pos.y - s.pos.y) - 12) / PETRIFY_SPEED;
    wait(op, reach - 10 + 1);
    expect(near.petrified).toBe(true);
    expect(near.resist).toBeCloseTo(ORGAN_RESIST / 2);
    expect(s.drain()).toBeGreaterThan(drain0 * 1.05);
    // With the crust gone the stone stops.
    for (const p of s.plates) p.kill();
    const r = s.stone;
    wait(op, 5);
    expect(s.stone).toBe(r);
  });
});
