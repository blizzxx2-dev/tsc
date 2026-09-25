import { describe, expect, it } from 'vitest';
import { dist } from '../src/core/math';
import { Laceration } from '../src/surgery/entities';
import type { Entity } from '../src/surgery/entity';
import { activeBoss, ADD_RATING_CAP, addRatingsOf, BossDeath, CINEMATIC_SECONDS, clampToField, DRAIN_BUDGET, drainAudit, spawnedByBoss } from '../src/surgery/bosses/base';
import { BOSS_TELLS, Cadence, TELL_MIN_LEAD, type BossEvent, type BossOpDef } from '../src/surgery/bosses/signals';
import { bossBarRect, veiledBelow } from '../src/surgery/bosses/hud';
import { Malison, MalisonShard, MATINS_DEFAULT, MATINS_PHASES } from '../src/surgery/malison';
import { ChoirVoice, EggSac, LaudsBody, LaudsMalison, LAUDS_DEFAULT, LightThread, SPIDERLING_CAP, SpiderlingGrub, VOICE_SIGIL } from '../src/surgery/lauds';
import { CantorKnot, EggCluster, FangNest, HERALD_BONUS, MatinsHerald } from '../src/surgery/bosses/elites';
import { FIELD, onBody, type Operation, type OperationDef } from '../src/surgery/operation';
import { all, at, DT, Hand, start, wait } from './harness';

const events = (op: Operation): BossEvent[] => {
  const out: BossEvent[] = [];
  op.events.on('boss', (e) => out.push(e));
  return out;
};
const boss = (opts: Partial<BossOpDef> = {}) => opts as Partial<OperationDef>;

// ============================================================ framework

describe('MalisonBase framework', () => {
  it('phases follow HP thresholds one at a time, with a frozen 1.2 s beat', () => {
    let m!: Malison;
    const op = start((o) => [(m = new Malison(at(0, 0), o))]);
    const ev = events(op);
    m.damage(op, 95);
    expect(m.phaseIx).toBe(1);
    expect(m.hp).toBeCloseTo(60);
    expect(op.freezeT).toBeCloseTo(CINEMATIC_SECONDS);
    expect(ev.filter((e) => e.kind === 'phase').length).toBe(1);
    const t = op.elapsed;
    wait(op, 1.0);
    expect(op.elapsed).toBe(t); // the sim stood still
    wait(op, 0.3);
    expect(op.elapsed).toBeGreaterThan(t);
  });

  it('repeat attempts skip the cinematic beat', () => {
    let m!: Malison;
    const op = start((o) => [(m = new Malison(at(0, 0), o))], boss({ skipCinematics: true }));
    m.damage(op, 45);
    expect(m.phaseIx).toBe(1);
    expect(op.freezeT).toBe(0);
  });

  it('music intensity follows the phases and falls silent on death', () => {
    let m!: Malison;
    const op = start((o) => [(m = new Malison(at(0, 0), o))], boss({ skipCinematics: true }));
    const ev = events(op);
    wait(op, 0.1);
    m.damage(op, 45);
    m.damage(op, 40);
    m.damage(op, 100);
    const music = ev.filter((e): e is Extract<BossEvent, { kind: 'music' }> => e.kind === 'music').map((e) => e.intensity);
    expect(music).toEqual([2, 3, 0]);
  });

  it('death: a 2.5 s dissolve, adds wither (killed unrated), shards remain', () => {
    let m!: Malison;
    const op = start((o) => [(m = new Malison(at(0, 0), o))], boss({ skipCinematics: true }));
    const shard = new MalisonShard(at(100, 0), op, 'crawler');
    expect(m.spawnAdd(op, shard)).toBe(true);
    expect(spawnedByBoss(shard)).toBe(true);
    const rated = op.counts.cool + op.counts.good + op.counts.miss + op.counts.bad;
    m.damage(op, 200);
    expect(m.alive).toBe(false);
    expect(shard.alive).toBe(false);
    expect(op.counts.cool + op.counts.good + op.counts.miss + op.counts.bad).toBe(rated + 1); // "Malison unmade" only
    const death = all(op, BossDeath)[0];
    expect(death).toBeDefined();
    expect(death.required).toBe(false);
    expect(all(op, MalisonShard).length).toBe(3); // the post-death fragments
  });

  it('the drain budget refuses adds that would pass 2.0/s on Surgeon', () => {
    let m!: Malison;
    const op = start((o) => [(m = new Malison(at(0, 0), o))]);
    let n = 0;
    for (let i = 0; i < 20; i++) if (m.spawnAdd(op, new Laceration(at(i * 10 - 100, 80), 0, 60, 1))) n++;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(20);
    expect(m.drainTotal(op)).toBeLessThanOrEqual(DRAIN_BUDGET.surgeon + 1e-9);
  });

  it('checkpoint resume: phase 2 and 3 start at their HP with no leftover adds', () => {
    for (const cp of [1, 2]) {
      let m!: Malison;
      const op = start((o) => [(m = new Malison(at(0, 0), o))], boss({ bossCheckpoint: cp }));
      expect(m.phaseIx).toBe(cp);
      expect(m.hp).toBeCloseTo(100 * MATINS_PHASES[cp].from);
      expect(m.liveAdds().length).toBe(0);
      expect(all(op, MalisonShard).length).toBe(0);
      expect(all(op, Laceration).length).toBe(0);
    }
  });

  it('boss-add ratings are capped (farming guard)', () => {
    let m!: Malison;
    const op = start((o) => [(m = new Malison(at(0, 0), o))], boss({ skipCinematics: true }));
    for (let i = 0; i < ADD_RATING_CAP + 5; i++) {
      const s = new MalisonShard(at(-200, 0), op, 'crawler');
      op.spawn(s);
      new Hand(op).hold('brand', s.pos, 0.35);
    }
    expect(addRatingsOf(op)).toBe(ADD_RATING_CAP);
    void m;
  });

  it('clampToField keeps a point 40 px inside the field', () => {
    const p = clampToField({ x: FIELD.cx + FIELD.rx + 100, y: FIELD.cy }, 40);
    expect(p.x).toBeCloseTo(FIELD.cx + FIELD.rx - 40);
    expect(onBody(p)).toBe(true);
  });

  it('boss HUD: later phases stay veiled until reached; elites use the compact bar', () => {
    let m!: Malison;
    const op = start((o) => [(m = new Malison(at(0, 0), o))], boss({ skipCinematics: true }));
    expect(activeBoss(op)).toBe(m);
    expect(veiledBelow(m)).toBeCloseTo(0.6);
    m.damage(op, 45);
    expect(veiledBelow(m)).toBeCloseTo(0.25);
    m.damage(op, 40);
    expect(veiledBelow(m)).toBe(0);
    const full = bossBarRect(m);
    m.elite = true;
    expect(bossBarRect(m).w).toBeLessThan(full.w);
  });
});

describe('tells (BOS-0003)', () => {
  it('every attack of every boss declares a tell of at least 0.8 s', () => {
    for (const [b, attacks] of Object.entries(BOSS_TELLS)) {
      for (const [a, tell] of Object.entries(attacks)) {
        expect(tell.lead, `${b}.${a}`).toBeGreaterThanOrEqual(TELL_MIN_LEAD.surgeon);
        expect(tell.visual.length, `${b}.${a}`).toBeGreaterThan(0);
        expect(tell.audio.length, `${b}.${a}`).toBeGreaterThan(0);
      }
    }
  });

  it('a Cadence tells exactly `lead` before it attacks', () => {
    const c = new Cadence(4, 0.8);
    let told = -1;
    let hit = -1;
    for (let t = 0; t < 4.2; t += DT) {
      const e = c.step(DT);
      if (e === 'tell') told = t;
      if (e === 'attack') hit = t;
    }
    expect(hit - told).toBeCloseTo(0.8, 1);
  });

  for (const diff of ['novice', 'surgeon'] as const) {
    it(`Matins and Lauds attacks follow their tells by the minimum lead on ${diff}`, () => {
      for (const make of [(o: Operation) => new Malison(at(0, 0), o), (o: Operation) => new LaudsMalison(at(0, 0), o)]) {
        let b!: Malison | LaudsMalison;
        const op = start((o) => [(b = make(o))], boss({ difficulty: diff, skipCinematics: true }));
        const lastTell = new Map<string, number>();
        const gaps: number[] = [];
        op.events.on('boss', (e) => {
          if (e.kind === 'tell') lastTell.set(e.attack, op.elapsed);
          if (e.kind === 'attack' && lastTell.has(e.attack)) gaps.push(op.elapsed - lastTell.get(e.attack)!);
        });
        for (const hp of [100, 50, 20]) {
          b.hp = hp;
          if (hp < 100) b.damage(op, 0.001);
          wait(op, 25);
        }
        expect(gaps.length).toBeGreaterThan(3);
        for (const g of gaps) expect(g).toBeGreaterThanOrEqual(TELL_MIN_LEAD[diff] - 2 * DT);
      }
    });
  }
});

// ============================================================ Matins

describe('Matins — the Night Vigil', () => {
  it('Vigil: veiled 4 s, the tell 0.8 s before opening, rend every 4.5 s veiled', () => {
    let m!: Malison;
    const op = start((o) => [(m = new Malison(at(0, 0), o))]);
    const ev = events(op);
    wait(op, 3.3);
    expect(m.openTelling).toBe(true);
    expect(m.open).toBe(false);
    wait(op, 0.75);
    expect(m.open).toBe(true);
    expect(ev.some((e) => e.kind === 'sound' && e.sound === 'toll')).toBe(true);
    wait(op, 2.5);
    expect(m.open).toBe(false);
    wait(op, 3);
    expect(all(op, Laceration).length).toBe(1);
  });

  it('Watchfire: open 2.0 s; each veil close sheds 2 crawling shards; the Litany is taught', () => {
    let m!: Malison;
    const op = start((o) => [(m = new Malison(at(0, 0), o))], boss({ skipCinematics: true }));
    m.damage(op, 45);
    expect(m.phase.key).toBe('watchfire');
    expect(op.flags.has('tutorial-litany')).toBe(true);
    wait(op, 4.05);
    expect(m.open).toBe(true);
    wait(op, 1.9);
    expect(m.open).toBe(true);
    wait(op, 0.2);
    expect(m.open).toBe(false);
    expect(m.shedLog).toEqual([2]);
    expect(all(op, MalisonShard).every((s) => s.mode === 'crawler')).toBe(true);
  });

  it('crawling shards make for the nearest wound and feed on it', () => {
    let s!: MalisonShard;
    const op = start((o) => [new Laceration(at(120, 0), 0, 40, 0), (s = new MalisonShard(at(0, 0), o, 'crawler'))]);
    const v = op.vitals;
    wait(op, 12);
    expect(s.alive).toBe(false);
    expect(op.counts.miss).toBe(1);
    expect(v - op.vitals).toBeGreaterThanOrEqual(4);
  });

  it('The Eye: only the third beat bites, for double damage; off-beat brands rend', () => {
    let m!: Malison;
    const op = start((o) => [(m = new Malison(at(0, 0), o))], boss({ skipCinematics: true }));
    m.damage(op, 80);
    expect(m.phase.key).toBe('eye');
    // Beat 1: off the beat.
    const lacs = all(op, Laceration).length;
    new Hand(op).hold('brand', m.pos, 0.3);
    expect(op.counts.miss).toBe(1);
    expect(all(op, Laceration).length).toBe(lacs + 1);
    // Beat 3: double damage.
    wait(op, 2 * MATINS_DEFAULT.beat - 0.3 + 0.05);
    expect(m.beat).toBe(3);
    const hp = m.hp;
    new Hand(op).hold('brand', m.pos, 0.5);
    expect(hp - m.hp).toBeCloseTo(MATINS_DEFAULT.dps * MATINS_DEFAULT.eyeMult * 0.5, 0);
  });

  it('the gaze lash: off the line it misses, on the line it cuts', () => {
    for (const dodge of [true, false]) {
      let m!: Malison;
      const op = start((o) => [(m = new Malison(at(0, 0), o, 'matins', 100, { gazeEvery: 1 }))], boss({ skipCinematics: true }));
      m.damage(op, 80);
      const h = new Hand(op);
      const aim = { x: m.pos.x + 150, y: m.pos.y };
      // Rest the hand on the flesh beside the eye until the gaze locks.
      while (!m.gaze) h.hover(aim);
      const lacs = all(op, Laceration).length;
      const off = { x: aim.x, y: aim.y + 90 };
      for (let t = 0; t < 1.2; t += DT) h.hover(dodge ? off : { x: m.pos.x + m.gaze!.dir.x * 150, y: m.pos.y + m.gaze!.dir.y * 150 });
      expect(all(op, Laceration).length, `dodge=${dodge}`).toBe(dodge ? lacs : lacs + 1);
    }
  });

  it('veiled branding: one MISS and a hint, then none for 5 s', () => {
    let m!: Malison;
    const op = start((o) => [(m = new Malison(at(0, 0), o))]);
    new Hand(op).hold('brand', m.pos, 0.5);
    new Hand(op).hold('brand', m.pos, 0.5);
    expect(op.counts.miss).toBe(1);
    expect(op.callouts.some((c) => c.includes('Wait for it to open'))).toBe(true);
  });

  it('never drifts within 40 px of the field edge', () => {
    let m!: Malison;
    const op = start((o) => [(m = new Malison(at(0, 0), o))]);
    for (let i = 0; i < 120; i++) {
      wait(op, 1);
      const p = clampToField(m.pos, 40 + m.radius);
      expect(dist(p, m.pos)).toBeLessThan(0.5);
    }
  });
});

// ============================================================ Lauds

describe('Lauds — the Antiphon', () => {
  it('Call: a Voice is silenced by tracing its sigil; the heart is bare when all are silent', () => {
    let l!: LaudsMalison;
    const op = start((o) => [(l = new LaudsMalison(at(0, 0), o))]);
    const v = all(op, ChoirVoice)[0];
    const h = new Hand(op);
    // Holding still on the voice silences nothing: it must be traced.
    h.hold('brand', v.pos, 1.0);
    expect(v.alive).toBe(true);
    for (const voice of all(op, ChoirVoice)) h.traceMoving('brand', () => voice.pos, VOICE_SIGIL, 2);
    expect(l.livingVoices.length).toBe(0);
    wait(op, 0.1);
    expect(l.bareT).toBeGreaterThan(0);
  });

  it('rekindled Voices return half-traced', () => {
    let l!: LaudsMalison;
    const op = start((o) => [(l = new LaudsMalison(at(0, 0), o))]);
    for (const v of all(op, ChoirVoice)) v.kill();
    wait(op, LAUDS_DEFAULT.exposure + 0.2);
    const back = all(op, ChoirVoice);
    expect(back.length).toBe(2);
    for (const v of back) expect(v.traced).toBeCloseTo(0.5, 1);
    void l;
  });

  it('Response: an unanswered strike half-heals; an answered one stands', () => {
    let l!: LaudsMalison;
    const op = start((o) => [(l = new LaudsMalison(at(0, 0), o))], boss({ skipCinematics: true }));
    l.damage(op, 36);
    expect(l.phase.key).toBe('response');
    const b = all(op, LaudsBody)[0];
    const hp0 = l.hp;
    l.strike(op, 'core', 4, l.pos);
    wait(op, LAUDS_DEFAULT.response + 0.1);
    expect(l.hp).toBeCloseTo(hp0 - 2);
    const hp1 = l.hp;
    l.strike(op, 'core', 4, l.pos);
    wait(op, 0.5);
    l.strike(op, 'partner', 4, b.pos);
    expect(l.pending?.from).toBe('partner');
    expect(l.hp).toBeCloseTo(hp1 - 8);
  });

  it('severance: the lancet across the dimmed thread unlinks for 8 s', () => {
    let l!: LaudsMalison;
    const op = start((o) => [(l = new LaudsMalison(at(0, 0), o))], boss({ skipCinematics: true }));
    l.damage(op, 36);
    const th = all(op, LightThread)[0];
    while (!th.dimmed) wait(op, DT);
    const mid = th.pos;
    new Hand(op).drag('lancet', [{ x: mid.x, y: mid.y - 30 }, { x: mid.x, y: mid.y + 30 }], 600);
    expect(l.unlinked).toBe(true);
    wait(op, LAUDS_DEFAULT.unlink - 0.3);
    expect(l.unlinked).toBe(true);
    wait(op, 0.5);
    expect(l.unlinked).toBe(false);
  });

  it('Dawn: the flare blinds the Lens for 2 s after a 1 s horizon-glow tell', () => {
    let l!: LaudsMalison;
    const op = start((o) => [(l = new LaudsMalison(at(0, 0), o))], boss({ skipCinematics: true }));
    l.damage(op, 71);
    expect(l.phase.key).toBe('dawn');
    expect(l.submerged).toBe(true);
    wait(op, LAUDS_DEFAULT.flareEvery - 1 + 0.05);
    expect(l.flareTelling).toBe(true);
    wait(op, 1);
    expect(l.blinded).toBe(true);
    expect(l.blinds('lens')).toBe(true);
    // The Lens finds nothing while blind.
    new Hand(op).hold('lens', l.pos, 1.0);
    expect(l.submerged).toBe(true);
    wait(op, 1.1);
    expect(l.blinded).toBe(false);
    new Hand(op).hold('lens', l.pos, 0.7);
    expect(l.submerged).toBe(false);
  });

  it('hymn: one laceration per verse on Surgeon, two on Master', () => {
    for (const [diff, n] of [['surgeon', 1], ['master', 2]] as const) {
      let l!: LaudsMalison;
      const op = start((o) => [(l = new LaudsMalison(at(0, 0), o))], boss({ difficulty: diff }));
      wait(op, LAUDS_DEFAULT.hymnEvery * 3 + 2);
      expect(l.verseLog.length).toBeGreaterThanOrEqual(2);
      for (const c of l.verseLog) expect(c).toBeLessThanOrEqual(n);
      expect(Math.max(...l.verseLog)).toBe(n);
    }
  });

  it('submerged rot trail stays at 3 patches and scores as a boss add', () => {
    let l!: LaudsMalison;
    const op = start((o) => [(l = new LaudsMalison(at(0, 0), o))], boss({ skipCinematics: true }));
    l.damage(op, 71);
    let most = 0;
    for (let i = 0; i < 60; i++) {
      wait(op, 1);
      const rot = op.entities.filter((e: Entity) => e.alive && e.constructor.name === 'BossRot');
      most = Math.max(most, rot.length);
      for (const r of rot) expect(spawnedByBoss(r)).toBe(true);
    }
    expect(most).toBeGreaterThan(0);
    expect(most).toBeLessThanOrEqual(3);
  });

  it('checkpoint resume: Response and Dawn start with the right HP and state, no leftover adds', () => {
    let l!: LaudsMalison;
    const op = start((o) => [(l = new LaudsMalison(at(0, 0), o))], boss({ bossCheckpoint: 1 }));
    expect(l.phase.key).toBe('response');
    expect(l.hp).toBeCloseTo(65);
    expect(all(op, LaudsBody).length).toBe(1);
    expect(all(op, ChoirVoice).length).toBe(0);
    let l2!: LaudsMalison;
    const op2 = start((o) => [(l2 = new LaudsMalison(at(0, 0), o))], boss({ bossCheckpoint: 2 }));
    expect(l2.phase.key).toBe('dawn');
    expect(l2.hp).toBeCloseTo(30);
    expect(l2.submerged).toBe(true);
    expect(op2.entities.filter((e) => e.alive && spawnedByBoss(e)).length).toBe(0);
  });
});

describe('Brood-Mother sacs', () => {
  it('hatch at 10 s with a 3 s swell; never more than 6 live spiderlings', () => {
    const op = start((o) => [new EggSac(at(-100, 0), 5), new EggSac(at(100, 0), 5), new Laceration(at(0, 120), 0, 40, 0), o && new SpiderlingGrub(at(0, 0), o)].filter(Boolean) as Entity[]);
    const sac = all(op, EggSac)[0];
    wait(op, 7.5);
    expect(sac.swell).toBeGreaterThan(0.7);
    expect(sac.alive).toBe(true);
    wait(op, 2.6);
    expect(sac.alive).toBe(false);
    expect(all(op, SpiderlingGrub).length).toBeLessThanOrEqual(SPIDERLING_CAP);
  });
});

describe('Demo elites', () => {
  const ring = (c: { x: number; y: number }, r: number, turns = 1.05) =>
    Array.from({ length: Math.ceil(36 * turns) + 1 }, (_, i) => ({ x: c.x + Math.cos((i / 36) * Math.PI * 2) * r, y: c.y + Math.sin((i / 36) * Math.PI * 2) * r }));

  it('egg-cluster: left alone all three hatch together; cut first they part', () => {
    let c!: EggCluster;
    const op = start((o) => (c = new EggCluster(at(0, 0), o, 8)).all);
    wait(op, 8.2);
    expect(c.sacs.every((s) => !s.alive)).toBe(true);
    expect(op.counts.miss).toBe(3);

    let c2!: EggCluster;
    const op2 = start((o) => (c2 = new EggCluster(at(0, 0), o, 8)).all);
    new Hand(op2).drag('lancet', ring(c2.pos, 85), 500);
    expect(c2.cut).toBe(true);
    const t = c2.sacs.map((s) => s.hatchT).sort((a, b) => a - b);
    expect(t[1] - t[0]).toBeGreaterThanOrEqual(EggCluster.STAGGER - 0.01);
    expect(t[2] - t[1]).toBeGreaterThanOrEqual(EggCluster.STAGGER - 0.01);
  });

  it('egg-cluster: lancing a sac under the membrane wakes the brood', () => {
    let c!: EggCluster;
    const op = start((o) => (c = new EggCluster(at(0, 0), o, 20)).all);
    new Hand(op).tap('lancet', c.sacs[0].pos);
    wait(op, 1);
    expect(c.sacs.filter((s) => s.alive).length).toBe(0);
  });

  it('cantor’s knot re-ties one stroke per hum, after a hum tell', () => {
    let k!: CantorKnot;
    const op = start((o) => (k = new CantorKnot(at(0, -100), o, 5)).all);
    const seg = k.sigil.segs[0];
    new Hand(op).drag('brand', [seg.a, seg.b], 200);
    expect(seg.burned.some(Boolean)).toBe(true);
    while (!k.humming) wait(op, DT);
    wait(op, 1.05);
    expect(k.redrawn).toBe(1);
    expect(k.sigil.segs.every((s) => !s.burned.some(Boolean))).toBe(true);
  });

  it('fang-nest: pulling out of order spreads rot', () => {
    let n!: FangNest;
    const op = start((o) => (n = new FangNest(o, [[at(-60, 0), 0.9], [at(0, 0), 1.2], [at(60, 0), 0.6]])).all);
    const f = n.fangs[2];
    const grip = { x: f.origin.x + (f.handle.x - f.origin.x) * 0.7, y: f.origin.y + (f.handle.y - f.origin.y) * 0.7 };
    const d = { x: f.handle.x - f.origin.x, y: f.handle.y - f.origin.y };
    const l = Math.hypot(d.x, d.y);
    new Hand(op).drag('tongs', [grip, { x: grip.x + (d.x / l) * 110, y: grip.y + (d.y / l) * 110 }], 500);
    wait(op, 0.1);
    expect(f.alive).toBe(false);
    expect(n.spreads).toBe(1);
    expect(n.due).toBe(n.fangs[0]);
  });

  it('the Matins herald flees the lens and pays 300 when seared', () => {
    let h!: MatinsHerald;
    const op = start((o) => [(h = new MatinsHerald(at(0, 0), o))]);
    const hand = new Hand(op);
    op.setTool('lens');
    const p0 = { ...h.pos };
    for (let i = 0; i < 30; i++) hand.hover({ x: p0.x + 20, y: p0.y });
    expect(dist(h.pos, p0)).toBeGreaterThan(30);
    const s = op.score;
    op.setTool('brand');
    for (let t = 0; t < 1 && h.alive; t += DT) hand.press('brand', h.pos);
    hand.release();
    expect(h.caught).toBe(true);
    expect(op.score - s).toBeGreaterThanOrEqual(HERALD_BONUS);
  });
});

describe('drain audit', () => {
  it('no Matins/Lauds fight broke the drain budget in this run', () => {
    expect(drainAudit.violations).toBe(0);
  });
});
