/**
 * The Litany of Stillness and its sister rites. All share the same five-pointed
 * star; which rite answers is chosen before the operation (kit loadout), so the
 * gesture never changes.
 */
export type LitanyVariant = 'stillness' | 'vigil' | 'mercy' | 'wrath';

export interface LitanyInfo {
  id: LitanyVariant;
  name: string;
  /** Chapter whose clearing teaches this rite (1 = known from the start of the Litany tutorial). */
  unlockChapter: number;
  effect: string;
}

export const LITANIES: Record<LitanyVariant, LitanyInfo> = {
  stillness: { id: 'stillness', name: 'Litany of Stillness', unlockChapter: 1, effect: 'The world slows to a crawl for eight heartbeats. Your hands do not.' },
  vigil: { id: 'vigil', name: 'Litany of Vigil', unlockChapter: 3, effect: 'For six heartbeats every hidden thing in the flesh stands revealed.' },
  mercy: { id: 'mercy', name: 'Litany of Mercy', unlockChapter: 4, effect: 'For six heartbeats the patient loses no blood, though time runs on.' },
  wrath: { id: 'wrath', name: 'Litany of Wrath', unlockChapter: 5, effect: 'For six heartbeats the cautery brand bites twice as deep.' },
};

export const LITANY_ORDER: readonly LitanyVariant[] = ['stillness', 'vigil', 'mercy', 'wrath'];

/** Rites available once the given chapter (1-based) has been cleared. */
export const unlockedLitanies = (chaptersCleared: number): LitanyVariant[] =>
  LITANY_ORDER.filter((v) => LITANIES[v].unlockChapter <= Math.max(1, chaptersCleared));
