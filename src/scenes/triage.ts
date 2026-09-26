/**
 * The triage scene (CON-0226, CON-0229, CON-0230): stretchers in a grid, each with its life running
 * down; pick one to read its wounds and signs, tag it, and set your hands to a procedure. Tagging a
 * patient Beyond Help gives the last rites. When the wagons come, the results show who was lost and
 * which tags were wrong.
 */
import type { Game, Scene } from '../core/scene';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { FIELD_PROCEDURES, TRIAGE, TRIAGE_TAGS, TriageField, type TriageOutcome, type TriageScenario, type TriageTag } from '../surgery/triage';
import { heading } from '../ui/hudKit';
import { PALETTE, VIEW_W } from '../ui/layout';
import { button, inRect, panel, parchment, reticle } from '../ui/widgets';
import { drawBackdrop } from './backdrop';
import type { Backdrop } from '../content/story';
import { t } from '../i18n';

const GRID = { x: 40, y: 104, cols: 5, w: 232, h: 132, gap: 8 };
const DETAIL = { x: 40, y: 390, w: 760, h: 220 };
const ACTIONS = { x: 816, y: 390, w: 424, h: 220 };
const LOG = { x: 40, y: 620, w: 1200, h: 40 };

const TAG_COLOR: Record<TriageTag, string> = { immediate: '#c03a2a', delayed: '#d0a030', walking: '#5a9a50', beyond: '#3a3a44' };

export class TriageScene implements Scene {
  readonly field: TriageField;
  private selected: string | null = null;
  /** Tutorial prompt showing (CON-0230); the field waits while it is up. */
  private lesson = 0;
  /** The last rites being said (CON-0229); the field waits while they are. */
  private rites: readonly [string, string] | null = null;
  private done = false;

  constructor(
    scenario: TriageScenario,
    private backdrop: Backdrop,
    private onDone: (outcome: TriageOutcome, field: TriageField) => void,
  ) {
    this.field = new TriageField(scenario);
  }

  private get paused(): boolean {
    return this.lesson < (this.field.scenario.tutorial?.length ?? 0) || this.rites !== null;
  }

  update(dt: number, game: Game): void {
    if (game.input.actPressed('ui.back')) this.selected = null;
    if (!this.paused) this.field.tick(dt);
  }

  render(g: Gfx, game: Game): void {
    const f = this.field;
    const sc = f.scenario;
    const input = game.input;
    const live = !this.paused && !f.finished;
    g.beginWorld();
    drawBackdrop(g, this.backdrop, g.time);
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 'menu', defocus: 6 });
    heading(g, sc.title, VIEW_W / 2, 44, 520, 1, 28);
    g.text(sc.place, VIEW_W / 2, 80, { size: 17, font: 'italic', color: hex(PALETTE.inkDim), align: 'center' });
    g.text(t('ui.triage.clock', { s: Math.ceil(f.clock) }), VIEW_W - 40, 44, { size: 18, color: hex(f.clock < 30 ? '#d07050' : PALETTE.gold), align: 'right' });

    // The stretchers.
    f.patients.forEach((p, i) => {
      const r = { x: GRID.x + (i % GRID.cols) * (GRID.w + GRID.gap), y: GRID.y + Math.floor(i / GRID.cols) * (GRID.h + GRID.gap), w: GRID.w, h: GRID.h };
      if (!p.arrived) {
        g.rect(r.x, r.y, r.w, r.h, hex('#000000', 0.15));
        return;
      }
      const hover = live && inRect(input.pos, r);
      const sel = this.selected === p.card.id;
      panel(g, r);
      if (sel || hover) g.rect(r.x, r.y, r.w, r.h, hex(sel ? PALETTE.gold : PALETTE.blood, sel ? 0.25 : 0.2));
      const failing = p.state === 'waiting' && p.card.life < 999 && p.life / p.card.life < TRIAGE.failing;
      g.text(p.card.name, r.x + 12, r.y + 28, { size: 17, color: hex(p.state === 'dead' ? PALETTE.inkDim : PALETTE.ink) });
      if (p.tag) {
        g.rect(r.x + 12, r.y + 42, 150, 26, hex(TAG_COLOR[p.tag], 0.9));
        g.text(t(`ui.triage.tag.${p.tag}`), r.x + 20, r.y + 61, { size: 16, color: hex('#f4ecd8'), shadow: false });
      }
      const status = p.state === 'dead' ? t('ui.triage.dead') : p.state === 'stable' ? t('ui.triage.stable') : f.busy?.id === p.card.id ? t('ui.triage.working') : '';
      if (status) g.text(status, r.x + 12, r.y + 94, { size: 16, font: 'italic', color: hex(p.state === 'dead' ? '#d07050' : PALETTE.inkDim) });
      // The life clock: a sand-line under the card, pulsing when failing.
      if (p.state === 'waiting' && p.card.life < 999) {
        const k = p.life / p.card.life;
        g.rect(r.x + 12, r.y + r.h - 20, r.w - 24, 8, hex('#000000', 0.4));
        g.rect(r.x + 12, r.y + r.h - 20, (r.w - 24) * k, 8, hex(failing ? '#e05030' : '#c8a060', failing ? 0.6 + 0.4 * Math.sin(g.time * 8) : 1));
      }
      if (hover && input.pressed) this.selected = p.card.id;
    });

    // The one picked: wounds and signs.
    parchment(g, DETAIL);
    const p = this.selected ? f.get(this.selected) : undefined;
    if (p) {
      g.text(p.card.name, DETAIL.x + 20, DETAIL.y + 32, { size: 20, color: hex('#3a2a1a'), shadow: false });
      g.textBlock(p.card.wounds, DETAIL.x + 20, DETAIL.y + 66, DETAIL.w - 40, { size: 18, color: hex('#3a2a1a'), shadow: false }, 1.25);
      g.textBlock(p.card.signs, DETAIL.x + 20, DETAIL.y + 150, DETAIL.w - 40, { size: 18, font: 'italic', color: hex('#5a4030'), shadow: false }, 1.25);
    } else g.text(t('ui.triage.pick'), DETAIL.x + 20, DETAIL.y + 40, { size: 18, font: 'italic', color: hex('#5a4030'), shadow: false });

    // Tag and treat.
    panel(g, ACTIONS);
    g.text(t('ui.triage.tag'), ACTIONS.x + 16, ACTIONS.y + 26, { size: 16, color: hex(PALETTE.gold) });
    TRIAGE_TAGS.forEach((tag, k) => {
      const r = { x: ACTIONS.x + 12 + (k % 2) * 202, y: ACTIONS.y + 38 + Math.floor(k / 2) * 40, w: 196, h: 34 };
      const usable = live && !!p && p.state === 'waiting';
      const hover = usable && inRect(input.pos, r);
      g.rect(r.x, r.y, r.w, r.h, hex(TAG_COLOR[tag], p?.tag === tag ? 0.95 : hover ? 0.7 : 0.4));
      g.text(t(`ui.triage.tag.${tag}`), r.x + 10, r.y + 24, { size: 17, color: hex(usable ? '#f4ecd8' : PALETTE.inkDim), shadow: false });
      if (hover && input.pressed && p) {
        const said = f.tag(p.card.id, tag);
        if (said) this.rites = said;
      }
    });
    g.text(t('ui.triage.treat'), ACTIONS.x + 16, ACTIONS.y + 140, { size: 16, color: hex(PALETTE.gold) });
    FIELD_PROCEDURES.forEach((proc, k) => {
      const r = { x: ACTIONS.x + 12 + k * 136, y: ACTIONS.y + 152, w: 130, h: 36 };
      const usable = live && !!p && p.state === 'waiting' && p.tag !== 'beyond' && !f.busy;
      const hover = usable && inRect(input.pos, r);
      const doing = f.busy?.id === p?.card.id && f.busy?.proc === proc;
      const had = !!p?.done.includes(proc);
      g.rect(r.x, r.y, r.w, r.h, hex(doing ? PALETTE.gold : hover ? PALETTE.blood : '#000000', doing ? 0.5 : hover ? 0.4 : 0.25));
      g.text(`${t(`ui.triage.proc.${proc}`)}${had ? ' ✓' : ''}`, r.x + 10, r.y + 25, { size: 16, color: hex(usable || had ? PALETTE.ink : PALETTE.inkDim) });
      if (hover && input.pressed && p) f.treat(p.card.id, proc);
    });

    // The last thing that happened.
    panel(g, LOG);
    g.text(f.log[f.log.length - 1] ?? '', LOG.x + 16, LOG.y + 27, { size: 17, color: hex(PALETTE.ink) });

    if (!f.finished) {
      if (button(g, input, t('ui.triage.wagons'), VIEW_W / 2, 694, 22, live)) f.end();
    }

    // Overlays: the lesson, the last rites, the results.
    const tut = sc.tutorial ?? [];
    if (this.lesson < tut.length) {
      this.drawCard(g, [tut[this.lesson]]);
      if (button(g, input, t('ui.results.continue'), VIEW_W / 2, 430, 22)) this.lesson++;
    } else if (this.rites) {
      this.drawCard(g, this.rites);
      if (button(g, input, t('ui.results.continue'), VIEW_W / 2, 430, 22)) this.rites = null;
    } else if (f.outcome) this.results(g, game, f.outcome);
    reticle(g, input.pos);
    g.endFrame();
  }

  private drawCard(g: Gfx, lines: readonly string[]): void {
    const r = { x: 240, y: 190, w: 800, h: 270 };
    g.rect(0, 0, VIEW_W, 720, hex('#000000', 0.5));
    parchment(g, r);
    let y = r.y + 44;
    for (const l of lines) y += g.textBlock(l, r.x + 30, y, r.w - 60, { size: 19, color: hex('#3a2a1a'), shadow: false }, 1.3) + 16;
  }

  private results(g: Gfx, game: Game, o: TriageOutcome): void {
    const r = { x: 200, y: 130, w: 880, h: 440 };
    g.rect(0, 0, VIEW_W, 720, hex('#000000', 0.55));
    parchment(g, r);
    const ink = { size: 18, color: hex('#3a2a1a'), shadow: false } as const;
    g.text(t('ui.triage.result', { rank: o.rank, saved: o.saved, savable: o.savable }), r.x + 30, r.y + 44, { ...ink, size: 22 });
    let y = r.y + 84;
    if (o.lost.length) y += g.textBlock(t('ui.triage.lost', { names: o.lost.join(', ') }), r.x + 30, y, r.w - 60, ink, 1.25) + 12;
    g.text(t('ui.triage.tags', { right: o.tagsRight, total: this.field.patients.length }), r.x + 30, y, ink);
    y += 30;
    for (const w of o.wrongTags.slice(0, 6)) {
      g.text(`${w.name}: ${w.given ? t(`ui.triage.tag.${w.given}`) : '—'} → ${t(`ui.triage.tag.${w.truth}`)}`, r.x + 44, y, { ...ink, size: 17, font: 'italic' });
      y += 26;
    }
    if (!this.done && button(g, game.input, t('ui.results.continue'), VIEW_W / 2, r.y + r.h - 24, 22)) {
      this.done = true;
      this.onDone(o, this.field);
    }
  }
}
