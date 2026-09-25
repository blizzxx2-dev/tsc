import type { Game, Scene } from '../core/scene';
import { saveSettings, settings } from '../core/settings';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { PALETTE, VIEW_W } from '../ui/layout';
import { button, inRect, panel, reticle } from '../ui/widgets';
import { drawBackdrop } from './backdrop';
import { getLocale, t } from '../i18n';
import { cycleLanguage } from '../i18n/boot';
import { localeInfo } from '../i18n/locales';

interface Row {
  /** String-table key of the row label (see src/i18n/strings/en.json). */
  label: string;
  value: () => string;
  /** dir: -1 for left/previous, +1 for right/next. */
  change: (dir: number, game: Game) => void;
  /** String-table key of the explanatory note. */
  note?: string;
}

const onOff = (on: boolean): string => t(on ? 'ui.common.on' : 'ui.common.off');

const cycle = <T,>(list: readonly T[], cur: T, dir: number): T => list[(list.indexOf(cur) + dir + list.length) % list.length];

export class OptionsScene implements Scene {
  private rows: Row[] = [
    {
      label: 'ui.options.volume',
      value: () => t('ui.options.volume_value', { value: settings.volume }),
      change: (d, g) => {
        settings.volume = Math.max(0, Math.min(1, Math.round((settings.volume + d * 0.1) * 10) / 10));
        g.audio.volume = settings.volume;
        g.audio.play('select');
      },
    },
    {
      label: 'ui.options.sound',
      value: () => onOff(!settings.muted),
      change: (_d, g) => {
        settings.muted = !settings.muted;
        g.audio.muted = settings.muted;
      },
    },
    {
      label: 'ui.options.shake',
      value: () => t(settings.shake === 0 ? 'ui.options.shake_off' : settings.shake < 1 ? 'ui.options.shake_gentle' : 'ui.options.shake_full'),
      change: (d) => (settings.shake = cycle([0, 0.5, 1], settings.shake, d)),
    },
    {
      label: 'ui.options.reduce_flashing',
      value: () => onOff(settings.reduceFlashing),
      change: () => (settings.reduceFlashing = !settings.reduceFlashing),
      note: 'ui.options.reduce_flashing_note',
    },
    {
      label: 'ui.options.timer_assist',
      value: () => t({ 1: 'ui.options.timer_standard', 1.5: 'ui.options.timer_generous', 2: 'ui.options.timer_relaxed' }[settings.timerAssist]),
      change: (d) => (settings.timerAssist = cycle([1, 1.5, 2] as const, settings.timerAssist, d)),
      note: 'ui.options.timer_assist_note',
    },
    {
      label: 'ui.options.litany_key',
      value: () => onOff(settings.litanyKey),
      change: () => (settings.litanyKey = !settings.litanyKey),
      note: 'ui.options.litany_key_note',
    },
    {
      label: 'ui.options.render_scale',
      value: () => (settings.renderScale >= 1 ? t('ui.options.render_native') : `${Math.round(settings.renderScale * 100)}%`),
      change: (d) => (settings.renderScale = cycle([0.5, 0.67, 0.75, 0.85, 1], settings.renderScale, d)),
      note: 'ui.options.render_scale_note',
    },
    {
      label: 'ui.options.frame_limit',
      value: () => (settings.frameCap ? `${settings.frameCap} fps` : t('ui.options.frame_display')),
      change: (d) => (settings.frameCap = cycle([0, 30, 40, 60, 90, 120, 144], settings.frameCap, d)),
    },
    {
      label: 'ui.options.fullscreen',
      value: () => onOff(!!document.fullscreenElement),
      change: () => {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen().catch(() => undefined);
      },
    },
    {
      label: 'ui.options.language',
      value: () => localeInfo(getLocale())?.name ?? getLocale(),
      change: (d) => void cycleLanguage(d, getLocale()),
      note: 'ui.options.language_note',
    },
  ];
  private hover = -1;

  constructor(
    private onBack: () => void,
    /** true: chapel backdrop; false: plain screen; 'overlay': drawn over the live scene beneath (scene stack). */
    private overWorld: boolean | 'overlay' = true,
  ) {
    this.overlay = overWorld === 'overlay';
  }

  readonly overlay: boolean;

  private rowRect(i: number) {
    return { x: 300, y: 140 + i * 50, w: 680, h: 44 };
  }

  update(_dt: number, game: Game): void {
    const { input } = game;
    this.hover = this.rows.findIndex((_, i) => inRect(input.pos, this.rowRect(i)));
    if (input.pressed && this.hover >= 0) {
      const r = this.rowRect(this.hover);
      this.rows[this.hover].change(input.pos.x < r.x + r.w * 0.55 ? -1 : 1, game);
      saveSettings();
    }
    if (input.keyPressed('Escape')) this.back();
  }

  private back(): void {
    saveSettings();
    this.onBack();
  }

  render(g: Gfx, game: Game): void {
    if (this.overlay) {
      const vr = g.viewRect();
      g.rect(vr.x, vr.y, vr.w, vr.h, hex('#000000', 0.55));
    } else if (this.overWorld) {
      g.beginWorld();
      drawBackdrop(g, 'chapel', g.time);
      g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 1 });
    } else g.beginScreen();
    panel(g, { x: 260, y: 50, w: 760, h: 630 });
    g.text(t('ui.options.title'), VIEW_W / 2, 120, { size: 52, font: 'display', color: hex(PALETTE.ink), align: 'center' });
    this.rows.forEach((row, i) => {
      const r = this.rowRect(i);
      const hover = i === this.hover;
      if (hover) g.rect(r.x, r.y, r.w, r.h, hex(PALETTE.blood, 0.28));
      g.text(t(row.label), r.x + 20, r.y + 31, { size: 24, color: hex(hover ? PALETTE.gold : PALETTE.ink) });
      g.text(`‹  ${row.value()}  ›`, r.x + r.w - 20, r.y + 31, { size: 24, color: hex(PALETTE.gold), align: 'right' });
    });
    const note = this.hover >= 0 ? this.rows[this.hover].note : undefined;
    if (note) g.text(t(note), VIEW_W / 2, 612, { size: 18, font: 'italic', color: hex(PALETTE.inkDim), align: 'center' });
    if (button(g, game.input, t('ui.common.back'), VIEW_W / 2, 660, 28)) this.back();
    reticle(g, game.input.pos);
    g.endFrame();
  }
}
