import { BURN_GRADES, spawnGrade, type BurnGrade } from '../art/burnGrades';
import { fireBurnArt } from '../art/ailmentArt';
import { opData } from '../content/schema';
import { DEFAULT_TUNING } from '../surgery/tuning';
import type { Game, Scene } from '../core/scene';
import { t, tSource } from '../i18n';
import { formatClock } from '../i18n/format';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import type { OperationDef } from '../surgery/operation';
import { TOOL_INFO, type ToolId } from '../surgery/types';
import { glyphFor } from '../input/glyphs';
import type { ActionId } from '../input/actions';
import { TOOL_INTRODUCED } from '../surgery/tutorial';
import { rankThresholds } from '../surgery/ranks';
import { settings } from '../core/settings';
import { VIEW_W } from '../ui/layout';
import { button, reticle, toolIcon } from '../ui/widgets';
import { drawBackdrop } from './backdrop';
import { briefingNotes } from '../surgery/session';
import { drawWoundMan, ENGRAVED_INKS, prognosis, woundSites, type Pin } from '../art/woundMan';
import { caps, glass, heading, INK, keycap, numerals } from '../ui/hudKit';

/** The patient chart shown before an operation. */
/** Fire burns the case spawns, counted by the grade they arrive with (GAM-0074). */
export function burnCounts(def: OperationDef): { grade: BurnGrade; n: number }[] {
  const data = opData(def);
  if (!data) return [];
  const by = new Map<BurnGrade, number>();
  for (const ph of data.phases)
    for (const sp of ph.spawn ?? []) {
      const b = sp as { e: string; r?: number; source?: string };
      if (b.e !== 'burn' || (b.source ?? 'fire') !== 'fire' || typeof b.r !== 'number') continue;
      const gr = spawnGrade(b.r, DEFAULT_TUNING.burn.grade3Radius);
      by.set(gr, (by.get(gr) ?? 0) + 1);
    }
  return [...by].sort((a, b) => b[0] - a[0]).map(([grade, n]) => ({ grade, n }));
}

export class BriefingScene implements Scene {
  private notes: string[] | null = null;
  private pins: Pin[] | null = null;
  private burns: { grade: BurnGrade; n: number }[] | null = null;
  /** Ink-writing of the findings (UIX-0112): characters revealed over time; a click or Reduced Motion completes it. */
  private ink = 0;
  /** New-instrument card (UIX-0111): shown once before Scrub In when the case introduces a tool. */
  private card: { tools: ToolId[]; t: number } | null = null;
  constructor(
    private def: OperationDef,
    private best: { rank: string; score: number } | undefined,
    private onBegin: () => void,
    private onBack: () => void,
  ) {}

  update(dt: number, game: Game): void {
    const len = this.def.diagnosis.length;
    if (settings.reduceMotion || (game.input.pressed && this.ink < len)) this.ink = len;
    else this.ink = Math.min(len, this.ink + dt * 70 * settings.textSpeed);
    if (this.card) this.card.t += dt;
    if (game.input.actPressed('ui.confirm')) this.begin();
    if (game.input.actPressed('ui.back')) {
      if (this.card) this.card = null;
      else this.onBack();
    }
  }

  /** Scrub In: the first press shows the new-instrument card when the case has one; the next begins. */
  private begin(): void {
    if (this.card) return this.card.t > 0.4 ? this.onBegin() : undefined;
    const fresh = this.def.tools.filter((tool) => TOOL_INTRODUCED[tool] === this.def.id);
    if (fresh.length && !this.cardShown) {
      this.cardShown = true;
      this.card = { tools: fresh, t: 0 };
    } else this.onBegin();
  }
  private cardShown = false;

  private drawCard(g: Gfx, game: Game): void {
    const c = this.card!;
    const k = Math.min(1, c.t * 4);
    const vr = g.viewRect();
    g.rect(vr.x, vr.y, vr.w, vr.h, hex('#050303', 0.55 * k));
    const n = c.tools.length;
    const r = { x: VIEW_W / 2 - 270, y: 150 + (1 - k) * 12, w: 540, h: 250 + n * 110 };
    glass(g, r, { strength: 1.2, alpha: k });
    heading(g, t(n > 1 ? 'ui.briefing.new_instruments' : 'ui.briefing.new_instrument'), VIEW_W / 2, r.y + 54, 420, k, 24);
    c.tools.forEach((tool, i) => {
      const y = r.y + 110 + i * 110;
      g.plate(r.x + 40, y - 34, 68, 68, { radius: 3, top: hex('#16110d', 0.95), bottom: hex('#0a0806', 0.95), border: hex(INK.gold, 0.9 * k), borderW: 1.4, bevel: 0.6, shadow: [0.5, 6, 2], glow: hex(INK.gold, 0.25 * k), glowR: 12 });
      toolIcon(g, tool, r.x + 74, y, 1.1, g.time, 'selected');
      caps(g, t(`tool.${tool}.name`), r.x + 130, y - 14, 14, hex(INK.gold, k));
      keycap(g, glyphFor(`tool.select.${TOOL_INFO.findIndex((ti) => ti.id === tool) + 1}` as ActionId), r.x + r.w - 76, y - 26, 11, k);
      g.textBlock(t(`tool.${tool}.hint`), r.x + 130, y + 12, r.w - 220, { size: 17, color: hex(INK.text, 0.92 * k), shadow: false }, 1.3);
    });
    g.text(t('ui.briefing.new_instrument_note'), VIEW_W / 2, r.y + r.h - 70, { size: 16, font: 'italic', color: hex(INK.dim, k), align: 'center', shadow: false });
    if (button(g, game.input, t('ui.briefing.begin'), VIEW_W / 2, r.y + r.h - 30, 28, c.t > 0.4, false)) this.onBegin();
  }

  render(g: Gfx, game: Game): void {
    const d = this.def;
    g.beginWorld();
    drawBackdrop(g, 'theatre', g.time);
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 'menu', defocus: 8 });

    const r = { x: 240, y: 60, w: 800, h: 600 };
    glass(g, r, { strength: 1.12 });
    heading(g, t('ui.briefing.title'), VIEW_W / 2, r.y + 58, 380, 1, 28);
    g.text(d.title, VIEW_W / 2, r.y + 112, { size: 30, color: hex(INK.text), align: 'center', shadow: hex('#000000', 0.8), soft: true });
    const lx = r.x + 56;
    const vx = r.x + 200;
    caps(g, t('ui.briefing.patient'), lx, r.y + 172, 12);
    g.text(d.patient, vx, r.y + 174, { size: 20, color: hex(INK.text), shadow: false });
    caps(g, t('ui.briefing.findings'), lx, r.y + 208, 12);
    g.textBlock(d.diagnosis.slice(0, Math.floor(this.ink)), vx, r.y + 210, r.w - 440, { size: 19, font: 'italic', color: hex('#d8ccb4'), shadow: false }, 1.35);
    // Target ranks (UIX-0110): the thresholds this case is judged by.
    const rk = rankThresholds(d);
    caps(g, t('ui.briefing.targets'), lx, r.y + 296, 12);
    g.text(t('ui.briefing.targets_value', { s: rk.S, a: rk.A, b: rk.B }), vx, r.y + 300, { size: 17, color: hex(INK.dim), shadow: false });
    caps(g, t('ui.briefing.time_allowed'), lx, r.y + 326, 12);
    numerals(g, formatClock(d.timeLimit), vx, r.y + 330, 22, '#ffffff', '#d8ccb4');
    // The Litany is sealed for this patient (GAM-0170): a red tag beside the clock, so the player knows before the star fails.
    if (d.litany === false) caps(g, t('ui.briefing.litany_sealed'), vx + (this.best ? 300 : 110), r.y + 326, 12, hex('#e06050'));
    if (this.best) {
      caps(g, t('ui.briefing.best'), vx + 110, r.y + 326, 12);
      g.text(t('ui.briefing.best_value', { rank: this.best.rank, score: this.best.score }), vx + 170, r.y + 330, { size: 20, color: hex(INK.gold), shadow: false });
    }
    // The Wound Man, engraved in gold, with pins at the injuries, and a stamped prognosis (ART-0056).
    this.pins ??= woundSites(d);
    g.plate(r.x + r.w - 236, r.y + 146, 200, 250, { radius: 2, top: hex('#0a0807', 0.6), bottom: hex('#0e0b09', 0.6), border: hex(INK.gilt, 0.25), borderW: 1, bevel: -0.4, shadow: [0, 0, 0], grain: 0.4 });
    drawWoundMan(g, r.x + r.w - 136, r.y + 160, 222, this.pins, g.time, 1, ENGRAVED_INKS);
    // Burn grades (GAM-0074): each grade this case brings, drawn with the field's own burn art.
    this.burns ??= burnCounts(d);
    if (this.burns.length) {
      caps(g, t('ui.briefing.burns'), lx, r.y + 394, 12);
      let bx = vx + 14;
      for (const { grade, n } of this.burns) {
        fireBurnArt(g, { x: bx, y: r.y + 389 }, 11, BURN_GRADES[grade].severity, 0, grade);
        const label = t('ui.briefing.burn_count', { grade: t(`ui.briefing.burn.${BURN_GRADES[grade].key}`), n });
        g.text(label, bx + 18, r.y + 395, { size: 16, color: hex(INK.dim), shadow: false });
        bx += 40 + g.measure(label, 16);
      }
    }
    const prog = prognosis(d);
    caps(g, t('ui.briefing.prognosis'), lx, r.y + 370, 12);
    (['fair', 'guarded', 'grave'] as const).forEach((k, i) => {
      const bx = vx + i * 110;
      const on = k === prog;
      g.plate(bx, r.y + 356, 16, 16, { radius: 2, top: hex(on ? '#5a1418' : '#0a0807'), bottom: hex(on ? '#2a0608' : '#140f0c'), border: hex(on ? '#e04040' : INK.gilt, on ? 0.95 : 0.5), borderW: 1.2, bevel: 0.4, shadow: [0.4, 3, 1], glow: on ? hex('#e04040', 0.25) : undefined, glowR: 10 });
      if (on) {
        g.line({ x: bx + 4, y: r.y + 360 }, { x: bx + 12, y: r.y + 368 }, 1.8, hex('#ffd0c8'));
        g.line({ x: bx + 12, y: r.y + 360 }, { x: bx + 4, y: r.y + 368 }, 1.8, hex('#ffd0c8'));
      }
      g.text(t(`ui.briefing.prognosis.${k}`), bx + 24, r.y + 370, { size: 18, color: hex(on ? '#ffb0a8' : INK.dim), shadow: false });
    });
    caps(g, t('ui.briefing.instruments'), lx, r.y + 420, 12);
    d.tools.forEach((tool, i) => {
      const x = lx + 34 + i * 84;
      const fresh = TOOL_INTRODUCED[tool] === d.id;
      g.plate(x - 32, r.y + 436, 64, 64, { radius: 3, top: hex('#16110d', 0.95), bottom: hex('#0a0806', 0.95), border: hex(fresh ? INK.gold : '#5a4a34', 0.8), borderW: fresh ? 1.4 : 1, bevel: 0.5, shadow: [0.5, 6, 2], glow: fresh ? hex(INK.gold, 0.2) : undefined, glowR: 10 });
      toolIcon(g, tool, x, r.y + 470, 0.8, g.time);
      // Binding glyph from the live bindings, and a NEW ribbon on an instrument this case introduces.
      keycap(g, glyphFor(`tool.select.${TOOL_INFO.findIndex((ti) => ti.id === tool) + 1}` as ActionId), x - 12, r.y + 508, 11, 1);
      if (fresh) {
        g.plate(x - 26, r.y + 428, 52, 16, { radius: 2, top: hex('#8a1016'), bottom: hex('#5a0a10'), border: hex(INK.goldHi, 0.9), borderW: 1, bevel: 0.4, shadow: [0.4, 3, 1] });
        caps(g, t('ui.briefing.new'), x, r.y + 440, 10, hex('#ffe8c0'), 'center');
      }
    });
    // Sister Ilse's note (UIX-0110): the first instruction of the case, in her hand.
    const note = d.phases[0]?.callout?.[0];
    if (note) {
      const nr = { x: r.x + r.w - 236, y: r.y + 404, w: 200, h: 96 };
      g.plate(nr.x, nr.y, nr.w, nr.h, { radius: 2, top: hex('#1a1411', 0.9), bottom: hex('#0e0b09', 0.9), border: hex(INK.gilt, 0.35), borderW: 1, bevel: 0.3, shadow: [0.3, 4, 1] });
      caps(g, t('ui.briefing.ilse_note'), nr.x + 12, nr.y + 18, 10, hex(INK.gold));
      g.textBlock(tSource(note), nr.x + 12, nr.y + 38, nr.w - 24, { size: 16, font: 'italic', color: hex(INK.text, 0.9), shadow: false }, 1.25);
    }
    this.notes ??= briefingNotes(d);
    this.notes.forEach((n, i) => g.text(n, lx, r.y + 548 + i * 18, { size: 16, font: 'italic', color: hex(INK.dim), shadow: false }));
    if (button(g, game.input, t('ui.briefing.begin'), r.x + r.w - 140, r.y + 568, 30, !this.card, false)) this.begin();
    if (button(g, game.input, t('ui.common.back'), r.x + r.w - 330, r.y + 568, 24, !this.card, false)) this.onBack();
    if (this.card) this.drawCard(g, game);
    reticle(g, game.input.pos);
    g.endFrame();
  }
}
