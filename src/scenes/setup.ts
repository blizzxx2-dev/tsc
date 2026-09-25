/**
 * First-launch setup (UIX-0075): after the notices, a short chain of one-question pages — the
 * brightness calibration, a check of the input device in hand, the text size and whether the
 * theatre should keep gentler timings. Every answer is a normal setting, so Options can change it
 * later; the chain shows once per machine and never in automated browsers.
 */
import type { Game, Scene } from '../core/scene';
import { saveSettings, settings } from '../core/settings';
import { t } from '../i18n';
import { LOCALES } from '../i18n/locales';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { Ui } from '../ui/kit';
import { menuEntry } from '../ui/controls';
import { caps, heading, INK, rule } from '../ui/hudKit';
import { MOTION, tween } from '../ui/motion';
import { wrapLines } from '../ui/text';
import { reticle } from '../ui/widgets';
import { VIEW_W } from '../ui/layout';
import { CalibrateScene } from './calibrate';
import { ControlsScene } from '../input/controlsScene';
import { drawBackdrop } from './backdrop';

const SEEN_KEY = 'suture-and-steel.setup.v1';

/** True until the setup chain has been finished (or skipped) once on this machine. */
export function setupDue(): boolean {
  if (typeof navigator !== 'undefined' && navigator.webdriver) return false;
  try {
    return !localStorage.getItem(SEEN_KEY);
  } catch {
    return false;
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // no storage: asked again next launch, which is harmless
  }
}

type Step = 'brightness' | 'device' | 'text' | 'timing';

/** The pages in order; the language page is only worth asking once a second locale ships. */
export function setupSteps(): Step[] {
  void LOCALES;
  return ['brightness', 'device', 'text', 'timing'];
}

export class SetupScene implements Scene {
  readonly ui = new Ui('setup');
  private steps = setupSteps();
  private i = 0;
  private t = 0;
  private done = false;

  constructor(private next: () => void) {}

  private get step(): Step {
    return this.steps[this.i]!;
  }

  private advance(): void {
    this.t = 0;
    this.ui.setFocus(null);
    if (this.i < this.steps.length - 1) this.i++;
    else this.finish();
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    saveSettings();
    markSeen();
    this.next();
  }

  private layout(game: Game): void {
    const ui = this.ui;
    ui.begin();
    const w = 420;
    const x = VIEW_W / 2 - w / 2;
    let y = 430;
    const choice = (id: string, label: string, fn: () => void, first = false) => {
      ui.button(id, { x, y, w, h: 44 }, label, () => {
        fn();
        this.advance();
      });
      if (first && !ui.focus) ui.focusFirst(id);
      y += 50;
    };
    switch (this.step) {
      case 'brightness':
        choice('go', t('ui.setup.brightness.go'), () => game.push?.(new CalibrateScene(() => game.pop?.())), true);
        choice('keep', t('ui.setup.brightness.keep'), () => undefined);
        break;
      case 'device':
        choice('ok', t('ui.setup.device.ok'), () => undefined, true);
        choice('controls', t('ui.setup.device.controls'), () => game.push?.(new ControlsScene(() => game.pop?.())));
        break;
      case 'text':
        ([1, 1.25, 1.5] as const).forEach((v, k) => choice(`text${k}`, t(`ui.setup.text.${k}`), () => (settings.textScale = v), v === settings.textScale));
        break;
      case 'timing':
        ([1, 1.5, 2] as const).forEach((v, k) => choice(`timing${k}`, t(`ui.setup.timing.${k}`), () => (settings.timerAssist = v), v === settings.timerAssist));
        break;
    }
    ui.button('skip', { x: VIEW_W - 260, y: 640, w: 220, h: 40 }, t('ui.setup.skip'), () => this.finish());
    if (!ui.focus) ui.focusFirst();
  }

  update(dt: number, game: Game): void {
    this.t += dt;
    this.layout(game);
    this.ui.update(game.input, dt);
    if (game.input.actPressed('ui.back')) this.advance();
  }

  render(g: Gfx, game: Game): void {
    const k = tween(this.t, MOTION.panel);
    g.beginWorld();
    drawBackdrop(g, 'night', g.time);
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 'menu', defocus: 10 });
    const vr = g.viewRect();
    g.rect(vr.x, vr.y, vr.w, vr.h, hex('#050303', 0.78));
    heading(g, t('ui.setup.heading'), VIEW_W / 2, 92, 520, 1);
    caps(g, t('ui.setup.step', { n: this.i + 1, total: this.steps.length }), VIEW_W / 2, 132, 12, hex(INK.dim), 'center');

    const pad = game.input.gamepad.connected;
    const title = t(`ui.setup.${this.step}.title`);
    const body = this.step === 'device' ? t(pad ? 'ui.setup.device.body_pad' : 'ui.setup.device.body_kbm') : t(`ui.setup.${this.step}.body`);
    caps(g, title, VIEW_W / 2, 214, 16, hex(INK.goldHi, k), 'center');
    rule(g, VIEW_W / 2, 230, 360, hex(INK.gilt, 0.45 * k));
    const cw = 640;
    const lines = wrapLines((s) => g.measure(s, 20, 'body'), body, cw);
    lines.forEach((l, i) => g.text(l, VIEW_W / 2, 272 + i * 30, { size: 20, color: hex(INK.text, 0.92 * k), align: 'center', shadow: false }));
    g.text(t('ui.setup.note'), VIEW_W / 2, 600, { size: 17, font: 'italic', color: hex(INK.dim, k), align: 'center', shadow: false });
    for (const n of this.ui.nodes) menuEntry(g, n, this.ui.state(n.id), g.time, n.id === 'skip' ? 20 : 24);
    reticle(g, game.input.pos);
    g.endFrame();
  }
}
