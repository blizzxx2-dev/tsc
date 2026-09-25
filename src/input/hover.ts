import type { Vec } from '../core/math';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { Embedded } from '../surgery/entities';
import type { Operation } from '../surgery/operation';
import { hoveredGraspable } from './assist';

const OUTLINE = '#ffe6a8';

/**
 * Hover outline for the Tongs (INP-0042): the graspable the next press would seize is
 * traced in gilt — along the shaft of a lodged object, a ring round anything else — so a
 * near-miss on a thin arrow shaft reads as a hit before the button goes down.
 * Presentation only: nothing here touches the simulation.
 */
export function drawGraspOutline(g: Gfx, op: Operation, hand: Vec, scale: number, t: number): void {
  if (op.tool !== 'tongs' || op.status !== 'running') return;
  const z = hoveredGraspable(op, hand, scale);
  if (!z) return;
  const pulse = 0.75 + 0.25 * Math.sin(t * 7);
  const e = z.entity;
  g.setBlend('add');
  if (e instanceof Embedded && e.spec.len > 0) {
    g.line(e.handle, e.origin, 12, hex(OUTLINE, 0.12 * pulse));
    g.line(e.handle, e.origin, 4, hex(OUTLINE, 0.35 * pulse));
    g.arc(e.handle.x, e.handle.y, 9, 1.5, hex(OUTLINE, 0.8 * pulse));
  } else {
    const c = z.closest(hand).q;
    g.glow(c.x, c.y, z.r + 12, hex(OUTLINE, 0.14 * pulse));
    g.arc(c.x, c.y, z.r + 4, 1.8, hex(OUTLINE, 0.8 * pulse));
  }
  g.setBlend('alpha');
}
