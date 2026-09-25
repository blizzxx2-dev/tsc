import { describe, expect, it } from 'vitest';
import { OperationVfx } from '../../../src/scenes/opVfx';
import { Particles } from '../../../src/render/particles';
import { Grub, Laceration, Venom } from '../../../src/surgery/entities';
import { at, start, wait } from '../../harness';

describe('entity lifecycle events drive the VFX director (ENG-0247)', () => {
  it('tracks effect sources from spawn/death events, never from a scan', () => {
    const op = start(() => [new Laceration(at(200, 150), 0, 40, 0)]);
    const vfx = new OperationVfx(() => new Particles());
    vfx.listen(op, () => 1);
    expect(vfx.tracked.size).toBe(1);
    const lac = new Laceration(at(0, 0), 0, 60, 1);
    const venom = new Venom(at(-80, 0), op, 6);
    op.spawn(lac, venom, new Grub(at(60, 60), op, 0));
    // Grubs drive no continuous effect.
    expect(vfx.tracked.size).toBe(3);
    lac.kill();
    wait(op, 0.05);
    expect(vfx.tracked.has(lac)).toBe(false);
    expect(vfx.tracked.has(venom)).toBe(true);
  });
});
