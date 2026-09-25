import type { Game, Scene } from '../core/scene';
import { t } from '../i18n';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { CAST } from '../content/characters';
import type { StoryDef } from '../content/story';
import { VIEW_H, VIEW_W } from '../ui/layout';
import { reticle } from '../ui/widgets';
import { flowMark } from '../ui/ornaments';
import { caps, diamond, INK, rule } from '../ui/hudKit';
import { inkStamp } from '../art/kit';
import { glyphContext, glyphFor } from '../input/glyphs';
import { settings } from '../core/settings';
import { canSkip, readLog, ReadLog } from '../ui/readLog';
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
    // Location: a small engraved caption over a top shade.
    g.rectGrad(vr.x, vr.y, vr.w, 110 - vr.y, hex('#000000', 0.7), hex('#000000', 0));
    caps(g, this.story.place, 40, 44, 14, hex(INK.gold));
    rule(g, 40 + Math.min(560, g.measure(this.story.place.toUpperCase(), 14, 'display', 0.16)) / 2, 56, Math.min(560, g.measure(this.story.place.toUpperCase(), 14, 'display', 0.16)) + 40, hex(INK.gilt, 0.6));

    // Lower third: a deep shade rising from the bottom edge (its strength follows the text-box
    // opacity option, UIX-0128); text scale grows it upward (UIX-0148).
    const ts = settings.textScale;
    const op = settings.textBoxOpacity;
    const bh = Math.round(230 + (ts - 1) * 170);
    const top = vr.y + vr.h - bh;
    g.rectGrad(vr.x, top - 120, vr.w, 120, hex('#000000', 0), hex('#050303', 0.72 * op));
    g.rect(vr.x, top, vr.w, vr.y + vr.h - top, hex('#050303', 0.72 * op));
    g.rectGrad(vr.x, top, vr.w, vr.y + vr.h - top, hex('#000000', 0.1 * op), hex('#000000', 0.5 * op));
    rule(g, VIEW_W / 2, top + 6, VIEW_W * 0.8, hex(INK.gilt, 0.55));
    const tx = 200;
    const tw = VIEW_W - 400;
    const name = line.as ?? who.name;
    if (name) {
      caps(g, name, tx, top + 46, 16, hex(INK.goldHi));
      g.rect(tx, top + 56, Math.min(260, g.measure(name.toUpperCase(), 16, 'display', 0.16)), 1.5, hex(who.color, 0.8));
    }
    const narr = line.who === 'narrator';
    const size = Math.round(24 * ts);
    // A gold initial opens each scene's first narration (ART-0082).
    const cap = this.i === 0 && narr && /^\p{Lu}/u.test(line.text);
    const capSize = Math.round(size * 2.6);
    const ty = top + (name ? 94 : 70);
    if (cap) g.text(line.text[0], tx, ty + capSize * 0.62, { size: capSize, font: 'display', color: hex(INK.goldHi), color2: hex(INK.gold), shadow: hex('#000000', 0.9), soft: true });
    const body = cap ? line.text.slice(1) : line.text;
    const shownBody = cap ? Math.max(0, Math.floor(this.shown) - 1) : Math.floor(this.shown);
    const indent = cap ? g.measure(line.text[0], capSize, 'display') + 10 : 0;
    g.textBlock(body.slice(0, shownBody), tx + indent, ty, tw - indent, {
      size,
      font: narr ? 'italic' : 'body',
      color: hex(narr ? '#d8c8a8' : INK.text),
      shadow: hex('#000000', 0.9),
      soft: true,
    }, 1.42);
    if (line.stamp && this.shown >= line.text.length) inkStamp(g, t(`ui.stamp.${line.stamp}`), tx + tw - 90, top + 60, 24, line.stamp === 'suspect' ? '#e04040' : '#7fc4a4', Math.min(1, this.t * 3), false, line.stamp === 'suspect' ? -0.12 : 0.08);
    if (this.shown >= line.text.length) {
      const pulse = settings.reduceMotion ? 1 : 0.6 + 0.4 * Math.sin(g.time * 4);
      diamond(g, tx + tw + 24, vr.y + vr.h - 46 + (settings.reduceMotion ? 0 : Math.sin(g.time * 4) * 2), 5, hex(INK.gold, pulse), hex('#000000', 0.6));
    }
    if (game.input.act('vn.fast')) flowMark(g, tx + tw + 10, top + 40, 'skip', g.time);
    const click = glyphContext().device === 'pad' ? '' : t('ui.story.click_prefix');
    g.text(t('ui.story.controls_fmt', { click, advance: glyphFor('vn.advance'), fast: glyphFor('vn.fast'), skip: glyphFor('ui.back') }), VIEW_W - 30, VIEW_H - 12, { size: 16, color: hex(INK.faint), align: 'right', shadow: false });
    reticle(g, game.input.pos);
    g.endFrame();
  }
}
