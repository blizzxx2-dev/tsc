import { t as tr } from '../i18n';
import type { Game, Scene } from '../core/scene';
import { settings, saveSettings } from '../core/settings';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { drawBackdrop } from '../scenes/backdrop';
import { PALETTE, VIEW_W } from '../ui/layout';
import { inRect, panel, reticle, type Rect } from '../ui/widgets';
import { ACTIONS, CAPTURE_CANCEL, RESERVED, reservedFor, type ActionGroup, type ActionId } from './actions';
import { bindings, DEFAULT_PREFS, type GlyphSet, type InputPrefs, type Slot } from './bindings';
import { codeLabel, glyphContext } from './glyphs';
import type { InputCode } from './types';

/** How long "Press a key…" waits before giving up. */
export const CAPTURE_TIMEOUT = 5;

type Tab = ActionGroup | 'handling' | 'deck';
const TABS: { id: Tab; label: string }[] = [
  { id: 'tools', label: 'ctl.tab.tools' },
  { id: 'litany', label: 'ctl.tab.litany' },
  { id: 'story', label: 'ctl.tab.story' },
  { id: 'menus', label: 'ctl.tab.menus' },
  { id: 'handling', label: 'ctl.tab.handling' },
  { id: 'deck', label: 'ctl.tab.deck' },
];

const SLOTS: Slot[] = [
  { kind: 'kbm', index: 0 },
  { kind: 'kbm', index: 1 },
  { kind: 'pad', index: 0 },
];

interface PrefRow {
  label: string;
  value: () => string;
  change: (dir: number) => void;
  note?: string;
}

const cycle = <T,>(list: readonly T[], cur: T, dir: number): T => list[(list.indexOf(cur) + dir + list.length) % list.length];
const step = (v: number, d: number, lo: number, hi: number, by: number) => Math.round(Math.min(hi, Math.max(lo, v + d * by)) * 100) / 100;

function prefRows(p: InputPrefs): PrefRow[] {
  return [
    { label: tr('ctl.pref.hold_actions'), value: () => (p.holdMode === 'hold' ? tr('ctl.pref.hold') : tr('ctl.pref.toggle')), change: () => (p.holdMode = p.holdMode === 'hold' ? 'toggle' : 'hold'), note: tr('ctl.pref.toggle_click_once_to_start_the_l') },
    { label: tr('ctl.pref.assist_target_size'), value: () => `${p.hitScale}×`, change: (d) => (p.hitScale = cycle([1, 1.25, 1.5] as const, p.hitScale, d)), note: tr('ctl.pref.every_grab_cut_and_brush_reaches') },
    { label: tr('ctl.pref.assist_stitching'), value: () => ({ off: tr('ctl.pref.off'), on: tr('ctl.pref.on'), gamepad: tr('ctl.pref.gamepad_only') })[p.assistedStitch], change: (d) => (p.assistedStitch = cycle(['off', 'on', 'gamepad'] as const, p.assistedStitch, d)), note: tr('ctl.pref.hold_and_run_along_the_wound_sti') },
    {
      label: tr('ctl.pref.litany_input'),
      value: () => ({ draw: tr('ctl.pref.draw_the_star'), key: tr('ctl.pref.litany_key'), both: tr('ctl.pref.either') })[p.litanyInput],
      change: (d) => {
        p.litanyInput = cycle(['draw', 'key', 'both'] as const, p.litanyInput, d);
        settings.litanyKey = p.litanyInput !== 'draw';
        saveSettings();
      },
      note: tr('ctl.pref.speaking_the_litany_with_a_key_i'),
    },
    { label: tr('ctl.pref.aim_assist_gamepad'), value: () => (p.aimAssist ? tr('ctl.pref.on') : tr('ctl.pref.off')), change: () => (p.aimAssist = !p.aimAssist), note: tr('ctl.pref.slows_the_cursor_near_what_the_i') },
    { label: tr('ctl.pref.cursor_speed_gamepad'), value: () => `${p.cursorSpeed.toFixed(2)}×`, change: (d) => (p.cursorSpeed = step(p.cursorSpeed, d, 0.5, 2, 0.25)), note: tr('ctl.pref.applies_to_the_gamepad_cursor_th') },
    { label: tr('ctl.pref.left_stick_deadzone'), value: () => `${Math.round(p.deadzones.left.inner * 100)}%`, change: (d) => (p.deadzones.left = { ...p.deadzones.left, inner: step(p.deadzones.left.inner, d, 0.05, 0.4, 0.05) }) },
    { label: tr('ctl.pref.right_stick_deadzone'), value: () => `${Math.round(p.deadzones.right.inner * 100)}%`, change: (d) => (p.deadzones.right = { ...p.deadzones.right, inner: step(p.deadzones.right.inner, d, 0.05, 0.4, 0.05) }) },
    { label: tr('ctl.pref.mouse_wheel'), value: () => (p.invertWheel ? tr('ctl.pref.inverted') : tr('ctl.pref.normal')), change: () => (p.invertWheel = !p.invertWheel) },
    { label: tr('ctl.pref.wheel_wraps_around_the_tray'), value: () => (p.wrapWheel ? tr('ctl.pref.on') : tr('ctl.pref.off')), change: () => (p.wrapWheel = !p.wrapWheel) },
    { label: tr('ctl.pref.confirm_button'), value: () => (p.nintendoLayout ? tr('ctl.pref.right_face_nintendo') : tr('ctl.pref.bottom_face')), change: () => (p.nintendoLayout = !p.nintendoLayout) },
    { label: tr('ctl.pref.button_prompts'), value: () => ({ auto: tr('ctl.pref.automatic'), xbox: tr('ctl.pref.xbox'), playstation: tr('ctl.pref.playstation'), nintendo: tr('ctl.pref.nintendo'), deck: tr('ctl.pref.steam_deck'), generic: tr('ctl.pref.generic') })[p.glyphs], change: (d) => (p.glyphs = cycle(['auto', 'xbox', 'playstation', 'nintendo', 'deck', 'generic'] as GlyphSet[], p.glyphs, d)) },
  ];
}

/** The Steam Deck default configuration shipped with the game (see steam/input/). */
/** Keys: input, action. */
const DECK_LAYOUT: [string, string][] = [
  ['ctl.deck.0.input', 'ctl.deck.0.action'],
  ['ctl.deck.1.input', 'ctl.deck.1.action'],
  ['ctl.deck.2.input', 'ctl.deck.2.action'],
  ['ctl.deck.3.input', 'ctl.deck.3.action'],
  ['ctl.deck.4.input', 'ctl.deck.4.action'],
  ['ctl.deck.5.input', 'ctl.deck.5.action'],
  ['ctl.deck.6.input', 'ctl.deck.6.action'],
  ['ctl.deck.7.input', 'ctl.deck.7.action'],
  ['ctl.deck.8.input', 'ctl.deck.8.action'],
  ['ctl.deck.9.input', 'ctl.deck.9.action'],
  ['ctl.deck.10.input', 'ctl.deck.10.action'],
  ['ctl.deck.11.input', 'ctl.deck.11.action'],
];

/**
 * Options → Controls: every action by group with two keyboard/mouse slots and one
 * gamepad slot. Select a slot to capture ("Press a key…", 5 s, Esc cancels);
 * conflicts offer Swap/Cancel; reserved inputs explain themselves. Navigable by
 * mouse, keyboard and gamepad.
 */
export class ControlsScene implements Scene {
  private tab = 0;
  private row = 0;
  private col = 0;
  private capture: { action: ActionId; slot: Slot; t: number; armed: boolean } | null = null;
  private prompt: { action: ActionId; slot: Slot; code: InputCode; others: string } | null = null;
  private message = '';
  private messageT = 0;
  private hoverRow = -1;
  private hoverCol = -1;

  constructor(
    private onBack: () => void,
    /** true: chapel backdrop; false: plain screen; 'overlay': drawn over the live scene beneath (scene stack). */
    private overWorld: boolean | 'overlay' = true,
  ) {
    this.overlay = overWorld === 'overlay';
  }

  readonly overlay: boolean;

  private get tabId(): Tab {
    return TABS[this.tab].id;
  }

  private actions(): ActionId[] {
    return ACTIONS.filter((a) => a.group === this.tabId).map((a) => a.id);
  }

  private rowCount(): number {
    if (this.tabId === 'handling') return prefRows(bindings.prefs).length;
    if (this.tabId === 'deck') return 0;
    return this.actions().length;
  }

  private rowRect(i: number): Rect {
    return { x: 190, y: 170 + i * 30, w: 900, h: 28 };
  }
  private cellRect(i: number, c: number): Rect {
    return { x: 560 + c * 176, y: 170 + i * 30, w: 168, h: 28 };
  }
  private tabRect(i: number): Rect {
    return { x: 190 + i * 150, y: 112, w: 146, h: 36 };
  }
  /** Footer: Reset row, Reset all, Back. */
  private footRect(i: number): Rect {
    return { x: 330 + i * 220, y: 634, w: 200, h: 36 };
  }

  private say(msg: string): void {
    // Reserved-input explanations come from the action table in English; show them localised.
    const reserved = RESERVED.findIndex((r) => r.why === msg);
    this.message = reserved >= 0 ? tr(`ctl.reserved.${reserved}`) : msg;
    this.messageT = 4;
  }

  update(dt: number, game: Game): void {
    const input = game.input;
    this.messageT = Math.max(0, this.messageT - dt);
    const prefs = bindings.prefs;

    if (this.capture) return this.updateCapture(dt, game);

    if (this.prompt) {
      if (input.actPressed('ui.confirm') || (input.pressed && inRect(input.pos, this.footRect(0)))) {
        bindings.assign(this.prompt.action, this.prompt.slot, this.prompt.code, 'swap');
        bindings.save();
        this.prompt = null;
      } else if (input.actPressed('ui.back') || (input.pressed && inRect(input.pos, this.footRect(1)))) this.prompt = null;
      return;
    }

    const rows = this.rowCount();
    const handling = this.tabId === 'handling';
    // Mouse hover.
    this.hoverRow = -1;
    this.hoverCol = -1;
    for (let i = 0; i < rows; i++) {
      if (!inRect(input.pos, this.rowRect(i))) continue;
      this.hoverRow = i;
      if (!handling) for (let c = 0; c < 3; c++) if (inRect(input.pos, this.cellRect(i, c))) this.hoverCol = c;
    }
    if (input.pressed) {
      const t = TABS.findIndex((_, i) => inRect(input.pos, this.tabRect(i)));
      if (t >= 0) return this.setTab(t);
      const f = [0, 1, 2].find((i) => inRect(input.pos, this.footRect(i)));
      if (f !== undefined) return this.activateFooter(f);
      if (this.hoverRow >= 0) {
        this.row = this.hoverRow;
        if (handling) {
          const r = this.rowRect(this.row);
          prefRows(prefs)[this.row].change(input.pos.x < r.x + r.w * 0.6 ? -1 : 1);
          bindings.save();
        } else if (this.hoverCol >= 0) {
          this.col = this.hoverCol;
          this.beginCapture();
        }
        return;
      }
    }
    // Right-click clears a slot.
    if (input.rightPressed && !handling && this.hoverRow >= 0 && this.hoverCol >= 0) {
      const r = bindings.clear(this.actions()[this.hoverRow], SLOTS[this.hoverCol]);
      if (!r.ok && r.reason !== 'conflict') this.say(r.message);
      bindings.save();
      return;
    }

    // Keyboard / gamepad navigation. Row `rows` is the footer.
    if (input.actPressed('ui.tabPrev')) return this.setTab(this.tab - 1);
    if (input.actPressed('ui.tabNext')) return this.setTab(this.tab + 1);
    if (input.actRepeated('ui.up')) this.row = (this.row + rows) % (rows + 1);
    if (input.actRepeated('ui.down')) this.row = (this.row + 1) % (rows + 1);
    const inFooter = this.row >= rows;
    if (input.actRepeated('ui.left')) {
      if (handling && !inFooter) {
        prefRows(prefs)[this.row].change(-1);
        bindings.save();
      } else this.col = Math.max(0, this.col - 1);
    }
    if (input.actRepeated('ui.right')) {
      if (handling && !inFooter) {
        prefRows(prefs)[this.row].change(1);
        bindings.save();
      } else this.col = Math.min(2, this.col + 1);
    }
    if (input.actPressed('ui.confirm')) {
      if (inFooter) return this.activateFooter(this.col);
      if (handling) {
        prefRows(prefs)[this.row].change(1);
        bindings.save();
      } else this.beginCapture();
      return;
    }
    if (input.actPressed('ui.back')) this.back();
  }

  private setTab(t: number): void {
    this.tab = (t + TABS.length) % TABS.length;
    this.row = 0;
    this.col = 0;
  }

  private activateFooter(i: number): void {
    const handling = this.tabId === 'handling';
    if (i === 0) {
      // Reset the focused row (or, on the handling tab, every handling option).
      if (handling) {
        Object.assign(bindings.prefs, JSON.parse(JSON.stringify(DEFAULT_PREFS)));
        settings.litanyKey = false;
        saveSettings();
      } else if (this.actions()[this.row]) bindings.reset(this.actions()[this.row]);
      bindings.save();
    } else if (i === 1) {
      bindings.resetAll();
      bindings.save();
      this.say(tr('ctl.msg.reset_all'));
    } else this.back();
  }

  private beginCapture(): void {
    const action = this.actions()[this.row];
    if (!action) return;
    this.capture = { action, slot: SLOTS[this.col], t: CAPTURE_TIMEOUT, armed: false };
  }

  private updateCapture(dt: number, game: Game): void {
    const cap = this.capture!;
    cap.t -= dt;
    if (cap.t <= 0) {
      this.capture = null;
      return this.say(tr('ctl.msg.no_key'));
    }
    const codes = game.input.codesPressed();
    // Ignore whatever opened the capture; listen from the next frame.
    if (!cap.armed) {
      cap.armed = true;
      return;
    }
    const code = codes.find((c) => (cap.slot.kind === 'pad' ? c.startsWith('pad:') : !c.startsWith('pad:')));
    if (codes.includes(CAPTURE_CANCEL) || (cap.slot.kind === 'pad' && codes.includes('pad:9'))) {
      this.capture = null;
      return;
    }
    if (!code) return;
    this.capture = null;
    const r = bindings.assign(cap.action, cap.slot, code);
    if (r.ok) bindings.save();
    else if (r.reason === 'conflict') this.prompt = { action: cap.action, slot: cap.slot, code, others: r.conflicts.map((c) => tr(`action.${c.action}`)).join(', ') };
    else this.say(r.message);
  }

  private back(): void {
    bindings.save();
    this.onBack();
  }

  render(g: Gfx, game: Game): void {
    if (this.overlay) {
      const vr = g.viewRect();
      g.rect(vr.x, vr.y, vr.w, vr.h, hex('#000000', 0.55));
    } else if (this.overWorld) {
      g.beginWorld();
      drawBackdrop(g, 'chapel', g.time);
      g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 1 });
    } else g.beginScreen();
    panel(g, { x: 160, y: 30, w: 960, h: 660 });
    g.text(tr('ctl.title'), VIEW_W / 2, 92, { size: 46, font: 'display', color: hex(PALETTE.ink), align: 'center' });
    const pad = glyphContext().glyphs;

    TABS.forEach((t, i) => {
      const r = this.tabRect(i);
      const on = i === this.tab;
      g.rect(r.x, r.y, r.w, r.h, hex(on ? PALETTE.blood : '#000000', on ? 0.5 : 0.25));
      g.text(tr(t.label), r.x + r.w / 2, r.y + 25, { size: 16, color: hex(on ? PALETTE.gold : PALETTE.inkDim), align: 'center' });
    });

    const rows = this.rowCount();
    if (this.tabId === 'deck') {
      g.text(tr('ctl.deck.title'), 190, 190, { size: 22, color: hex(PALETTE.gold) });
      DECK_LAYOUT.forEach(([k, v], i) => {
        g.text(tr(k), 210, 226 + i * 32, { size: 19, color: hex(PALETTE.gold) });
        g.text(tr(v), 450, 226 + i * 32, { size: 19, color: hex(PALETTE.ink) });
      });
    } else if (this.tabId === 'handling') {
      const list = prefRows(bindings.prefs);
      list.forEach((row, i) => {
        const r = this.rowRect(i);
        const focus = i === this.row || i === this.hoverRow;
        if (focus) g.rect(r.x, r.y, r.w, r.h, hex(PALETTE.blood, 0.28));
        g.text(row.label, r.x + 16, r.y + 21, { size: 19, color: hex(focus ? PALETTE.gold : PALETTE.ink) });
        g.text(`‹  ${row.value()}  ›`, r.x + r.w - 16, r.y + 21, { size: 19, color: hex(PALETTE.gold), align: 'right' });
      });
      const note = list[this.hoverRow >= 0 ? this.hoverRow : this.row]?.note;
      if (note) g.text(note, VIEW_W / 2, 614, { size: 16, font: 'italic', color: hex(PALETTE.inkDim), align: 'center' });
    } else {
      g.text(tr('ctl.col.kbm'), this.cellRect(0, 0).x + 172, 162, { size: 16, color: hex(PALETTE.inkDim), align: 'center' });
      g.text(tr('ctl.col.pad'), this.cellRect(0, 2).x + 84, 162, { size: 16, color: hex(PALETTE.inkDim), align: 'center' });
      this.actions().forEach((id, i) => {
        const r = this.rowRect(i);
        const set = bindings.get(id);
        const def = ACTIONS.find((a) => a.id === id)!;
        g.text(tr(`action.${def.id}`), r.x + 16, r.y + 21, { size: 19, color: hex(i === this.row ? PALETTE.gold : PALETTE.ink) });
        SLOTS.forEach((slot, c) => {
          const cr = this.cellRect(i, c);
          const code = set[slot.kind][slot.index];
          const focused = (i === this.row && c === this.col) || (i === this.hoverRow && c === this.hoverCol);
          const capturing = this.capture?.action === id && this.capture.slot.kind === slot.kind && this.capture.slot.index === slot.index;
          g.rect(cr.x, cr.y, cr.w, cr.h, hex(focused ? PALETTE.blood : '#000000', focused ? 0.45 : 0.3));
          if (focused) g.rectLine(cr.x, cr.y, cr.w, cr.h, 1.5, hex(PALETTE.gold, 0.8));
          const locked = code && reservedFor(code)?.action === id;
          const label = capturing ? tr('ctl.capture_short', { s: Math.ceil(this.capture!.t) }) : code ? codeLabel(code, slot.kind === 'pad' ? pad : 'xbox') + (locked ? ' •' : '') : '—';
          g.text(label, cr.x + cr.w / 2, cr.y + 20, { size: 17, color: hex(capturing ? PALETTE.gold : code ? PALETTE.ink : PALETTE.inkDim), align: 'center' });
        });
      });
      g.text(tr('ctl.help'), VIEW_W / 2, 614, { size: 16, font: 'italic', color: hex(PALETTE.inkDim), align: 'center' });
    }

    const foot = [this.tabId === 'handling' ? tr('ctl.foot.reset_these') : tr('ctl.foot.reset_row'), tr('ctl.foot.reset_all'), tr('ui.common.back')];
    foot.forEach((label, i) => {
      const r = this.footRect(i);
      const focus = (this.row >= rows && this.col === i) || inRect(game.input.pos, r);
      g.rect(r.x, r.y, r.w, r.h, hex(focus ? PALETTE.blood : '#000000', focus ? 0.5 : 0.3));
      g.text(label, r.x + r.w / 2, r.y + 26, { size: 20, color: hex(focus ? PALETTE.gold : PALETTE.ink), align: 'center' });
    });

    if (this.capture) this.drawOverlay(g, tr('ctl.capture', { action: tr(`action.${this.capture.action}`) }), tr('ctl.capture_note', { s: Math.ceil(this.capture.t) }));
    if (this.prompt) this.drawOverlay(g, tr('ctl.conflict', { input: codeLabel(this.prompt.code, pad), others: this.prompt.others }), tr('ctl.prompt.swap_q'), [tr('ctl.prompt.swap'), tr('ctl.prompt.cancel')]);
    if (this.messageT > 0) g.text(this.message, VIEW_W / 2, 700, { size: 17, color: hex(PALETTE.bad), align: 'center' });
    reticle(g, game.input.pos);
    g.endFrame();
  }

  private drawOverlay(g: Gfx, title: string, sub: string, buttons: string[] = []): void {
    g.rect(0, 0, VIEW_W, 720, hex('#000000', 0.55));
    g.rect(340, 270, 600, 180, hex('#140a08', 0.96));
    g.rectLine(340, 270, 600, 180, 2, hex(PALETTE.gold, 0.7));
    g.text(title, VIEW_W / 2, 330, { size: 22, color: hex(PALETTE.ink), align: 'center' });
    g.text(sub, VIEW_W / 2, 370, { size: 18, font: 'italic', color: hex(PALETTE.inkDim), align: 'center' });
    buttons.forEach((b, i) => {
      const r = this.footRect(i);
      g.rect(r.x, r.y, r.w, r.h, hex(PALETTE.blood, 0.5));
      g.text(b, r.x + r.w / 2, r.y + 26, { size: 20, color: hex(PALETTE.gold), align: 'center' });
    });
  }
}
