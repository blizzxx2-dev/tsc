/**
 * Story overlays: the scene's pause menu (UIX-0122) and the dialogue backlog (UIX-0121).
 * Both are pushed over the story, which stays visible (dimmed) beneath and stops updating.
 */
import type { Game, Scene } from '../core/scene';
import { settings } from '../core/settings';
import { t } from '../i18n';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { Ui } from '../ui/kit';
import { drawTooltip, menuEntry } from '../ui/controls';
import { caps, diamond, glass, heading, INK } from '../ui/hudKit';
import { MOTION, tween } from '../ui/motion';
import { wrapLines } from '../ui/text';
import { uiEvents } from '../ui/events';
import { reticle } from '../ui/widgets';
import { glyphFor } from '../input/glyphs';
import { VIEW_H, VIEW_W } from '../ui/layout';
import { confirm } from './confirm';
import { OptionsScene } from './options';

export type StoryMenuResult = 'resume' | 'skip' | 'title';

/** One entry of the backlog: who spoke (empty for narration) and what was said. */
export interface BacklogLine {
  who: string;
  text: string;
  narration: boolean;
}

/** Dim the scene beneath an overlay. */
function dim(g: Gfx, k: number): void {
  const vr = g.viewRect();
  g.rect(vr.x, vr.y, vr.w, vr.h, hex('#050303', 0.7 * k));
  g.rectGrad(vr.x, vr.y, vr.w, vr.h * 0.35, hex('#000000', 0.5 * k), hex('#000000', 0));
}

/** Resume / Skip Scene (confirm) / Backlog / Options / Return to Title (confirm). */
export class StoryMenuScene implements Scene {
  readonly overlay = true;
  readonly ui = new Ui('story-menu');
  private t = 0;
  private closing = false;

  constructor(
    private place: string,
    private log: readonly BacklogLine[],
    private done: (r: StoryMenuResult) => void,
  ) {}

  private finish(game: Game, r: StoryMenuResult): void {
    if (this.closing) return;
    this.closing = true;
    game.pop?.();
    this.done(r);
  }

  private layout(game: Game): void {
    const ui = this.ui;
    ui.begin();
    const w = 380;
    const x = VIEW_W / 2 - w / 2;
    let y = 236;
    const h = 46;
    const add = (id: string, label: string, fn: () => void) => {
      ui.button(id, { x, y, w, h }, label, fn);
      y += h + 6;
    };
    add('resume', t('ui.story.menu.resume'), () => this.finish(game, 'resume'));
    add('skip', t('ui.story.menu.skip'), () => confirm(game, { message: t('ui.story.menu.confirm_skip'), onYes: () => this.finish(game, 'skip') }));
    add('backlog', t('ui.story.menu.backlog'), () => game.push?.(new BacklogScene(this.log)));
    add('options', t('hud.pause.options'), () => game.push?.(new OptionsScene(() => game.pop?.(), 'overlay')));
    add('title', t('ui.story.menu.title'), () => confirm(game, { message: t('ui.story.menu.confirm_title'), onYes: () => this.finish(game, 'title'), danger: true }));
    if (!ui.focus) ui.focusFirst('resume');
  }

  update(dt: number, game: Game): void {
    this.t += dt;
    this.layout(game);
    this.ui.update(game.input, dt);
    if (!this.closing && game.input.actPressed('ui.back')) {
      uiEvents.emit('ui.back', { id: 'story-menu' });
      this.finish(game, 'resume');
    }
  }

  render(g: Gfx, game: Game): void {
    const k = tween(this.t, MOTION.panel);
    dim(g, k);
    const r = { x: VIEW_W / 2 - 230, y: 110, w: 460, h: 470 };
    g.save();
    g.translate(0, (1 - k) * 24);
    glass(g, r, { alpha: k, strength: 1.1 });
    heading(g, t('ui.story.menu.heading'), r.x + r.w / 2, r.y + 62, r.w - 120, k);
    caps(g, this.place, r.x + r.w / 2, r.y + 100, 12, hex(INK.dim, k), 'center');
    for (const n of this.ui.nodes) menuEntry(g, n, this.ui.state(n.id), g.time, 26);
    g.restore();
    drawTooltip(g, this.ui);
    reticle(g, game.input.pos);
  }
}

const LINE_H = 28;
const GAP = 18;

/** The dialogue backlog: every line shown so far this scene, newest at the bottom. Wheel, arrows or stick scroll. */
export class BacklogScene implements Scene {
  readonly overlay = true;
  private t = 0;
  /** Pixels scrolled up from the newest line. */
  private scroll = 0;
  private closing = false;

  constructor(private log: readonly BacklogLine[]) {}

  update(dt: number, game: Game): void {
    this.t += dt;
    const input = game.input;
    this.scroll += -input.wheel * 90;
    if (input.actPressed('ui.up')) this.scroll += LINE_H * 3;
    if (input.actPressed('ui.down')) this.scroll -= LINE_H * 3;
    this.scroll = Math.max(0, this.scroll);
    const leave = input.actPressed('ui.back') || input.actPressed('vn.log') || input.rightPressed;
    // Scrolling back down past the newest line closes the log, as in most visual novels.
    if (!this.closing && (leave || (input.wheel > 0 && this.scroll === 0 && this.t > 0.3))) {
      this.closing = true;
      uiEvents.emit('ui.back', { id: 'backlog' });
      game.pop?.();
    }
  }

  render(g: Gfx, game: Game): void {
    const k = tween(this.t, MOTION.panel);
    dim(g, k);
    const r = { x: 160, y: 60, w: VIEW_W - 320, h: VIEW_H - 120 };
    glass(g, r, { alpha: k, strength: 1.15 });
    heading(g, t('ui.story.backlog.title'), r.x + r.w / 2, r.y + 58, r.w - 200, k);
    const top = r.y + 96;
    const bottom = r.y + r.h - 50;
    const tw = r.w - 260;
    const size = Math.round(20 * settings.textScale);
    const lh = Math.round(LINE_H * settings.textScale);
    if (!this.log.length) {
      g.text(t('ui.story.backlog.empty'), r.x + r.w / 2, top + 60, { size: 19, font: 'italic', color: hex(INK.dim, k), align: 'center', shadow: false });
    } else {
      // Lay out from the newest line upward.
      const blocks = this.log.map((l) => ({ l, lines: wrapLines((s) => g.measure(s, size, l.narration ? 'italic' : 'body'), l.text, tw) }));
      const total = blocks.reduce((s, b) => s + b.lines.length * lh + GAP, 0);
      this.scroll = Math.min(this.scroll, Math.max(0, total - (bottom - top)));
      g.pushClip({ x: r.x, y: top - 8, w: r.w, h: bottom - top + 16 });
      let y = bottom + this.scroll;
      for (let i = blocks.length - 1; i >= 0; i--) {
        const { l, lines } = blocks[i];
        y -= lines.length * lh;
        if (y > bottom) {
          y -= GAP;
          continue;
        }
        if (y + lines.length * lh < top - lh) break;
        const newest = i === blocks.length - 1;
        if (l.who) caps(g, l.who, r.x + 190, y + 18, 13, hex(newest ? INK.goldHi : INK.gold, k), 'right');
        else diamond(g, r.x + 184, y + 12, 3, hex(INK.gold, 0.8 * k));
        lines.forEach((s, j) => g.text(s, r.x + 210, y + 20 + j * lh, { size, font: l.narration ? 'italic' : 'body', color: hex(l.narration ? '#d8c8a8' : INK.text, (newest ? 1 : 0.85) * k), shadow: false }));
        y -= GAP;
      }
      g.popClip();
      if (this.scroll > 0) caps(g, t('ui.story.backlog.newer'), r.x + r.w / 2, bottom + 30, 11, hex(INK.dim, k), 'center');
    }
    g.text(t('ui.story.backlog.hint', { close: glyphFor('ui.back') }), r.x + r.w - 30, r.y + r.h - 18, { size: 16, color: hex(INK.faint, k), align: 'right', shadow: false });
    reticle(g, game.input.pos);
  }
}
