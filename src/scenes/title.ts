import type { Game, Scene } from '../core/scene';
import { fresh, store } from '../core/save';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { CAMPAIGN } from '../content/campaign';
import { PALETTE, VIEW_H, VIEW_W } from '../ui/layout';
import { button, reticle } from '../ui/widgets';
import { divider, leatherPanel, UI } from '../ui/ornaments';
import { drawBackdrop } from './backdrop';
import { playStep, save } from './flow';
import { OperationsScene } from './operations';
import { OptionsScene } from './options';

export class TitleScene implements Scene {
  private t = 0;
  private confirmNew = false;

  update(dt: number): void {
    this.t += dt;
  }

  render(g: Gfx, game: Game): void {
    g.beginWorld();
    drawBackdrop(g, 'night', g.time);
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 1.1 });
    const a = Math.min(1, this.t);
    g.rect(0, 0, VIEW_W, VIEW_H, hex('#000000', 0.35));
    g.glow(VIEW_W / 2, 180, 420, hex('#8a1016', 0.3 * a));
    g.text('Suture & Steel', VIEW_W / 2, 200, { size: 116, font: 'display', color: hex('#fff0c0', a), color2: hex(UI.giltLo, a), align: 'center', shadow: hex('#0a0402', 0.9 * a) });
    divider(g, VIEW_W / 2, 236, 520, hex(UI.brass, a));
    g.text('The Malison Hours', VIEW_W / 2, 280, { size: 30, font: 'italic', color: hex(UI.parch, a), align: 'center' });
    leatherPanel(g, { x: VIEW_W / 2 - 220, y: 330, w: 440, h: 270 }, { alpha: 0.9 * a });

    const p = save.progress;
    const started = p.chapter > 0 || p.step > 0;
    const done = p.chapter >= CAMPAIGN.length;
    let y = 390;
    if (this.confirmNew) {
      g.text('Forswear your progress and take the oath anew?', VIEW_W / 2, y, { size: 26, align: 'center' });
      if (button(g, game.input, 'Yes, begin again', VIEW_W / 2 - 170, y + 70)) {
        Object.assign(save, { ...fresh(), best: save.best });
        store(save);
        playStep(game, 0, 0);
      }
      if (button(g, game.input, 'No', VIEW_W / 2 + 170, y + 70)) this.confirmNew = false;
    } else {
      if (started && !done && button(g, game.input, 'Continue', VIEW_W / 2, y)) playStep(game, p.chapter, p.step);
      if (started && !done) y += 60;
      if (button(g, game.input, started ? 'Take the Oath Anew' : 'Take the Oath', VIEW_W / 2, y)) {
        if (started) this.confirmNew = true;
        else playStep(game, 0, 0);
      }
      y += 60;
      if (button(g, game.input, 'Operating Theatre', VIEW_W / 2, y, 30, started)) game.go(new OperationsScene());
      y += 60;
      if (button(g, game.input, 'Options', VIEW_W / 2, y)) game.go(new OptionsScene(() => game.go(new TitleScene())));
      if (done) g.text('The demo is complete — thank you for playing. The Hours continue in the full game.', VIEW_W / 2, 660, { size: 20, font: 'italic', color: hex(PALETTE.inkDim), align: 'center' });
    }
    g.text('F11: fullscreen', 20, VIEW_H - 14, { size: 14, color: hex(PALETTE.inkDim, 0.6), shadow: false });
    g.text('v0.1 prototype', VIEW_W - 20, VIEW_H - 14, { size: 14, color: hex(PALETTE.inkDim, 0.6), align: 'right', shadow: false });
    reticle(g, game.input.pos);
    g.endFrame();
  }
}
