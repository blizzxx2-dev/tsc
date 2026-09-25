import '@fontsource/im-fell-english/400.css';
import '@fontsource/im-fell-english/400-italic.css';
import '@fontsource/unifrakturmaguntia/400.css';
import { Audio } from './core/audio';
import { Input } from './core/input';
import type { Game, Scene } from './core/scene';
import { Gfx } from './render/gfx';
import { allOperations } from './content/campaign';
import { playOperation } from './scenes/flow';
import { TitleScene } from './scenes/title';
import { VIEW_H, VIEW_W } from './ui/layout';

class Main implements Game {
  input: Input;
  audio = new Audio();
  gfx: Gfx;
  scene: Scene | null = null;
  private last = performance.now();

  constructor(private canvas: HTMLCanvasElement) {
    this.gfx = new Gfx(canvas, VIEW_W, VIEW_H);
    this.input = new Input(canvas, VIEW_W, VIEW_H);
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', () => this.audio.unlock());
    window.addEventListener('keydown', (e) => {
      this.audio.unlock();
      if (e.code === 'F11' || (e.code === 'Enter' && e.altKey)) {
        e.preventDefault();
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen();
      }
    });
    this.resize();
  }

  /** Keep a 16:9 canvas as large as the window allows, at device resolution. */
  private resize(): void {
    const aspect = VIEW_W / VIEW_H;
    let w = window.innerWidth;
    let h = w / aspect;
    if (h > window.innerHeight) {
      h = window.innerHeight;
      w = h * aspect;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.style.width = `${Math.floor(w)}px`;
    this.canvas.style.height = `${Math.floor(h)}px`;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
  }

  go(scene: Scene): void {
    this.scene = scene;
    scene.enter?.(this);
  }

  start(first: Scene): void {
    this.go(first);
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.gfx.time += dt;
      this.input.beginFrame();
      this.scene?.update(dt, this);
      this.scene?.render(this.gfx, this);
      this.input.endFrame();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}

async function boot(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  try {
    await Promise.all([
      document.fonts.load('56px "IM Fell English"'),
      document.fonts.load('italic 56px "IM Fell English"'),
      document.fonts.load('56px "UnifrakturMaguntia"'),
    ]);
  } catch {
    // Fall back to system serif fonts.
  }
  let game: Main;
  try {
    game = new Main(canvas);
  } catch (err) {
    canvas.remove();
    const div = document.createElement('div');
    div.id = 'fatal';
    div.textContent = `Suture & Steel needs WebGL2 and could not start: ${(err as Error).message}`;
    document.body.appendChild(div);
    return;
  }
  game.gfx.atlas.warm();
  game.start(new TitleScene());
  // Dev/QA hooks: ?op=<id> jumps straight into an operation; window.__game exposes the game for automation.
  (window as unknown as { __game: Main }).__game = game;
  const opId = new URLSearchParams(location.search).get('op');
  const def = opId ? allOperations().find((o) => o.id === opId) : undefined;
  if (def) {
    const back = () => game.go(new TitleScene());
    playOperation(game, def, back, back);
  }
}

void boot();
