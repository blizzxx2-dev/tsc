/**
 * Extraction tray (ART-0202): what the surgeon pulls out lands in a pewter kidney dish at the
 * screen edge (`TRAY_DISH`), one sprite per object type, and hexstone lies in the lead-lined dish
 * (`LEAD_DISH`). Presentation only: the scene watches the entity list, so the simulation, replays
 * and goldens never see it.
 */
import type { Vec } from '../core/math';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import type { Entity } from '../surgery/entity';
import { Embedded, Wadding, type EmbeddedKind } from '../surgery/entities';
import { LEAD_DISH, onBody, TRAY_DISH } from '../surgery/operation';
import { dishArt, fangArt, glassArt, hexstoneArt, missileArt, shotArt } from './ailmentArt';

type Item = EmbeddedKind | 'wadding';

interface Dropped {
  kind: Item;
  at: Vec;
  angle: number;
  seed: number;
  t0: number;
}

/** Where the n-th object lies in a dish: a loose spiral so they never stack exactly. */
function slot(n: number, c: Vec, r: number): Vec {
  const a = n * 2.4 + 0.6;
  const d = r * (0.18 + 0.12 * (n % 4));
  return { x: c.x + Math.cos(a) * d * 1.5, y: c.y + Math.sin(a) * d * 0.8 };
}

export class ExtractionTray {
  private seen = new Set<Entity>();
  private tray: Dropped[] = [];
  private lead: Dropped[] = [];

  update(entities: readonly Entity[], now: number): void {
    for (const e of this.seen) {
      if (e.alive) continue;
      this.seen.delete(e);
      // Only what was lifted off the body counts (a grub seared in place leaves nothing).
      if (onBody(e.pos)) continue;
      if (e instanceof Embedded && e.kind === 'hexstone') this.lead.push({ kind: 'hexstone', at: slot(this.lead.length, LEAD_DISH, LEAD_DISH.r), angle: e.angle, seed: e.id, t0: now });
      else if (e instanceof Embedded) this.tray.push({ kind: e.kind, at: slot(this.tray.length, TRAY_DISH, TRAY_DISH.r), angle: 0.3 + e.id * 1.7, seed: e.id, t0: now });
      else if (e instanceof Wadding) this.tray.push({ kind: 'wadding', at: slot(this.tray.length, TRAY_DISH, TRAY_DISH.r), angle: e.id, seed: e.id, t0: now });
    }
    for (const e of entities) if (e.alive && (e instanceof Embedded || e instanceof Wadding)) this.seen.add(e);
    // A long case can fill the dish; the oldest pieces are tipped out.
    if (this.tray.length > 12) this.tray.splice(0, this.tray.length - 12);
  }

  /** The dishes are shown only in cases that use them. */
  draw(g: Gfx, now: number, show: { tray: boolean; lead: boolean }): void {
    if (show.tray || this.tray.length) {
      dishArt(g, TRAY_DISH, TRAY_DISH.r, false, 1);
      for (const d of this.tray) drawItem(g, d, now);
    }
    if (show.lead || this.lead.length) {
      dishArt(g, LEAD_DISH, LEAD_DISH.r * 0.8, true, 2);
      for (const d of this.lead) drawItem(g, d, now);
    }
  }
}

function drawItem(g: Gfx, d: Dropped, now: number): void {
  // Dropped in: a short fall (the object lands from slightly above and settles).
  const k = Math.min(1, (now - d.t0) / 0.25);
  const at = { x: d.at.x, y: d.at.y - (1 - k) * 18 };
  const far = { x: at.x + Math.cos(d.angle) * 400, y: at.y + Math.sin(d.angle) * 400 };
  switch (d.kind) {
    case 'arrow':
      missileArt(g, at, d.angle, 40, far, { kind: 'barbed', seed: d.seed });
      break;
    case 'bolt':
      missileArt(g, at, d.angle, 30, far, { kind: 'bolt', seed: d.seed });
      break;
    case 'shot':
      shotArt(g, at, 6, { flattened: d.seed % 2, seed: d.seed });
      break;
    case 'tooth':
      fangArt(g, at, d.angle, 22, far, { seed: d.seed });
      break;
    case 'glass':
      glassArt(g, at, d.angle, 18, far, { shape: d.seed % 5, seed: d.seed });
      break;
    case 'shard':
      g.tri(at.x - 8, at.y + 3, at.x + 9, at.y - 2, at.x - 2, at.y - 6, hex('#8a8f96'));
      break;
    case 'hexstone':
      hexstoneArt(g, at, d.angle, 24, { stilled: 1, seed: d.seed });
      break;
    case 'wadding':
      g.ellipse(at.x, at.y, 7, 5, d.angle, hex('#b8a888'), hex('#6a5a40'));
      g.circleGrad(at.x + 2, at.y + 1, 4, hex('#5a0a0c', 0.6), hex('#5a0a0c', 0));
      break;
  }
}
