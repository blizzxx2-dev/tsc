/**
 * Credits (UIX-0085) and third-party notices (PLT-0145). The credits roll upward on their own,
 * roll faster while confirm or the primary button is held, and any Back / Esc leaves. The notices
 * page lists every shipped component with its licence and, on desktop, opens the full
 * THIRD_PARTY_NOTICES.txt beside the executable.
 */
import type { Game, Scene } from '../core/scene';
import { t } from '../i18n';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { VIEW_H, VIEW_W } from '../ui/layout';
import { Ui } from '../ui/kit';
import { drawTooltip, menuEntry, sealButton } from '../ui/controls';
import { caps, diamond, glass, heading, INK, rule, titleRule } from '../ui/hudKit';
import { ScrollList } from '../ui/scroll';
import { fitText } from '../ui/text';
import { uiEvents } from '../ui/events';
import { reticle } from '../ui/widgets';
import { platform } from '../platform';
import { drawBackdrop } from './backdrop';
import { CREDIT_SECTIONS, fontCredits, softwareCredits } from './creditsData';
import { NOTICES } from './noticesData';
import { TitleScene } from './title';

type Row = { kind: 'heading' | 'role' | 'name' | 'gap' | 'title' | 'note'; text: string; role?: string };

const ROLL_SPEED = 42;
const FAST = 4;

/** The credits as one flat list of rows, built once per scene (strings resolve for the current locale). */
export function creditRows(): Row[] {
  const rows: Row[] = [{ kind: 'title', text: t('ui.game.title') }, { kind: 'note', text: t('ui.game.subtitle') }, { kind: 'gap', text: '' }];
  for (const s of CREDIT_SECTIONS) {
    rows.push({ kind: 'heading', text: t(s.headingKey) });
    for (const l of s.lines) {
      if (l.roleKey) rows.push({ kind: 'role', text: t(l.roleKey) });
      for (const n of l.names) rows.push({ kind: 'name', text: n });
    }
    rows.push({ kind: 'gap', text: '' });
  }
  rows.push({ kind: 'heading', text: t('ui.credits.section_type') });
  for (const f of fontCredits()) rows.push({ kind: 'name', text: t('ui.credits.font_line', { family: f.family, style: t(f.style === 'italic' ? 'ui.credits.style_italic' : 'ui.credits.style_regular') }) });
  rows.push({ kind: 'note', text: t('ui.credits.ofl_notice') }, { kind: 'gap', text: '' });
  rows.push({ kind: 'heading', text: t('ui.credits.section_software') });
  for (const s of softwareCredits()) rows.push({ kind: 'name', text: t('ui.credits.software_line', { name: s.name, licence: s.licence }) });
  rows.push({ kind: 'note', text: t('ui.credits.notices_hint') }, { kind: 'gap', text: '' }, { kind: 'gap', text: '' }, { kind: 'note', text: t('ui.credits.thanks_line') });
  return rows;
}

const ROW_H: Record<Row['kind'], number> = { title: 96, heading: 64, role: 30, name: 34, note: 34, gap: 36 };

export class CreditsScene implements Scene {
  /** A menu page: moving between two plays the page-turn transition (ART-0306). */
  readonly menuPage = true;
  readonly ui = new Ui('credits');
  private t = 0;
  /** Roll offset; starts with the lockup already rising from the bottom edge. */
  private y = 140;
  private rows = creditRows();
  private total = this.rows.reduce((s, r) => s + ROW_H[r.kind], 0);
  private done = false;

  constructor(private onBack?: (game: Game) => void) {}

  private leave(game: Game): void {
    if (this.done) return;
    this.done = true;
    if (this.onBack) this.onBack(game);
    else game.go(new TitleScene());
  }

  update(dt: number, game: Game): void {
    this.t += dt;
    const input = game.input;
    // Speed-up on hold (UIX-0085): confirm, the primary button, or the pad's confirm all count.
    const held = input.down || input.act('ui.confirm');
    this.y += dt * ROLL_SPEED * (held ? FAST : 1);
    if (input.actPressed('ui.up')) this.y = Math.max(0, this.y - 120);
    if (input.actPressed('ui.down')) this.y += 120;
    this.y += -input.wheel * 60;
    this.y = Math.max(0, this.y);
    const ui = this.ui;
    ui.begin();
    ui.button('notices', { x: 40, y: VIEW_H - 64, w: 280, h: 42 }, t('ui.credits.notices'), () => game.push?.(new NoticesScene()));
    ui.button('back', { x: VIEW_W - 280, y: VIEW_H - 64, w: 240, h: 42 }, t('ui.common.back'), () => this.leave(game));
    ui.update(input, dt);
    if (input.actPressed('ui.back')) {
      uiEvents.emit('ui.back', { id: 'credits' });
      this.leave(game);
    }
    if (this.y > this.total + 60) this.leave(game);
  }

  render(g: Gfx, game: Game): void {
    g.beginWorld();
    drawBackdrop(g, 'night', g.time);
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: { preset: 'menu', intensity: 1.1 }, defocus: 8 });
    const vr = g.viewRect();
    g.rect(vr.x, vr.y, vr.w, vr.h, hex('#050303', 0.62));
    const cx = VIEW_W / 2;
    const top = vr.y;
    const bottom = vr.y + vr.h;
    g.pushClip({ x: vr.x, y: top, w: vr.w, h: vr.h });
    let y = bottom + 40 - this.y;
    for (const r of this.rows) {
      const h = ROW_H[r.kind];
      if (y + h >= top && y <= bottom) {
        // Fade rows in at the bottom edge and out at the top.
        const fade = Math.min(1, (bottom - y) / 80, (y - top + h) / 80);
        const a = Math.max(0, Math.min(1, fade));
        this.row(g, r, cx, y, a);
      }
      y += h;
    }
    g.popClip();
    g.rectGrad(vr.x, top, vr.w, 90, hex('#050303', 0.9), hex('#050303', 0));
    g.rectGrad(vr.x, bottom - 110, vr.w, 110, hex('#050303', 0), hex('#050303', 0.95));
    for (const n of this.ui.nodes) menuEntry(g, n, this.ui.state(n.id), g.time, 22);
    g.text(t('ui.credits.hint'), cx, VIEW_H - 36, { size: 16, font: 'italic', color: hex(INK.faint), align: 'center', shadow: false });
    drawTooltip(g, this.ui);
    reticle(g, game.input.pos);
    g.endFrame();
  }

  private row(g: Gfx, r: Row, cx: number, y: number, a: number): void {
    switch (r.kind) {
      case 'title':
        g.text(r.text.toUpperCase(), cx, y + 64, { size: 56, font: 'display', color: hex('#fff4d0', a), color2: hex('#c8923c', a), align: 'center', tracking: 0.09, shadow: hex('#000000', 0.9 * a), soft: true });
        break;
      case 'heading':
        heading(g, r.text, cx, y + 34, 360, a, 24);
        break;
      case 'role':
        caps(g, r.text, cx, y + 22, 13, hex(INK.gold, a), 'center');
        break;
      case 'name':
        fitText(g, 'credits.name', r.text, cx, y + 24, 900, { size: 22, color: hex(INK.text, a), align: 'center', shadow: hex('#000000', 0.8 * a) });
        break;
      case 'note':
        fitText(g, 'credits.note', r.text, cx, y + 24, 900, { size: 18, font: 'italic', color: hex(INK.dim, a), align: 'center', shadow: false });
        break;
      case 'gap':
        break;
    }
  }
}

/** Third-party notices: one row per component, the licence beside it; desktop opens the full text file. */
export class NoticesScene implements Scene {
  readonly overlay = true;
  readonly ui = new Ui('notices');
  private t = 0;
  private list = new ScrollList({ x: 190, y: 150, w: 900, h: 400 }, 52, 4);
  private done = false;

  private close(game: Game): void {
    if (this.done) return;
    this.done = true;
    game.pop?.();
  }

  update(dt: number, game: Game): void {
    this.t += dt;
    const input = game.input;
    if (this.list.update(input, NOTICES.length, dt)) this.ui.cancelPress();
    const ui = this.ui;
    ui.begin();
    NOTICES.forEach((n, i) => ui.add({ id: `row${i}`, kind: 'item', rect: this.list.rowRect(i), label: n.name, clip: this.list.view, tip: t('ui.notices.holder', { holder: n.holder }) }));
    if (platform.kind === 'desktop') ui.button('open', { x: 190, y: 574, w: 320, h: 46 }, t('ui.notices.open_file'), () => platform.open('notices'), { style: 'seal' });
    ui.button('close', { x: VIEW_W - 190 - 240, y: 574, w: 240, h: 46 }, t('ui.common.back'), () => this.close(game));
    if (!ui.focus) ui.focusFirst('row0');
    ui.update(input, dt);
    this.list.follow(ui, 'row');
    if (input.actPressed('ui.back')) {
      uiEvents.emit('ui.back', { id: 'notices' });
      this.close(game);
    }
  }

  render(g: Gfx, game: Game): void {
    const vr = g.viewRect();
    g.rect(vr.x, vr.y, vr.w, vr.h, hex('#000000', 0.6));
    const pr = { x: 150, y: 40, w: 980, h: 640 };
    glass(g, pr, { strength: 1.12 });
    heading(g, t('ui.notices.title'), VIEW_W / 2, 96, 420, 1, 28);
    caps(g, t('ui.notices.component'), this.list.view.x + 16, 138, 12, hex(INK.dim));
    caps(g, t('ui.notices.licence'), this.list.view.x + this.list.view.w - 16, 138, 12, hex(INK.dim), 'right');
    g.pushClip(this.list.view);
    NOTICES.forEach((n, i) => {
      if (!this.list.visible(i)) return;
      const r = this.list.rowRect(i);
      const s = this.ui.state(`row${i}`);
      if (s.glow > 0) g.rect(r.x, r.y, r.w, r.h, hex('#7a5626', 0.18 * s.glow));
      diamond(g, r.x + 12, r.y + r.h / 2, 3, hex(INK.gold, 0.8));
      fitText(g, `notices.${i}.name`, n.name, r.x + 28, r.y + 24, 300, { size: 20, color: hex(s.glow > 0.5 ? INK.goldHi : INK.text), shadow: hex('#000000', 0.8) });
      fitText(g, `notices.${i}.holder`, n.holder, r.x + 28, r.y + 44, 520, { size: 16, font: 'italic', color: hex(INK.dim), shadow: false });
      fitText(g, `notices.${i}.licence`, n.licence, r.x + r.w - 16, r.y + 30, 330, { size: 17, color: hex(INK.gold), align: 'right', shadow: false });
      caps(g, t(n.scope === 'desktop' ? 'ui.notices.scope_desktop' : 'ui.notices.scope_runtime'), r.x + r.w - 16, r.y + 47, 12, hex(INK.faint), 'right');
      g.rect(r.x + 8, r.y + r.h + 1, r.w - 16, 1, hex(INK.gilt, 0.14));
    });
    g.popClip();
    this.list.drawBar(g, NOTICES.length);
    titleRule(g, VIEW_W / 2, 562, 300, 0.6);
    rule(g, VIEW_W / 2, 146, 900, hex(INK.gilt, 0.4));
    for (const n of this.ui.nodes) {
      if (n.kind === 'item') continue;
      const s = this.ui.state(n.id);
      if (n.style === 'seal') sealButton(g, n, s, g.time, 22);
      else menuEntry(g, n, s, g.time, 24);
    }
    fitText(g, 'notices.foot', t(platform.kind === 'desktop' ? 'ui.notices.file_note' : 'ui.notices.web_note'), VIEW_W / 2, 654, 900, { size: 16, font: 'italic', color: hex(INK.faint), align: 'center', shadow: false });
    drawTooltip(g, this.ui);
    reticle(g, game.input.pos);
  }
}
