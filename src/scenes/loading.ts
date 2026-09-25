import type { BundleId } from '../assets/manifest.gen';
import { choirMaskPlate, leechJarPlate, pyrePlate, woundManPlate } from '../art/plates';
import { settings } from '../core/settings';
import type { Game, Scene } from '../core/scene';
import { t } from '../i18n';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { VIEW_W } from '../ui/layout';
import { hourglass, UI } from '../ui/ornaments';

const PLATES = [woundManPlate, leechJarPlate, pyrePlate, choirMaskPlate] as const;
const CAPTIONS = ['ui.loading.wound_man', 'ui.loading.leech_jar', 'ui.loading.pyre', 'ui.loading.choir'] as const;
/** Loads that finish sooner than this skip the screen's fade-in entirely. */
const SHOW_AFTER = 0.25;

/** Which vignette a load shows: one per chapter, cycling. */
export const plateFor = (chapter: number): number => ((chapter % PLATES.length) + PLATES.length) % PLATES.length;

/**
 * The loading screen (ART-0061): a woodcut vignette and a sand-glass spinner while a chapter's
 * bundle loads, then `onDone`. Resident bundles never show it.
 */
export class LoadingScene implements Scene {
  private t = 0;
  private done = false;
  private frac = 0;
  constructor(
    private bundle: BundleId,
    private chapter: number,
    private onDone: () => void,
  ) {}

  enter(game: Game): void {
    const a = game.assets;
    if (!a) return void (this.done = true);
    void a
      .loadBundle(this.bundle, (n, total) => (this.frac = total ? n / total : 1))
      .then(() => (this.done = true));
  }

  update(dt: number): void {
    this.t += dt;
    if (this.done) {
      this.done = false;
      this.onDone();
    }
  }

  render(g: Gfx): void {
    g.beginScreen([0.03, 0.02, 0.015]);
    const a = Math.max(0, Math.min(1, (this.t - SHOW_AFTER) * 3));
    if (a > 0) {
      const i = plateFor(this.chapter);
      const time = settings.reduceMotion ? 0 : this.t;
      PLATES[i](g, { x: VIEW_W / 2 - 230, y: 140, w: 460, h: 380 }, time, t(CAPTIONS[i]), a);
      hourglass(g, VIEW_W / 2, 590, 40, settings.reduceMotion ? this.frac : (this.t * 0.4) % 1);
      g.text(t('ui.loading.label'), VIEW_W / 2, 650, { size: 20, font: 'italic', color: hex(UI.parchLo, a), align: 'center' });
    }
    g.endFrame();
  }
}
