/** ENG-0133–0142: operation VFX emitters driven by simulation state and events. */
import { describe, expect, it } from 'vitest';
import type { Vec } from '../../../src/core/math';
import { Particles } from '../../../src/render/particles';
import { OperationVfx, type VfxFrame } from '../../../src/scenes/opVfx';
import { Burn, Grub, Laceration, Sigil, SIGILS, Venom } from '../../../src/surgery/entities';
import { FIELD, type Operation } from '../../../src/surgery/operation';
import { DT, isolate } from '../../helpers/sim';

const at = (dx: number, dy: number): Vec => ({ x: FIELD.cx + dx, y: FIELD.cy + dy });

/** Run the director for `seconds` of 60 Hz ticks with a fixed heartbeat period. */
function run(op: Operation, vfx: OperationVfx, seconds: number, frame: Partial<VfxFrame> = {}, bpm = 60, sim = true): void {
  let beat = 0.5;
  for (let t = 0; t < seconds; t += DT) {
    if (sim) op.update(DT);
    beat = (beat + (DT * bpm) / 60) % 1;
    vfx.update(op, DT, { beat, pointer: at(0, 0), down: false, light: { x: FIELD.cx - 220, y: 60 }, starTrail: [], gore: 1, ...frame });
  }
}

const count = (p: Particles, id: string) =>
  (p as unknown as { pools: Record<string, { id: string }[]> }).pools &&
  Object.values((p as unknown as { pools: Record<string, { id: string }[]> }).pools)
    .flat()
    .filter((x) => x.id === id).length;

function setup<T extends import('../../../src/surgery/entity').Entity>(spawn: (op: Operation) => T[]) {
  const { op, ents } = isolate(spawn);
  const fx = new Particles(undefined, 5);
  const vfx = new OperationVfx(() => fx);
  vfx.listen(op, () => 1);
  return { op, ents, fx, vfx };
}

describe('arterial spray (ENG-0133)', () => {
  it('pulses on each heartbeat from severe lacerations only, stronger for faster bleeds', () => {
    const severe = setup(() => [new Laceration(at(0, 0), 0.3, 120, 1.4)]);
    let bursts = 0;
    let last = 0;
    let beat = 0.5;
    for (let i = 0; i < 180; i++) {
      beat = (beat + DT) % 1;
      severe.vfx.update(severe.op, DT, { beat, pointer: at(300, 0), down: false, light: at(-200, -300), starTrail: [], gore: 1 });
      const n = count(severe.fx, 'arterial');
      if (n > last + 8) bursts++;
      last = n;
    }
    // Three seconds at 60 bpm: three systoles, three jets.
    expect(bursts).toBe(3);
    const mild = setup(() => [new Laceration(at(0, 0), 0.3, 40, 0.4)]);
    run(mild.op, mild.vfx, 3, {}, 60, false);
    expect(count(mild.fx, 'arterial')).toBe(0);
    const jet = (bleed: number) => {
      const s = setup(() => [new Laceration(at(0, 0), 0.3, 120, bleed)]);
      run(s.op, s.vfx, 3, {}, 60, false);
      return count(s.fx, 'arterial');
    };
    expect(jet(1.2)).toBeGreaterThan(jet(0.6) * 1.6);
  });

  it('lands its droplets as blood (stains) and respects the gore setting', () => {
    const s = setup(() => [new Laceration(at(0, 0), 0.3, 120, 1.4)]);
    run(s.op, s.vfx, 1.2, { gore: 0 }, 60, false);
    expect(count(s.fx, 'arterial')).toBe(0);
    run(s.op, s.vfx, 1.2, {}, 60, false);
    let landed = 0;
    s.fx.update(2, (_p, kind) => kind === 'blood' && landed++);
    expect(landed).toBeGreaterThan(5);
  });
});

describe('cut spatter (ENG-0134)', () => {
  it('bursts along the stroke, far heavier for a MISS than a COOL cut', () => {
    const s = setup(() => [new Laceration(at(200, 200), 0, 30, 0.1)]);
    s.op.setTool('lancet');
    run(s.op, s.vfx, 0.1, { pointer: at(10, 0) }, 60, false);
    s.op.rate('cool', at(0, 0), 'Clean cut');
    const cool = count(s.fx, 'spatter');
    s.fx.clear();
    s.op.rate('miss', at(0, 0), 'Stray cut');
    expect(count(s.fx, 'spatter')).toBeGreaterThanOrEqual(cool * 4);
  });
});

describe('cautery, hexfire, venom, grubs, tinctures, salve and the Litany (ENG-0135–0142)', () => {
  it('sears with sparks, smoke and ember glow only while the Brand touches tissue', () => {
    const s = setup(() => [new Laceration(at(300, 300), 0, 20, 0.1)]);
    s.op.setTool('brand');
    run(s.op, s.vfx, 0.5, { pointer: at(0, 0), down: false }, 60, false);
    expect(count(s.fx, 'searSpark')).toBe(0);
    run(s.op, s.vfx, 0.5, { pointer: at(0, 0), down: true }, 60, false);
    for (const id of ['searSpark', 'searSmoke', 'searEmber']) expect(count(s.fx, id)).toBeGreaterThan(0);
  });

  it('burns hexfire violet and green and sends curse motes toward a live Sigil', () => {
    const s = setup((op) => [new Burn(at(-100, 0), 30, op, 'hexfire'), new Sigil(at(150, 0), SIGILS.eye)]);
    run(s.op, s.vfx, 2, {}, 60, false);
    expect(count(s.fx, 'hexFlame')).toBeGreaterThan(10);
    expect(count(s.fx, 'hexSpark')).toBeGreaterThan(0);
    expect(count(s.fx, 'curseMote')).toBeGreaterThan(0);
  });

  it('mists from live venom and stops once it is neutralised', () => {
    const s = setup((op) => [new Venom(at(0, 0), op)]);
    run(s.op, s.vfx, 1, {}, 60, false);
    expect(count(s.fx, 'venomMist')).toBeGreaterThan(3);
    for (const e of s.op.entities) e.kill();
    s.fx.update(3, () => {});
    run(s.op, s.vfx, 1, {}, 60, false);
    expect(count(s.fx, 'venomMist')).toBe(0);
  });

  it('squishes and scatters twitching segments when a grub dies', () => {
    const s = setup((op) => [new Grub(at(0, 0), op)]);
    s.op.events.emit('death', { entity: s.ents[0] });
    expect(count(s.fx, 'grubSquish')).toBeGreaterThan(8);
    expect(count(s.fx, 'grubSegment')).toBeGreaterThan(2);
  });

  it('shimmers at the tincture needle and drips salve along the stroke', () => {
    const s = setup(() => [new Laceration(at(300, 300), 0, 20, 0.1)]);
    s.op.setTool('tincture');
    s.op.rate('good', at(0, 0), 'Injected');
    expect(count(s.fx, 'tinctureShimmer')).toBeGreaterThan(0);
    s.op.setTool('salve');
    run(s.op, s.vfx, 0.5, { pointer: at(0, 0), down: true }, 60, false);
    expect(count(s.fx, 'salveDrop')).toBeGreaterThan(3);
  });

  it('lays gold motes along the star and holds motes in the air until the Litany ends', () => {
    const s = setup(() => [new Laceration(at(300, 300), 0, 20, 0.1)]);
    s.vfx.update(s.op, DT, { beat: 0, pointer: at(0, 0), down: false, light: at(0, -300), starTrail: [at(0, 0), at(20, 0), at(40, 10)], gore: 1 });
    expect(count(s.fx, 'litanyGold')).toBeGreaterThanOrEqual(2);
    s.op.litanyTime = 5;
    run(s.op, s.vfx, 1, {}, 60, false);
    const held = count(s.fx, 'heldMote');
    expect(held).toBeGreaterThan(10);
    s.op.litanyTime = 0;
    run(s.op, s.vfx, 0.05, {}, 60, false);
    s.fx.update(0.5, () => {});
    expect(count(s.fx, 'heldMote')).toBe(0);
  });
});
