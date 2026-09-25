import { Audio } from './core/audio';
import { ErrorBoundary, type CrashRecord } from './core/boundary';
import { Clock } from './core/clock';
import { settings, saveSettings } from './core/settings';
import { Input } from './core/input';
import { FIXED_DT, FixedStep, FrameLimiter, RefreshEstimator, stepEndTimes } from './core/loop';
import { SceneStack, sceneName, type Game, type Scene } from './core/scene';
import { lampsVeil, splashDone, splashProgress } from './core/splash';
import { Gfx } from './render/gfx';
import { classifyTier, describeCaps } from './render/caps';
import { Profiler } from './render/profiler';
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
import { StoryScene } from './scenes/story';
import type { Backdrop } from './content/story';
import type { CharacterId } from './content/characters';
import { VIEW, VIEW_H, VIEW_W } from './ui/layout';

/** Dev/QA tooling ships in dev and QA builds; `vite build --mode release` strips it (ENG-0237). */
const DEV_TOOLS = import.meta.env.DEV || import.meta.env.MODE !== 'release';

class Main implements Game {
  input: Input;
  audio = new Audio();
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

  constructor(private canvas: HTMLCanvasElement) {
    this.audio.volume = settings.volume;
    this.audio.muted = settings.muted;
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
    canvas.addEventListener('pointerdown', () => this.audio.unlock());
    window.addEventListener('keydown', (e) => {
      this.audio.unlock();
      if (e.code === 'F11' || (e.code === 'Enter' && e.altKey)) {
        e.preventDefault();
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen();
      }
      if (e.code === 'F3') {
        e.preventDefault();
        this.profiler.enabled = !this.profiler.enabled;
      }
      if (DEV_TOOLS && e.code === 'F4') this.dumpFrameCsv();
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
  }

  /** Fill the window; the view grows past 16:9 instead of letterboxing (ENG-0180–0183). DPR is not capped. */
  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const v = computeView(w, h, VIEW_W, VIEW_H);
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

  go(scene: Scene): void {
    this.scenes.go(scene);
  }
  push(scene: Scene): void {
    this.scenes.push(scene);
  }
  pop(): void {
    this.scenes.pop();
  }

  start(first: Scene): void {
    this.go(first);
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
    const clock = this.clock;
    this.gfx.renderScale = settings.renderScale;
    this.gfx.gpuTimer.enabled = this.profiler.enabled && this.gfx.plan.gpuProfiler;
    this.limiter.cap = settings.frameCap;
    p.begin('sim');
    for (let i = 0; i < steps; i++) {
      this.input.beginStep(ends[i]);
      clock.tick(FIXED_DT);
      const top = this.scenes.top;
      if (!this.boundary.run('update', sceneName(top), clock.frames, clock.ticks, () => this.scenes.update(FIXED_DT))) break;
    }
    p.end('sim');
    this.input.beginRender();
    p.begin('render');
    const top = this.scenes.top;
    this.boundary.run('render', sceneName(top), clock.frames, clock.ticks, () => this.scenes.render(this.gfx, this.fixed.alpha));
    p.end('render');
    this.gfx.setCamera(null);
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
    const tier = settings.gpuTier === 'auto' ? (settings.detectedTier?.tier ?? 'medium') : settings.gpuTier;
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
    const known = settings.detectedTier;
    if (known && known.renderer === caps.renderer) return;
    const bench = caps.software ? undefined : this.gfx.benchmarkFlesh(2000);
    const { tier, reasons } = classifyTier(caps, bench);
    settings.detectedTier = { tier, renderer: caps.renderer, benchMs: bench };
    saveSettings();
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
  splashProgress(1, 'Ready');
  game.start(new TitleScene());
  splashDone();
  console.info(`boot to title: ${Math.round(performance.now() - t0)} ms`);

  if (!DEV_TOOLS) return;
  // Dev/QA hooks: ?op=<id> jumps straight into an operation; window.__game exposes the game for automation.
  (window as unknown as { __game: Main }).__game = game;
  const params = new URLSearchParams(location.search);
  const opId = params.get('op');
  const dev = [SHOWCASE, SHOWCASE_BOSS, showcaseOrgan((params.get('organ') ?? 'heart') as OperationDef['organ'])];
  const def = opId ? [...allOperations(), ...dev].find((o) => o.id === opId) : undefined;
  if (def) {
    const back = () => game.go(new TitleScene());
    playOperation(game, def, back, back);
  }
  // ?story=<backdrop> previews a story environment.
  const storyBg = params.get('story');
  if (storyBg) game.go(new StoryScene({ id: 'preview', place: 'Preview', backdrop: storyBg as Backdrop, lines: [{ who: (params.get('who') ?? 'narrator') as CharacterId, text: 'The Free City of Kessendorf. Winter, in the ninth year of the Long Muster.' }] }, () => game.go(new TitleScene())));
}

void boot();
