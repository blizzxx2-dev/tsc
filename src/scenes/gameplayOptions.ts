import { t } from '../i18n';
import { heading } from '../ui/hudKit';
import type { Game, Scene } from '../core/scene';
import { hex } from '../render/color';
import type { Gfx } from '../render/gfx';
import { DIFFICULTIES, DIFFICULTY_ORDER, type Assists } from '../surgery/difficulty';
import { LITANIES, unlockedLitanies } from '../surgery/litany';
import { buyUpgrade, setDifficulty, UPGRADES, type TinctureColor, type UpgradeId } from '../surgery/progress';
import { progress, saveProgress } from '../surgery/session';
import { PALETTE, VIEW_W } from '../ui/layout';
import { button, inRect, panel, reticle } from '../ui/widgets';
import { drawBackdrop } from './backdrop';

interface Row {
  label: string;
  value: () => string;
  change: (dir: number) => void;
  note?: string;
}

const cycle = <T,>(list: readonly T[], cur: T, dir: number): T => list[(list.indexOf(cur) + dir + list.length) % list.length];

const toggle = (key: Exclude<keyof Assists, 'gameSpeed'>, label: string, note: string): Row => ({
  label: `Assist: ${label}`,
  value: () => (progress.assists[key] ? 'On' : 'Off'),
  change: () => (progress.assists[key] = !progress.assists[key]),
  note: `${note} Assisted results are marked and don’t count for XS or leaderboards.`,
});

/** Difficulty, assists, kit loadout and instrument upgrades (stored on the save). */
export class GameplayOptionsScene implements Scene {
  private hover = -1;
  private rows: Row[] = [
    {
      label: 'Difficulty',
      value: () => DIFFICULTIES[progress.difficulty].name + (progress.masterUnlocked ? '' : '  (Master: clear Chapter II)'),
      change: (d) => {
        const order = DIFFICULTY_ORDER.filter((x) => x !== 'master' || progress.masterUnlocked);
        setDifficulty(progress, cycle(order, progress.difficulty, d));
      },
      note: 'Novice: slower bleeding, more time. Master: faster bleeding, less time, no guides.',
    },
    {
      label: 'Litany rite',
      value: () => LITANIES[progress.litany].name,
      change: (d) => (progress.litany = cycle(unlockedLitanies(progress.chaptersCleared + 1), progress.litany, d)),
      note: 'Rites are learned as the story goes on. All are drawn with the same star.',
    },
    {
      label: 'Tincture kit',
      value: () => `red + ${progress.tincture === 'red' ? 'nothing' : progress.tincture}`,
      change: (d) => (progress.tincture = cycle<TinctureColor>(['red', 'green', 'blue', 'amber'], progress.tincture, d)),
      note: 'One extra tincture colour in the bag. Press 6 again in theatre to switch colours.',
    },
    { label: 'Guided tutorials', value: () => (progress.tutorialSkip ? 'Off' : 'On'), change: () => (progress.tutorialSkip = !progress.tutorialSkip), note: 'Turn off if you have operated before.' },
    toggle('bigHitboxes', 'larger targets', 'Everything is 6 px easier to hit.'),
    toggle('guides', 'guide lines', 'Guides stay on even on Master.'),
    toggle('autoLens', 'auto-lens', 'Hidden things surface on their own after a few seconds.'),
    toggle('slowTells', 'slow boss tells', 'The Malison telegraphs 25 % more slowly.'),
    toggle('noFail', 'no-fail', 'Vitals never fall below 1.'),
    toggle('suggest', 'tool suggestions', 'The instrument a wound needs pulses in the tray.'),
    toggle('holdToggle', 'click to hold', 'Leech, brand, tincture and lens: click to start, click to stop.'),
    toggle('simpleGestures', 'simple gestures', 'Click-per-stitch, hold to excise, hold L for the Litany.'),
    toggle('noRhythm', 'no rhythm', 'Saw strokes and heartbeat windows twice as forgiving.'),
    {
      label: 'Assist: game speed',
      value: () => `${Math.round(progress.assists.gameSpeed * 100)}%`,
      change: (d) => (progress.assists.gameSpeed = cycle([1, 0.9, 0.8, 0.7], progress.assists.gameSpeed, d)),
      note: 'Slows the whole operation. Flags the result and disables leaderboards.',
    },
    ...(Object.keys(UPGRADES) as UpgradeId[]).map(
      (id): Row => ({
        label: `Upgrade: ${UPGRADES[id].name}`,
        value: () => (progress.upgrades.includes(id) ? 'Owned' : `${UPGRADES[id].cost} crowns`),
        change: () => void buyUpgrade(progress, id),
        note: `${UPGRADES[id].effect} Not used in X-Operations.`,
      }),
    ),
  ];

  constructor(private onBack: () => void) {}

  private rowRect(i: number) {
    return { x: 290, y: 132 + i * 27, w: 700, h: 25 };
  }

  update(_dt: number, game: Game): void {
    const { input } = game;
    this.hover = this.rows.findIndex((_, i) => inRect(input.pos, this.rowRect(i)));
    if (input.pressed && this.hover >= 0) {
      const r = this.rowRect(this.hover);
      this.rows[this.hover].change(input.pos.x < r.x + r.w * 0.55 ? -1 : 1);
      saveProgress();
    }
    if (input.actPressed('ui.back')) this.back();
  }

  private back(): void {
    saveProgress();
    this.onBack();
  }

  render(g: Gfx, game: Game): void {
    g.beginWorld();
    drawBackdrop(g, 'chapel', g.time);
    g.endWorld({ litany: 0, danger: 0, shake: { x: 0, y: 0 }, bloom: 'menu', defocus: 8 });
    panel(g, { x: 260, y: 40, w: 760, h: 650 });
    heading(g, t('ui.gameplay.title'), VIEW_W / 2, 92, 380, 1, 28);
    g.text(t('ui.gameplay.fees', { n: progress.fees }), 980, 100, { size: 16, font: 'italic', color: hex(PALETTE.gold), align: 'right' });
    this.rows.forEach((row, i) => {
      const r = this.rowRect(i);
      const hover = i === this.hover;
      if (hover) g.rect(r.x, r.y, r.w, r.h, hex(PALETTE.blood, 0.28));
      g.text(row.label, r.x + 14, r.y + 19, { size: 17, color: hex(hover ? PALETTE.gold : PALETTE.ink) });
      g.text(`‹ ${row.value()} ›`, r.x + r.w - 14, r.y + 19, { size: 17, color: hex(PALETTE.gold), align: 'right' });
    });
    const note = this.hover >= 0 ? this.rows[this.hover].note : undefined;
    if (note) g.text(note, VIEW_W / 2, 630, { size: 16, font: 'italic', color: hex(PALETTE.inkDim), align: 'center' });
    if (button(g, game.input, t('ui.common.back'), VIEW_W / 2, 672, 24)) this.back();
    reticle(g, game.input.pos);
    g.endFrame();
  }
}
