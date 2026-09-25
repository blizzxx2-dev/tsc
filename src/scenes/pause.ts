import type { Game, Scene } from '../core/scene';
import { settings } from '../core/settings';
import { t, tSource } from '../i18n';
import { formatClock, formatNumber, formatVitals } from '../i18n/format';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import type { Operation } from '../surgery/operation';
import { Ui } from '../ui/kit';
import { drawTooltip, menuEntry } from '../ui/controls';
import { caps, diamond, glass, heading, INK, numerals } from '../ui/hudKit';
import { waxSeal } from '../ui/ornaments';
import { MOTION, tween } from '../ui/motion';
import { fitText, wrapLines } from '../ui/text';
import { uiEvents } from '../ui/events';
import { reticle } from '../ui/widgets';
import { platform } from '../platform';
import { IS_DEMO } from '../platform/build';
import { EDITIONS, FEEDBACK_URL } from '../platform/editions';
import { flag } from '../platform/flags';
import { confirm } from './confirm';
import { OptionsScene } from './options';
import { ControlsCardScene } from './controlsCard';
import { RANK_WAX } from './rankArt';

export type PauseResult = 'resume' | 'restart' | 'abandon';

/**
 * "Respite" — the operation's pause menu (UIX-0100/0101/0060), pushed as an
 * overlay: the operation stays visible (dimmed) underneath and stops updating.
 * Resume, Restart (confirm), Options, Controls card, Callout log, Abandon
 * (confirm) and — in desktop builds — Quit to Desktop (confirm). A case-notes
 * sheet shows patient, ailment, time left, vitals, score and current rank pace.
 */
export class PauseScene implements Scene {
  readonly overlay = true;
  readonly ui = new Ui('pause');
  /** Kept for automation (scripts/shoot-aspects.mjs waits on `scene.paused`). */
  readonly paused = true;
  private t = 0;
  private showLog = false;
  private closing = false;

  constructor(
    private op: Operation,
    private log: readonly string[],
    private done: (r: PauseResult) => void,
  ) {}

  private finish(game: Game, r: PauseResult): void {
    if (this.closing) return;
    this.closing = true;
    game.pop?.();
    this.done(r);
  }

  private guarded(game: Game, message: string, then: () => void): void {
    if (!settings.confirmAbandon) return then();
    confirm(game, { message, onYes: then, danger: true });
  }

  private layout(game: Game): void {
    const ui = this.ui;
    ui.begin();
    const x = 760;
    const w = 380;
    let y = 196;
    const h = 46;
    const add = (id: string, label: string, fn: () => void, tip?: string) => {
      ui.button(id, { x, y, w, h }, label, fn, { tip });
      y += h + 6;
    };
    add('resume', t('hud.pause.resume'), () => this.finish(game, 'resume'));
    add('restart', t('hud.pause.restart'), () => this.guarded(game, t('ui.pause.confirm_restart'), () => this.finish(game, 'restart')));
    add('options', t('hud.pause.options'), () => game.push?.(new OptionsScene(() => game.pop?.(), 'overlay')));
    add('controls', t('ui.pause.controls'), () => game.push?.(new ControlsCardScene(this.op.def.tools)));
    add('log', this.showLog ? t('ui.pause.case_notes') : t('ui.pause.callout_log'), () => (this.showLog = !this.showLog));
    add('abandon', t('hud.pause.abandon'), () => this.guarded(game, t('ui.pause.confirm_abandon'), () => this.finish(game, 'abandon')));
    // Demo: a plain menu entry to the full game's store page (PLT-0063) — never an interruption.
    if (IS_DEMO && flag('wishlistPrompts')) add('wishlist', t('ui.title.wishlist'), () => platform.steam.openStore(EDITIONS.full.steamAppId));
    if (FEEDBACK_URL) add('feedback', t('ui.pause.feedback'), () => platform.open({ url: FEEDBACK_URL }));
    if (platform.kind === 'desktop' && !platform.args.kiosk) add('quit', t('ui.pause.quit_desktop'), () => confirm(game, { message: t('ui.pause.confirm_quit'), onYes: () => platform.quit(), danger: true }));
    if (!ui.focus) ui.focusFirst('resume');
  }

  update(dt: number, game: Game): void {
    this.t += dt;
    this.layout(game);
    this.ui.update(game.input, dt);
    if (!this.closing && (game.input.actPressed('ui.back') || game.input.actPressed('pause'))) {
      uiEvents.emit('ui.back', { id: 'pause' });
      this.finish(game, 'resume');
    }
  }

  render(g: Gfx, game: Game): void {
    const k = tween(this.t, MOTION.panel);
    const vr = g.viewRect();
    // The operation beneath is dimmed and pulled back.
    g.rect(vr.x, vr.y, vr.w, vr.h, hex('#050303', 0.66 * k));
    g.rectGrad(vr.x, vr.y, vr.w, vr.h * 0.35, hex('#000000', 0.5 * k), hex('#000000', 0));
    g.rectGrad(vr.x, vr.y + vr.h * 0.65, vr.w, vr.h * 0.35, hex('#000000', 0), hex('#000000', 0.55 * k));
    const slide = (1 - k) * 40;

    // ---- menu (right)
    g.save();
    g.translate(slide, 0);
    const mr = { x: 730, y: 90, w: 440, h: 540 };
    glass(g, mr, { alpha: k, strength: 1.1 });
    heading(g, t('hud.pause.title'), mr.x + mr.w / 2, mr.y + 62, mr.w - 120, k);
    for (const n of this.ui.nodes) menuEntry(g, n, this.ui.state(n.id), g.time, 26);
    g.restore();

    // ---- case notes / callout log (left)
    g.save();
    g.translate(-slide, 0);
    const pr = { x: 110, y: 90, w: 580, h: 540 };
    glass(g, pr, { alpha: k, strength: 1.1 });
    if (this.showLog) this.drawLog(g, pr);
    else this.drawNotes(g, pr);
    g.restore();
    drawTooltip(g, this.ui);
    reticle(g, game.input.pos);
  }

  private drawNotes(g: Gfx, r: { x: number; y: number; w: number; h: number }): void {
    const op = this.op;
    heading(g, t('ui.pause.case_notes'), r.x + r.w / 2, r.y + 62, r.w - 140);
    fitText(g, 'pause.title', op.def.title, r.x + r.w / 2, r.y + 124, r.w - 80, { size: 28, color: hex(INK.text), align: 'center', shadow: hex('#000000', 0.8) });
    fitText(g, 'pause.patient', op.def.patient, r.x + r.w / 2, r.y + 152, r.w - 80, { size: 19, font: 'italic', color: hex(INK.dim), align: 'center', shadow: false });
    const lines = wrapLines((s) => g.measure(s, 18, 'body'), op.def.diagnosis, r.w - 100).slice(0, 3);
    lines.forEach((l, i) => g.text(l, r.x + r.w / 2, r.y + 192 + i * 24, { size: 18, font: 'italic', color: hex(INK.text, 0.85), align: 'center', shadow: false }));
    // Ledger table: caps labels left, numerals right, hairlines between rows.
    const rows: [string, string][] = [
      [t('ui.pause.time_left'), formatClock(op.timeLeft)],
      [t('ui.pause.vitals'), formatVitals(op.vitals)],
      [t('ui.results.score'), formatNumber(op.score)],
      [t('ui.results.longest_chain'), formatNumber(op.maxCombo)],
    ];
    const tx = r.x + 48;
    const tw = 300;
    rows.forEach(([a, b], i) => {
      const y = r.y + 300 + i * 46;
      caps(g, a, tx, y, 12, hex(INK.dim));
      numerals(g, b, tx + tw, y + 2, 22, '#ffffff', '#d8ccb4', 'right');
      g.rect(tx, y + 16, tw, 1, hex(INK.gilt, 0.18));
    });
    // Current rank pace as a wax seal.
    const rank = op.rank();
    const sx = r.x + r.w - 118;
    caps(g, t('ui.pause.rank_pace'), sx, r.y + 300, 11, hex(INK.dim), 'center');
    waxSeal(g, sx, r.y + 370, 46, RANK_WAX[rank]);
    g.text(rank, sx, r.y + 388, { size: rank === 'XS' ? 36 : 46, font: 'display', color: hex('#ffe8c0', 0.95), color2: hex('#f0b070', 0.95), align: 'center', shadow: hex('#2a0204', 0.8) });
    const tally = t('ui.pause.tally', { cool: op.counts.cool, good: op.counts.good, bad: op.counts.bad, miss: op.counts.miss });
    fitText(g, 'pause.tally', tally, r.x + r.w / 2, r.y + r.h - 36, r.w - 60, { size: 17, color: hex(INK.dim), align: 'center', shadow: false });
  }

  private drawLog(g: Gfx, r: { x: number; y: number; w: number; h: number }): void {
    heading(g, t('ui.pause.callout_log'), r.x + r.w / 2, r.y + 62, r.w - 140);
    if (!this.log.length) {
      g.text(t('ui.pause.log_empty'), r.x + r.w / 2, r.y + 140, { size: 19, font: 'italic', color: hex(INK.dim), align: 'center', shadow: false });
      return;
    }
    // Newest at the bottom; show as many recent lines as fit.
    const m = (s: string) => g.measure(s, 18, 'body');
    const blocks = this.log.map((l) => wrapLines(m, tSource(l), r.w - 100));
    let y = r.y + r.h - 34;
    for (let i = blocks.length - 1; i >= 0 && y > r.y + 110; i--) {
      const b = blocks[i];
      y -= b.length * 24;
      if (y < r.y + 110) break;
      diamond(g, r.x + 44, y + 16, 3, hex(INK.gold, 0.9));
      b.forEach((line, j) => g.text(line, r.x + 60, y + 22 + j * 24, { size: 18, color: hex(INK.text), shadow: false }));
      y -= 12;
    }
  }
}
