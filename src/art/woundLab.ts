/**
 * Wound and ailment look-dev board (`?scene=woundlab`): every AILMENT_FS piece and state painted on
 * live flesh, four pages (1 lodged objects, 2 burns and disease, 3 vermin, wounds and closure, 4 the Matins
 * callout sheet, 5 the Book-of-Hours card template).
 * `?page=2&t=1.5` opens a page with time frozen, for screenshots; ←/→ step one frame at 12 fps,
 * Space toggles playback. A QA tool: each ailment should be checked here before it ships.
 */
import type { Game, Scene } from '../core/scene';
import type { Vec } from '../core/math';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { organPalette } from '../render/organs';
import type { OperationDef } from '../surgery/operation';
import { VIEW_H, VIEW_W } from '../ui/layout';
import { giltText, UI } from '../ui/ornaments';
import type { Hour } from './curse';
import { bookOfHoursCard } from './hoursCard';
import {
  acidBurnArt,
  buboArt,
  eggSacArt,
  fangArt,
  fireBurnArt,
  glassArt,
  grubArt,
  hexfireEdgeArt,
  hexstoneArt,
  missileArt,
  poolArt,
  powderArt,
  poxArt,
  rotArt,
  salveArt,
  scarArt,
  shotArt,
  silkArt,
  spoolArt,
  spurtArt,
  stitchArt,
  threadKnotArt,
  venomArt,
  woundArt,
} from './ailmentArt';

type Cell = [label: string, draw: (g: Gfx, c: Vec, t: number) => void];

const off = (c: Vec, dx: number, dy: number): Vec => ({ x: c.x + dx, y: c.y + dy });
const loop = (t: number, period: number): number => (t % period) / period;

const PAGES: { title: string; cells: Cell[]; custom?: (g: Gfx, t: number) => void }[] = [
  {
    title: 'Lodged objects',
    cells: [
      ['Arrow (goose)', (g, c) => missileArt(g, off(c, 40, 0), Math.PI - 0.3, 90, off(c, 40, 0), { kind: 'arrow', seed: 1 })],
      ['Barbed, pulled clear', (g, c) => missileArt(g, off(c, 30, 0), Math.PI, 70, off(c, -30, 0), { kind: 'barbed', seed: 2 })],
      ['Barbed, nicked', (g, c) => missileArt(g, off(c, 30, 0), Math.PI, 70, off(c, -30, 0), { kind: 'barbed', nicks: 2, seed: 3 })],
      ['Barbed, torn out', (g, c) => missileArt(g, off(c, 30, 0), Math.PI, 70, off(c, -30, 0), { kind: 'barbed', torn: true, seed: 4 })],
      ['Grab wobble (4 f)', (g, c) => missileArt(g, off(c, 40, 10), Math.PI - 0.5, 80, off(c, 40, 10), { kind: 'arrow', wobble: 1, seed: 5 })],
      ['Bolt', (g, c) => missileArt(g, off(c, 30, 0), Math.PI - 0.2, 60, off(c, 30, 0), { kind: 'bolt', seed: 6 })],
      ['Bolt, leather vanes', (g, c) => missileArt(g, off(c, 20, 0), Math.PI, 60, off(c, -30, 0), { kind: 'bolt-leather', seed: 7 })],
      ['Bolt, snapped', (g, c) => missileArt(g, off(c, 30, 0), Math.PI, 60, off(c, 30, 0), { kind: 'bolt', snapped: true, seed: 8 })],
      ['Shot 3 sizes', (g, c) => [5, 7, 9].forEach((r, i) => shotArt(g, off(c, -40 + i * 38, 0), r, { seed: i }))],
      ['Shot, flattened', (g, c) => shotArt(g, c, 9, { flattened: 1, seed: 3 })],
      ['Powder tattoo', (g, c) => (powderArt(g, c, 30, { seed: 1 }), shotArt(g, c, 7, { sunk: 0.6 }))],
      ['Powder burn grains', (g, c) => powderArt(g, c, 34, { grains: 1, scorch: 1, seed: 2 })],
      ['Gravehound canine', (g, c) => fangArt(g, off(c, 20, 0), Math.PI - 0.4, 34, off(c, 20, 0), { seed: 1 })],
      ['Brood-spider fang', (g, c) => fangArt(g, off(c, 20, 0), Math.PI - 0.4, 34, off(c, -30, 0), { spider: true, venom: true, seed: 2 })],
      ['Glass shards (5)', (g, c) => [0, 1, 2, 3, 4].forEach((s) => glassArt(g, off(c, -60 + s * 30, (s % 2) * 16 - 8), Math.PI / 2 + s * 0.4, 20, off(c, -60 + s * 30 + Math.cos(Math.PI / 2 + s * 0.4) * 60, (s % 2) * 16 - 8 + Math.sin(Math.PI / 2 + s * 0.4) * 60), { shape: s, seed: s }))],
      ['Hexstone (6 f pulse)', (g, c) => hexstoneArt(g, c, 0.4, 34, { seed: 1 })],
      ['Hexstone, crackle', (g, c) => hexstoneArt(g, c, 0.4, 34, { crackle: 1, seed: 2 })],
      ['Hexstone, dissolve', (g, c, t) => hexstoneArt(g, c, 0.4, 34, { dissolve: loop(t, 2), seed: 3 })],
    ],
  },
  {
    title: 'Burns and disease',
    cells: [
      ['Fire: reddened', (g, c) => fireBurnArt(g, c, 34, 0.2, 0, 1)],
      ['Fire: blistered', (g, c) => fireBurnArt(g, c, 34, 0.5, 0, 2)],
      ['Fire: charred', (g, c) => fireBurnArt(g, c, 34, 1, 0, 3)],
      ['Fire: cooled by salve', (g, c) => fireBurnArt(g, c, 34, 1, 0.8, 3)],
      ['Acid (6 f bubbling)', (g, c) => acidBurnArt(g, c, 34, 0, 1)],
      ['Acid, neutralised', (g, c) => acidBurnArt(g, c, 34, 1, 1)],
      ['Hexfire (8 f)', (g, c) => (fireBurnArt(g, c, 26, 1, 0, 4), hexfireEdgeArt(g, c, 26, 1, 1))],
      ['Bubo 3 sizes', (g, c) => [8, 12, 17].forEach((r, i) => buboArt(g, off(c, -52 + i * 44, 0), r, { ripe: 0.3 + i * 0.3, seed: i }))],
      ['Bubo lance burst (6 f)', (g, c, t) => buboArt(g, c, 20, { ripe: 1, burst: loop(t, 1.5), seed: 1 })],
      ['Bubo drained', (g, c) => buboArt(g, c, 20, { ripe: 0.5, burst: 1, drained: 1, seed: 1 })],
      ['Rot: 4 stages', (g, c) => [0, 0.34, 0.67, 1].forEach((s, i) => rotArt(g, off(c, -60 + i * 40, 0), 22, s, 0, i))],
      ['Rot, half debrided', (g, c) => rotArt(g, c, 36, 1, 0.5, 2)],
      ['Gangrene spreading', (g, c, t) => rotArt(g, c, 36, loop(t, 4), 0, 5)],
      ['Pox cluster', (g, c) => poxArt(g, c, 40, 0, 1)],
      ['Pox, lanced', (g, c) => poxArt(g, c, 40, 0.6, 1)],
      ['Venom web', (g, c, t) => venomArt(g, c, 20 + 30 * loop(t, 3), 0, [0.05, 0.1, 0.03], 1)],
      ['Venom, tincture fade', (g, c, t) => venomArt(g, c, 44, loop(t, 2), [0.05, 0.1, 0.03], 2)],
      ['Curse venom', (g, c) => venomArt(g, c, 44, 0, [0.08, 0.03, 0.12], 3)],
    ],
  },
  {
    title: 'Vermin, wounds and closure',
    cells: [
      ['Grub crawl (8 f)', (g, c) => grubArt(g, c, 0.3, 34, { seed: 1 })],
      ['Grub burrowing', (g, c, t) => grubArt(g, c, 0, 34, { burrowed: loop(t, 2.5), seed: 2 })],
      ['Grub in tongs (4 f)', (g, c) => grubArt(g, c, -0.6, 34, { squirm: 1, seed: 3 })],
      ['Egg sacs (3 sizes)', (g, c) => [10, 15, 21].forEach((r, i) => eggSacArt(g, off(c, -56 + i * 46, 0), r, { seed: i }))],
      ['Egg sac hatching (8 f)', (g, c, t) => eggSacArt(g, c, 22, { hatch: loop(t, 2), swell: 1, seed: 1 })],
      ['Egg sac in tongs', (g, c) => eggSacArt(g, off(c, 0, -10), 20, { lifted: 1, seed: 2 })],
      ['Brood silk', (g, c) => silkArt(g, off(c, -70, -10), off(c, 70, 12), 0, 1)],
      ['Brood silk, cut', (g, c) => silkArt(g, off(c, -70, -10), off(c, 70, 12), 1, 1)],
      ['Incision opening (6 f)', (g, c, t) => woundArt(g, [off(c, -70, 10), off(c, 0, -6), off(c, 70, 4)], 5, { open: loop(t, 1.2), seed: 1 })],
      ['Lacerations 3 widths', (g, c) => [3, 5, 8].forEach((w, i) => woundArt(g, [off(c, -60, -30 + i * 28), off(c, 60, -34 + i * 28)], w, { seed: i }))],
      ['Claw rake (ragged)', (g, c) => [0, 1, 2, 3].forEach((i) => woundArt(g, [off(c, -60 + i * 10, -34 + i * 20), off(c, 50 + i * 10, -44 + i * 20)], 4, { claw: true, seed: i }))],
      ['Pulse bleed', (g, c, t) => woundArt(g, [off(c, -60, 0), off(c, 60, 0)], 7, { bleed: 1, beat: Math.exp(-((t * 1.2) % 1) * 6), seed: 3 })],
      ['Gut stitches, tightening', (g, c, t) => {
        woundArt(g, [off(c, -70, 0), off(c, 70, 0)], 3, { seed: 4 });
        for (let i = 0; i < 5; i++) stitchArt(g, off(c, -48 + i * 24, 0), 0, 8, i < 4 ? 1 : loop(t, 1), i);
      }],
      ['Sutured scar, fresh', (g, c) => scarArt(g, [off(c, -70, 8), off(c, 0, -8), off(c, 70, 4)], 4, 0)],
      ['Scar, healed', (g, c) => scarArt(g, [off(c, -70, 8), off(c, 70, -4)], 4, 1)],
      ["Saint's Salve absorbing", (g, c, t) => salveArt(g, c, 36, loop(t, 2.5), 1)],
      ['Arterial spurt (6 f)', (g, c, t) => [0, -0.9, 0.9].forEach((a, i) => spurtArt(g, off(c, -60, 20 - i * 20), a - 0.2, 110, loop(t + i * 0.2, 0.6), i))],
      ['Pools: blood, pus, bile', (g, c) => ([0, 1, 2] as const).forEach((k) => poolArt(g, off(c, -52 + k * 52, 0), 20, k, k))],
    ],
  },
  {
    // Matins callout sheet (ART-0230): eye states, phase degradation and the hurt flash, on flesh.
    title: 'Matins — callout sheet',
    cells: [
      ['Eye closed (sewn)', (g, c) => g.creature(0, c.x, c.y, 200, { seed: 1, open: 0, health: 1 })],
      ['Eye opening', (g, c) => g.creature(0, c.x, c.y, 200, { seed: 1, open: 0.45, health: 1 })],
      ['Eye open (iris ramp)', (g, c) => g.creature(0, c.x, c.y, 200, { seed: 1, open: 1, health: 1 })],
      ['Open/close (10 f)', (g, c, t) => g.creature(0, c.x, c.y, 200, { seed: 2, open: 0.5 + 0.5 * Math.sin(t * 2), health: 1 })],
      ['Hurt flash', (g, c) => g.creature(0, c.x, c.y, 200, { seed: 3, open: 0.6, health: 1, flash: 1 })],
      ['Breathing (12 f)', (g, c) => g.creature(0, c.x, c.y, 200, { seed: 4, open: 0, health: 1 })],
      ['Phase I: intact', (g, c) => g.creature(0, c.x, c.y, 200, { seed: 5, open: 0.8, health: 0.9 })],
      ['Phase II: torn', (g, c) => g.creature(0, c.x, c.y, 200, { seed: 5, open: 0.8, health: 0.5 })],
      ['Phase III: shredded', (g, c) => g.creature(0, c.x, c.y, 200, { seed: 5, open: 0.8, health: 0.2 })],
      ['Shard knots (3 shapes)', (g, c) => [0, 1, 2].forEach((k) => threadKnotArt(g, off(c, -60 + k * 60, 0), 16, { shape: k, seed: k }))],
      ['Shard burst (8 f)', (g, c, t) => threadKnotArt(g, c, 16, { shape: 0, burst: loop(t, 0.8), seed: 4 })],
      ['Crawler shard', (g, c) => threadKnotArt(g, c, 16, { shape: 2, crawler: true, seed: 5 })],
      ['Thread spool: full → spent', (g, c) => [1, 0.55, 0.15].forEach((f, i) => spoolArt(g, c.x - 60 + i * 60, c.y, 52, f, 0, (1 - f) * 6))],
    ],
  },
  {
    // Book-of-Hours card template (ART-0227), one card per Hour with the default miniature.
    title: 'Book-of-Hours cards',
    cells: [],
    custom: (g) => {
      const names: [Hour, string, string][] = [
        ['matins', 'Matins', 'Ad Matutinum'],
        ['lauds', 'Lauds', 'Ad Laudes'],
        ['prime', 'Prime', 'Ad Primam'],
        ['terce', 'Terce', 'Ad Tertiam'],
        ['sext', 'Sext', 'Ad Sextam'],
        ['none', 'None', 'Ad Nonam'],
        ['vespers', 'Vespers', 'Ad Vesperas'],
        ['compline', 'Compline', 'Ad Completorium'],
      ];
      names.forEach(([hour, title, sub], i) => bookOfHoursCard(g, { x: 30 + (i % 4) * 310, y: 62 + Math.floor(i / 4) * 330, w: 214, h: 320 }, hour, { title, sub }));
    },
  },
];

export class WoundLabScene implements Scene {
  private page = 0;
  private t = 0;
  private playing = true;

  constructor() {
    const q = new URLSearchParams(location.search);
    this.page = Math.max(0, Math.min(PAGES.length - 1, Number(q.get('page') ?? 1) - 1));
    if (q.get('t')) {
      this.t = Number(q.get('t'));
      this.playing = false;
    }
  }

  update(dt: number, game: Game): void {
    const k = game.input;
    if (this.playing) this.t += dt;
    if (k.keyPressed('Space')) this.playing = !this.playing;
    if (k.keyPressed('ArrowRight')) this.t += 1 / 12;
    if (k.keyPressed('ArrowLeft')) this.t = Math.max(0, this.t - 1 / 12);
    for (let i = 0; i < PAGES.length; i++) if (k.keyPressed(`Digit${i + 1}`)) this.page = i;
  }

  render(g: Gfx, _game: Game): void {
    g.beginLayer('surface');
    g.endLayer();
    g.beginLayer('fluid');
    g.endLayer();
    g.beginWorld();
    const pal = organPalette({ organ: 'flesh', race: 'human' } as OperationDef);
    g.fleshField({ center: { x: VIEW_W / 2, y: VIEW_H / 2 + 20 }, radii: { x: VIEW_W * 0.7, y: VIEW_H * 0.75 }, kind: pal.kind, base: pal.base, deep: pal.deep, vein: pal.vein, pulse: 0.3,
      light: { x: VIEW_W / 2, y: 180 },
      corrupt: 0,
      cellSoft: pal.cellSoft,
      rough: pal.rough,
      species: pal.species,
      lights: [
        { x: VIEW_W / 2, y: VIEW_H / 2, h: 1.8, i: 1.7, col: [0.95, 0.9, 0.82] },
        { x: 80, y: VIEW_H - 100, h: 0.5, i: 0.5, col: [1.0, 0.6, 0.3] },
        { x: VIEW_W - 80, y: 200, h: 0.5, i: 0.5, col: [1.0, 0.62, 0.32] },
      ],
    });
    const page = PAGES[this.page];
    if (page.custom) {
      g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 0.2, lutA: 'neutral', lutB: 'neutral', lutMix: 0, litanyCenter: [0.5, 0.5], litanyAge: 3 });
      g.rect(0, 0, VIEW_W, VIEW_H, hex('#1a120c'));
      page.custom(g, this.t);
      g.rect(0, 0, VIEW_W, 52, hex('#0c0806', 0.78));
      giltText(g, `Wound Lab — ${page.title}`, 20, 38, { size: 28 });
      g.endFrame();
      return;
    }
    const cols = 6;
    const cw = VIEW_W / cols;
    const ch = (VIEW_H - 70) / 3;
    page.cells.forEach(([, draw], i) => draw(g, { x: cw * (i % cols) + cw / 2, y: 70 + ch * Math.floor(i / cols) + ch / 2 + 6 }, this.t));
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 0.5, lutA: 'candle', lutB: 'candle', lutMix: 0, litanyCenter: [0.5, 0.5], litanyAge: 3 });
    g.rect(0, 0, VIEW_W, 52, hex('#0c0806', 0.78));
    giltText(g, `Wound Lab — ${page.title}`, 20, 38, { size: 28 });
    g.text(`Page ${this.page + 1}/${PAGES.length} (1–${PAGES.length})   Space: ${this.playing ? 'pause' : 'play'}   ←/→: frame   t=${this.t.toFixed(2)}s`, VIEW_W - 20, 34, { size: 16, color: hex(UI.parch), align: 'right' });
    page.cells.forEach(([label], i) => {
      const x = cw * (i % cols) + cw / 2;
      const y = 70 + ch * Math.floor(i / cols) + ch - 12;
      g.text(label, x, y, { size: 16, color: hex('#fff0d8'), align: 'center' });
    });
    g.endFrame();
  }
}
