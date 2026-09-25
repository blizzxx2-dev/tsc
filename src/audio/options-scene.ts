/**
 * Audio options: volumes per bus (with a test sound), mono/balance, dynamic
 * range, focus muting, output device, comfort toggles and captions/subtitles.
 * Opened from the Options screen; preferences persist in their own store.
 */
import type { Game, Scene } from '../core/scene';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { PALETTE, VIEW_W } from '../ui/layout';
import { button, inRect, panel, reticle } from '../ui/widgets';
import { drawBackdrop } from '../scenes/backdrop';
import { AudioEngine } from './engine';
import type { AudioPrefs, DynamicRange, HeartbeatMode, SubtitleSize } from './prefs';
import type { AudioSystem } from './system';

interface Row {
  label: string;
  value: () => string;
  change: (dir: number) => void;
  note?: string;
  /** Played after a change (test sound). */
  test?: () => void;
}

const cycle = <T,>(list: readonly T[], cur: T, dir: number): T => list[(list.indexOf(cur) + dir + list.length) % list.length];
const onOff = (b: boolean) => (b ? 'On' : 'Off');
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
      this.devices = [{ id: '', label: 'System default' }, ...list.filter((d) => d.kind === 'audiooutput' && d.deviceId !== 'default').map((d, i) => ({ id: d.deviceId, label: d.label || `Output ${i + 1}` }))];
    } catch {
      this.devices = [];
    }
  }

  private rows(sys: AudioSystem): Row[] {
    const p: AudioPrefs = sys.engine.prefs;
    const vol = (label: string, key: 'master' | 'music' | 'sfx' | 'voice' | 'ambience' | 'ui', test: () => void, note?: string): Row => ({
      label,
      value: () => `${p[key]}`,
      change: (d) => (p[key] = Math.max(0, Math.min(100, p[key] + d * 5))),
      test,
      note,
    });
    switch (this.tab) {
      case 'Volume':
        return [
          vol('Master', 'master', () => sys.play('sfx.rate.cool')),
          vol('Music', 'music', () => sys.music.stinger('phaseClear')),
          vol('Sound effects', 'sfx', () => sys.play('sfx.extract.arrow')),
          vol('Voice', 'voice', () => sys.play('sfx.patient.relief'), 'Sister Ilse and the cast, when voiced.'),
          vol('Ambience', 'ambience', () => sys.play('amb.bell')),
          vol('Interface', 'ui', () => sys.play('ui.confirm')),
          { label: 'Sound', value: () => onOff(!p.muted), change: () => (p.muted = !p.muted) },
        ];
      case 'Mix':
        return [
          { label: 'Mono', value: () => onOff(p.mono), change: () => (p.mono = !p.mono), note: 'Folds stereo to one channel; positional panning is disabled.', test: () => sys.play('amb.dog', { pan: -0.8 }) },
          {
            label: 'Balance',
            value: () => (p.balance === 0 ? 'Centre' : p.balance < 0 ? `L ${-p.balance}` : `R ${p.balance}`),
            change: (d) => (p.balance = Math.max(-100, Math.min(100, p.balance + d * 10))),
            test: () => sys.play('ui.confirm'),
          },
          {
            label: 'Dynamic range',
            value: () => ({ full: 'Full', reduced: 'Reduced', night: 'Night' })[p.dynamicRange],
            change: (d) => (p.dynamicRange = cycle<DynamicRange>(['full', 'reduced', 'night'], p.dynamicRange, d)),
            note: 'Reduced and Night compress loud moments; Night also lifts voices.',
          },
          { label: 'Mute when unfocused', value: () => onOff(p.muteUnfocused), change: () => (p.muteUnfocused = !p.muteUnfocused) },
          ...(this.devices.length > 1
            ? [
                {
                  label: 'Output device',
                  value: () => (this.devices.find((x) => x.id === p.sinkId)?.label ?? 'System default').slice(0, 28),
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
            label: 'Heartbeat',
            value: () => ({ always: 'Always', low: 'Low vitals only', off: 'Off' })[p.heartbeat],
            change: (d) => (p.heartbeat = cycle<HeartbeatMode>(['always', 'low', 'off'], p.heartbeat, d)),
            note: 'When off, the screen edge pulses with each beat instead.',
            test: () => sys.play('sfx.heart.beat', { params: { strength: 0.6, muffle: 0, gap: 0.16 } }),
          },
          { label: 'Pulse tick', value: () => onOff(p.pulseTick), change: () => (p.pulseTick = !p.pulseTick), note: 'A small glass tick on every beat (always heard below 30 vitals).', test: () => sys.play('sfx.heart.pulseTick') },
          { label: 'Patient vocalisations', value: () => onOff(p.patientVox), change: () => (p.patientVox = !p.patientVox), test: () => p.patientVox && sys.play('sfx.patient.moan') },
          { label: 'Reduce audio stress', value: () => onOff(p.reduceStress), change: () => (p.reduceStress = !p.reduceStress), note: 'No tinnitus or muffling at low vitals; each alarm rings once.' },
          { label: 'Clock ticks', value: () => (p.timerTicksEarly ? 'From 30 s' : 'Last 10 s'), change: () => (p.timerTicksEarly = !p.timerTicksEarly), test: () => sys.play('sfx.timer.tick') },
          { label: 'Story text blips', value: () => onOff(p.textBlips), change: () => (p.textBlips = !p.textBlips), test: () => sys.play('ui.vn.blip', { params: { f0: 220 } }) },
        ];
      case 'Captions':
        return [
          { label: 'Sound captions', value: () => onOff(p.captions), change: () => (p.captions = !p.captions), note: 'Describes important sounds, with an arrow toward off-centre sources.' },
          { label: 'Subtitles', value: () => onOff(p.subtitles), change: () => (p.subtitles = !p.subtitles), note: 'Subtitles for voiced lines.' },
          { label: 'Text size', value: () => p.subtitleSize, change: (d) => (p.subtitleSize = cycle<SubtitleSize>(['S', 'M', 'L', 'XL'], p.subtitleSize, d)) },
          { label: 'Background', value: () => `${p.subtitleBg}%`, change: (d) => (p.subtitleBg = Math.max(0, Math.min(100, p.subtitleBg + d * 10))) },
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
        sys.play(was === 'On' || was === 'Off' ? 'ui.toggle' : 'ui.slider');
        row.test?.();
      }
    }
    if (input.keyPressed('Tab')) {
      this.tab = cycle(TABS, this.tab, 1);
      sys.play('ui.tab');
    }
    if (input.keyPressed('Escape')) this.back(sys);
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
    g.text('Sound', VIEW_W / 2, 100, { size: 50, font: 'display', color: hex(PALETTE.ink), align: 'center' });
    TABS.forEach((t, i) => {
      const r = this.tabRect(i);
      const on = t === this.tab;
      if (on) g.rect(r.x + 8, r.y + r.h - 4, r.w - 16, 3, hex(PALETTE.gold, 0.8));
      g.text(t, r.x + r.w / 2, r.y + 28, { size: 22, color: hex(on ? PALETTE.gold : PALETTE.inkDim), align: 'center' });
    });
    const rows = this.rows(sys);
    rows.forEach((row, i) => {
      const r = this.rowRect(i);
      const hover = i === this.hover;
      if (hover) g.rect(r.x, r.y, r.w, r.h, hex(PALETTE.blood, 0.28));
      g.text(row.label, r.x + 20, r.y + 32, { size: 23, color: hex(hover ? PALETTE.gold : PALETTE.ink) });
      g.text(`‹  ${row.value()}  ›`, r.x + r.w - 20, r.y + 32, { size: 23, color: hex(PALETTE.gold), align: 'right' });
    });
    const note = this.hover >= 0 ? rows[this.hover]?.note : undefined;
    if (note) g.text(note, VIEW_W / 2, 612, { size: 18, font: 'italic', color: hex(PALETTE.inkDim), align: 'center' });
    if (button(g, game.input, 'Back', VIEW_W / 2, 662, 28)) this.back(sys);
    reticle(g, game.input.pos);
    g.endFrame();
  }
}
