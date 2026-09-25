import type { Game, Scene } from '../core/scene';
import { settings } from '../core/settings';
import { t, tSource } from '../i18n';
import { formatClock, formatNumber, formatVitals } from '../i18n/format';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import type { Operation } from '../surgery/operation';
import { Ui } from '../ui/kit';
import { drawTooltip, hrule, menuEntry } from '../ui/controls';
import { divider, giltText, leatherPanel, parchmentSheet, UI, waxSeal } from '../ui/ornaments';
import { MOTION, tween } from '../ui/motion';
import { fitText, wrapLines } from '../ui/text';
import { uiEvents } from '../ui/events';
import { reticle } from '../ui/widgets';
import { platform } from '../platform';
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
    // The world beneath is dimmed and veiled (a heavy vignette stands in for blur on the batch renderer).
    g.rect(vr.x, vr.y, vr.w, vr.h, hex('#050203', 0.62 * k));
    g.rectGrad(vr.x, vr.y, vr.w, vr.h * 0.35, hex('#000000', 0.5 * k), hex('#000000', 0));
    g.rectGrad(vr.x, vr.y + vr.h * 0.65, vr.w, vr.h * 0.35, hex('#000000', 0), hex('#000000', 0.5 * k));
    const slide = (1 - k) * 60;
    // ART-0079: a candle just snuffed at the foot of the screen, its smoke curling up.
    const cx = 690;
    const cy = 668;
    g.rectGrad(cx - 9, cy - 34, 18, 34, hex('#e8d8a8', 0.9 * k), hex('#8a7040', 0.9 * k));
    g.ellipse(cx, cy - 34, 9, 3, 0, hex('#fff4d0', 0.8 * k), hex('#c8b888', 0.8 * k));
    g.line({ x: cx, y: cy - 34 }, { x: cx + 1, y: cy - 40 }, 1.5, hex('#1a1008', k));
    g.glow(cx + 1, cy - 40, 5, hex('#ff6020', 0.5 * k * (0.6 + 0.4 * Math.sin(g.time * 9))));
    for (let i = 0; i < 14; i++) {
      const f = (g.time * 0.35 + i / 14) % 1;
      const x = cx + 1 + Math.sin(f * 7 + i) * (4 + f * 22);
      g.glow(x, cy - 44 - f * 150, 6 + f * 18, hex('#b8b0a0', 0.1 * (1 - f) * k));
    }

    // ---- menu (right)
    g.save();
    g.translate(slide, 0);
    const mr = { x: 730, y: 90, w: 440, h: 540 };
    // The ledger hangs from two chains off the top of the screen.
    for (const x of [mr.x + 60, mr.x + mr.w - 60]) for (let y = vr.y - 8; y < mr.y + 6; y += 12) g.ellipse(x, y, (y / 12) % 2 < 1 ? 3 : 1.5, 6, 0, hex('#6a6a66', 0), hex('#8a8a86', 0.95));
    leatherPanel(g, mr, { alpha: 0.97 });
    giltText(g, t('hud.pause.title'), mr.x + mr.w / 2, mr.y + 66, { size: 50, align: 'center' });
    divider(g, mr.x + mr.w / 2, mr.y + 88, 280);
    for (const n of this.ui.nodes) menuEntry(g, n, this.ui.state(n.id), g.time, 26);
    g.restore();

    // ---- case notes / callout log (left)
    g.save();
    g.translate(-slide, 0);
    const pr = { x: 110, y: 110, w: 560, h: 500 };
    parchmentSheet(g, pr, 11);
    if (this.showLog) this.drawLog(g, pr);
    else this.drawNotes(g, pr);
    g.restore();
    drawTooltip(g, this.ui);
    reticle(g, game.input.pos);
  }

  private drawNotes(g: Gfx, r: { x: number; y: number; w: number; h: number }): void {
    const op = this.op;
    const ink = hex(UI.inkDark);
    const faded = hex('#4a3418');
    g.text(t('ui.pause.case_notes'), r.x + r.w / 2, r.y + 56, { size: 36, font: 'display', color: hex('#6a0a10'), align: 'center', shadow: false });
    hrule(g, r.x + 40, r.y + 76, r.w - 80, hex('#6a4a22', 0.8), 1.5);
    fitText(g, 'pause.title', op.def.title, r.x + r.w / 2, r.y + 114, r.w - 80, { size: 28, color: ink, align: 'center', shadow: false });
    fitText(g, 'pause.patient', op.def.patient, r.x + r.w / 2, r.y + 144, r.w - 80, { size: 20, font: 'italic', color: faded, align: 'center', shadow: false });
    const lines = wrapLines((s) => g.measure(s, 19, 'body'), op.def.diagnosis, r.w - 100).slice(0, 3);
    lines.forEach((l, i) => g.text(l, r.x + 50, r.y + 184 + i * 25, { size: 19, color: ink, shadow: false }));
    const rows: [string, string][] = [
      [t('ui.pause.time_left'), formatClock(op.timeLeft)],
      [t('ui.pause.vitals'), formatVitals(op.vitals)],
      [t('ui.results.score'), formatNumber(op.score)],
      [t('ui.results.longest_chain'), formatNumber(op.maxCombo)],
    ];
    rows.forEach(([a, b], i) => {
      const y = r.y + 290 + i * 38;
      g.text(a, r.x + 50, y, { size: 22, color: faded, shadow: false });
      g.text(b, r.x + 330, y, { size: 22, color: ink, align: 'right', shadow: false });
    });
    // Current rank pace as a wax seal.
    const rank = op.rank();
    g.text(t('ui.pause.rank_pace'), r.x + 450, r.y + 290, { size: 18, font: 'italic', color: faded, align: 'center', shadow: false });
    waxSeal(g, r.x + 450, r.y + 350, 44, RANK_WAX[rank]);
    g.text(rank, r.x + 450, r.y + 368, { size: rank === 'XS' ? 40 : 50, font: 'display', color: hex('#ffe8c0', 0.95), color2: hex('#f0b070', 0.95), align: 'center', shadow: hex('#2a0204', 0.8) });
    const tally = t('ui.pause.tally', { cool: op.counts.cool, good: op.counts.good, bad: op.counts.bad, miss: op.counts.miss });
    fitText(g, 'pause.tally', tally, r.x + r.w / 2, r.y + r.h - 40, r.w - 60, { size: 18, color: faded, align: 'center', shadow: false });
  }

  private drawLog(g: Gfx, r: { x: number; y: number; w: number; h: number }): void {
    g.text(t('ui.pause.callout_log'), r.x + r.w / 2, r.y + 56, { size: 34, font: 'display', color: hex('#6a0a10'), align: 'center', shadow: false });
    hrule(g, r.x + 40, r.y + 76, r.w - 80, hex('#6a4a22', 0.8), 1.5);
    if (!this.log.length) {
      g.text(t('ui.pause.log_empty'), r.x + r.w / 2, r.y + 130, { size: 20, font: 'italic', color: hex('#4a3418'), align: 'center', shadow: false });
      return;
    }
    // Newest at the bottom; show as many recent lines as fit.
    const m = (s: string) => g.measure(s, 18, 'body');
    const blocks = this.log.map((l) => wrapLines(m, tSource(l), r.w - 90));
    let y = r.y + r.h - 34;
    for (let i = blocks.length - 1; i >= 0 && y > r.y + 110; i--) {
      const b = blocks[i];
      y -= b.length * 23;
      if (y < r.y + 100) break;
      g.circle(r.x + 42, y + 17, 3, hex('#6a0a10', 0.8));
      b.forEach((line, j) => g.text(line, r.x + 56, y + 22 + j * 23, { size: 18, color: hex(UI.inkDark), shadow: false }));
      y -= 10;
    }
  }
}
