/** GAM-0085: grub feedback — three seeded squeal variants and a 0.4 s death-curl when seared. */
import { describe, expect, it } from 'vitest';
import { squealVariant } from '../../../src/audio/director';
import { EVENTS } from '../../../src/audio/events';
import { RECIPES } from '../../../src/audio/sfx';
import type { FxEvent } from '../../../src/render/particles';
import { CURL_SECONDS, Particles } from '../../../src/render/particles';
import { Grub } from '../../../src/surgery/entities';
import { at, Hand, start } from '../../harness';

describe('GAM-0085 grub feedback', () => {
  it('three squeal variants, picked by the op seed and the grub — the same on every replay', () => {
    expect(EVENTS['sfx.grub.squeal'].vars).toBe(3);
    expect(RECIPES['sfx.grub.squeal']).toBeDefined();
    const picks = new Set<number>();
    for (let id = 1; id <= 60; id++) picks.add(squealVariant(41, id));
    expect([...picks].sort()).toEqual([0, 1, 2]);
    expect(squealVariant(41, 7)).toBe(squealVariant(41, 7));
  });

  it('searing a grub curls it up for exactly 0.4 s', () => {
    const fx: FxEvent[] = [];
    let g!: Grub;
    const op = start((o) => [(g = new Grub(at(0, 0), o, 0))]);
    op.events.on('fx', (e) => fx.push(e));
    new Hand(op).hold('brand', g.pos, 1.2);
    expect(g.alive).toBe(false);
    const curl = fx.find((e) => e.kind === 'curl');
    expect(curl).toBeDefined();
    const ps = new Particles();
    ps.spawn(curl!);
    expect(ps.count).toBe(1);
    ps.update(CURL_SECONDS - 0.05, () => undefined);
    expect(ps.count).toBe(1);
    ps.update(0.1, () => undefined);
    expect(ps.count).toBe(0);
    expect(CURL_SECONDS).toBe(0.4);
  });
});
