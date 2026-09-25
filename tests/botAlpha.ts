/** Bot plans for the Alpha ailments (src/surgery/ailments/*). */
import type { Entity } from '../src/surgery/entity';
import type { Action, BotContext } from './bot';

export function isAlphaEntity(_e: Entity): boolean {
  return false;
}

export function botPlanAlpha(_ctx: BotContext): Action | null {
  return null;
}
