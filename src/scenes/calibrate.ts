import { settings, saveSettings } from '../core/settings';
import type { Game, Scene } from '../core/scene';
import { t } from '../i18n';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { divider, giltText, UI } from '../ui/ornaments';
import { VIEW_W } from '../ui/layout';
import { button, reticle, star } from '../ui/widgets';

/** Brightness range and step (matches the Display tab slider). */
export const BRIGHTNESS = { min: 0.7, max: 1.3, step: 0.05 } as const;

export const stepBrightness = (v: number, dir: number): number =>
  Math.round(Math.min(BRIGHTNESS.max, Math.max(BRIGHTNESS.min, v + dir * BRIGHTNESS.step)) * 100) / 100;

/**
 * Brightness calibration (UIX-0076): three woodcut stars on black, drawn through the world pass so
 * the post-process gamma applies. At the right setting the left one is invisible, the middle one
 * barely visible and the right one clear. Left/right (or the arrows) adjust; confirm or Back leaves.
 */
export class CalibrateScene implements Scene {
  constructor(private onDone: () => void) {}

  update(_dt: number, game: Game): void {
    const input = game.input;
    if (input.actPressed('ui.left')) settings.brightness = stepBrightness(settings.brightness, -1);
    if (input.actPressed('ui.right')) settings.brightness = stepBrightness(settings.brightness, 1);
    if (input.actPressed('ui.confirm') || input.actPressed('ui.back')) this.done();
  }

  private done(): void {
    saveSettings();
    this.onDone();
  }

  render(g: Gfx, game: Game): void {
    g.beginWorld();
    const vr = g.viewRect();
    g.rect(vr.x, vr.y, vr.w, vr.h, hex('#000000'));
    // Near-black, dark and mid woodcut stars: 2 %, 6 % and 18 % grey.
    const greys = ['#050505', '#0f0f0f', '#2e2e2e'];
    greys.forEach((c, i) => star(g, VIEW_W / 2 + (i - 1) * 220, 330, 70, hex(c)));
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 0 });

    giltText(g, t('ui.calibrate.title'), VIEW_W / 2, 110, { size: 44, align: 'center' });
    divider(g, VIEW_W / 2, 132, 320);
    g.textBlock(t('ui.calibrate.help'), VIEW_W / 2 - 360, 470, 720, { size: 20, color: hex(UI.parch), align: 'center' });
    const pct = Math.round(settings.brightness * 100);
    if (button(g, game.input, '‹', VIEW_W / 2 - 150, 580, 30)) settings.brightness = stepBrightness(settings.brightness, -1);
    g.text(t('ui.calibrate.value', { value: pct }), VIEW_W / 2, 590, { size: 28, color: hex(UI.gilt), align: 'center' });
    if (button(g, game.input, '›', VIEW_W / 2 + 150, 580, 30)) settings.brightness = stepBrightness(settings.brightness, 1);
    if (button(g, game.input, t('ui.common.done'), VIEW_W / 2, 660, 26)) this.done();
    reticle(g, game.input.pos);
    g.endFrame();
  }
}
