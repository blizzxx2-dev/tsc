import { settings } from '../core/settings';
import type { Game, Scene } from '../core/scene';
import { t } from '../i18n';
import { lastLoad, listSlots, loadFromSlot, store, type SlotData, type SlotId } from '../core/save';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { VIEW_H, VIEW_W } from '../ui/layout';
import { reticle } from '../ui/widgets';
import { Ui, type UiNode } from '../ui/kit';
import { drawTooltip, focusRing, menuEntry, sealButton } from '../ui/controls';
import { caps, diamond, glass, heading, hglow, INK, prose, rule } from '../ui/hudKit';
import { waxSeal } from '../ui/ornaments';
import { MOTION, tween } from '../ui/motion';
import { fitText, wrapLines } from '../ui/text';
import { uiEvents } from '../ui/events';
import { drawBackdrop } from './backdrop';
import { playStep, save } from './flow';
import { OperationsScene } from './operations';
import { OptionsScene } from './options';
import { ChapterSelectScene } from './chapterSelect';
import { SaveSlotsScene } from './saveSlots';
import { CreditsScene } from './credits';
import { ExtrasScene } from './extras';
import { confirm } from './confirm';
import { campaignComplete, campaignStarted, chapterLabel, formatDate, formatPlaytime, stepLabel } from './campaignState';
import { platform } from '../platform';
import { buildLabel, IS_DEMO } from '../platform/build';
import { EDITIONS } from '../platform/editions';
import { flag } from '../platform/flags';
import { pickEpigraph } from '../content/epigraphs';
import { hasOperated } from '../surgery/progress';
import { progress } from '../surgery/session';

/** One epigraph per boot (NAR-0069); cosmetic, so Math.random. */
const EPIGRAPH = pickEpigraph();

/** The damaged-records dialog is offered once per launch. */
let damagedOffered = false;

/** Menu geometry: one centred column under the lockup. */
const MENU = { x: VIEW_W / 2 - 210, w: 420, h: 42, gap: 4, y0: 352 };

/**
 * Title v2 (UIX-0079): the lockup over the key-art backdrop and one column of menu entries —
 * Continue, New Game, Chapter Select, Operating Theatre, Extras, Options, Credits and (desktop)
 * Quit. Continue shows a preview card of the saved position (UIX-0082); the demo edition wears a
 * ribbon and a wishlist seal; after the demo is finished a banner says so and Chapter Select takes
 * Continue's place (UIX-0173). A damaged journal opens the recovery dialog (UIX-0094).
 */
export class TitleScene implements Scene {
  readonly ui = new Ui('title');
  private t = 0;

  update(dt: number, game: Game): void {
    this.t += dt;
    if (!damagedOffered && lastLoad?.outcome === 'unrecoverable' && game.push) {
      damagedOffered = true;
      game.push(new DamagedRecordsScene());
    }
    this.layout(game);
    this.ui.update(game.input, dt);
  }

  private layout(game: Game): void {
    const ui = this.ui;
    ui.begin();
    const started = campaignStarted();
    const done = campaignComplete();
    const p = save.progress;
    let y = MENU.y0;
    const add = (id: string, label: string, fn: () => void, o: Partial<UiNode> = {}) => {
      ui.button(id, { x: MENU.x, y, w: MENU.w, h: MENU.h }, label, fn, o);
      y += MENU.h + MENU.gap;
    };
    if (started && !done) add('continue', t('ui.title.continue'), () => playStep(game, p.chapter, p.step));
    add('new', started ? t('ui.title.new_game_again') : t('ui.title.new_game'), () => this.newGame(game));
    add('chapters', t('ui.title.chapters'), () => game.go(new ChapterSelectScene()), { enabled: started || done });
    add('theatre', t('ui.title.theatre'), () => game.go(new OperationsScene()), { enabled: started });
    add('extras', t('ui.title.extras'), () => game.go(new ExtrasScene()));
    add('options', t('ui.title.options'), () => game.go(new OptionsScene(() => game.go(new TitleScene()))));
    add('credits', t('ui.title.credits'), () => game.go(new CreditsScene()));
    if (platform.kind === 'desktop' && !platform.args.kiosk) add('quit', t('ui.title.quit'), () => confirm(game, { message: t('ui.pause.confirm_quit'), onYes: () => platform.quit(), danger: true }));
    if (IS_DEMO && flag('wishlistPrompts') && !platform.steam.ownsFullGame) {
      ui.button('wishlist', { x: VIEW_W - 250, y: 470, w: 200, h: 120 }, t('ui.title.wishlist'), () => platform.steam.openStore(EDITIONS.full.steamAppId), { style: 'wax', tip: t('ui.title.wishlist_note') });
    }
    if (!ui.focus) ui.focusFirst(started && !done ? 'continue' : done ? 'chapters' : 'new');
  }

  /**
   * New Game asks first-timers whether they have operated before (GAM-0208): "yes" starts the
   * campaign with the guided tutorials off. A profile that has already operated is not asked.
   */
  private newGame(game: Game): void {
    if (hasOperated(progress)) return game.go(new SaveSlotsScene('new'));
    confirm(game, {
      title: t('ui.title.operated_title'),
      message: t('ui.title.operated'),
      yes: t('ui.title.operated_yes'),
      no: t('ui.title.operated_no'),
      onYes: () => game.go(new SaveSlotsScene('new', { tutorialSkip: true })),
      onNo: () => game.go(new SaveSlotsScene('new')),
    });
  }

  render(g: Gfx, game: Game): void {
    g.beginWorld();
    drawBackdrop(g, 'title', g.time, { pointer: settings.reduceMotion ? undefined : game.input.pos });
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 'title', defocus: 7 });
    const a = Math.min(1, this.t);
    const vr = g.viewRect();
    // Grade the backdrop down so the type carries the screen: a heavy vignette and a dark
    // column behind the menu.
    g.rect(vr.x, vr.y, vr.w, vr.h, hex('#050303', 0.42));
    g.rectGrad(vr.x, vr.y, vr.w, 260, hex('#000000', 0.55), hex('#000000', 0));
    g.rectGrad(vr.x, vr.y + vr.h - 260, vr.w, 260, hex('#000000', 0), hex('#000000', 0.75));
    g.circleGrad(VIEW_W / 2, 500, 380, hex('#000000', 0.6 * a), hex('#000000', 0));
    this.lockup(g, a);

    const done = campaignComplete();
    if (done) this.completeBanner(g, a);
    for (const n of this.ui.nodes) {
      const s = this.ui.state(n.id);
      if (n.style === 'wax') this.wishlistSeal(g, n, s.glow, s.active);
      else menuEntry(g, n, s, g.time, 26);
    }
    if (IS_DEMO) this.ribbon(g, a);
    if (IS_DEMO && flag('wishlistPrompts') && platform.steam.ownsFullGame) g.text(t('ui.title.owns_full'), VIEW_W - 150, 540, { size: 18, font: 'italic', color: hex(INK.dim), align: 'center' });
    // Continue preview (UIX-0082): the saved position beside the menu while Continue is lit.
    const cont = this.ui.node('continue');
    const k = this.ui.state('continue').glow;
    if (cont && k > 0.01) this.previewCard(g, cont, k);
    g.text(t('ui.title.fullscreen_hint'), 24, VIEW_H - 18, { size: 16, color: hex(INK.faint), shadow: false });
    g.text(buildLabel(), VIEW_W - 24, VIEW_H - 18, { size: 16, color: hex(INK.faint), align: 'right', shadow: false });
    drawTooltip(g, this.ui);
    reticle(g, game.input.pos);
    g.endFrame();
  }

  /** The title: engraved Roman capitals in gold leaf, a warm bloom behind, the subtitle between rules. */
  private lockup(g: Gfx, a: number): void {
    g.glow(VIEW_W / 2, 176, 460, hex('#7a3a10', 0.22 * a));
    const title = t('ui.game.title').toUpperCase();
    g.text(title, VIEW_W / 2, 196, { size: 84, font: 'display', color: hex('#fff4d0', a), color2: hex('#c8923c', a), align: 'center', tracking: 0.09, shadow: hex('#000000', 0.9 * a), soft: true });
    const sub = t('ui.game.subtitle').toUpperCase();
    const sw = g.measure(sub, 15, 'display', 0.45);
    g.text(sub, VIEW_W / 2, 246, { size: 15, font: 'display', color: hex(INK.gold, 0.95 * a), align: 'center', tracking: 0.45, shadow: hex('#000000', 0.9 * a), soft: true });
    rule(g, VIEW_W / 2 - sw / 2 - 110, 240, 180, hex(INK.gilt, 0.8 * a));
    rule(g, VIEW_W / 2 + sw / 2 + 110, 240, 180, hex(INK.gilt, 0.8 * a));
    diamond(g, VIEW_W / 2 - sw / 2 - 18, 240.5, 3, hex(INK.gold, a));
    diamond(g, VIEW_W / 2 + sw / 2 + 18, 240.5, 3, hex(INK.gold, a));
    // One epigraph per boot beneath the lockup (NAR-0069).
    g.text(`“${EPIGRAPH.text}”`, VIEW_W / 2, 286, { size: 18, font: 'italic', color: hex(INK.dim, 0.9 * a), align: 'center', shadow: hex('#000000', 0.8 * a), soft: true });
  }

  /** "Demo complete" band between the lockup and the menu (UIX-0173). */
  private completeBanner(g: Gfx, a: number): void {
    const y = 288;
    hglow(g, { x: VIEW_W / 2 - 360, y: y - 22, w: 720, h: 44 }, hex('#3a1a0a', 0.8 * a));
    rule(g, VIEW_W / 2, y - 22, 640, hex(INK.gilt, 0.8 * a));
    rule(g, VIEW_W / 2, y + 21, 640, hex(INK.gilt, 0.8 * a));
    caps(g, t('ui.title.demo_complete_banner'), VIEW_W / 2, y - 2, 15, hex(INK.goldHi, a), 'center');
    g.text(t('ui.title.demo_complete'), VIEW_W / 2, y + 16, { size: 16, font: 'italic', color: hex(INK.dim, a), align: 'center', shadow: hex('#000000', 0.8 * a) });
  }

  /** Diagonal "DEMO" ribbon across the top-left corner (demo edition only). */
  private ribbon(g: Gfx, a: number): void {
    const vr = g.viewRect();
    g.save();
    g.translate(vr.x + 74, vr.y + 74);
    g.rotate(-Math.PI / 4);
    g.rect(-160, -16, 320, 32, hex('#000000', 0.5 * a));
    g.rectGrad(-160, -18, 320, 32, hex('#8a1016', 0.96 * a), hex('#4a0608', 0.96 * a));
    g.rect(-160, -18, 320, 1, hex('#ffb0a0', 0.35 * a));
    g.rect(-160, 13, 320, 1, hex('#000000', 0.5 * a));
    g.text(t('ui.title.demo_ribbon').toUpperCase(), 0, 4, { size: 15, font: 'display', color: hex('#ffe8c0', a), align: 'center', tracking: 0.4, shadow: hex('#2a0204', 0.8 * a) });
    g.restore();
  }

  /** The wishlist call-to-action as a wax seal with a caption (UIX-0174). */
  private wishlistSeal(g: Gfx, n: UiNode, k: number, pressed: boolean): void {
    const cx = n.rect.x + n.rect.w / 2;
    const cy = n.rect.y + 44;
    const r = 34 + 2 * k - (pressed ? 2 : 0);
    if (k > 0) g.glow(cx, cy, r * 2.2, hex(INK.gold, 0.22 * k));
    waxSeal(g, cx, cy, r, '#8a1016');
    g.text('W', cx, cy + 13, { size: 34, font: 'display', color: hex('#ffe8c0', 0.95), color2: hex('#f0b070', 0.95), align: 'center', shadow: hex('#2a0204', 0.8) });
    const col = k > 0.5 ? INK.goldHi : '#e8dcc4';
    fitText(g, 'title.wishlist', n.label.toUpperCase(), cx, n.rect.y + 106, n.rect.w, { size: 13, font: 'display', color: hex(col), align: 'center', tracking: 0.14, shadow: hex('#000000', 0.85) });
    if (k > 0.01) focusRing(g, n.rect, k, g.time);
  }

  /** Continue preview: chapter, next step, play time and last-played date (UIX-0082). */
  private previewCard(g: Gfx, anchor: UiNode, k: number): void {
    const auto = listSlots().find((s) => s.slot === 'auto')?.data;
    const r = { x: anchor.rect.x + anchor.rect.w + 26, y: anchor.rect.y - 26, w: 300, h: 176 };
    g.save();
    g.translate((1 - k) * 12, 0);
    glass(g, r, { alpha: k, strength: 1.1 });
    caps(g, t('ui.title.continue'), r.x + 20, r.y + 30, 12, hex(INK.gold, k));
    rule(g, r.x + r.w / 2, r.y + 40, r.w - 40, hex(INK.gilt, 0.6 * k));
    fitText(g, 'title.preview.chapter', chapterLabel(save.progress), r.x + 20, r.y + 68, r.w - 40, { size: 20, color: hex(INK.text, k), shadow: hex('#000000', 0.8 * k) });
    fitText(g, 'title.preview.step', stepLabel(save.progress), r.x + 20, r.y + 92, r.w - 40, { size: 17, font: 'italic', color: hex(INK.dim, k), shadow: false });
    const rows: [string, string][] = [
      [t('ui.slots.playtime'), formatPlaytime(save.playtime)],
      [t('ui.slots.last_played'), formatDate(auto?.meta.savedAt ?? save.updatedAt) || t('ui.slots.never')],
    ];
    rows.forEach(([label, value], i) => {
      const y = r.y + 126 + i * 24;
      caps(g, label, r.x + 20, y, 12, hex(INK.dim, k));
      fitText(g, `title.preview.${i}`, value, r.x + r.w - 20, y, 150, { size: 16, color: hex(INK.text, k), align: 'right', shadow: false });
    });
    g.restore();
  }
}

/** The newest manual slot with data, or null: what "Restore backup" can offer when the journal is lost. */
export function recoverableSlot(slots: { slot: SlotId; data: SlotData | null }[]): { slot: SlotId; data: SlotData } | null {
  let best: { slot: SlotId; data: SlotData } | null = null;
  for (const s of slots) {
    if (s.slot === 'auto' || !s.data) continue;
    if (!best || Date.parse(s.data.meta.savedAt) > Date.parse(best.data.meta.savedAt) || Number.isNaN(Date.parse(best.data.meta.savedAt))) best = { slot: s.slot, data: s.data };
  }
  return best;
}

/**
 * "Your records are damaged" (UIX-0094): shown over the title when the journal, its backup and the
 * autosave were all unreadable. The damaged copy has already been set aside as `profile.json.damaged`
 * by the store; here the player picks a manual slot to resume from, or begins a fresh journal.
 */
export class DamagedRecordsScene implements Scene {
  readonly overlay = true;
  readonly ui = new Ui('damaged');
  private t = 0;
  private done = false;
  private backup = recoverableSlot(listSlots());

  private close(game: Game): void {
    if (this.done) return;
    this.done = true;
    game.pop?.();
  }

  private layout(game: Game): void {
    const ui = this.ui;
    ui.begin();
    const w = 230;
    ui.button('restore', { x: VIEW_W / 2 + 16, y: 452, w, h: 52 }, t('ui.damaged.restore'), () => this.restore(game), { style: 'seal', enabled: !!this.backup, tip: this.backup ? undefined : t('ui.damaged.no_backup') });
    ui.button('fresh', { x: VIEW_W / 2 - 16 - w, y: 452, w, h: 52 }, t('ui.damaged.fresh'), () => this.fresh(game));
    if (!ui.focus) ui.focusFirst(this.backup ? 'restore' : 'fresh');
  }

  private restore(game: Game): void {
    if (this.backup && loadFromSlot(save, this.backup.slot)) this.close(game);
  }

  private fresh(game: Game): void {
    store(save);
    this.close(game);
  }

  update(dt: number, game: Game): void {
    this.t += dt;
    this.layout(game);
    this.ui.update(game.input, dt);
    if (!this.done && game.input.actPressed('ui.back')) {
      uiEvents.emit('ui.back', { id: 'damaged' });
      this.fresh(game);
    }
  }

  render(g: Gfx, game: Game): void {
    const k = tween(this.t, MOTION.panel);
    const vr = g.viewRect();
    g.rect(vr.x, vr.y, vr.w, vr.h, hex('#000000', 0.6 * k));
    const r = { x: VIEW_W / 2 - 330, y: 190 + (1 - k) * 20, w: 660, h: 350 };
    glass(g, r, { alpha: k, strength: 1.15 });
    heading(g, t('ui.damaged.title'), VIEW_W / 2, r.y + 62, 360, k, 26);
    const lines = wrapLines((s) => g.measure(s, 20, 'body'), t('ui.damaged.body'), r.w - 90);
    lines.slice(0, 4).forEach((l, i) => prose(g, l, VIEW_W / 2, r.y + 118 + i * 27, 20, INK.text, k, 'center'));
    const detail = this.backup ? t('ui.damaged.backup_found', { chapter: chapterLabel(this.backup.data.progress), date: formatDate(this.backup.data.meta.savedAt) }) : t('ui.damaged.no_backup');
    fitText(g, 'damaged.detail', detail, VIEW_W / 2, r.y + 230, r.w - 80, { size: 17, font: 'italic', color: hex(INK.dim, k), align: 'center', shadow: false });
    for (const n of this.ui.nodes) {
      const s = this.ui.state(n.id);
      if (n.style === 'seal') sealButton(g, n, s, g.time, 24);
      else menuEntry(g, n, s, g.time, 24);
    }
    drawTooltip(g, this.ui);
    reticle(g, game.input.pos);
  }
}
