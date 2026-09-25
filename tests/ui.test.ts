import { describe, expect, it } from 'vitest';
import { Ui, nearestInDirection, type UiInput, type UiNode } from '../src/ui/kit';
import type { ActionId } from '../src/input/actions';
import { Input } from '../src/core/input';
import { Bindings } from '../src/input/bindings';
import { SceneStack, type Game, type Scene } from '../src/core/scene';
import { PauseScene } from '../src/scenes/pause';
import { OptionsScene } from '../src/scenes/options';
import { ConfirmScene } from '../src/scenes/confirm';
import { Operation } from '../src/surgery/operation';
import { allOperations } from '../src/content/campaign';
import { uiEvents } from '../src/ui/events';
import { Transition } from '../src/ui/transition';
import { ellipsize, wrapLines } from '../src/ui/text';
import { tooltipRect } from '../src/ui/controls';
import { settings } from '../src/core/settings';

/** A scripted UiInput: set fields, call `tick`. */
function fakeInput(): UiInput & { acts: Set<ActionId> } {
  const acts = new Set<ActionId>();
  return {
    pos: { x: -100, y: -100 },
    down: false,
    pressed: false,
    released: false,
    wheel: 0,
    device: 'kbm',
    acts,
    actPressed: (id) => acts.has(id),
    actRepeated: (id) => acts.has(id),
  };
}

const at = (inp: ReturnType<typeof fakeInput>, x: number, y: number, o: Partial<UiInput> = {}, acts: ActionId[] = []) => {
  inp.pos = { x, y };
  inp.pressed = o.pressed ?? false;
  inp.released = o.released ?? false;
  inp.down = o.down ?? false;
  inp.acts.clear();
  acts.forEach((a) => inp.acts.add(a));
};

function menu(ui: Ui, log: string[]): void {
  ui.begin();
  ui.button('a', { x: 100, y: 100, w: 200, h: 40 }, 'A', () => log.push('a'));
  ui.button('b', { x: 100, y: 150, w: 200, h: 40 }, 'B', () => log.push('b'));
  ui.button('c', { x: 100, y: 200, w: 200, h: 40 }, 'C', () => log.push('c'));
}

describe('UI context: update/draw split and activate-on-release (UIX-0003/0005)', () => {
  it('a button fires once, on release inside the rect it was pressed in', () => {
    const ui = new Ui();
    const log: string[] = [];
    const inp = fakeInput();
    const step = () => {
      menu(ui, log);
      ui.update(inp, 1 / 60);
    };
    at(inp, 150, 120, { pressed: true, down: true });
    step();
    expect(log).toEqual([]); // not on press
    at(inp, 150, 120, { down: true });
    step();
    at(inp, 150, 120, { released: true });
    step();
    expect(log).toEqual(['a']);
    step();
    expect(log).toEqual(['a']);
  });

  it('press inside, release outside (or on another button) does nothing — no click-through', () => {
    const ui = new Ui();
    const log: string[] = [];
    const inp = fakeInput();
    const step = () => {
      menu(ui, log);
      ui.update(inp, 1 / 60);
    };
    at(inp, 150, 120, { pressed: true, down: true });
    step();
    at(inp, 150, 170, { released: true });
    step();
    expect(log).toEqual([]);
    // A release arriving without a press (the click that opened this scene) is ignored too.
    at(inp, 150, 170, { released: true });
    step();
    expect(log).toEqual([]);
  });

  it('input is processed in update only: the node list and state are readable without a renderer', () => {
    const ui = new Ui();
    const inp = fakeInput();
    menu(ui, []);
    at(inp, 150, 170);
    ui.update(inp, 1 / 60);
    expect(ui.nodes.map((n) => n.id)).toEqual(['a', 'b', 'c']);
    expect(ui.state('b').hover).toBe(true);
  });
});

describe('focus navigation (UIX-0004)', () => {
  it('arrows move focus to the nearest node in that direction and wrap in columns; Enter activates', () => {
    const ui = new Ui();
    const log: string[] = [];
    const inp = fakeInput();
    const step = (acts: ActionId[]) => {
      at(inp, -100, -100, {}, acts);
      menu(ui, log);
      ui.update(inp, 1 / 60);
    };
    step(['ui.down']); // nothing focused yet → first node
    expect(ui.focus).toBe('a');
    step(['ui.down']);
    expect(ui.focus).toBe('b');
    step(['ui.down']);
    step(['ui.down']); // wraps
    expect(ui.focus).toBe('a');
    step(['ui.up']); // wraps back
    expect(ui.focus).toBe('c');
    step(['ui.confirm']);
    expect(log).toEqual(['c']);
    expect(ui.navMode).toBe(true);
  });

  it('nearestInDirection prefers aligned neighbours over closer diagonal ones', () => {
    const n = (id: string, x: number, y: number): UiNode => ({ id, kind: 'button', rect: { x, y, w: 100, h: 40 }, label: id, enabled: true });
    const grid = [n('tl', 0, 0), n('tr', 200, 0), n('bl', 0, 100), n('br', 200, 100), n('far', 600, 10)];
    expect(nearestInDirection(grid[0].rect, grid, 'right', 'tl')?.id).toBe('tr');
    expect(nearestInDirection(grid[0].rect, grid, 'down', 'tl')?.id).toBe('bl');
    expect(nearestInDirection(grid[3].rect, grid, 'up', 'br')?.id).toBe('tr');
    expect(nearestInDirection(grid[0].rect, grid, 'left', 'tl')).toBeNull();
  });

  it('left/right adjust a focused stepper, slider or toggle instead of moving focus', () => {
    const ui = new Ui();
    const inp = fakeInput();
    let v = 0;
    let frac = 0.5;
    const step = (acts: ActionId[]) => {
      at(inp, -100, -100, {}, acts);
      ui.begin();
      ui.stepper('s', { x: 0, y: 0, w: 300, h: 40 }, 'S', String(v), (d) => (v += d));
      ui.slider('v', { x: 0, y: 50, w: 300, h: 40 }, 'V', frac, (f) => (frac = f));
      ui.update(inp, 1 / 60);
    };
    step(['ui.down']);
    step(['ui.right']);
    step(['ui.right']);
    expect(v).toBe(2);
    step(['ui.down']);
    step(['ui.left']);
    expect(frac).toBeCloseTo(0.4);
  });

  it('pointer movement moves focus, so mouse and keyboard share one highlight; disabled nodes are skipped', () => {
    const ui = new Ui();
    const inp = fakeInput();
    const step = (x: number, y: number, acts: ActionId[] = []) => {
      at(inp, x, y, {}, acts);
      ui.begin();
      ui.button('a', { x: 0, y: 0, w: 100, h: 40 }, 'A', () => undefined);
      ui.button('b', { x: 0, y: 50, w: 100, h: 40 }, 'B', () => undefined, { enabled: false });
      ui.button('c', { x: 0, y: 100, w: 100, h: 40 }, 'C', () => undefined);
      ui.update(inp, 1 / 60);
    };
    step(-10, -10);
    step(50, 120);
    expect(ui.focus).toBe('c');
    step(50, 120, ['ui.up']);
    expect(ui.focus).toBe('a');
  });

  it('emits ui.focus and ui.confirm events for the audio layer (UIX-0010)', () => {
    const seen: string[] = [];
    const off = [uiEvents.on('ui.focus', (e) => seen.push(`focus:${e.id}`)), uiEvents.on('ui.confirm', (e) => seen.push(`confirm:${e.id}`))];
    const ui = new Ui('t');
    const inp = fakeInput();
    at(inp, -1, -1, {}, ['ui.down']);
    menu(ui, []);
    ui.update(inp, 1 / 60);
    at(inp, -1, -1, {}, ['ui.confirm']);
    menu(ui, []);
    ui.update(inp, 1 / 60);
    off.forEach((f) => f());
    expect(seen).toEqual(['focus:t/a', 'confirm:t/a']);
  });
});

describe('tooltips and text bounds (UIX-0008/0011)', () => {
  it('tooltips appear after 400 ms of hover, instantly on keyboard focus', () => {
    const ui = new Ui();
    const inp = fakeInput();
    const step = (x: number, acts: ActionId[] = [], dt = 0.1) => {
      at(inp, x, 20, {}, acts);
      ui.begin();
      ui.button('a', { x: 0, y: 0, w: 100, h: 40 }, 'A', () => undefined, { tip: 'Tip A' });
      ui.update(inp, dt);
    };
    step(-50);
    step(50);
    expect(ui.tipNode()).toBeUndefined();
    step(50, [], 0.2);
    step(50, [], 0.25);
    expect(ui.tipNode()?.id).toBe('a');
    const kb = new Ui();
    at(inp, -50, -50, {}, ['ui.down']);
    kb.begin();
    kb.button('a', { x: 0, y: 0, w: 100, h: 40 }, 'A', () => undefined, { tip: 'Tip A' });
    kb.update(inp, 1 / 60);
    expect(kb.tipNode()?.id).toBe('a');
  });

  it('tooltip rects flip at the screen edges', () => {
    const view = { x: 0, y: 0, w: 1280, h: 720 };
    expect(tooltipRect({ x: 100, y: 100, w: 50, h: 30 }, 300, 80, view).x).toBeGreaterThan(150);
    const r = tooltipRect({ x: 1150, y: 100, w: 100, h: 30 }, 300, 80, view);
    expect(r.x + r.w).toBeLessThanOrEqual(1150);
    const low = tooltipRect({ x: 500, y: 690, w: 50, h: 20 }, 300, 80, view);
    expect(low.y + low.h).toBeLessThanOrEqual(712);
  });

  it('ellipsize trims to the width; wrapLines never exceeds it for multi-word text', () => {
    const m = (s: string) => s.length * 10;
    expect(ellipsize(m, 'short', 100)).toBe('short');
    const cut = ellipsize(m, 'a much longer label', 100);
    expect(m(cut)).toBeLessThanOrEqual(100);
    expect(cut.endsWith('…')).toBe(true);
    for (const l of wrapLines(m, 'one two three four five six', 100)) expect(m(l)).toBeLessThanOrEqual(100);
  });
});

describe('modal stack (UIX-0007)', () => {
  function rig() {
    const input = new Input(null, 1280, 720, new Bindings(null));
    const g: Game = { input, audio: { play: () => undefined } as unknown as Game['audio'], gfx: null as unknown as Game['gfx'], go: () => undefined };
    const stack = new SceneStack(g);
    g.push = (s) => stack.push(s);
    g.pop = () => stack.pop();
    let t = 1000;
    const frame = (code?: string) => {
      t += 1000 / 60;
      if (code) input.push({ t: t - 1, type: 'down', code: code as never });
      input.beginFrame(t, 1 / 60);
      stack.update(1 / 60);
      input.endFrame();
      if (code) {
        input.push({ t: t + 1, type: 'up', code: code as never });
        t += 1000 / 60;
        input.beginFrame(t, 1 / 60);
        stack.update(1 / 60);
        input.endFrame();
      }
    };
    return { g, stack, frame };
  }
  class Base implements Scene {
    updates = 0;
    update(): void {
      this.updates++;
    }
    render(): void {}
  }

  it('Esc in Options-over-Pause returns to Pause, not gameplay; a second Esc resumes', () => {
    const { g, stack, frame } = rig();
    const base = new Base();
    stack.go(base);
    const results: string[] = [];
    const op = new Operation(allOperations()[0]);
    stack.push(new PauseScene(op, [], (r) => results.push(r)));
    frame();
    g.push!(new OptionsScene(() => g.pop!(), 'overlay'));
    frame();
    expect(stack.top).toBeInstanceOf(OptionsScene);
    const baseUpdates = base.updates;
    frame('key:Escape');
    expect(stack.top).toBeInstanceOf(PauseScene);
    expect(results).toEqual([]);
    expect(base.updates).toBe(baseUpdates); // input never reached the layer underneath
    frame('key:Escape');
    expect(stack.top).toBe(base);
    expect(results).toEqual(['resume']);
  });

  it('a confirm dialog answers No on Esc and pops only itself', () => {
    const { stack, frame } = rig();
    const base = new Base();
    stack.go(base);
    const answers: string[] = [];
    stack.push(new ConfirmScene({ message: 'Sure?', onYes: () => answers.push('yes'), onNo: () => answers.push('no') }));
    frame();
    frame('key:Escape');
    expect(answers).toEqual(['no']);
    expect(stack.top).toBe(base);
  });

  it('Enter on a confirm dialog answers the focused default', () => {
    const { stack, frame } = rig();
    stack.go(new Base());
    const answers: string[] = [];
    stack.push(new ConfirmScene({ message: 'Sure?', danger: true, onYes: () => answers.push('yes'), onNo: () => answers.push('no') }));
    frame();
    frame('key:Enter');
    expect(answers).toEqual(['no']); // destructive dialogs default to No
  });
});

describe('scene transitions (UIX-0009)', () => {
  it('swaps at the midpoint, blocks while running and ignores a second request', () => {
    const tr = new Transition(0.3);
    let swaps = 0;
    expect(tr.request(() => swaps++)).toBe(true);
    expect(tr.busy).toBe(true);
    expect(tr.request(() => swaps++)).toBe(false); // double click
    for (let i = 0; i < 8; i++) tr.update(1 / 60);
    expect(swaps).toBe(0);
    for (let i = 0; i < 4; i++) tr.update(1 / 60);
    expect(swaps).toBe(1);
    for (let i = 0; i < 12; i++) tr.update(1 / 60);
    expect(tr.busy).toBe(false);
    expect(swaps).toBe(1);
  });

  it('is instant with Reduced Motion', () => {
    const prev = settings.reduceMotion;
    settings.reduceMotion = true;
    try {
      const tr = new Transition(0.3);
      let swaps = 0;
      tr.request(() => swaps++);
      expect(swaps).toBe(1);
      expect(tr.busy).toBe(false);
    } finally {
      settings.reduceMotion = prev;
    }
  });
});
