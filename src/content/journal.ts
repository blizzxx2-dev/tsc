/**
 * Kreuzer's journal (NAR-0094): one page per ending, in his own hand, read after the epilogue
 * cards. The Perfect End's page is written in the silence, before he tries the Office again.
 */
import { endingIs, PERFECT_JOURNAL } from './endings';
import { onlyIf, say, type Line, type StoryDef } from './story';

const page = (lines: string[]): Line[] => lines.map((l) => say('kreuzer', l));

export const JOURNAL: Record<'pardon' | 'pyre' | 'exile' | 'perfect', readonly string[]> = {
  pardon: [
    'From the journal of Dr. Kreuzer, the first of Wonnemond.',
    'The warrant is withdrawn, the pyre is firewood, and Stroh burned his ledger in a very small fire.',
    'I did not know he could be kind. I do not think he did either.',
    'Aurel asks for the patients every morning. I have started sending him their names. It seems the least a surgeon can do for another.',
    'Ilse says the drover will live. She says it as if there were ever any doubt. There is always doubt. That is the whole of the work.',
    'Tonight I will not draw the star. I will sit by the ward window and listen to the city complain, and cough, and go on.',
  ],
  pyre: [
    'From the journal of a man with no licence, the first of Wonnemond.',
    'I was to burn this morning. A drover, a scout, a founder’s widow and the whole of the Watch declined to allow it.',
    'I have never been so politely rescued.',
    'Stroh says the sentence stands. So do I, apparently.',
    'We stood facing each other at the east gate for an hour, and neither of us knew what to do next.',
    'The sign on the door says NO SURGEON. The queue goes round the block.',
    'Haller says I am the most successful unlicensed practitioner in the history of the Guild.',
    'I think the city decided something today that its courts could not. I think it was that a man is what he does with his hands.',
  ],
  exile: [
    'From the journal of Dr. Kreuzer, somewhere on the north road.',
    'The sentence stands, and so we go. Ilse drives. Orsa sings, badly and without any sorcery at all, which is a comfort.',
    'Stroh watched us from the wall and sent no riders. I owe him more than candles. I shall never be able to tell him so.',
    'Aurel lives. The hospice lives. Haller writes that the new surgeon is terrible, which means she is good, and he is afraid of liking her.',
    'There will be wounds in the delvings. There are wounds everywhere. That is the only map a surgeon needs.',
  ],
  perfect: PERFECT_JOURNAL,
};

/** The journal page after the epilogue, one per won ending. */
export const JOURNAL_STORY: StoryDef = {
  id: 's5-journal',
  place: 'From the journal of Dr. Kreuzer',
  backdrop: 'hospice',
  lines: [...onlyIf(endingIs('pardon'), ...page([...JOURNAL.pardon])), ...onlyIf(endingIs('pyre'), ...page([...JOURNAL.pyre])), ...onlyIf(endingIs('exile'), ...page([...JOURNAL.exile]))],
};
