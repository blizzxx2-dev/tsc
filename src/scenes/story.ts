import { gradeFor } from '../render/lut';
import type { Game, Scene } from '../core/scene';
import { t } from '../i18n';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { CAST, type CharacterId } from '../content/characters';
import { lineShownNow } from '../content/conditions';
import { flags } from '../content/flags';
import type { Line, StoryDef } from '../content/story';
import { VIEW_H, VIEW_W } from '../ui/layout';
import { reticle } from '../ui/widgets';
import { flowMark } from '../ui/ornaments';
import { caps, diamond, INK, rule } from '../ui/hudKit';
import { inkStamp } from '../art/kit';
import { glyphContext, glyphFor } from '../input/glyphs';
import type { ActionId } from '../input/actions';
import { tooltip } from '../ui/controls';
import { settings } from '../core/settings';
import { canSkip, readLog, ReadLog } from '../ui/readLog';
import { drawRich, stripMarkup } from '../ui/text';
import { Typewriter } from '../render/textLayout';
import { PortraitStage } from '../art/portraitStage';
import { drawBackdrop, drawPortrait } from './backdrop';
import { BacklogScene, StoryMenuScene, type BacklogLine } from './storyMenu';
import { ChoiceScene } from './choice';
import { TitleScene } from './title';

const CPS = 48; // characters per second

/** The text box's control strip (UIX-0125): clickable Auto / Skip / Log / Hide / Menu at the bottom-right. */
type StripId = 'auto' | 'skip' | 'log' | 'hide' | 'menu';
const STRIP: readonly { id: StripId; action: ActionId }[] = [
  { id: 'auto', action: 'vn.auto' },
  { id: 'skip', action: 'vn.fast' },
  { id: 'log', action: 'vn.log' },
  { id: 'hide', action: 'vn.hide' },
  { id: 'menu', action: 'ui.back' },
];
const STRIP_W = 84;
const STRIP_H = 30;
function stripRect(i: number): { x: number; y: number; w: number; h: number } {
  return { x: VIEW_W - 24 - (STRIP.length - i) * (STRIP_W + 6), y: VIEW_H - 44, w: STRIP_W, h: STRIP_H };
}
const inside = (p: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

/** Rest x of the two portrait slots (UIX-0130); the bust's base line. */
export const SLOT_X: readonly [number, number] = [330, VIEW_W - 330];
const SLOT_Y = 500;

/** The opening location card (UIX-0132) holds this long, then fades over CARD_FADE_S. */
export const CARD_HOLD_S = 2;
export const CARD_FADE_S = 0.5;
/** The first line starts typing this long after the card appears. */
const CARD_LEAD_S = 0.8;

/** Screen shake from a line effect decays to nothing in about this long. */
const SHAKE_S = 0.7;
/** A `flash` lasts this long; Reduced Flashing swells it slowly and dimly instead (UIX-0133). */
const FLASH_S = 0.25;
const FLASH_SOFT_S = 0.7;
/** `fade: 'out'` / `'in'` take this long. */
const FADE_S = 0.6;

/**
 * Characters that have already spoken in this profile (UIX-0131): the name plate carries the
 * character's title the first time they speak. Persisted like the read-text log.
 */
const CAST_KEY = 'suture-and-steel.seen-cast';
export class CastLog {
  private seen = new Set<string>();
  private dirty = false;

  constructor(private store: Pick<Storage, 'getItem' | 'setItem'> | null = typeof localStorage === 'undefined' ? null : localStorage) {
    try {
      const raw = this.store?.getItem(CAST_KEY);
      if (raw) for (const id of JSON.parse(raw) as string[]) this.seen.add(id);
    } catch {
      // Unreadable storage: everyone is met for the first time.
    }
  }

  has(id: CharacterId): boolean {
    return this.seen.has(id);
  }

  /** Record that `id` has spoken; true when this was their first line. */
  meet(id: CharacterId): boolean {
    if (this.seen.has(id)) return false;
    this.seen.add(id);
    this.dirty = true;
    return true;
  }

  flush(): void {
    if (!this.dirty) return;
    this.dirty = false;
    try {
      this.store?.setItem(CAST_KEY, JSON.stringify([...this.seen]));
    } catch {
      // Storage full or blocked: keep the in-memory log.
    }
  }
}
export const castLog = new CastLog();

/** Visual-novel scene: backdrop, staged portraits, name plate and a typewriter text box. */
export class StoryScene implements Scene {
  private i = 0;
  private shown = 0;
  private t = 0;
  private fadeIn = 0;
  /** Seconds since the scene opened, for the location card. */
  private age = 0;
  /** Auto-advance (vn.auto): lines move on by themselves after a reading pause. */
  private auto = false;
  /** Text box hidden (vn.hide) to look at the scene; any advance brings it back. */
  private hidden = false;
  /** Skip mode toggled from the control strip: fast-forward as if the key were held. */
  private skipMode = false;
  /** Indices of the lines shown so far — flag-conditional lines that failed are not among them (CON-0009). */
  private seen: number[] = [];
  /** Option picked at each choice line (CON-0010). */
  private picks = new Map<number, number>();
  /** A choice list is open over the scene. */
  private choosing = false;
  /** Portraits on stage (UIX-0130). */
  readonly stage = new PortraitStage({ reduceMotion: () => settings.reduceMotion });
  /** The current line has not yet been entered (effects, staging) — done on the first update with the game. */
  private pending = true;
  /** Line effects in flight (UIX-0133). */
  private shake = 0;
  private flash = 0;
  private flashPeak = 0;
  private flashSoft = false;
  private black = 0;
  private blackTarget = 0;
  private cg: StoryDef['backdrop'] | null = null;
  /** The speaker whose title the plate carries on this line (first appearance, UIX-0131). */
  private titled: CharacterId | null = null;

  constructor(
    private story: StoryDef,
    private onDone: () => void,
  ) {
    this.i = this.seek(0);
    if (this.i < story.lines.length) this.seen.push(this.i);
    // The location card leads; the first line starts typing under it.
    this.shown = -CPS * CARD_LEAD_S;
  }

  private get line() {
    return this.story.lines[Math.min(this.i, this.story.lines.length - 1)];
  }

  /**
   * Characters of the current line revealed so far (ENG-0175): per-character timing from a
   * Typewriter built once per line, so sentence stops and commas hold the text back a beat.
   * `shown` is the typing clock in characters-at-CPS; skip-to-end sets it past every pause.
   */
  private typer: { text: string; tw: Typewriter } | null = null;
  private revealed(): number {
    const plain = this.plain;
    if (this.typer?.text !== plain) this.typer = { text: plain, tw: new Typewriter({ glyphs: Array.from(plain, (ch) => ({ ch })) }, CPS) };
    return this.shown <= 0 ? 0 : this.typer.tw.visibleAt(this.shown / CPS);
  }

  /** Full frame rate while text types out (idle throttling, ENG-0229). */
  get animating(): boolean {
    return this.shown > 0 && this.revealed() < this.plain.length;
  }

  /** Plain (marker-free) text of the current line, the string the typewriter reveals. */
  private get plain(): string {
    return stripMarkup(this.line.text);
  }

  /** First line at or after `from` whose flag condition holds now; `lines.length` when none does. */
  private seek(from: number): number {
    const lines = this.story.lines;
    let j = from;
    while (j < lines.length && !lineShownNow(lines[j])) j++;
    return j;
  }

  /** Every line shown so far in this scene, with the replies chosen, for the backlog (UIX-0121). */
  private backlog(): BacklogLine[] {
    const out: BacklogLine[] = [];
    for (const i of this.seen) {
      const l = this.story.lines[i];
      out.push({ who: l.who === 'narrator' ? '' : (l.as ?? CAST[l.who].name ?? ''), text: l.text, narration: l.who === 'narrator' });
      const k = this.picks.get(i);
      const opt = k === undefined ? undefined : l.choice?.[k];
      if (opt) out.push({ who: CAST.kreuzer.name ?? '', text: opt.text, narration: false });
    }
    return out;
  }

  /** Stage the speaker and fire the line's effects (UIX-0129/0130/0131/0133). */
  private enterLine(game: Game): void {
    this.pending = false;
    const line: Line = this.line;
    if (line.who === 'narrator') {
      this.stage.rest();
      this.titled = null;
    } else {
      this.stage.speak(line.who, line.face);
      this.titled = CAST[line.who].title && castLog.meet(line.who) ? line.who : null;
    }
    if (line.shake) this.shake = Math.max(this.shake, Math.min(1, line.shake));
    if (line.flash) {
      this.flashSoft = settings.reduceFlashing;
      this.flashPeak = Math.min(1, line.flash) * (this.flashSoft ? 0.25 : 1);
      this.flash = 1;
    }
    if (line.fade) this.blackTarget = line.fade === 'out' ? 1 : 0;
    if (line.cg) this.cg = line.cg === 'off' ? null : line.cg;
    if (line.sfx) game.audio.play(line.sfx);
    if (line.music) (game.audio as Partial<Game['audio']>).music?.setState(line.music === 'silent' ? 'silent' : `story-${line.music}`);
  }

  /** Move to the next line on this player's path, or end the scene. */
  private next(game?: Game): void {
    this.t = 0;
    this.shown = 0;
    const j = this.seek(this.i + 1);
    if (j >= this.story.lines.length) {
      this.i = this.story.lines.length - 1;
      return this.finish();
    }
    this.i = j;
    this.seen.push(j);
    this.pending = true;
    if (game) this.enterLine(game);
    game?.audio.play('select');
  }

  /** Flag key that records the pick: `choice.<scene>`, numbered when a scene has several choices. */
  private choiceKey(): string {
    const ordinal = this.story.lines.slice(0, this.i).filter((l) => l.choice).length + 1;
    return ordinal === 1 ? `choice.${this.story.id}` : `choice.${this.story.id}.${ordinal}`;
  }

  /** Answer the current choice line: write its flags, record the pick and move on (CON-0010). */
  choose(k: number, game?: Game): void {
    const opt = this.line.choice?.[k];
    if (!opt || this.picks.has(this.i)) return;
    this.choosing = false;
    this.picks.set(this.i, k);
    if (opt.set) flags.setAll(opt.set);
    flags.set(this.choiceKey(), opt.id ?? k);
    this.next(game);
  }

  /** Offer the replies of the current choice line above the text box. Without a scene stack, the first reply is taken. */
  private openChoice(game: Game): void {
    const options = this.line.choice ?? [];
    if (!game.push) return this.choose(0, game);
    this.choosing = true;
    const rowH = 46;
    const h = options.length * (rowH + 2);
    const top = VIEW_H - Math.round(230 + (settings.textScale - 1) * 170);
    game.push(
      new ChoiceScene({ x: 200, y: top - 28 - h, w: VIEW_W - 400, h }, options.map((o) => o.text), 0, (k) => this.choose(k, game), { layout: 'box', required: true, rowH }),
    );
  }

  private finish(): void {
    readLog.flush();
    castLog.flush();
    this.onDone();
  }

  /** Esc no longer skips outright: it opens the scene's menu (UIX-0122). */
  private openMenu(game: Game): void {
    if (!game.push) return this.finish();
    game.push(
      new StoryMenuScene(this.story.place, this.backlog(), (r) => {
        if (r === 'skip') this.finish();
        else if (r === 'title') {
          readLog.flush();
          castLog.flush();
          game.go(new TitleScene());
        }
      }),
    );
  }

  /** Advance the effects and the stage (UIX-0130/0133). */
  private tick(dt: number, typing: boolean): void {
    this.shake = Math.max(0, this.shake - dt / SHAKE_S);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt / (this.flashSoft ? FLASH_SOFT_S : FLASH_S));
    const step = dt / FADE_S;
    this.black += Math.max(-step, Math.min(step, this.blackTarget - this.black));
    this.stage.update(dt, typing);
  }

  update(dt: number, game: Game): void {
    const { input } = game;
    if (this.i >= this.story.lines.length) return this.finish(); // every line was conditional and none held
    if (this.pending) this.enterLine(game);
    this.t += dt;
    this.age += dt;
    this.fadeIn = Math.min(1, this.fadeIn + dt * 1.5);
    // Fast-forward passes only lines already read, unless "Skip unread text" is on (UIX-0124).
    const id = ReadLog.lineId(this.story.id, this.i);
    const fast = (input.act('vn.fast') || this.skipMode) && canSkip(readLog.has(id), settings.skipUnread);
    if (this.skipMode && !canSkip(readLog.has(id), settings.skipUnread)) this.skipMode = false; // skip stops at unread text
    if (fast) this.age = Math.max(this.age, CARD_HOLD_S + CARD_FADE_S); // fast-forward drops the location card
    this.shown += dt * CPS * settings.textSpeed * (fast ? 8 : 1);
    const plain = this.plain;
    const full = this.revealed() >= plain.length;
    this.tick(dt, this.shown > 0 && !full);
    if (full) readLog.mark(id);
    // The control strip consumes its own clicks.
    const hit = !this.hidden && input.pressed ? STRIP.find((_, i) => inside(input.pos, stripRect(i)))?.id : undefined;
    if (input.actPressed('ui.back') || hit === 'menu') return this.openMenu(game);
    if ((input.actPressed('vn.log') || input.wheel < 0 || hit === 'log') && game.push) return game.push(new BacklogScene(this.backlog()));
    if (input.actPressed('vn.auto') || hit === 'auto') this.auto = !this.auto;
    if (hit === 'skip') this.skipMode = !this.skipMode;
    if (this.hidden) {
      // Any press only brings the text back (UIX-0126).
      if (input.pressed || input.rightPressed || input.actPressed('vn.advance') || input.actPressed('vn.hide')) this.hidden = false;
      return;
    }
    if (input.actPressed('vn.hide') || input.rightPressed || hit === 'hide') {
      this.hidden = true;
      return;
    }
    if (hit) return;
    // A choice line waits for its answer once the prompt has been read (CON-0010).
    if (full && this.line.choice && !this.picks.has(this.i)) {
      if (!this.choosing) this.openChoice(game);
      return;
    }
    const click = input.pressed || input.actPressed('vn.advance');
    // Manual input pauses auto mode (UIX-0123).
    if (click && this.auto && full) this.auto = false;
    const autoDue = this.auto && full && this.t > Math.max(1.2, plain.length * 0.03) / settings.textSpeed;
    const advance = click || (fast && full && this.t > 0.08) || autoDue;
    if (!advance) return;
    this.t = 0;
    if (!full) {
      this.shown = Number.MAX_SAFE_INTEGER;
      return;
    }
    this.next(game);
  }

  /** Alpha of the opening location card (UIX-0132): held, then faded; the plain caption takes over. */
  private cardAlpha(): number {
    if (this.age <= CARD_HOLD_S) return 1;
    return Math.max(0, 1 - (this.age - CARD_HOLD_S) / CARD_FADE_S);
  }

  private drawCard(g: Gfx, a: number): void {
    const vr = g.viewRect();
    const cy = 214;
    const place = this.story.place;
    const when = this.story.when;
    const h = when ? 132 : 104;
    // A dark band across the scene, feathered top and bottom, carries the lettering.
    g.rectGrad(vr.x, cy - h / 2 - 30, vr.w, 30, hex('#000000', 0), hex('#050303', 0.62 * a));
    g.rect(vr.x, cy - h / 2, vr.w, h, hex('#050303', 0.62 * a));
    g.rectGrad(vr.x, cy + h / 2, vr.w, 30, hex('#050303', 0.62 * a), hex('#000000', 0));
    const w = Math.min(760, g.measure(place.toUpperCase(), 26, 'display', 0.16) + 120);
    rule(g, VIEW_W / 2, cy - h / 2 + 14, w, hex(INK.gilt, 0.8 * a));
    diamond(g, VIEW_W / 2, cy - h / 2 + 14, 3, hex(INK.goldHi, a));
    g.text(place.toUpperCase(), VIEW_W / 2, cy + (when ? -2 : 10), { size: 26, font: 'display', color: hex(INK.goldHi, a), color2: hex(INK.gold, a), align: 'center', tracking: 0.16, shadow: hex('#000000', 0.9 * a), soft: true });
    if (when) g.text(when, VIEW_W / 2, cy + 36, { size: 20, font: 'italic', color: hex('#d8c8a8', 0.9 * a), align: 'center', shadow: hex('#000000', 0.8 * a), soft: true });
    rule(g, VIEW_W / 2, cy + h / 2 - 16, w, hex(INK.gilt, 0.8 * a));
    diamond(g, VIEW_W / 2, cy + h / 2 - 16, 3, hex(INK.goldHi, a));
  }

  render(g: Gfx, game: Game): void {
    const line = this.line;
    const who = CAST[line.who];
    const plain = this.plain;
    const shownN = this.revealed();
    const pointer = settings.reduceMotion ? undefined : game.input.pos;
    g.beginWorld();
    if (this.cg) {
      // A full-screen illustration (UIX-0133 `cg`): the location alone, framed by a soft vignette.
      drawBackdrop(g, this.cg, g.time, { pointer });
    } else {
      drawBackdrop(g, this.story.backdrop, g.time, { lighting: this.story.lighting, pointer });
      for (const e of this.stage.entries()) drawPortrait(g, CAST[e.who], SLOT_X[e.slot] + e.dx, SLOT_Y, g.time, e.speaking, false, e.pose);
    }
    const trauma = this.shake > 0 && !settings.reduceMotion ? Math.min(1, this.shake * settings.shake) : undefined;
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, trauma, bloom: 'story', lutA: gradeFor(this.cg ?? this.story.backdrop) });

    const vr = g.viewRect();
    if (this.cg) {
      g.rectGrad(vr.x, vr.y, vr.w, 90, hex('#000000', 0.55), hex('#000000', 0));
      g.rectGrad(vr.x, vr.y, 120, vr.h, hex('#000000', 0.35), hex('#000000', 0));
    }
    if (this.black > 0) g.rect(vr.x, vr.y, vr.w, vr.h, hex('#000000', this.black));
    if (this.flash > 0) {
      // A short bright swell (a candle catching, a blow landing) — rise fast, fall slower.
      const env = this.flashSoft ? Math.sin(this.flash * Math.PI) : Math.min(1, this.flash * 4) * this.flash;
      g.rect(vr.x, vr.y, vr.w, vr.h, hex('#fff2dc', this.flashPeak * env));
    }
    if (this.fadeIn < 1) g.rect(vr.x, vr.y, vr.w, vr.h, hex('#000000', 1 - this.fadeIn));
    // Location: the lettered card first (UIX-0132), then a small engraved caption over a top shade.
    const card = this.cardAlpha();
    const cap = 1 - card;
    if (cap > 0) {
      g.rectGrad(vr.x, vr.y, vr.w, 110 - vr.y, hex('#000000', 0.7 * cap), hex('#000000', 0));
      caps(g, this.story.place, 40, 44, 14, hex(INK.gold, cap));
      const pw = Math.min(560, g.measure(this.story.place.toUpperCase(), 14, 'display', 0.16));
      rule(g, 40 + pw / 2, 56, pw + 40, hex(INK.gilt, 0.6 * cap));
    }
    if (card > 0) this.drawCard(g, card);

    if (this.hidden) {
      reticle(g, game.input.pos);
      return g.endFrame();
    }
    // Lower third: a deep shade rising from the bottom edge (its strength follows the text-box
    // opacity option, UIX-0128); text scale grows it upward (UIX-0148).
    const ts = settings.textScale;
    const op = settings.textBoxOpacity;
    const bh = Math.round(230 + (ts - 1) * 170);
    const top = vr.y + vr.h - bh;
    g.rectGrad(vr.x, top - 120, vr.w, 120, hex('#000000', 0), hex('#050303', 0.72 * op));
    g.rect(vr.x, top, vr.w, vr.y + vr.h - top, hex('#050303', 0.72 * op));
    g.rectGrad(vr.x, top, vr.w, vr.y + vr.h - top, hex('#000000', 0.1 * op), hex('#000000', 0.5 * op));
    rule(g, VIEW_W / 2, top + 6, VIEW_W * 0.8, hex(INK.gilt, 0.55));
    const tx = 200;
    const tw = VIEW_W - 400;
    const name = line.as ?? who.name;
    if (name) {
      caps(g, name, tx, top + 46, 16, hex(INK.goldHi));
      const nw = Math.min(260, g.measure(name.toUpperCase(), 16, 'display', 0.16));
      g.rect(tx, top + 56, nw, 1.5, hex(who.color, 0.8));
      // First appearance (UIX-0131): the character's title follows the name, set off by a diamond.
      const title = this.titled === line.who && !line.as ? who.title : undefined;
      if (title) {
        const a = Math.min(1, Math.max(0, this.t * 2 - 0.3));
        diamond(g, tx + nw + 18, top + 41, 3, hex(who.color, 0.9 * a));
        caps(g, title, tx + nw + 32, top + 46, 13, hex(INK.dim, a));
      }
    }
    const narr = line.who === 'narrator';
    const size = Math.round(24 * ts);
    // A gold initial opens each scene's first narration (ART-0082).
    // Only when the narration runs to two lines or more, so the initial has lines to sit beside.
    const dropCap = this.i === 0 && narr && /^\p{Lu}/u.test(line.text) && g.wrap(plain, VIEW_W - 400, Math.round(24 * ts), 'italic').length >= 2;
    const capSize = Math.round(size * 2.6);
    const ty = top + (name ? 94 : 70);
    if (dropCap && shownN > 0) g.text(plain[0], tx, ty + size * 1.42, { size: capSize, font: 'display', color: hex(INK.goldHi), color2: hex(INK.gold), shadow: hex('#000000', 0.9), soft: true });
    const body = dropCap ? line.text.slice(1) : line.text;
    const shownBody = dropCap ? Math.max(0, shownN - 1) : shownN;
    const indent = dropCap ? g.measure(plain[0], capSize, 'display') + 10 : 0;
    drawRich(
      g,
      body,
      tx + indent,
      ty,
      tw - indent,
      {
        size,
        font: narr ? 'italic' : 'body',
        color: hex(narr ? '#d8c8a8' : INK.text),
        shadow: hex('#000000', 0.9),
        soft: true,
        termColor: hex(INK.gold),
      },
      1.42,
      shownBody,
    );
    const full = shownN >= plain.length;
    if (line.stamp && full) inkStamp(g, t(`ui.stamp.${line.stamp}`), tx + tw - 90, top + 60, 24, line.stamp === 'suspect' ? '#e04040' : '#7fc4a4', Math.min(1, this.t * 3), false, line.stamp === 'suspect' ? -0.12 : 0.08);
    if (full && !(line.choice && !this.picks.has(this.i))) {
      const pulse = settings.reduceMotion ? 1 : 0.6 + 0.4 * Math.sin(g.time * 4);
      diamond(g, tx + tw + 24, vr.y + vr.h - 46 + (settings.reduceMotion ? 0 : Math.sin(g.time * 4) * 2), 5, hex(INK.gold, pulse), hex('#000000', 0.6));
    }
    if (game.input.act('vn.fast')) flowMark(g, tx + tw + 10, top + 40, 'skip', g.time);
    this.drawStrip(g, game);
    reticle(g, game.input.pos);
    g.endFrame();
  }

  private drawStrip(g: Gfx, game: Game): void {
    // Pads have no pointer: the bindings are spelled out instead of the clickable strip.
    if (glyphContext().device === 'pad') {
      const hint = t('ui.story.controls_fmt', { advance: glyphFor('vn.advance'), fast: glyphFor('vn.fast'), log: glyphFor('vn.log'), auto: glyphFor('vn.auto'), skip: glyphFor('ui.back') });
      g.text(hint, VIEW_W - 30, VIEW_H - 12, { size: 16, color: hex(this.auto ? INK.gold : INK.faint), align: 'right', shadow: false });
      return;
    }
    let hover = -1;
    STRIP.forEach(({ id }, i) => {
      const r = stripRect(i);
      const over = inside(game.input.pos, r);
      if (over) hover = i;
      const on = (id === 'auto' && this.auto) || (id === 'skip' && (this.skipMode || game.input.act('vn.fast')));
      const lit = on ? 1 : over ? 0.85 : 0.5;
      if (on || over) g.rect(r.x + 10, r.y + r.h - 4, r.w - 20, 1.5, hex(INK.gold, on ? 0.9 : 0.5));
      if (on) diamond(g, r.x + 8, r.y + r.h / 2, 3, hex(INK.goldHi, 0.6 + 0.4 * Math.sin(g.time * 3)));
      caps(g, t(`ui.story.strip.${id}`), r.x + r.w / 2, r.y + r.h / 2 + 5, 13, hex(on ? INK.goldHi : INK.text, lit), 'center');
    });
    if (hover >= 0) {
      const { id, action } = STRIP[hover];
      tooltip(g, stripRect(hover), t(`ui.story.strip.${id}`), t('ui.story.strip.key', { key: glyphFor(action) }));
    }
  }
}
