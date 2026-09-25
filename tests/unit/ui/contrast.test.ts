/**
 * UIX-0025 contrast audit: every text colour the UI uses, against the surface it is drawn on,
 * meets WCAG AA (4.5:1). Surfaces are the darkest/lightest representative tone of each material.
 */
import { describe, expect, it } from 'vitest';
import { PALETTE } from '../../../src/ui/layout';
import { UI } from '../../../src/ui/ornaments';
import { contrast, PALETTES } from '../../../src/ui/theme';

const LEATHER = '#241610'; // HUD leather and oak panels
const PARCHMENT = '#e0cfa4'; // dialogue scroll, tooltips, results card
const TOOLTIP = '#cdb688'; // darkest end of the tooltip gradient
const PANEL = PALETTE.panel; // menu panels

const PAIRS: [string, string, string][] = [
  ['story text on the scroll', UI.inkDark, PARCHMENT],
  ['narrator text on the scroll', '#5a4228', PARCHMENT],
  ['speaker / Ilse name in red ink', '#6a0a10', PARCHMENT],
  ['tooltip body', UI.inkDark, TOOLTIP],
  ['tooltip title', '#6a0a10', TOOLTIP],
  ['HUD label (brass on leather)', UI.brass, LEATHER],
  ['patient name on leather', UI.parchLo, LEATHER],
  ['HUD numbers on leather', '#ffffff', LEATHER],
  ['Litany label', UI.gilt, LEATHER],
  ['menu text', PALETTE.ink, PANEL],
  ['menu secondary text', PALETTE.inkDim, PANEL],
  ['gold highlight', PALETTE.gold, PANEL],
];

describe('UIX-0025 contrast audit', () => {
  for (const [what, fg, bg] of PAIRS) it(`${what}: ${fg} on ${bg} ≥ 4.5:1`, () => expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5));

  it('every colour filter keeps its inks readable on panels and its faded ink readable on parchment', () => {
    for (const [id, p] of Object.entries(PALETTES)) {
      expect(contrast(p.ink, PANEL), `${id} ink`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.inkDim, PANEL), `${id} inkDim`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.inkFaded, p.parch), `${id} inkFaded`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
