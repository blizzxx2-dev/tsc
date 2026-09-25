import { describe, expect, it } from 'vitest';
import { drawInterpolated, lerp, lerpVec } from '../../../src/render/interp';
import { Grub, Laceration } from '../../../src/surgery/entities';
import { at, start } from '../../harness';
import { DT } from '../../helpers/sim';

describe('render interpolation (ENG-0054)', () => {
  it('entities remember where each tick started; views draw in between and restore the sim position', () => {
    let grub!: Grub;
    const op = start((o) => [(grub = new Grub(at(0, 0), o, 40)), new Laceration(at(150, 100), 0, 40, 0.2)]);
    op.update(DT);
    const before = { ...grub.prevPos };
    const after = { ...grub.pos };
    expect(before).not.toEqual(after);
    let drawnAt = { x: 0, y: 0 };
    drawInterpolated([grub], 0.5, (e) => (drawnAt = { ...e.pos }));
    expect(drawnAt.x).toBeCloseTo((before.x + after.x) / 2);
    expect(drawnAt.y).toBeCloseTo((before.y + after.y) / 2);
    expect(grub.pos).toEqual(after);
  });

  it('scalars and points interpolate; teleports snap', () => {
    expect(lerp(0, 10, 0.25)).toBe(2.5);
    expect(lerpVec({ x: 0, y: 0 }, { x: 10, y: 0 }, 0.5)).toEqual({ x: 5, y: 0 });
    expect(lerpVec({ x: 0, y: 0 }, { x: 500, y: 0 }, 0.5)).toEqual({ x: 500, y: 0 });
  });
});
