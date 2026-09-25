import type { Game, Scene } from '../core/scene';
import { t } from '../i18n';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { CAST } from '../content/characters';
import type { StoryDef } from '../content/story';
import { PALETTE, VIEW_H, VIEW_W } from '../ui/layout';
import { reticle } from '../ui/widgets';
import { divider, flowMark, nameCartouche, quillGlyph, scroll, UI } from '../ui/ornaments';
import { glyphContext, glyphFor } from '../input/glyphs';
import { settings } from '../core/settings';
import { canSkip, readLog, ReadLog } from '../ui/readLog';
import { parchmentArt } from '../art/kit';
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
    // Fast-forward passes only lines already read, unless "Skip unread text" is on (UIX-0124).
    const id = ReadLog.lineId(this.story.id, this.i);
    const fast = input.act('vn.fast') && canSkip(readLog.has(id), settings.skipUnread);
    this.shown += dt * CPS * settings.textSpeed * (fast ? 8 : 1);
    const full = this.shown >= this.line.text.length;
    if (full) readLog.mark(id);
    const advance = input.pressed || input.actPressed('vn.advance') || (fast && full && this.t > 0.08);
    if (input.actPressed('ui.back')) {
      readLog.flush();
      return this.onDone();
    }
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
      readLog.flush();
      this.onDone();
    } else game.audio.play('select');
  }

  render(g: Gfx, game: Game): void {
    const line = this.line;
    const who = CAST[line.who];
    g.beginWorld();
    drawBackdrop(g, this.story.backdrop, g.time, { lighting: this.story.lighting, pointer: settings.reduceMotion ? undefined : game.input.pos });
    if (who.silhouette !== 'none') drawPortrait(g, who, 330, 500, g.time, true, this.shown < line.text.length);
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 1 });

    const vr = g.viewRect();
    if (this.fadeIn < 1) g.rect(vr.x, vr.y, vr.w, vr.h, hex('#000000', 1 - this.fadeIn));
    g.rectGrad(vr.x, vr.y, vr.w, 70 - vr.y, hex('#000000', 0.7), hex('#000000', 0));
    g.text(this.story.place, 30, 40, { size: 21, font: 'italic', color: hex(UI.parch) });
    divider(g, 30 + Math.min(600, g.measure(this.story.place, 21, 'italic')) / 2, 54, Math.min(600, g.measure(this.story.place, 21, 'italic')), hex(UI.brass, 0.6));

    // Text scale grows the box upward so three lines fit at 125 % and beyond (UIX-0148); opacity
    // lets the scene show through (UIX-0128).
    const ts = settings.textScale;
    const bh = Math.round(190 + (ts - 1) * 170);
    const box = { x: 90, y: 690 - bh, w: VIEW_W - 180, h: bh };
    if (settings.textBoxOpacity >= 0.99) scroll(g, box);
    else parchmentArt(g, box, 'fresh', 1, box.x + box.y, settings.textBoxOpacity);
    const name = line.as ?? who.name;
    if (name) {
      const w = g.measure(name, 26) + 70;
      nameCartouche(g, box.x + 30 + w / 2, box.y - 4, w, 38, who.color);
      g.text(name, box.x + 30 + w / 2, box.y + 5, { size: 26, color: hex('#fff0d0'), color2: hex(who.color), align: 'center' });
    }
    const narr = line.who === 'narrator';
    g.textBlock(line.text.slice(0, Math.floor(this.shown)), box.x + 40, box.y + 60, box.w - 80, {
      size: Math.round(25 * ts),
      font: narr ? 'italic' : 'body',
      color: hex(narr ? '#5a4228' : UI.inkDark),
      shadow: false,
    });
    if (this.shown >= line.text.length) quillGlyph(g, box.x + box.w - 40, box.y + box.h - 30, 16, g.time, hex('#6a0a10'));
    if (game.input.act('vn.fast')) flowMark(g, box.x + box.w - 62, box.y + 24, 'skip', g.time);
    const click = glyphContext().device === 'pad' ? '' : t('ui.story.click_prefix');
    g.text(t('ui.story.controls_fmt', { click, advance: glyphFor('vn.advance'), fast: glyphFor('vn.fast'), skip: glyphFor('ui.back') }), VIEW_W - 30, VIEW_H - 8, { size: 16, color: hex(PALETTE.inkDim, 0.6), align: 'right', shadow: false });
    reticle(g, game.input.pos);
    g.endFrame();
  }
}
