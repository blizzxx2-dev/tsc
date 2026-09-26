/** CON-0128 / CON-0176: mid-operation dialogue inserts pause the operation between phases. */
import { afterEach, describe, expect, it } from 'vitest';
import { OP_3_9 } from '../../../src/content/chapter3';
import { OP_5_2 } from '../../../src/content/chapter5';
import { flags } from '../../../src/content/flags';
import { Laceration } from '../../../src/surgery/entities';
import { Operation } from '../../../src/surgery/operation';
import { replay, takeLog } from '../../../src/surgery/replay';
import { playWithBot } from '../../bot';
import { at, start, wait } from '../../harness';

afterEach(() => flags.clear());

describe('dialogue inserts between phases', () => {
  it('hold the clock and the drain, and the phase spawns only once the lines are read', () => {
    const op = start(() => [], {
      baseDrain: 1,
      phases: [
        { spawn: () => [] },
        {
          interject: [
            { who: 'stroh', text: 'One.' },
            { name: 'A cyst', text: 'Two.' },
          ],
          callout: ['Now.'],
          spawn: () => [new Laceration(at(0, 0), 0, 60, 0.5)],
        },
      ],
    });
    for (let i = 0; i < 600 && !op.dialogue.length; i++) wait(op, 1 / 60);
    expect(op.dialogue.map((l) => l.text)).toEqual(['One.', 'Two.']);
    const [time, vitals] = [op.timeLeft, op.vitals];
    wait(op, 1.5);
    expect(op.timeLeft).toBe(time);
    expect(op.vitals).toBe(vitals);
    expect(op.entities.some((e) => e instanceof Laceration)).toBe(false);
    op.advanceDialogue();
    expect(op.entities.some((e) => e instanceof Laceration)).toBe(false);
    op.advanceDialogue();
    expect(op.dialogue).toHaveLength(0);
    expect(op.entities.some((e) => e instanceof Laceration)).toBe(true);
  });

  it('an unread line moves on by itself after its reading time', () => {
    const op = start(() => [], {
      phases: [{ spawn: () => [] }, { interject: [{ text: 'A short line.' }], spawn: () => [new Laceration(at(0, 0), 0, 60, 0.5)] }],
    });
    for (let i = 0; i < 600 && !op.dialogue.length; i++) wait(op, 1 / 60);
    wait(op, 2.6);
    expect(op.dialogue).toHaveLength(0);
    expect(op.entities.some((e) => e instanceof Laceration)).toBe(true);
  });

  it('a run with inserts replays to the same result', () => {
    const run = playWithBot(OP_3_9, { profile: 'steady', record: true }).op;
    expect(run.status).toBe('won');
    const again = replay(OP_3_9, takeLog(run));
    expect([again.status, again.score]).toEqual([run.status, run.score]);
  });

  it('Stroh’s second question follows the certificate, and the cyst threatens by the Whisper band', () => {
    flags.set('hornchildCertificate', 'natural');
    const q = OP_3_9.phases[2].interject as (op: Operation) => { text: string }[];
    expect(
      q({} as Operation)
        .map((l) => l.text)
        .join(' '),
    ).toContain('What the bone told me');
    flags.set('hornchildCertificate', 'turned');
    expect(
      q({} as Operation)
        .map((l) => l.text)
        .join(' '),
    ).toContain('You signed under it');
    const cyst = OP_5_2.phases[0].interject as (op: Operation) => { text: string }[];
    flags.clear();
    expect(cyst({} as Operation)[1].text).toContain('Nobody watches you');
    flags.set('litanySeenCount', 6);
    expect(cyst({} as Operation)[1].text).toContain('They already know');
  });

  it('the bot reads through the inserts and wins op3-9 and op5-2', () => {
    for (const def of [OP_3_9, OP_5_2]) expect(playWithBot(def, { profile: 'steady' }).op.status, def.id).toBe('won');
  });
});
