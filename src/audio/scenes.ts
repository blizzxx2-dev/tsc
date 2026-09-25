/**
 * Scene audio director: each frame it looks at the active scene and sets the
 * music state, location ambience and mix snapshot, and voices scene-specific
 * moments (VN page turns and portraits, chapter fanfares, briefing parchment
 * and scrub-in, results tally, seal and new-best flourish).
 */
import type { Input } from '../core/input';
import type { Scene } from '../core/scene';
import type { Gfx } from '../render/gfx';
import { settings } from '../core/settings';
import { CAMPAIGN } from '../content/campaign';
import { CAST, type CharacterId } from '../content/characters';
import type { StoryDef } from '../content/story';
import { BriefingScene } from '../scenes/briefing';
import { DemoEndScene } from '../scenes/demoend';
import { OperationScene } from '../scenes/operation';
import { OptionsScene } from '../scenes/options';
import { ResultsScene } from '../scenes/results';
import { StoryScene } from '../scenes/story';
import { TitleScene } from '../scenes/title';
import type { Operation } from '../surgery/operation';
import { ambienceFor } from './ambience';
import { drawSoundCues, drawVisualHeartbeat } from './captions-view';
import { drawAudioDebug } from './debug-overlay';
import { AudioOptionsScene } from './options-scene';
import type { LoopHandle } from './engine';
import type { MusicState } from './music/state';
import type { AudioSystem, SceneKind } from './system';
import { uiFrame } from './ui-hooks';

const peek = <T>(o: object, k: string): T => (o as Record<string, unknown>)[k] as T;

export type StoryMood = 'story-calm' | 'story-tense' | 'story-sorrow';

/** Per-story overrides where the heuristic would pick the wrong mood. */
export const STORY_MOOD: Record<string, StoryMood> = {};

/** Mood from the script: the Inquisitor or the Choir → tense; death and grief → sorrow; else the calm hospice theme. */
export function storyMood(story: StoryDef): StoryMood {
  if (STORY_MOOD[story.id]) return STORY_MOOD[story.id];
  const menace = story.lines.filter((l) => l.who === 'stroh' || l.who === 'choir').length;
  const grief = story.lines.filter((l) => /\b(dead|died|dying|grave|buried|mourn\w*|corpse|funeral|widow\w*)\b/i.test(l.text)).length;
  if (menace >= 2 || story.backdrop === 'night') return 'story-tense';
  if (grief >= 2) return 'story-sorrow';
  return 'story-calm';
}

/** Chapter number (1-based) whose first step is this story, if any. */
export function chapterOpening(storyId: string): number | null {
  const i = CAMPAIGN.findIndex((c) => c.steps[0]?.kind === 'story' && c.steps[0].story.id === storyId);
  return i >= 0 ? i + 1 : null;
}

const RANK_INDEX: Record<string, number> = { XS: 0, S: 1, A: 2, B: 3, C: 4 };

export function kindOf(scene: Scene | null): SceneKind {
  if (scene instanceof OperationScene) return 'operation';
  if (scene instanceof StoryScene) return 'story';
  if (scene instanceof BriefingScene) return 'briefing';
  if (scene instanceof ResultsScene) return 'results';
  if (scene instanceof TitleScene) return 'title';
  if (scene instanceof OptionsScene || scene instanceof AudioOptionsScene) return 'options';
  if (scene instanceof DemoEndScene) return 'demoend';
  return 'none';
}

export class SceneAudio {
  private scene: Scene | null = null;
  private prevKind: SceneKind = 'none';
  private t = 0;
  // Story
  private line = -1;
  private who: CharacterId | null = null;
  private shown = 0;
  private backdrop = '';
  // Briefing
  private quill: LoopHandle | null = null;
  // Results
  private rows = 0;
  private roll: LoopHandle | null = null;
  private sealed = false;
  private best = false;

  /** F6 debug overlay. */
  debug = false;

  constructor(private sys: AudioSystem) {}

  /** Per frame, after the scene's update. */
  frame(scene: Scene | null, dt: number, input?: Input): void {
    uiFrame();
    if (scene !== this.scene) this.enter(scene);
    this.t += dt;
    const kind = this.sys.kind;
    if (kind === 'operation' && scene && input) this.operation(scene as OperationScene, dt, input);
    else if (kind === 'story' && scene) this.story(scene as StoryScene);
    else if (kind === 'briefing') {
      if (this.quill && this.t > 1.3) {
        this.sys.engine.stopLoop(this.quill, 150);
        this.quill = null;
      }
    } else if (kind === 'results' && scene) this.results(scene as ResultsScene);
    this.sys.update(dt);
  }

  private enter(scene: Scene | null): void {
    const sys = this.sys;
    const snaps = sys.engine.snapshots;
    const prev = this.prevKind;
    this.scene = scene;
    this.t = 0;
    const kind = kindOf(scene);
    sys.kind = kind;
    this.prevKind = kind;
    for (const s of ['menu', 'vn', 'results'] as const) snaps.pop(s);
    sys.engine.stopLoop(this.quill, 100);
    sys.engine.stopLoop(this.roll, 100);
    this.quill = this.roll = null;
    sys.engine.captions.clear();
    const setMusic = (s: MusicState, info = {}) => sys.music.setState(s, info);
    switch (kind) {
      case 'title':
        sys.op.end();
        snaps.push('menu');
        setMusic('title');
        sys.amb.set('night');
        break;
      case 'options':
        // Opened from the pause menu the operation stays paused underneath; otherwise it's a menu.
        if (prev !== 'operation') snaps.push('menu');
        break;
      case 'story': {
        sys.op.end();
        snaps.push('vn');
        const story = peek<StoryDef>(scene!, 'story');
        setMusic(storyMood(story));
        sys.amb.set(ambienceFor(story.backdrop));
        this.backdrop = story.backdrop;
        this.line = -1;
        this.who = null;
        const ch = chapterOpening(story.id);
        if (ch) sys.music.stinger(ch === 1 ? 'chapter1' : 'chapter2');
        sys.play(prev === 'story' ? 'ui.vn.whoosh' : 'ui.vn.pageTurn');
        break;
      }
      case 'briefing': {
        sys.op.end();
        snaps.push('menu');
        setMusic('briefing');
        sys.amb.set('theatre');
        sys.play('ui.brief.unroll');
        this.quill = sys.engine.startLoop('loop.brief.quill', {}, { fadeIn: 0.2 });
        break;
      }
      case 'operation': {
        if (prev === 'options') break; // back from the pause menu
        sys.play('ui.brief.scrubIn');
        sys.music.stinger('scrubIn');
        const op = peek<Operation>(scene!, 'op');
        sys.opBank = op.def.id;
        break;
      }
      case 'results': {
        sys.op.end();
        snaps.push('results');
        const won = peek<boolean>(scene!, 'won');
        setMusic('results', { won });
        sys.play('ui.save');
        this.rows = 0;
        this.sealed = false;
        this.best = false;
        break;
      }
      case 'demoend':
        sys.op.end();
        snaps.push('menu');
        setMusic('demo-end');
        sys.amb.set('night');
        break;
      case 'none':
        break;
    }
    sys.loadBanks();
  }

  /** Feed the operation director: the sim, the ECG phase and the pointer. */
  private operation(scene: OperationScene, dt: number, input: Input): void {
    const op = scene.op;
    const bpm = op.status === 'lost' ? 0 : 58 + (99 - op.vitals) * 0.9;
    this.sys.op.frame({
      op,
      dt,
      paused: peek<boolean>(scene, 'paused'),
      beatPhase: peek<number>(scene, 'beatPhase'),
      bpm,
      input: { pos: input.pos, down: input.down, pressed: input.pressed, released: input.released, rightDown: input.rightDown },
      keyPressed: (c) => input.keyPressed(c),
    });
  }

  /** Screen-space overlays after the scene has drawn: captions, subtitles, visual heartbeat, debug. */
  overlay(g: Gfx): void {
    const sys = this.sys;
    if (sys.kind === 'operation') drawVisualHeartbeat(g, sys.op.visualBeat, settings.reduceFlashing ? 0.5 : 1);
    drawSoundCues(g, sys, sys.kind === 'operation' ? 640 : sys.kind === 'story' ? 470 : 690);
    if (this.debug) drawAudioDebug(g, sys);
    g.endFrame();
  }

  private story(scene: StoryScene): void {
    const sys = this.sys;
    const i = peek<number>(scene, 'i');
    const story = peek<StoryDef>(scene, 'story');
    const line = story.lines[i];
    if (!line) return;
    if (i !== this.line) {
      if (line.who !== this.who && CAST[line.who].silhouette !== 'none' && this.line >= 0) sys.play('ui.vn.portrait');
      this.line = i;
      this.who = line.who;
      this.shown = 0;
      // Voiced when a recording exists (subtitled); otherwise the text box carries it.
      if (line.who !== 'narrator') sys.vo.line(line.text, 0, false, line.as ?? CAST[line.who].name, CAST[line.who].color);
    }
    if (story.backdrop !== this.backdrop) {
      this.backdrop = story.backdrop;
      sys.play('ui.vn.whoosh');
      sys.amb.set(ambienceFor(story.backdrop));
    }
    // Optional per-character typewriter blips.
    const shown = Math.floor(peek<number>(scene, 'shown'));
    if (sys.engine.prefs.textBlips && line.who !== 'narrator' && shown > this.shown && shown <= line.text.length) {
      if (Math.floor(shown / 3) > Math.floor(this.shown / 3)) sys.play('ui.vn.blip', { params: { f0: BLIP_F0[line.who] ?? 160 } });
    }
    this.shown = Math.max(this.shown, shown);
  }

  private results(scene: ResultsScene): void {
    const sys = this.sys;
    const t = this.t;
    const won = peek<boolean>(scene, 'won');
    const rows = Math.min(7, Math.floor(t * 7));
    if (rows > this.rows) {
      sys.play('ui.results.tally');
      this.rows = rows;
    }
    if (t > 1.0 && t < 1.25 && !this.roll) this.roll = sys.engine.startLoop('loop.results.roll');
    if (t >= 1.25 && this.roll) {
      sys.engine.stopLoop(this.roll, 60);
      this.roll = null;
      sys.play('ui.results.tally');
    }
    if (won && !this.sealed && t > 1.9) {
      this.sealed = true;
      const op = peek<Operation>(scene, 'op');
      const rank = RANK_INDEX[op.rank()] ?? 2;
      sys.play('ui.results.seal', { params: { rank } });
      sys.music.stinger('rank', rank);
    }
    if (won && !this.best && t > 2.3 && peek<boolean>(scene, 'newBest')) {
      this.best = true;
      sys.play('ui.results.best');
    }
  }
}

const BLIP_F0: Partial<Record<CharacterId, number>> = { kreuzer: 120, ilse: 220, haller: 105, stroh: 95, mauer: 110, patient: 150, choir: 180 };
