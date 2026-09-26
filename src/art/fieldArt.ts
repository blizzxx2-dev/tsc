/**
 * Small inked figures for the discipline screens: the casualty on each triage card in one of eight
 * poses (ART-0224), and the evidence items pinned on the interview board (ART-0225). Drawn in the
 * same sepia ink as the examination chart, so they read on parchment and on the dark panels alike.
 */
import type { Vec } from '../core/math';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';

type Pt = readonly [number, number];
/** A pose: head, then limbs as polylines, in a 0..1 box (x right, y down). */
interface Pose {
  head: Pt;
  limbs: readonly (readonly Pt[])[];
}

/** Eight casualty poses (ART-0224): flat, curled, sat, kneeling, arm held, knee up, propped, hunched. */
export const CASUALTY_POSES: readonly Pose[] = [
  { head: [0.1, 0.72], limbs: [[[0.18, 0.74], [0.6, 0.74], [0.95, 0.76]], [[0.3, 0.74], [0.42, 0.9]], [[0.6, 0.74], [0.95, 0.9]]] },
  { head: [0.28, 0.5], limbs: [[[0.35, 0.56], [0.55, 0.7], [0.62, 0.84]], [[0.55, 0.7], [0.4, 0.82], [0.5, 0.92]], [[0.4, 0.6], [0.5, 0.66]]] },
  { head: [0.4, 0.18], limbs: [[[0.4, 0.28], [0.42, 0.62]], [[0.42, 0.62], [0.72, 0.64], [0.78, 0.92]], [[0.4, 0.34], [0.2, 0.5]], [[0.4, 0.34], [0.62, 0.46]]] },
  { head: [0.5, 0.14], limbs: [[[0.5, 0.24], [0.52, 0.56]], [[0.52, 0.56], [0.36, 0.72], [0.4, 0.92]], [[0.52, 0.56], [0.72, 0.92]], [[0.5, 0.32], [0.62, 0.42], [0.5, 0.46]]] },
  { head: [0.5, 0.1], limbs: [[[0.5, 0.2], [0.5, 0.58]], [[0.5, 0.58], [0.4, 0.94]], [[0.5, 0.58], [0.62, 0.94]], [[0.5, 0.28], [0.34, 0.4], [0.5, 0.44]], [[0.5, 0.28], [0.7, 0.48]]] },
  { head: [0.1, 0.66], limbs: [[[0.18, 0.7], [0.58, 0.72]], [[0.58, 0.72], [0.74, 0.46], [0.9, 0.74]], [[0.58, 0.72], [0.96, 0.76]], [[0.3, 0.7], [0.36, 0.5]]] },
  { head: [0.2, 0.36], limbs: [[[0.26, 0.44], [0.6, 0.7]], [[0.6, 0.7], [0.96, 0.76]], [[0.3, 0.48], [0.22, 0.72]], [[0.6, 0.7], [0.8, 0.9]]] },
  { head: [0.58, 0.16], limbs: [[[0.54, 0.26], [0.44, 0.56]], [[0.44, 0.56], [0.36, 0.94]], [[0.44, 0.56], [0.56, 0.94]], [[0.52, 0.32], [0.62, 0.52]], [[0.52, 0.32], [0.36, 0.48]]] },
];

/** A casualty figure in pose `k` inside `box`; grey and still once `dead`. */
export function drawCasualty(g: Gfx, box: { x: number; y: number; w: number; h: number }, k: number, dead = false): void {
  const pose = CASUALTY_POSES[((k % CASUALTY_POSES.length) + CASUALTY_POSES.length) % CASUALTY_POSES.length];
  const at = (p: Pt): Vec => ({ x: box.x + p[0] * box.w, y: box.y + p[1] * box.h });
  const ink = hex(dead ? '#6a6660' : '#d8c8a0', 0.9);
  const w = Math.max(3, box.h * 0.09);
  for (const limb of pose.limbs) for (let i = 1; i < limb.length; i++) g.line(at(limb[i - 1]), at(limb[i]), w, ink);
  const h = at(pose.head);
  g.circle(h.x, h.y, box.h * 0.1, ink);
}

export type EvidenceKind = 'letter' | 'roll' | 'glove' | 'ribbon' | 'bill' | 'ledger' | 'candle' | 'bone' | 'coin' | 'key' | 'vial' | 'seal' | 'tooth' | 'quill' | 'knife';

/** Fifteen evidence items (ART-0225). */
export const EVIDENCE_KINDS: readonly EvidenceKind[] = ['letter', 'roll', 'glove', 'ribbon', 'bill', 'ledger', 'candle', 'bone', 'coin', 'key', 'vial', 'seal', 'tooth', 'quill', 'knife'];

/** Guess an item's kind from its label and text (the content names them plainly). */
export function evidenceKind(label: string, text = ''): EvidenceKind {
  const s = `${label} ${text}`.toLowerCase();
  const rules: [RegExp, EvidenceKind][] = [
    [/letter|word|note/, 'letter'],
    [/roll|charter|certificate|scroll/, 'roll'],
    [/glove|hand/, 'glove'],
    [/ribbon/, 'ribbon'],
    [/bill|receipt/, 'bill'],
    [/ledger|book|record/, 'ledger'],
    [/candle|wick|tallow/, 'candle'],
    [/bone|rib|skull/, 'bone'],
    [/coin|crown|purse/, 'coin'],
    [/key|lock/, 'key'],
    [/vial|draught|tincture|poison/, 'vial'],
    [/seal|sigil|mark/, 'seal'],
    [/tooth|fang|teeth|mouth/, 'tooth'],
    [/quill|ink|pen/, 'quill'],
    [/knife|blade|wound/, 'knife'],
  ];
  return rules.find(([re]) => re.test(s))?.[1] ?? 'letter';
}

/** An evidence item drawn about `c` at size `s` (px). */
export function drawEvidence(g: Gfx, kind: EvidenceKind, c: Vec, s = 18): void {
  const ink = hex('#e8dcc0', 0.9);
  const dim = hex('#e8dcc0', 0.5);
  const L = (ax: number, ay: number, bx: number, by: number, w = 2, col = ink) => g.line({ x: c.x + ax * s, y: c.y + ay * s }, { x: c.x + bx * s, y: c.y + by * s }, w, col);
  switch (kind) {
    case 'letter':
      g.rect(c.x - 0.5 * s, c.y - 0.35 * s, s, 0.7 * s, dim);
      L(-0.5, -0.35, 0, 0.05);
      L(0.5, -0.35, 0, 0.05);
      break;
    case 'roll':
      g.rect(c.x - 0.4 * s, c.y - 0.3 * s, 0.8 * s, 0.6 * s, dim);
      g.circle(c.x - 0.45 * s, c.y, 0.3 * s, ink);
      g.circle(c.x + 0.45 * s, c.y, 0.3 * s, ink);
      break;
    case 'glove':
      g.ellipse(c.x, c.y + 0.15 * s, 0.3 * s, 0.35 * s, 0, ink);
      for (let i = 0; i < 4; i++) L(-0.22 + i * 0.15, -0.1, -0.26 + i * 0.17, -0.5, 3);
      break;
    case 'ribbon':
      L(-0.4, -0.3, 0.4, 0.3, 4);
      L(0.4, -0.3, -0.4, 0.3, 4);
      break;
    case 'bill':
      g.rect(c.x - 0.35 * s, c.y - 0.45 * s, 0.7 * s, 0.9 * s, dim);
      for (let i = 0; i < 3; i++) L(-0.25, -0.25 + i * 0.22, 0.25, -0.25 + i * 0.22, 1.5);
      break;
    case 'ledger':
      g.rect(c.x - 0.45 * s, c.y - 0.35 * s, 0.9 * s, 0.7 * s, ink);
      L(0, -0.35, 0, 0.35, 2, dim);
      break;
    case 'candle':
      g.rect(c.x - 0.12 * s, c.y - 0.2 * s, 0.24 * s, 0.6 * s, ink);
      g.circle(c.x, c.y - 0.35 * s, 0.12 * s, hex('#ffc070', 0.9));
      break;
    case 'bone':
      L(-0.35, 0.35, 0.35, -0.35, 4);
      g.circle(c.x - 0.38 * s, c.y + 0.38 * s, 0.14 * s, ink);
      g.circle(c.x + 0.38 * s, c.y - 0.38 * s, 0.14 * s, ink);
      break;
    case 'coin':
      g.circle(c.x, c.y, 0.38 * s, ink);
      g.circle(c.x, c.y, 0.22 * s, dim);
      break;
    case 'key':
      g.circle(c.x - 0.3 * s, c.y, 0.18 * s, ink);
      L(-0.15, 0, 0.45, 0, 3);
      L(0.35, 0, 0.35, 0.18, 3);
      break;
    case 'vial':
      g.ellipse(c.x, c.y + 0.12 * s, 0.22 * s, 0.3 * s, 0, ink);
      L(0, -0.2, 0, -0.45, 4);
      break;
    case 'seal':
      g.circle(c.x, c.y, 0.36 * s, hex('#a0302a', 0.9));
      g.circle(c.x, c.y, 0.18 * s, hex('#6a1a14', 0.9));
      break;
    case 'tooth':
      g.ellipse(c.x, c.y - 0.1 * s, 0.26 * s, 0.22 * s, 0, ink);
      L(-0.12, 0, -0.08, 0.4, 3);
      L(0.12, 0, 0.08, 0.4, 3);
      break;
    case 'quill':
      L(-0.4, 0.45, 0.35, -0.45, 2);
      L(0.1, -0.2, 0.4, -0.4, 5, dim);
      break;
    case 'knife':
      L(-0.45, 0.35, 0, -0.05, 4, dim);
      L(0, -0.05, 0.45, -0.4, 2);
      break;
  }
}
