import { describe, expect, it } from 'vitest';
import { Input } from '../../../src/core/input';
import type { Game } from '../../../src/core/scene';
import { Bindings } from '../../../src/input/bindings';
import type { Gfx } from '../../../src/render/gfx';
import { OperationScene } from '../../../src/scenes/operation';
import { Laceration } from '../../../src/surgery/entities';
import { FIELD, type OperationDef } from '../../../src/surgery/operation';
import { fakeCanvas, fakeGl, installFakeDom } from '../../fakegl';
import { defWith } from '../../helpers/sim';

const at = (dx: number, dy: number) => ({ x: FIELD.cx + dx, y: FIELD.cy + dy });

async function scene(def: OperationDef) {
  installFakeDom();
  const { Gfx } = await import('../../../src/render/gfx');
  const g = new Gfx(fakeCanvas(fakeGl()), 1280, 720);
  const input = new Input(null, 1280, 720, new Bindings(null));
  const game = { input, gfx: g, audio: { play: () => undefined }, go: () => undefined } as unknown as Game;
  const s = new OperationScene(
    def,
    () => undefined,
    () => undefined,
  );
  s.enter();
  return { s, game };
}

describe('multi-organ region views (GAM-0247)', () => {
  it('frames the first region magnified, Tab pans to the next, and off-screen drains get edge arrows', async () => {
    const def = {
      ...defWith(() => [new Laceration(at(-220, 0), 0, 60, 1), new Laceration(at(320, 20), 0, 60, 1)]),
      regions: [
        { kind: 'flesh', ...at(-210, 0), rx: 220, ry: 180 },
        { kind: 'flesh', ...at(190, 20), rx: 220, ry: 180 },
      ],
    } as OperationDef;
    const { s, game } = await scene(def);
    for (let i = 0; i < 900 && s.op.status === 'intro'; i++) s.update(1 / 60, game);
    const cam = s.camera;
    expect(cam.zoom).toBeGreaterThan(1.2);
    expect(cam.x).toBeCloseTo(FIELD.cx - 210);
    // The right-hand wound is off-screen and draining: exactly one arrow.
    const calls: string[] = [];
    const g = new Proxy({}, { get: (_t, k) => (k === 'measure' ? () => 10 : () => void calls.push(String(k))) }) as unknown as Gfx;
    (s as unknown as { drawEdgeArrows(g: Gfx): void }).drawEdgeArrows(g);
    expect(calls.filter((c) => c === 'tri')).toHaveLength(1);
    // Tab (the view switch) eases the camera to the second region.
    (s as unknown as { ctl: { onSwitchView: () => void } }).ctl.onSwitchView();
    for (let i = 0; i < 60; i++) s.update(1 / 60, game);
    expect(cam.x).toBeCloseTo(FIELD.cx + 190, 0);
    // Pointer mapping follows: the view centre is the region centre in the world.
    const w = cam.toWorld({ x: 640, y: 360 });
    expect(w.x).toBeCloseTo(FIELD.cx + 190, 0);
  });

  it('single-field ops keep the identity camera and Tab keeps its quick swap', async () => {
    const { s } = await scene(defWith(() => [new Laceration(at(0, 0), 0, 60, 1)]));
    expect(s.camera.isIdentity).toBe(true);
    expect((s as unknown as { ctl: { onSwitchView: unknown } }).ctl.onSwitchView).toBeNull();
  });
});
