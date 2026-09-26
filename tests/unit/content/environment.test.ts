import { describe, expect, it } from 'vitest';
import { MUD, MudSmear, RainDrips } from '../../../src/surgery/ailments/environment';
import { Laceration } from '../../../src/surgery/entities';
import { OP_4_1, OP_4_2 } from '../../../src/content/chapter4';
import { OP_5_10 } from '../../../src/content/ops/bones';
import { at, Hand, running } from '../../harness-gameplay';

describe('field environment as op data (CON-0121, CON-0138, CON-0139)', () => {
  it('the campaign uses it: rain in the tent, mud in the goring, a candle on Hollow Night', () => {
    expect(OP_4_1.env).toContain('rain');
    expect(OP_4_2.env).toContain('mud');
    expect(OP_5_10.env).toContain('candle');
  });

  it('rain starts once, however many phases', () => {
    const op = running(() => [new Laceration(at(0, 0), 0, 60, 0.4)], {
      env: ['rain'],
      phases: [{ spawn: () => [new Laceration(at(0, 0), 0, 60, 0.4)] }, { spawn: () => [new Laceration(at(80, 40), 0, 60, 0.4)] }],
    });
    expect(op.entities.filter((e) => e instanceof RainDrips)).toHaveLength(1);
  });

  it('mud fouls each wound: no stitch until the salve has cleaned it', () => {
    const op = running(() => [], { env: ['mud'], phases: [{ spawn: () => [new Laceration(at(0, 0), 0, 60, 0.4)] }, { spawn: () => [] }] });
    const lac = op.entities.find((e) => e instanceof Laceration)!;
    const mud = op.entities.find((e) => e instanceof MudSmear) as MudSmear;
    expect(mud).toBeDefined();
    const h = new Hand(op);
    const zig = [at(-30, -20), at(-20, 20), at(-10, -20), at(0, 20), at(10, -20), at(20, 20), at(30, -20)];
    h.drag('thread', zig, 300);
    expect(lac.alive).toBe(true);
    expect(op.flags.has('mud')).toBe(true);
    const pts = [];
    for (let y = -MUD.r; y <= MUD.r; y += 10) pts.push(at(-MUD.r, y), at(MUD.r, y));
    h.drag('salve', pts, 900);
    expect(mud.alive).toBe(false);
    h.drag('thread', zig, 300);
    expect(lac.alive).toBe(false);
  });

  it('candle follows the op: the lens sees less', () => {
    const lit = running(() => []);
    const dark = running(() => [], { env: ['candle'] });
    expect(dark.env.has('candle')).toBe(true);
    expect(dark.tuning.lens.radius).toBeLessThan(lit.tuning.lens.radius);
  });
});

describe('limited supplies (CON-0140)', () => {
  it('each stitch and dose comes off the stock; past empty it costs, but the work goes on', async () => {
    const { SUPPLY } = await import('../../../src/surgery/operation');
    const op = running(() => [new Laceration(at(0, 0), 0, 80, 0.4)], { supplies: { thread: 2, tincture: 1 } });
    const lac = op.entities[0];
    const h = new Hand(op);
    h.drag('thread', [at(-40, -20), at(-30, 20), at(-20, -20), at(-10, 20), at(0, -20), at(10, 20), at(20, -20), at(30, 20), at(40, -20)], 300);
    expect(lac.alive).toBe(false);
    expect(op.stock.thread).toBe(0);
    expect(op.overdrawn.thread).toBeGreaterThan(0);
    expect(op.endPenalty).toBe(SUPPLY.penalty * op.overdrawn.thread!);
    expect(op.status).not.toBe('lost');
  });

  it('the field chest after the ford carries supplies', async () => {
    const { OP_4_10 } = await import('../../../src/content/chapter4');
    expect(OP_4_10.supplies?.thread).toBeGreaterThan(0);
  });
});

describe('torpor in assisted play (CON-0162)', () => {
  it('lag is capped at 0.3 s on Novice or with slow tells, and not otherwise', async () => {
    const { distortion, TORPOR_ASSIST_CAP } = await import('../../../src/surgery/bosses/common');
    for (const [opts, capped] of [
      [{ difficulty: 'novice' as const }, true],
      [{ assists: { slowTells: true } }, true],
      [{}, false],
    ] as const) {
      const op = running(() => [new Laceration(at(0, 0), 0, 60, 0.4)], {}, opts);
      const d = distortion(op);
      d.lag = 0.6;
      new Hand(op).hold('lancet', at(200, 0), 0.1);
      expect(d.lag, JSON.stringify(opts)).toBe(capped ? TORPOR_ASSIST_CAP : 0.6);
    }
  });
});
