/**
 * Chapter-select recaps (NAR-0161): three sentences of "previously" read before a chapter started
 * from the chapter select, so a player coming back after a break is not dropped in cold.
 * Keyed by the id of the chapter about to start; Chapter I has nothing before it.
 */
import { n, type StoryDef } from './story';

export const RECAPS: Record<string, readonly [string, string, string]> = {
  ch2: [
    'In the winter of the ninth year of the Long Muster, Dr. Kreuzer took up the knife at the Hospice of Saint Ildra in Kessendorf.',
    'A page-boy came in with a mark under his skin that sang, and Kreuzer drew the forbidden star to cut the Malison of Matins out of him.',
    'Inquisitor Stroh of the Ash Tribunal saw a candle stop flickering, and has not stopped watching since.',
  ],
  ch3: [
    'The Watch marched to the barrow-fields with Kreuzer as its surgeon, and brought home a cantor whose chest was a lattice of sigils.',
    'At the muster, the Malison of Lauds sang through its host until Kreuzer silenced it — some say by the Litany, in front of witnesses.',
    'Stroh has promised they will speak after Prime. It is after Prime.',
  ],
  ch4: [
    'In the Kilnrows, Kreuzer examined a hornchild for the Tribunal and wrote a certificate that will follow him.',
    'The Guild put his licence to a vote, and Master Haller stood up for him with hands the hexfire of Terce had burned.',
    'Now Kessendorf hires out its war, and the Watch marches east to the Vennmark with its surgeon in the second wagon.',
  ],
  ch5: [
    'In the rain of the Vennmark, Kreuzer kept Mauer’s men alive through Sext and None, in tents that never stopped leaking.',
    'The council roll showed Stroh’s charter had lapsed at the new year; what the Tribunal did since, it did on nothing.',
    'They came home to Kessendorf three days before Hollow Night, and a warrant with the Doctor’s name on it.',
  ],
};

/** The recap as a short story scene (narration only), or null for a chapter with none. */
export function recapStory(chapterId: string, numeral: string): StoryDef | null {
  const r = RECAPS[chapterId];
  if (!r) return null;
  return { id: `recap-${chapterId}`, place: `Previously — before Chapter ${numeral}`, backdrop: 'chapel', lines: r.map((l) => n(l)) };
}
