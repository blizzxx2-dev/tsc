/**
 * Retractors around the opening (ENG-0098): steel blades hooked over the rolled collar, their
 * handles running out across the drape. Presentation only; they sit where no work is done.
 */
import { FIELD } from '../../surgery/operation';
import { hex } from '../color';
import type { Gfx } from '../gfx';

/** Where the retractors grip: angles around the opening (radians, 0 = right, y down). */
const GRIPS = [Math.PI * 0.08, Math.PI * 0.92, Math.PI * 1.36, Math.PI * 1.66, Math.PI * 0.5];

const at = (a: number, k: number) => ({ x: FIELD.cx + Math.cos(a) * FIELD.rx * k, y: FIELD.cy + Math.sin(a) * FIELD.ry * k });

/** Draw the retractors; `light` is the lamp's screen position (the steel's highlight faces it). */
export function drawRetractors(g: Gfx, light: { x: number; y: number }): void {
  for (const a of GRIPS) {
    // Along the radius (u) and across it (v): a broad curved blade over the lip, a flat bar handle.
    const u = { x: Math.cos(a), y: Math.sin(a) * (FIELD.ry / FIELD.rx) };
    const ul = Math.hypot(u.x, u.y);
    u.x /= ul;
    u.y /= ul;
    const v = { x: -u.y, y: u.x };
    const P = (k: number, s: number) => {
      const c = at(a, k);
      return { x: c.x + v.x * s, y: c.y + v.y * s };
    };
    const lit = 0.55 + 0.45 * Math.max(0, -(u.x * (light.x - FIELD.cx) + u.y * (light.y - FIELD.cy)) / Math.hypot(light.x - FIELD.cx, light.y - FIELD.cy));
    const shade = (x: number, y: number) => ({ x: x + 5, y: y + 6 });
    const blade = [P(0.955, -13), P(0.955, 13), P(1.06, 9), P(1.06, -9)];
    const bar = [P(1.06, -5), P(1.06, 5), P(1.21, 4), P(1.21, -4)];
    // Contact shadow on the collar and the linen.
    g.poly(blade.map((p) => shade(p.x, p.y)), hex('#000000', 0.34));
    g.poly(bar.map((p) => shade(p.x, p.y)), hex('#000000', 0.28));
    // Blade: dull steel, darker where it curls down into the opening; a bright bevel on its crest.
    g.poly(blade, hex('#6c7076'), hex('#4a4d52'));
    g.line(P(1.0, -12), P(1.0, 12), 2, hex('#dfe4ea', 0.35 + 0.45 * lit));
    g.line(P(0.957, -12), P(0.957, 12), 2.5, hex('#23252a', 0.8));
    // Handle bar and its end ring.
    g.poly(bar, hex('#5c6066'), hex('#44474c'));
    g.line(P(1.07, 0), P(1.2, 0), 1.2, hex('#c8ced6', 0.3 + 0.4 * lit));
    const end = at(a, 1.235);
    g.arc(end.x, end.y, 8, 3, hex('#54575c'));
    g.arc(end.x - 0.8, end.y - 0.8, 8, 1, hex('#d0d6de', 0.35 + 0.35 * lit));
  }
}
