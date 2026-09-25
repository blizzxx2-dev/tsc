/**
 * Instrument icons rendered from the 3D models (art-src/blender/models/tools.py): each tool is
 * drawn once into a 256² texture — three-quarter view, warm key, cool fill, rim — and reused for
 * the tray, briefing, controls card and cursor. The shader-drawn icons stand in until a model
 * has loaded (and when models are not built).
 */
import type { Gfx } from '../render/gfx';
import { fromTRS, multiply, type V3 } from '../render/mat4';
import type { Model3D } from '../render/renderer3d';
import type { ToolId } from '../surgery/types';

const SIZE = 256;
const models = new Map<ToolId, Model3D>();
const icons = new Map<ToolId, WebGLTexture>();
let restoreHooked = false;

export const TOOL_MODEL: Record<ToolId, string> = {
  lancet: 'models/tool-lancet',
  tongs: 'models/tool-tongs',
  leech: 'models/tool-leech',
  thread: 'models/tool-thread',
  salve: 'models/tool-salve',
  tincture: 'models/tool-tincture',
  brand: 'models/tool-brand',
  lens: 'models/tool-lens',
};

export function registerToolModel(id: ToolId, m: Model3D): void {
  models.set(id, m);
  icons.delete(id);
}

/** The icon texture for a tool, rendering it on first use; null until the model is ready. */
export function toolIcon3d(g: Gfx, id: ToolId): WebGLTexture | null {
  const cached = icons.get(id);
  if (cached) return cached;
  const m = models.get(id);
  if (!m?.isReady) return null;
  if (!restoreHooked) {
    restoreHooked = true;
    g.registry.onRestore(() => icons.clear(), 40);
  }
  const b = m.data.bounds;
  const c: V3 = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
  const r = Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]) / 2 || 0.1;
  // Centre the tool at the origin and turn it to a diagonal so long instruments fill the square.
  const place = multiply(fromTRS([0, 0, 0], [0, Math.sin(-0.35), 0, Math.cos(-0.35)]), fromTRS([-c[0], -c[1], -c[2]]));
  const dist = r / Math.tan((28 * Math.PI) / 360) * 1.02;
  const tex = g.render3DToTexture(`tool-icon-${id}`, SIZE, SIZE, {
    camera: { pos: [0, dist * 0.82, dist * 0.57], target: [0, 0, 0], fovY: (28 * Math.PI) / 180, near: dist * 0.1, far: dist * 4 },
    key: { pos: [-r * 2, r * 4, r * 2.5], target: [0, 0, 0], color: [5.5, 4.2, 3.0], cone: 1.4, range: r * 20, shadow: false },
    lights: [
      { pos: [r * 3, r * 1.5, -r * 2.5], color: [0.9, 1.1, 1.6], range: r * 20 },
      { pos: [0, -r * 2, r * 3], color: [0.6, 0.45, 0.35], range: r * 20 },
    ],
    ambient: { sky: [0.16, 0.16, 0.18], ground: [0.08, 0.06, 0.05] },
    exposure: 1,
    items: [{ model: m, matrix: place }],
  });
  icons.set(id, tex);
  return tex;
}
