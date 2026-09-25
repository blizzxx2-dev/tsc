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
import { drawFieldTool, drawTipDebug, toolGlyph } from './toolSprites';
import { busyCursor, padCursorRing } from './cursors';
import { padGlyph } from './padGlyphs';
import { dawnFlare, flareIntensity, lightThread, MATINS_DEATH_FRAMES, matinsDeathEye, matinsUnravel } from './bossVfx';
import { PAD_GLYPHS } from '../input/glyphs';
import { reticle } from '../ui/widgets';
import type { ToolId } from '../surgery/types';

const TOOLS: ToolId[] = ['lancet', 'tongs', 'leech', 'thread', 'salve', 'tincture', 'brand', 'lens'];

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
  private page: 'vfx' | 'tools' | 'bosses' = 'vfx';

  constructor() {
    const q = new URLSearchParams(location.search);
    if (q.get('page') === 'tools' || q.get('page') === 'bosses') this.page = q.get('page') as 'tools' | 'bosses';
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
    if (this.page === 'tools') return this.tools(g);
    if (this.page === 'bosses') return this.bosses(g);
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

  /** ART-0269/0270/0271/0273: in-field instruments with their tip debug, cursors and pad glyphs. */
  private tools(g: Gfx): void {
    const t = this.t;
    g.rect(0, 0, VIEW_W, 300, hex('#6a2a24'));
    TOOLS.forEach((tool, i) => {
      const p = { x: 90 + i * 150, y: 150 };
      const trail = tool === 'thread' ? Array.from({ length: 12 }, (_, k) => ({ x: p.x - 60 + k * 5, y: p.y + 30 - Math.sin(k * 0.6) * 20 })) : undefined;
      drawFieldTool(g, tool, p, { closed: false, heat: 0.8, trail }, t);
      drawTipDebug(g, tool, p);
      g.text(tool, p.x, 250, { size: 16, color: hex('#f0e4c8'), align: 'center' });
      if (tool === 'tongs') {
        drawFieldTool(g, tool, { x: p.x, y: 70 }, { closed: true }, t);
        g.text('closed', p.x + 40, 60, { size: 16, color: hex('#f0e4c8') });
      }
    });
    // Cursors: quill, crosshair, busy hourglass, the pad ring round each.
    reticle(g, { x: 80, y: 360 });
    reticle(g, { x: 180, y: 360 }, '#9fe0a8');
    busyCursor(g, { x: 280, y: 360 }, t);
    padCursorRing(g, { x: 420, y: 360 }, t);
    reticle(g, { x: 420, y: 360 });
    g.text('quill · crosshair · busy · pad ring', 60, 420, { size: 16, color: hex('#f0e4c8') });
    TOOLS.forEach((tool, i) => toolGlyph(g, tool, 640 + i * 40, 360));
    g.text('32 px glyphs', 640, 400, { size: 16, color: hex('#f0e4c8') });
    // Glyph sets.
    (['xbox', 'playstation', 'deck'] as const).forEach((fam, row) => {
      let x = 40;
      const y = 480 + row * 70;
      g.text(fam, x, y - 26, { size: 16, color: hex('#f0e4c8') });
      for (let i = 0; i < 16; i++) x += padGlyph(g, fam, i, x, y, 16) + 8;
      void PAD_GLYPHS;
    });
    g.endFrame();
  }

  /** ART-0233/0237/0238: the Matins death frames, the Lauds light-thread states and the dawn flare. */
  private bosses(g: Gfx): void {
    const t = this.t;
    // Matins death: every third of the 24 frames.
    for (let i = 0; i < 8; i++) {
      const f = Math.min(MATINS_DEATH_FRAMES - 1, i * 3 + (i === 7 ? 2 : 0));
      const x = 80 + i * 160;
      g.creature(0, x, 120, 150, { seed: 3, dissolve: f / (MATINS_DEATH_FRAMES - 1), open: matinsDeathEye(f), health: 0.6 });
      matinsUnravel(g, x, 120, 150, f, 3);
      g.text(`frame ${f + 1}`, x, 230, { size: 16, color: hex('#f0e4c8'), align: 'center' });
    }
    // Light-thread: blazing, dim, severing, tying off.
    const rows: [string, Parameters<typeof lightThread>[4]][] = [
      ['linked', { bright: 0.75, sever: null, tie: null }],
      ['dim beat', { bright: 0.18, sever: null, tie: null }],
      ['sever', { bright: 0.75, sever: 0.3, tie: null }],
      ['tie-off', { bright: 0.75, sever: null, tie: 0.9 }],
    ];
    rows.forEach(([label, st], i) => {
      const y = 290 + i * 60;
      lightThread(g, { x: 60, y }, { x: 560, y: y + 10 }, t, st);
      g.text(label, 580, y + 8, { size: 16, color: hex('#f0e4c8') });
    });
    // Dawn flare at its peak over a small field, with the lens washed out.
    g.pushClip({ x: 700, y: 260, w: 560, h: 300 });
    g.rect(700, 260, 560, 300, hex('#5a2420'));
    dawnFlare(g, { x: 700, y: 260, w: 560, h: 300 }, { x: 980, y: 300 }, flareIntensity(0.25, 2), 0, 1, { x: 1100, y: 440 }, 60);
    g.popClip();
    g.text('dawn flare (peak) + lens white-out', 710, 580, { size: 16, color: hex('#f0e4c8') });
    g.endFrame();
  }
}
