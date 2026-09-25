import { describe, expect, it } from 'vitest';
import { ErrorBoundary } from '../src/core/boundary';
import { ListenerScope, SceneStack, sceneName, type Game, type Scene } from '../src/core/scene';
import { allOperations } from '../src/content/campaign';
import { GlRegistry } from '../src/render/registry';
import { RenderTargetPool } from '../src/render/targets';
import { OperationScene } from '../src/scenes/operation';
import { fakeGl } from './fakegl';
import { Input } from '../src/core/input';
import { Bindings } from '../src/input/bindings';

function fakeGame(): Game & { log: string[] } {
  const log: string[] = [];
  // A real, DOM-free Input with no devices attached: idle pointer, no presses.
  const input = new Input(null, 1280, 720, new Bindings(null));
  input.warp({ x: 640, y: 400 });
  const g = { log, input, audio: { play: () => undefined } as unknown as Game['audio'], gfx: {} as Game['gfx'], go: () => undefined };
  return g;
}

class Probe implements Scene {
  updates = 0;
  renders = 0;
  constructor(
    private name: string,
    private log: string[],
    public overlay = false,
  ) {}
  enter() {
    this.log.push(`${this.name}.enter`);
  }
  exit() {
    this.log.push(`${this.name}.exit`);
  }
  pause() {
    this.log.push(`${this.name}.pause`);
  }
  resume() {
    this.log.push(`${this.name}.resume`);
  }
  dispose() {
    this.log.push(`${this.name}.dispose`);
  }
  update() {
    this.updates++;
  }
  render() {
    this.renders++;
  }
}

describe('scene lifecycle and stack (ENG-0062/0063)', () => {
  it('go() exits and disposes the outgoing scene before entering the next', () => {
    const game = fakeGame();
    const s = new SceneStack(game);
    s.go(new Probe('a', game.log));
    s.go(new Probe('b', game.log));
    expect(game.log).toEqual(['a.enter', 'a.exit', 'a.dispose', 'b.enter']);
  });

  it('re-entering the scene that is already active does not dispose it', () => {
    const game = fakeGame();
    const s = new SceneStack(game);
    const a = new Probe('a', game.log);
    s.go(a);
    s.go(a);
    expect(game.log).not.toContain('a.dispose');
  });

  it('an overlay pauses the scene beneath, which keeps rendering but stops updating', () => {
    const game = fakeGame();
    const s = new SceneStack(game);
    const base = new Probe('base', game.log);
    const over = new Probe('over', game.log, true);
    s.go(base);
    s.push(over);
    for (let i = 0; i < 5; i++) {
      s.update(1 / 120);
      s.render({} as Game['gfx']);
    }
    expect(base.updates).toBe(0);
    expect(base.renders).toBe(5);
    expect(over.updates).toBe(5);
    s.pop();
    s.update(1 / 120);
    expect(base.updates).toBe(1);
    expect(game.log).toEqual(['base.enter', 'base.pause', 'over.enter', 'over.exit', 'over.dispose', 'base.resume']);
  });

  it('an opaque pushed scene hides the one beneath', () => {
    const game = fakeGame();
    const s = new SceneStack(game);
    const base = new Probe('base', game.log);
    s.go(base);
    s.push(new Probe('full', game.log, false));
    s.render({} as Game['gfx']);
    expect(base.renders).toBe(0);
  });

  it('50 operation restarts leave GL objects and listeners at baseline (leak test)', () => {
    const f = fakeGl();
    const reg = new GlRegistry(f.gl);
    const pool = new RenderTargetPool(reg, true);
    const game = fakeGame();
    const s = new SceneStack(game);
    const def = allOperations()[0];
    // A scene owning a decal target and a DOM listener, released on dispose — the pattern real scenes follow.
    class Owning extends OperationScene {
      scope = new ListenerScope();
      enter() {
        super.enter();
        pool.acquire('decals', 1024, 576, { format: 'rgba8' });
        this.scope.add({ addEventListener: () => undefined, removeEventListener: () => undefined } as unknown as EventTarget, 'blur', () => undefined);
      }
      dispose() {
        super.dispose();
        pool.release('decals');
        this.scope.dispose();
      }
    }
    s.go(new Owning(def, () => undefined, () => undefined));
    const gl0 = reg.count();
    const l0 = ListenerScope.live;
    for (let i = 0; i < 50; i++) {
      const sc = new Owning(def, () => undefined, () => undefined);
      s.go(sc);
      for (let k = 0; k < 20; k++) s.update(1 / 120);
    }
    expect(reg.count()).toBe(gl0);
    expect(ListenerScope.live).toBe(l0);
    expect(f.live().Texture ?? 0).toBe(1);
  });
});

describe('error boundary (ENG-0069)', () => {
  it('a throwing scene is routed to the error screen with scene + frame context', () => {
    const game = fakeGame();
    const s = new SceneStack(game);
    class Broken implements Scene {
      update(): void {
        throw new Error('lancet snapped');
      }
      render(): void {}
    }
    const errors: string[] = [];
    const recovered = new Probe('ink', game.log);
    const b = new ErrorBoundary(
      () => s.go(recovered),
      () => undefined,
      (m) => errors.push(m),
    );
    s.go(new Broken());
    const ok = b.run('update', sceneName(s.top), 42, 99, () => s.update(1 / 120));
    expect(ok).toBe(false);
    expect(s.top).toBe(recovered);
    expect(b.crashes[0]).toMatchObject({ phase: 'update', scene: 'Broken', frame: 42, tick: 99, message: 'lancet snapped' });
    expect(errors[0]).toContain('Broken');
    // The loop keeps going: the next frame runs normally.
    expect(b.run('update', sceneName(s.top), 43, 100, () => s.update(1 / 120))).toBe(true);
  });

  it('gives up (fatal) when the error screen itself keeps failing', () => {
    let fatal = 0;
    const b = new ErrorBoundary(
      () => undefined,
      () => fatal++,
      () => undefined,
    );
    for (let i = 0; i < 5; i++)
      b.run('render', 'X', i, i, () => {
        throw new Error('again');
      });
    expect(fatal).toBe(1);
    expect(b.halted).toBe(true);
  });
});
