import { toolGlyph } from '../art/toolSprites';
import { t } from '../i18n';
import { dragGlyphFor } from '../input/glyphs';
/**
 * Gameplay HUD additions drawn by the operation scene: drain arrow, secondary
 * vitals, tray state (salve meter, brand heat, tincture colour and overdose,
 * disabled tools, assist suggestion), tutorial prompts, Litany practice,
 * dialogue inserts, haze, and the F3 debug overlay. Kept apart from the scene
 * so the gameplay layer can grow without churning the scene's own layout.
 */
import type { Input } from '../core/input';
import type { Vec } from '../core/math';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { FIELD, TINCTURE_HEX, type Operation } from '../surgery/operation';
import { humming } from '../surgery/ailments/organs';
import { LarynxFold } from '../surgery/ailments/organs';
import { VIEW_W } from '../ui/layout';
import { UI } from '../ui/ornaments';
import { band, glass, heading, INK } from '../ui/hudKit';
import { button, type Rect } from '../ui/widgets';
import { TOOL_INFO } from '../surgery/types';
import { glyphFor } from '../input/glyphs';
import type { ActionId } from '../input/actions';

/** Arrow(s) beside the vitals number: ↓ slow, ↓↓ fast. */
export function drawDrainArrow(g: Gfx, op: Operation, x: number, y: number): void {
  const n = op.drainArrow();
  for (let i = 0; i < n; i++) {
    const ax = x + i * 10;
    g.tri(ax - 4, y - 6, ax + 4, y - 6, ax, y + 2, hex('#ff5040', 0.9));
  }
}

/** Blood volume and temperature bars, shown only when the op declares them. */
export function drawSecondaryVitals(g: Gfx, op: Operation, x: number, y: number): void {
  const s = op.def.secondary;
  if (!s) return;
  let cx = x;
  if (s.bloodVolume) {
    g.text(t('hud.blood'), cx, y + 4, { size: 16, color: hex(UI.brass), shadow: false });
    g.rect(cx + 40, y - 4, 70, 6, hex('#000000', 0.7));
    g.rect(cx + 40, y - 4, (70 * op.bloodVolume) / 100, 6, hex('#b01020'));
    cx += 124;
  }
  if (s.temperature) {
    const t = op.temperature;
    g.text(`${t.toFixed(1)}°`, cx, y + 4, { size: 16, color: hex(t < 35.5 ? '#9ec8ff' : t > 38.5 ? '#ff9060' : UI.parch), shadow: false });
  }
}

/** Tray-slot overlays: salve left, brand heat/lock, tincture colour/overdose, disabled tools, suggestions. */
export function drawTrayState(g: Gfx, op: Operation, slot: (i: number) => Rect, input: Input): void {
  const suggest = op.assists.suggest ? op.suggestTool(input.pos) : null;
  const tut = op.tutorial?.tool;
  op.def.tools.forEach((id, i) => {
    const r = slot(i);
    if (id === 'salve') {
      const f = op.salve / op.tuning.salve.capacity;
      g.rect(r.x + r.w - 9, r.y + 6, 4, r.h - 12, hex('#000000', 0.6));
      g.rect(r.x + r.w - 9, r.y + 6 + (r.h - 12) * (1 - f), 4, (r.h - 12) * f, hex('#bff0c8'));
    }
    if (id === 'brand') {
      const heat = op.brandLock > 0 ? 1 : op.brandHeat / op.tuning.brand.overheatAfter;
      if (heat > 0) g.glow(r.x + r.w - 16, r.y + r.h / 2, 16 + heat * 10, hex(op.brandLock > 0 ? '#ffffff' : '#ff7020', 0.25 + heat * 0.4));
    }
    if (id === 'tincture') {
      g.circle(r.x + r.w - 12, r.y + r.h - 12, 6, hex(TINCTURE_HEX[op.tinctureColor], op.overdoseRisk ? 0.35 : 1));
      if (op.overdoseRisk) g.circle(r.x + r.w - 12, r.y + r.h - 12, 6, hex('#000000', 0.5));
    }
    if (!op.toolUsable(id)) {
      g.rect(r.x + 2, r.y + 2, r.w - 4, r.h - 4, hex('#303030', 0.7));
      const left = op.disabled.get(id) ?? op.brandLock;
      g.text(`${Math.ceil(left)}s`, r.x + r.w / 2, r.y + r.h / 2 + 6, { size: 16, color: hex('#e0e0e0'), align: 'center', shadow: false });
    }
    if (id === suggest || id === tut) g.rectLine(r.x, r.y, r.w, r.h, 2, hex(UI.gilt, 0.5 + 0.4 * Math.sin(g.time * 8)));
  });
}

/** Tutorial highlight ring on the target and the prompt beneath the timer. */
export function drawTutorial(g: Gfx, op: Operation): void {
  const s = op.tutorial;
  if (!s) return;
  const p = s.highlight?.(op);
  if (p) {
    const r = 34 + Math.sin(g.time * 5) * 4;
    g.arc(p.x, p.y, r, 3, hex(UI.gilt, 0.8));
    g.glow(p.x, p.y, r * 1.5, hex(UI.gilt, 0.12));
  }
  const tool = s.tool ? t('hud.tutorial.tool', { tool: t(`tool.${s.tool}.name`), key: glyphFor(`tool.select.${TOOL_INFO.findIndex((ti) => ti.id === s.tool) + 1}` as ActionId) }) : '';
  const w = Math.max(g.measure(s.say, 18, 'italic'), g.measure(tool, 16)) + 56;
  const r = { x: 640 - w / 2, y: 520, w, h: tool ? 62 : 44 };
  glass(g, r, { glow: hex(INK.gold, 0.18), glowR: 14 });
  g.text(s.say, 640, r.y + 28, { size: 18, font: 'italic', color: hex(INK.goldHi), align: 'center', shadow: hex('#000000', 0.8), soft: true });
  if (tool) {
    g.text(tool, 640, r.y + 50, { size: 16, color: hex(INK.dim), align: 'center', shadow: false });
    // The instrument's 32 px glyph beside its name (ART-0266).
    if (s.tool) toolGlyph(g, s.tool, 640 - g.measure(tool, 16) / 2 - 22, r.y + 45, 28);
  }
}

/** The Litany practice frame: prompt, attempts, and a skip button. Returns true if skipped. */
export function drawLitanyPractice(g: Gfx, op: Operation, input: Input): boolean {
  const p = op.litanyPractice;
  if (!p) return false;
  g.rect(0, 0, VIEW_W, 720, hex('#000000', 0.45));
  band(g, 196, 170, 1, 0, VIEW_W);
  heading(g, t('hud.practice.title'), VIEW_W / 2, 252, 420, 1, 34);
  g.text(t('hud.practice.help', { draw: dragGlyphFor('litany.draw') }), VIEW_W / 2, 304, { size: 21, color: hex(INK.text), align: 'center', shadow: hex('#000000', 0.8), soft: true });
  g.text(t('hud.practice.attempts', { n: p.attempts }), VIEW_W / 2, 336, { size: 18, font: 'italic', color: hex(INK.dim), align: 'center', shadow: false });
  return button(g, input, t('hud.practice.skip'), VIEW_W / 2, 420, 24);
}

/** A mid-operation dialogue insert (the sim is paused behind it). Returns true when the player advances. */
export function drawDialogue(g: Gfx, op: Operation, input: Input): boolean {
  const line = op.dialogue[0];
  if (!line) return false;
  const r = { x: 240, y: 510, w: 800, h: 80 };
  glass(g, r, { strength: 1.12 });
  g.text(line, r.x + 28, r.y + 40, { size: 21, color: hex(INK.text), shadow: hex('#000000', 0.8), soft: true });
  g.text(t('hud.dialogue.continue'), r.x + r.w - 24, r.y + r.h - 14, { size: 16, font: 'italic', color: hex(INK.dim), align: 'right', shadow: false });
  return input.pressed || input.actPressed('litany.key') || input.actPressed('ui.confirm');
}

/** Gas haze and the larynx waveform (a visual twin for the hummed verses). */
export function drawFieldOverlays(g: Gfx, op: Operation): void {
  if (op.hazeT > 0) {
    const a = Math.min(0.55, op.hazeT / 4);
    g.ellipse(FIELD.cx, FIELD.cy, FIELD.rx * 1.1, FIELD.ry * 1.1, 0, hex('#c8d890', a), hex('#c8d890', a * 0.6));
  }
  if (op.entities.some((e) => e.alive && e instanceof LarynxFold)) {
    const hum = humming(op);
    const pts: Vec[] = [];
    for (let i = 0; i <= 40; i++) pts.push({ x: VIEW_W / 2 - 100 + i * 5, y: 110 + (hum ? Math.sin(i * 0.9 + g.time * 12) * 7 : 0) });
    g.polyline(pts, 2, hex(hum ? '#e0c0ff' : '#9fd3a8'));
    g.text(hum ? t('hud.fold.humming') : t('hud.fold.silence'), VIEW_W / 2 + 110, 115, { size: 16, color: hex(hum ? '#e0c0ff' : '#9fd3a8') });
  }
}

/** F3 debug overlay: hit areas, per-entity drain, vitals delta, timers, combo. */
export function drawDebug(g: Gfx, op: Operation): void {
  let y = 140;
  const line = (s: string) => {
    g.text(s, VIEW_W - 20, y, { size: 13, color: hex('#b0ffb0'), align: 'right' });
    y += 16;
  };
  line(`vitals ${op.vitals.toFixed(1)}  Δ/s ${(-op.drainRate).toFixed(2)}  cap ${op.vitalsCap}`);
  line(`combo ${op.combo}  phase ${op.phase}/${op.phaseCount}  t ${op.elapsed.toFixed(1)}`);
  line(`litany ${op.litanyTime.toFixed(1)}  brand ${op.brandHeat.toFixed(1)}/${op.brandLock.toFixed(1)}  salve ${op.salve.toFixed(0)}`);
  for (const e of op.entities) {
    if (!e.alive) continue;
    g.arc(e.pos.x, e.pos.y, 28, 1, hex(e.hidden ? '#8080ff' : e.required ? '#ff8080' : '#80ff80', 0.7));
    g.text(`${e.constructor.name} ${e.drain(op).toFixed(2)}`, e.pos.x, e.pos.y - 32, { size: 11, color: hex('#b0ffb0'), align: 'center' });
  }
}
