import { describe, expect, it } from 'vitest';
import { Input } from '../../../src/core/input';
import type { Game } from '../../../src/core/scene';
import { bindings } from '../../../src/input/bindings';
import type { InputEventBody } from '../../../src/input/types';
import { InterviewScene, ZOOM } from '../../../src/scenes/interview';
import { INTERVIEW_FOUNDERS } from '../../../src/content/interviews';
import { FORENSIC_SALM } from '../../../src/content/forensics';
import type { InterviewDef } from '../../../src/surgery/interview';

function setup(def: InterviewDef) {
  const input = new Input(null, 1280, 720, bindings);
  const scene = new InterviewScene(def, 'hospice', () => undefined);
  const game: Game = {
    input,
    audio: { play: () => undefined } as unknown as Game['audio'],
    gfx: null as unknown as Game['gfx'],
    go: () => undefined,
    push: () => undefined,
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
  return { scene, frame, tap };
}

describe('interview scene without a mouse (UIX-0192)', () => {
  it('arrows and Enter examine, ask and present', () => {
    const s = setup(INTERVIEW_FOUNDERS);
    s.frame();
    s.tap('key:ArrowDown');
    s.tap('key:Enter');
    expect(s.scene.session.examined.length).toBe(1);
    // Right, into the topics, and ask one.
    for (let i = 0; i < 3 && !s.scene.ui.focus?.startsWith('topic:'); i++) s.tap('key:ArrowRight');
    expect(s.scene.ui.focus).toMatch(/^topic:/);
    s.tap('key:Enter');
    expect(s.scene.session.asked.length).toBe(1);
  });
});

describe('forensic magnifier (INP-0110)', () => {
  it('the bumpers zoom 1–4× and back', () => {
    const s = setup(FORENSIC_SALM);
    s.frame();
    for (let i = 0; i < 10; i++) s.tap('key:PageDown');
    expect(s.scene.zoom).toBe(ZOOM.max);
    for (let i = 0; i < 10; i++) s.tap('pad:4');
    expect(s.scene.zoom).toBe(ZOOM.min);
  });

  it('the wheel over the sheet zooms about the cursor, and the places move out from it', () => {
    const s = setup(FORENSIC_SALM);
    s.frame([{ type: 'move', x: 230, y: 300 } as never]);
    const before = s.scene.ui.node('region:chest')!.rect;
    s.frame([{ type: 'wheel', code: 'wheel:up' } as never]);
    for (let i = 0; i < 60; i++) s.frame();
    expect(s.scene.zoom).toBeGreaterThan(1);
    const after = s.scene.ui.node('region:chest')?.rect;
    if (after) expect(Math.hypot(after.x - 230, after.y - 300)).toBeGreaterThan(Math.hypot(before.x - 230, before.y - 300));
  });
});

describe('palpation (INP-0109)', () => {
  it('a click alone does not examine; a hold-and-sweep over the place does', () => {
    const s = setup(INTERVIEW_FOUNDERS);
    s.frame();
    const n = s.scene.ui.node('region:gums')!;
    const c = { x: n.rect.x + 18, y: n.rect.y + 18 };
    s.frame([{ type: 'move', x: c.x, y: c.y, src: 'kbm' } as never]);
    s.frame([{ type: 'down', code: 'mouse:0' }]);
    s.frame([{ type: 'up', code: 'mouse:0' }]);
    expect(s.scene.session.examined).not.toContain('gums');
    s.frame([{ type: 'down', code: 'mouse:0' }]);
    for (let y = -22; y <= 22; y += 6) {
      s.frame([{ type: 'move', x: c.x - 22, y: c.y + y, src: 'kbm' } as never]);
      s.frame([{ type: 'move', x: c.x + 22, y: c.y + y, src: 'kbm' } as never]);
    }
    s.frame([{ type: 'up', code: 'mouse:0' }]);
    expect(s.scene.session.examined).toContain('gums');
  });
});
