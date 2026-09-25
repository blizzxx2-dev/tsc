/** QAT-0033: Incision & StitchLine characterisation. */
import { describe, expect, it } from 'vitest';
import { at } from '../../src/content/chapter1';
import { Incision } from '../../src/surgery/entities';
import { DEFAULT_TUNING } from '../../src/surgery/tuning';
import { offsetLine, strokePath, zigzagAlong } from '../helpers/sim';
import { scenario } from '../helpers/trace';

const LINE = [at(-150, 60), at(-50, 40), at(60, 50), at(160, 30)];

function cut(offset: number) {
  const { op, ents, trace } = scenario(() => [new Incision(LINE)]);
  const inc = ents[0];
  strokePath(op, 'lancet', offsetLine(LINE, offset), { speed: 350 });
  trace.note('after stroke', { state: inc.state, progress: inc.progress });
  return { op, inc, trace };
}

describe('Incision tracing', () => {
  it.each([
    [0, 'cool'],
    [9, 'good'],
    [20, 'bad'],
  ] as const)('a stroke %i px off the guide rates %s "Incision"', (offset, rating) => {
    const { op, inc, trace } = cut(offset);
    expect(inc.state).toBe('open');
    expect(inc.required).toBe(false);
    expect(op.counts[rating]).toBe(1);
    expect(trace.text()).toMatchSnapshot();
  });

  it('slipping more than 34 px off the line is BAD "Off the line", costs 2 vitals, and stops tracking until the next press', () => {
    const { op, ents, trace } = scenario(() => [new Incision(LINE)]);
    const inc = ents[0];
    const v = op.vitals;
    strokePath(op, 'lancet', [LINE[0], LINE[1], { x: LINE[1].x + 10, y: LINE[1].y + 60 }, LINE[2]], { speed: 350 });
    trace.note('after slip', { progress: inc.progress });
    expect(op.counts.bad).toBe(1);
    // 2 vitals of harm (scaled by organ sensitivity), less the passive recovery that ticks meanwhile.
    expect(v - op.vitals).toBeCloseTo(2, 0);
    expect(inc.state).toBe('mark');
    const progress = inc.progress;
    // Resume from where the last stroke stopped.
    strokePath(op, 'lancet', [inc.pointAt(progress), LINE[2], LINE[3]], { speed: 350 });
    trace.note('after resume', { state: inc.state });
    expect(inc.state).toBe('open');
    expect(trace.text()).toMatchSnapshot();
  });

  it('a press away from the head of the line is not captured', () => {
    const { op, ents, trace } = scenario(() => [new Incision(LINE)]);
    strokePath(op, 'lancet', [LINE[2], LINE[3]], { speed: 350 });
    trace.note('after mid-line press');
    expect(ents[0].progress).toBe(0);
    // Since the GAM scoring pass an uncaptured press is not rated at all (GAM-F rating rules).
    expect(op.counts).toEqual({ cool: 0, good: 0, bad: 0, miss: 0 });
    expect(trace.text()).toMatchSnapshot();
  });
});

describe('StitchLine closing', () => {
  function closing() {
    const { op, ents, trace } = scenario(() => {
      const inc = new Incision(LINE);
      inc.state = 'open';
      inc.required = false;
      return [inc];
    });
    const inc = ents[0];
    inc.beginClosing();
    trace.note('closing', { needed: inc.stitch!.needed });
    return { op, inc, trace };
  }

  it('closing in one stroke rates COOL "Closed"', () => {
    const { op, inc, trace } = closing();
    expect(inc.stitch!.needed).toBe(Math.max(2, Math.ceil(inc.total / DEFAULT_TUNING.stitch.pxPerStitch)));
    strokePath(op, 'thread', zigzagAlong(LINE, inc.stitch!.needed), { speed: 380 });
    trace.note('after stitching');
    expect(inc.alive).toBe(false);
    expect(inc.state).toBe('closed');
    expect(op.counts.cool).toBe(1);
    expect(op.scars).toHaveLength(1);
    expect(trace.text()).toMatchSnapshot();
  });

  it('closing over several strokes rates GOOD "Closed"', () => {
    const { op, inc, trace } = closing();
    const zz = zigzagAlong(LINE, inc.stitch!.needed);
    const split = 5;
    strokePath(op, 'thread', zz.slice(0, split + 1), { speed: 380 });
    trace.note('after first stroke', { count: inc.stitch!.count, strokes: inc.stitch!.strokes.size });
    strokePath(op, 'thread', zz.slice(split), { speed: 380 });
    trace.note('after second stroke');
    expect(inc.alive).toBe(false);
    expect(op.counts.good).toBe(1);
    expect(trace.text()).toMatchSnapshot();
  });

  it('rejects a stitch within 10 px of an existing one', () => {
    const { op, inc, trace } = closing();
    const mid = inc.pointAt(inc.total / 2);
    // Cross the line twice at the same spot.
    strokePath(op, 'thread', [
      { x: mid.x, y: mid.y - 25 },
      { x: mid.x, y: mid.y + 25 },
      { x: mid.x + 2, y: mid.y - 25 },
    ]);
    trace.note('after double crossing', { count: inc.stitch!.count });
    expect(inc.stitch!.count).toBe(1);
    expect(trace.text()).toMatchSnapshot();
  });
});
