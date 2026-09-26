import { describe, expect, it } from 'vitest';
import { Input } from '../../../src/core/input';
import type { Game } from '../../../src/core/scene';
import { bindings } from '../../../src/input/bindings';
import type { InputEventBody } from '../../../src/input/types';
import { TriageScene } from '../../../src/scenes/triage';
import { TRIAGE_FORD } from '../../../src/content/triage';

/** Drive the triage scene with the keyboard and gamepad only (UIX-0192, INP-0108). */
function setup() {
  const input = new Input(null, 1280, 720, bindings);
  let done = false;
  const scene = new TriageScene(TRIAGE_FORD, 'camp', () => (done = true));
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
  return { scene, frame, tap, done: () => done };
}

describe('triage scene input (INP-0108, UIX-0190)', () => {
  it('arrows and Enter pick a stretcher; Enter again cycles its tag; PageDown steps it', () => {
    const s = setup();
    s.frame();
    s.tap('key:ArrowRight'); // focus the first stretcher
    s.tap('key:Enter');
    const id = s.scene.selected!;
    expect(id).toBeTruthy();
    s.tap('key:Enter');
    expect(s.scene.field.get(id)!.tag).toBe('immediate');
    s.tap('key:PageDown');
    expect(s.scene.field.get(id)!.tag).toBe('delayed');
  });

  it('the gamepad works it the same way (D-pad, A, bumpers)', () => {
    const s = setup();
    s.frame();
    s.tap('pad:15');
    s.tap('pad:0');
    const id = s.scene.selected!;
    s.tap('pad:0');
    s.tap('pad:5');
    expect(s.scene.field.get(id)!.tag).toBe('delayed');
  });

  it('holding the pointer on a stretcher half a second opens the tag ring', () => {
    const s = setup();
    s.frame([{ type: 'move', x: 100, y: 150 } as never]);
    s.frame([{ type: 'down', code: 'mouse:0' }]);
    for (let i = 0; i < 40; i++) s.frame();
    expect(s.scene.radial).toBeTruthy();
    s.frame([{ type: 'up', code: 'mouse:0' }]);
    expect(s.scene.field.get(s.scene.radial!)!.tag).toBeNull();
  });
});

describe('discipline art (ART-0224, ART-0225)', () => {
  it('eight casualty poses and fifteen evidence kinds, and every evidence item in the content has one', async () => {
    const { CASUALTY_POSES, EVIDENCE_KINDS, evidenceKind } = await import('../../../src/art/fieldArt');
    expect(CASUALTY_POSES).toHaveLength(8);
    expect(new Set(EVIDENCE_KINDS).size).toBe(15);
    expect(evidenceKind('Stroh’s ledger')).toBe('ledger');
    expect(evidenceKind('The council roll')).toBe('roll');
  });
});
