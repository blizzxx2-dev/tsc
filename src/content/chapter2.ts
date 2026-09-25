import { OP_2_1, OP_2_2, OP_2_3, OP_2_4, OP_2_5 } from './ops/ch2';
import type { Chapter } from './campaign';
import { n, say, type StoryDef } from './story';
import { when } from './conditions';

// ====================================================================== stories

export const STORY_2_1: StoryDef = {
  id: 's2-1',
  place: 'The Timber Road — the Watch’s muster camp, three leagues east of Kessendorf',
  backdrop: 'camp',
  lines: [
    n('CHAPTER II — THE HOUR OF LAUDS'),
    n('A week after the page-boy, a writ arrives under the Watch’s seal: the hospice’s surgeon is requisitioned for the muster.'),
    say('mauer', 'Don’t look at me like that, Doctor. The Inquisitor dines with the Burgomaster on Thursdays. On Fridays, the Burgomaster signs things.'),
    say('ilse', 'So Stroh can watch you somewhere with fewer witnesses.'),
    say('mauer', 'Fewer? Forty men in this camp, Sister. Forty witnesses. Forty-one with the cook, and I don’t count the cook.'),
    say('ilse', 'You count everyone, Captain. You counted the mules.'),
    say('mauer', 'The mules keep better order. We clear the Grauwald of raiders before the spring caravans. Two scouts came back from the barrow-fields.'),
    say('mauer', 'Something followed them out.'),
    say('ilse', 'A gravehound. Claw rakes across his back — and it has left its teeth in him.'),
    say('kreuzer', 'Corpse-eaters carry a venom in their spit. Tomas, isn’t it? Look at me, Tomas. You’ll keep the arm.'),
  ],
};

export const STORY_2_2: StoryDef = {
  id: 's2-2',
  place: 'The muster camp — afternoon',
  backdrop: 'camp',
  lines: [
    say('patient', 'Put me down, you long-legged oafs! I can walk! I can… mostly walk.', 'Orsa Flintvein'),
    say('mauer', 'Dwarf prospector. Her crew was working a seam in the hills when it caved in.'),
    say('patient', 'The rock went black, Doctor. Black as a wet eye, and it had a pulse. It sang when we struck it. Then it burst.', 'Orsa Flintvein'),
    say('ilse', 'Mind her beard, Doctor. Every knot in it is tied for a debt.'),
    say('patient', 'Nineteen knots. Nine are owed to me, ten I owe. If I die owing ten, my sons pay them, and my sons are idle.', 'Orsa Flintvein'),
    say('ilse', 'There are shards under her skin I can’t see — but the flesh around them is spoiling.'),
    say('ilse', 'Master Haller sent his old Scrying Lens with me. He says you are to break anything else of his first.'),
    say('patient', 'Dwarf hide’s thicker than yours, lad. You’ll want a strong arm on that thread.', 'Orsa Flintvein'),
    say('kreuzer', 'Hold still, Mistress Flintvein, and I’ll owe you a knot.'),
  ],
};

export const STORY_2_3: StoryDef = {
  id: 's2-3',
  place: 'The muster camp — night',
  backdrop: 'night',
  lines: [
    n('Orsa sleeps in the supply wagon, snoring like a bellows. The sentries swear it keeps the wolves off.'),
    say('mauer', 'Elf forager. Went to check his snares by the old web-trees. We found him wrapped up like a midwinter ham.'),
    say('patient', '…the brood-mother… she kissed me… she was so gentle about it…', 'Ilvaren'),
    say('ilse', 'Elf skin, Doctor — thin as vellum. It cuts at a breath and bleeds like a spring.'),
    say('ilse', 'The foresters call the great web-spinners brood-mothers. Venom, spreading fast. And these lumps… Saints. She laid in him.'),
    say('mauer', 'My lads won’t fetch water past the web-trees now. They say a brood-mother remembers every face that has seen her.'),
    say('kreuzer', 'Then fetch my water from somewhere she hasn’t looked, Captain. And more light.'),
    say('ilse', 'The sacs are swelling, Doctor. If they hatch on their own, they’ll scatter.'),
  ],
};

export const STORY_2_4: StoryDef = {
  id: 's2-4',
  place: 'The muster camp — before midnight',
  backdrop: 'camp',
  lines: [
    say('stroh', 'Doctor. I have brought you a gift.'),
    n('Two of the Inquisitor’s men drag a thin, grey-robed figure into the light. His chest is a lattice of glowing sigils.'),
    say('stroh', 'A lay-cantor of the Hollow Choir. We took him in the barrow-fields, singing to the dead. Something in the barrows sang back.'),
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
    say('patient', 'Lauds… is sung at dawn… with the muster… under the banner…', 'The cantor'),
    say('mauer', 'The dawn muster? That’s now—'),
    n('Across the camp, forty voices sing up the dawn. Beneath them, two more voices begin: one calling, one answering.'),
    say('choir', 'Who keeps the watch before the sun?', 'The first voice'),
    say('choir', 'The one who wakes, and wakes alone.', 'The answering voice'),
    say('choir', 'Who sings the day when day is done?', 'The first voice'),
    say('choir', 'The one we answer, bone to bone.', 'The answering voice'),
    n('The standard-bearer drops to his knees, the banner falling across him. The hymn falters. The two voices do not.'),
    say('ilse', 'Doctor! It’s Jorg — there are two of them in his chest, and each one answers the other!'),
    say('kreuzer', 'Clear a table. Sister — every instrument we have.'),
  ],
};

export const STORY_2_END: StoryDef = {
  id: 's2-end',
  place: 'The muster camp — morning',
  backdrop: 'chapel',
  lines: [
    n('The singing stops. The standard-bearer breathes. In the flesh over his heart, a single word: LAUDS.'),
    say('ilse', 'And beside it — Doctor, look. An eye with a stroke through it. The same mark the page-boy carried.'),
    say('mauer', 'Two of them now. Matins in the city, Lauds in my own camp. Someone is keeping time, Doctor.'),
    say('ilse', 'Six more hours to the full Office. Prime. Terce. Sext. None. Vespers. Compline.'),
    n('In the ward tent a wounded pikeman hums the dawn hymn in his sleep. Two notes. Then, from nowhere, the answer.'),
    say('stroh', 'Doctor Kreuzer.'),
    ...when(
      { litany: true },
      say('stroh', 'When that thing screamed, every candle in this tent stopped flickering. The flames stood still. For eight heartbeats.'),
      { ...say('stroh', 'I counted.'), stamp: 'suspect' },
      say('kreuzer', '…The morning air is very still, Inquisitor.'),
    ),
    ...when(
      { litany: false },
      say('stroh', 'I watched your hands while that thing screamed. They shook, Doctor. For once.'),
      say('kreuzer', 'It was a long night, Inquisitor.'),
    ),
    say('stroh', 'We will speak at length, you and I. After Prime.'),
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
