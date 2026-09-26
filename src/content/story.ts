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

/** The eight base expressions every portrait rig carries (UIX-0129 / ART-0091). */
export type Face = 'neutral' | 'worried' | 'stern' | 'wry' | 'afraid' | 'grim' | 'kind' | 'pained';
export const FACES: readonly Face[] = ['neutral', 'worried', 'stern', 'wry', 'afraid', 'grim', 'kind', 'pained'];

/** Story music moods a line may call for (mapped to the adaptive music's story states). */
export type StoryMusic = 'calm' | 'tense' | 'sorrow' | 'silent';

/**
 * Presentation effects a line may carry (UIX-0133). They fire when the line is entered and are
 * executed by `StoryScene`; none of them changes the line's id or its text.
 */
export interface LineEffects {
  /** Expression the speaker's portrait takes for this line; missing = `neutral` (UIX-0129). */
  face?: Face;
  /** Screen shake strength 0..1 (decays over ~0.8 s; scaled by the player's screen-shake setting). */
  shake?: number;
  /** A white flash 0..1 (softened and slowed when Reduced Flashing is on). */
  flash?: number;
  /** `out` fades the scene to black and holds; `in` lifts it again. The text box stays readable. */
  fade?: 'in' | 'out';
  /** Full-screen illustration (a backdrop key) shown in place of the staged scene until `cg: 'off'`. */
  cg?: Backdrop | 'off';
  /** A document held up over the scene (NAR-0057) until `prop: 'off'`. */
  prop?: 'writ' | 'off';
  /** Sound event to play (src/audio/events.ts ids, or a legacy cue name). */
  sfx?: string;
  /** Music mood to move to. */
  music?: StoryMusic;
}

export interface Line extends LineEffects {
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

/** Options of the `say` builder: a display-name override plus any line effects. */
export interface SayOpts extends LineEffects {
  as?: string;
}

export type Backdrop = 'hospice' | 'street' | 'theatre' | 'chapel' | 'night' | 'camp' | 'apothecary' | 'alley' | 'guildhall' | 'tent' | 'graveyard' | 'orecamp' | 'forest' | 'abbey' | 'dawn';

export interface StoryDef {
  id: string;
  place: string;
  /** Time of the scene, lettered under the place on the opening location card (UIX-0132): "before Matins". */
  when?: string;
  backdrop: Backdrop;
  /** Lighting variant for the backdrop (defaults per location). */
  lighting?: 'day' | 'dusk' | 'night';
  lines: Line[];
}

/** Terse line builders keep scripts readable. */
export const n = (text: string, fx?: LineEffects): Line => ({ who: 'narrator', text, ...fx });
/** A spoken line. The third argument is a display-name override (string) or `{ as, face, shake, … }` (UIX-0129/0133). */
export const say = (who: CharacterId, text: string, opts?: string | SayOpts): Line => (typeof opts === 'string' ? { who, text, as: opts } : { who, text, ...opts });
/** A choice line: `who` frames the prompt `text`; the player picks one of 2–3 `options`. */
export const choose = (who: CharacterId, text: string, options: readonly ChoiceOption[], as?: string): Line => ({ who, text, as, choice: options });
/** Mark lines as conditional on the flags (nested: both must hold). Returns them for spreading into a `lines` array. */
export const onlyIf = (cond: FlagCondition, ...lines: Line[]): Line[] => lines.map((l) => ({ ...l, if: l.if ? { all: [cond, l.if] } : cond }));
