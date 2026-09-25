/**
 * VFX board (`?scene=vfxlab`): every effect in `VFX_SPECS` looping in its own cell on a flesh swatch,
 * labelled with its id, task, frames/fps and blend. `?t=<s>` freezes the clock for screenshots.
 */
import type { Game, Scene } from '../core/scene';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { Particles, type FxKind } from '../render/particles';
import { VIEW_H, VIEW_W } from '../ui/layout';
import { drawVfxSample, VFX_SPECS } from './vfx';

const COLS = 7;
const PARTICLE_FX: Record<string, { kind: FxKind; n: number; dir?: number }> = {
  'blood-droplet': { kind: 'blood', n: 12 },
  'brand-sparks': { kind: 'spark', n: 10 },
  'curse-mote': { kind: 'mote', n: 6 },
  'sigil-embers': { kind: 'ember', n: 5, dir: -Math.PI / 2 },
  'litany-dust': { kind: 'dust', n: 4 },
  'brand-kill-pop': { kind: 'mote', n: 8 },
};

export class VfxLabScene implements Scene {
  private t = 0;
  private frozen = false;
  private parts = new Particles();
  private spawnT = 0;

  constructor() {
    const q = new URLSearchParams(location.search);
    if (q.get('t')) {
      this.t = Number(q.get('t'));
      this.frozen = true;
      // Pre-roll the particle cells so a frozen frame still shows them.
      for (let s = 0; s < 1.2; s += 1 / 30) this.step(1 / 30);
    }
  }

  private cell(i: number): { x: number; y: number; w: number; h: number } {
    const w = VIEW_W / COLS;
    const h = (VIEW_H - 20) / Math.ceil(VFX_SPECS.length / COLS);
    return { x: (i % COLS) * w, y: Math.floor(i / COLS) * h, w, h };
  }

  private step(dt: number): void {
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 0.6;
      VFX_SPECS.forEach((s, i) => {
        const p = PARTICLE_FX[s.id];
        if (!p) return;
        const c = this.cell(i);
        this.parts.spawn({ kind: p.kind, pos: { x: c.x + c.w / 2, y: c.y + c.h / 2 }, n: p.n, dir: p.dir, spread: p.dir !== undefined ? 0.5 : undefined });
      });
    }
    this.parts.update(dt, () => undefined);
  }

  update(dt: number): void {
    if (this.frozen) return;
    this.t += dt;
    this.step(dt);
  }

  render(g: Gfx, _game: Game): void {
    g.beginScreen([0.05, 0.03, 0.03]);
    VFX_SPECS.forEach((s, i) => {
      const c = this.cell(i);
      g.rect(c.x + 2, c.y + 2, c.w - 4, c.h - 4, hex(i % 2 ? '#6a2a24' : '#5a2420'));
      g.pushClip({ x: c.x + 2, y: c.y + 2, w: c.w - 4, h: c.h - 4 });
      const life = s.lifetime || 1.5;
      drawVfxSample(g, s.id, c.x + c.w / 2, c.y + c.h / 2 + 4, this.t % (life + 0.4), c);
      g.popClip();
      g.text(s.id, c.x + 8, c.y + 18, { size: 16, color: hex('#f0e4c8'), shadow: hex('#000000', 0.9) });
      g.text(`${s.task} · ${s.frames || '∞'}f @${s.fps} · ${s.blend}`, c.x + 8, c.y + c.h - 8, { size: 16, color: hex('#c8b890', 0.9), shadow: hex('#000000', 0.9) });
    });
    this.parts.draw(g);
    g.endFrame();
  }
}
