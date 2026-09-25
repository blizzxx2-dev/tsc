/**
 * The game's audio system: engine + adaptive music + ambience + operation
 * director + voice-over. `game.audio` is an AudioSystem; scenes call
 * `play(id)` with event ids (legacy cue names still resolve), and the scene
 * director (scenes.ts) drives music state, ambience and snapshots per scene.
 */
import { banksFor } from './assets';
import { AmbienceManager } from './ambience';
import { OperationAudio } from './director';
import { AudioEngine, type ContextFactory, type PlayOpts } from './engine';
import { ALL_EVENTS, eventDef, type EventId } from './events';
import { MusicPlayer } from './music/player';
import { saveAudioPrefs } from './prefs';
import { VoiceOver } from './vo';

export type SceneKind = 'none' | 'title' | 'options' | 'story' | 'briefing' | 'operation' | 'results' | 'demoend';

export class AudioSystem {
  readonly engine: AudioEngine;
  readonly music: MusicPlayer;
  readonly amb: AmbienceManager;
  readonly op: OperationAudio;
  readonly vo: VoiceOver;
  kind: SceneKind = 'none';
  /** Extra bank for the current operation (per-operation / boss bank). */
  opBank: string | undefined;
  private started = false;

  constructor(factory: ContextFactory | null = null) {
    this.engine = new AudioEngine(factory);
    this.music = new MusicPlayer(this.engine);
    this.amb = new AmbienceManager(this.engine);
    this.vo = new VoiceOver(this.engine);
    this.op = new OperationAudio(this);
  }

  /** Browsers require a user gesture before audio can start. */
  unlock(): void {
    this.engine.unlock();
    if (!this.engine.ready || this.started) return;
    this.started = true;
    this.music.resume();
    void this.engine.assets.init().then(() => this.loadBanks());
    if (import.meta.env?.DEV) console.info('[audio] dev report', this.devReport());
  }

  /** Load the banks the current scene needs (and release the rest). */
  loadBanks(): void {
    const ctx = this.engine.ctx;
    if (!ctx) return;
    void this.engine.assets.require(ctx, banksFor(this.kind, this.opBank));
  }

  /** Play an event, resolving legacy scene cues by context. */
  play(id: EventId | string, o: PlayOpts = {}): void {
    let ev = id;
    if (id === 'select') ev = this.kind === 'story' ? 'ui.vn.advance' : this.kind === 'options' ? 'ui.slider' : 'ui.tab';
    else if ((id === 'squelch' || id === 'bell') && this.kind === 'results') return; // results seal and music carry these
    this.engine.play(ev, o);
  }

  get volume(): number {
    return this.engine.volume;
  }
  set volume(v: number) {
    this.engine.volume = v;
  }
  get muted(): boolean {
    return this.engine.muted;
  }
  set muted(m: boolean) {
    this.engine.muted = m;
  }

  /** Apply and persist audio preferences after an options change. */
  commitPrefs(): void {
    this.engine.applyPrefs();
    saveAudioPrefs();
  }

  update(dt: number): void {
    this.engine.update(dt);
    this.music.update();
    this.amb.update(dt);
  }

  /** Dev report: events still on the synthesised placeholder (no recording), and ids that fell back to the generic tick. */
  devReport(): { placeholder: string[]; fallbackIds: string[]; fallbackPlays: number; textOnlyVo: number } {
    const placeholder = ALL_EVENTS.filter((id) => !eventDef(id).alias && !(eventDef(id).assets ?? []).some((k) => this.engine.assets.entry(k)));
    return { placeholder, fallbackIds: [...this.engine.fallbackIds], fallbackPlays: this.engine.fallbackPlays, textOnlyVo: this.vo.textOnly.size };
  }
}
