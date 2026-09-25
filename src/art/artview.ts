/**
 * Art viewer (`?scene=artview`): every piece of the procedural UI kit on one board, with
 * zoom (mouse wheel), flipbook frame-stepping (←/→ or , .; Space toggles playback) and a
 * background swatch toggle (B: soot, parchment, flesh, grey). Pages: 1 kit, 2 seals & stamps,
 * 3 instruments. A QA tool — every kit element should be inspected here before it ships.
 */
import type { Game, Scene } from '../core/scene';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import type { ToolId } from '../surgery/types';
import { VIEW_H } from '../ui/layout';
import { banner, divider, filigree, giltText, leatherPanel, medallion, parchmentSheet, plaque, scroll, UI, waxSeal } from '../ui/ornaments';
import { fleuron, manicule, sectionMark, woodcutCorner, woodcutEdge, woodcutRule } from '../ui/ornaments';
import {
  chapterSeal,
  crosshairArt,
  failSeal,
  inkStamp,
  ledgerArt,
  oakArt,
  parchmentArt,
  rankSeal,
  ratingStamp,
  ribbonArt,
  sandGlassArt,
  starReliquary,
  tallyRibbon,
  tinctureGauge,
  toolArt,
  trayPocketArt,
  vellumStripArt,
  vialArt,
  type ToolState,
} from './kit';

const SWATCHES = ['#0c0806', '#d8c8a0', '#7a2a24', '#6a6a6a'];
const TOOLS: ToolId[] = ['lancet', 'tongs', 'leech', 'thread', 'salve', 'tincture', 'brand', 'lens'];

export class ArtViewScene implements Scene {
  private page = 0;
  private swatch = 0;
  private zoom = 1;
  private t = 0;
  private playing = true;

  constructor() {
    const q = new URLSearchParams(location.search);
    this.page = Math.max(0, Math.min(2, Number(q.get('page') ?? 1) - 1));
    if (q.get('t')) {
      this.t = Number(q.get('t'));
      this.playing = false;
    }
  }

  update(dt: number, game: Game): void {
    const { input } = game;
    if (this.playing) this.t += dt;
    if (input.keyPressed('Space')) this.playing = !this.playing;
    if (input.keyPressed('ArrowRight') || input.keyPressed('Period')) this.t += 1 / 12;
    if (input.keyPressed('ArrowLeft') || input.keyPressed('Comma')) this.t = Math.max(0, this.t - 1 / 12);
    if (input.keyPressed('KeyB')) this.swatch = (this.swatch + 1) % SWATCHES.length;
    if (input.keyPressed('Digit1')) this.page = 0;
    if (input.keyPressed('Digit2')) this.page = 1;
    if (input.keyPressed('Digit3')) this.page = 2;
    if (input.keyPressed('KeyR')) this.t = 0;
    this.zoom = Math.max(0.5, Math.min(3, this.zoom * (1 - input.wheel * 0.1)));
  }

  render(g: Gfx, game: Game): void {
    g.beginScreen(hexTriple(SWATCHES[this.swatch]));
    g.save();
    const cx = game.input.pos.x;
    const cy = game.input.pos.y;
    if (this.zoom !== 1) {
      g.translate(cx, cy);
      g.scale(this.zoom);
      g.translate(-cx, -cy);
    }
    if (this.page === 0) this.kit(g);
    else if (this.page === 1) this.seals(g);
    else this.instruments(g);
    g.restore();
    const label = (s: string, x: number, y: number) => g.text(s, x, y, { size: 13, color: hex('#e8dcc0', 0.8), shadow: hex('#000000', 0.9) });
    label(`Art viewer — page ${this.page + 1}/3 (1-3)   B: background   wheel: zoom   ←/→: frame ${Math.floor(this.t * 12)}   Space: ${this.playing ? 'pause' : 'play'}   R: restart`, 12, VIEW_H - 10);
    g.endFrame();
  }

  private kit(g: Gfx): void {
    const t = this.t;
    const cap = (s: string, x: number, y: number) => g.text(s, x, y, { size: 13, font: 'italic', color: hex('#e8dcc0', 0.85), shadow: hex('#000000', 0.9) });
    parchmentArt(g, { x: 20, y: 20, w: 180, h: 120 }, 'fresh', 1, 1);
    parchmentArt(g, { x: 215, y: 20, w: 180, h: 120 }, 'foxed', 1, 2);
    parchmentArt(g, { x: 410, y: 20, w: 180, h: 120 }, 'burnt', 1, 3);
    cap('vellum: fresh / foxed / burnt-edge', 20, 156);
    oakArt(g, { x: 610, y: 20, w: 240, h: 120 });
    cap('oak & iron panel', 610, 156);
    leatherPanel(g, { x: 875, y: 24, w: 240, h: 112 });
    cap('tooled leather panel', 875, 156);
    parchmentSheet(g, { x: 1135, y: 20, w: 125, h: 120 });
    tinctureGauge(g, { x: 20, y: 184, w: 160, h: 26 }, 0.5 + 0.5 * Math.sin(t * 0.7), 0, 0);
    tinctureGauge(g, { x: 20, y: 222, w: 160, h: 26 }, 0.18, 1, 0.6);
    cap('tincture gauge (low: cracked)', 20, 266);
    sandGlassArt(g, 240, 220, 70, 1 - ((t * 0.1) % 1));
    cap('sand-glass', 210, 266);
    starReliquary(g, 330, 220, 34, { fill: 1, glint: true });
    starReliquary(g, 410, 220, 34, { fill: 0.5 + 0.5 * Math.cos(t), active: true });
    starReliquary(g, 490, 220, 34, { fill: 0, spent: true });
    cap('Litany reliquary: ready / active / spent', 300, 266);
    [1, 0.66, 0.33, 0].forEach((f, i) => vialArt(g, 570 + i * 34, 220, 54, f, f === 0));
    cap('tincture vial', 570, 266);
    medallion(g, 740, 220, 28, hex('#240608'));
    cap('medallion', 712, 266);
    plaque(g, { x: 800, y: 196, w: 156, h: 44 });
    sandGlassArt(g, 826, 218, 30, 0.6);
    cap('timer plaque', 800, 266);
    vellumStripArt(g, { x: 990, y: 188, w: 250, h: 56 });
    cap('vellum pulse strip', 990, 266);
    ribbonArt(g, 170, 300, 300, 34, '#5a0c10', Math.min(1, t * 1.5 % 3));
    cap('torn ribbon (phase banner), unfurling', 30, 356);
    banner(g, 520, 300, 260, 32);
    cap('title banner', 430, 356);
    tallyRibbon(g, 800, 316, 170, 30, 4);
    tallyRibbon(g, 1000, 316, 170, 30, 10);
    cap('tally ribbon ×4, ×10+ gilt', 720, 356);
    scroll(g, { x: 30, y: 380, w: 380, h: 60 });
    cap('callout scroll', 30, 460);
    ledgerArt(g, { x: 450, y: 380, w: 200, h: 150 });
    cap('hanging ledger (pause)', 450, 550);
    // Woodcut border kit.
    const bx = { x: 690, y: 385, w: 260, h: 150 };
    g.rect(bx.x, bx.y, bx.w, bx.h, hex('#e6d6ae'));
    woodcutEdge(g, bx.x + 26, bx.y + 8, bx.x + bx.w - 26, bx.y + 8, hex('#2a1a10'));
    woodcutEdge(g, bx.x + 26, bx.y + bx.h - 8, bx.x + bx.w - 26, bx.y + bx.h - 8, hex('#2a1a10'));
    woodcutEdge(g, bx.x + 8, bx.y + 26, bx.x + 8, bx.y + bx.h - 26, hex('#2a1a10'));
    woodcutEdge(g, bx.x + bx.w - 8, bx.y + 26, bx.x + bx.w - 8, bx.y + bx.h - 26, hex('#2a1a10'));
    for (let k = 0; k < 4; k++) woodcutCorner(g, k % 2 ? bx.x + bx.w - 4 : bx.x + 4, k < 2 ? bx.y + 4 : bx.y + bx.h - 4, k % 2 ? -1 : 1, k < 2 ? 1 : -1, k, hex('#2a1a10'));
    woodcutRule(g, bx.x + bx.w / 2, bx.y + 50, 180, 0, hex('#6a1010'));
    woodcutRule(g, bx.x + bx.w / 2, bx.y + 80, 180, 1, hex('#2a1a10'));
    woodcutRule(g, bx.x + bx.w / 2, bx.y + 110, 180, 2, hex('#2a1a10'));
    cap('woodcut border kit: 4 corners, edge strips, 3 rules', 690, 556);
    fleuron(g, 1010, 420, 16, hex(UI.gilt));
    manicule(g, 1060, 420, 16, hex(UI.gilt));
    sectionMark(g, 1110, 420, 16, hex(UI.gilt));
    cap('fleuron, manicule, section', 990, 460);
    divider(g, 1100, 500, 200, hex(UI.brass));
    filigree(g, 1000, 520, 1, 1, 1.2);
    giltText(g, 'Gilt', 1150, 545, { size: 30 });
  }

  private seals(g: Gfx): void {
    const t = this.t % 3;
    const cap = (s: string, x: number, y: number) => g.text(s, x, y, { size: 13, font: 'italic', color: hex('#e8dcc0', 0.85), shadow: hex('#000000', 0.9) });
    (['XS', 'S', 'A', 'B', 'C'] as const).forEach((r, i) => rankSeal(g, 110 + i * 190, 120, 62, r, t - i * 0.15));
    cap('rank seals XS / S / A / B / C — 6-frame press-in', 40, 230);
    failSeal(g, 130, 330, 62, t);
    cap('failed: black wax, death’s head', 60, 430);
    chapterSeal(g, 330, 330, 50, 'II', t);
    cap('chapter complete', 280, 430);
    waxSeal(g, 490, 330, 30, '#8a1016', 'A', 26);
    cap('ledger wax seal', 450, 430);
    (['cool', 'good', 'bad', 'miss'] as const).forEach((r, i) => ratingStamp(g, r, ['Cool', 'Good', 'Bad', 'Miss'][i], 640 + i * 160, 350, t * 0.6, 1));
    cap('rating stamps — 4-frame hit', 600, 430);
    inkStamp(g, 'Suspect', 200, 560, 30, '#7a1010', t, false, -0.12);
    inkStamp(g, 'Approved', 520, 560, 26, '#1a3a6a', t, true, 0.1);
    cap('story stamps', 160, 650);
    medallion(g, 860, 560, 40, hex('#1a2a20'));
  }

  private instruments(g: Gfx): void {
    const cap = (s: string, x: number, y: number) => g.text(s, x, y, { size: 13, font: 'italic', color: hex('#e8dcc0', 0.85), shadow: hex('#000000', 0.9) });
    const states: ToolState[] = ['idle', 'selected', 'disabled', 'cooldown'];
    states.forEach((st, row) => {
      TOOLS.forEach((tool, i) => {
        const x = 90 + i * 110;
        const y = 80 + row * 120;
        trayPocketArt(g, { x: x - 44, y: y - 30, w: 88, h: 60 }, st === 'selected', st === 'cooldown' ? 0.4 : 0);
        toolArt(g, tool, x, y, 54, st, 0.4);
      });
      cap(st, 20, 84 + row * 120);
    });
    TOOLS.forEach((tool, i) => toolArt(g, tool, 90 + i * 110, 580, 32));
    cap('32 px inline variants', 20, 584);
    crosshairArt(g, { x: 1000, y: 620 }, '#9fd3a8');
    crosshairArt(g, { x: 1060, y: 620 }, '#ff5a4a');
    crosshairArt(g, { x: 1120, y: 620 });
    cap('crosshair: valid / invalid / neutral', 960, 660);
  }
}

function hexTriple(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

