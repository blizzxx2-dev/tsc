/**
 * The stable automation API, `window.__game.debug` (QAT-0074). Smoke tests, E2E flows, the
 * console and the cheat menu all go through this instead of reaching into scene internals.
 * Versioned: bump DEBUG_API_VERSION on any breaking change and keep tests/e2e in step.
 * Only bundled in dev and QA builds (see ./hooks.ts); `vite build` (production) strips it.
 */
import { OPTION_TABS, optionRows } from '../scenes/options';
import { compileCatalog, shaderCatalog, type ShaderFailure } from '../render/shaderCatalog';
import { LoadingScene } from '../scenes/loading';
import type { Transition } from '../ui/transition';
import { CAMPAIGN, allOperations } from '../content/campaign';
import { SHOWCASE } from '../content/dev';
import type { StoryDef } from '../content/story';
import { store } from '../core/save';
import type { Game, Scene } from '../core/scene';
import { settings } from '../core/settings';
import { BriefingScene } from '../scenes/briefing';
import { DemoEndScene } from '../scenes/demoend';
import { playOperation, playStep, save } from '../scenes/flow';
import { OperationScene } from '../scenes/operation';
import { OperationsScene } from '../scenes/operations';
import { OptionsScene } from '../scenes/options';
import { ResultsScene } from '../scenes/results';
import { StoryScene } from '../scenes/story';
import { TitleScene } from '../scenes/title';
import { Incision } from '../surgery/entities';
import { MAX_VITALS, Operation, type OperationDef, type Status } from '../surgery/operation';
import { TOOL_INFO, type Pointer, type Rank, type ToolId } from '../surgery/types';
import { isPresetName, PRESET_NAMES, presetSave } from './presets';
import { opView, stateHash, type OpView } from './state';

export const DEBUG_API_VERSION = 1;

/** The concrete game object from main.ts (Game plus the active scene). */
export type DebugGame = Game & { scene: Scene | null; transition?: Transition };

export type SceneName = 'title' | 'story' | 'briefing' | 'operation' | 'results' | 'options' | 'operations' | 'demoend' | 'loading' | 'unknown';

export interface DebugState {
  version: number;
  scene: SceneName;
  frozen: boolean;
  paused: boolean;
  op: OpView | null;
  story: { id: string; line: number; lineCount: number; who: string; text: string } | null;
  save: { progress: { chapter: number; step: number }; best: Record<string, { rank: Rank; score: number }> };
  settings: Record<string, unknown>;
}

/** One frame of recorded input: pointer samples (with the tool held) and Litany invocations, in order. */
export type ReplayFrame = ({ kind: 'pointer'; tool: ToolId; ptr: Pointer; select: boolean } | { kind: 'litany' })[];

export interface StepOptions {
  dt?: number;
  /** Render: every frame, only the last (default) or none (sim + scene logic only). */
  render?: 'all' | 'last' | 'none';
}

interface InputInternals {
  pos: { x: number; y: number };
  path: { x: number; y: number }[];
  pressed: boolean;
  released: boolean;
  rightPressed: boolean;
  wheel: number;
  keysPressed: Set<string>;
  beginFrame(): void;
  beginStep(tEnd?: number, dt?: number): void;
  beginRender(): void;
  endFrame(): void;
}

export function sceneName(s: Scene | null): SceneName {
  if (s instanceof OperationScene) return 'operation';
  if (s instanceof StoryScene) return 'story';
  if (s instanceof BriefingScene) return 'briefing';
  if (s instanceof ResultsScene) return 'results';
  if (s instanceof TitleScene) return 'title';
  if (s instanceof OptionsScene) return 'options';
  if (s instanceof OperationsScene) return 'operations';
  if (s instanceof DemoEndScene) return 'demoend';
  if (s instanceof LoadingScene) return 'loading';
  return 'unknown';
}

const findStory = (id: string): StoryDef | undefined => {
  for (const ch of CAMPAIGN) for (const s of ch.steps) if (s.kind === 'story' && s.story.id === id) return s.story;
  return undefined;
};

export const findOp = (id: string): OperationDef | undefined => [...allOperations(), SHOWCASE].find((o) => o.id === id);

export class DebugApi {
  readonly version = DEBUG_API_VERSION;
  private frozen = false;
  private stepping = false;
  /** Story/test flags outside an operation (the game has no persistent story flags yet). */
  readonly flags = new Map<string, string>();
  readonly presets = PRESET_NAMES;

  constructor(private game: DebugGame) {
    this.wrapInput();
    const go = game.go.bind(game);
    game.go = (scene: Scene) => {
      this.wrapScene(scene);
      go(scene);
    };
    if (game.scene) this.wrapScene(game.scene);
  }

  // ------------------------------------------------------------------ frame control

  /** While frozen the loop stops updating and drawing scenes, and input is held for `step`. */
  private wrapInput(): void {
    const input = this.game.input as unknown as InputInternals;
    const begin = input.beginFrame.bind(input);
    const beginStep = input.beginStep.bind(input);
    const beginRender = input.beginRender.bind(input);
    const end = input.endFrame.bind(input);
    // Neutral frame: leave pending pointer/keyboard events queued for the next step.
    const neutral = () => {
      input.pressed = input.released = input.rightPressed = false;
      input.wheel = 0;
      input.keysPressed = new Set();
      input.path = [input.pos];
    };
    input.beginFrame = () => {
      if (!this.frozen || this.stepping) return begin();
      neutral();
    };
    // The fixed-step loop consumes input through beginStep/beginRender: hold those too while frozen.
    input.beginStep = (tEnd?: number, dt?: number) => {
      if (!this.frozen || this.stepping) return beginStep(tEnd, dt);
      neutral();
    };
    input.beginRender = () => {
      if (!this.frozen || this.stepping) return beginRender();
    };
    input.endFrame = () => {
      if (!this.frozen || this.stepping) end();
    };
  }

  private wrapScene(scene: Scene): void {
    const s = scene as Scene & { __qaWrapped?: boolean };
    if (s.__qaWrapped) return;
    s.__qaWrapped = true;
    const update = scene.update.bind(scene);
    scene.update = (dt, game) => {
      if (this.frozen && !this.stepping) return;
      update(dt, game);
    };
    // Frozen means frozen: the canvas keeps its last frame, so a slow software renderer (CI) is not
    // kept busy drawing an unchanging scene while automation steps the game frame by frame.
    const render = scene.render.bind(scene);
    scene.render = (g, game) => {
      if (this.frozen && !this.stepping) return;
      render(g, game);
    };
  }

  freeze(): DebugState {
    this.frozen = true;
    // Stepped automation expects a click to land in the next scene at once: no fades.
    const tr = this.game.transition;
    if (tr) {
      tr.instant = true;
      tr.settle();
    }
    return this.state();
  }

  thaw(): void {
    this.frozen = false;
    if (this.game.transition) this.game.transition.instant = false;
  }

  /** Compile and link every shader variant in a fresh WebGL2 context (ENG-0083); returns the failures. */
  compileShaders(): { variants: number; failures: ShaderFailure[] } {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return { variants: 0, failures: [{ name: 'webgl2', stage: 'link', log: 'no WebGL2 context' }] };
    const variants = shaderCatalog();
    const failures = compileCatalog(gl, variants);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { variants: variants.length, failures };
  }

  /** Which options tab and row index own a settings key (for UI automation that clicks the real screen). */
  optionLocate(key: string): { tab: string; index: number } | null {
    for (const tab of OPTION_TABS) {
      const index = optionRows(tab).findIndex((r) => r.keys?.includes(key as never));
      if (index >= 0) return { tab, index };
    }
    return null;
  }

  /** The screen rect of a node in the current scene's UI tree (`tab.audio`, `row3`…), if any. */
  nodeRect(id: string): { x: number; y: number; w: number; h: number } | null {
    const ui = (this.game.scene as unknown as { ui?: { nodes: { id: string; rect: { x: number; y: number; w: number; h: number } }[] } }).ui;
    return ui?.nodes.find((n) => n.id === id)?.rect ?? null;
  }

  /** Set the renderer's animation clock (shader time), so captures are repeatable. */
  setClock(seconds: number): void {
    this.game.gfx.time = seconds;
  }

  isFrozen(): boolean {
    return this.frozen;
  }

  /** Run `frames` whole game frames (input latch, scene update, render) at a fixed dt. */
  step(frames = 1, opts: StepOptions = {}): DebugState {
    const dt = opts.dt ?? 1 / 60;
    const mode = opts.render ?? 'last';
    const g = this.game;
    this.stepping = true;
    try {
      for (let i = 0; i < frames; i++) {
        g.gfx.time += dt;
        g.input.beginFrame();
        g.scene?.update(dt, g);
        if (mode === 'all' || (mode === 'last' && i === frames - 1)) g.scene?.render(g.gfx, g);
        g.input.endFrame();
      }
    } finally {
      this.stepping = false;
    }
    return this.state();
  }

  // ------------------------------------------------------------------ inspection

  get scene(): SceneName {
    return sceneName(this.game.scene);
  }

  /** The live operation, when an operation scene is active. */
  op(): Operation | null {
    const s = this.game.scene;
    return s instanceof OperationScene ? s.op : null;
  }

  private requireOp(): Operation {
    const op = this.op();
    if (!op) throw new Error(`no operation is running (scene: ${this.scene})`);
    return op;
  }

  state(): DebugState {
    const s = this.game.scene;
    const op = this.op();
    let story: DebugState['story'] = null;
    if (s instanceof StoryScene) {
      const st = s as unknown as { story: StoryDef; i: number };
      const line = st.story.lines[st.i];
      story = { id: st.story.id, line: st.i, lineCount: st.story.lines.length, who: line?.who ?? '', text: line?.text ?? '' };
    }
    return {
      version: this.version,
      scene: sceneName(s),
      frozen: this.frozen,
      paused: s instanceof OperationScene ? (s as unknown as { paused: boolean }).paused : false,
      op: op ? opView(op) : null,
      story,
      save: JSON.parse(JSON.stringify({ progress: save.progress, best: save.best })) as DebugState['save'],
      settings: { ...settings },
    };
  }

  /** Hash of the operation's decisive state (identical across Node, Chromium and desktop for identical input). */
  hash(): string {
    return stateHash(this.requireOp());
  }

  /** Resolve once the operation reaches `status` (or the named scene is active). Polls in real time. */
  waitFor(target: Status | SceneName, timeoutMs = 30_000): Promise<DebugState> {
    const t0 = performance.now();
    return new Promise((resolve, reject) => {
      const poll = () => {
        const st = this.state();
        if (st.op?.status === target || st.scene === target) return resolve(st);
        if (performance.now() - t0 > timeoutMs) return reject(new Error(`waitFor(${target}) timed out; scene=${st.scene} status=${st.op?.status}`));
        setTimeout(poll, 25);
      };
      poll();
    });
  }

  /**
   * Re-simulate an operation headlessly in this runtime from a per-frame input log and return its
   * state hash (runtime parity, QAT-0056: the same log must hash identically in Node and here).
   */
  replay(opId: string, frames: ReplayFrame[]): { hash: string; status: Status; score: number; counts: Operation['counts']; frames: number } {
    const def = findOp(opId);
    if (!def) throw new Error(`unknown operation ${opId}`);
    const op = new Operation(def);
    for (const events of frames) {
      for (const ev of events) {
        if (ev.kind === 'litany') op.invokeLitany();
        else {
          if (ev.select) op.setTool(ev.tool);
          op.handlePointer(ev.ptr, 1 / 60);
        }
      }
      op.update(1 / 60);
    }
    return { hash: stateHash(op), status: op.status, score: op.score, counts: { ...op.counts }, frames: frames.length };
  }

  // ------------------------------------------------------------------ operation cheats

  /** Advance only the operation simulation by `seconds` (no input, no rendering). */
  simulate(seconds: number): DebugState {
    const op = this.requireOp();
    for (let t = 0; t < seconds - 1e-9; t += 1 / 60) op.update(1 / 60);
    return this.state();
  }

  /** Clear the current phase (as if every required entity were dealt with) and advance to the next. */
  skipPhase(): DebugState {
    const op = this.requireOp();
    if (op.status === 'intro') {
      while (op.status === 'intro') op.update(1 / 60);
      return this.state();
    }
    const phase = op.phase;
    for (const e of op.entities) {
      if (!e.alive) continue;
      if (e instanceof Incision && e.state === 'mark') {
        e.state = 'open';
        e.required = false;
      } else if (e instanceof Incision && e.state === 'open') continue;
      else e.kill();
    }
    for (let i = 0; i < 600 && op.phase === phase && op.status === 'running'; i++) op.update(1 / 60);
    return this.state();
  }

  /** Clear every remaining phase: the operation is won with the current vitals and time. */
  win(): DebugState {
    const op = this.requireOp();
    for (let i = 0; i < 50 && (op.status === 'intro' || op.status === 'running'); i++) this.skipPhase();
    return this.state();
  }

  lose(reason = 'The patient has died.'): DebugState {
    const op = this.requireOp();
    if (op.status === 'intro') this.skipPhase();
    op.lose(reason);
    return this.state();
  }

  setVitals(v: number): DebugState {
    this.requireOp().vitals = Math.max(0, Math.min(MAX_VITALS, v));
    return this.state();
  }

  /** Change a player setting for this session (not persisted) — for screenshots of comfort options. */
  setSetting(key: string, value: unknown): void {
    if (!(key in settings)) throw new Error(`unknown setting ${key}`);
    (settings as unknown as Record<string, unknown>)[key] = value;
  }

  setTime(seconds: number): DebugState {
    this.requireOp().timeLeft = Math.max(0, seconds);
    return this.state();
  }

  tool(id: ToolId): DebugState {
    const op = this.requireOp();
    if (!TOOL_INFO.some((t) => t.id === id)) throw new Error(`unknown tool ${id}`);
    op.setTool(id);
    return this.state();
  }

  litany(): boolean {
    return this.requireOp().invokeLitany();
  }

  flag(name: string, value: string): void {
    const op = this.op();
    const on = !['0', 'false', 'off', ''].includes(value.toLowerCase());
    if (op) {
      if (on) op.flags.add(name);
      else op.flags.delete(name);
    }
    if (on) this.flags.set(name, value);
    else this.flags.delete(name);
  }

  // ------------------------------------------------------------------ navigation

  title(): void {
    this.game.go(new TitleScene());
  }

  /** Play the campaign from chapter/step (both 0-based, as stored in the save). */
  goto(chapter: number, step: number): DebugState {
    if (!CAMPAIGN[chapter] && chapter !== CAMPAIGN.length) throw new Error(`no chapter ${chapter}`);
    playStep(this.game, chapter, step);
    return this.state();
  }

  /** Open an operation's briefing directly (Enter starts it); `begin` skips straight into the operation. */
  operation(id: string, begin = false): DebugState {
    const def = findOp(id);
    if (!def) throw new Error(`unknown operation ${id}`);
    const back = () => this.game.go(new TitleScene());
    playOperation(this.game, def, back, back);
    if (begin) {
      const b = this.game.scene as unknown as { onBegin: () => void };
      b.onBegin();
    }
    return this.state();
  }

  story(id: string, line = 0): DebugState {
    const story = findStory(id);
    if (!story) throw new Error(`unknown story ${id}`);
    const scene = new StoryScene(story, () => this.game.go(new TitleScene()));
    (scene as unknown as { i: number }).i = Math.max(0, Math.min(story.lines.length - 1, line));
    this.game.go(scene);
    return this.state();
  }

  /** Show the results screen for `opId` at a given rank (won), with plausible numbers. */
  results(rank: Rank, opId = 'op1-1', won = true): DebugState {
    const def = findOp(opId);
    if (!def) throw new Error(`unknown operation ${opId}`);
    const op = new Operation(def);
    const r = def.ranks;
    op.status = won ? 'won' : 'lost';
    op.score = { XS: Math.ceil(r.S * 1.1), S: r.S, A: r.A, B: r.B, C: Math.round(r.B / 2) }[rank];
    op.counts = rank === 'XS' ? { cool: 14, good: 4, bad: 0, miss: 0 } : { cool: 9, good: 6, bad: 2, miss: 1 };
    op.maxCombo = 8;
    op.vitals = won ? 72 : 0;
    op.timeLeft = won ? def.timeLimit / 3 : 0;
    if (won) op.bonus = { vitals: Math.round(op.vitals) * 20, time: Math.round(op.timeLeft) * 10, closure: 0 };
    else op.lostReason = 'The patient has died.';
    const back = () => this.game.go(new TitleScene());
    this.game.go(new ResultsScene(op, won, false, { next: won ? back : undefined, retry: back, quit: back }));
    return this.state();
  }

  demoEnd(): DebugState {
    this.game.go(new DemoEndScene());
    return this.state();
  }

  /** Make every demo operation reachable (Operating Theatre) without finishing the demo. */
  unlockAll(): DebugState {
    const last = CAMPAIGN.length - 1;
    save.progress = { chapter: last, step: CAMPAIGN[last].steps.length - 1 };
    store(save);
    return this.state();
  }

  preset(name: string): DebugState {
    if (!isPresetName(name)) throw new Error(`unknown preset ${name}; one of ${PRESET_NAMES.join(', ')}`);
    Object.assign(save, presetSave(name));
    store(save);
    this.game.go(new TitleScene());
    return this.state();
  }
}
