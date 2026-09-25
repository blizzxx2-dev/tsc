import { describe, expect, it } from 'vitest';
import { alignGrade, boneSpan } from '../src/art/boneView';
import { Fracture, FRACTURE } from '../src/surgery/ailments/fracture';
import { start } from './harness';

describe('bone-setting view (ENG-0273)', () => {
  it('grades each fragment by the tolerances the sim judges by', () => {
    const op = start();
    const fr = new Fracture({ x: 600, y: 400 }, op, 0, 3);
    const f = fr.fragments[1];
    const at = (dx: number, deg: number) => {
      f.pos = { x: f.target.x + dx, y: f.target.y };
      f.rot = f.targetRot + (deg * Math.PI) / 180;
      return alignGrade(f);
    };
    expect(at(FRACTURE.coolPx - 1, FRACTURE.coolDeg - 1)).toBe('cool');
    expect(at(FRACTURE.goodPx - 1, FRACTURE.goodDeg - 1)).toBe('good');
    expect(at(FRACTURE.roughPx - 1, FRACTURE.roughDeg - 1)).toBe('rough');
    expect(at(FRACTURE.roughPx + 10, 0)).toBe('off');
    expect(alignGrade(fr.fragments[0])).toBe('cool'); // the anchored fragment is set
  });

  it('the inked bone spans every fragment’s place plus the epiphyses', () => {
    const op = start();
    const fr = new Fracture({ x: 600, y: 400 }, op, 0, 3);
    const { a, b } = boneSpan(fr);
    expect(b.x - a.x).toBeCloseTo(FRACTURE.segLen * 3, 5);
    expect(a.y).toBeCloseTo(400, 5);
  });
});
