import { describe, expect, it } from 'vitest';
import { Input } from '../../../src/core/input';
import type { Game, Scene } from '../../../src/core/scene';
import { bindings } from '../../../src/input/bindings';
import type { InputEventBody } from '../../../src/input/types';
import { TrialsScene } from '../../../src/scenes/trials';
import { progress } from '../../../src/surgery/session';

function setup() {
  const input = new Input(null, 1280, 720, bindings);
  const went: Scene[] = [];
  const scene = new TrialsScene();
  const game: Game = {
    input,
    audio: { play: () => undefined } as unknown as Game['audio'],
    gfx: null as unknown as Game['gfx'],
    go: (s: Scene) => void went.push(s),
  };
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
  return { scene, frame, tap, went };
}

describe('Trials board (UIX-0186)', () => {
  it('opens on the Journeyman tier; arrows and Enter start a trial; the bumpers step between the open tabs only', () => {
    const was = progress.chaptersCleared;
    progress.chaptersCleared = 2;
    try {
      const s = setup();
      s.frame();
      expect(s.scene.tier).toBe('journeyman');
      s.tap('key:PageDown');
      expect(s.scene.tier).toBe('loom'); // the shut tiers are skipped; the Loom opens with the Journeyman
      s.tap('key:PageUp');
      expect(s.scene.tier).toBe('journeyman');
      // Down from the tabs to the first bill.
      for (let i = 0; i < 3 && !s.scene.ui.focus?.startsWith('bill:'); i++) s.tap('key:ArrowDown');
      expect(s.scene.ui.focus).toMatch(/^bill:/);
      s.tap('key:Enter');
      expect(s.went.length).toBe(1);
    } finally {
      progress.chaptersCleared = was;
    }
  });
});
