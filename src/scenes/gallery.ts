import type { Game, Scene } from '../core/scene';
import { heading } from '../ui/hudKit';
import { t } from '../i18n';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { Ui } from '../ui/kit';
import { drawNodes, drawTooltip, listItem } from '../ui/controls';
import { divider, leatherPanel, parchmentSheet, UI } from '../ui/ornaments';
import { ScrollList } from '../ui/scroll';
import { fitText } from '../ui/text';
import { VIEW_W } from '../ui/layout';
import { reticle } from '../ui/widgets';
import { drawBackdrop } from './backdrop';
import { confirm } from './confirm';
import { dropdown } from './choice';

/**
 * Widget gallery (`?ui=gallery`, dev builds; UIX-0006): every control in every
 * state for visual review — seal and menu buttons, toggle, slider, stepper,
 * dropdown, tab bar, scroll list and the modal confirm dialog.
 */
export class GalleryScene implements Scene {
  /** A menu page: moving between two plays the page-turn transition (ART-0306). */
  readonly menuPage = true;
  readonly ui = new Ui('gallery');
  private tab = 0;
  private on = true;
  private vol = 0.6;
  private step = 1;
  private pick = 0;
  private list = new ScrollList({ x: 700, y: 250, w: 420, h: 300 }, 44, 4);
  private picked = -1;

  constructor(private onBack: () => void) {}

  update(dt: number, game: Game): void {
    const ui = this.ui;
    if (this.list.update(game.input, 20, dt)) ui.cancelPress();
    ui.begin();
    const tabs = [t('ui.options.tab.gameplay'), t('ui.options.tab.display'), t('ui.options.tab.audio')];
    tabs.forEach((label, i) => ui.add({ id: `tab${i}`, kind: 'tab', rect: { x: 170 + i * 150, y: 110, w: 146, h: 40 }, label, on: i === this.tab, onActivate: () => (this.tab = i) }));
    const row = (i: number) => ({ x: 160, y: 180 + i * 56, w: 480, h: 48 });
    ui.toggle('toggle', row(0), t('ui.options.reduce_flashing'), this.on, (v) => (this.on = v), { value: this.on ? t('ui.common.on') : t('ui.common.off'), tip: t('ui.options.reduce_flashing_note') });
    ui.slider('slider', row(1), t('ui.options.volume'), this.vol, (f) => (this.vol = f), { value: `${Math.round(this.vol * 100)}%` });
    ui.stepper('stepper', row(2), t('ui.options.shake'), [t('ui.options.shake_off'), t('ui.options.shake_gentle'), t('ui.options.shake_full')][this.step], (d) => (this.step = (this.step + d + 3) % 3));
    const opts = [t('ui.options.timer_standard'), t('ui.options.timer_generous'), t('ui.options.timer_relaxed')];
    dropdown(ui, game, 'dropdown', row(3), t('ui.options.timer_assist'), opts, this.pick, (i) => (this.pick = i), t('ui.options.timer_assist_note'));
    ui.button('seal', { x: 200, y: 450, w: 240, h: 56 }, t('ui.briefing.begin'), () => confirm(game, { title: t('ui.title.new_game'), message: t('ui.title.confirm_new'), onYes: () => undefined, danger: true }), { style: 'seal' });
    ui.button('sealOff', { x: 200, y: 520, w: 240, h: 56 }, t('ui.results.continue'), () => undefined, { style: 'seal', enabled: false });
    ui.button('back', { x: 200, y: 600, w: 240, h: 48 }, t('ui.common.back'), this.onBack);
    for (let i = 0; i < 20; i++) ui.add({ id: `row${i}`, kind: 'item', rect: this.list.rowRect(i), label: t('ui.theatre.entry', { chapter: 'I', index: i + 1 }), clip: this.list.view, on: i === this.picked, onActivate: () => (this.picked = i) });
    if (!ui.focus) ui.focusFirst('toggle');
    ui.update(game.input, dt);
    this.list.follow(ui, 'row');
    if (game.input.actPressed('ui.tabNext')) this.tab = (this.tab + 1) % 3;
    if (game.input.actPressed('ui.tabPrev')) this.tab = (this.tab + 2) % 3;
    if (game.input.actPressed('ui.back')) this.onBack();
  }

  render(g: Gfx, game: Game): void {
    g.beginWorld();
    drawBackdrop(g, 'chapel', g.time);
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 'menu', defocus: 8 });
    leatherPanel(g, { x: 120, y: 60, w: 560, h: 620 });
    parchmentSheet(g, { x: 680, y: 200, w: 480, h: 400 }, 3);
    heading(g, t('ui.gallery.title'), VIEW_W / 2, 40, 300, 1, 24);
    divider(g, VIEW_W / 2, 56, 300);
    const t0 = g.time;
    // Tabs and controls with default renderers; list rows get their text drawn on parchment.
    const listNodes = this.ui.nodes.filter((n) => n.id.startsWith('row'));
    const other = this.ui.nodes.filter((n) => !n.id.startsWith('row'));
    const saved = this.ui.nodes;
    this.ui.nodes = other;
    drawNodes(g, this.ui, t0);
    this.ui.nodes = saved;
    g.pushClip(this.list.view);
    for (const n of listNodes) {
      if (!this.list.visible(Number(n.id.slice(3)))) continue;
      listItem(g, n, this.ui.state(n.id), t0, !!n.on);
      fitText(g, n.id, n.label, n.rect.x + 16, n.rect.y + 30, n.rect.w - 30, { size: 22, color: hex(n.on ? '#7a0c12' : UI.inkDark), shadow: false });
    }
    g.popClip();
    this.list.drawBar(g, 20);
    drawTooltip(g, this.ui);
    reticle(g, game.input.pos);
  }
}
