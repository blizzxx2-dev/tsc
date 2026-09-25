/**
 * Briefing chart art (ART-0056): a Gersdorff-style "Wound Man" drawn in woodcut strokes, with
 * brass pins where the patient is hurt, and a stamped prognosis. Sites come from the operation's
 * (English source) diagnosis and organ, so every chart is derived from content with no extra
 * data; patient's left is drawn on the viewer's right, as on an anatomical plate.
 */
import type { Vec } from '../core/math';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import type { OperationDef, OrganKind } from '../surgery/operation';

export type Site = 'head' | 'mouth' | 'neck' | 'shoulder' | 'chest' | 'heart' | 'belly' | 'flank' | 'back' | 'arm' | 'hand' | 'thigh' | 'leg' | 'foot';

/** Figure-space points: x in −0.5…0.5 (viewer's left to right), y 0 (crown) … 1 (soles). */
const AT: Record<Site, Vec> = {
  head: { x: 0, y: 0.06 },
  mouth: { x: 0, y: 0.1 },
  neck: { x: 0.02, y: 0.155 },
  shoulder: { x: -0.17, y: 0.2 },
  chest: { x: 0.05, y: 0.27 },
  heart: { x: 0.06, y: 0.29 },
  belly: { x: 0, y: 0.42 },
  flank: { x: -0.12, y: 0.39 },
  back: { x: -0.06, y: 0.33 },
  arm: { x: -0.25, y: 0.36 },
  hand: { x: -0.3, y: 0.52 },
  thigh: { x: -0.08, y: 0.6 },
  leg: { x: -0.09, y: 0.78 },
  foot: { x: -0.1, y: 0.96 },
};

const WORDS: [RegExp, Site][] = [
  [/\b(scalp|skull|brow|head|horn-buds)\b/i, 'head'],
  [/\b(molar|tooth|teeth|jaw|mouth|dental)\b/i, 'mouth'],
  [/\b(neck|throat|larynx|vocal)\b/i, 'neck'],
  [/\bshoulder\b/i, 'shoulder'],
  [/\b(heart|sternum)\b/i, 'heart'],
  [/\b(chest|breast|lung|rib)\b/i, 'chest'],
  [/\b(belly|gut|bowel|abdom\w*|stomach|labour|strongbox)\b/i, 'belly'],
  [/\bflank\b/i, 'flank'],
  [/\b(back|spine|scourge)\b/i, 'back'],
  [/\b(fore)?arm\b/i, 'arm'],
  [/\b(hand|finger\w*|wrist)\b/i, 'hand'],
  [/\bthigh\b/i, 'thigh'],
  [/\b(leg|shin|knee|calf)\b/i, 'leg'],
  [/\b(foot|ankle)\b/i, 'foot'],
];
const ORGAN_SITE: Record<OrganKind, Site> = { flesh: 'chest', heart: 'heart', lung: 'chest', gut: 'belly', liver: 'belly', brain: 'head', bone: 'leg', muscle: 'leg', skin: 'chest' };

export interface Pin {
  site: Site;
  at: Vec;
}

/** Where to pin the chart: every site the diagnosis names (in order), else the operated organ. */
export function woundSites(def: Pick<OperationDef, 'diagnosis' | 'organ'>): Pin[] {
  const sites: Pin[] = [];
  for (const [re, site] of WORDS) {
    const m = re.exec(def.diagnosis);
    if (!m || sites.some((s) => s.site === site)) continue;
    const p = { ...AT[site] };
    // "left flank" is the patient's left: the viewer's right.
    const before = def.diagnosis.slice(Math.max(0, m.index - 8), m.index).toLowerCase();
    if (before.includes('left')) p.x = Math.abs(p.x);
    else if (before.includes('right')) p.x = -Math.abs(p.x);
    sites.push({ site, at: p });
  }
  if (!sites.length) sites.push({ site: ORGAN_SITE[def.organ], at: { ...AT[ORGAN_SITE[def.organ]] } });
  return sites;
}

export type Prognosis = 'fair' | 'guarded' | 'grave';

/** A chart prognosis from how much the operation throws at the surgeon. */
export function prognosis(def: Pick<OperationDef, 'phases' | 'baseDrain' | 'constitution' | 'organ'>): Prognosis {
  const load = def.phases.length + (def.baseDrain ?? 0) * 4 + (def.constitution === 'frail' ? 1 : 0) + (def.organ === 'heart' || def.organ === 'brain' ? 1 : 0);
  return load <= 2 ? 'fair' : load <= 3 ? 'guarded' : 'grave';
}

/** Draw the figure centred on `cx`, crown at `top`, `h` tall, with its pins. */
export interface PlateInks {
  ink: string;
  skin: string;
  shade: string;
  hatch: string;
}
/** Ink on vellum (woodcut plates) and gold engraving on dark glass (the UI). */
export const VELLUM_INKS: PlateInks = { ink: '#2a1a0c', skin: '#e8d4ae', shade: '#c9ab80', hatch: '#2a1a0c' };
export const ENGRAVED_INKS: PlateInks = { ink: '#d9b870', skin: '#1c1511', shade: '#140f0c', hatch: '#c9a55c' };

export function drawWoundMan(g: Gfx, cx: number, top: number, h: number, pins: Pin[], t: number, alpha = 1, inks: PlateInks = VELLUM_INKS): void {
  const ink = hex(inks.ink, 0.9 * alpha);
  const skin = hex(inks.skin, 0.95 * alpha);
  const shade = hex(inks.shade, 0.95 * alpha);
  const hatch = hex(inks.hatch, 0.3 * alpha);
  const u = h / 100;
  const P = (x: number, y: number): Vec => ({ x: cx + x * h, y: top + y * h });
  // Each part is drawn as an ink silhouette, then the fill inset by the stroke width: a cut line.
  type Part = (grow: number, c: number) => void;
  const cap = (a: Vec, b: Vec, w: number): Part => (grow, c) => g.line(a, b, w * u + grow, c);
  const body = (pts: Vec[]): Part => (grow, c) => {
    const m = pts.reduce((o, p) => ({ x: o.x + p.x / pts.length, y: o.y + p.y / pts.length }), { x: 0, y: 0 });
    g.poly(pts.map((p) => ({ x: p.x + Math.sign(p.x - m.x) * grow * 0.5, y: p.y + Math.sign(p.y - m.y) * grow * 0.5 })), c);
  };
  const head: Part = (grow, c) => g.ellipse(cx, top + 0.068 * h, 0.05 * h + grow / 2, 0.064 * h + grow / 2, 0, c);
  const parts: Part[] = [
    // legs (behind the torso), arms, torso, neck, head
    cap(P(-0.075, 0.47), P(-0.085, 0.72), 7.5),
    cap(P(-0.085, 0.72), P(-0.095, 0.945), 5.5),
    cap(P(0.075, 0.47), P(0.085, 0.72), 7.5),
    cap(P(0.085, 0.72), P(0.095, 0.945), 5.5),
    cap(P(-0.095, 0.96), P(-0.14, 0.97), 3.5),
    cap(P(0.095, 0.96), P(0.14, 0.97), 3.5),
    cap(P(-0.15, 0.21), P(-0.23, 0.36), 5.5),
    cap(P(-0.23, 0.36), P(-0.285, 0.5), 4.2),
    cap(P(0.15, 0.21), P(0.23, 0.36), 5.5),
    cap(P(0.23, 0.36), P(0.285, 0.5), 4.2),
    cap(P(-0.29, 0.51), P(-0.3, 0.545), 4.5),
    cap(P(0.29, 0.51), P(0.3, 0.545), 4.5),
    body([P(-0.17, 0.19), P(0.17, 0.19), P(0.13, 0.33), P(0.12, 0.44), P(0.14, 0.5), P(-0.14, 0.5), P(-0.12, 0.44), P(-0.13, 0.33)]),
    cap(P(0, 0.12), P(0, 0.19), 5.5),
    head,
  ];
  for (const part of parts) part(2.4, ink);
  for (const part of parts) part(0, skin);
  // Form: collarbones, ribs, navel, knees; a warm shade down the figure's right side.
  g.line(P(-0.11, 0.2), P(-0.02, 0.215), 0.5 * u, ink);
  g.line(P(0.11, 0.2), P(0.02, 0.215), 0.5 * u, ink);
  for (let i = 0; i < 3; i++) {
    g.line(P(-0.02, 0.26 + i * 0.03), P(-0.09, 0.28 + i * 0.035), 0.35 * u, hatch);
    g.line(P(0.02, 0.26 + i * 0.03), P(0.09, 0.28 + i * 0.035), 0.35 * u, hatch);
  }
  g.circle(cx, top + 0.41 * h, 0.35 * u, ink);
  g.line(P(0, 0.46), P(0, 0.5), 0.4 * u, hatch);
  g.poly([P(0.13, 0.2), P(0.165, 0.2), P(0.125, 0.33), P(0.115, 0.44), P(0.13, 0.49), P(0.1, 0.49), P(0.09, 0.3)], shade);
  for (let i = 0; i < 16; i++) {
    const y = 0.215 + i * 0.017;
    g.line(P(0.1 + (i % 2) * 0.01, y + 0.006), P(0.135 - i * 0.001, y), 0.28 * u, hatch);
  }
  for (let i = 0; i < 20; i++) {
    const y = 0.5 + i * 0.022;
    g.line(P(0.075 + (i % 2) * 0.005, y + 0.006), P(0.1, y), 0.26 * u, hatch);
  }
  for (const s of [-1, 1]) g.arc(cx + s * 0.085 * h, top + 0.72 * h, 0.012 * h, 0.35 * u, hatch);
  // Face: brows, eyes and a straight mouth; the plates' patients are calm, never in agony.
  g.line(P(-0.03, 0.058), P(-0.012, 0.055), 0.4 * u, ink);
  g.line(P(0.012, 0.055), P(0.03, 0.058), 0.4 * u, ink);
  g.circle(cx - 0.02 * h, top + 0.068 * h, 0.3 * u, ink);
  g.circle(cx + 0.02 * h, top + 0.068 * h, 0.3 * u, ink);
  g.line(P(-0.012, 0.1), P(0.012, 0.1), 0.35 * u, ink);
  // Pins: a brass shaft with a red wax head, swaying a touch.
  pins.forEach((pin, i) => {
    const p = P(pin.at.x, pin.at.y);
    const sway = Math.sin(t * 2 + i * 1.7) * 0.6;
    g.circleGrad(p.x, p.y, 2.2 * u, hex('#8a1016', 0.5 * alpha), hex('#8a1016', 0));
    g.line(p, { x: p.x + 7 + sway, y: p.y - 14 }, 1.6, hex('#b8903c', alpha));
    g.circleGrad(p.x + 7 + sway, p.y - 15, 4.5, hex('#e03030', alpha), hex('#6a0a10', alpha));
    g.circle(p.x + 5.8 + sway, p.y - 16.4, 1.3, hex('#ffc0b0', 0.8 * alpha));
  });
}
