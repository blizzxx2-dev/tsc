/**
 * Explicit render layers (ENG-0041) and the layer contract (ENG-0043).
 *
 * Draw commands are queued per layer and submitted in layer order, whatever order the scene
 * queued them in. The contract, enforced by `RenderQueue.submit` and tested in
 * tests/unit/render/layers.test.ts:
 *
 * | Layer     | Target | Post (bloom, grain, vignette, LUT, shake) | Camera |
 * |-----------|--------|-------------------------------------------|--------|
 * | Backdrop  | world  | yes                                       | yes    |
 * | Field     | world  | yes                                       | yes    |
 * | Decals    | world  | yes                                       | yes    |
 * | Entities  | world  | yes                                       | yes    |
 * | Particles | world  | yes                                       | yes    |
 * | WorldFX   | world  | yes                                       | yes    |
 * | WorldUI   | screen | no                                        | yes    |
 * | UI        | screen | no                                        | no     |
 * | Overlay   | screen | no                                        | no     |
 * | Debug     | screen | no                                        | no     |
 *
 * World layers render into the offscreen world target and are post-processed by `endWorld`;
 * everything after that goes straight to the backbuffer, so UI and Overlay can never pick up grain,
 * vignette, the colour grade or screen shake. WorldUI (ENG-0044) is drawn after post but through
 * the camera transform, so callouts and popups stay attached to what they label when zoomed.
 */
import type { Gfx, PostParams } from './gfx';

export enum RenderLayer {
  Backdrop,
  Field,
  Decals,
  Entities,
  Particles,
  WorldFX,
  WorldUI,
  UI,
  Overlay,
  Debug,
}

export const LAYER_COUNT = 10;

export interface LayerRules {
  target: 'world' | 'screen';
  post: boolean;
  camera: boolean;
}

export const LAYER_CONTRACT: Readonly<Record<RenderLayer, LayerRules>> = {
  [RenderLayer.Backdrop]: { target: 'world', post: true, camera: true },
  [RenderLayer.Field]: { target: 'world', post: true, camera: true },
  [RenderLayer.Decals]: { target: 'world', post: true, camera: true },
  [RenderLayer.Entities]: { target: 'world', post: true, camera: true },
  [RenderLayer.Particles]: { target: 'world', post: true, camera: true },
  [RenderLayer.WorldFX]: { target: 'world', post: true, camera: true },
  [RenderLayer.WorldUI]: { target: 'screen', post: false, camera: true },
  [RenderLayer.UI]: { target: 'screen', post: false, camera: false },
  [RenderLayer.Overlay]: { target: 'screen', post: false, camera: false },
  [RenderLayer.Debug]: { target: 'screen', post: false, camera: false },
};

export type DrawCommand = (g: Gfx) => void;

/** The slice of Gfx the queue drives (a fake in tests). */
export type LayerHost = Pick<Gfx, 'beginWorld' | 'endWorld' | 'setCamera'>;

/**
 * Per-layer command lists. Queue with `add`, then `submit` once per frame: world layers are drawn
 * between `beginWorld` and `endWorld(post)`, screen layers after, each layer's commands in the order
 * they were added. Lists are cleared after submission (the arrays are reused).
 */
export class RenderQueue {
  private lists: DrawCommand[][] = Array.from({ length: LAYER_COUNT }, () => []);
  /** Commands run per layer in the last submit (debug overlay "layer draw counts"). */
  readonly counts = new Array<number>(LAYER_COUNT).fill(0);

  add(layer: RenderLayer, cmd: DrawCommand): void {
    this.lists[layer].push(cmd);
  }

  has(layer: RenderLayer): boolean {
    return this.lists[layer].length > 0;
  }

  /**
   * Draw every queued command in layer order. `camera` is the world→view matrix (null = identity):
   * applied to world layers and WorldUI, never to UI/Overlay/Debug. With `world` false the world
   * target is skipped (menus): world-layer commands then draw straight to the screen without post.
   */
  submit(g: Gfx | LayerHost, post: PostParams, opts: { camera?: ArrayLike<number> | null; world?: boolean; clear?: [number, number, number] } = {}): void {
    const gfx = g as Gfx;
    const cam = opts.camera ?? null;
    const world = opts.world ?? true;
    if (world) g.beginWorld(opts.clear);
    for (let l = 0; l < LAYER_COUNT; l++) {
      const rules = LAYER_CONTRACT[l as RenderLayer];
      if (world && l === RenderLayer.WorldUI) g.endWorld(post);
      g.setCamera(rules.camera ? cam : null);
      const list = this.lists[l];
      this.counts[l] = list.length;
      for (const cmd of list) cmd(gfx);
      list.length = 0;
    }
    g.setCamera(null);
  }
}

/** Minimal shape for draw-order sorting. */
export interface Layered {
  layer: number;
  id: number;
}

/**
 * Entities-layer draw order (ENG-0042): by `Entity.layer`, then spawn order (`id`, assigned by the
 * operation in spawn order), stable and independent of where an entity sits in the entity array.
 */
export function drawOrder<T extends Layered>(ents: readonly T[]): T[] {
  return [...ents].sort((a, b) => a.layer - b.layer || a.id - b.id);
}
