import { t } from '../i18n';
import type { CrashRecord } from '../core/boundary';
import type { Game, Scene } from '../core/scene';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { PALETTE, VIEW_W } from '../ui/layout';
import { button, reticle } from '../ui/widgets';

/**
 * In-fiction error screen (ENG-0069): an exception in a scene lands here
 * instead of killing the frame loop. Drawn with plain shapes and text only, so
 * it still works when a shader or a scene's own drawing was what failed.
 */
export class InkRunScene implements Scene {
  private t = 0;

  constructor(
    readonly crash: CrashRecord,
    private onTitle: () => void,
  ) {}

  update(dt: number, game: Game): void {
    this.t += dt;
    if (game.input.keyPressed('Escape') || game.input.keyPressed('Enter')) this.onTitle();
  }

  render(g: Gfx, game: Game): void {
    g.beginScreen([0.035, 0.025, 0.02]);
    const r = g.viewRect();
    g.rectGrad(r.x, r.y, r.w, r.h, hex('#1c120c'), hex('#070404'));
    // A spreading blot of ink.
    const a = Math.min(1, this.t * 1.5);
    for (let i = 0; i < 7; i++) {
      const ang = i * 2.4;
      g.circle(VIEW_W / 2 + Math.cos(ang) * 40 * a, 190 + Math.sin(ang) * 22 * a, (26 + (i % 3) * 9) * a, hex('#050303', 0.85));
    }
    g.text(t('ui.inkrun.title'), VIEW_W / 2, 330, { size: 58, font: 'display', color: hex(PALETTE.ink), align: 'center' });
    g.textBlock(
      t('ui.inkrun.body'),
      VIEW_W / 2 - 330,
      390,
      660,
      { size: 22, font: 'italic', color: hex(PALETTE.inkDim) },
    );
    g.text(t('ui.inkrun.debug', { scene: this.crash.scene, phase: this.crash.phase, frame: this.crash.frame }), VIEW_W / 2, 520, { size: 15, color: hex(PALETTE.inkDim, 0.7), align: 'center', shadow: false });
    g.text(this.crash.message.slice(0, 110), VIEW_W / 2, 542, { size: 15, color: hex(PALETTE.bad, 0.8), align: 'center', shadow: false });
    if (button(g, game.input, t('ui.inkrun.return'), VIEW_W / 2, 620, 28)) this.onTitle();
    reticle(g, game.input.pos);
    g.endFrame();
  }
}
