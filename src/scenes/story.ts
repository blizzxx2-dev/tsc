import type { Game, Scene } from '../core/scene';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { CAST } from '../content/characters';
import type { StoryDef } from '../content/story';
import { PALETTE, VIEW_H, VIEW_W } from '../ui/layout';
import { panel, reticle } from '../ui/widgets';
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
    g.text(this.story.place, 30, 42, { size: 20, font: 'italic', color: hex(PALETTE.inkDim) });

    const box = { x: 90, y: 500, w: VIEW_W - 180, h: 190 };
    panel(g, box, 0.9);
    const name = line.as ?? who.name;
    if (name) {
      const w = g.measure(name, 26) + 40;
      panel(g, { x: box.x + 20, y: box.y - 26, w, h: 44 }, 0.95);
      g.text(name, box.x + 40, box.y + 6, { size: 26, color: hex(who.color) });
    }
    const narr = line.who === 'narrator';
    g.textBlock(line.text.slice(0, Math.floor(this.shown)), box.x + 40, box.y + 60, box.w - 80, {
      size: 25,
      font: narr ? 'italic' : 'body',
      color: hex(narr ? PALETTE.inkDim : PALETTE.ink),
    });
    if (this.shown >= line.text.length) g.text('▼', box.x + box.w - 36, box.y + box.h - 18 + Math.sin(g.time * 5) * 3, { size: 16, color: hex(PALETTE.gold) });
    g.text('Click / Space: advance    Ctrl: fast    Esc: skip scene', VIEW_W - 30, VIEW_H - 8, { size: 13, color: hex(PALETTE.inkDim, 0.6), align: 'right', shadow: false });
    reticle(g, game.input.pos);
    g.endFrame();
  }
}
