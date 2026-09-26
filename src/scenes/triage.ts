/**
 * The triage scene (CON-0226, CON-0229, CON-0230): stretchers in a grid, each with its life running
 * down as a ring (UIX-0190); pick one to read its wounds and signs, tag it, and set your hands to a
 * procedure. Tagging a patient Beyond Help gives the last rites. When the wagons come, the results
 * show who was lost and which tags were wrong.
 *
 * Input (INP-0108): a press on the stretcher already picked cycles its tag; holding a stretcher half a
 * second opens the tag ring round it; PageUp/PageDown (LB/RB) step the picked stretcher's tag. The
 * scene runs on the Ui kit, so arrows / D-pad move the one highlight and Enter / A activates.
 */
import type { Game, Scene } from '../core/scene';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { FIELD_PROCEDURES, TRIAGE, TRIAGE_TAGS, TriageField, type TriageOutcome, type TriageScenario, type TriageTag } from '../surgery/triage';
import { heading } from '../ui/hudKit';
import { PALETTE, VIEW_W } from '../ui/layout';
import { Ui, type Rect } from '../ui/kit';
import { focusRing, sealButton } from '../ui/controls';
import { panel, parchment, reticle } from '../ui/widgets';
import { drawBackdrop } from './backdrop';
import { drawCasualty } from '../art/fieldArt';
import type { Backdrop } from '../content/story';
import { t } from '../i18n';
import { ILSE_INCOMING } from '../content/barksDiscipline';
import { pickLine } from '../content/barks';

const GRID = { x: 40, y: 104, cols: 5, w: 232, h: 132, gap: 8 };
const DETAIL = { x: 40, y: 390, w: 760, h: 220 };
const ACTIONS = { x: 816, y: 390, w: 424, h: 220 };
const LOG = { x: 40, y: 620, w: 1200, h: 40 };
const MAP = { x: 1080, y: 20, w: 160, h: 72 };
/** Seconds a stretcher is held to open the tag ring. */
const LONG_PRESS = 0.5;

export const TAG_COLOR: Record<TriageTag, string> = { immediate: '#c03a2a', delayed: '#d0a030', walking: '#5a9a50', beyond: '#3a3a44' };

const cardRect = (i: number): Rect => ({ x: GRID.x + (i % GRID.cols) * (GRID.w + GRID.gap), y: GRID.y + Math.floor(i / GRID.cols) * (GRID.h + GRID.gap), w: GRID.w, h: GRID.h });
const tagRect = (k: number): Rect => ({ x: ACTIONS.x + 12 + (k % 2) * 202, y: ACTIONS.y + 38 + Math.floor(k / 2) * 40, w: 196, h: 34 });
const procRect = (k: number): Rect => ({ x: ACTIONS.x + 12 + k * 136, y: ACTIONS.y + 152, w: 130, h: 36 });
const btn = (cx: number, cy: number, w = 220, h = 40): Rect => ({ x: cx - w / 2, y: cy - h / 2, w, h });

export class TriageScene implements Scene {
  readonly field: TriageField;
  readonly ui = new Ui();
  selected: string | null = null;
  /** Tutorial prompt showing (CON-0230); the field waits while it is up. */
  private lesson = 0;
  /** The last rites being said (CON-0229); the field waits while they are. */
  private rites: readonly [string, string] | null = null;
  /** The tag ring open round a stretcher (a long press). */
  radial: string | null = null;
  private holdOn: { id: string; t: number } | null = null;
  private done = false;
  private time = 0;

  constructor(
    scenario: TriageScenario,
    private backdrop: Backdrop,
    private onDone: (outcome: TriageOutcome, field: TriageField) => void,
  ) {
    this.field = new TriageField(scenario);
  }

  private get paused(): boolean {
    return this.lesson < (this.field.scenario.tutorial?.length ?? 0) || this.rites !== null || this.radial !== null;
  }

  private tag(id: string, tag: TriageTag): void {
    const said = this.field.tag(id, tag);
    if (said) this.rites = said;
  }

  /** Cycle a stretcher's tag (tap-to-tag): untagged starts at Immediate. */
  private cycle(id: string, dir: 1 | -1 = 1): void {
    const p = this.field.get(id);
    if (!p || p.state !== 'waiting') return;
    const i = p.tag ? TRIAGE_TAGS.indexOf(p.tag) : dir > 0 ? -1 : 0;
    this.tag(id, TRIAGE_TAGS[(i + dir + TRIAGE_TAGS.length) % TRIAGE_TAGS.length]);
  }

  update(dt: number, game: Game): void {
    this.time += dt;
    const f = this.field;
    const input = game.input;
    const ui = this.ui;
    ui.begin();
    const tut = f.scenario.tutorial ?? [];
    if (this.lesson < tut.length) {
      ui.button('lesson', btn(VIEW_W / 2, 430), t('ui.results.continue'), () => this.lesson++);
    } else if (this.rites) {
      ui.button('rites', btn(VIEW_W / 2, 430), t('ui.results.continue'), () => (this.rites = null));
    } else if (f.outcome) {
      ui.button('done', btn(VIEW_W / 2, 546), t('ui.results.continue'), () => {
        if (this.done) return;
        this.done = true;
        this.onDone(f.outcome!, f);
      });
    } else if (this.radial) {
      const i = f.patients.findIndex((p) => p.card.id === this.radial);
      const c = cardRect(i);
      const id = this.radial;
      TRIAGE_TAGS.forEach((tag, k) => {
        const a = -Math.PI / 2 + (k * Math.PI) / 2;
        ui.button(`ring:${tag}`, btn(c.x + c.w / 2 + Math.cos(a) * 90, c.y + c.h / 2 + Math.sin(a) * 70, 150, 34), t(`ui.triage.tag.${tag}`), () => {
          this.tag(id, tag);
          this.radial = null;
        });
      });
      if (input.actPressed('ui.back')) this.radial = null;
    } else {
      f.patients.forEach((p, i) => {
        if (!p.arrived) return;
        ui.button(`card:${p.card.id}`, cardRect(i), p.card.name, () => {
          if (this.holdOn?.id === p.card.id && this.holdOn.t >= LONG_PRESS) return;
          if (this.selected === p.card.id) this.cycle(p.card.id);
          else this.selected = p.card.id;
        });
      });
      const sel = this.selected ? f.get(this.selected) : undefined;
      const usable = !!sel && sel.state === 'waiting';
      TRIAGE_TAGS.forEach((tag, k) => ui.button(`tag:${tag}`, tagRect(k), t(`ui.triage.tag.${tag}`), () => sel && this.tag(sel.card.id, tag), { enabled: usable }));
      FIELD_PROCEDURES.forEach((proc, k) =>
        ui.button(`proc:${proc}`, procRect(k), t(`ui.triage.proc.${proc}`), () => sel && f.treat(sel.card.id, proc), { enabled: usable && sel!.tag !== 'beyond' && !f.busy }),
      );
      ui.button('wagons', btn(VIEW_W / 2, 690, 300), t('ui.triage.wagons'), () => f.end());
      if (sel && input.actPressed('ui.tabNext')) this.cycle(sel.card.id, 1);
      if (sel && input.actPressed('ui.tabPrev')) this.cycle(sel.card.id, -1);
      if (input.actPressed('ui.back')) this.selected = null;
    }
    ui.update(input, dt);
    // A long press on a stretcher opens the tag ring round it.
    const hovered = ui.hover?.startsWith('card:') ? ui.hover.slice(5) : null;
    if (input.down && hovered && !this.radial) {
      this.holdOn = this.holdOn?.id === hovered ? { id: hovered, t: this.holdOn.t + dt } : { id: hovered, t: 0 };
      if (this.holdOn.t >= LONG_PRESS && !this.paused) {
        this.selected = hovered;
        this.radial = hovered;
      }
    } else if (!input.down) this.holdOn = null;
    if (!this.paused) {
      const before = f.present().length;
      f.tick(dt);
      // Ilse calls each stretcher in (NAR-0168).
      for (let i = before; i < f.present().length; i++) f.log.push(`Ilse: ${pickLine('ilse-incoming', ILSE_INCOMING)}`);
    }
  }

  render(g: Gfx, game: Game): void {
    const f = this.field;
    const sc = f.scenario;
    const ui = this.ui;
    g.beginWorld();
    drawBackdrop(g, this.backdrop, g.time);
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 'menu', defocus: 6 });
    heading(g, sc.title, VIEW_W / 2, 44, 520, 1, 28);
    g.text(sc.place, VIEW_W / 2, 80, { size: 17, font: 'italic', color: hex(PALETTE.inkDim), align: 'center' });
    g.text(t('ui.triage.clock', { s: Math.ceil(f.clock) }), 40, 44, { size: 18, color: hex(f.clock < 30 ? '#d07050' : PALETTE.gold) });
    this.drawMap(g);

    // The stretchers.
    f.patients.forEach((p, i) => {
      const r = cardRect(i);
      if (!p.arrived) {
        g.rect(r.x, r.y, r.w, r.h, hex('#000000', 0.15));
        return;
      }
      const st = ui.state(`card:${p.card.id}`);
      const sel = this.selected === p.card.id;
      panel(g, r);
      if (sel) g.rect(r.x, r.y, r.w, r.h, hex(PALETTE.gold, 0.2));
      focusRing(g, r, Math.max(st.glow, st.focus ? 1 : 0), this.time);
      g.text(p.card.name, r.x + 12, r.y + 28, { size: 17, color: hex(p.state === 'dead' ? PALETTE.inkDim : PALETTE.ink) });
      // The casualty on the stretcher (ART-0224).
      drawCasualty(g, { x: r.x + 168, y: r.y + 36, w: 56, h: 40 }, i, p.state === 'dead');
      if (p.tag) {
        // The tag ribbon (ART-0224): a coloured band across the card's foot.
        g.rect(r.x + 12, r.y + 42, 150, 26, hex(TAG_COLOR[p.tag], 0.9));
        g.text(t(`ui.triage.tag.${p.tag}`), r.x + 20, r.y + 61, { size: 16, color: hex('#f4ecd8'), shadow: false });
      }
      const status = p.state === 'dead' ? t('ui.triage.dead') : p.state === 'stable' ? t('ui.triage.stable') : f.busy?.id === p.card.id ? t('ui.triage.working') : '';
      if (status) g.text(status, r.x + 12, r.y + 100, { size: 16, font: 'italic', color: hex(p.state === 'dead' ? '#d07050' : PALETTE.inkDim) });
      // Time to deterioration (UIX-0190): a ring that empties, pulsing red once the patient is failing.
      if (p.state === 'waiting' && p.card.life < 999) {
        const k = p.life / p.card.life;
        const failing = k < TRIAGE.failing;
        const cx = r.x + r.w - 32;
        const cy = r.y + r.h - 34;
        g.arc(cx, cy, 18, 5, hex('#000000', 0.45));
        g.arc(cx, cy, 18, 5, hex(failing ? '#e05030' : '#c8a060', failing ? 0.6 + 0.4 * Math.sin(this.time * 8) : 1), k);
      }
      if (this.holdOn?.id === p.card.id && this.holdOn.t > 0.1 && !this.radial) g.arc(r.x + r.w / 2, r.y + r.h / 2, 30, 3, hex(PALETTE.gold, 0.7), Math.min(1, this.holdOn.t / LONG_PRESS));
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
      const r = tagRect(k);
      const st = ui.state(`tag:${tag}`);
      g.rect(r.x, r.y, r.w, r.h, hex(TAG_COLOR[tag], p?.tag === tag ? 0.95 : st.focus ? 0.7 : 0.4));
      focusRing(g, r, st.glow, this.time);
      g.text(t(`ui.triage.tag.${tag}`), r.x + 10, r.y + 24, { size: 17, color: hex(st.enabled ? '#f4ecd8' : PALETTE.inkDim), shadow: false });
    });
    g.text(t('ui.triage.treat'), ACTIONS.x + 16, ACTIONS.y + 140, { size: 16, color: hex(PALETTE.gold) });
    FIELD_PROCEDURES.forEach((proc, k) => {
      const r = procRect(k);
      const st = ui.state(`proc:${proc}`);
      const doing = f.busy?.id === p?.card.id && f.busy?.proc === proc;
      const had = !!p?.done.includes(proc);
      g.rect(r.x, r.y, r.w, r.h, hex(doing ? PALETTE.gold : st.focus ? PALETTE.blood : '#000000', doing ? 0.5 : st.focus ? 0.4 : 0.25));
      focusRing(g, r, st.glow, this.time);
      g.text(`${t(`ui.triage.proc.${proc}`)}${had ? ' ✓' : ''}`, r.x + 10, r.y + 25, { size: 16, color: hex(st.enabled || had ? PALETTE.ink : PALETTE.inkDim) });
    });

    // The last thing that happened.
    panel(g, LOG);
    g.text(f.log[f.log.length - 1] ?? '', LOG.x + 16, LOG.y + 27, { size: 17, color: hex(PALETTE.ink) });
    const wagons = ui.node('wagons');
    if (wagons) sealButton(g, wagons, ui.state('wagons'), this.time, 24);

    // Overlays: the lesson, the last rites, the tag ring, the results.
    const tut = sc.tutorial ?? [];
    if (this.lesson < tut.length) this.card(g, [tut[this.lesson]], 'lesson');
    else if (this.rites) this.card(g, this.rites, 'rites');
    else if (this.radial) {
      g.rect(0, 0, VIEW_W, 720, hex('#000000', 0.35));
      for (const tag of TRIAGE_TAGS) {
        const n = ui.node(`ring:${tag}`);
        if (!n) continue;
        const st = ui.state(n.id);
        g.rect(n.rect.x, n.rect.y, n.rect.w, n.rect.h, hex(TAG_COLOR[tag], st.focus ? 1 : 0.8));
        focusRing(g, n.rect, Math.max(st.glow, st.focus ? 1 : 0), this.time);
        g.text(n.label, n.rect.x + n.rect.w / 2, n.rect.y + 23, { size: 17, color: hex('#f4ecd8'), align: 'center', shadow: false });
      }
    } else if (f.outcome) this.results(g, f.outcome);
    reticle(g, game.input.pos);
    g.endFrame();
  }

  /** The field at a glance (UIX-0190): every stretcher as a dot, coloured by its tag. */
  private drawMap(g: Gfx): void {
    panel(g, MAP);
    this.field.patients.forEach((p, i) => {
      if (!p.arrived) return;
      const x = MAP.x + 16 + (i % 5) * 32;
      const y = MAP.y + 22 + Math.floor(i / 5) * 28;
      const c = p.state === 'dead' ? '#5a5650' : p.state === 'stable' ? '#9fd3a8' : p.tag ? TAG_COLOR[p.tag] : '#e8dcc0';
      g.circle(x, y, this.selected === p.card.id ? 9 : 7, hex(c));
    });
  }

  private card(g: Gfx, lines: readonly string[], button: string): void {
    const r = { x: 240, y: 190, w: 800, h: 270 };
    g.rect(0, 0, VIEW_W, 720, hex('#000000', 0.5));
    parchment(g, r);
    let y = r.y + 44;
    for (const l of lines) y += g.textBlock(l, r.x + 30, y, r.w - 60, { size: 19, color: hex('#3a2a1a'), shadow: false }, 1.3) + 16;
    const n = this.ui.node(button);
    if (n) sealButton(g, n, this.ui.state(button), this.time, 24);
  }

  private results(g: Gfx, o: TriageOutcome): void {
    const r = { x: 200, y: 130, w: 880, h: 450 };
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
    const n = this.ui.node('done');
    if (n) sealButton(g, n, this.ui.state('done'), this.time, 24);
  }
}
