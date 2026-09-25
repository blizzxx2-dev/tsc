/**
 * Heraldry board (`?scene=heraldry`): the city arms, six guild marks, the hospice seal, the faith
 * glyphs and every achievement medallion in colour and greyed. With `&medal=<ID>&size=<px>` (and
 * `&locked=1`) it draws one medallion alone on its ground, for the icon export script.
 */
import type { Game, Scene } from '../core/scene';
import { ACHIEVEMENTS } from '../platform/achievements';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { cityArms, doveAndLancet, GUILDS, guildMark, hospiceSeal, sunInPalm, waxMedallion } from './heraldry';

export const MEDAL_GROUND = '#1c1410';

export class HeraldryScene implements Scene {
  private medal: string | null;
  private size: number;
  private locked: boolean;
  constructor() {
    const q = new URLSearchParams(location.search);
    this.medal = q.get('medal');
    this.size = Number(q.get('size') ?? 256);
    this.locked = q.get('locked') === '1';
  }
  update(): void {}
  render(g: Gfx, _game: Game): void {
    g.beginScreen([0.11, 0.08, 0.06]);
    if (this.medal) {
      g.rect(0, 0, this.size, this.size, hex(MEDAL_GROUND));
      waxMedallion(g, this.medal, this.size / 2, this.size / 2, this.size * 0.94, this.locked);
      return g.endFrame();
    }
    cityArms(g, 110, 150, 180);
    GUILDS.forEach((id, i) => {
      g.circle(290 + i * 110, 110, 50, hex('#e8dcc0'));
      guildMark(g, id, 290 + i * 110, 110, 96);
    });
    hospiceSeal(g, 1030, 150, 180);
    sunInPalm(g, 1170, 110, 90);
    doveAndLancet(g, 1170, 210, 80);
    ACHIEVEMENTS.forEach((a, i) => {
      waxMedallion(g, a.id, 110 + i * 170, 400, 150);
      waxMedallion(g, a.id, 110 + i * 170, 590, 110, true);
    });
    g.endFrame();
  }
}
