import { OP_2_1, OP_2_2, OP_2_3, OP_2_4, OP_2_5 } from './ops/ch2';
import type { Chapter } from './campaign';
import { n, say, type StoryDef } from './story';

// ====================================================================== stories

export const STORY_2_1: StoryDef = {
  id: 's2-1',
  place: 'The Timber Road — the Watch’s muster camp, three leagues east of Kessendorf',
  backdrop: 'camp',
  lines: [
    n('CHAPTER II — THE HOUR OF LAUDS'),
    n('A week after the page-boy, a writ arrives with the Watch’s seal: the hospice’s surgeon is requisitioned for the muster.'),
    say('mauer', 'Don’t look at me like that, Doctor. I didn’t ask for you. The Inquisitor “suggested” it to the Burgomaster.'),
    say('ilse', 'So he can watch you somewhere with fewer witnesses.'),
    say('mauer', 'We’re clearing the Grauwald of raiders before the spring caravans. My lads need a surgeon more than a city needs rumours.'),
    say('mauer', 'Speaking of which — the scouts came back. Two of them. Something followed them out of the barrow-fields.'),
    say('ilse', 'Doctor, it’s a gravehound bite. Claw rakes across the back, and — look — it left its teeth in him.'),
    say('ilse', 'Corpse-eaters carry a venom in their spit. Hold the tincture to the bite itself and it will draw the poison.'),
  ],
};

export const STORY_2_2: StoryDef = {
  id: 's2-2',
  place: 'The muster camp — afternoon',
  backdrop: 'camp',
  lines: [
    n('The scout will limp, but he will limp home.'),
    say('patient', 'Put me down, you long-legged oafs! I can walk! I can… mostly walk.', 'Orsa Flintvein'),
    say('mauer', 'Dwarf prospector. Her crew was working a seam in the hills when it caved in.'),
    say('patient', 'The rock went black, Doctor. Black and wrong, like a bruise in the stone. It sang when we struck it. Then it burst.', 'Orsa Flintvein'),
    say('ilse', 'There are shards under her skin that I can’t see — but the flesh around them is spoiling.'),
    say('ilse', 'Master Haller sent this with me. His old Scrying Lens. Pass it slowly over the flesh and it shows what hides beneath.'),
    say('patient', 'Dwarf hide’s thicker than yours, lad. You’ll want a strong arm on that thread.', 'Orsa Flintvein'),
  ],
};

export const STORY_2_3: StoryDef = {
  id: 's2-3',
  place: 'The muster camp — night',
  backdrop: 'night',
  lines: [
    n('Orsa sleeps in the supply wagon, snoring like a bellows. She has promised to name a mine after the Doctor. It will probably be a bad one.'),
    say('mauer', 'Forager. Went to check his snares near the old web-trees. We found him wrapped up like a Martinmas ham.'),
    say('ilse', 'A web-spinner bite. Venom, spreading fast. And these lumps under the skin… Saints. She laid in him.'),
    say('ilse', 'Lance the sacs before they hatch, Doctor, and sear what spills out. If they hatch on their own, they’ll scatter.'),
  ],
};

export const STORY_2_4: StoryDef = {
  id: 's2-4',
  place: 'The muster camp — before midnight',
  backdrop: 'camp',
  lines: [
    say('stroh', 'Doctor. I have brought you a gift.'),
    n('Two of the Inquisitor’s men drag a thin, grey-robed figure into the light. His chest is a lattice of glowing sigils.'),
    say('stroh', 'A lay-cantor of the Hollow Choir. We took him in the barrow-fields, singing to the dead.'),
    say('stroh', 'The moment he began to confess, those marks ignited. His masters would rather he burned than spoke.'),
    say('stroh', 'He also swallowed something. You will keep him alive. I have questions, and the dead are poor at answering them.'),
    say('ilse', '…Doctor. Whatever he is, he’s a patient.'),
    say('kreuzer', 'On the table. Now.'),
  ],
};

export const STORY_2_5: StoryDef = {
  id: 's2-5',
  place: 'The muster camp — dawn',
  backdrop: 'camp',
  lines: [
    n('The cantor lived long enough to whisper one thing, before Stroh’s men took him away.'),
    say('patient', 'Lauds… is sung at dawn… with the muster… under the banner…', 'The cantor'),
    say('mauer', 'The dawn muster? That’s now — the whole company’s singing the morning hymn—'),
    n('Across the camp, the hymn falters. The standard-bearer drops to his knees, the banner falling across him.'),
    say('ilse', 'Doctor! It’s Jorg, the standard-bearer — his chest is moving… it’s singing back!'),
    say('kreuzer', 'Clear a table. Sister — every instrument we have.'),
  ],
};

export const STORY_2_END: StoryDef = {
  id: 's2-end',
  place: 'The muster camp — morning',
  backdrop: 'chapel',
  lines: [
    n('The singing stops. The standard-bearer breathes. In the flesh over his heart, a single word: LAUDS.'),
    say('mauer', 'Two of them now. Matins in the city, Lauds in my own camp. Someone is keeping time, Doctor.'),
    say('ilse', 'Six more hours to the full Office. Prime. Terce. Sext. None. Vespers. Compline.'),
    say('stroh', 'Doctor Kreuzer.'),
    say('stroh', 'When that thing screamed, every candle in this tent stopped flickering. The flames stood still. For eight heartbeats.'),
    say('stroh', 'I counted.'),
    say('kreuzer', '…The morning air is very still, Inquisitor.'),
    say('stroh', 'So it is. We will speak at length, you and I. After Prime.'),
    n('END OF CHAPTER II — THE HOUR OF LAUDS'),
  ],
};

// ====================================================================== operations
// Written as data (CON-0001): src/content/ops/ch2.ts.

export { OP_2_1, OP_2_2, OP_2_3, OP_2_4, OP_2_5 };

export const CHAPTER_2: Chapter = {
  id: 'ch2',
  numeral: 'II',
  title: 'The Hour of Lauds',
  steps: [
    { kind: 'story', story: STORY_2_1 },
    { kind: 'op', op: OP_2_1 },
    { kind: 'story', story: STORY_2_2 },
    { kind: 'op', op: OP_2_2 },
    { kind: 'story', story: STORY_2_3 },
    { kind: 'op', op: OP_2_3 },
    { kind: 'story', story: STORY_2_4 },
    { kind: 'op', op: OP_2_4 },
    { kind: 'story', story: STORY_2_5 },
    { kind: 'op', op: OP_2_5 },
    { kind: 'story', story: STORY_2_END },
  ],
};
