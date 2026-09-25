/**
 * The stable automation API, `window.__game.debug` (QAT-0074). Smoke tests, E2E flows, the
 * console and the cheat menu all go through this instead of reaching into scene internals.
 * Versioned: bump DEBUG_API_VERSION on any breaking change and keep tests/e2e in step.
 * Only bundled in dev and QA builds (see ./hooks.ts); `vite build` (production) strips it.
 */
import { OPTION_TABS, optionRows } from '../scenes/options';
import { compileCatalog, shaderCatalog, type ShaderFailure } from '../render/shaderCatalog';
import { isQuality, QUALITIES, SHADER_TIERS } from '../render/quality';
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
import { SaveSlotsScene } from '../scenes/saveSlots';
import { ChapterSelectScene } from '../scenes/chapterSelect';
import { PauseScene } from '../scenes/pause';
import { ConfirmScene } from '../scenes/confirm';
import { Incision } from '../surgery/entities';
import { MAX_VITALS, Operation, type OperationDef, type Status } from '../surgery/operation';
import { TOOL_INFO, type Pointer, type Rank, type ToolId } from '../surgery/types';
import { isPresetName, PRESET_NAMES, presetSave } from './presets';
import { opView, stateHash, type OpView } from './state';
import { checkpoint, describeDesync, firstDesync, HASH_EVERY, replayHashes, type Checkpoint } from './desync';
import { takeLog } from '../surgery/replay';
import { mapUVToField } from '../render/decals';

export const DEBUG_API_VERSION = 1;

/** The concrete game object from main.ts (Game plus the active scene). */
export type DebugGame = Game & { scene: Scene | null; transition?: Transition };

export type SceneName =
  | 'title'
  | 'story'
  | 'briefing'
  | 'operation'
  | 'results'
  | 'options'
  | 'operations'
  | 'demoend'
  | 'loading'
  | 'slots'
  | 'chapters'
  | 'pause'
  | 'confirm'
  | 'unknown';

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
  // Title v2 menus and overlays (QAT E2E flows drive them through nodeRect).
  if (s instanceof SaveSlotsScene) return 'slots';
  if (s instanceof ChapterSelectScene) return 'chapters';
  if (s instanceof PauseScene) return 'pause';
  if (s instanceof ConfirmScene) return 'confirm';
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
  /** God mode (ENG-0234): vitals held at maximum. */
  god = false;
  /** Story/test flags outside an operation (the game has no persistent story flags yet). */
  readonly flags = new Map<string, string>();
  readonly presets = PRESET_NAMES;

  constructor(private game: DebugGame) {
    this.wrapInput();
    const go = game.go.bind(game);
    game.go = (scene: Scene, opts?: Parameters<DebugGame['go']>[1]) => {
      this.wrapScene(scene);
      go(scene, opts);
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
      // God mode (ENG-0234): vitals are topped up around every tick so the patient cannot die.
      const op = this.god && scene instanceof OperationScene ? scene.op : null;
      if (op) op.vitals = MAX_VITALS;
      update(dt, game);
      if (op) op.vitals = MAX_VITALS;
      if (scene instanceof OperationScene) this.trackHashes(scene.op);
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

  /** The post-process pass list with its enable flags (ENG-0146), for the console and overlay. */
  postPasses(): { id: string; label: string; enabled: boolean; uniforms: readonly string[] }[] {
    const chain = this.game.gfx.postChain;
    return chain.passes.map((p) => ({ id: p.id, label: p.label, enabled: chain.enabled(p.id), uniforms: p.uniforms }));
  }

  /** Enable, disable or (with `on` omitted) toggle one post pass, or `all`. Returns the new state; throws on an unknown id. */
  postPass(id: string, on?: boolean): boolean {
    const chain = this.game.gfx.postChain;
    if (id === 'all') {
      chain.setAll(on ?? true);
      return on ?? true;
    }
    const ok = on === undefined ? chain.toggle(id) : chain.setEnabled(id, on);
    if (!ok) throw new Error(`unknown post pass "${id}" (${chain.passes.map((p) => p.id).join(', ')})`);
    return chain.enabled(id);
  }

  /**
   * Shader quality tier in the renderer (ENG-0082): read, or switch to `q` with an optional noise
   * override (`live` re-evaluates the flesh noise per pixel for A/B checks against the baked textures).
   * The tier reverts to the settings value on the next frame unless the setting is changed too.
   */
  shaderQuality(q?: string, noise?: 'baked' | 'live' | null): { quality: string; noise: string } {
    const g = this.game.gfx;
    if (q !== undefined) {
      if (!isQuality(q)) throw new Error(`quality must be one of ${QUALITIES.join('/')}`);
      settings.shaderQuality = q;
      g.displayPrefs.quality = q;
      g.setShaderQuality(q, noise === undefined ? g.noiseOverride : noise);
    }
    return { quality: g.shaderQuality, noise: g.noiseOverride ?? SHADER_TIERS[g.shaderQuality].flesh.noise };
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
      // The pause overlay is pushed over the operation, so the top scene is the PauseScene itself.
      paused: s instanceof PauseScene || (s instanceof OperationScene && (s as unknown as { paused: boolean }).paused),
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

  /** Live checkpoints of the running operation, one every HASH_EVERY logged ticks (ENG-0254). */
  private hashes: { op: Operation; seen: number; ticks: number; list: Checkpoint[] } | null = null;
  private trackHashes(op: Operation): void {
    const log = op.log;
    if (!log) return;
    let h = this.hashes;
    if (!h || h.op !== op) h = this.hashes = { op, seen: 0, ticks: 0, list: [] };
    for (; h.seen < log.length; h.seen++) if (log[h.seen][0] === 'u' && ++h.ticks % HASH_EVERY === 0) h.list.push(checkpoint(op, h.ticks));
  }

  /**
   * Desync detector (ENG-0254): re-simulate the running operation from its input log and compare
   * checkpoint hashes with the live run; reports the first divergent tick and entity.
   */
  desync(): string {
    const op = this.requireOp();
    if (!op.log || !this.hashes || this.hashes.op !== op) throw new Error('no live checkpoints yet for this operation');
    const replayed = replayHashes(op.def, takeLog(op));
    return `${describeDesync(firstDesync(this.hashes.list, replayed))} (${this.hashes.list.length} checkpoints)`;
  }

  /** Advance to phase `n` (1-based) by clearing the phases before it (ENG-0234). */
  phase(n: number): DebugState {
    const op = this.requireOp();
    const target = Math.max(0, Math.floor(n) - 1);
    if (target < op.phase) throw new Error(`already past phase ${n} (at ${op.phase + 1}); restart with "seed" or "op"`);
    for (let i = 0; i < 50 && (op.status === 'intro' || (op.status === 'running' && op.phase < target)); i++) this.skipPhase();
    return this.state();
  }

  /** Decal map coverage (ENG-0116): fraction of the field-space map above a density threshold, from a 64×36 GPU readback. */
  decalCoverage(map: 'blood' | 'scorch' = 'blood', threshold = 0.1): number {
    const s = this.game.scene as unknown as { decals?: { coverage(m: string, t: number): number } | null };
    if (!(this.game.scene instanceof OperationScene)) throw new Error(`no operation is running (scene: ${this.scene})`);
    return s.decals ? s.decals.coverage(map, threshold) : 0;
  }

  /** Mean blood-map density (0..1) within `r` of a field point, from the 64×36 readback (ENG-0116). */
  decalDensity(x: number, y: number, r: number, map: 'blood' | 'scorch' = 'blood'): number {
    const s = this.game.scene as unknown as { decals?: { readDensity(m: string, w: number, h: number): Float32Array } | null };
    if (!(this.game.scene instanceof OperationScene)) throw new Error(`no operation is running (scene: ${this.scene})`);
    if (!s.decals) return 0;
    const d = s.decals.readDensity(map, 64, 36);
    let sum = 0;
    let n = 0;
    for (let j = 0; j < 36; j++)
      for (let i = 0; i < 64; i++) {
        const p = mapUVToField((i + 0.5) / 64, 1 - (j + 0.5) / 36);
        if (Math.hypot(p.x - x, p.y - y) > r) continue;
        sum += d[j * 64 + i];
        n++;
      }
    return n ? sum / n : 0;
  }

  /** Toggle (or set) god mode; returns the new state. */
  setGod(on = !this.god): boolean {
    this.god = on;
    return on;
  }

  /** Dev time scale (ENG-0234/0236), via the main loop's DevTime; returns the applied scale. */
  timescale(x?: number): number {
    const dt = (this.game as { devTime?: { scale: number; setScale(x: number): number } }).devTime;
    if (!dt) throw new Error('time controls are not available in this build');
    return x === undefined ? dt.scale : dt.setScale(x);
  }

  /** Restart the running operation with RNG seed `seed` (ENG-0234). */
  reseed(seed: number): DebugState {
    const op = this.requireOp();
    const back = () => this.game.go(new TitleScene());
    const run = () => this.game.go(new OperationScene(op.def, back, back, { seed: Math.floor(seed) }));
    const g = this.game as DebugGame & { instant?: (fn: () => void) => void };
    if (g.instant) g.instant(run);
    else run();
    return this.state();
  }

  /** Simulate a WebGL context loss, restoring after `ms` (ENG-0234, exercises ENG-0199/0200). */
  loseContext(ms = 1000): boolean {
    const ext = this.game.gfx.gl.getExtension('WEBGL_lose_context');
    if (!ext) return false;
    ext.loseContext();
    setTimeout(() => ext.restoreContext(), ms);
    return true;
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
