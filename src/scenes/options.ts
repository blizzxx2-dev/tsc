import type { Game, Scene } from '../core/scene';
import { saveSettings, settings } from '../core/settings';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { PALETTE, VIEW_W } from '../ui/layout';
import { button, inRect, panel, reticle } from '../ui/widgets';
import { drawBackdrop } from './backdrop';
import { bindings } from '../input/bindings';
import { ControlsScene } from '../input/controlsScene';
import { glyphFor } from '../input/glyphs';
import { litanyMode } from '../input/opinput';

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
      label: 'Assist: Litany input',
      value: () => ({ draw: 'Draw the star', key: `${glyphFor('litany.key', 'kbm')} key`, both: 'Either' })[litanyMode()],
      change: (d) => {
        bindings.prefs.litanyInput = cycle(['draw', 'key', 'both'] as const, litanyMode(), d);
        settings.litanyKey = bindings.prefs.litanyInput !== 'draw';
        bindings.save();
      },
      note: 'Speak the Litany with a key instead of drawing the five-pointed star.',
    },
    {
      label: 'Render scale',
      value: () => (settings.renderScale >= 1 ? 'Native' : `${Math.round(settings.renderScale * 100)}%`),
      change: (d) => (settings.renderScale = cycle([0.5, 0.67, 0.75, 0.85, 1], settings.renderScale, d)),
      note: 'Resolution of the operating field; lettering always stays sharp.',
    },
    {
      label: 'Frame limit',
      value: () => (settings.frameCap ? `${settings.frameCap} fps` : 'Display'),
      change: (d) => (settings.frameCap = cycle([0, 30, 40, 60, 90, 120, 144], settings.frameCap, d)),
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
    if (input.actPressed('ui.back')) this.back();
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
    g.text('Options', VIEW_W / 2, 120, { size: 52, font: 'display', color: hex(PALETTE.ink), align: 'center' });
    this.rows.forEach((row, i) => {
      const r = this.rowRect(i);
      const hover = i === this.hover;
      if (hover) g.rect(r.x, r.y, r.w, r.h, hex(PALETTE.blood, 0.28));
      g.text(row.label, r.x + 20, r.y + 31, { size: 24, color: hex(hover ? PALETTE.gold : PALETTE.ink) });
      g.text(`‹  ${row.value()}  ›`, r.x + r.w - 20, r.y + 31, { size: 24, color: hex(PALETTE.gold), align: 'right' });
    });
    const note = this.hover >= 0 ? this.rows[this.hover].note : undefined;
    if (note) g.text(note, VIEW_W / 2, 612, { size: 18, font: 'italic', color: hex(PALETTE.inkDim), align: 'center' });
    if (button(g, game.input, 'Back', VIEW_W / 2, 660, 28)) this.back();
    if (button(g, game.input, 'Controls', VIEW_W / 2 - 230, 660, 28)) {
      if (game.push && game.pop) game.push(new ControlsScene(() => game.pop!(), 'overlay'));
      else game.go(new ControlsScene(() => game.go(this), this.overWorld));
    }
    reticle(g, game.input.pos);
    g.endFrame();
  }
}
