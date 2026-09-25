import { t } from '../../i18n';
import { hex } from '../../render/color';
import type { Gfx } from '../../render/gfx';
import type { Vec } from '../../core/math';
import type { Operation } from '../operation';
import type { ToolId } from '../types';
import { activeBoss, bossesOf, type MalisonBase } from './base';
import { currentLag } from './common';
import { SextMalison } from './sext';
import { assistsOf } from './signals';

/**
 * The boss HP bar (BOS-0002): the Hour's name in Fraktur over a bar notched at
 * each phase threshold. Phases not yet reached stay veiled — their segments
 * dark and unnotched — until the fight unlocks them. Elites (BOS-0151) get the
 * compact form: a thin bar and an italic name.
 */
export const BOSS_BAR = { cx: 640, y: 112, w: 420, h: 10 };
export const ELITE_BAR = { cx: 640, y: 110, w: 240, h: 6 };

/** Bar geometry for a boss (exported for layout tests). */
export function bossBarRect(b: MalisonBase): { x: number; y: number; w: number; h: number } {
  const r = b.elite ? ELITE_BAR : BOSS_BAR;
  return { x: r.cx - r.w / 2, y: r.y, w: r.w, h: r.h };
}

/** The fraction of the bar still veiled (phases not yet reached): everything below the current phase. */
export function veiledBelow(b: MalisonBase): number {
  const next = b.phases[b.phaseIx + 1];
  return next ? next.from : 0;
}

export function drawBossHud(g: Gfx, op: Operation): void {
  hudFlag(op, 'litany-stolen'); // subscribe early
  const b = activeBoss(op) ?? bossesOf(op).find((x) => x.alive) ?? null;
  if (!b) return;
  const r = bossBarRect(b);
  const f = b.frac;
  const name = t(`boss.${b.bossId}.name`);
  if (b.elite) g.text(name, r.x + r.w / 2, r.y - 4, { size: 15, font: 'italic', color: hex('#e8d8c0', 0.9), align: 'center' });
  else {
    g.text(name, r.x + r.w / 2, r.y - 6, { size: 24, font: 'display', color: hex('#e8d0ff'), color2: hex('#7a4aa8'), align: 'center', shadow: hex('#000000', 0.8) });
    const phase = t(`boss.${b.bossId}.phase.${b.phase.key}`);
    g.text(phase, r.x + r.w, r.y - 6, { size: 13, font: 'italic', color: hex('#c8b8a0', 0.85), align: 'right', shadow: false });
  }
  g.rect(r.x - 2, r.y - 2, r.w + 4, r.h + 4, hex('#000000', 0.65));
  g.rectGrad(r.x, r.y, r.w * f, r.h, hex(b.hurtFlash > 0.5 ? '#ffd0a0' : '#b478ff'), hex('#4a1a6a'));
  // Veiled phases: dark, unnotched, until reached.
  const veil = veiledBelow(b);
  if (veil > 0) g.rect(r.x, r.y, r.w * Math.min(veil, f), r.h, hex('#140a1c', 0.85));
  if (!b.elite) {
    for (let i = 1; i <= b.phaseIx + 1 && i < b.phases.length; i++) {
      const x = r.x + r.w * b.phases[i].from;
      g.rect(x - 1, r.y - 4, 2, r.h + 8, hex('#f0e0c0', i <= b.phaseIx ? 0.5 : 0.9));
    }
  }
  g.rectLine(r.x - 2, r.y - 2, r.w + 4, r.h + 4, 1, hex('#c8a050', 0.7));
}

const hudFlags = new WeakMap<Operation, Set<string>>();

/** HUD flags the bosses raise (`litany-stolen`, `lens-blind`, `silence`, `dawn-glow`…). */
export function hudFlag(op: Operation, flag: string): boolean {
  let s = hudFlags.get(op);
  if (!s) {
    const set = new Set<string>();
    s = set;
    hudFlags.set(op, set);
    op.events.on('boss', (e) => {
      if (e.kind === 'hud') {
        if (e.on) set.add(e.flag);
        else set.delete(e.flag);
      }
    });
  }
  return s.has(flag);
}

/** The Litany medallion's star, cracked and blackened while Compline holds it (BOS-0126). */
export function drawLitanyTheft(g: Gfx, op: Operation, x: number, y: number): void {
  if (!hudFlag(op, 'litany-stolen')) return;
  g.circle(x, y + 1, 21, hex('#050505', 0.85));
  const c = hex('#6a6a70', 0.9);
  g.polyline([{ x: x - 4, y: y - 20 }, { x: x + 2, y: y - 6 }, { x: x - 3, y: y + 4 }, { x: x + 6, y: y + 20 }], 2, c);
  g.polyline([{ x: x + 2, y: y - 6 }, { x: x + 14, y: y - 2 }], 1.5, c);
  g.polyline([{ x: x - 3, y: y + 4 }, { x: x - 15, y: y + 9 }], 1.5, c);
}

/** Sext's False Noon: the monitor trace should run flat-smooth, too regular (BOS-0083). */
export function ecgCalm(op: Operation): boolean {
  return op.entities.some((e) => e instanceof SextMalison && e.alive && e.falseShown);
}

/** The too-regular trace shown under False Noon: a smooth, even swell. */
export const calmWave = (ph: number): number => 0.32 * Math.sin(ph * Math.PI * 2) ** 2;

const trails = new WeakMap<Operation, Vec[]>();

/**
 * The torpor tell (BOS-0082): the cursor drags a trail that lengthens with
 * the lag, the screen edges bleach toward grey, and (with the assist) a
 * numeric readout of the lag in milliseconds.
 */
export function drawTorpor(g: Gfx, op: Operation, cursor: Vec, view: { x: number; y: number; w: number; h: number }): void {
  const lag = currentLag(op);
  let trail = trails.get(op);
  if (!trail) trails.set(op, (trail = []));
  trail.push({ ...cursor });
  const keep = Math.round(lag * 60);
  while (trail.length > Math.max(1, keep)) trail.shift();
  if (lag <= 0.01) return;
  const k = Math.min(1, lag / 0.4);
  for (let i = 1; i < trail.length; i++) g.line(trail[i - 1], trail[i], 3, hex('#b0c8ff', (0.5 * i) / trail.length));
  const e = 70 * k + 20;
  g.rectGrad(view.x, view.y, view.w, e, hex('#a8a8a8', 0.35 * k), hex('#a8a8a8', 0));
  g.rectGrad(view.x, view.y + view.h - e, view.w, e, hex('#a8a8a8', 0), hex('#a8a8a8', 0.35 * k));
  if (assistsOf(op).lagReadout) g.text(t('hud.boss.lag', { ms: Math.round(lag * 1000) }), cursor.x + 26, cursor.y + 30, { size: 16, color: hex('#b0c8ff'), shadow: hex('#000000', 0.8) });
}

/** Is this instrument blinded by a boss right now (greyed in the tray)? */
export function toolBlinded(op: Operation, tool: ToolId): boolean {
  return bossesOf(op).some((b) => b.alive && b.blinds(tool));
}
