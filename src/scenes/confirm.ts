import type { Game, Scene } from '../core/scene';
import { t } from '../i18n';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { Ui } from '../ui/kit';
import { menuEntry, sealButton } from '../ui/controls';
import { leatherPanel, divider, UI } from '../ui/ornaments';
import { MOTION, tween } from '../ui/motion';
import { VIEW_W } from '../ui/layout';
import { uiEvents } from '../ui/events';
import { reticle } from '../ui/widgets';
import { wrapLines } from '../ui/text';

export interface ConfirmOptions {
  /** Localised question. */
  message: string;
  /** Localised title (defaults to none). */
  title?: string;
  yes?: string;
  no?: string;
  onYes: () => void;
  onNo?: () => void;
  /** Destructive actions default focus to "No". */
  danger?: boolean;
}

/**
 * Modal confirm dialog (UIX-0006/0007). Pushed over the current scene with
 * `game.push`; Esc / B answers "No" and pops only this dialog. Input never
 * reaches the scenes underneath (they render but do not update).
 */
export class ConfirmScene implements Scene {
  readonly overlay = true;
  readonly ui = new Ui('confirm');
  private t = 0;
  private done = false;

  constructor(private o: ConfirmOptions) {}

  private close(game: Game, yes: boolean): void {
    if (this.done) return;
    this.done = true;
    game.pop?.();
    (yes ? this.o.onYes : this.o.onNo)?.();
  }

  private layout(game: Game): void {
    const ui = this.ui;
    ui.begin();
    const w = 200;
    ui.button('yes', { x: VIEW_W / 2 + 20, y: 420, w, h: 52 }, this.o.yes ?? t('ui.common.yes'), () => this.close(game, true), { style: 'seal' });
    ui.button('no', { x: VIEW_W / 2 - 20 - w, y: 420, w, h: 52 }, this.o.no ?? t('ui.common.no'), () => this.close(game, false));
    if (!ui.focus) ui.focusFirst(this.o.danger ? 'no' : 'yes');
  }

  update(dt: number, game: Game): void {
    this.layout(game);
    this.t += dt;
    this.ui.update(game.input, dt);
    if (!this.done && game.input.actPressed('ui.back')) {
      uiEvents.emit('ui.back', { id: 'confirm' });
      this.close(game, false);
    }
  }

  render(g: Gfx, game: Game): void {
    const k = tween(this.t, MOTION.panel);
    const vr = g.viewRect();
    g.rect(vr.x, vr.y, vr.w, vr.h, hex('#000000', 0.55 * k));
    const r = { x: VIEW_W / 2 - 300, y: 230 + (1 - k) * 20, w: 600, h: 270 };
    leatherPanel(g, r, { alpha: 0.97 * k });
    let y = r.y + 58;
    if (this.o.title) {
      g.text(this.o.title, VIEW_W / 2, y, { size: 34, font: 'display', color: hex(UI.gilt, k), color2: hex(UI.giltLo, k), align: 'center' });
      divider(g, VIEW_W / 2, y + 16, 300, hex(UI.brass, k));
      y += 56;
    }
    const lines = wrapLines((s) => g.measure(s, 24, 'body'), this.o.message, r.w - 80);
    lines.slice(0, 4).forEach((l, i) => g.text(l, VIEW_W / 2, y + i * 32, { size: 24, color: hex(UI.parch, k), align: 'center' }));
    for (const n of this.ui.nodes) {
      const s = this.ui.state(n.id);
      if (n.style === 'seal') sealButton(g, n, s, g.time, 26);
      else menuEntry(g, n, s, g.time, 26);
    }
    reticle(g, game.input.pos);
  }
}

/** Ask for confirmation over the current scene (falls back to acting immediately where overlays are unsupported). */
export function confirm(game: Game, o: ConfirmOptions): void {
  if (game.push) game.push(new ConfirmScene(o));
  else o.onYes();
}
