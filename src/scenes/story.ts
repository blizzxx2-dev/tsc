import type { Game, Scene } from '../core/scene';
import { t } from '../i18n';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { CAST } from '../content/characters';
import type { StoryDef } from '../content/story';
import { PALETTE, VIEW_H, VIEW_W } from '../ui/layout';
import { reticle } from '../ui/widgets';
import { banner, divider, leatherPanel, UI } from '../ui/ornaments';
import { drawBackdrop, drawPortrait } from './backdrop';

const CPS = 48; // characters per second

/** Visual-novel scene: backdrop, portrait, name plate and a typewriter text box. */
export class StoryScene implements Scene {
  private i = 0;
  private shown = 0;
  private t = 0;
  private fadeIn = 0;

  constructor(
    private story: StoryDef,
    private onDone: () => void,
  ) {}

  private get line() {
    return this.story.lines[this.i];
  }

  update(dt: number, game: Game): void {
    const { input } = game;
    this.t += dt;
    this.fadeIn = Math.min(1, this.fadeIn + dt * 1.5);
    const fast = input.key('ControlLeft') || input.key('ControlRight');
    this.shown += dt * CPS * (fast ? 8 : 1);
    const full = this.shown >= this.line.text.length;
    const advance = input.pressed || input.keyPressed('Space') || input.keyPressed('Enter') || (fast && full && this.t > 0.08);
    if (input.keyPressed('Escape')) return this.onDone();
    if (!advance) return;
    this.t = 0;
    if (!full) {
      this.shown = this.line.text.length;
      return;
    }
    this.i++;
    this.shown = 0;
    if (this.i >= this.story.lines.length) {
      this.i = this.story.lines.length - 1;
      this.onDone();
    } else game.audio.play('select');
  }

  render(g: Gfx, game: Game): void {
    const line = this.line;
    const who = CAST[line.who];
    g.beginWorld();
    drawBackdrop(g, this.story.backdrop, g.time);
    if (who.silhouette !== 'none') drawPortrait(g, who, 330, 470, g.time, true);
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 1 });

    if (this.fadeIn < 1) g.rect(0, 0, VIEW_W, VIEW_H, hex('#000000', 1 - this.fadeIn));
    g.rectGrad(0, 0, VIEW_W, 70, hex('#000000', 0.7), hex('#000000', 0));
    g.text(this.story.place, 30, 40, { size: 21, font: 'italic', color: hex(UI.parch) });
    divider(g, 30 + Math.min(600, g.measure(this.story.place, 21, 'italic')) / 2, 54, Math.min(600, g.measure(this.story.place, 21, 'italic')), hex(UI.brass, 0.6));

    const box = { x: 90, y: 500, w: VIEW_W - 180, h: 190 };
    leatherPanel(g, box, { alpha: 0.97 });
    const name = line.as ?? who.name;
    if (name) {
      const w = g.measure(name, 26) + 70;
      banner(g, box.x + 30 + w / 2, box.y - 24, w, 40, '#3a0a0c');
      g.text(name, box.x + 30 + w / 2, box.y + 5, { size: 26, color: hex('#fff0d0'), color2: hex(who.color), align: 'center' });
    }
    const narr = line.who === 'narrator';
    g.textBlock(line.text.slice(0, Math.floor(this.shown)), box.x + 40, box.y + 60, box.w - 80, {
      size: 25,
      font: narr ? 'italic' : 'body',
      color: hex(narr ? PALETTE.inkDim : PALETTE.ink),
    });
    if (this.shown >= line.text.length) {
      // Advance marker drawn as a shape: ▼ is not in the bundled fonts (npm run i18n:glyphs).
      const ax = box.x + box.w - 30;
      const ay = box.y + box.h - 30 + Math.sin(g.time * 5) * 3;
      g.tri(ax - 6, ay - 5, ax + 6, ay - 5, ax, ay + 5, hex(PALETTE.gold));
    }
    g.text(t('ui.story.controls'), VIEW_W - 30, VIEW_H - 8, { size: 13, color: hex(PALETTE.inkDim, 0.6), align: 'right', shadow: false });
    reticle(g, game.input.pos);
    g.endFrame();
  }
}
