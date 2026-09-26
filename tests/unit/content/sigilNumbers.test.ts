/** CON-0051: sigil stroke numbers on the first try and first retry; hidden from the second retry on. */
import { describe, expect, it } from 'vitest';
import { Sigil, SIGILS } from '../../../src/surgery/entities';
import { STROKE_NUMBERS_UNTIL } from '../../../src/surgery/operation';
import { OP_2_4 } from '../../../src/content/ops/ch2';
import { operationOptions, progress } from '../../../src/surgery/session';
import { at, running } from '../../harness-gameplay';

const sigilOp = (opts: Parameters<typeof running>[2]) => running(() => [new Sigil(at(0, 0), SIGILS.eye, 50, 99)], {}, opts);

describe('sigil stroke numbers (CON-0051)', () => {
  it('shown on the first attempt and the first retry', () => {
    expect(sigilOp({ difficulty: 'surgeon' }).strokeNumbers).toBe(true);
    expect(sigilOp({ difficulty: 'surgeon', attempt: STROKE_NUMBERS_UNTIL - 1 }).strokeNumbers).toBe(true);
  });

  it('hidden from the second retry on', () => {
    expect(STROKE_NUMBERS_UNTIL).toBe(3);
    expect(sigilOp({ difficulty: 'surgeon', attempt: 3 }).strokeNumbers).toBe(false);
    expect(sigilOp({ difficulty: 'surgeon', attempt: 7 }).strokeNumbers).toBe(false);
  });

  it('Novice and the Guides assist keep them; Master never shows them', () => {
    expect(sigilOp({ difficulty: 'novice', attempt: 5 }).strokeNumbers).toBe(true);
    expect(sigilOp({ difficulty: 'surgeon', attempt: 5, assists: { guides: true } }).strokeNumbers).toBe(true);
    expect(sigilOp({ difficulty: 'master', attempt: 1 }).strokeNumbers).toBe(false);
  });

  it('the attempt comes from the save’s run of failures on that op', () => {
    const before = progress.fails[OP_2_4.id];
    progress.fails[OP_2_4.id] = 2;
    expect(operationOptions(OP_2_4).attempt).toBe(3);
    if (before === undefined) delete progress.fails[OP_2_4.id];
    else progress.fails[OP_2_4.id] = before;
    expect(operationOptions(OP_2_4).attempt).toBe((before ?? 0) + 1);
  });
});
