import { Bubo, Burn, Embedded, Grub, Incision, Laceration, Rot, Sigil, SIGILS, Venom } from '../surgery/entities';
import { EggSac, LaudsMalison } from '../surgery/lauds';
import type { Operation, OperationDef } from '../surgery/operation';
import { at, closeIncision } from './chapter1';
import type { Chapter } from './campaign';
import { n, say, type StoryDef } from './story';
import { when } from './conditions';

const hiddenShard = (x: number, y: number, a: number, kind: 'hexstone' | 'glass' | 'shard' = 'hexstone') => {
  const e = new Embedded(at(x, y), kind, a, false);
  e.hidden = true;
  return e;
};

/** Three parallel claw rakes. */
const clawRake = (x: number, y: number, angle: number, len = 90) =>
  [-1, 0, 1].map((i) => new Laceration(at(x - Math.sin(angle) * i * 26, y + Math.cos(angle) * i * 26), angle, len - Math.abs(i) * 14, 0.8));

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
    say('mauer', 'Forager. Went to check his snares near the old web-trees. We found him wrapped up like a midwinter ham.'),
    say('patient', '…the brood-mother… she kissed me… she was so gentle about it…', 'Henning'),
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
      say('stroh', 'I counted.'),
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

const ALL = ['lancet', 'tongs', 'leech', 'thread', 'salve', 'tincture', 'brand', 'lens'] as const;

export const OP_2_1: OperationDef = {
  id: 'op2-1',
  title: 'Gravehound',
  patient: 'Tomas, scout',
  diagnosis: 'Mauled by a corpse-eating hound. Claw rakes across the back, fangs lodged in the shoulder, venom spreading from the bite.',
  organ: 'flesh',
  timeLimit: 240,
  tools: ['lancet', 'tongs', 'leech', 'thread', 'salve', 'tincture'],
  ranks: { S: 4850, A: 3900, B: 2900 },
  litany: true,
  seed: 21,
  phases: [
    {
      callout: ['The venom first — hold the tincture on the bite until it takes.', 'The longer it spreads, the harder it drags on him.'],
      spawn: (op: Operation) => [new Venom(at(-120, -30), op, 7)],
    },
    {
      callout: ['Now the fangs. Tongs — pull each one clear.'],
      spawn: () => [new Embedded(at(-150, -50), 'tooth', 0.9, false), new Embedded(at(-100, -10), 'tooth', 1.2, false), new Embedded(at(-80, -60), 'tooth', 0.6, false)],
    },
    {
      callout: ['Claw rakes. Three deep lines — drain and stitch each.'],
      spawn: () => clawRake(110, 20, -0.5, 100),
    },
  ],
};

export const OP_2_2: OperationDef = {
  id: 'op2-2',
  title: 'The Black Seam',
  patient: 'Orsa Flintvein, dwarf prospector',
  race: 'dwarf',
  diagnosis: 'Cave-in at a hexstone seam. Shards driven beneath the skin, invisible to the eye. Surrounding flesh spoiling.',
  organ: 'flesh',
  timeLimit: 270,
  baseDrain: 0.1,
  tools: ALL,
  ranks: { S: 5650, A: 4500, B: 3400 },
  litany: true,
  seed: 22,
  phases: [
    {
      callout: ['Rock splinters on the surface first. Tongs.'],
      spawn: () => [new Embedded(at(-160, 60), 'shard', 2.4, false), new Embedded(at(150, -70), 'shard', -0.6, false), new Embedded(at(40, 90), 'glass', 1.1, false)],
    },
    {
      callout: ['Now — the Scrying Lens. Pass it slowly over the flesh; where something hides, it shimmers.', 'Hold it still over the shimmer to bring the shard to light, then pull it.'],
      spawn: () => [hiddenShard(-120, -40, 0.4), hiddenShard(90, 30, 2.1), hiddenShard(0, -100, -1.2), new Rot(at(-110, -30), 40, 0.4)],
    },
    {
      callout: ['Clean up the spoiled flesh and any wounds left.'],
      spawn: () => [new Rot(at(120, 60), 45, 0.5), new Laceration(at(-30, 110), 0.2, 70, 0.6)],
    },
  ],
};

export const OP_2_3: OperationDef = {
  id: 'op2-3',
  title: 'Brood-Mother’s Kiss',
  patient: 'Henning, forager',
  diagnosis: 'Web-spinner bite. Neurotoxic venom spreading from the neck; several egg sacs laid beneath the skin.',
  organ: 'flesh',
  timeLimit: 240,
  baseDrain: 0.15,
  tools: ALL,
  ranks: { S: 6750, A: 5400, B: 4050 },
  litany: true,
  seed: 23,
  phases: [
    {
      callout: ['Venom from two bites. Tincture on each, quickly.'],
      spawn: (op: Operation) => [new Venom(at(-60, -80), op, 9), new Venom(at(70, -90), op, 9)],
    },
    {
      callout: ['The sacs — lance each one with a single touch, then sear the hatchlings with the brand.', 'Mind the ones that are close to hatching.'],
      spawn: () => [new EggSac(at(-170, 30), 3, 16), new EggSac(at(0, 70), 3, 22), new EggSac(at(170, 10), 3, 28)],
    },
    {
      callout: ['One more sac, deeper. Use the lens to find it, then open it.', 'And he’s taken a fever-bubo from the bite — lance and cleanse it.'],
      spawn: () => {
        const deep = new EggSac(at(90, 90), 4, 30);
        deep.hidden = true;
        return [deep, new Bubo(at(-120, -40), 22)];
      },
    },
  ],
};

export const OP_2_4: OperationDef = {
  id: 'op2-4',
  title: 'The Silenced Cantor',
  patient: 'A lay-cantor of the Hollow Choir',
  diagnosis: 'Silence-sigils igniting across the chest (hexfire). Self-administered poison. Prisoner of the Ash Tribunal.',
  organ: 'flesh',
  timeLimit: 300,
  baseDrain: 0.2,
  vitals: 80,
  tools: ALL,
  ranks: { S: 5950, A: 4750, B: 3550 },
  litany: true,
  seed: 24,
  phases: [
    {
      callout: ['The poison he swallowed — tincture, now, or he’s gone before we start.'],
      spawn: (op: Operation) => [new Venom(at(0, 20), op, 5)],
    },
    {
      callout: ['Those sigils are burning him from within. Sear each one out — every stroke.'],
      spawn: () => [new Sigil(at(-160, -20), SIGILS.crown, 55, 4.5), new Sigil(at(160, -10), SIGILS.hourglass, 55, 4.5), new Sigil(at(0, -90), SIGILS.eye, 50, 4.5)],
    },
    {
      callout: ['The hexfire burns. Pluck the eschar, then salve them.'],
      spawn: (op: Operation) => [new Burn(at(-150, 60), 44, op, 'hexfire'), new Burn(at(150, 70), 40, op, 'hexfire'), new Burn(at(10, 100), 36, op, 'hexfire')],
    },
    {
      callout: ['Maggots in an old sore — the Tribunal’s cells are filthy. Brand them.'],
      spawn: (op: Operation) => [new Grub(at(-40, 20), op, 45), new Grub(at(50, 30), op, 45), new Rot(at(0, 30), 50, 0.4)],
    },
  ],
};

export const OP_2_5: OperationDef = {
  id: 'op2-5',
  title: 'The Hour of Lauds',
  patient: 'Jorg, standard-bearer',
  diagnosis: 'Collapsed during the dawn hymn. Something beneath the sternum is singing.',
  organ: 'flesh',
  timeLimit: 420,
  baseDrain: 0.1,
  tools: ALL,
  ranks: { S: 7600, A: 6100, B: 4550 },
  litany: true,
  seed: 25,
  phases: [
    {
      callout: ['We have to open him — along the line, Doctor.'],
      spawn: () => [new Incision([at(-190, 20), at(-70, -10), at(70, -10), at(190, 20)])],
    },
    {
      callout: [
        'Saints… it has a choir. Those little lights are its Voices — hold the brand on each as it circles.',
        'Silence all of them and its heart will be bare.',
      ],
      spawn: (op: Operation) => [new LaudsMalison(at(0, 30), op)],
    },
    {
      callout: ['It’s done. Tend what it left of him.'],
      spawn: (op: Operation) => [new Laceration(at(-110, 80), 0.3, 60, 0.7), new Laceration(at(120, -70), 2.4, 55, 0.7), new Rot(at(20, 90), 40, 0.4), new Grub(at(0, 0), op, 40)],
    },
    closeIncision(['Close him up. Gently — he has a banner to carry.']),
  ],
};

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
