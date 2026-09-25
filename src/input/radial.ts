import type { Vec } from '../core/math';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { toolInfo, type ToolId } from '../surgery/types';
import { toolIcon } from '../ui/widgets';
import type { Sticks } from './types';

/** Releasing within this distance of the centre cancels the wheel. */
export const RADIAL_CANCEL_PX = 12;
/** Stick deflection needed to pick a slot with the right stick. */
export const RADIAL_STICK_PICK = 0.5;
export const RADIAL_RADIUS = 104;

/**
 * Radial instrument menu: hold the wheel button (middle mouse / Y) to open it around
 * the cursor, flick towards an instrument (mouse) or point the right stick (pad),
 * release to take it. World time keeps running. Slots run clockwise from the top.
 */
export class RadialMenu {
  isOpen = false;
  center: Vec = { x: 0, y: 0 };
  tools: readonly ToolId[] = [];
  /** Instruments in this operation's kit; the others are shown greyed and cannot be taken. */
  available: readonly ToolId[] = [];
  selected = -1;
  private via: 'pointer' | 'stick' = 'pointer';
  private openT = 0;

  open(center: Vec, tools: readonly ToolId[], via: 'pointer' | 'stick', available: readonly ToolId[] = tools): void {
    this.isOpen = true;
    this.center = { ...center };
    this.tools = tools;
    this.available = available;
    this.selected = -1;
    this.via = via;
    this.openT = 0;
  }

  /** Slot for a direction vector (clockwise from straight up), or -1 inside the cancel radius. */
  slotFor(dx: number, dy: number, minMag: number): number {
    const m = Math.hypot(dx, dy);
    if (m < minMag || !this.tools.length) return -1;
    const ang = Math.atan2(dx, -dy); // 0 = up, clockwise positive
    const step = (Math.PI * 2) / this.tools.length;
    return ((Math.round(ang / step) % this.tools.length) + this.tools.length) % this.tools.length;
  }

  update(pointer: Vec, sticks: Sticks, dt: number): void {
    if (!this.isOpen) return;
    this.openT += dt;
    if (this.via === 'stick') {
      const s = this.slotFor(sticks.rx, sticks.ry, RADIAL_STICK_PICK);
      // Letting the stick return to centre keeps the last pick, so release selects what you pointed at.
      if (s >= 0) this.selected = s;
    } else this.selected = this.slotFor(pointer.x - this.center.x, pointer.y - this.center.y, RADIAL_CANCEL_PX);
  }

  /** Close the wheel; returns the chosen instrument or null if cancelled. */
  close(): ToolId | null {
    if (!this.isOpen) return null;
    this.isOpen = false;
    return this.selected >= 0 ? this.tools[this.selected] : null;
  }

  draw(g: Gfx, current: ToolId): void {
    if (!this.isOpen) return;
    const a = Math.min(1, this.openT * 8);
    const { x, y } = this.center;
    const n = this.tools.length;
    g.circle(x, y, RADIAL_RADIUS + 36, hex('#0a0504', 0.72 * a));
    g.arc(x, y, RADIAL_RADIUS + 36, 2, hex('#b08a4a', 0.8 * a));
    g.arc(x, y, 30, 1.5, hex('#b08a4a', 0.5 * a));
    this.tools.forEach((id, i) => {
      const ang = -Math.PI / 2 + (i / n) * Math.PI * 2;
      const px = x + Math.cos(ang) * RADIAL_RADIUS;
      const py = y + Math.sin(ang) * RADIAL_RADIUS;
      const sel = i === this.selected;
      const inKit = this.available.includes(id);
      if (sel && inKit) g.glow(px, py, 44, hex('#ffb050', 0.3 * a));
      g.circle(px, py, 30, hex(sel ? '#3a1a0a' : '#1a0e08', 0.9 * a));
      g.arc(px, py, 30, sel ? 3 : 1.5, hex(id === current ? '#f5d76e' : '#8a6a3a', inKit ? a : 0.35 * a));
      toolIcon(g, id, px, py, sel ? 1.1 : 0.85, g.time);
      // Not in this operation's kit: veiled, and a pick only shakes the tray.
      if (!inKit) g.circle(px, py, 30, hex('#0a0504', 0.65 * a));
    });
    if (this.selected >= 0) g.text(toolInfo(this.tools[this.selected]).name, x, y + 6, { size: 16, color: hex('#f5d76e', a), align: 'center' });
  }
}
