/**
 * The Trials of the Guild board (UIX-0186, UIX-0187, UIX-0189, ART-0062): a guild notice board, one
 * tier per tab, each trial a pinned bill with its patient, its rules as wax seals, and the best medal
 * stamped on it. Locked bills say what opens them. A bill starts its trial; the board is where the
 * player comes back to. Opened from Extras once Chapter II is done (CON-0096).
 */
import type { Game, Scene } from '../core/scene';
import { t } from '../i18n';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { VIEW_W } from '../ui/layout';
import { Ui, type Rect } from '../ui/kit';
import { focusRing, sealButton, tab } from '../ui/controls';
import { heading } from '../ui/hudKit';
import { parchment, reticle } from '../ui/widgets';
import { drawSeal } from '../ui/seals';
import { drawEvidence, type EvidenceKind } from '../art/fieldArt';
import { dailySeed, loomCode, loomOp, loomVerses } from '../content/challenge';
import { drawBackdrop } from './backdrop';
import { playOperation } from './flow';
import { TriageScene } from './triage';
import { InterviewScene } from './interview';
import { ExtrasScene } from './extras';
import { progress } from '../surgery/session';
import { storeProgress } from '../surgery/progress';
import type { Rank } from '../surgery/types';
import { flags } from '../content/flags';
import { TIER_UNLOCK, TRIAL_TIERS, TRIALS, medalFor, tierOpen, trialOpen, trialRun, type Medal, type Trial, type TrialRules, type TrialTier } from '../content/trials';

const BOARD = { x: 60, y: 150, w: 1160, h: 500 };
const MEDAL_INK: Record<Medal, string> = { bronze: '#b0703a', silver: '#c8ccd4', gold: '#f0c850', saint: '#fff4d0' };
const RANK_ORDER: readonly Rank[] = ['C', 'B', 'A', 'S', 'XS'];

/** The seals a trial's rules put on its bill and in the HUD corner (UIX-0187). */
export function ruleSeals(r: TrialRules): string[] {
  const out: string[] = [];
  if (r.time && r.time !== 1) out.push(t('ui.trials.rule.time', { pct: Math.round(r.time * 100) }));
  if (r.drain && r.drain !== 1) out.push(t('ui.trials.rule.drain', { pct: Math.round(r.drain * 100) }));
  if (r.noLitany) out.push(t('ui.trials.rule.no_litany'));
  if (r.noLens) out.push(t('ui.trials.rule.no_lens'));
  if (r.noSalve) out.push(t('ui.trials.rule.no_salve'));
  if (r.oneLife) out.push(t('ui.trials.rule.one_life'));
  if (r.mirrored) out.push(t('ui.trials.rule.mirrored'));
  if (r.silent) out.push(t('ui.trials.rule.silent'));
  if (r.muted) out.push(t('ui.trials.rule.muted'));
  for (const m of r.mutators ?? []) out.push(t(`ui.trials.rule.${m}`));
  return out;
}

/** The Symptom Loom's twelve verses as woodcut roundels (ART-0213). */
const LOOM_ICON: Record<string, EvidenceKind> = { brawl: 'knife', arrows: 'quill', powder: 'candle', plague: 'vial', brood: 'tooth', hexstone: 'seal', curse: 'letter', frost: 'coin', troll: 'bone', bone: 'bone', worms: 'ribbon', growth: 'key' };

export function drawRoundel(g: Gfx, id: string, x: number, y: number, r = 26): void {
  g.circle(x, y, r, hex('#3a2616'));
  g.arc(x, y, r - 2, 2, hex('#c8a060', 0.9));
  drawEvidence(g, LOOM_ICON[id] ?? 'letter', { x, y }, r * 0.9);
}

type BoardTab = TrialTier | 'loom';
const TABS: readonly BoardTab[] = [...TRIAL_TIERS, 'loom'];

export class TrialsScene implements Scene {
  readonly menuPage = true;
  readonly ui = new Ui('trials');
  tier: BoardTab = 'journeyman';
  private time = 0;

  /** A fresh seed for "a random Loom", fixed while the board is open. */
  private readonly randomSeed = (Date.now() * 2654435761) >>> 0;

  private tabOpen(tr: BoardTab): boolean {
    return tr === 'journeyman' || (tr === 'loom' ? progress.chaptersCleared >= 2 : tierOpen(progress, tr));
  }

  private cols(): number {
    return this.tier === 'disciplines' ? 4 : 3;
  }

  private billRect(i: number): Rect {
    const cols = this.cols();
    const gap = 16;
    const w = (BOARD.w - 40 - gap * (cols - 1)) / cols;
    const h = 220;
    return { x: BOARD.x + 20 + (i % cols) * (w + gap), y: BOARD.y + 24 + Math.floor(i / cols) * (h + gap), w, h };
  }

  private start(game: Game, x: Trial): void {
    const back = () => game.go(Object.assign(new TrialsScene(), { tier: x.tier }));
    const record = (rank: Rank, score: number) => {
      const prev = progress.xBest[x.id];
      if (!prev || RANK_ORDER.indexOf(rank) > RANK_ORDER.indexOf(prev.rank) || (prev.rank === rank && score > prev.score)) progress.xBest[x.id] = { rank, score, time: 0 };
      storeProgress(progress);
      back();
    };
    if (x.triage) return game.go(new TriageScene(x.triage, 'camp', (o) => record(o.rank, o.score)));
    if (x.interview) return game.go(new InterviewScene(x.interview, x.interview.candle ? 'tent' : 'hospice', (r) => record(r.rank, r.score)));
    const run = trialRun(x, {}, progress.lost ?? []);
    if (run) playOperation(game, run.def, back, back, false, { ...run.opts, seals: ruleSeals(x.rules) });
  }

  update(dt: number, game: Game): void {
    this.time += dt;
    const ui = this.ui;
    ui.begin();
    TABS.forEach((tr, k) =>
      ui.add({ id: `tab:${tr}`, kind: 'tab', rect: { x: BOARD.x + k * 194, y: 96, w: 186, h: 40 }, label: t(`ui.trials.tier.${tr}`), on: this.tier === tr, onActivate: () => (this.tier = tr), enabled: this.tabOpen(tr) }),
    );
    if (this.tier === 'loom') {
      const back = () => game.go(Object.assign(new TrialsScene(), { tier: 'loom' as BoardTab }));
      const today = dailySeed(new Date());
      ui.button('bill:daily', this.billRect(0), t('ui.trials.loom_daily'), () => playOperation(game, loomOp(today), back, back, false, { challenge: 'loom-daily' }), { enabled: this.tabOpen('loom') });
      ui.button('bill:random', this.billRect(1), t('ui.trials.loom_random'), () => playOperation(game, loomOp(this.randomSeed), back, back, false, { challenge: 'loom' }), { enabled: this.tabOpen('loom') });
    } else {
      const list = TRIALS.filter((x) => x.tier === this.tier);
      list.forEach((x, i) => ui.button(`bill:${x.id}`, this.billRect(i), x.title, () => this.start(game, x), { enabled: trialOpen(progress, x, flags) }));
    }
    ui.button('back', { x: VIEW_W / 2 - 110, y: 664, w: 220, h: 40 }, t('ui.common.back'), () => game.go(new ExtrasScene()));
    const input = game.input;
    const step = input.actPressed('ui.tabNext') ? 1 : input.actPressed('ui.tabPrev') ? -1 : 0;
    if (step) {
      const open = TABS.filter((tr) => this.tabOpen(tr));
      this.tier = open[(open.indexOf(this.tier) + step + open.length) % open.length];
    }
    ui.update(input, dt);
    if (input.actPressed('ui.back')) game.go(new ExtrasScene());
  }

  /** The Loom's two bills: today's weave for everyone, and one of your own (ART-0213 roundels). */
  private drawLoom(g: Gfx): void {
    const ui = this.ui;
    const bills: [string, number, string][] = [
      ['daily', dailySeed(new Date()), t('ui.trials.loom_daily_blurb')],
      ['random', this.randomSeed, t('ui.trials.loom_random_blurb')],
    ];
    bills.forEach(([id, seed, blurb], i) => {
      const r = this.billRect(i);
      const st = ui.state(`bill:${id}`);
      parchment(g, r);
      focusRing(g, r, Math.max(st.glow, st.focus ? 1 : 0), this.time);
      g.text(ui.node(`bill:${id}`)?.label ?? '', r.x + 14, r.y + 34, { size: 19, color: hex('#3a2a1a'), shadow: false });
      g.textBlock(blurb, r.x + 14, r.y + 62, r.w - 28, { size: 16, font: 'italic', color: hex('#3a2a1a'), shadow: false }, 1.25);
      loomVerses(seed).forEach((v, k) => {
        drawRoundel(g, v.id, r.x + 46 + k * 70, r.y + r.h - 50);
        g.text(v.name, r.x + 46 + k * 70, r.y + r.h - 12, { size: 16, color: hex('#3a2a1a'), align: 'center', shadow: false });
      });
      if (id === 'daily') g.text(loomCode(seed), r.x + r.w - 14, r.y + 34, { size: 16, color: hex('#5a4030'), align: 'right', shadow: false });
    });
  }

  render(g: Gfx, game: Game): void {
    const ui = this.ui;
    g.beginWorld();
    drawBackdrop(g, 'guildhall', g.time);
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 'menu', defocus: 8 });
    heading(g, t('ui.trials.title'), VIEW_W / 2, 56, 560, 1, 32);
    for (const tr of TABS) {
      const n = ui.node(`tab:${tr}`);
      if (n) tab(g, n, ui.state(n.id), this.time, this.tier === tr, 20);
    }
    // The notice board: oak planks, and the bills pinned on it.
    g.rect(BOARD.x, BOARD.y, BOARD.w, BOARD.h, hex('#3a2616'));
    for (let i = 1; i < 6; i++) g.line({ x: BOARD.x, y: BOARD.y + (BOARD.h * i) / 6 }, { x: BOARD.x + BOARD.w, y: BOARD.y + (BOARD.h * i) / 6 }, 2, hex('#1e140c', 0.6));
    g.rectLine(BOARD.x, BOARD.y, BOARD.w, BOARD.h, 3, hex('#6a4a2a'));
    if (this.tier === 'loom') this.drawLoom(g);
    const list = this.tier === 'loom' ? [] : TRIALS.filter((x) => x.tier === this.tier);
    if (this.tier !== 'loom' && !tierOpen(progress, this.tier)) g.text(this.tier === 'journeyman' ? t('ui.trials.locked_first') : t('ui.trials.locked_tier', { n: TIER_UNLOCK }), VIEW_W / 2, BOARD.y + BOARD.h / 2, { size: 20, font: 'italic', color: hex('#e8dcc0'), align: 'center' });
    list.forEach((x, i) => {
      const r = this.billRect(i);
      const st = ui.state(`bill:${x.id}`);
      const open = st.enabled;
      const tilt = ((i * 37) % 7) - 3;
      g.save();
      g.translate(0, tilt * 0.4);
      parchment(g, r);
      if (!open) g.rect(r.x, r.y, r.w, r.h, hex('#1a120a', 0.55));
      g.circle(r.x + r.w / 2, r.y + 8, 5, hex('#9a2a20'));
      focusRing(g, r, Math.max(st.glow, st.focus ? 1 : 0), this.time);
      const ink = hex(open ? '#3a2a1a' : '#6a5a48');
      const secret = !!x.secret && !flags.truthy(x.secret);
      g.text(secret ? '???' : x.title, r.x + 14, r.y + 34, { size: 19, color: ink, shadow: false });
      g.textBlock(secret ? t('ui.trials.secret') : x.blurb, r.x + 14, r.y + 62, r.w - 28, { size: 16, font: 'italic', color: ink, shadow: false }, 1.25);
      let sx = r.x + 14;
      for (const s of ruleSeals(x.rules)) {
        if (sx > r.x + r.w - 60) break;
        sx += drawSeal(g, sx, r.y + r.h - 56, s) + 6;
      }
      // The best result: a medal stamped on the bill (UIX-0189).
      const medal = medalFor(progress, x.id);
      const best = progress.xBest[x.id];
      if (medal && best) {
        g.circle(r.x + r.w - 34, r.y + r.h - 28, 18, hex(MEDAL_INK[medal]));
        g.text(t(`ui.trials.medal.${medal}`), r.x + r.w - 58, r.y + r.h - 22, { size: 16, color: ink, align: 'right', shadow: false });
        g.text(t('ui.trials.best', { rank: best.rank, score: best.score }), r.x + 14, r.y + r.h - 16, { size: 16, color: ink, shadow: false });
      } else if (!open && !secret && this.tabOpen(this.tier)) g.text(t('ui.trials.later'), r.x + 14, r.y + r.h - 16, { size: 16, color: ink, shadow: false });
      g.restore();
    });
    const back = ui.node('back');
    if (back) sealButton(g, back, ui.state('back'), this.time, 22);
    reticle(g, game.input.pos);
    g.endFrame();
  }
}

