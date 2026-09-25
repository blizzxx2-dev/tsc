import { describe, expect, it } from 'vitest';
import { Input } from '../../../src/core/input';
import { Bindings } from '../../../src/input/bindings';
import { OperationInput } from '../../../src/input/opinput';
import { Laceration } from '../../../src/surgery/entities';
import type { Pointer } from '../../../src/surgery/types';
import { at, start } from '../../harness';

describe('extended pointer (ENG-0250)', () => {
  it('pen pressure, tilt and source reach the Pointer the simulation sees', () => {
    const op = start(() => [new Laceration(at(0, 0), 0, 60, 0.2)]);
    const seen: Pointer[] = [];
    const handle = op.handlePointer.bind(op);
    op.handlePointer = (ptr, dt) => {
      seen.push(ptr);
      handle(ptr, dt);
    };
    const input = new Input(null, 1280, 720, new Bindings(null));
    const ctl = new OperationInput();
    let t = 1000;
    const frame = () => {
      t += 16;
      input.beginFrame(t, 1 / 60);
      ctl.update(op, input, 1 / 60);
      input.endFrame();
    };
    input.push({ t: t + 1, type: 'move', x: 600, y: 380, src: 'kbm', stylus: { kind: 'pen', pressure: 0.8, tiltX: 20, tiltY: -10 } });
    input.push({ t: t + 2, type: 'down', code: 'mouse:0' });
    frame();
    frame();
    const pen = seen.filter((p) => p.source === 'pen');
    expect(pen.length).toBeGreaterThan(0);
    expect(pen[0].pressure).toBeCloseTo(0.8);
    expect(pen[0].tilt).toEqual({ x: 20, y: -10 });
    // A plain mouse move reads as the mouse, at neutral pressure.
    input.push({ t: t + 1, type: 'move', x: 620, y: 380, src: 'kbm' });
    frame();
    expect(input.pointer.source).toBe('mouse');
    expect(input.pointer.pressure).toBe(0.5);
  });
});
