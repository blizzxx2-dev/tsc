import type { CharacterId } from './characters';

export interface Line {
  who: CharacterId;
  text: string;
  /** Override the speaker's display name (e.g. a named patient). */
  as?: string;
}

export type Backdrop = 'hospice' | 'street' | 'theatre' | 'chapel' | 'night' | 'camp';

export interface StoryDef {
  id: string;
  place: string;
  backdrop: Backdrop;
  lines: Line[];
}

/** Terse line builders keep scripts readable. */
export const n = (text: string): Line => ({ who: 'narrator', text });
export const say = (who: CharacterId, text: string, as?: string): Line => ({ who, text, as });
