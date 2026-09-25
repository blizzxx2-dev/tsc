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
import type { ActionId } from '../input/actions';
import { tooltip } from '../ui/controls';
import { settings } from '../core/settings';
import { canSkip, readLog, ReadLog } from '../ui/readLog';
import { drawBackdrop, drawPortrait } from './backdrop';
import { BacklogScene, StoryMenuScene, type BacklogLine } from './storyMenu';
import { TitleScene } from './title';

const CPS = 48; // characters per second

/** The text box's control strip (UIX-0125): clickable Auto / Skip / Log / Hide / Menu at the bottom-right. */
type StripId = 'auto' | 'skip' | 'log' | 'hide' | 'menu';
const STRIP: readonly { id: StripId; action: ActionId }[] = [
  { id: 'auto', action: 'vn.auto' },
  { id: 'skip', action: 'vn.fast' },
  { id: 'log', action: 'vn.log' },
  { id: 'hide', action: 'vn.hide' },
  { id: 'menu', action: 'ui.back' },
];
const STRIP_W = 84;
const STRIP_H = 30;
function stripRect(i: number): { x: number; y: number; w: number; h: number } {
  return { x: VIEW_W - 24 - (STRIP.length - i) * (STRIP_W + 6), y: VIEW_H - 44, w: STRIP_W, h: STRIP_H };
}
const inside = (p: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

/** Visual-novel scene: backdrop, portrait, name plate and a typewriter text box. */
export class StoryScene implements Scene {
  private i = 0;
  private shown = 0;
  private t = 0;
  private fadeIn = 0;
  /** Auto-advance (vn.auto): lines move on by themselves after a reading pause. */
  private auto = false;
  /** Text box hidden (vn.hide) to look at the scene; any advance brings it back. */
  private hidden = false;
  /** Skip mode toggled from the control strip: fast-forward as if the key were held. */
  private skipMode = false;

  constructor(
    private story: StoryDef,
    private onDone: () => void,
  ) {}

  private get line() {
    return this.story.lines[this.i];
  }

  /** Every line shown so far in this scene, for the backlog (UIX-0121). */
  private backlog(): BacklogLine[] {
    return this.story.lines.slice(0, this.i + 1).map((l) => ({ who: l.who === 'narrator' ? '' : (l.as ?? CAST[l.who].name ?? ''), text: l.text, narration: l.who === 'narrator' }));
  }

  private finish(): void {
    readLog.flush();
    this.onDone();
  }

  /** Esc no longer skips outright: it opens the scene's menu (UIX-0122). */
  private openMenu(game: Game): void {
    if (!game.push) return this.finish();
    game.push(
      new StoryMenuScene(this.story.place, this.backlog(), (r) => {
        if (r === 'skip') this.finish();
        else if (r === 'title') {
          readLog.flush();
          game.go(new TitleScene());
        }
      }),
    );
  }

  update(dt: number, game: Game): void {
    const { input } = game;
    this.t += dt;
    this.fadeIn = Math.min(1, this.fadeIn + dt * 1.5);
    // Fast-forward passes only lines already read, unless "Skip unread text" is on (UIX-0124).
    const id = ReadLog.lineId(this.story.id, this.i);
    const fast = (input.act('vn.fast') || this.skipMode) && canSkip(readLog.has(id), settings.skipUnread);
    if (this.skipMode && !canSkip(readLog.has(id), settings.skipUnread)) this.skipMode = false; // skip stops at unread text
    this.shown += dt * CPS * settings.textSpeed * (fast ? 8 : 1);
    const full = this.shown >= this.line.text.length;
    if (full) readLog.mark(id);
    // The control strip consumes its own clicks.
    const hit = !this.hidden && input.pressed ? STRIP.find((_, i) => inside(input.pos, stripRect(i)))?.id : undefined;
    if (input.actPressed('ui.back') || hit === 'menu') return this.openMenu(game);
    if ((input.actPressed('vn.log') || input.wheel < 0 || hit === 'log') && game.push) return game.push(new BacklogScene(this.backlog()));
    if (input.actPressed('vn.auto') || hit === 'auto') this.auto = !this.auto;
    if (hit === 'skip') this.skipMode = !this.skipMode;
    if (this.hidden) {
      // Any press only brings the text back (UIX-0126).
      if (input.pressed || input.rightPressed || input.actPressed('vn.advance') || input.actPressed('vn.hide')) this.hidden = false;
      return;
    }
    if (input.actPressed('vn.hide') || input.rightPressed || hit === 'hide') {
      this.hidden = true;
      return;
    }
    if (hit) return;
    const click = input.pressed || input.actPressed('vn.advance');
    // Manual input pauses auto mode (UIX-0123).
    if (click && this.auto && full) this.auto = false;
    const autoDue = this.auto && full && this.t > Math.max(1.2, this.line.text.length * 0.03) / settings.textSpeed;
    const advance = click || (fast && full && this.t > 0.08) || autoDue;
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
      this.finish();
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

    if (this.hidden) {
      reticle(g, game.input.pos);
      return g.endFrame();
    }
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
    // Only when the narration runs to two lines or more, so the initial has lines to sit beside.
    const cap = this.i === 0 && narr && /^\p{Lu}/u.test(line.text) && g.wrap(line.text, VIEW_W - 400, Math.round(24 * ts), 'italic').length >= 2;
    const capSize = Math.round(size * 2.6);
    const ty = top + (name ? 94 : 70);
    if (cap) g.text(line.text[0], tx, ty + size * 1.42, { size: capSize, font: 'display', color: hex(INK.goldHi), color2: hex(INK.gold), shadow: hex('#000000', 0.9), soft: true });
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
    this.drawStrip(g, game);
    reticle(g, game.input.pos);
    g.endFrame();
  }

  private drawStrip(g: Gfx, game: Game): void {
    // Pads have no pointer: the bindings are spelled out instead of the clickable strip.
    if (glyphContext().device === 'pad') {
      const hint = t('ui.story.controls_fmt', { advance: glyphFor('vn.advance'), fast: glyphFor('vn.fast'), log: glyphFor('vn.log'), auto: glyphFor('vn.auto'), skip: glyphFor('ui.back') });
      g.text(hint, VIEW_W - 30, VIEW_H - 12, { size: 16, color: hex(this.auto ? INK.gold : INK.faint), align: 'right', shadow: false });
      return;
    }
    let hover = -1;
    STRIP.forEach(({ id }, i) => {
      const r = stripRect(i);
      const over = inside(game.input.pos, r);
      if (over) hover = i;
      const on = (id === 'auto' && this.auto) || (id === 'skip' && (this.skipMode || game.input.act('vn.fast')));
      const lit = on ? 1 : over ? 0.85 : 0.5;
      if (on || over) g.rect(r.x + 10, r.y + r.h - 4, r.w - 20, 1.5, hex(INK.gold, on ? 0.9 : 0.5));
      if (on) diamond(g, r.x + 8, r.y + r.h / 2, 3, hex(INK.goldHi, 0.6 + 0.4 * Math.sin(g.time * 3)));
      caps(g, t(`ui.story.strip.${id}`), r.x + r.w / 2, r.y + r.h / 2 + 5, 13, hex(on ? INK.goldHi : INK.text, lit), 'center');
    });
    if (hover >= 0) {
      const { id, action } = STRIP[hover];
      tooltip(g, stripRect(hover), t(`ui.story.strip.${id}`), t('ui.story.strip.key', { key: glyphFor(action) }));
    }
  }
}
