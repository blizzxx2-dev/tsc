import type { CharacterId } from './characters';
import type { FlagCondition, FlagRecord } from './flags';

/** One option of a choice line (CON-0010). */
export interface ChoiceOption {
  /** Stable id recorded as the pick (`choice.<storyId>` flag); defaults to the option's index. */
  id?: string;
  /** What Kreuzer says — shown as the option and echoed into the backlog. */
  text: string;
  /** Flags this option writes when picked. */
  set?: Readonly<FlagRecord>;
}

export interface Line {
  who: CharacterId;
  text: string;
  /** Override the speaker's display name (e.g. a named patient). */
  as?: string;
  /** An ink stamp pressed onto the text box as the line completes (ART-0068). */
  stamp?: 'suspect' | 'approved';
  /** Shown only when the condition holds against the campaign flags (CON-0009). Evaluated live, so a choice earlier in the same scene counts. */
  if?: FlagCondition;
  /** A choice line (CON-0010): the text is the prompt; 2–3 options follow once it has been read. */
  choice?: readonly ChoiceOption[];
}

export type Backdrop = 'hospice' | 'street' | 'theatre' | 'chapel' | 'night' | 'camp' | 'apothecary' | 'alley' | 'guildhall' | 'tent' | 'graveyard' | 'orecamp' | 'forest' | 'abbey' | 'dawn';

export interface StoryDef {
  id: string;
  place: string;
  backdrop: Backdrop;
  /** Lighting variant for the backdrop (defaults per location). */
  lighting?: 'day' | 'dusk' | 'night';
  lines: Line[];
}

/** Terse line builders keep scripts readable. */
export const n = (text: string): Line => ({ who: 'narrator', text });
export const say = (who: CharacterId, text: string, as?: string): Line => ({ who, text, as });
/** A choice line: `who` frames the prompt `text`; the player picks one of 2–3 `options`. */
export const choose = (who: CharacterId, text: string, options: readonly ChoiceOption[], as?: string): Line => ({ who, text, as, choice: options });
/** Mark lines as conditional on the flags. Returns them for spreading into a `lines` array. */
export const onlyIf = (cond: FlagCondition, ...lines: Line[]): Line[] => lines.map((l) => ({ ...l, if: cond }));
