import type { ToolId } from './surgery/types';
import { registerToolModel, TOOL_MODEL } from './ui/toolIcons3d';
import { registerSet, SETS } from './scenes/sets';
import type { Model3D } from './render/renderer3d';
import type { AssetId } from './assets/manifest.gen';
import { CalibrateScene } from './scenes/calibrate';
import { ControlsCardScene } from './scenes/controlsCard';
import { AudioOptionsScene } from './audio/options-scene';
import { ControlsScene } from './input/controlsScene';
import { GameplayOptionsScene } from './scenes/gameplayOptions';
import { OperationsScene } from './scenes/operations';
import { ManualScene } from './scenes/manual';
import { DemoEndScene } from './scenes/demoend';
import { ChapterSelectScene } from './scenes/chapterSelect';
import { SaveSlotsScene } from './scenes/saveSlots';
import { CreditsScene, NoticesScene } from './scenes/credits';
import { ExtrasScene } from './scenes/extras';
import { DamagedRecordsScene } from './scenes/title';
import { NoticeScene, noticesDue } from './scenes/notice';
import { SetupScene, setupDue } from './scenes/setup';
import { Audio } from './core/audio';
import { ErrorBoundary, type CrashRecord } from './core/boundary';
import { Clock } from './core/clock';
import { onSettingChange, settings, saveSettings } from './core/settings';
import { SceneAudio } from './audio/scenes';
import { bindUiAudio } from './audio/ui-hooks';
import { Input } from './core/input';
import { FIXED_DT, FixedStep, FrameLimiter, RefreshEstimator, stepEndTimes } from './core/loop';
import { SceneStack, sceneName, type Game, type Scene } from './core/scene';
import { lampsVeil, splashDone, splashProgress } from './core/splash';
import { Gfx } from './render/gfx';
import { classifyTier, describeCaps } from './render/caps';
import { Profiler } from './render/profiler';
import { loadDetectedTier, storeDetectedTier } from './render/tierCache';
import { HEAP_BUDGET, VRAM_BUDGET } from './render/registry';
import { computeView } from './render/viewport';
import { createAssets, withTimeout } from './assets/browser';
import type { AssetLoader } from './assets/loader';
import { allOperations } from './content/campaign';
import { SHOWCASE, SHOWCASE_BOSS, showcaseOrgan } from './content/dev';
import type { OperationDef } from './surgery/operation';
import { playOperation } from './scenes/flow';
import { InkRunScene } from './scenes/inkrun';
import { TitleScene } from './scenes/title';
import { OptionsScene } from './scenes/options';
import { StoryScene } from './scenes/story';
import type { Backdrop } from './content/story';
import type { CharacterId } from './content/characters';
import { VIEW, VIEW_H, VIEW_W } from './ui/layout';
import { initLocale } from './i18n/boot';
import { OperationScene } from './scenes/operation';
import { bindings } from './input/bindings';
import { loadLayoutLabels } from './input/glyphs';
import { downloadRecording, parseRecording, Recorder, Replayer } from './input/record';
import { Transition } from './ui/transition';
import { GalleryScene } from './scenes/gallery';
import { displayPrefs } from './ui/display';
import { setFallbackHighlight, setReadableFont } from './render/text';
import { bindUiSounds } from './ui/events';

/** Dev/QA tooling ships in dev and QA builds; `vite build --mode release` strips it (ENG-0237). */
const DEV_TOOLS = import.meta.env.DEV || import.meta.env.MODE !== 'release';
import { platform } from './platform';
import { installPlatform, platformFrame, sceneChanged } from './platform/session';
import { installTelemetry } from './telemetry';
import { installQaHooks } from './debug/hooks';
import { artDevScene } from './art/devScenes';

class Main implements Game {
  input: Input;
  audio = new Audio();
  private sceneAudio = new SceneAudio(this.audio);
  gfx: Gfx;
  clock = new Clock();
  assets: AssetLoader;
  readonly scenes: SceneStack;
  readonly profiler = new Profiler();
  readonly boundary: ErrorBoundary;
  private fixed = new FixedStep();
  private refresh = new RefreshEstimator();
  private limiter = new FrameLimiter();
  private last = performance.now();
  private contextLost = false;
  private hidden = false;
  private losses: number[] = [];
  /** Scene transitions (UIX-0009): fade through black, input blocked, no double-trigger. */
  readonly transition = new Transition();

  constructor(private canvas: HTMLCanvasElement) {
    this.audio.volume = settings.volume;
    this.audio.muted = settings.muted;
    bindUiAudio(this.audio);
    this.gfx = new Gfx(canvas, VIEW_W, VIEW_H);
    console.info(describeCaps(this.gfx.caps));
    this.gfx.renderScale = settings.renderScale;
    this.input = new Input(canvas, VIEW_W, VIEW_H);
    this.assets = createAssets(this.gfx);
    this.scenes = new SceneStack(this);
    this.clock.reduceMotion = settings.reduceMotion;
    this.limiter.cap = settings.frameCap;
    this.boundary = new ErrorBoundary(
      (rec) => this.scenes.go(new InkRunScene(rec, () => this.scenes.go(new TitleScene()))),
      (rec) => this.fatal(rec),
    );
    window.addEventListener('resize', () => this.resize());
    onSettingChange('uiScale', () => this.resize());
    canvas.addEventListener('pointerdown', () => this.audio.unlock());
    window.addEventListener('keydown', (e) => {
      this.audio.unlock();
      if (e.code === 'F11' || (e.code === 'Enter' && e.altKey)) {
        e.preventDefault();
        platform.window.toggleFullscreen();
      }
      if (e.code === 'F3') {
        e.preventDefault();
        this.profiler.enabled = !this.profiler.enabled;
      }
      if (DEV_TOOLS && e.code === 'F4') this.dumpFrameCsv();
      if (DEV_TOOLS && e.code === 'F6') this.sceneAudio.debug = !this.sceneAudio.debug;
    });
    // Hidden/minimised window: stop ticking and silence audio; resume with no dt spike (ENG-0059).
    document.addEventListener('visibilitychange', () => {
      this.hidden = document.hidden;
      if (this.hidden) this.audio.suspend();
      else {
        this.audio.resume();
        this.last = performance.now();
      }
    });
    // WebGL context loss (ENG-0199/0200): pause, veil, rebuild everything on restore.
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.contextLost = true;
      this.gfx.contextLost();
      this.audio.suspend();
      lampsVeil(true);
      console.warn(`WebGL context lost (${this.gfx.registry.losses}× this session)`);
      // Repeated losses (3 within 60 s) mean an unstable GPU/driver: drop to Low tier (ENG-0201).
      const now = performance.now();
      this.losses = this.losses.filter((t) => now - t < 60000);
      this.losses.push(now);
      if (this.losses.length >= 3) {
        settings.gpuTier = 'low';
        saveSettings();
        console.error(`[gpu-instability] ${this.losses.length} context losses within 60 s on ${this.gfx.caps.renderer}; forcing Low tier`);
      }
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.gfx.contextRestored();
      this.gfx.atlas.warm();
      this.contextLost = false;
      this.last = performance.now();
      this.audio.resume();
      lampsVeil(false);
      console.info('WebGL context restored');
    });
    this.resize();
    bindUiSounds((c) => this.audio.play(c));
    installPlatform(this);
  }

  /** Fill the window; the view grows past 16:9 instead of letterboxing (ENG-0180–0183). DPR is not capped. UI scale: UIX-0015. */
  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const v = computeView(w, h, VIEW_W, VIEW_H, settings.uiScale);
    const cssW = Math.floor(v.w * v.scale);
    const cssH = Math.floor(v.h * v.scale);
    const dpr = window.devicePixelRatio || 1;
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.canvas.width = Math.max(1, Math.round(cssW * dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * dpr));
    Object.assign(VIEW, { w: v.w, h: v.h, ox: v.ox, oy: v.oy });
    Object.assign(this.input.view, { w: v.w, h: v.h, ox: v.ox, oy: v.oy });
    this.input.resized();
    this.gfx.setView(v.w, v.h, v.ox, v.oy);
  }

  /** The active (top) scene — kept as `scene` for tools that script the game (scripts/shoot.mjs). */
  get scene(): Scene | null {
    return this.scenes.top;
  }

  /** `?record=1`: each operation's input stream is saved as JSON when it ends. */
  recorder: Recorder | null = null;
  private recording: OperationScene | null = null;

  go(scene: Scene): void {
    if (this.instantGo) this.goNow(scene);
    else this.transition.request(() => this.goNow(scene));
  }

  /** Dev/automation jumps (`?op=`, `?ui=`) change scene without a transition. */
  instantGo = false;
  instant(fn: () => void): void {
    this.instantGo = true;
    try {
      fn();
    } finally {
      this.instantGo = false;
    }
  }

  private goNow(scene: Scene): void {
    if (this.recorder) {
      const leaving = this.recording && scene !== this.recording && !(scene instanceof OptionsScene);
      if (leaving && this.recording) {
        const op = this.recording.op;
        const rec = this.recorder.finish({ status: op.status, score: op.score, vitals: op.vitals, timeLeft: op.timeLeft });
        this.recording = null;
        if (rec) downloadRecording(rec);
      }
      if (scene instanceof OperationScene && scene !== this.recording) {
        this.recording = scene;
        this.recorder.begin(scene.op.def.id, scene.op.def.seed ?? 1, settings.timerAssist, bindings.prefs);
      }
    }
    this.scenes.go(scene);
    sceneChanged(scene);
  }
  push(scene: Scene): void {
    this.scenes.push(scene);
  }
  pop(): void {
    this.scenes.pop();
  }

  start(first: Scene): void {
    this.goNow(first);
    this.transition.fadeIn();
    this.last = performance.now();
    const frame = (now: number) => {
      if (this.boundary.halted) return;
      requestAnimationFrame(frame);
      const dt = (now - this.last) / 1000;
      if (this.contextLost || this.hidden) {
        this.last = now;
        return;
      }
      this.refresh.sample(dt);
      if (!this.limiter.shouldRender(now, this.refresh.hz)) return;
      this.last = now;
      this.tick(now, dt);
    };
    requestAnimationFrame(frame);
  }

  /** One rendered frame: N fixed simulation ticks, then render (ENG-0053). */
  private tick(now: number, dt: number): void {
    const p = this.profiler;
    const t0 = performance.now();
    const steps = this.fixed.advance(dt);
    const ends = stepEndTimes(now, steps, FIXED_DT, this.fixed.pending);
    this.clock.frame(Math.min(dt, 0.25));
    this.gfx.time = this.clock.real;
    platformFrame(Math.min(dt, 0.25));
    const clock = this.clock;
    this.gfx.renderScale = settings.renderScale;
    Object.assign(this.gfx.displayPrefs, displayPrefs(settings));
    setReadableFont(settings.readableFont);
    this.clock.reduceMotion = settings.reduceMotion;
    this.gfx.gpuTimer.enabled = this.profiler.enabled && this.gfx.plan.gpuProfiler;
    this.limiter.cap = settings.frameCap;
    p.begin('sim');
    for (let i = 0; i < steps; i++) {
      this.input.beginStep(ends[i]);
      const advanced = clock.tick(FIXED_DT);
      this.transition.update(FIXED_DT);
      if (this.transition.busy) continue;
      // Hitstop (ENG-0058): world time stands still for a few frames after a heavy blow; the frame still renders.
      if (!advanced && clock.inHitstop) continue;
      const top = this.scenes.top;
      if (!this.boundary.run('update', sceneName(top), clock.frames, clock.ticks, () => this.scenes.update(FIXED_DT))) break;
    }
    p.end('sim');
    this.input.beginRender();
    const top = this.scenes.top;
    p.begin('audio');
    this.sceneAudio.frame(top, Math.min(dt, 0.25), this.input);
    p.end('audio');
    p.begin('render');
    const renderScenes = () => this.scenes.render(this.gfx, this.fixed.alpha);
    this.boundary.run('render', sceneName(top), clock.frames, clock.ticks, () => (this.transition.busy ? this.input.suppress(renderScenes) : renderScenes()));
    this.sceneAudio.overlay(this.gfx);
    p.end('render');
    this.gfx.setCamera(null);
    this.transition.draw(this.gfx);
    this.profiler.draw(this.gfx, this.gfx.stats, this.gfx.registry, this.gfx.plan.gpuProfiler ? this.gfx.gpuTimer : null);
    this.gfx.endFrame();
    this.gfx.gpuTimer.collect();
    this.input.endFrame();
    this.gfx.resetStats();
    p.frame(performance.now() - t0 + 0);
    if (clock.frames % 300 === 0) this.checkBudgets();
  }

  /** VRAM/heap budgets (ENG-0227): log once with the top consumers when exceeded. */
  private checkBudgets(): void {
    const tier = settings.gpuTier === 'auto' ? (loadDetectedTier()?.tier ?? 'medium') : settings.gpuTier;
    this.gfx.registry.checkBudget(VRAM_BUDGET[tier]);
    const heap = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;
    if (heap && heap > HEAP_BUDGET) console.warn(`JS heap over budget: ${(heap / 2 ** 20).toFixed(0)} MB > ${HEAP_BUDGET / 2 ** 20} MB`);
  }

  private dumpFrameCsv(): void {
    if (!DEV_TOOLS) return;
    const blob = new Blob([this.profiler.csv()], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `frames-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  private fatal(rec: CrashRecord): void {
    this.canvas.remove();
    const div = document.createElement('div');
    div.id = 'fatal';
    div.textContent = `Suture & Steel stopped: ${rec.message} (${rec.scene}, ${rec.phase}). Please restart the game.`;
    document.body.appendChild(div);
  }

  /** First-launch GPU tier (ENG-0191): benchmark once per renderer, skip on software rasterisers. */
  detectTier(): void {
    const caps = this.gfx.caps;
    const known = loadDetectedTier();
    if (known && known.renderer === caps.renderer) return;
    const bench = caps.software ? undefined : this.gfx.benchmarkFlesh(2000);
    const { tier, reasons } = classifyTier(caps, bench);
    storeDetectedTier({ tier, renderer: caps.renderer, benchMs: bench });
    console.info(`GPU tier: ${tier} (${reasons.join('; ')})`);
  }
}

/**
 * Boot (ENG-0213): fonts → boot bundle → shader compile/pre-warm → title, with
 * progress on the DOM splash so the window never shows a blank canvas.
 */
async function boot(): Promise<void> {
  const t0 = performance.now();
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  await initLocale();
  let game: Main;
  try {
    splashProgress(0.1, 'Lighting the lamps…');
    game = new Main(canvas);
  } catch (err) {
    canvas.remove();
    document.getElementById('boot')?.remove();
    const div = document.createElement('div');
    div.id = 'fatal';
    div.textContent = `Suture & Steel needs WebGL2 and could not start: ${(err as Error).message}`;
    document.body.appendChild(div);
    return;
  }
  // Fonts and the boot bundle, with a timeout and logged fallback to the system serif (ENG-0214).
  splashProgress(0.25, 'Grinding the inks…');
  const ok = await withTimeout(
    game.assets.loadBundle('boot', (n, total) => splashProgress(0.25 + 0.45 * (total ? n / total : 1))),
    6000,
  );
  if (ok === false) console.warn('boot bundle timed out; continuing with fallback fonts');
  splashProgress(0.75, 'Warming the instruments…');
  game.gfx.atlas.warm();
  game.gfx.prewarm();
  game.detectTier();
  game.assets.prefetch('title');
  game.assets.prefetch('ops-common');
  // 3D sets: registered with the backdrop as they arrive (the procedural scene shows until then).
  // Generated 3D models have a local manifest (absent on fresh clones: then nothing loads).
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}assets/models.json`);
    if (r.ok) game.assets.addEntries((await r.json()).entries);
  } catch {
    // No models built: procedural backdrops and shader icons.
  }
  for (const [tool, id] of Object.entries(TOOL_MODEL).filter(([, id]) => game.assets!.has(id)))
    void game.assets.load(id as AssetId).then((a) => {
      if (a.value) registerToolModel(tool as ToolId, a.value as Model3D);
    });
  // Models are generated (npm run art:models) and absent from fresh clones: skip unbuilt sets.
  for (const [key, id] of Object.entries(SETS).filter(([, id]) => game.assets!.has(id)))
    void game.assets.load(id as AssetId).then((a) => {
      if (a.value) registerSet(key, a.value as Model3D);
    });
  splashProgress(1, 'Ready');
  void loadLayoutLabels();
  // First launch: the notices, then the setup chain (UIX-0075), then the title.
  const title = () => game.go(new TitleScene());
  const afterNotices = () => (setupDue() ? game.go(new SetupScene(title)) : title());
  game.start(noticesDue() ? new NoticeScene(afterNotices) : setupDue() ? new SetupScene(title) : new TitleScene());
  splashDone();
  console.info(`boot to title: ${Math.round(performance.now() - t0)} ms`);

  if (!DEV_TOOLS) return;
  // Dev/QA hooks: ?op=<id> jumps straight into an operation; window.__game exposes the game for automation.
  (window as unknown as { __game: Main }).__game = game;
  installQaHooks(game, { telemetry: installTelemetry(game) });
  const params = new URLSearchParams(location.search);
  const opId = params.get('op');
  const dev = [SHOWCASE, SHOWCASE_BOSS, showcaseOrgan((params.get('organ') ?? 'heart') as OperationDef['organ'])];
  const def = opId ? [...allOperations(), ...dev].find((o) => o.id === opId) : undefined;
  if (def) {
    const back = () => game.go(new TitleScene());
    game.instant(() => playOperation(game, def, back, back));
  }
  // ?record=1 saves each operation's input stream as JSON when it ends; ?replay=<url> plays one back (INP-0016).
  if (params.get('record') === '1') {
    const recorder = new Recorder();
    game.recorder = recorder;
    game.input.recorder = (f) => {
      if (game.scene instanceof OperationScene) recorder.push(f);
    };
  }
  const replayUrl = params.get('replay');
  if (replayUrl) {
    try {
      const rec = parseRecording(await (await fetch(replayUrl)).text());
      const rdef = allOperations().find((o) => o.id === rec.opId);
      if (!rdef) throw new Error(`unknown operation ${rec.opId}`);
      settings.timerAssist = rec.timerAssist as typeof settings.timerAssist;
      Object.assign(bindings.prefs, JSON.parse(JSON.stringify(rec.prefs)));
      game.input.replay = new Replayer(rec);
      const back = () => game.go(new TitleScene());
      game.go(new OperationScene(rdef, back, back));
    } catch (err) {
      console.error('Replay failed', err);
    }
  }
  // ?lqa=1 (dev/QA builds) tints glyphs drawn from a fallback face magenta (LOC-0025).
  setFallbackHighlight(DEV_TOOLS && params.get('lqa') === '1');
  // ?scene=artview|fleshlab opens an art dev page.
  const artScene = DEV_TOOLS ? artDevScene(params.has('shaderlab') ? 'shaderlab' : params.get('scene')) : null;
  if (artScene) game.go(artScene);
  // ?ui=<screen> opens a screen directly for art review (dev/QA builds).
  if (DEV_TOOLS) {
    const back = () => game.go(new TitleScene());
    const screens: Record<string, () => Scene> = {
      demoend: () => new DemoEndScene(),
      notice: () => new NoticeScene(back),
      setup: () => new SetupScene(back),
      theatre: () => new OperationsScene(),
      gameplay: () => new GameplayOptionsScene(back),
      controls: () => new ControlsScene(back),
      audio: () => new AudioOptionsScene(back),
      calibrate: () => new CalibrateScene(back),
      chapters: () => new ChapterSelectScene(),
      slots: () => new SaveSlotsScene('new'),
      credits: () => new CreditsScene(),
      extras: () => new ExtrasScene(),
      display: () => new OptionsScene(back, true, 'display'),
      manual: () => new ManualScene(back, true),
    };
    const make = screens[params.get('ui') ?? ''];
    if (make) game.instant(() => game.go(make()));
    if (params.get('ui') === 'card') game.instant(() => game.push?.(new ControlsCardScene()));
    if (params.get('ui') === 'notices') game.instant(() => game.push?.(new NoticesScene()));
    if (params.get('ui') === 'damaged') game.instant(() => game.push?.(new DamagedRecordsScene()));
  }
  // ?ui=gallery shows every widget for visual review (UIX-0006).
  if (params.get('ui') === 'gallery') game.instant(() => game.go(new GalleryScene(() => game.go(new TitleScene()))));
  // ?story=<backdrop> previews a story environment.
  const storyBg = params.get('story');
  if (storyBg) game.instant(() => game.go(new StoryScene({ id: 'preview', place: 'Preview', backdrop: storyBg as Backdrop, lines: [{ who: (params.get('who') ?? 'narrator') as CharacterId, text: 'The Free City of Kessendorf. Winter, in the ninth year of the Long Muster.' }] }, () => game.go(new TitleScene()))));
}

void boot();
