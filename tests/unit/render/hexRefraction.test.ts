import { describe, expect, it } from 'vitest';
import { Input } from '../../../src/core/input';
import type { Game } from '../../../src/core/scene';
import { Bindings } from '../../../src/input/bindings';
import { OperationScene } from '../../../src/scenes/operation';
import { Embedded, Laceration } from '../../../src/surgery/entities';
import { FIELD } from '../../../src/surgery/operation';
import { fakeCanvas, fakeGl, installFakeDom } from '../../fakegl';
import { defWith } from '../../helpers/sim';

const at = (dx: number, dy: number) => ({ x: FIELD.cx + dx, y: FIELD.cy + dy });

describe('hexstone refraction (ENG-0106)', () => {
  it('each visible hexstone registers a refraction region; a stilled one bends less', async () => {
    installFakeDom();
    const { Gfx } = await import('../../../src/render/gfx');
    const g = new Gfx(fakeCanvas(fakeGl()), 1280, 720);
    const input = new Input(null, 1280, 720, new Bindings(null));
    const game = { input, gfx: g, audio: { play: () => undefined }, go: () => undefined } as unknown as Game;
    let stone!: Embedded;
    const s = new OperationScene(
      defWith(() => [
        (stone = new Embedded(at(0, 0), 'hexstone', 0.3, false)),
        new Embedded(at(100, 0), 'shot', 0, false),
        new Laceration(at(-100, 0), 0, 40, 0),
      ]),
      () => undefined,
      () => undefined,
    );
    s.enter();
    for (let i = 0; i < 900 && s.op.status === 'intro'; i++) s.update(1 / 60, game);
    const regions = (s as unknown as { hexRefraction(): number[][] }).hexRefraction();
    expect(regions).toHaveLength(1);
    expect(regions[0][0]).toBeCloseTo(stone.pos.x);
    const live = regions[0][3];
    stone.calmed = true;
    expect((s as unknown as { hexRefraction(): number[][] }).hexRefraction()[0][3]).toBeLessThan(live);
  });
});
