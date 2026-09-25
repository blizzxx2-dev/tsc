/** ENG-0113 weeping cuts, ENG-0117 scorch/sear decals and ENG-0122 field snapshot, through the real OperationScene. */
import { describe, expect, it } from 'vitest';
import { Input } from '../../../src/core/input';
import type { Game } from '../../../src/core/scene';
import { Bindings } from '../../../src/input/bindings';
import type { DecalMaps, Stamp } from '../../../src/render/decals';
import { OperationScene } from '../../../src/scenes/operation';
import { Burn, Laceration } from '../../../src/surgery/entities';
import { FIELD } from '../../../src/surgery/operation';
import { fakeCanvas, fakeGl, installFakeDom } from '../../fakegl';
import { defWith } from '../../helpers/sim';

async function run(spawn: Parameters<typeof defWith>[0], ticks: number, before?: (s: OperationScene, game: Game) => void) {
  installFakeDom();
  const { Gfx } = await import('../../../src/render/gfx');
  const g = new Gfx(fakeCanvas(fakeGl()), 1280, 720);
  const input = new Input(null, 1280, 720, new Bindings(null));
  const game = { input, gfx: g, audio: { play: () => undefined }, go: () => undefined } as unknown as Game;
  const scene = new OperationScene(
    defWith(spawn),
    () => undefined,
    () => undefined,
  );
  scene.enter();
  const stamps: Stamp[] = [];
  for (let i = 0; i < ticks; i++) {
    before?.(scene, game);
    scene.update(1 / 120, game);
    const d = (scene as unknown as { decals: DecalMaps | null }).decals;
    if (d) {
      const q = (d as unknown as { queue: Stamp[] }).queue;
      stamps.push(...q);
      q.length = 0;
    }
  }
  return { scene, g, game, stamps };
}

const at = (dx: number, dy: number) => ({ x: FIELD.cx + dx, y: FIELD.cy + dy });

describe('operation decals', () => {
  it('open lacerations weep blood streaks along their length until sutured (ENG-0113)', async () => {
    const { stamps } = await run(() => [new Laceration(at(0, 0), 0.4, 120, 1)], 600);
    const weeps = stamps.filter((s) => s.map === 'blood' && s.brush === 'streak');
    expect(weeps.length).toBeGreaterThan(5);
    // Along the wound: every streak lies on the segment and follows its angle.
    for (const w of weeps) expect(Math.abs(w.rot! - 0.4)).toBeLessThan(1e-9);
  });

  it('burns scar the scorch map, and hexfire leaves a violet rim (ENG-0117)', async () => {
    const { stamps } = await run(
      (op) => [new Burn(at(-100, 0), 30, op, 'fire'), new Burn(at(100, 0), 30, op, 'hexfire'), new Laceration(at(0, 200), 0, 20, 0.1)],
      400,
    );
    const scorch = stamps.filter((s) => s.map === 'scorch');
    expect(scorch.filter((s) => s.value[0] > 0)).toHaveLength(2);
    const rims = scorch.filter((s) => s.brush === 'ring' && s.value[1] > 0);
    expect(rims).toHaveLength(1);
    expect(rims[0].x).toBeCloseTo(FIELD.cx + 100);
  });

  it('the Brand sears the scorch map while held on tissue (ENG-0117)', async () => {
    const { stamps } = await run(
      () => [new Laceration(at(0, 200), 0, 20, 0.1)],
      900,
      (s, game) => {
        s.op.setTool('brand');
        game.input.pos = at(0, 0);
        game.input.down = true;
      },
    );
    expect(stamps.filter((s) => s.map === 'scorch' && s.brush === 'soft').length).toBeGreaterThan(10);
    expect(stamps.every((s) => s.map !== 'scorch' || Math.hypot(s.x - FIELD.cx, s.y - FIELD.cy) < 1)).toBe(true);
  });

  it('snapshots the finished field at 480×270 for the results screen and slot thumbnail (ENG-0122)', async () => {
    const { scene, g, game } = await run(() => [new Laceration(at(0, 0), 0.4, 60, 0.5)], 60);
    scene.render(g, game);
    expect(g.fieldSnapshot).toBeNull();
    scene.op.status = 'won';
    (scene as unknown as { endT: number }).endT = 1;
    scene.render(g, game);
    expect(g.fieldSnapshot).not.toBeNull();
    expect([g.fieldSnapshot!.w, g.fieldSnapshot!.h]).toEqual([480, 270]);
    const snap = g.fieldSnapshot;
    scene.render(g, game);
    expect(g.fieldSnapshot).toBe(snap);
  });
});
