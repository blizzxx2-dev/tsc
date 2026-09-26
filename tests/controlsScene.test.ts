import { afterEach, describe, expect, it } from 'vitest';
import { Input } from '../src/core/input';
import type { Game } from '../src/core/scene';
import { bindings } from '../src/input/bindings';
import { ControlsScene } from '../src/input/controlsScene';
import { toolKeyLabel } from '../src/input/glyphs';
import type { InputEventBody } from '../src/input/types';

/** Drive the Controls screen with keyboard/gamepad events only (INP-0072). */
function setup() {
  const input = new Input(null, 1280, 720, bindings);
  let backed = false;
  const scene = new ControlsScene(() => (backed = true));
  const game: Game = { input, audio: { play: () => undefined } as unknown as Game['audio'], gfx: null as unknown as Game['gfx'], go: () => undefined };
  let t = 1000;
  const frame = (evs: InputEventBody[] = [], dt = 1 / 60) => {
    evs.forEach((e, i) => input.push({ ...e, t: t + 1 + i } as never));
    t += dt * 1000;
    input.beginFrame(t, dt);
    scene.update(dt, game);
  };
  const tap = (code: string) => {
    frame([{ type: 'down', code }]);
    frame([{ type: 'up', code }]);
  };
  return { scene, frame, tap, backed: () => backed };
}

afterEach(() => {
  bindings.resetAll();
});

describe('rebinding screen', () => {
  it('captures a new key for an instrument and the tray label follows', () => {
    const s = setup();
    s.tap('key:ArrowDown');
    s.tap('key:ArrowDown'); // Instrument 1 row (after Use instrument, Hold)
    s.tap('key:Enter');
    s.tap('key:KeyZ');
    expect(bindings.get('tool.select.1').kbm).toEqual(['key:KeyZ']);
    expect(toolKeyLabel(1)).toBe('Z');
  });

  it('offers Swap on a conflict and trades the bindings', () => {
    const s = setup();
    s.tap('key:ArrowDown');
    s.tap('key:ArrowDown');
    s.tap('key:Enter');
    s.tap('key:KeyE'); // already "Next instrument"
    expect(bindings.get('tool.select.1').kbm).toEqual(['key:Digit1']);
    s.tap('key:Enter'); // Swap
    expect(bindings.get('tool.select.1').kbm).toEqual(['key:KeyE']);
    expect(bindings.get('tool.next').kbm[0]).toBe('key:Digit1');
  });

  it('Esc cancels a capture and the capture times out after 5 s', () => {
    const s = setup();
    s.tap('key:ArrowDown');
    s.tap('key:ArrowDown');
    s.tap('key:Enter');
    s.tap('key:Escape');
    expect(bindings.isDefault('tool.select.1')).toBe(true);
    expect(s.backed()).toBe(false);
    s.tap('key:Enter');
    for (let i = 0; i < 6 * 60; i++) s.frame();
    s.tap('key:KeyZ'); // after the timeout this is just a key press, not a binding
    expect(bindings.isDefault('tool.select.1')).toBe(true);
  });

  it('reserved inputs refuse to move', () => {
    const s = setup();
    s.tap('key:Enter'); // Use instrument, keyboard slot 1 = left mouse (reserved)
    s.tap('key:KeyZ');
    expect(bindings.get('primary').kbm).toEqual(['mouse:0']);
  });

  it('works with a gamepad: D-pad to the gamepad column, A to capture, a button to bind', () => {
    const s = setup();
    for (let i = 0; i < 10; i++) s.tap('key:ArrowDown'); // Next instrument row
    s.tap('pad:15');
    s.tap('pad:15');
    s.tap('pad:0');
    s.tap('pad:11');
    expect(bindings.get('tool.next').pad).toEqual(['pad:11']);
  });

  it('Reset row / Reset all and Back from the footer', () => {
    const s = setup();
    bindings.assign('primary', { kind: 'kbm', index: 1 }, 'key:KeyF');
    s.tap('key:ArrowUp'); // wraps to the footer
    s.tap('key:ArrowRight'); // Reset all
    s.tap('key:Enter');
    expect(bindings.isDefault('primary')).toBe(true);
    s.tap('key:ArrowRight');
    s.tap('key:Enter');
    expect(s.backed()).toBe(true);
  });

  it('tabs switch with PageUp/PageDown and handling options change with left/right', () => {
    const s = setup();
    for (let i = 0; i < 4; i++) s.tap('key:PageDown');
    const before = bindings.prefs.holdMode;
    s.tap('key:ArrowRight');
    expect(bindings.prefs.holdMode).not.toBe(before);
    s.tap('key:ArrowRight');
    expect(bindings.prefs.holdMode).toBe(before);
  });
});
