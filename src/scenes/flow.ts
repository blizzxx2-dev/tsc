import type { Game } from '../core/scene';
import { advance, load, recordBest, store, type SaveData } from '../core/save';
import { CAMPAIGN } from '../content/campaign';
import type { OperationDef } from '../surgery/operation';
import { BriefingScene } from './briefing';
import { OperationScene } from './operation';
import { ResultsScene } from './results';
import { StoryScene } from './story';
import { TitleScene } from './title';
import { DemoEndScene } from './demoend';
import { emitGameEvent } from '../platform/events';
import { assisted } from '../core/settings';

export const save: SaveData = load();

/** Briefing → operation → results for one operation, then hand control back. */
export function playOperation(game: Game, def: OperationDef, onWin: () => void, onLeave: () => void): void {
  const begin = () =>
    game.go(
      new OperationScene(
        def,
        ({ op, won }) => {
          const best = won ? recordBest(save, def.id, op.rank(), op.score) : false;
          store(save);
          emitGameEvent({ type: 'operation-end', opId: def.id, won, rank: won ? op.rank() : null, score: op.score, assisted: assisted(), litanyUsed: op.litanyUsed });
          game.go(new ResultsScene(op, won, best, { next: won ? onWin : undefined, retry: begin, quit: onLeave }));
        },
        onLeave,
      ),
    );
  game.go(new BriefingScene(def, save.best[def.id], begin, onLeave));
}

/** Play the campaign from a given chapter/step, saving progress as it goes. */
export function playStep(game: Game, chapter: number, step: number): void {
  const ch = CAMPAIGN[chapter];
  // Past the last chapter of the demo: the thank-you / wishlist screen.
  if (!ch) {
    emitGameEvent({ type: 'edition-complete' });
    return game.go(new DemoEndScene());
  }
  const s = ch.steps[step];
  if (!s) {
    emitGameEvent({ type: 'chapter-complete', chapter });
    return playStep(game, chapter + 1, 0);
  }
  advance(save, chapter, step);
  store(save);
  const next = () => {
    advance(save, chapter, step + 1);
    store(save);
    playStep(game, chapter, step + 1);
  };
  if (s.kind === 'story') game.go(new StoryScene(s.story, next));
  else playOperation(game, s.op, next, () => game.go(new TitleScene()));
}
