/**
 * The interview scene (CON-0231, CON-0232): the subject on a parchment sheet with places to examine,
 * the topic list, the notebook of evidence, and the transcript. Present a piece of evidence by
 * picking it in the notebook and then an answered topic. Conclude once enough has been found.
 */
import type { Game, Scene } from '../core/scene';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { InterviewSession, type InterviewDef, type InterviewResult } from '../surgery/interview';
import { heading } from '../ui/hudKit';
import { PALETTE, VIEW_W } from '../ui/layout';
import { button, inRect, panel, parchment, reticle } from '../ui/widgets';
import { drawBackdrop } from './backdrop';
import type { Backdrop } from '../content/story';
import { ChoiceScene } from './choice';
import { t } from '../i18n';

const SUBJECT = { x: 40, y: 110, w: 380, h: 450 };
const TOPICS = { x: 440, y: 110, w: 400, h: 450 };
const NOTES = { x: 860, y: 110, w: 380, h: 450 };
const LOG = { x: 40, y: 574, w: 1200, h: 70 };

export class InterviewScene implements Scene {
  readonly session: InterviewSession;
  /** Evidence picked to present, waiting for a topic. */
  private presenting: string | null = null;
  private t = 0;
  private done = false;

  constructor(
    def: InterviewDef,
    private backdrop: Backdrop,
    private onDone: (result: InterviewResult, session: InterviewSession) => void,
  ) {
    this.session = new InterviewSession(def);
  }

  update(dt: number, game: Game): void {
    this.t += dt;
    this.session.tick(dt);
    const i = game.input;
    if (i.actPressed('ui.back')) this.presenting = null;
  }

  private askOrPresent(topicId: string): void {
    if (this.presenting) {
      this.session.present(this.presenting, topicId);
      this.presenting = null;
    } else this.session.ask(topicId);
  }

  private openConclusions(game: Game): void {
    const cs = this.session.def.conclusions;
    game.push?.(
      new ChoiceScene({ x: 240, y: 200, w: 800, h: cs.length * 52 }, cs.map((c) => c.label), 0, (k) => this.session.conclude(cs[k].id), { layout: 'box', rowH: 50 }),
    );
  }

  render(g: Gfx, game: Game): void {
    const s = this.session;
    const def = s.def;
    const input = game.input;
    g.beginWorld();
    drawBackdrop(g, this.backdrop, g.time);
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 'menu', defocus: 6 });
    heading(g, def.title, VIEW_W / 2, 44, 520, 1, 28);
    g.text(`${def.place} — ${def.question}`, VIEW_W / 2, 84, { size: 17, font: 'italic', color: hex(PALETTE.inkDim), align: 'center' });

    // The subject, and the places to examine.
    parchment(g, SUBJECT);
    g.text(def.subject, SUBJECT.x + 16, SUBJECT.y + 28, { size: 17, color: hex('#3a2a1a'), shadow: false });
    g.ellipse(SUBJECT.x + SUBJECT.w / 2, SUBJECT.y + 150, 70, 90, 0, hex('#6a5040', 0.25));
    g.ellipse(SUBJECT.x + SUBJECT.w / 2, SUBJECT.y + 330, 120, 130, 0, hex('#6a5040', 0.18));
    for (const r of def.regions ?? []) {
      const x = SUBJECT.x + r.at[0] * SUBJECT.w;
      const y = SUBJECT.y + 40 + r.at[1] * (SUBJECT.h - 60);
      const seen = s.examined.includes(r.id);
      const hot = Math.hypot(input.pos.x - x, input.pos.y - y) < 18;
      g.circle(x, y, hot ? 11 : 8, hex(seen ? '#6a8a50' : '#a0402a', hot ? 1 : 0.85));
      if (hot || seen) g.text(r.label, x + 14, y + 5, { size: 16, color: hex('#3a2a1a'), shadow: false });
      if (hot && input.pressed && !s.result) s.examine(r.id);
    }

    // Topics: ask, or — with evidence picked — present it against an answered one.
    panel(g, TOPICS);
    g.text(this.presenting ? t('ui.interview.present_to') : t('ui.interview.topics'), TOPICS.x + 16, TOPICS.y + 28, { size: 16, color: hex(PALETTE.gold) });
    s.topics().forEach((tp, k) => {
      const r = { x: TOPICS.x + 10, y: TOPICS.y + 44 + k * 48, w: TOPICS.w - 20, h: 42 };
      const asked = s.asked.includes(tp.id);
      const exposed = s.exposed.includes(tp.id);
      const usable = !s.result && (!this.presenting || asked);
      const hover = usable && inRect(input.pos, r);
      g.rect(r.x, r.y, r.w, r.h, hex(hover ? PALETTE.blood : '#000000', hover ? 0.35 : 0.2));
      g.text(`${tp.label}${exposed ? '  ✕' : asked ? '  ·' : ''}`, r.x + 10, r.y + 27, { size: 17, color: hex(usable ? PALETTE.ink : PALETTE.inkDim) });
      if (hover && input.pressed) this.askOrPresent(tp.id);
    });

    // Notebook: findings and evidence.
    panel(g, NOTES);
    g.text(t('ui.interview.progress', { n: s.progress, needed: def.needed }), NOTES.x + 16, NOTES.y + 28, { size: 16, color: hex(PALETTE.gold) });
    let y = NOTES.y + 52;
    for (const id of s.held) {
      const e = def.evidence?.find((x) => x.id === id);
      const label = e?.label ?? def.regions?.find((x) => x.id === id)?.label ?? id;
      const r = { x: NOTES.x + 10, y: y - 20, w: NOTES.w - 20, h: 28 };
      const hover = !s.result && inRect(input.pos, r);
      const picked = this.presenting === id;
      g.rect(r.x, r.y, r.w, r.h, hex(picked ? PALETTE.gold : hover ? PALETTE.blood : '#000000', picked ? 0.35 : hover ? 0.3 : 0.15));
      g.text(label, r.x + 10, r.y + 20, { size: 16, color: hex(PALETTE.ink) });
      if (hover && input.pressed) this.presenting = picked ? null : id;
      y += 32;
    }
    // Findings may be presented too.
    for (const id of s.examined) {
      const reg = def.regions?.find((x) => x.id === id);
      if (!reg) continue;
      const r = { x: NOTES.x + 10, y: y - 20, w: NOTES.w - 20, h: 26 };
      const hover = !s.result && inRect(input.pos, r);
      const picked = this.presenting === id;
      if (picked || hover) g.rect(r.x, r.y, r.w, r.h, hex(picked ? PALETTE.gold : PALETTE.blood, picked ? 0.35 : 0.3));
      g.text(`— ${reg.label}`, NOTES.x + 20, y, { size: 16, font: 'italic', color: hex(PALETTE.inkDim) });
      if (hover && input.pressed) this.presenting = picked ? null : id;
      y += 28;
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

    if (!s.result) {
      if (button(g, input, t('ui.interview.conclude'), VIEW_W / 2, 684, 24, s.canConclude)) this.openConclusions(game);
    } else {
      const r = s.result;
      g.text(t('ui.interview.result', { rank: r.rank, found: r.found, contradictions: r.contradictions }), VIEW_W / 2 - 300, 690, { size: 18, color: hex(r.correct ? PALETTE.gold : '#d07050') });
      if (!this.done && button(g, input, t('ui.results.continue'), VIEW_W / 2 + 300, 684, 24)) {
        this.done = true;
        this.onDone(r, s);
      }
    }
    reticle(g, input.pos);
    g.endFrame();
  }
}
