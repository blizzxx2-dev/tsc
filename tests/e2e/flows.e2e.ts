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

const RESULTS = { continue: { x: 840, y: 650 }, retry: (hasNext: boolean) => ({ x: hasNext ? 640 : 530, y: 650 }), leave: { x: 420, y: 652 } };

describe('new game flow', () => {
  const game = useGame();

  it('title → prologue → op1-1 won with real mouse gestures → results → s1-2, saving progress at each step', async () => {
    const g = game();
    let s = await g.boot();
    expect(s.scene).toBe('title');
    expect(s.save.progress).toEqual({ chapter: 0, step: 0 });

    s = await g.click(640, 390); // Take the Oath
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
    expect(s.scene).toBe('story');
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
    s = await g.click(640, 390); // Continue (first button when a campaign is in progress)
    expect(s.scene).toBe('briefing');
    expect(s.save.progress).toEqual(saved);
    s = await g.key('Enter');
    expect(s.op?.id).toBe('op1-3');
  });

  it('a reload during a story resumes that story step', async () => {
    const g = game();
    await g.boot('?preset=ch2-start');
    let s = await g.click(640, 390);
    expect(s.scene).toBe('story');
    const story = s.story?.id;
    s = await g.reload();
    s = await g.click(640, 390);
    expect(s.scene).toBe('story');
    expect(s.story?.id).toBe(story);
  });

  it('quitting mid-operation resumes at that operation’s briefing', async () => {
    const g = game();
    await g.boot('?preset=pre-matins');
    let s = await g.click(640, 390);
    expect(s.scene).toBe('briefing');
    s = await g.key('Enter');
    expect(s.op?.id).toBe('op1-5');
    await g.step(120);
    s = await g.key('Escape');
    expect(s.paused).toBe(true);
    s = await g.click(640, 490); // Abandon the Patient
    expect(s.scene).toBe('title');
    s = await g.reload();
    s = await g.click(640, 390); // Continue
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
    let s = await g.until('results', (st) => st.scene === 'results', 400);
    await g.step(70);
    s = await g.click(RESULTS.retry(false).x, RESULTS.retry(false).y); // Try Again → straight back into the operation
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
      let s = await g.click(640, 390); // Continue → op1-3 briefing
      expect(s.scene).toBe('briefing');
      s = await g.key('Enter');
      expect(s.scene).toBe('operation');
      await g.step(90, 'last');
      s = await g.key('Escape');
      expect(s.paused).toBe(true);
      s = await g.click(640, 490); // Abandon the Patient
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

describe('options persistence', () => {
  const game = useGame();

  it('every option changed survives a reload and is applied', async () => {
    const g = game();
    let s = await g.boot();
    const before = s.settings;
    s = await g.click(640, 390 + 60 * 2); // Options (fresh save: Take the Oath, Operating Theatre, Options)
    expect(s.scene).toBe('options');
    // Rows start at y=170 and are 58 apart; the right half of a row steps forward.
    for (let row = 0; row < 6; row++) s = await g.click(900, 170 + row * 58 + 25);
    const changed = s.settings;
    for (const k of ['volume', 'muted', 'shake', 'reduceFlashing', 'timerAssist', 'litanyKey']) expect(changed[k], k).not.toEqual(before[k]);
    s = await g.key('Escape');
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
  });
});
