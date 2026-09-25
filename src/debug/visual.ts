/**
 * Visual debug overlays for dev/QA builds (ENG-0232, ENG-0233), drawn on the global overlay host:
 *
 * - F2 (or `overlay on`): entity hit shapes (the true `hitTest` outline, sampled) with kind#id,
 *   the FIELD / opening ellipse, this frame's pointer path samples, the camera bounds, and draw
 *   calls per frame section (layers, world, post, ui) with flush reasons;
 * - Shift+F2 (or `targets on`): the render-target viewer — thumbnails of the world target, bloom
 *   mips, data layers, decal maps, LUTs, the glyph atlas and baked noise; click one to enlarge it.
 */
import type { Vec } from '../core/math';
import type { Game } from '../core/scene';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import type { OverlayHost } from '../ui/overlayHost';
import { OperationScene } from '../scenes/operation';
import { FIELD } from '../surgery/operation';
import type { Entity } from '../surgery/entity';
import { entityView } from './state';

type DebugTex = { name: string; tex: WebGLTexture; w: number; h: number; flip: boolean };

const GREEN = hex('#50ff90', 0.9);
const CYAN = hex('#60d8ff', 0.9);
const AMBER = hex('#ffc050', 0.95);

/** Outline points of an entity's hit region, sampled on a grid around it (spacing `step`). */
export function hitOutline(e: Pick<Entity, 'pos' | 'hitTest'>, reach = 140, step = 6): Vec[] {
  const out: Vec[] = [];
  const n = Math.ceil(reach / step);
  const inside = (i: number, j: number) => e.hitTest({ x: e.pos.x + i * step, y: e.pos.y + j * step });
  for (let j = -n; j <= n; j++)
    for (let i = -n; i <= n; i++) {
      if (!inside(i, j)) continue;
      if (!inside(i + 1, j) || !inside(i - 1, j) || !inside(i, j + 1) || !inside(i, j - 1)) out.push({ x: e.pos.x + i * step, y: e.pos.y + j * step });
    }
  return out;
}

export class VisualDebug {
  shapes = false;
  targets = false;
  private enlarged: string | null = null;
  private rects: { name: string; x: number; y: number; w: number; h: number }[] = [];

  constructor(private game: Game & { scene?: unknown; overlays?: OverlayHost }) {
    game.overlays?.add({ id: 'debug-visual', order: 120, draw: (g) => this.draw(g) });
  }

  onKey(e: { code: string; shiftKey: boolean }): boolean {
    if (e.code !== 'F2') return false;
    if (e.shiftKey) this.targets = !this.targets;
    else this.shapes = !this.shapes;
    return true;
  }

  private op(): OperationScene | null {
    const s = this.game.scene;
    return s instanceof OperationScene ? s : null;
  }

  draw(g: Gfx): void {
    if (this.shapes) this.drawShapes(g);
    if (this.targets) this.drawTargets(g);
  }

  private drawShapes(g: Gfx): void {
    const scene = this.op();
    // FIELD / opening outline.
    const ring: Vec[] = [];
    for (let i = 0; i <= 64; i++)
      ring.push({ x: FIELD.cx + Math.cos((i / 64) * Math.PI * 2) * FIELD.rx, y: FIELD.cy + Math.sin((i / 64) * Math.PI * 2) * FIELD.ry });
    g.polyline(ring, 1.5, CYAN);
    if (scene) {
      const cam = scene.camera;
      if (cam.bounds) g.rectLine(cam.bounds.x, cam.bounds.y, cam.bounds.w, cam.bounds.h, 1.5, AMBER);
      for (const e of scene.op.entities) {
        if (!e.alive) continue;
        for (const p of hitOutline(e)) g.rect(p.x - 1, p.y - 1, 2, 2, e.hidden ? hex('#8080ff', 0.7) : GREEN);
        g.text(`${entityView(e).kind}#${e.id}`, e.pos.x, e.pos.y - 34, { size: 16, color: GREEN, align: 'center' });
      }
    }
    // Pointer path samples this frame.
    for (const p of this.game.input.path) g.circle(p.x, p.y, 2.5, AMBER);
    // Draw calls per section of the last finished frame.
    const st = g.lastStats;
    const vr = g.viewRect();
    const lines = [
      `draws ${st.drawCalls} · verts ${st.vertices}`,
      Object.entries(st.sections)
        .map(([k, v]) => `${k} ${v}`)
        .join(' · '),
      `flush ${Object.entries(st.flushes)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}:${v}`)
        .join(' ')}`,
    ];
    lines.forEach((l, i) => g.text(l, vr.x + 12, vr.y + vr.h - 70 + i * 20, { size: 16, color: CYAN }));
  }

  private textures(g: Gfx): DebugTex[] {
    const scene = this.op() as unknown as { decals?: { debugTextures(): DebugTex[] } | null } | null;
    return [...g.debugTextures(), ...(scene?.decals?.debugTextures() ?? [])];
  }

  private drawTargets(g: Gfx): void {
    const list = this.textures(g);
    const vr = g.viewRect();
    const input = this.game.input;
    if (this.enlarged) {
      const t = list.find((x) => x.name === this.enlarged);
      if (!t) this.enlarged = null;
      else {
        const s = Math.min((vr.w - 80) / t.w, (vr.h - 120) / t.h);
        const w = t.w * s;
        const h = t.h * s;
        const x = vr.x + (vr.w - w) / 2;
        const y = vr.y + 60;
        g.rect(vr.x, vr.y, vr.w, vr.h, hex('#000000', 0.85));
        g.texQuad(t.tex, x, y, w, h, 0xffffffff, t.flip);
        g.text(`${t.name} ${t.w}×${t.h} — click to close`, vr.x + vr.w / 2, y - 16, { size: 18, color: AMBER, align: 'center' });
        if (input.pressed) this.enlarged = null;
        return;
      }
    }
    const tw = 150;
    const cols = Math.max(1, Math.floor((vr.w - 20) / (tw + 10)));
    g.rect(vr.x, vr.y, vr.w, vr.h, hex('#000000', 0.55));
    this.rects = [];
    list.forEach((t, i) => {
      const th = Math.max(20, Math.min(120, (tw * t.h) / t.w));
      const x = vr.x + 10 + (i % cols) * (tw + 10);
      const y = vr.y + 40 + Math.floor(i / cols) * 150;
      g.rect(x - 1, y - 1, tw + 2, th + 2, hex('#404040'));
      g.texQuad(t.tex, x, y, tw, th, 0xffffffff, t.flip);
      g.text(t.name, x, y + th + 18, { size: 16, color: CYAN });
      this.rects.push({ name: t.name, x, y, w: tw, h: th });
    });
    g.text('Render targets — click to enlarge (Shift+F2 closes)', vr.x + 12, vr.y + 24, { size: 18, color: AMBER });
    if (input.pressed) {
      const p = input.pos;
      const hit = this.rects.find((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
      if (hit) this.enlarged = hit.name;
    }
  }
}
