/**
 * BOS-0131: Compline's Examen wears Matins, Lauds and Prime by reusing their modules. Each echo,
 * run alone on the table, passes that Hour's own unit checks (the same assertions as
 * tests/hours.test.ts and tests/bosses.test.ts), bar the documented echo differences.
 */
import { describe, expect, it } from 'vitest';
import { LaudsEcho, MatinsEcho } from '../src/surgery/bosses/compline';
import { NameSigil } from '../src/surgery/bosses/prime';
import { Laceration } from '../src/surgery/entities';
import { ChoirVoice, LaudsMalison, LAUDS_DEFAULT, VOICE_SIGIL } from '../src/surgery/lauds';
import { Malison, MalisonShard } from '../src/surgery/malison';
import { Grub } from '../src/surgery/entities';
import { all, at, Hand, start, wait } from './harness';

describe('Compline’s Matins echo is the Matins module', () => {
  it('is a Malison: veiled 4 s with the 0.8 s tell, open 2.5 s, a rend while veiled', () => {
    let m!: MatinsEcho;
    const op = start((o) => [(m = new MatinsEcho(at(0, 0), o))]);
    expect(m).toBeInstanceOf(Malison);
    wait(op, 3.3);
    expect(m.openTelling).toBe(true);
    expect(m.open).toBe(false);
    wait(op, 0.75);
    expect(m.open).toBe(true);
    wait(op, 2.5);
    expect(m.open).toBe(false);
    wait(op, 3);
    expect(all(op, Laceration).length).toBe(1);
  });

  it('veiled branding: one MISS and a hint, then none for 5 s', () => {
    let m!: MatinsEcho;
    const op = start((o) => [(m = new MatinsEcho(at(0, 0), o))]);
    new Hand(op).hold('brand', m.pos, 0.5);
    new Hand(op).hold('brand', m.pos, 0.5);
    expect(op.counts.miss).toBe(1);
    expect(op.callouts.some((c) => c.includes('Wait for it to open'))).toBe(true);
  });

  it('the echo difference: it sheds no shards and at most two hexlings', () => {
    let m!: MatinsEcho;
    const op = start((o) => [(m = new MatinsEcho(at(0, 0), o))]);
    for (let i = 0; i < 6; i++) {
      wait(op, 4.2);
      if (m.alive && m.open) new Hand(op).hold('brand', m.pos, 0.4);
    }
    expect(all(op, MalisonShard).length).toBe(0);
    expect(all(op, Grub).length).toBeLessThanOrEqual(2);
  });
});

describe('Compline’s Lauds echo is the Lauds module', () => {
  it('is a LaudsMalison: a Voice is silenced by tracing its sigil; the heart is bare when all are silent', () => {
    let l!: LaudsEcho;
    const op = start((o) => [(l = new LaudsEcho(at(0, 0), o))]);
    expect(l).toBeInstanceOf(LaudsMalison);
    const h = new Hand(op);
    const v = all(op, ChoirVoice)[0];
    h.hold('brand', v.pos, 1.0);
    expect(v.alive).toBe(true);
    for (const voice of all(op, ChoirVoice)) h.traceMoving('brand', () => voice.pos, VOICE_SIGIL, 2);
    expect(l.livingVoices.length).toBe(0);
    wait(op, 0.1);
    expect(l.bareT).toBeGreaterThan(0);
  });

  it('rekindled Voices return half-traced — and the echo keeps only two', () => {
    const op = start((o) => [new LaudsEcho(at(0, 0), o)]);
    expect(all(op, ChoirVoice).length).toBe(2);
    for (const v of all(op, ChoirVoice)) v.kill();
    wait(op, LAUDS_DEFAULT.exposure + 0.2);
    const back = all(op, ChoirVoice);
    expect(back.length).toBe(2);
    for (const v of back) expect(v.traced).toBeCloseTo(0.5, 1);
  });
});

describe('Compline’s Prime echo is the Prime module', () => {
  it('erases only in reverse stroke order', () => {
    let n!: NameSigil;
    const op = start((o) => [(n = new NameSigil(at(0, 0), 'Aldo Brenck', o, 1.5))]);
    wait(op, 4.6);
    expect(n.written).toBe(3);
    const bad = op.counts.bad;
    new Hand(op).drag('lancet', n.strokes[0], 200);
    expect(op.counts.bad).toBe(bad + 1);
    new Hand(op).drag('lancet', n.strokes[2], 200);
    expect(n.written).toBe(2);
  });

  it('a finished name costs 18 vitals and opens a cut per letter; the Litany stills the quill', () => {
    let n!: NameSigil;
    const op = start((o) => [(n = new NameSigil(at(0, 0), 'Grete Hollweg', o, 0.5)), new Grub(at(300, 0), o, 0)]);
    const v = op.vitals;
    wait(op, 2.6);
    expect(n.alive).toBe(false);
    expect(v - op.vitals).toBeGreaterThanOrEqual(18);
    expect(all(op, Laceration).length).toBe(5);
    let q!: NameSigil;
    const op2 = start((o) => [(q = new NameSigil(at(0, 0), 'Utz Pfennig', o, 1.5))]);
    op2.invokeLitany();
    wait(op2, 3);
    expect(q.written).toBe(0);
  });
});
