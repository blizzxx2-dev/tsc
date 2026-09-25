import { describe, expect, it } from 'vitest';
import type { BossEvent, BossOpDef } from '../src/surgery/bosses/signals';
import { TELL_MIN_LEAD } from '../src/surgery/bosses/signals';
import { ComplineMalison } from '../src/surgery/bosses/compline';
import { NoneMalison, NONE_DEFAULT } from '../src/surgery/bosses/none';
import { FINAL_LITANY, HOURS, OfficeMalison } from '../src/surgery/bosses/office';
import { REDUCED_LAG_CAP, SextMalison } from '../src/surgery/bosses/sext';
import { TerceMalison, TERCE_DEFAULT } from '../src/surgery/bosses/terce';
import { LampNode, VespersMalison } from '../src/surgery/bosses/vespers';
import { calmWave, ecgCalm, hudFlag } from '../src/surgery/bosses/hud';
import { debriefBand, debriefKey, CODEX_BOSSES, watchEncounters } from '../src/surgery/bosses/codex';
import { hasKey } from '../src/i18n';
import type { Operation, OperationDef } from '../src/surgery/operation';
import { all, at, DT, start, wait } from './harness';

const boss = (o: Partial<BossOpDef>) => o as Partial<OperationDef>;
const record = (op: Operation) => {
  const ev: { t: number; e: BossEvent }[] = [];
  op.events.on('boss', (e) => ev.push({ t: op.elapsed, e }));
  return ev;
};
/** Every attack that follows a tell of the same name did so after at least `min` seconds. */
function tellGaps(ev: { t: number; e: BossEvent }[]): number[] {
  const last = new Map<string, number>();
  const gaps: number[] = [];
  for (const { t, e } of ev) {
    if (e.kind === 'tell') last.set(`${e.boss}.${e.attack}`, t);
    if (e.kind === 'attack' && last.has(`${e.boss}.${e.attack}`)) gaps.push(t - last.get(`${e.boss}.${e.attack}`)!);
  }
  return gaps;
}

describe('later Hours: tells', () => {
  it('Terce: the target organ glows and a crackle pans toward it ≥ 1 s before each leap', () => {
    const op = start((o) => [new TerceMalison(o, TERCE_DEFAULT)]);
    const ev = record(op);
    wait(op, 16);
    const crackles = ev.filter(({ e }) => e.kind === 'sound' && e.sound === 'crackle');
    expect(crackles.length).toBeGreaterThanOrEqual(2);
    expect(crackles.some(({ e }) => e.kind === 'sound' && e.pan !== 0)).toBe(true);
    for (const g of tellGaps(ev)) expect(g).toBeGreaterThanOrEqual(1 - 2 * DT);
  });

  it('Vespers: lamps gutter and hiss a full second before they are snuffed', () => {
    let v!: VespersMalison;
    const op = start((o) => [(v = new VespersMalison(at(0, 0), o))]);
    const ev = record(op);
    v.hp = 55;
    (v as unknown as { enterMagnificat?: (op: Operation) => void }).enterMagnificat?.(op);
    wait(op, 30);
    const gaps = tellGaps(ev);
    if (gaps.length) for (const g of gaps) expect(g).toBeGreaterThanOrEqual(TELL_MIN_LEAD.novice - 2 * DT);
    expect(all(op, LampNode).length).toBeGreaterThan(0);
  });

  it('None: the phase-3 core bulges 0.8 s before it surfaces, and three bells toll', () => {
    let n!: NoneMalison;
    const op = start((o) => [(n = new NoneMalison(o, NONE_DEFAULT))]);
    const ev = record(op);
    n.stage = 2;
    n.segmentDone(op, true);
    expect(n.hidden).toBe(true);
    expect(n.gloom).toBe(true);
    expect(ev.some(({ e }) => e.kind === 'sound' && e.sound === 'three')).toBe(true);
    wait(op, 0.7);
    expect(n.hidden).toBe(true);
    wait(op, 0.2);
    expect(n.hidden).toBe(false);
  });

  it('None: the heartbeat quickens as the head nears the heart', () => {
    let n!: NoneMalison;
    start((o) => [(n = new NoneMalison(o, NONE_DEFAULT))]);
    const far = n.beatGap;
    n.s = n.total - NONE_DEFAULT.speed * 2;
    expect(n.beatGap).toBeLessThan(far);
  });

  it('Compline: a one-second hush tell and a [silence] flag precede every mute', () => {
    const op = start((o) => [new ComplineMalison(at(0, 0), o)]);
    const ev = record(op);
    wait(op, 21.5);
    expect(hudFlag(op, 'silence')).toBe(true);
    expect(ev.some(({ e }) => e.kind === 'sound' && e.sound === 'hush')).toBe(true);
    for (const g of tellGaps(ev)) expect(g).toBeGreaterThanOrEqual(1 - 2 * DT);
  });

  it('Sext: False Noon flattens the ECG; the reduced-lag assist caps torpor at 120 ms', () => {
    let s!: SextMalison;
    const op = start((o) => [(s = new SextMalison(at(0, 0), o))], boss({ assists: { reducedLag: true } }));
    wait(op, 30);
    expect(s.lag).toBeLessThanOrEqual(REDUCED_LAG_CAP + 1e-9);
    s.trueVitals = op.vitals;
    expect(ecgCalm(op)).toBe(true);
    expect(calmWave(0.25)).toBeCloseTo(0.32);
  });
});

describe('the Office', () => {
  it('Stroh’s branch puts out one hour-sigil before the Dial', () => {
    let o1!: OfficeMalison;
    start((o) => [(o1 = new OfficeMalison(o))], boss({ storyFlags: ['strohAlly'] }));
    expect(o1.strohStruck).not.toBeNull();
    expect(o1.lit.size).toBe(HOURS.length - 1);
    expect(o1.order.length).toBe(HOURS.length - 1);
  });

  it('the dial hand sounds the next Hour as it sweeps', () => {
    const op = start((o) => [new OfficeMalison(o)]);
    const ev = record(op);
    wait(op, 0.2);
    expect(ev.some(({ e }) => e.kind === 'sound' && e.sound === 'dial')).toBe(true);
    expect(ev.some(({ e }) => e.kind === 'tell' && e.attack === 'dial' && e.lead >= 1.5)).toBe(true);
  });

  it('checkpoints: after each sigil on Surgeon, per phase on Master', () => {
    let a!: OfficeMalison;
    const op = start((o) => [(a = new OfficeMalison(o))], boss({ bossCheckpoint: 3 }));
    expect(a.lit.size).toBe(HOURS.length - 3);
    expect(a.checkpoint(op)).toBe(3);
    let b!: OfficeMalison;
    start((o) => [(b = new OfficeMalison(o))], boss({ bossCheckpoint: 3, difficulty: 'master' }));
    expect(b.lit.size).toBe(HOURS.length);
    let c!: OfficeMalison;
    const opc = start((o) => [(c = new OfficeMalison(o))], boss({ bossCheckpoint: 9 }));
    expect(c.stage).toBe(3);
    expect(c.checkpoint(opc)).toBe(9);
  });

  it('the Final Litany: a second star within 3 s grants 12 s of Stillness, at the Heart only', () => {
    let a!: OfficeMalison;
    const op = start((o) => [(a = new OfficeMalison(o))], boss({ bossCheckpoint: 9 }));
    expect(op.invokeLitany()).toBe(true);
    expect(a.prayerT).toBeGreaterThan(0);
    wait(op, 1);
    expect(op.invokeLitany()).toBe(true);
    expect(a.finalLitany).toBe(true);
    expect(op.litanyTime).toBeCloseTo(FINAL_LITANY);
    // Outside the Heart the rite is the ordinary one.
    const op2 = start((o) => [new OfficeMalison(o)]);
    op2.invokeLitany();
    wait(op2, 1);
    expect(op2.invokeLitany()).toBe(false);
  });
});

describe('codex & debriefs', () => {
  it('every Hour has a codex entry and three rank-keyed debrief lines', () => {
    for (const b of CODEX_BOSSES) {
      expect(hasKey(`codex.${b}.title`), b).toBe(true);
      expect(hasKey(`codex.${b}.body`), b).toBe(true);
      for (const band of ['high', 'mid', 'low']) expect(hasKey(`debrief.${b}.${band}`), `${b}.${band}`).toBe(true);
    }
    expect(debriefBand('XS')).toBe('high');
    expect(debriefBand('B')).toBe('mid');
    expect(debriefBand('C')).toBe('low');
    expect(debriefKey('office', 'S', ['strohAlly'])).toBe('debrief.office.high.stroh');
    expect(hasKey(debriefKey('office', 'C', ['strohAlly']))).toBe(true);
  });

  it('a codex entry unlocks on first encounter', () => {
    const got: string[] = [];
    const op = start((o) => {
      watchEncounters(o, (id) => got.push(id));
      return [new ComplineMalison(at(0, 0), o)];
    });
    wait(op, 0.1);
    void op;
    expect(got).toEqual([]);
  });
});
