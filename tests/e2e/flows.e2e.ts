/**
 * End-to-end flows on the built QA preview:
 * QAT-0060 new game, QAT-0061 continue/resume, QAT-0062 retry & quit (with GL-object counters),
 * QAT-0063 options persistence.
 */
import { describe, expect, it } from 'vitest';
import { OP_1_1 } from '../../src/content/chapter1';
import { playWithMouse, useGame } from './helpers';

/** Counts live WebGL objects (create* minus delete*) so leaks across scene loops show up. */
const GL_COUNTER = `
(() => {
  const live = {};
  const P = WebGL2RenderingContext.prototype;
  for (const kind of ['Buffer', 'Texture', 'Framebuffer', 'Renderbuffer', 'Program', 'Shader', 'VertexArray']) {
    const c = P['create' + kind], d = P['delete' + kind];
    live[kind] = 0;
    P['create' + kind] = function (...a) { const o = c.apply(this, a); if (o) live[kind]++; return o; };
    P['delete' + kind] = function (o) { if (o) live[kind]--; return d.call(this, o); };
  }
  window.__glLive = live;
})();`;

/** The results ledger draws immediate-mode buttons (no UI tree): centres from src/scenes/results.ts. */
const RESULTS = { continue: { x: 860, y: 664 }, retry: (hasNext: boolean) => ({ x: hasNext ? 600 : 530, y: 664 }), leave: { x: 390, y: 664 } };

describe('new game flow', () => {
  const game = useGame();

  it('title → New Game → slot 1 → prologue → op1-1 won with real mouse gestures → results → s1-2, saving progress at each step', async () => {
    const g = game();
    let s = await g.boot();
    expect(s.scene).toBe('title');
    expect(s.save.progress).toEqual({ chapter: 0, step: 0 });

    // New Game opens the save-slot picker (UIX-0092); an empty slot begins the campaign at once.
    // A fresh profile is asked whether it has operated before (GAM-0208); "Teach me" keeps the tutorials.
    s = await g.clickNode('new');
    expect(s.scene).toBe('confirm');
    s = await g.clickNode('no');
    expect(s.scene).toBe('slots');
    s = await g.clickNode('slot1');
    expect(s.scene).toBe('story');
    expect(s.story?.id).toBe('prologue');
    expect(s.save.progress).toEqual({ chapter: 0, step: 0 });

    // Read the whole prologue: each Space reveals the line, the next advances it.
    for (let i = 0; i < 60 && s.scene === 'story'; i++) s = await g.key('Space');
    expect(s.scene).toBe('briefing');
    expect(s.save.progress).toEqual({ chapter: 0, step: 1 });

    s = await g.key('Enter');
    expect(s.scene).toBe('operation');
    expect(s.op?.id).toBe('op1-1');
    const run = await playWithMouse(g, OP_1_1);
    expect(run.mirror.status).toBe('won');
    expect(run.browser.op?.status).toBe('won');

    s = await g.until('results', (st) => st.scene === 'results', 400);
    await g.step(70); // the ledger's buttons appear after 1 s
    expect(s.save.best['op1-1']?.score).toBeGreaterThan(0);
    s = await g.click(RESULTS.continue.x, RESULTS.continue.y);
    // The operation's aftermath scene plays first, then the chapter carries on.
    expect(s.scene).toBe('story');
    expect(s.story?.id).toBe('a1-1');
    for (let i = 0; i < 60 && s.story?.id === 'a1-1'; i++) s = await g.key('Space');
    expect(s.story?.id).toBe('s1-2');
    expect(s.save.progress).toEqual({ chapter: 0, step: 2 });
    expect(g.errors).toEqual([]);
  });
});

describe('continue / resume', () => {
  const game = useGame();

  it('after a reload mid-chapter, Continue lands on the saved step', async () => {
    const g = game();
    await g.boot('?preset=mid-ch1');
    let s = await g.state();
    const saved = s.save.progress;
    expect(saved.chapter).toBe(0);
    s = await g.reload();
    expect(s.scene).toBe('title');
    expect(s.save.progress).toEqual(saved);
    s = await g.clickNode('continue');
    expect(s.scene).toBe('briefing');
    expect(s.save.progress).toEqual(saved);
    s = await g.key('Enter');
    expect(s.op?.id).toBe('op1-3');
  });

  it('a reload during a story resumes that story step', async () => {
    const g = game();
    await g.boot('?preset=ch2-start');
    let s = await g.clickNode('continue');
    expect(s.scene).toBe('story');
    const story = s.story?.id;
    await g.reload();
    s = await g.clickNode('continue');
    expect(s.scene).toBe('story');
    expect(s.story?.id).toBe(story);
  });

  it('quitting mid-operation resumes at that operation’s briefing', async () => {
    const g = game();
    await g.boot('?preset=pre-matins');
    let s = await g.clickNode('continue');
    expect(s.scene).toBe('briefing');
    s = await g.key('Enter');
    expect(s.op?.id).toBe('op1-5');
    await g.until('surgery', (st) => st.op?.status === 'running', 600);
    s = await g.key('Escape');
    expect(s.paused).toBe(true);
    s = await g.clickNode('abandon'); // Abandon the Patient → confirm (settings.confirmAbandon)
    expect(s.scene).toBe('confirm');
    s = await g.clickNode('yes');
    expect(s.scene).toBe('title');
    await g.reload();
    s = await g.clickNode('continue');
    expect(s.scene).toBe('briefing');
    s = await g.key('Enter');
    expect(s.op?.id).toBe('op1-5');
    expect(s.op?.phase).toBe(-1);
  });
});

describe('retry and quit', () => {
  const game = useGame({ initScripts: [GL_COUNTER] });

  it('loss → results → Try Again restarts with the same seed', async () => {
    const g = game();
    await g.boot();
    await g.api('operation', 'op1-4', true);
    await g.step(1);
    await g.api('skipPhase');
    const first = await g.api<string>('hash');
    await g.api('lose');
    await g.until('results', (st) => st.scene === 'results', 400);
    await g.step(70);
    const s = await g.click(RESULTS.retry(false).x, RESULTS.retry(false).y); // Try Again → straight back into the operation
    expect(s.scene).toBe('operation');
    expect(s.op?.id).toBe('op1-4');
    expect(s.op?.status).toBe('intro');
    await g.api('skipPhase');
    expect(await g.api<string>('hash')).toBe(first);
  });

  it('pause → Abandon → title → Continue; GL object counts unchanged after 10 loops', async () => {
    const g = game();
    await g.boot('?preset=mid-ch1');
    const loop = async () => {
      let s = await g.clickNode('continue'); // → op1-3 briefing
      expect(s.scene).toBe('briefing');
      s = await g.key('Enter');
      expect(s.scene).toBe('operation');
      await g.until('surgery', (st) => st.op?.status === 'running', 600);
      s = await g.abandon();
      expect(s.scene).toBe('title');
      await g.step(2, 'all');
    };
    await loop();
    const live = () => g.page.evaluate(() => JSON.stringify((window as unknown as { __glLive: unknown }).__glLive));
    const after1 = await live();
    for (let i = 0; i < 9; i++) await loop();
    expect(await live()).toBe(after1);
    expect(g.errors).toEqual([]);
  });
});

type Rect = { x: number; y: number; w: number; h: number };

describe('options persistence', () => {
  const game = useGame();

  it('every option changed survives a reload and is applied', async () => {
    const g = game();
    let s = await g.boot();
    const before = s.settings;
    s = await g.clickNode('options');
    expect(s.scene).toBe('options');
    // The options screen is tabbed: find the tab and row that own each setting, click the tab,
    // point at the row (hover moves focus) and step it forward with the keyboard, as a player would.
    for (const key of ['volume', 'muted', 'shake', 'reduceFlashing', 'timerAssist', 'litanyKey']) {
      const where = await g.api<{ tab: string; index: number } | null>('optionLocate', key);
      expect(where, key).not.toBeNull();
      await g.step(1, 'all'); // nodes are declared on the scene's next update
      const tr = (await g.api<Rect>('nodeRect', `tab.${where!.tab}`))!;
      await g.click(tr.x + tr.w / 2, tr.y + tr.h / 2);
      await g.step(1, 'all');
      const rect = (await g.api<Rect>('nodeRect', `row${where!.index}`))!;
      await g.page.mouse.move(rect.x + rect.w / 2, rect.y + rect.h / 2);
      await g.step(1, 'all');
      s = await g.key('ArrowRight');
      // A slider already at its maximum (shake defaults to 1) steps the other way instead.
      if (s.settings[key] === before[key]) s = await g.key('ArrowLeft');
    }
    const changed = s.settings;
    for (const k of ['volume', 'muted', 'shake', 'reduceFlashing', 'timerAssist', 'litanyKey']) expect(changed[k], k).not.toEqual(before[k]);
    await g.key('Escape');
    s = await g.reload();
    expect(s.settings).toEqual(changed);
    const audio = await g.page.evaluate(() => {
      const a = (window as unknown as { __game: { audio: { volume: number; muted: boolean } } }).__game.audio;
      return { volume: a.volume, muted: a.muted };
    });
    expect(audio).toEqual({ volume: changed.volume, muted: changed.muted });
    // The timer assist reaches the operation; the Litany assist and reduced flashing reach the HUD/post chain.
    await g.api('operation', 'op1-1', true);
    s = await g.step(1);
    expect(s.op?.timeLeft).toBe(Math.round(180 * (changed.timerAssist as number)));
    // Reduced flashing reaches the post-process parameters: the low-vitals pulse is scaled by 0.35.
    await g.page.evaluate(() => {
      const gfx = (window as unknown as { __game: { gfx: { endWorld(p: unknown): void } } }).__game.gfx;
      const orig = gfx.endWorld.bind(gfx);
      gfx.endWorld = (p: unknown) => {
        (window as unknown as { __post: unknown }).__post = p;
        orig(p);
      };
    });
    await g.api('skipPhase');
    await g.api('setVitals', 7);
    await g.step(1, 'last');
    const post = await g.page.evaluate(() => (window as unknown as { __post: { danger: number } }).__post);
    expect(changed.reduceFlashing).toBe(true);
    expect(post.danger).toBeCloseTo(((35 - 7) / 35) * 0.35, 2);
  });
});
