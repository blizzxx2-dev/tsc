/**
 * Chapter vignettes (ART-0059): the woodcut plate that stands for each chapter on a save-slot card
 * when no field snapshot was stored — the hospice's leech jar, the war camp's pyre, the Kiln Rows,
 * the Vennmark's Wound-Man chart and the Hollow Choir's mask.
 */
import type { Gfx } from '../render/gfx';
import type { Rect } from '../ui/widgets';
import { choirMaskPlate, kilnRowsPlate, leechJarPlate, pyrePlate, woundManPlate } from './plates';

const PLATES = [leechJarPlate, pyrePlate, kilnRowsPlate, woundManPlate, choirMaskPlate];

/** Draw the vignette for campaign chapter index `chapter` (0 = Chapter I) into `r`. */
export function chapterVignette(g: Gfx, chapter: number, r: Rect, t: number, alpha = 1): void {
  const plate = PLATES[Math.max(0, Math.min(PLATES.length - 1, chapter))];
  g.pushClip(r);
  // Plates are composed for a taller frame; draw one a little larger and let the window crop it.
  const h = Math.max(r.h, r.w * 0.75);
  plate(g, { x: r.x, y: r.y + (r.h - h) / 2, w: r.w, h }, t, '', alpha);
  g.popClip();
}
