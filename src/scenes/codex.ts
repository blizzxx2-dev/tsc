/**
 * The Hours codex: an entry for each Malison met so far (unlocked on first encounter,
 * `progress.codex` ids `hour.<boss>`), read from the i18n tables `codex.<boss>.title|body`.
 * Locked Hours show as sealed pages. Reached from the Operating Theatre.
 */
import { hourRecord } from '../surgery/hourRecords';
import { formatSplit } from '../surgery/timeAttack';
import type { Game, Scene } from '../core/scene';
import { t } from '../i18n';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { CODEX_BOSSES, type CodexBoss } from '../surgery/bosses/codex';
import { loadProgress } from '../surgery/progress';
import { caps, glass, heading, INK } from '../ui/hudKit';
import { VIEW_W } from '../ui/layout';
import { wrapLines } from '../ui/text';
import { button, inRect, reticle } from '../ui/widgets';
import { drawBackdrop } from './backdrop';

/** The progress id that unlocks a boss's codex page. */
export const codexId = (boss: string): string => `hour.${boss}`;

const title = (b: CodexBoss): string => t(`codex.${b}.title`);
const body = (b: CodexBoss): string => t(`codex.${b}.body`);

export class CodexScene implements Scene {
  /** A menu page: moving between two plays the page-turn transition (ART-0306). */
  readonly menuPage = true;
  private sel = 0;
  private readonly open: ReadonlySet<string>;

  constructor(private back: () => void) {
    this.open = new Set(loadProgress().codex);
    const first = CODEX_BOSSES.findIndex((b) => this.open.has(codexId(b)));
    this.sel = Math.max(0, first);
  }

  update(_dt: number, game: Game): void {
    const k = game.input;
    if (k.actPressed('ui.back')) return this.back();
    if (k.actPressed('ui.down')) this.sel = (this.sel + 1) % CODEX_BOSSES.length;
    if (k.actPressed('ui.up')) this.sel = (this.sel + CODEX_BOSSES.length - 1) % CODEX_BOSSES.length;
  }

  render(g: Gfx, game: Game): void {
    g.beginWorld();
    drawBackdrop(g, 'chapel', g.time);
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 'menu', defocus: 10 });
    const L = { x: 140, y: 60, w: 330, h: 580 };
    const R = { x: 500, y: 60, w: 640, h: 580 };
    glass(g, L, { strength: 1.1 });
    glass(g, R, { strength: 1.1 });
    heading(g, t('ui.codex.title'), L.x + L.w / 2, L.y + 58, L.w - 60);
    CODEX_BOSSES.forEach((b, i) => {
      const r = { x: L.x + 24, y: L.y + 96 + i * 52, w: L.w - 48, h: 44 };
      const known = this.open.has(codexId(b));
      if (inRect(game.input.pos, r) && game.input.pressed) this.sel = i;
      const on = i === this.sel;
      if (on) g.rect(r.x, r.y, r.w, r.h, hex(INK.gold, 0.12));
      caps(g, known ? title(b).split(' — ')[0] : t('ui.codex.sealed'), r.x + 16, r.y + 28, 14, hex(known ? (on ? INK.goldHi : INK.text) : INK.dim));
    });
    const b = CODEX_BOSSES[this.sel];
    if (this.open.has(codexId(b))) {
      heading(g, title(b), R.x + R.w / 2, R.y + 58, R.w - 80);
      const lines = wrapLines((s) => g.measure(s, 20, 'body'), body(b), R.w - 90);
      lines.forEach((l, i) => g.text(l, R.x + 45, R.y + 130 + i * 30, { size: 20, color: hex(INK.text), shadow: false }));
      // The fastest replay-verified clear of this Hour (BOS-0176).
      const rec = hourRecord(b);
      caps(g, t('ui.codex.fastest'), R.x + 45, R.y + R.h - 44, 12, hex(INK.gold));
      g.text(rec ? t('ui.codex.fastest_value', { time: formatSplit(rec.time), rank: rec.rank }) : t('ui.codex.fastest_none'), R.x + 200, R.y + R.h - 40, { size: 18, font: rec ? 'body' : 'italic', color: hex(rec ? INK.text : INK.dim), shadow: false });
    } else g.text(t('ui.codex.locked'), R.x + R.w / 2, R.y + 280, { size: 20, font: 'italic', color: hex(INK.dim), align: 'center', shadow: false });
    if (button(g, game.input, t('ui.common.back'), VIEW_W / 2, 676, 24)) this.back();
    reticle(g, game.input.pos);
    g.endFrame();
  }
}
