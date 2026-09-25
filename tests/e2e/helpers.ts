/**
 * E2E harness (QAT-0059): Playwright against the built QA preview (SwiftShader WebGL2), driven only
 * through the stable debug API `window.__game.debug` plus real mouse/keyboard input. Each test gets
 * a fresh browser context; on failure a screenshot and a Playwright trace are kept under
 * test-results/e2e/<test>/.
 */
import { mkdirSync } from 'node:fs';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { afterAll, afterEach, beforeAll, beforeEach, inject, type TestContext } from 'vitest';
import { CHROMIUM_ARGS, resolveChromium } from '../../scripts/qa/launch.mjs';
import type { DebugState } from '../../src/debug/api';
import { Operation, type OperationDef } from '../../src/surgery/operation';
import { TOOL_INFO, type ToolId } from '../../src/surgery/types';
import { applyBotEvents, BotDriver, type BotOptions } from '../bot';
import { DT } from '../helpers/sim';

export interface GameOptions {
  locale?: string;
  /** Scripts run in the page before the game boots. */
  initScripts?: string[];
  viewport?: { width: number; height: number };
}

export class Game {
  errors: string[] = [];
  private constructor(
    readonly context: BrowserContext,
    readonly page: Page,
  ) {
    page.on('pageerror', (e) => this.errors.push(`pageerror: ${String(e)}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.text().includes('404')) this.errors.push(`console: ${m.text()}`);
    });
  }

  static async open(browser: Browser, opts: GameOptions = {}): Promise<Game> {
    const context = await browser.newContext({ viewport: opts.viewport ?? { width: 1280, height: 720 }, locale: opts.locale });
    for (const s of opts.initScripts ?? []) await context.addInitScript(s);
    await context.tracing.start({ screenshots: true, snapshots: true });
    return new Game(context, await context.newPage());
  }

  get url(): string {
    return inject('baseURL');
  }

  /** Load the game (optionally with a query string), wait for the debug API and freeze the loop. */
  async boot(query = '', frozen = true): Promise<DebugState> {
    await this.page.goto(this.url + query);
    await this.page.waitForFunction(() => !!(window as unknown as { __game?: { debug?: unknown } }).__game?.debug, null, { timeout: 30_000 });
    if (frozen) await this.api('freeze');
    return this.state();
  }

  async reload(frozen = true): Promise<DebugState> {
    await this.page.reload();
    await this.page.waitForFunction(() => !!(window as unknown as { __game?: { debug?: unknown } }).__game?.debug, null, { timeout: 30_000 });
    if (frozen) await this.api('freeze');
    return this.state();
  }

  /** Call a method of window.__game.debug. */
  api<T = DebugState>(method: string, ...args: unknown[]): Promise<T> {
    return this.page.evaluate(
      ([m, a]) =>
        (window as unknown as { __game: { debug: Record<string, (...x: unknown[]) => unknown> } }).__game.debug[m as string](...(a as unknown[])) as T,
      [method, args] as const,
    );
  }

  state(): Promise<DebugState> {
    return this.api('state');
  }

  /** Run whole frames; render only the last by default (menus act while drawing, so use 'all' for clicks). */
  step(frames = 1, render: 'all' | 'last' | 'none' = 'none'): Promise<DebugState> {
    return this.api('step', frames, { render });
  }

  async until(what: string, pred: (s: DebugState) => boolean, maxFrames = 900, chunk = 10): Promise<DebugState> {
    let s = await this.state();
    for (let i = 0; i < maxFrames && !pred(s); i += chunk) s = await this.step(chunk);
    if (!pred(s)) throw new Error(`timed out waiting for ${what}; scene=${s.scene} op=${s.op?.status}`);
    return s;
  }

  /** Click at virtual coordinates (canvas is 1280×720 at this viewport) and process it this frame. */
  async click(x: number, y: number): Promise<DebugState> {
    await this.page.mouse.move(x, y);
    await this.step(1, 'all');
    await this.page.mouse.down();
    await this.page.mouse.up();
    return this.step(1, 'all');
  }

  async key(code: string): Promise<DebugState> {
    await this.page.keyboard.press(code);
    return this.step(1, 'all');
  }

  async close(ctx?: TestContext): Promise<void> {
    const failed = ctx?.task.result?.state === 'fail';
    if (failed) {
      const dir = `test-results/e2e/${ctx!.task.name.replace(/[^a-z0-9]+/gi, '-').slice(0, 80)}`;
      mkdirSync(dir, { recursive: true });
      await this.page.screenshot({ path: `${dir}/failure.png` }).catch(() => undefined);
      await this.context.tracing.stop({ path: `${dir}/trace.zip` }).catch(() => undefined);
    } else await this.context.tracing.stop().catch(() => undefined);
    await this.context.close().catch(() => undefined);
  }
}

/** Register a shared browser for the file and a fresh Game per test; returns an accessor. */
export function useGame(opts: GameOptions = {}): () => Game {
  let browser: Browser;
  let game: Game | null = null;
  beforeAll(async () => {
    browser = await chromium.launch({ executablePath: resolveChromium(), args: CHROMIUM_ARGS });
  });
  afterAll(async () => {
    await browser?.close();
  });
  beforeEach(async () => {
    game = await Game.open(browser, opts);
  });
  afterEach(async (ctx) => {
    await game?.close(ctx);
    game = null;
  });
  return () => game!;
}

const TOOL_CODE = Object.fromEntries(TOOL_INFO.map((t) => [t.id, t.code])) as Record<ToolId, string>;

export interface MouseRun {
  mirror: Operation;
  browser: DebugState;
  frames: number;
}

/**
 * Play the operation that is on screen (just created, still in its intro) with the bot surgeon,
 * delivering its gestures as real Playwright mouse and keyboard events, one game frame at a time.
 * A Node-side mirror `Operation` receives the same gestures straight through `handlePointer`, so
 * the two input paths can be compared (QAT-0064).
 */
export async function playWithMouse(game: Game, def: OperationDef, opts: BotOptions = {}): Promise<MouseRun> {
  const page = game.page;
  const mirror = new Operation(def);
  const bot = new BotDriver({ ...opts, splitRelease: true });
  let browserTool: ToolId = mirror.tool;
  let last = { x: -1, y: -1 };
  let frames = 0;
  const maxFrames = (opts.maxSeconds ?? 600) * 60;
  while ((mirror.status === 'intro' || mirror.status === 'running') && frames < maxFrames) {
    if (mirror.status === 'running') {
      const events = bot.tick(mirror);
      for (const ev of events) {
        if (ev.kind === 'litany') {
          await game.api('litany');
          continue;
        }
        if (ev.select && ev.tool !== browserTool && mirror.def.tools.includes(ev.tool)) {
          await page.keyboard.press(TOOL_CODE[ev.tool]);
          browserTool = ev.tool;
        }
        const { pos, pressed, released, down } = ev.ptr;
        if (pressed) {
          await page.mouse.move(pos.x, pos.y);
          await page.mouse.down();
        } else if (released) await page.mouse.up();
        else if (pos.x !== last.x || pos.y !== last.y || down) {
          if (pos.x !== last.x || pos.y !== last.y) await page.mouse.move(pos.x, pos.y);
        }
        last = { ...pos };
      }
      applyBotEvents(mirror, events);
    }
    mirror.update(DT);
    await game.step(1);
    frames++;
  }
  return { mirror, browser: await game.state(), frames };
}
