/**
 * The interview scene (CON-0231, CON-0232): the subject on a parchment sheet with places to examine,
 * the topic list, the notebook of evidence, and the transcript. Present a piece of evidence by
 * picking it in the notebook and then an answered topic. Conclude once enough has been found.
 *
 * The notebook is an evidence board (UIX-0192): clues are pinned notes, and each contradiction
 * exposed ties a red string from the clue to the statement it broke. Runs on the Ui kit, so arrows /
 * D-pad and Enter / A work every control. In a forensic examination the subject sheet takes a
 * magnifier (INP-0110): the wheel (or PageUp/PageDown, LB/RB) zooms 1–4× about the cursor.
 */
import type { Game, Scene } from '../core/scene';
import type { Vec } from '../core/math';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { InterviewSession, PALPATE, type InterviewDef, type InterviewResult } from '../surgery/interview';
import { Coverage } from '../surgery/coverage';
import { progress } from '../surgery/session';
import { heading } from '../ui/hudKit';
import { PALETTE, VIEW_W } from '../ui/layout';
import { Ui, inside, type Rect } from '../ui/kit';
import { focusRing, sealButton } from '../ui/controls';
import { panel, parchment, reticle } from '../ui/widgets';
import { drawBackdrop } from './backdrop';
import { STROH_FORENSIC, WITNESS_RETORTS } from '../content/barksDiscipline';
import { pickLine } from '../content/barks';
import { drawBodyChart, markFinding } from '../art/bodyChart';
import { drawEvidence, evidenceKind } from '../art/fieldArt';
import type { Backdrop } from '../content/story';
import { ChoiceScene } from './choice';
import { t } from '../i18n';

const SUBJECT = { x: 40, y: 110, w: 380, h: 450 };
const TOPICS = { x: 440, y: 110, w: 400, h: 450 };
const NOTES = { x: 860, y: 110, w: 380, h: 450 };
const LOG = { x: 40, y: 574, w: 1200, h: 70 };
export const ZOOM = { min: 1, max: 4, step: 0.5, ease: 10 };

const topicRect = (k: number): Rect => ({ x: TOPICS.x + 10, y: TOPICS.y + 44 + k * 48, w: TOPICS.w - 20, h: 42 });
const btn = (cx: number, cy: number, w = 240, h = 40): Rect => ({ x: cx - w / 2, y: cy - h / 2, w, h });

export class InterviewScene implements Scene {
  readonly session: InterviewSession;
  readonly ui = new Ui();
  /** Evidence picked to present, waiting for a topic. */
  presenting: string | null = null;
  /** The magnifier (forensics): target zoom, shown zoom, and the point it zooms about. */
  zoom = 1;
  private shown = 1;
  private anchor: Vec = { x: SUBJECT.x + SUBJECT.w / 2, y: SUBJECT.y + SUBJECT.h / 2 };
  private t = 0;
  private done = false;
  /** Where each notebook entry was laid out this frame (for the strings). */
  private noteAt = new Map<string, Rect>();
  /** Palpation (INP-0109): how much of each place the hand has felt, in sheet space. */
  readonly felt = new Map<string, Coverage>();
  private lastHand: Vec | null = null;

  constructor(
    def: InterviewDef,
    private backdrop: Backdrop,
    private onDone: (result: InterviewResult, session: InterviewSession) => void,
  ) {
    this.session = new InterviewSession(def);
  }

  private get forensic(): boolean {
    return !!this.session.def.candle;
  }

  /** A point on the subject sheet, through the magnifier. */
  private view(p: Vec): Vec {
    const z = this.shown;
    return { x: this.anchor.x + (p.x - this.anchor.x) * z, y: this.anchor.y + (p.y - this.anchor.y) * z };
  }

  private regionAt(at: readonly [number, number]): Vec {
    return this.view({ x: SUBJECT.x + at[0] * SUBJECT.w, y: SUBJECT.y + 40 + at[1] * (SUBJECT.h - 60) });
  }

  private askOrPresent(topicId: string): void {
    const s = this.session;
    if (this.presenting) {
      const hit = s.present(this.presenting, topicId);
      this.presenting = null;
      // The witness answers a presentation that proves nothing (NAR-0168); Stroh marks one that does.
      const last = s.log[s.log.length - 1];
      if (!hit && last && !last.speaker) {
        const who = s.def.topics.find((x) => x.id === topicId)?.speaker ?? '';
        s.log[s.log.length - 1] = { speaker: who, text: pickLine('witness', WITNESS_RETORTS)! };
      } else if (hit && this.forensic) this.stroh();
    } else s.ask(topicId);
  }

  /** Stroh, at the examination (NAR-0168). */
  private stroh(): void {
    this.session.log.push({ speaker: 'Inquisitor Stroh', text: pickLine('stroh-forensic', STROH_FORENSIC)! });
  }

  private openConclusions(game: Game): void {
    const cs = this.session.def.conclusions;
    game.push?.(
      new ChoiceScene({ x: 240, y: 200, w: 800, h: cs.length * 52 }, cs.map((c) => c.label), 0, (k) => this.session.conclude(cs[k].id), { layout: 'box', rowH: 50 }),
    );
  }

  /** The hand over the sheet: feel whichever place it is on, and examine it once enough is felt. */
  private palpate(at: Vec): void {
    if (!inside(at, SUBJECT)) return;
    const reach = progress.assists.bigHitboxes ? PALPATE.assistReach : PALPATE.reach;
    for (const r of this.session.def.regions ?? []) {
      if (this.session.examined.includes(r.id)) continue;
      const c = this.regionAt(r.at);
      const rad = PALPATE.radius * this.shown;
      if (Math.hypot(at.x - c.x, at.y - c.y) > rad + reach) continue;
      // Felt in the sheet's own space, so the magnifier changes the reach, not the work.
      const local = { x: (at.x - c.x) / this.shown, y: (at.y - c.y) / this.shown };
      let cov = this.felt.get(r.id);
      if (!cov) this.felt.set(r.id, (cov = new Coverage({ x: 0, y: 0 }, PALPATE.radius, 8)));
      cov.brush(local, reach);
      if (cov.fraction >= PALPATE.needed) this.session.examine(r.id);
    }
  }

  update(dt: number, game: Game): void {
    this.t += dt;
    const s = this.session;
    const was = s.candle / (s.def.candle ?? 1);
    s.tick(dt);
    const now = s.candle / (s.def.candle ?? 1);
    if (this.forensic && !s.result && ((was > 0.5 && now <= 0.5) || (was > 0.2 && now <= 0.2))) this.stroh();
    const input = game.input;
    const ui = this.ui;
    const live = !s.result;
    ui.begin();
    // The places to examine (only those on the sheet through the magnifier).
    for (const r of s.def.regions ?? []) {
      const p = this.regionAt(r.at);
      if (!inside(p, SUBJECT)) continue;
      // Enter / A examine at once; the mouse palpates (below), so a click alone does not.
      ui.button(`region:${r.id}`, { x: p.x - 18, y: p.y - 18, w: 36, h: 36 }, r.label, () => !input.released && s.examine(r.id), { enabled: live && !s.guttered });
    }
    s.topics().forEach((tp, k) =>
      ui.button(`topic:${tp.id}`, topicRect(k), tp.label, () => this.askOrPresent(tp.id), { enabled: live && !s.guttered && (!this.presenting || s.asked.includes(tp.id)) }),
    );
    let y = NOTES.y + 52;
    this.noteAt.clear();
    const note = (id: string, label: string, h: number) => {
      const r = { x: NOTES.x + 10, y: y - 20, w: NOTES.w - 20, h };
      this.noteAt.set(id, r);
      ui.button(`note:${id}`, r, label, () => (this.presenting = this.presenting === id ? null : id), { enabled: live });
      y += h + 4;
    };
    for (const id of s.held) note(id, s.def.evidence?.find((x) => x.id === id)?.label ?? s.def.regions?.find((x) => x.id === id)?.label ?? id, 28);
    for (const id of s.examined) {
      const reg = s.def.regions?.find((x) => x.id === id);
      if (reg) note(id, `— ${reg.label}`, 26);
    }
    if (!s.result) ui.button('conclude', btn(VIEW_W / 2, 684), t('ui.interview.conclude'), () => this.openConclusions(game), { enabled: s.canConclude });
    else
      ui.button('continue', btn(VIEW_W / 2 + 300, 684), t('ui.results.continue'), () => {
        if (this.done) return;
        this.done = true;
        this.onDone(s.result!, s);
      });
    ui.update(input, dt);
    if (input.actPressed('ui.back')) this.presenting = null;
    if (input.down && live && !s.guttered) {
      // Feel along the whole stroke since last frame, not just where the samples landed.
      const from = this.lastHand ?? input.pos;
      const n = Math.max(1, Math.ceil(Math.hypot(input.pos.x - from.x, input.pos.y - from.y) / 4));
      for (let i = 1; i <= n; i++) this.palpate({ x: from.x + ((input.pos.x - from.x) * i) / n, y: from.y + ((input.pos.y - from.y) * i) / n });
      this.lastHand = { ...input.pos };
    } else this.lastHand = null;

    // The magnifier (INP-0110): wheel over the sheet, or the bumpers, zoom about the cursor.
    if (this.forensic) {
      const over = inside(input.pos, SUBJECT);
      const dir = (over ? -Math.sign(input.wheel) : 0) + (input.actPressed('ui.tabNext') ? 1 : 0) - (input.actPressed('ui.tabPrev') ? 1 : 0);
      if (dir) {
        const at = over ? input.pos : { x: SUBJECT.x + SUBJECT.w / 2, y: SUBJECT.y + SUBJECT.h / 2 };
        // Keep the point under the cursor still as the zoom changes.
        const base = { x: this.anchor.x + (at.x - this.anchor.x) / this.shown, y: this.anchor.y + (at.y - this.anchor.y) / this.shown };
        this.zoom = Math.max(ZOOM.min, Math.min(ZOOM.max, this.zoom + dir * ZOOM.step));
        this.anchor = this.zoom === 1 ? { x: SUBJECT.x + SUBJECT.w / 2, y: SUBJECT.y + SUBJECT.h / 2 } : base;
      }
      this.shown += (this.zoom - this.shown) * Math.min(1, dt * ZOOM.ease);
    }
  }

  render(g: Gfx, game: Game): void {
    const s = this.session;
    const def = s.def;
    const ui = this.ui;
    g.beginWorld();
    drawBackdrop(g, this.backdrop, g.time);
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 'menu', defocus: 6 });
    heading(g, def.title, VIEW_W / 2, 44, 520, 1, 28);
    g.text(`${def.place} — ${def.question}`, VIEW_W / 2, 84, { size: 17, font: 'italic', color: hex(PALETTE.inkDim), align: 'center' });

    // The subject, and the places to examine.
    parchment(g, SUBJECT);
    const z = this.shown;
    g.pushClip(SUBJECT);
    drawBodyChart(g, (fx, fy) => this.regionAt([fx, fy]), z);
    for (const r of def.regions ?? []) {
      const n = ui.node(`region:${r.id}`);
      if (!n) continue;
      const p = { x: n.rect.x + 18, y: n.rect.y + 18 };
      const st = ui.state(n.id);
      const seen = s.examined.includes(r.id);
      g.circle(p.x, p.y, (st.focus ? 11 : 8) * Math.min(2, z), hex(seen ? '#6a8a50' : '#a0402a', st.focus ? 1 : 0.85));
      if (seen) markFinding(g, p, Math.min(2, z));
      const felt = this.felt.get(r.id)?.fraction ?? 0;
      if (!seen && felt > 0) g.arc(p.x, p.y, PALPATE.radius * z, 3, hex('#6a8a50', 0.8), Math.min(1, felt / PALPATE.needed));
      focusRing(g, n.rect, st.glow, this.t);
      if (st.focus || seen) g.text(r.label, p.x + 14, p.y + 5, { size: 16, color: hex('#3a2a1a'), shadow: false });
    }
    g.popClip();
    g.text(def.subject, SUBJECT.x + 16, SUBJECT.y + 28, { size: 17, color: hex('#3a2a1a'), shadow: false });
    if (this.forensic && z > 1.05) g.text(`×${this.zoom.toFixed(1)}`, SUBJECT.x + SUBJECT.w - 16, SUBJECT.y + 28, { size: 16, color: hex('#5a4030'), align: 'right', shadow: false });

    // Topics: ask, or — with evidence picked — present it against an answered one.
    panel(g, TOPICS);
    g.text(this.presenting ? t('ui.interview.present_to') : t('ui.interview.topics'), TOPICS.x + 16, TOPICS.y + 28, { size: 16, color: hex(PALETTE.gold) });
    s.topics().forEach((tp, k) => {
      const r = topicRect(k);
      const st = ui.state(`topic:${tp.id}`);
      const asked = s.asked.includes(tp.id);
      const exposed = s.exposed.includes(tp.id);
      g.rect(r.x, r.y, r.w, r.h, hex(st.focus && st.enabled ? PALETTE.blood : '#000000', st.focus && st.enabled ? 0.35 : 0.2));
      focusRing(g, r, st.glow, this.t);
      g.text(`${tp.label}${exposed ? '  ✕' : asked ? '  ·' : ''}`, r.x + 10, r.y + 27, { size: 17, color: hex(st.enabled ? PALETTE.ink : PALETTE.inkDim) });
    });

    // The evidence board: pinned clues.
    panel(g, NOTES);
    g.text(t('ui.interview.progress', { n: s.progress, needed: def.needed }), NOTES.x + 16, NOTES.y + 28, { size: 16, color: hex(PALETTE.gold) });
    for (const [id, r] of this.noteAt) {
      const st = ui.state(`note:${id}`);
      const picked = this.presenting === id;
      const finding = !s.held.includes(id);
      g.rect(r.x, r.y, r.w, r.h, hex(picked ? PALETTE.gold : st.focus ? PALETTE.blood : '#000000', picked ? 0.35 : st.focus ? 0.3 : finding ? 0.05 : 0.15));
      g.circle(r.x + 8, r.y + 8, 3, hex('#c0302a'));
      // The item itself, drawn on its note (ART-0225).
      const ev = s.def.evidence?.find((x) => x.id === id);
      if (ev) drawEvidence(g, evidenceKind(ev.label, ev.text), { x: r.x + r.w - 20, y: r.y + r.h / 2 }, 16);
      focusRing(g, r, st.glow, this.t);
      g.text(ui.node(`note:${id}`)?.label ?? id, r.x + (finding ? 20 : 16), r.y + 20, { size: 16, font: finding ? 'italic' : undefined, color: hex(finding ? PALETTE.inkDim : PALETTE.ink) });
    }
    // The red strings: each broken statement tied to the clue that broke it.
    for (const topic of s.exposed) {
      const c = def.contradictions?.find((x) => x.topic === topic && this.noteAt.has(x.evidence));
      const k = s.topics().findIndex((x) => x.id === topic);
      if (!c || k < 0) continue;
      const from = this.noteAt.get(c.evidence)!;
      const to = topicRect(k);
      g.line({ x: from.x + 8, y: from.y + 8 }, { x: to.x + to.w - 8, y: to.y + to.h / 2 }, 2, hex('#c0302a', 0.75));
    }

    // Forensics: the candle, burning down (CON-0241).
    if (def.candle) {
      const k = s.candle / def.candle;
      const cx = VIEW_W - 60;
      g.rect(cx - 6, 30, 12, 60, hex('#2a2018', 0.8));
      g.rect(cx - 6, 30 + 60 * (1 - k), 12, 60 * k, hex('#e8dcc0'));
      if (!s.result && k > 0) g.glow(cx, 26 + 60 * (1 - k), 16 + Math.sin(this.t * 9) * 2, hex('#ffc070', 0.7));
      if (s.guttered && !s.result) g.text(t('ui.forensic.guttered'), VIEW_W / 2, 560, { size: 18, font: 'italic', color: hex('#d07050'), align: 'center' });
    }

    // The transcript: the last thing said.
    panel(g, LOG);
    const last = s.log[s.log.length - 1];
    if (last) g.textBlock(last.speaker ? `${last.speaker}: ${last.text}` : last.text, LOG.x + 20, LOG.y + 28, LOG.w - 40, { size: 18, color: hex(PALETTE.ink), shadow: false }, 1.25);

    if (s.result) {
      const r = s.result;
      g.text(t('ui.interview.result', { rank: r.rank, found: r.found, contradictions: r.contradictions }), VIEW_W / 2 - 300, 690, { size: 18, color: hex(r.correct ? PALETTE.gold : '#d07050') });
    }
    for (const id of ['conclude', 'continue']) {
      const n = ui.node(id);
      if (n) sealButton(g, n, ui.state(id), this.t, 24);
    }
    reticle(g, game.input.pos);
    g.endFrame();
  }
}
