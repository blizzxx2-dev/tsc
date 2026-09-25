/**
 * The procedural UI art kit: typed wrappers over UI_ART_FS (src/art/uiShader.ts) plus the
 * flipbook timing for seals and stamps. Everything is drawn at runtime — no image assets.
 */
import type { Vec } from '../core/math';
import { hex, vec3, type RGBA } from '../render/color';
import type { Gfx, TextOpts } from '../render/gfx';
import type { ToolId } from '../surgery/types';
import { FPS } from './timing';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A packed RGBA colour as a shader vec3. */
export const rgbOf = (c: RGBA): [number, number, number] => [(c & 255) / 255, ((c >>> 8) & 255) / 255, ((c >>> 16) & 255) / 255];

/** UI_ART_FS mode numbers. */
export const ART = {
  parchment: 0,
  oak: 1,
  leather: 2,
  seal: 3,
  stamp: 4,
  gauge: 5,
  sandGlass: 6,
  reliquary: 7,
  vial: 8,
  medallion: 9,
  vellumStrip: 10,
  trayPocket: 11,
  ribbon: 12,
  plaque: 13,
  tally: 14,
  tool: 15,
  crosshair: 16,
  ledger: 17,
} as const;

/** Woodcut flipbook rate for UI animation (12 fps). */
export const FLIPBOOK_FPS: number = FPS.woodcut;
export const frameAt = (t: number, frames: number, fps = FLIPBOOK_FPS): number => Math.max(0, Math.min(frames - 1, Math.floor(t * fps)));

const TOOL_INDEX: Record<ToolId, number> = { lancet: 0, tongs: 1, leech: 2, thread: 3, salve: 4, tincture: 5, brand: 6, lens: 7 };

export type ParchmentKind = 'fresh' | 'foxed' | 'burnt';

/** A vellum sheet: fibres, tide-marks, optional foxing or burnt edge, torn deckle. */
export function parchmentArt(g: Gfx, r: Rect, kind: ParchmentKind = 'foxed', torn = 1, seed = 1, alpha = 1): void {
  g.ornament(ART.parchment, r.x, r.y, r.w, r.h, { a: [kind === 'fresh' ? 0 : kind === 'foxed' ? 1 : 2, torn, 0, 0], seed, alpha });
}

/** Soot-stained oak planks bound with iron straps (HUD and pause panels). */
export function oakArt(g: Gfx, r: Rect, alpha = 1, seed = 1): void {
  g.ornament(ART.oak, r.x, r.y, r.w, r.h, { seed, alpha });
}

/** Pebbled, blind-tooled and saddle-stitched leather. */
export function leatherArt(g: Gfx, r: Rect, alpha = 1, seed = 1): void {
  g.ornament(ART.leather, r.x, r.y, r.w, r.h, { seed, alpha });
}

export interface SealOpts {
  press?: number;
  cracked?: boolean;
  gilt?: boolean;
  skull?: boolean;
  seed?: number;
  alpha?: number;
}

/** A wax seal in relief, radius `r`. */
export function sealArt(g: Gfx, x: number, y: number, r: number, color: string, o: SealOpts = {}): void {
  const s = r * 2.6;
  g.ornament(ART.seal, x - s / 2, y - s / 2, s, s, {
    col: vec3(color),
    a: [o.press ?? 1, o.cracked ? 1 : 0, o.gilt ? 1 : 0, o.skull ? 1 : 0],
    seed: o.seed ?? x * 0.13 + y * 0.07,
    alpha: o.alpha,
  });
}

/** Text pressed into wax: a dark impression with a lit lower lip. */
export function debossText(g: Gfx, str: string, x: number, y: number, size: number, dark: string, light: string, font: TextOpts['font'] = 'display', alpha = 1): void {
  g.text(str, x + 0.8, y + 1.2, { size, font, color: hex(light, 0.45 * alpha), align: 'center', shadow: false });
  g.text(str, x, y, { size, font, color: hex(dark, 0.92 * alpha), align: 'center', shadow: false });
}

export type Rank = 'XS' | 'S' | 'A' | 'B' | 'C';

/** Rank seals: gold-leaf XS, oxblood S, green A, brown B, cracked grey C. */
export const RANK_SEAL: Record<Rank, { wax: string; ink: string; lip: string; gilt?: boolean; cracked?: boolean }> = {
  XS: { wax: '#a8781a', ink: '#3a2404', lip: '#ffe8a0', gilt: true },
  S: { wax: '#7a0c14', ink: '#2a0204', lip: '#ff9090' },
  A: { wax: '#28543a', ink: '#081a10', lip: '#a0e0b0' },
  B: { wax: '#5a3a1e', ink: '#1a0e04', lip: '#e0b890' },
  C: { wax: '#6a6660', ink: '#1a1816', lip: '#d8d4cc', cracked: true },
};

/** Six-frame press-in: the blob drops, spreads, overshoots and settles (press, scale). */
export const SEAL_PRESS_FRAMES: [number, number][] = [
  [0.0, 1.5],
  [0.25, 1.25],
  [0.55, 1.05],
  [0.85, 0.94],
  [1.0, 1.03],
  [1.0, 1.0],
];

/** A rank seal with its press-in animation; `t` is seconds since the stamp began (< 0 hides it). */
export function rankSeal(g: Gfx, x: number, y: number, r: number, rank: string, t: number): void {
  if (t < 0) return;
  const spec = RANK_SEAL[(rank in RANK_SEAL ? rank : 'C') as Rank];
  const [press, scale] = SEAL_PRESS_FRAMES[frameAt(t, 6)];
  const rr = r * scale;
  sealArt(g, x, y, rr, spec.wax, { press, gilt: spec.gilt, cracked: spec.cracked, seed: 3 });
  if (press >= 0.85) {
    const size = (rank.length > 1 ? 0.78 : 0.95) * rr;
    debossText(g, rank, x, y + size * 0.36, size, spec.ink, spec.lip);
  }
}

/** The black-wax "Operation Failed" seal with a Holbein death's-head impression. */
export function failSeal(g: Gfx, x: number, y: number, r: number, t = 1): void {
  if (t < 0) return;
  const [press, scale] = SEAL_PRESS_FRAMES[frameAt(t, 6)];
  sealArt(g, x, y, r * scale, '#1c1a1a', { press, skull: true, seed: 11 });
}

/** A chapter-complete seal: gilt-flecked oxblood wax bearing the chapter numeral. */
export function chapterSeal(g: Gfx, x: number, y: number, r: number, numeral: string, t = 1): void {
  if (t < 0) return;
  const [press, scale] = SEAL_PRESS_FRAMES[frameAt(t, 6)];
  sealArt(g, x, y, r * scale, '#6a0a10', { press, gilt: true, seed: 5 });
  if (press >= 0.85) debossText(g, numeral, x, y + r * 0.3, r * 0.8, '#2a0204', '#ffb0a0', 'body');
}

export type Rating = 'cool' | 'good' | 'bad' | 'miss';

/** Ink colours per rating: gilt, verdigris, umber, oxblood. */
export const RATING_INK: Record<Rating, [string, string]> = {
  cool: ['#f5d76e', '#7a4a08'],
  good: ['#b8e0c8', '#1a4a30'],
  bad: ['#e0955a', '#4a1a04'],
  // Crimson, not orange-red: BAD and MISS stay apart for deuteranopes without a filter (ART-0357).
  miss: ['#e03050', '#3a0404'],
};

/** Four-frame stamp hit: lifted (large, faint), strike, rebound, rest. */
export const STAMP_FRAMES: { scale: number; alpha: number; hit: number }[] = [
  { scale: 1.55, alpha: 0.35, hit: 0 },
  { scale: 0.92, alpha: 1, hit: 0.5 },
  { scale: 1.05, alpha: 1, hit: 0.75 },
  { scale: 1, alpha: 1, hit: 1 },
];

/** An ink-stamp rating: a blackletter word inside an inked double frame. `t` = seconds since the hit. */
export function ratingStamp(g: Gfx, rating: Rating, word: string, x: number, y: number, t: number, fade = 1, size = 32, inks: [string, string] = RATING_INK[rating]): void {
  const fr = STAMP_FRAMES[frameAt(t, 4, 24)];
  const [ink, dark] = inks;
  const s = size * fr.scale;
  const w = g.measure(word, s, 'display') + s * 1.1;
  const h = s * 1.5;
  const a = fr.alpha * fade;
  const rot = rating === 'miss' ? 0.12 : rating === 'bad' ? -0.08 : -0.04;
  if (rating === 'cool') {
    g.setBlend('add');
    g.glow(x, y - s * 0.35, s * 2.2, hex(ink, 0.22 * a));
    g.setBlend('alpha');
  }
  // Dark under-print keeps the stamp legible on red flesh.
  g.ornament(ART.stamp, x - w / 2 + 1.5, y - s * 1.1 + 2, w, h, { col: vec3(dark), a: [fr.hit, 0, 0, 0], rot, seed: 3, alpha: 0.8 * a });
  g.ornament(ART.stamp, x - w / 2, y - s * 1.1, w, h, { col: vec3(ink), a: [fr.hit, 0, 0, 0], rot, seed: 3, alpha: a });
  g.save();
  g.translate(x, y - s * 0.35);
  g.rotate(-rot);
  g.text(word, 0, s * 0.35, { size: s, font: 'display', color: hex(ink, a), color2: hex(dark, a), align: 'center', shadow: hex('#0a0402', 0.9 * a) });
  g.restore();
}

/** A story-beat ink stamp ("SUSPECT", "APPROVED"): round or oblong, any ink. */
export function inkStamp(g: Gfx, word: string, x: number, y: number, size: number, ink: string, t = 1, round = false, rot = -0.1): void {
  const fr = STAMP_FRAMES[frameAt(t, 4, 24)];
  const s = size * fr.scale;
  const label = word.toUpperCase();
  const w = round ? s * 3.4 : g.measure(label, s, 'body') + s * 1.4;
  const h = round ? w : s * 1.8;
  const ts = round ? Math.min(s * 0.7, (w * 0.7 * s) / Math.max(1, g.measure(label, s, 'body'))) : s;
  g.ornament(ART.stamp, x - w / 2, y - h / 2, w, h, { col: vec3(ink), a: [fr.hit, round ? 1 : 0, 0, 0], rot, seed: 7, alpha: fr.alpha * 0.9 });
  g.save();
  g.translate(x, y);
  g.rotate(-rot);
  g.text(label, 0, ts * 0.35, { size: ts, font: 'body', color: hex(ink, 0.85 * fr.alpha), align: 'center', shadow: false });
  g.restore();
}

/** Brass-and-glass apothecary gauge filled with red tincture. */
export function tinctureGauge(g: Gfx, r: Rect, level: number, crack = 0, pulse = 0): void {
  g.ornament(ART.gauge, r.x, r.y, r.w, r.h, { a: [level, crack, pulse, 0] });
}

/** Sand-glass: brass plates, turned posts, a live sand stream. `frac` = sand left on top. */
export function sandGlassArt(g: Gfx, x: number, y: number, h: number, frac: number): void {
  const w = h * 0.66;
  g.ornament(ART.sandGlass, x - w / 2, y - h / 2, w, h, { a: [frac, 0, 0, 0] });
}

export interface ReliquaryState {
  fill: number;
  spent?: boolean;
  glint?: boolean;
  active?: boolean;
}

/** The Litany gauge: a five-pointed-star reliquary that fills with gilt. */
export function starReliquary(g: Gfx, x: number, y: number, r: number, s: ReliquaryState): void {
  const d = r * 2.2;
  if (s.active) {
    g.setBlend('add');
    g.glow(x, y, r * 2.2, hex('#f5d76e', 0.3));
    g.setBlend('alpha');
  }
  g.circle(x + 2, y + 3, r + 1, hex('#000000', 0.45));
  g.ornament(ART.reliquary, x - d / 2, y - d / 2, d, d, { a: [s.fill, s.spent ? 1 : 0, s.glint ? 1 : 0, s.active ? 1 : 0] });
}

/** Tincture vial: `fill` in thirds; `corked` shows the empty, stoppered state. */
export function vialArt(g: Gfx, x: number, y: number, h: number, fill: number, corked = false): void {
  const w = h * 0.6;
  g.ornament(ART.vial, x - w / 2, y - h / 2, w, h, { a: [fill, corked ? 1 : 0, 0, 0] });
}

/** Round brass bezel with a glazed inset. */
export function medallionArt(g: Gfx, x: number, y: number, r: number, inset: string | RGBA = '#140a08'): void {
  g.circle(x + 2, y + 3, r + 5, hex('#000000', 0.5));
  const d = (r + 5) * 2;
  g.ornament(ART.medallion, x - d / 2, y - d / 2, d, d, { col: typeof inset === 'string' ? vec3(inset) : rgbOf(inset) });
}

/** Vellum strip with rolled ends, ruled for a quill pulse-trace. */
export function vellumStripArt(g: Gfx, r: Rect): void {
  g.ornament(ART.vellumStrip, r.x - 7, r.y, r.w + 14, r.h, { seed: 4 });
}

/** A pocket in the instrument roll: selected glows gilt; cooldown shutters it. */
export function trayPocketArt(g: Gfx, r: Rect, selected: boolean, cooldown = 0): void {
  g.ornament(ART.trayPocket, r.x, r.y, r.w, r.h, { a: [selected ? 1 : 0, cooldown, 0, 0] });
}

/** Torn ribbon scroll (swallow-tailed), unfurling from the centre as `unfurl` goes 0→1. */
export function ribbonArt(g: Gfx, cx: number, y: number, w: number, h: number, color = '#5a0c10', unfurl = 1): void {
  g.ornament(ART.ribbon, cx - w / 2, y - h * 0.2, w, h * 1.4, { col: vec3(color), a: [unfurl, 0, 0, 0] });
}

/** Engraved brass plaque with a sunken field. */
export function plaqueArt(g: Gfx, r: Rect): void {
  g.rect(r.x + 3, r.y + 4, r.w, r.h, hex('#000000', 0.5));
  g.ornament(ART.plaque, r.x, r.y, r.w, r.h);
}

/** A tally-mark ribbon for the combo counter (gilt from ×10). */
export function tallyRibbon(g: Gfx, cx: number, cy: number, w: number, h: number, count: number): void {
  g.ornament(ART.tally, cx - w / 2, cy - h * 0.7, w, h * 1.4, { col: vec3(count >= 10 ? '#3a1a04' : '#5a0c10'), a: [count, 0, 0, 0] });
}

export type ToolState = 'idle' | 'selected' | 'disabled' | 'cooldown';
const TOOL_STATE: Record<ToolState, number> = { idle: 0, selected: 1, disabled: 2, cooldown: 3 };

/** Cosmetic instrument skins (ART-0379): the tray icon and the in-field sprite share them. */
export type ToolSkin = 'steel' | 'bone' | 'gilt' | 'pyre';
export const TOOL_SKINS: readonly ToolSkin[] = ['steel', 'bone', 'gilt', 'pyre'];
const SKIN_INDEX: Record<ToolSkin, number> = { steel: 0, bone: 1, gilt: 2, pyre: 3 };

/** Brass-engraved instrument icon, `size` px square. */
export function toolArt(g: Gfx, tool: ToolId, x: number, y: number, size: number, state: ToolState = 'idle', cooldown = 0, skin: ToolSkin = 'steel'): void {
  g.ornament(ART.tool, x - size / 2, y - size / 2, size, size, { a: [TOOL_INDEX[tool], TOOL_STATE[state], cooldown, SKIN_INDEX[skin]] });
}

/** Brass crosshair; `tint` shades the brass (green valid target, red invalid). */
export function crosshairArt(g: Gfx, p: Vec, tint = '#f5d76e', size = 30): void {
  g.ornament(ART.crosshair, p.x - size / 2, p.y - size / 2, size, size, { col: vec3(tint) });
}

/** A ruled ledger page hung from a cord. */
export function ledgerArt(g: Gfx, r: Rect, alpha = 1): void {
  g.line({ x: r.x + r.w / 2, y: r.y - 70 }, { x: r.x + r.w / 2, y: r.y + 12 }, 2, hex('#6a5030', alpha));
  g.rect(r.x + 8, r.y + 10, r.w, r.h, hex('#000000', 0.45 * alpha));
  g.ornament(ART.ledger, r.x, r.y, r.w, r.h, { seed: 9, alpha });
}
