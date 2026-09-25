/** ART-0258: Compline's silence visual, inverted Litany ripple and colour restore. */
import { describe, expect, it } from 'vitest';
import { ComplineLook, INVERT_S, RESTORE_S } from '../../../src/art/complineLook';
import type { Operation } from '../../../src/surgery/operation';
import { POST_FS } from '../../../src/render/shaders';

const fakeOp = (entities: object[]) => ({ entities }) as unknown as Operation;

describe('Compline look (ART-0258)', () => {
  it('greys the world while the silence holds and lets it go after', () => {
    const boss = { alive: true, muteT: 5, litanyStolen: false };
    const look = new ComplineLook();
    for (let i = 0; i < 60; i++) look.update(fakeOp([boss]), 1 / 60);
    expect(look.silence).toBeGreaterThan(0.95);
    boss.muteT = 0;
    for (let i = 0; i < 180; i++) look.update(fakeOp([boss]), 1 / 60);
    expect(look.silence).toBeLessThan(0.05);
  });

  it('plays the Litany ripple inverted when the Litany is stolen', () => {
    const boss = { alive: true, muteT: 0, litanyStolen: false };
    const look = new ComplineLook();
    look.update(fakeOp([boss]), 1 / 60);
    expect(look.invertedLitany()).toBeNull();
    boss.litanyStolen = true;
    look.update(fakeOp([boss]), 0.1);
    const early = look.invertedLitany()!;
    for (let t = 0; t < INVERT_S / 2; t += 0.1) look.update(fakeOp([boss]), 0.1);
    const later = look.invertedLitany()!;
    // The ring's age runs backwards: it closes in.
    expect(later[1]).toBeLessThan(early[1]);
    for (let t = 0; t < INVERT_S; t += 0.1) look.update(fakeOp([boss]), 0.1);
    expect(look.invertedLitany()).toBeNull();
  });

  it('restores colour with a warm swell when it dies', () => {
    const boss = { alive: true, muteT: 5, litanyStolen: false };
    const look = new ComplineLook();
    for (let i = 0; i < 60; i++) look.update(fakeOp([boss]), 1 / 60);
    boss.alive = false;
    look.update(fakeOp([boss]), 1 / 60);
    for (let t = 0; t < RESTORE_S / 2; t += 1 / 60) look.update(fakeOp([]), 1 / 60);
    expect(look.restore).toBeGreaterThan(0.9);
    expect(look.silence).toBeLessThan(0.55);
    for (let t = 0; t < RESTORE_S; t += 1 / 60) look.update(fakeOp([]), 1 / 60);
    expect(look.silence).toBeLessThan(0.01);
  });

  it('the post shader has the silence term', () => expect(POST_FS).toContain('uniform float u_silence;'));
});
