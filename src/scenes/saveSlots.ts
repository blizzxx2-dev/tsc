/**
 * Save slots (UIX-0092/0097): three cards — chapter, next step, play time, seals, last played and
 * the field thumbnail when one was stored. Opened from New Game, a slot is where the new campaign
 * is kept (an occupied one asks before it is overwritten); an occupied card also resumes, and can
 * be burnt after a double confirmation — except the slot the current session was started from.
 */
import type { Game, Scene } from '../core/scene';
import { t } from '../i18n';
import { fresh, listSlots, loadFromSlot, saveStore, saveToSlot, store, type SlotData } from '../core/save';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { VIEW_W } from '../ui/layout';
import { Ui, type Rect } from '../ui/kit';
import { drawTooltip, focusRing, menuEntry, sealButton } from '../ui/controls';
import { caps, glass, heading, INK, rule, well } from '../ui/hudKit';
import { MOTION, tween } from '../ui/motion';
import { fitText } from '../ui/text';
import { uiEvents } from '../ui/events';
import { reticle } from '../ui/widgets';
import { drawBackdrop } from './backdrop';
import { confirm } from './confirm';
import { playStep, save } from './flow';
import { chapterLabel, formatDate, formatPlaytime, sealCount, stepLabel } from './campaignState';
import { TitleScene } from './title';
import { progress, saveProgress } from '../surgery/session';

export type ManualSlot = 1 | 2 | 3;
export const MANUAL_SLOTS: readonly ManualSlot[] = [1, 2, 3];

/** The slot the running session was begun or resumed from; it cannot be burnt mid-session. */
let activeSlot: ManualSlot | null = null;
export const currentSlot = (): ManualSlot | null => activeSlot;
export function setCurrentSlot(slot: ManualSlot | null): void {
  activeSlot = slot;
}

const CARD = { y: 128, w: 320, h: 470, gap: 24 };
const BURN_S = 0.9;

export function slotCardRect(i: number): Rect {
  const total = 3 * CARD.w + 2 * CARD.gap;
  return { x: Math.round((VIEW_W - total) / 2) + i * (CARD.w + CARD.gap), y: CARD.y, w: CARD.w, h: CARD.h };
}

export class SaveSlotsScene implements Scene {
  /** A menu page: moving between two plays the page-turn transition (ART-0306). */
  readonly menuPage = true;
  readonly ui = new Ui('slots');
  private t = 0;
  private slots = listSlots();
  /** Slot being burnt → seconds into the animation. */
  private burning = new Map<ManualSlot, number>();

  constructor(
    private mode: 'new' | 'load' = 'new',
    /** Choices made before the slot picker that the fresh profile must keep (GAM-0208). */
    private opts: { tutorialSkip?: boolean } = {},
  ) {}

  private data(slot: ManualSlot): SlotData | null {
    return this.slots.find((s) => s.slot === slot)?.data ?? null;
  }

  private refresh(): void {
    this.slots = listSlots();
  }

  private layout(game: Game): void {
    const ui = this.ui;
    ui.begin();
    MANUAL_SLOTS.forEach((slot, i) => {
      const r = slotCardRect(i);
      const d = this.data(slot);
      const burning = this.burning.has(slot);
      const primary = this.mode === 'new' ? t('ui.slots.begin_here') : d ? t('ui.slots.resume') : t('ui.slots.begin_here');
      ui.button(`slot${slot}`, { x: r.x + 24, y: r.y + r.h - 110, w: r.w - 48, h: 44 }, primary, () => (this.mode === 'load' && d ? this.resumeSlot(game, slot) : this.begin(game, slot, d)), { style: 'seal', enabled: !burning });
      if (d && this.mode === 'new') ui.button(`resume${slot}`, { x: r.x + 24, y: r.y + r.h - 58, w: (r.w - 48) / 2 - 4, h: 38 }, t('ui.slots.resume'), () => this.resumeSlot(game, slot), { enabled: !burning });
      if (d) {
        const locked = activeSlot === slot;
        ui.button(`delete${slot}`, { x: r.x + r.w / 2 + 4, y: r.y + r.h - 58, w: (r.w - 48) / 2 - 4, h: 38 }, t('ui.slots.delete'), () => this.askDelete(game, slot), {
          enabled: !burning && !locked,
          tip: locked ? t('ui.slots.delete_locked') : t('ui.slots.delete_note'),
        });
      }
    });
    ui.button('back', { x: VIEW_W / 2 - 120, y: 628, w: 240, h: 46 }, t('ui.common.back'), () => game.go(new TitleScene()));
    if (!ui.focus) ui.focusFirst('slot1');
  }

  /** New Game into a slot: an occupied slot asks first (UIX-0092). */
  private begin(game: Game, slot: ManualSlot, existing: SlotData | null): void {
    const start = () => {
      Object.assign(save, { ...fresh(), best: save.best, stats: save.stats });
      if (this.opts.tutorialSkip) {
        progress.tutorialSkip = true;
        saveProgress();
      }
      store(save);
      void saveToSlot(save, slot);
      activeSlot = slot;
      playStep(game, 0, 0);
    };
    if (existing) confirm(game, { title: t('ui.slots.overwrite_title'), message: t('ui.slots.overwrite', { chapter: chapterLabel(existing.progress) }), onYes: start, danger: true });
    else start();
  }

  private resumeSlot(game: Game, slot: ManualSlot): void {
    const pos = loadFromSlot(save, slot);
    if (!pos) return;
    activeSlot = slot;
    playStep(game, pos.chapter, pos.step);
  }

  /** Delete needs two confirmations, then the page burns (UIX-0097). */
  private askDelete(game: Game, slot: ManualSlot): void {
    if (activeSlot === slot) return;
    const d = this.data(slot);
    if (!d) return;
    confirm(game, {
      title: t('ui.slots.delete_title'),
      message: t('ui.slots.delete_confirm', { chapter: chapterLabel(d.progress) }),
      danger: true,
      onYes: () => confirm(game, { title: t('ui.slots.delete_title'), message: t('ui.slots.delete_confirm_again'), yes: t('ui.slots.delete_yes'), danger: true, onYes: () => this.burning.set(slot, 0) }),
    });
  }

  update(dt: number, game: Game): void {
    this.t += dt;
    for (const [slot, s] of [...this.burning]) {
      const next = s + dt;
      if (next >= BURN_S) {
        this.burning.delete(slot);
        void saveStore.deleteSlot(slot).then(() => this.refresh());
        this.refresh();
        uiEvents.emit('ui.confirm', { id: `slots/burnt${slot}` });
      } else this.burning.set(slot, next);
    }
    this.layout(game);
    this.ui.update(game.input, dt);
    if (game.input.actPressed('ui.back')) {
      uiEvents.emit('ui.back', { id: 'slots' });
      game.go(new TitleScene());
    }
  }

  render(g: Gfx, game: Game): void {
    g.beginWorld();
    drawBackdrop(g, 'chapel', g.time);
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 1, defocus: 8 });
    const vr = g.viewRect();
    g.rect(vr.x, vr.y, vr.w, vr.h, hex('#050303', 0.45));
    const k = tween(this.t, MOTION.panel);
    heading(g, t(this.mode === 'new' ? 'ui.slots.title_new' : 'ui.slots.title_load'), VIEW_W / 2, 70, 420, k, 30);
    MANUAL_SLOTS.forEach((slot, i) => this.card(g, slot, i, k));
    for (const n of this.ui.nodes) {
      const s = this.ui.state(n.id);
      if (n.style === 'seal') sealButton(g, n, s, g.time, 22);
      else menuEntry(g, n, s, g.time, n.id === 'back' ? 26 : 22);
    }
    drawTooltip(g, this.ui);
    reticle(g, game.input.pos);
    g.endFrame();
  }

  private card(g: Gfx, slot: ManualSlot, i: number, a: number): void {
    const r = slotCardRect(i);
    const d = this.data(slot);
    const burn = this.burning.get(slot);
    // Burning: the card chars from the edges, curls up and fades to ash.
    const bk = burn === undefined ? 0 : Math.min(1, burn / BURN_S);
    const alpha = a * (1 - bk);
    g.save();
    if (bk > 0) {
      g.translate(r.x + r.w / 2, r.y + r.h / 2);
      g.scale(1 - bk * 0.15, 1 - bk * 0.25);
      g.rotate(bk * 0.06);
      g.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
    }
    const focused = ['slot', 'resume', 'delete'].some((p) => this.ui.state(`${p}${slot}`).glow > 0.5);
    glass(g, r, { alpha, strength: d ? 1.1 : 0.85 });
    if (bk > 0) {
      g.rectLine(r.x + 2, r.y + 2, r.w - 4, r.h - 4, 6 + bk * 40, hex('#1a0a04', 0.9 * bk));
      g.glow(r.x + r.w / 2, r.y + r.h / 2, r.w * 0.8, hex('#ff7a20', 0.35 * Math.sin(bk * Math.PI)));
    }
    caps(g, t('ui.slots.slot', { n: slot }), r.x + r.w / 2, r.y + 34, 13, hex(focused ? INK.goldHi : INK.gold, alpha), 'center');
    rule(g, r.x + r.w / 2, r.y + 44, r.w - 60, hex(INK.gilt, 0.7 * alpha));
    // Thumbnail window.
    const tw = { x: r.x + 24, y: r.y + 58, w: r.w - 48, h: 152 };
    well(g, tw, alpha);
    if (d?.meta.thumbnail) {
      g.drawImage(g.image(d.meta.thumbnail), tw.x + 1, tw.y + 1, tw.w - 2, tw.h - 2, { alpha, sepia: 0.35, vignette: 0.5 });
    } else {
      g.text(t(d ? 'ui.slots.no_thumbnail' : 'ui.slots.empty'), tw.x + tw.w / 2, tw.y + tw.h / 2 + 6, { size: 17, font: 'italic', color: hex(INK.faint, alpha), align: 'center', shadow: false });
    }
    if (d) {
      fitText(g, `slots.${slot}.chapter`, chapterLabel(d.progress), r.x + 24, r.y + 244, r.w - 48, { size: 20, color: hex(INK.text, alpha), shadow: hex('#000000', 0.8 * alpha) });
      fitText(g, `slots.${slot}.step`, stepLabel(d.progress), r.x + 24, r.y + 268, r.w - 48, { size: 17, font: 'italic', color: hex(INK.dim, alpha), shadow: false });
      const rows: [string, string][] = [
        [t('ui.slots.playtime'), formatPlaytime(d.meta.playtime)],
        [t('ui.slots.seals'), t('ui.slots.seal_count', { n: sealCount(d.progress) })],
        [t('ui.slots.last_played'), formatDate(d.meta.savedAt) || t('ui.slots.never')],
      ];
      rows.forEach(([label, value], j) => {
        const y = r.y + 302 + j * 24;
        caps(g, label, r.x + 24, y, 12, hex(INK.dim, alpha));
        fitText(g, `slots.${slot}.row${j}`, value, r.x + r.w - 24, y, 160, { size: 16, color: hex(INK.text, alpha), align: 'right', shadow: false });
        g.rect(r.x + 24, y + 8, r.w - 48, 1, hex(INK.gilt, 0.14 * alpha));
      });
    } else {
      fitText(g, `slots.${slot}.empty`, t('ui.slots.empty_note'), r.x + r.w / 2, r.y + 300, r.w - 48, { size: 17, font: 'italic', color: hex(INK.dim, alpha), align: 'center', shadow: false });
    }
    if (activeSlot === slot) caps(g, t('ui.slots.in_use'), r.x + r.w / 2, r.y + r.h - 122, 12, hex(INK.verdigris, alpha), 'center');
    if (focused && bk === 0) focusRing(g, r, 0.5, g.time);
    g.restore();
  }
}
