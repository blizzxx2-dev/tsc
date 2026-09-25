/**
 * Shader lab (`?shaderlab`, ENG-0070): every organ kind × every people side by side in one grid,
 * with a light that sweeps round the field, a 1× / 2.5× zoom on the cell under the cursor, and
 * frozen time (F) so screenshots are stable. Baselines live in docs/art/shaderlab/.
 *
 *   Space  pause / resume the light sweep     F  freeze time (pulse and sweep)
 *   Z      zoom 2.5× into the hovered cell    1–5  grade
 */
import type { Game, Scene } from '../core/scene';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { organPalette } from '../render/organs';
import { SPECIES, type Species } from '../surgery/species';
import type { OperationDef, OrganKind } from '../surgery/operation';
import { VIEW_H, VIEW_W } from '../ui/layout';
import { caps, INK } from '../ui/hudKit';
import { reticle } from '../ui/widgets';

const ORGANS: OrganKind[] = ['flesh', 'heart', 'lung', 'gut', 'liver', 'brain', 'bone', 'muscle', 'skin'];
const GRADES = ['candle', 'dawn', 'curse', 'failing', 'neutral'];

const GRID = { x: 110, y: 58, w: VIEW_W - 130, h: VIEW_H - 96 };

export class ShaderLabScene implements Scene {
  private t = 0;
  private sweep = true;
  frozen = false;
  zoom = false;
  grade = 0;
  private focus = { col: 0, row: 0 };

  constructor() {
    const q = new URLSearchParams(location.search);
    if (q.has('frozen')) this.frozen = true;
    if (q.has('zoom')) this.zoom = true;
    const light = q.get('light');
    if (light !== null) {
      this.t = Number(light) * 8;
      this.sweep = false;
    }
  }

  update(dt: number, game: Game): void {
    const k = game.input;
    if (!this.frozen && this.sweep) this.t += dt;
    if (k.keyPressed('Space')) this.sweep = !this.sweep;
    if (k.keyPressed('KeyF')) this.frozen = !this.frozen;
    if (k.keyPressed('KeyZ')) this.zoom = !this.zoom;
    for (let i = 0; i < GRADES.length; i++) if (k.keyPressed(`Digit${i + 1}`)) this.grade = i;
    if (!this.zoom) {
      const c = this.cellAt(k.pos);
      if (c) this.focus = c;
    }
  }

  private cellSize(): { w: number; h: number } {
    return { w: GRID.w / ORGANS.length, h: GRID.h / SPECIES.length };
  }

  private cellAt(p: { x: number; y: number }): { col: number; row: number } | null {
    const { w, h } = this.cellSize();
    const col = Math.floor((p.x - GRID.x) / w);
    const row = Math.floor((p.y - GRID.y) / h);
    return col >= 0 && col < ORGANS.length && row >= 0 && row < SPECIES.length ? { col, row } : null;
  }

  /** Screen rect of a cell, magnified 2.5× about the focused cell when zoomed. */
  private cellRect(col: number, row: number): { x: number; y: number; w: number; h: number } {
    const { w, h } = this.cellSize();
    const r = { x: GRID.x + col * w, y: GRID.y + row * h, w, h };
    if (!this.zoom) return r;
    const z = 2.5;
    const fc = { x: GRID.x + (this.focus.col + 0.5) * w, y: GRID.y + (this.focus.row + 0.5) * h };
    const c = { x: GRID.x + GRID.w / 2, y: GRID.y + GRID.h / 2 };
    return { x: c.x + (r.x - fc.x) * z, y: c.y + (r.y - fc.y) * z, w: w * z, h: h * z };
  }

  render(g: Gfx, game: Game): void {
    g.beginLayer('surface');
    g.endLayer();
    g.beginLayer('fluid');
    g.endLayer();
    g.beginWorld();
    const a = this.t * 0.8;
    const pulse = this.frozen ? 0.4 : Math.exp(-((this.t * 1.2) % 1) * 8);
    ORGANS.forEach((organ, col) =>
      SPECIES.forEach((species: Species, row) => {
        const r = this.cellRect(col, row);
        if (r.x > VIEW_W || r.y > VIEW_H || r.x + r.w < 0 || r.y + r.h < 0) return;
        const pal = organPalette({ organ, race: species } as OperationDef);
        const cx = r.x + r.w / 2;
        const cy = r.y + r.h / 2;
        g.clipRect({ x: Math.max(GRID.x, r.x + 2), y: Math.max(GRID.y, r.y + 2), w: r.w - 4, h: r.h - 4 });
        g.fleshField({
          center: { x: cx, y: cy },
          radii: { x: r.w * 0.46, y: r.h * 0.44 },
          kind: pal.kind,
          base: pal.base,
          deep: pal.deep,
          vein: pal.vein,
          pulse,
          light: { x: cx + Math.cos(a) * r.w * 1.4, y: cy + Math.sin(a) * r.h * 1.4 },
          corrupt: 0,
          cellSoft: pal.cellSoft,
          species: pal.species,
        });
      }),
    );
    g.clipRect(null);
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 0.6, lutA: GRADES[this.grade] });

    // Labels: organs across the top, peoples down the side.
    const { w, h } = this.cellSize();
    if (!this.zoom) {
      ORGANS.forEach((o, i) => caps(g, o, GRID.x + (i + 0.5) * w, GRID.y - 14, 12, hex(INK.goldHi), 'center'));
      SPECIES.forEach((s, i) => caps(g, s, GRID.x - 12, GRID.y + (i + 0.5) * h + 4, 12, hex(INK.goldHi), 'right'));
    } else caps(g, `${SPECIES[this.focus.row]} · ${ORGANS[this.focus.col]} · 2.5×`, VIEW_W / 2, 30, 14, hex(INK.goldHi), 'center');
    caps(g, 'Shader Lab', 20, 30, 16, hex(INK.goldHi));
    const status = `light ${this.sweep ? 'sweeping' : 'held'} · time ${this.frozen ? 'frozen' : 'running'} · grade ${GRADES[this.grade]}`;
    g.text(`${status}    Space sweep  F freeze  Z zoom  1–5 grade`, VIEW_W - 20, VIEW_H - 12, { size: 16, color: hex(INK.dim), align: 'right', shadow: false });
    reticle(g, game.input.pos);
    g.endFrame();
  }
}
