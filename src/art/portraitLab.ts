/**
 * Portrait look-dev (`?scene=portraits`): every base expression of one character on a board
 * (UIX-0129 / ART-0044), with the rig's blink and lip flap running. `&who=<id>` picks the
 * character (default kreuzer); `&talk=1` runs the lip flap; `&lit=0.65` previews the listener
 * darken (ART-0089). `&demo=1` instead plays a scripted scene through the real StoryScene —
 * two speakers, expressions, shake, flash, fade and a full-screen illustration (UIX-0130/0133)
 * — for QA screenshots.
 */
import type { Game, Scene } from '../core/scene';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { CAST, type CharacterId } from '../content/characters';
import { FACES, n, say, type StoryDef } from '../content/story';
import { VIEW_H, VIEW_W } from '../ui/layout';
import { caps, INK } from '../ui/hudKit';
import { drawPortrait } from '../scenes/backdrop';
import { StoryScene } from '../scenes/story';
import { PortraitRig } from './portraitRig';

/** A short scene exercising every staging and effect feature; `Enter` steps through it. */
export const PORTRAIT_DEMO: StoryDef = {
  id: 'portrait-demo',
  place: 'Kessendorf — Hospice of Saint Ildra',
  when: 'before Matins',
  backdrop: 'hospice',
  lines: [
    n('*A cold night.* The {Malison} has a name now, and the {Hollow Choir} is singing it.'),
    say('ilse', 'Doctor — his chest. The marks are *moving*.', { face: 'worried' }),
    say('kreuzer', 'Then we unwrite him. The brand, Sister. And more light.', { face: 'stern' }),
    say('ilse', 'You mean to speak the {Litany} with the Inquisitor in the yard?', { face: 'afraid' }),
    say('stroh', 'A remarkable recovery, Doctor. Remarkable.', { face: 'wry', shake: 0.6, sfx: 'bell' }),
    say('kreuzer', 'Practice, Inquisitor. And the grace of Saint Ildra.', { face: 'kind', flash: 0.8 }),
    n('The pyres outside the east gate have not gone out since autumn.', { cg: 'street', fade: 'in' }),
    say('haller', 'And if this was Matins… then somewhere, someone is already writing Lauds.', { face: 'grim', cg: 'off', fade: 'out' }),
  ],
};

const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;

export class PortraitLabScene implements Scene {
  private who: CharacterId;
  private rigs: PortraitRig[];
  private talk: boolean;
  private lit: number;
  private inner: Scene | null = null;

  constructor() {
    const who = params?.get('who') ?? 'kreuzer';
    this.who = who in CAST && who !== 'narrator' ? (who as CharacterId) : 'kreuzer';
    this.talk = params?.get('talk') === '1';
    this.lit = Number(params?.get('lit') ?? 1) || 1;
    this.rigs = FACES.map((f, i) => {
      const r = new PortraitRig(f, { rng: () => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1 });
      r.lit = this.lit;
      return r;
    });
    if (params?.get('demo') === '1') this.inner = new StoryScene(PORTRAIT_DEMO, () => (this.inner = null));
  }

  update(dt: number, game: Game): void {
    if (this.inner) return this.inner.update(dt, game);
    this.rigs.forEach((r) => r.update(dt, this.talk));
    if (game.input.actPressed('ui.confirm')) this.rigs.forEach((r) => r.blinkNow());
  }

  render(g: Gfx, game: Game): void {
    if (this.inner) return this.inner.render(g, game);
    const c = CAST[this.who];
    g.beginWorld();
    g.rect(0, 0, VIEW_W, VIEW_H, hex('#14100c'));
    const cols = 4;
    const cw = VIEW_W / cols;
    const scale = 0.6;
    FACES.forEach((_f, i) => {
      const cx = (i % cols) * cw + cw / 2;
      const cy = Math.floor(i / cols) * (VIEW_H / 2) + 40;
      g.save();
      g.translate(cx, cy);
      g.scale(scale);
      drawPortrait(g, c, 0, 500, g.time, true, false, this.rigs[i].pose());
      g.restore();
    });
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 1 });
    FACES.forEach((f, i) => {
      const cx = (i % cols) * cw + cw / 2;
      const cy = Math.floor(i / cols) * (VIEW_H / 2) + VIEW_H / 2 - 18;
      caps(g, f, cx, cy, 14, hex(INK.gold), 'center');
    });
    caps(g, c.name, 24, 30, 14, hex(INK.dim));
    g.endFrame();
  }
}
