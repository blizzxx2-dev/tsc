import type { Game, Scene } from '../core/scene';
import { saveSettings, settings } from '../core/settings';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { PALETTE, VIEW_W } from '../ui/layout';
import { button, inRect, panel, reticle } from '../ui/widgets';
import { drawBackdrop } from './backdrop';

interface Row {
  label: string;
  value: () => string;
  /** dir: -1 for left/previous, +1 for right/next. */
  change: (dir: number, game: Game) => void;
  note?: string;
}

const cycle = <T,>(list: readonly T[], cur: T, dir: number): T => list[(list.indexOf(cur) + dir + list.length) % list.length];

export class OptionsScene implements Scene {
  private rows: Row[] = [
    {
      label: 'Volume',
      value: () => `${Math.round(settings.volume * 100)}%`,
      change: (d, g) => {
        settings.volume = Math.max(0, Math.min(1, Math.round((settings.volume + d * 0.1) * 10) / 10));
        g.audio.volume = settings.volume;
        g.audio.play('select');
      },
    },
    {
      label: 'Sound',
      value: () => (settings.muted ? 'Off' : 'On'),
      change: (_d, g) => {
        settings.muted = !settings.muted;
        g.audio.muted = settings.muted;
      },
    },
    {
      label: 'Screen shake',
      value: () => (settings.shake === 0 ? 'Off' : settings.shake < 1 ? 'Gentle' : 'Full'),
      change: (d) => (settings.shake = cycle([0, 0.5, 1], settings.shake, d)),
    },
    {
      label: 'Reduce flashing',
      value: () => (settings.reduceFlashing ? 'On' : 'Off'),
      change: () => (settings.reduceFlashing = !settings.reduceFlashing),
      note: 'Softens the failing-vitals pulse and the Litany ripple.',
    },
    {
      label: 'Assist: time allowed',
      value: () => ({ 1: 'Standard', 1.5: 'Generous (×1.5)', 2: 'Relaxed (×2)' })[settings.timerAssist],
      change: (d) => (settings.timerAssist = cycle([1, 1.5, 2] as const, settings.timerAssist, d)),
      note: 'Assisted results are marked on the rank screen.',
    },
    {
      label: 'Assist: Litany on Space',
      value: () => (settings.litanyKey ? 'On' : 'Off'),
      change: () => (settings.litanyKey = !settings.litanyKey),
      note: 'Press Space instead of drawing the five-pointed star.',
    },
    {
      label: 'Fullscreen',
      value: () => (document.fullscreenElement ? 'On' : 'Off'),
      change: () => {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen().catch(() => undefined);
      },
    },
  ];
  private hover = -1;

  constructor(
    private onBack: () => void,
    private overWorld = true,
  ) {}

  private rowRect(i: number) {
    return { x: 300, y: 170 + i * 58, w: 680, h: 50 };
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
    if (this.overWorld) {
      g.beginWorld();
      drawBackdrop(g, 'chapel', g.time);
      g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 1 });
    } else g.beginScreen();
    panel(g, { x: 260, y: 50, w: 760, h: 630 });
    g.text('Options', VIEW_W / 2, 120, { size: 52, font: 'display', color: hex(PALETTE.ink), align: 'center' });
    this.rows.forEach((row, i) => {
      const r = this.rowRect(i);
      const hover = i === this.hover;
      if (hover) g.rect(r.x, r.y, r.w, r.h, hex(PALETTE.blood, 0.28));
      g.text(row.label, r.x + 20, r.y + 34, { size: 24, color: hex(hover ? PALETTE.gold : PALETTE.ink) });
      g.text(`‹  ${row.value()}  ›`, r.x + r.w - 20, r.y + 34, { size: 24, color: hex(PALETTE.gold), align: 'right' });
    });
    const note = this.hover >= 0 ? this.rows[this.hover].note : undefined;
    if (note) g.text(note, VIEW_W / 2, 590, { size: 18, font: 'italic', color: hex(PALETTE.inkDim), align: 'center' });
    if (button(g, game.input, 'Back', VIEW_W / 2, 645, 28)) this.back();
    reticle(g, game.input.pos);
    g.endFrame();
  }
}
