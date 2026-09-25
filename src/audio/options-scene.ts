import { t as tr } from '../i18n';
/**
 * Audio options: volumes per bus (with a test sound), mono/balance, dynamic
 * range, focus muting, output device, comfort toggles and captions/subtitles.
 * Opened from the Options screen; preferences persist in their own store.
 */
import { diamond, heading, hglow, INK, meter, rule } from '../ui/hudKit';
import { arrow } from '../ui/controls';
import type { Game, Scene } from '../core/scene';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { VIEW_W } from '../ui/layout';
import { button, inRect, panel, reticle } from '../ui/widgets';
import { drawBackdrop } from '../scenes/backdrop';
import { AudioEngine } from './engine';
import type { AudioPrefs, DynamicRange, HeartbeatMode, SubtitleSize } from './prefs';
import type { AudioSystem } from './system';

interface Row {
  label: string;
  value: () => string;
  /** Sliders: the fill 0..1 (drawn as a meter instead of a stepper). */
  frac?: () => number;
  change: (dir: number) => void;
  note?: string;
  /** Played after a change (test sound). */
  test?: () => void;
}

const cycle = <T,>(list: readonly T[], cur: T, dir: number): T => list[(list.indexOf(cur) + dir + list.length) % list.length];
const onOff = (b: boolean) => (b ? tr('ui.common.on') : tr('ui.common.off'));
const TABS = ['Volume', 'Mix', 'Comfort', 'Captions'] as const;
type Tab = (typeof TABS)[number];

export class AudioOptionsScene implements Scene {
  private tab: Tab = 'Volume';
  private hover = -1;
  private devices: { id: string; label: string }[] = [];

  constructor(
    private onBack: () => void,
    private overWorld = true,
  ) {
    void this.listDevices();
  }

  private async listDevices(): Promise<void> {
    if (!AudioEngine.sinkSupported() || !navigator.mediaDevices?.enumerateDevices) return;
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      this.devices = [{ id: '', label: tr('snd.system_default') }, ...list.filter((d) => d.kind === 'audiooutput' && d.deviceId !== 'default').map((d, i) => ({ id: d.deviceId, label: d.label || tr('snd.output_n', { n: i + 1 }) }))];
    } catch {
      this.devices = [];
    }
  }

  private rows(sys: AudioSystem): Row[] {
    const p: AudioPrefs = sys.engine.prefs;
    const vol = (label: string, key: 'master' | 'music' | 'sfx' | 'voice' | 'ambience' | 'ui', test: () => void, note?: string): Row => ({
      label,
      value: () => `${p[key]}`,
      frac: () => p[key] / 100,
      change: (d) => (p[key] = Math.max(0, Math.min(100, p[key] + d * 5))),
      test,
      note,
    });
    switch (this.tab) {
      case 'Volume':
        return [
          vol(tr('snd.master'), 'master', () => sys.play('sfx.rate.cool')),
          vol(tr('snd.music'), 'music', () => sys.music.stinger('phaseClear')),
          vol(tr('snd.sound_effects'), 'sfx', () => sys.play('sfx.extract.arrow')),
          vol(tr('snd.voice'), 'voice', () => sys.play('sfx.patient.relief'), tr('snd.sister_ilse_and_the_cast_when_vo')),
          vol(tr('snd.ambience'), 'ambience', () => sys.play('amb.bell')),
          vol(tr('snd.interface'), 'ui', () => sys.play('ui.confirm')),
          { label: tr('snd.sound'), value: () => onOff(!p.muted), change: () => (p.muted = !p.muted) },
        ];
      case 'Mix':
        return [
          { label: tr('snd.mono'), value: () => onOff(p.mono), change: () => (p.mono = !p.mono), note: tr('snd.folds_stereo_to_one_channel_posi'), test: () => sys.play('amb.dog', { pan: -0.8 }) },
          {
            label: tr('snd.balance'),
            value: () => (p.balance === 0 ? tr('snd.centre') : p.balance < 0 ? tr('snd.balance_l', { n: -p.balance }) : tr('snd.balance_r', { n: p.balance })),
            change: (d) => (p.balance = Math.max(-100, Math.min(100, p.balance + d * 10))),
            test: () => sys.play('ui.confirm'),
          },
          {
            label: tr('snd.dynamic_range'),
            value: () => ({ full: tr('snd.full'), reduced: tr('snd.reduced'), night: tr('snd.night') })[p.dynamicRange],
            change: (d) => (p.dynamicRange = cycle<DynamicRange>(['full', 'reduced', 'night'], p.dynamicRange, d)),
            note: tr('snd.reduced_and_night_compress_loud_'),
          },
          { label: tr('snd.mute_when_unfocused'), value: () => onOff(p.muteUnfocused), change: () => (p.muteUnfocused = !p.muteUnfocused) },
          ...(this.devices.length > 1
            ? [
                {
                  label: tr('snd.output_device'),
                  value: () => (this.devices.find((x) => x.id === p.sinkId)?.label ?? tr('snd.system_default')).slice(0, 28),
                  change: (d: number) => {
                    p.sinkId = cycle(this.devices.map((x) => x.id), p.sinkId, d);
                    void sys.engine.setSink(p.sinkId).then((ok) => ok || sys.play('ui.error'));
                  },
                  test: () => sys.play('ui.confirm'),
                },
              ]
            : []),
        ];
      case 'Comfort':
        return [
          {
            label: tr('snd.heartbeat'),
            value: () => ({ always: tr('snd.always'), low: tr('snd.low_vitals_only'), off: tr('snd.off') })[p.heartbeat],
            change: (d) => (p.heartbeat = cycle<HeartbeatMode>(['always', 'low', 'off'], p.heartbeat, d)),
            note: tr('snd.when_off_the_screen_edge_pulses_'),
            test: () => sys.play('sfx.heart.beat', { params: { strength: 0.6, muffle: 0, gap: 0.16 } }),
          },
          { label: tr('snd.pulse_tick'), value: () => onOff(p.pulseTick), change: () => (p.pulseTick = !p.pulseTick), note: 'A small glass tick on every beat (always heard below 30 vitals).', test: () => sys.play('sfx.heart.pulseTick') },
          { label: tr('snd.patient_vocalisations'), value: () => onOff(p.patientVox), change: () => (p.patientVox = !p.patientVox), test: () => p.patientVox && sys.play('sfx.patient.moan') },
          { label: tr('snd.reduce_audio_stress'), value: () => onOff(p.reduceStress), change: () => (p.reduceStress = !p.reduceStress), note: tr('snd.no_tinnitus_or_muffling_at_low_v') },
          { label: tr('snd.clock_ticks'), value: () => (p.timerTicksEarly ? tr('snd.from_30_s') : tr('snd.last_10_s')), change: () => (p.timerTicksEarly = !p.timerTicksEarly), test: () => sys.play('sfx.timer.tick') },
          { label: tr('snd.story_text_blips'), value: () => onOff(p.textBlips), change: () => (p.textBlips = !p.textBlips), test: () => sys.play('ui.vn.blip', { params: { f0: 220 } }) },
        ];
      case 'Captions':
        return [
          { label: tr('snd.sound_captions'), value: () => onOff(p.captions), change: () => (p.captions = !p.captions), note: tr('snd.describes_important_sounds_with_') },
          { label: tr('snd.subtitles'), value: () => onOff(p.subtitles), change: () => (p.subtitles = !p.subtitles), note: tr('snd.subtitles_for_voiced_lines') },
          { label: tr('snd.text_size'), value: () => p.subtitleSize, change: (d) => (p.subtitleSize = cycle<SubtitleSize>(['S', 'M', 'L', 'XL'], p.subtitleSize, d)) },
          { label: tr('snd.background'), value: () => `${p.subtitleBg}%`, change: (d) => (p.subtitleBg = Math.max(0, Math.min(100, p.subtitleBg + d * 10))) },
        ];
    }
  }

  private rowRect(i: number) {
    return { x: 300, y: 196 + i * 56, w: 680, h: 48 };
  }

  private tabRect(i: number) {
    return { x: 300 + i * 170, y: 132, w: 170, h: 40 };
  }

  update(_dt: number, game: Game): void {
    const { input } = game;
    const sys = game.audio as AudioSystem;
    const rows = this.rows(sys);
    this.hover = rows.findIndex((_, i) => inRect(input.pos, this.rowRect(i)));
    if (input.pressed) {
      const t = TABS.findIndex((_, i) => inRect(input.pos, this.tabRect(i)));
      if (t >= 0 && TABS[t] !== this.tab) {
        this.tab = TABS[t];
        sys.play('ui.tab');
      } else if (this.hover >= 0) {
        const r = this.rowRect(this.hover);
        const row = rows[this.hover];
        const was = row.value();
        row.change(input.pos.x < r.x + r.w * 0.55 ? -1 : 1);
        sys.commitPrefs();
        sys.play(was === tr('ui.common.on') || was === tr('ui.common.off') ? 'ui.toggle' : 'ui.slider');
        row.test?.();
      }
    }
    if (input.actPressed('ui.tabNext')) {
      this.tab = cycle(TABS, this.tab, 1);
      sys.play('ui.tab');
    }
    if (input.actPressed('ui.back')) this.back(sys);
  }

  private back(sys: AudioSystem): void {
    sys.commitPrefs();
    this.onBack();
  }

  render(g: Gfx, game: Game): void {
    const sys = game.audio as AudioSystem;
    if (this.overWorld) {
      g.beginWorld();
      drawBackdrop(g, 'chapel', g.time);
      g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 1 });
    } else g.beginScreen();
    panel(g, { x: 260, y: 30, w: 760, h: 660 });
    heading(g, tr('snd.title'), VIEW_W / 2, 90, 380, 1, 30);
    TABS.forEach((t, i) => {
      const r = this.tabRect(i);
      const on = t === this.tab;
      if (on) {
        hglow(g, r, hex('#7a5626', 0.3));
        rule(g, r.x + r.w / 2, r.y + r.h - 2, r.w * 0.9, hex(INK.gold, 0.95), 2);
      }
      g.text(tr(`snd.tab.${t.toLowerCase()}`).toUpperCase(), r.x + r.w / 2, r.y + 27, { size: 13, font: 'display', tracking: 0.14, color: hex(on ? INK.goldHi : INK.dim), align: 'center', shadow: hex('#000000', 0.8) });
    });
    const rows = this.rows(sys);
    rows.forEach((row, i) => {
      const r = this.rowRect(i);
      const hover = i === this.hover;
      if (hover) {
        hglow(g, { x: r.x - 40, y: r.y + 2, w: r.w + 80, h: r.h - 4 }, hex('#7a5626', 0.26));
        g.rect(r.x, r.y + 8, 2, r.h - 16, hex(INK.gold, 0.95));
      }
      g.text(row.label, r.x + 20, r.y + 31, { size: 20, color: hex(hover ? '#fff4dc' : '#d8ccb4'), shadow: hex('#000000', 0.7) });
      const vy = r.y + r.h / 2;
      if (row.frac) {
        const tr0 = { x: r.x + r.w - 300, y: vy - 3, w: 220, h: 6 };
        const f = row.frac();
        meter(g, tr0, f, INK.goldHi, INK.goldLo, 10);
        diamond(g, tr0.x + tr0.w * f, vy, 7, hex(hover ? INK.goldHi : INK.gold), hex('#000000', 0.8));
        g.text(row.value(), r.x + r.w - 20, vy + 5, { size: 14, font: 'display', tracking: 0.08, color: hex(INK.gold), align: 'right', shadow: hex('#000000', 0.8) });
      } else {
        g.text(row.value().toUpperCase(), r.x + r.w - 44, vy + 5, { size: 13, font: 'display', tracking: 0.12, color: hex(INK.gold), align: 'right', shadow: hex('#000000', 0.8) });
        arrow(g, r.x + r.w - 26, vy, 1, 7, hex(INK.gold, hover ? 1 : 0.5));
      }
      g.rect(r.x + 10, r.y + r.h - 1, r.w - 20, 1, hex(INK.gilt, 0.1));
    });
    const note = this.hover >= 0 ? rows[this.hover]?.note : undefined;
    if (note) g.text(note, VIEW_W / 2, 612, { size: 17, font: 'italic', color: hex(INK.dim), align: 'center', shadow: false });
    if (button(g, game.input, tr('ui.common.back'), VIEW_W / 2, 662, 28)) this.back(sys);
    reticle(g, game.input.pos);
    g.endFrame();
  }
}
