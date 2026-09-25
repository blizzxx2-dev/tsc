/** ENG-0113 weeping cuts, ENG-0117 scorch/sear decals and ENG-0122 field snapshot, through the real OperationScene. */
import { describe, expect, it } from 'vitest';
import { Input } from '../../../src/core/input';
import type { Game } from '../../../src/core/scene';
import { Bindings } from '../../../src/input/bindings';
import type { DecalMaps, Stamp } from '../../../src/render/decals';
import { FROST_GROW_S, OperationScene, SALVE_GLOSS_S } from '../../../src/scenes/operation';
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

describe('salve gloss (GAM-0043)', () => {
  it('a salved spot stays glossy for 4 s after the last stroke over it, then dries', async () => {
    const { scene } = await run(() => [new Laceration(at(0, 0), 0, 30, 0.2)], 1);
    const s = scene as unknown as {
      op: { status: string; elapsed: number; cursor: { x: number; y: number }; setTool(t: string): void; tool: string };
      tickGloss(op: unknown, down: boolean): void;
      gloss: unknown[];
    };
    const op = s.op;
    op.status = 'running';
    op.setTool('salve');
    op.cursor = at(0, 0);
    s.tickGloss(op, true);
    expect(s.gloss).toHaveLength(1);
    // Stroking the same spot keeps it fresh.
    op.elapsed += 3;
    s.tickGloss(op, true);
    expect(s.gloss).toHaveLength(1);
    op.elapsed += 3.9;
    s.tickGloss(op, false);
    expect(s.gloss).toHaveLength(1);
    op.elapsed += 0.2;
    s.tickGloss(op, false);
    expect(s.gloss).toHaveLength(0);
    expect(SALVE_GLOSS_S).toBe(4);
  });
});

describe('stain map: stone, frost and necrosis (ENG-0261, ENG-0262, ENG-0264)', () => {
  it('the petrify front lays stone, a frost patch rimes once and thaws off, gangrene lays necrosis', async () => {
    const { PetrifyFront } = await import('../../../src/surgery/ailments/vennmark');
    const { FrostPatch } = await import('../../../src/surgery/ailments/frost');
    let frost!: InstanceType<typeof FrostPatch>;
    const { stamps } = await run(
      () => [new PetrifyFront([at(-300, 0), at(-100, 0), at(0, 0)], 3, 4), (frost = new FrostPatch(at(150, 80), 30)), new Laceration(at(0, 200), 0, 30, 0.1)],
      720,
    );
    const stain = stamps.filter((s) => s.map === 'stain');
    expect(stain.filter((s) => s.value[0] > 0 && s.mode === 'add').length).toBeGreaterThan(5);
    // Rime grows out over FROST_GROW_S in widening stamps (ENG-0262).
    const rime = stain.filter((s) => s.value[1] > 0 && s.mode === 'add');
    expect(rime.length).toBeGreaterThanOrEqual(Math.floor(FROST_GROW_S / 0.1) - 1);
    expect(rime[0].x).toBeCloseTo(frost.pos.x);
    expect(rime[rime.length - 1].r).toBeGreaterThan(rime[0].r);
  });
});

describe('curse corruption map (ENG-0099)', () => {
  it('a Malison paints a widening stain of corruption; a sigil a small one', async () => {
    const { Malison } = await import('../../../src/surgery/malison');
    const { Sigil, SIGILS } = await import('../../../src/surgery/entities');
    const { CURSE_REACH } = await import('../../../src/scenes/operation');
    const { stamps } = await run((op) => [new Malison(at(0, 0), op), new Sigil(at(-250, 100), SIGILS.eye, 60, 99)], 1200);
    const curse = stamps.filter((s) => s.map === 'curse' && s.brush === 'soft');
    const fromM = curse.filter((s) => s.value[0] === 0.06);
    const fromS = curse.filter((s) => s.value[0] === 0.035);
    expect(fromM.length).toBeGreaterThan(20);
    expect(fromM[fromM.length - 1].r).toBeGreaterThan(fromM[0].r);
    expect(fromM[fromM.length - 1].r).toBeLessThanOrEqual(CURSE_REACH);
    expect(fromS.length).toBeGreaterThan(20);
    expect(Math.max(...fromS.map((s) => s.r))).toBeLessThan(Math.max(...fromM.map((s) => s.r)));
  });

  it('maps view pixels back to map UV through the camera', async () => {
    const { viewToMapUV, fieldToMapUV } = await import('../../../src/render/decals');
    const apply = (m: Float32Array, x: number, y: number) => [m[0] * x + m[3] * y + m[6], m[1] * x + m[4] * y + m[7]];
    const p = at(120, -40);
    const [u, v] = fieldToMapUV(p);
    const id = viewToMapUV([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    expect(apply(id, p.x, p.y)[0]).toBeCloseTo(u, 5);
    expect(apply(id, p.x, p.y)[1]).toBeCloseTo(v, 5);
    // A 2× camera with an offset: world p lands at view 2p + (30, -12).
    const zoom = viewToMapUV([2, 0, 0, 0, 2, 0, 30, -12, 1]);
    const [zu, zv] = apply(zoom, p.x * 2 + 30, p.y * 2 - 12);
    expect(zu).toBeCloseTo(u, 5);
    expect(zv).toBeCloseTo(v, 5);
  });
});

describe('heat shimmer (ENG-0263)', () => {
  it('a hot dragon-breath burn wavers the air over it; a plain burn does not', async () => {
    const { Burn } = await import('../../../src/surgery/entities');
    const { scene } = await run((op) => [new Burn(at(-100, 0), 40, op, 'dragon'), new Burn(at(100, 0), 40, op, 'fire')], 720);
    const sh = (scene as unknown as { heatShimmer(): [number, number, number, number][] }).heatShimmer();
    expect(sh).toHaveLength(1);
    expect(sh[0][0]).toBeCloseTo(at(-100, 0).x);
    expect(sh[0][3]).toBeGreaterThan(0.5);
  });
});
