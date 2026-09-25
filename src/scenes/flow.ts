import type { BundleId } from '../assets/manifest.gen';
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
import { finishChapter, finishOperation } from '../surgery/session';
import type { OperationOptions } from '../surgery/operation';
import { lastOutcome, noteOutcome, resolveStory } from '../content/conditions';
import { aftermathFor, failureFor } from '../content/narrative';

export const save: SaveData = load();

/**
 * Briefing → operation → results for one operation, then hand control back. In the campaign
 * (`story`), a failure scene precedes the retry prompt and an aftermath scene follows a win (NAR).
 */
export function playOperation(game: Game, def: OperationDef, onWin: () => void, onLeave: () => void, story = false, runOpts: OperationOptions = {}): void {
  const begin = (over: OperationOptions = runOpts) =>
    game.go(
      new OperationScene(
        def,
        ({ op, won }) => {
          const legacyBest = won && !op.opts.challenge ? recordBest(save, def.id, op.rank(), op.score) : false;
          store(save);
          emitGameEvent({ type: 'operation-end', opId: def.id, won, rank: won ? op.rank() : null, score: op.score, assisted: assisted(), litanyUsed: op.litanyUsed });
          const summary = finishOperation(op);
          const cp = op.checkpointPhase();
          noteOutcome(def.id, won ? op.rank() : null, op.litanyUsed);
          const after = story && won ? aftermathFor(def.id) : undefined;
          const next = after ? () => game.go(new StoryScene(resolveStory(after, lastOutcome()), onWin)) : onWin;
          const results = () =>
            game.go(
              new ResultsScene(
                op,
                won,
                summary.newBest || legacyBest,
                {
                  next: won ? next : undefined,
                  retry: () => begin(runOpts),
                  quit: onLeave,
                  // Retry at Novice for this op only; boss ops can resume at the Malison.
                  retryNovice: op.opts.challenge || op.difficulty === 'novice' ? undefined : () => begin({ ...runOpts, difficulty: 'novice' }),
                  retryCheckpoint: cp !== null ? () => begin({ ...runOpts, checkpoint: cp }) : undefined,
                },
                summary,
              ),
            );
          const fail = story && !won ? failureFor(def.id) : undefined;
          if (fail) game.go(new StoryScene(fail, results));
          else results();
        },
        onLeave,
        over,
      ),
    );
  game.go(new BriefingScene(def, save.best[def.id], () => begin(), onLeave));
}

/** Play the campaign from a given chapter/step, saving progress as it goes. */
export function playStep(game: Game, chapter: number, step: number): void {
  const ch = CAMPAIGN[chapter];
  // Past the last chapter of the demo: the thank-you / wishlist screen.
  if (!ch) {
    emitGameEvent({ type: 'edition-complete' });
    return game.go(new DemoEndScene());
  }
  syncChapterBundles(game, chapter, step);
  const s = ch.steps[step];
  if (!s) {
    emitGameEvent({ type: 'chapter-complete', chapter });
    finishChapter(chapter + 1);
    return playStep(game, chapter + 1, 0);
  }
  advance(save, chapter, step);
  store(save);
  const next = () => {
    advance(save, chapter, step + 1);
    store(save);
    playStep(game, chapter, step + 1);
  };
  if (s.kind === 'story') game.go(new StoryScene(resolveStory(s.story, lastOutcome()), next));
  else playOperation(game, s.op, next, () => game.go(new TitleScene()), true);
}

/**
 * Chapter bundles (ENG-0212): hold the current chapter's bundle, prefetch the
 * next one during the chapter's story scenes, and unload chapters left behind.
 */
function syncChapterBundles(game: Game, chapter: number, step: number): void {
  const a = game.assets;
  if (!a) return;
  const id = (c: number) => `chapter${c + 1}` as BundleId;
  a.prefetch(id(chapter));
  const s = CAMPAIGN[chapter].steps[step];
  if (s?.kind === 'story' && CAMPAIGN[chapter + 1]) a.prefetch(id(chapter + 1));
  for (const held of a.heldBundles()) {
    const m = /^chapter(\d+)$/.exec(held);
    if (m && Number(m[1]) - 1 < chapter) a.unloadBundle(held);
  }
}
