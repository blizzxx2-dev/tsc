/** CON-0103: a "natural" certificate leaves the second horn-bud; it is dressed, and scored on care. */
import { afterEach, describe, expect, it } from 'vitest';
import { OP_3_1 } from '../../../src/content/chapter3';
import { flags } from '../../../src/content/flags';
import { DressedBud, HornBud } from '../../../src/surgery/ailments/kilnrows';
import { playWithBot } from '../../bot';

afterEach(() => flags.clear());

describe('the hornchild branch', () => {
  it('a natural certificate swaps the second bud’s excision for a dressing; turned (or unset) cuts both', () => {
    flags.set('hornchildCertificate', 'natural');
    const natural = OP_3_1.phases[1].spawn!({} as never);
    expect(natural[0]).toBeInstanceOf(DressedBud);
    expect(OP_3_1.phases[1].callout![0]).toContain('No lancet');
    flags.set('hornchildCertificate', 'turned');
    expect(OP_3_1.phases[1].spawn!({} as never)[0]).toBeInstanceOf(HornBud);
  });

  it('the care path is won, never rated for cutting, and scores within 15 % of the excision', () => {
    const cut = playWithBot(OP_3_1, { profile: 'steady' }).op;
    flags.set('hornchildCertificate', 'natural');
    const care = playWithBot(OP_3_1, { profile: 'steady' }).op;
    expect(care.status).toBe('won');
    expect(care.labelCount('Cut a natural growth')).toBe(0);
    expect(care.labelCount('Bud dressed')).toBe(1);
    expect(Math.abs(care.score - cut.score) / cut.score).toBeLessThan(0.15);
  });
});
