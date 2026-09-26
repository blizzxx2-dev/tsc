/**
 * Audio latency calibration (INP-0111): a bell tolls eight times on a steady beat; click on each toll
 * as you hear it. The median lateness becomes the audio offset the rhythmic gimmicks allow for.
 */
import { settings, saveSettings } from '../core/settings';
import type { Game, Scene } from '../core/scene';
import { t } from '../i18n';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { latencyFromTaps } from '../surgery/timing';
import { divider, giltText, UI } from '../ui/ornaments';
import { VIEW_W } from '../ui/layout';
import { button, reticle } from '../ui/widgets';

const BEAT = 0.8;
const TOLLS = 10;
/** The first two tolls set the beat; taps count from the third. */
const LEAD = 2;

export class CalibrateAudioScene implements Scene {
  private t = -1;
  private tolled = 0;
  private readonly beats: number[] = [];
  private readonly taps: number[] = [];
  private result: number | null = null;

  constructor(private onDone: () => void) {}

  update(dt: number, game: Game): void {
    const input = game.input;
    if (input.actPressed('ui.back')) return this.onDone();
    if (this.result !== null) return;
    this.t += dt;
    if (this.t >= 0 && this.tolled < TOLLS && this.t >= this.tolled * BEAT) {
      game.audio.play('bell');
      this.beats.push(this.tolled * BEAT);
      this.tolled++;
    }
    if (input.pressed && this.tolled > LEAD) this.taps.push(this.t);
    if (this.tolled >= TOLLS && this.t > TOLLS * BEAT) this.result = latencyFromTaps(this.taps, this.beats.slice(LEAD));
  }

  render(g: Gfx, game: Game): void {
    g.rect(0, 0, VIEW_W, 720, hex('#0b0806'));
    giltText(g, t('ui.calibrate_audio.title'), VIEW_W / 2, 150, { size: 40, align: 'center' });
    divider(g, VIEW_W / 2, 176, 360);
    g.text(t('ui.calibrate_audio.help'), VIEW_W / 2, 230, { size: 19, color: hex(UI.parch), align: 'center' });
    // The bell: it swings on every toll.
    const since = this.t - Math.max(0, this.tolled - 1) * BEAT;
    const k = this.tolled > 0 && this.result === null ? Math.max(0, 1 - since / 0.3) : 0;
    g.glow(VIEW_W / 2, 360, 60 + k * 50, hex('#ffd080', 0.15 + k * 0.5));
    g.circle(VIEW_W / 2, 360, 34, hex('#c8a060'));
    g.text(t('ui.calibrate_audio.taps', { n: this.taps.length }), VIEW_W / 2, 460, { size: 18, font: 'italic', color: hex(UI.parchLo), align: 'center' });
    if (this.result !== null) {
      g.text(t('ui.calibrate_audio.result', { ms: this.result }), VIEW_W / 2, 510, { size: 20, color: hex(UI.gilt), align: 'center' });
      if (button(g, game.input, t('ui.calibrate_audio.keep'), VIEW_W / 2 - 130, 600, 24)) {
        settings.audioOffset = this.result;
        saveSettings();
        this.onDone();
      }
      if (button(g, game.input, t('ui.calibrate_audio.again'), VIEW_W / 2 + 130, 600, 24)) {
        this.t = -1;
        this.tolled = 0;
        this.beats.length = 0;
        this.taps.length = 0;
        this.result = null;
      }
    }
    reticle(g, game.input.pos);
    g.endFrame();
  }
}
