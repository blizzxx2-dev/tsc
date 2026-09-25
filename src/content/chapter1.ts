import { Bubo, Burn, Embedded, Grub, Incision, Laceration, Rot, Sigil, SIGILS } from '../surgery/entities';
import { Malison } from '../surgery/malison';
import { FIELD, type Operation, type OperationDef } from '../surgery/operation';
import type { Vec } from '../core/math';
import { n, say, type StoryDef } from './story';

/** Position relative to the centre of the operating field. */
export const at = (dx: number, dy: number): Vec => ({ x: FIELD.cx + dx, y: FIELD.cy + dy });

const incisionOf = (op: Operation): Incision | undefined => op.entities.find((e): e is Incision => e instanceof Incision);

/** Final phase shared by every open operation: stitch the incision shut. */
export const closeIncision = (lines = ['Everything’s clear. Close the incision with the thread.']) => ({
  callout: lines,
  spawn(op: Operation) {
    incisionOf(op)?.beginClosing();
    return [];
  },
});

// ====================================================================== stories

export const PROLOGUE: StoryDef = {
  id: 'prologue',
  place: 'Kessendorf — the Hospice of Saint Ildra the Merciful',
  backdrop: 'hospice',
  lines: [
    n('The Free City of Kessendorf. Winter, in the ninth year of the Long Muster.'),
    n('The river has frozen twice. The pyres outside the east gate have not gone out since autumn.'),
    say('haller', 'So. You are the new sawbones the Guild sent me. Kreuzer, is it?'),
    say('kreuzer', 'Apothecary-surgeon, sworn at Weissburg. I have my letters, Master Haller—'),
    say('haller', 'Letters. Letters don’t stop a man bleeding into the straw. Hands do. Show me your hands.'),
    say('haller', '…Steady enough. Sister! Our young doctor has arrived just in time for the Tuesday knife-fights.'),
    say('ilse', 'Sister Ilse, of the Merciful Order. I keep the instruments, the ledgers, and the Master’s temper.'),
    say('ilse', 'There’s a drover on the table already. Somebody at the Gilded Goose disagreed with his dice.'),
    say('haller', 'Knife wounds. Simple work. Stitch him, drain him, salve him. I’ll watch.'),
    say('haller', 'And Kreuzer — in this hospice we do not lose patients to simple work.'),
  ],
};

export const STORY_1_2: StoryDef = {
  id: 's1-2',
  place: 'The Hospice — the next morning',
  backdrop: 'hospice',
  lines: [
    n('The drover lived. He paid in turnips and a promise not to gamble again. He will break it by Friday.'),
    say('mauer', 'Make way! Make way, damn you! Surgeon! Where’s the surgeon?'),
    say('ilse', 'Captain Mauer of the Watch. Lower your voice, Captain, this is a house of mercy.'),
    say('mauer', 'Horned raiders hit the timber-road caravan at dawn. We drove them off, but young Pieter took a shaft in the side.'),
    say('haller', 'Beast-folk fletch their arrows with barbed heads. Rip one straight out and you’ll tear half his side with it.'),
    say('haller', 'Nick the flesh at the entry with the lancet — twice — to free the barbs. Then pull. Cleanly.'),
  ],
};

export const STORY_1_3: StoryDef = {
  id: 's1-3',
  place: 'The Hospice — noon',
  backdrop: 'hospice',
  lines: [
    n('Pieter will keep his side, and his opinion of beast-folk.'),
    say('ilse', 'Doctor, the gunsmiths’ quarter. An apprentice was proving a new handgun barrel and it burst in his hands.'),
    say('ilse', 'Burns across the chest and lead fragments driven under the skin.'),
    say('haller', 'Powder burns. The charred skin is dead — pluck the eschar away with tongs before you salve, or it festers.'),
    say('haller', 'The shot is in deep. You’ll have to open him. Trace the line I’ve inked, and keep your hand true.'),
    say('haller', 'He’s lost blood already. If his pulse flags, the tincture — hold it to the flesh and let it take.'),
  ],
};

export const STORY_1_4: StoryDef = {
  id: 's1-4',
  place: 'The Hospice — dusk',
  backdrop: 'street',
  lines: [
    n('Word travels fast in Kessendorf. By dusk, there is a queue at the hospice door.'),
    say('ilse', 'Doctor… this one was found in the Tanners’ Rows. Swellings at the neck and groin. Fever. Maggots in a sore.'),
    say('haller', 'Buboes. Lance them before they burst, draw off the pus, and salve the wound. Rot-patches creep back if you dawdle.'),
    say('haller', 'And the grubs — the cautery brand. Hold it on them until they stop wriggling. Mind you don’t sear good flesh.'),
    say('stroh', 'A plague case. In the city. How very interesting.'),
    say('ilse', '…Inquisitor Stroh. Of the Order of the Pyre.'),
    say('stroh', 'Please, do carry on, Doctor. I only wish to watch. Pestilence so often has a sponsor.'),
  ],
};

export const STORY_1_5: StoryDef = {
  id: 's1-5',
  place: 'The Hospice — the small hours',
  backdrop: 'night',
  lines: [
    n('Near midnight a carriage without a crest stops at the gate. A page-boy is carried in, raving.'),
    say('patient', 'The choir… they’re singing in me… make them stop singing…', 'Page-boy Emmerich'),
    say('ilse', 'Doctor, look at his chest. Those marks — they’re moving.'),
    say('haller', '…That is no disease. Those are sigils. Someone has written on this boy.'),
    say('haller', 'Kreuzer. Listen to me carefully. Sear the sigils out with the brand — trace every stroke.'),
    say('haller', 'And if something… answers… when you do — there is an old apothecary’s rite. The Litany of Stillness.'),
    say('haller', 'Trace the five-pointed star and still your heart. For a few breaths, the world will wait for you.'),
    say('haller', 'Do not do it where the Inquisitor can see. The Pyre does not distinguish between a prayer and a spell.'),
  ],
};

export const STORY_1_END: StoryDef = {
  id: 's1-end',
  place: 'The Hospice — before dawn',
  backdrop: 'chapel',
  lines: [
    n('The thing in the boy’s chest came apart like wet ash. The boy sleeps. He no longer hears singing.'),
    say('ilse', 'Doctor… after it broke, a word was left seared into the flesh. Matins.'),
    say('haller', 'The first of the canonical hours. The first prayer of the night.'),
    say('haller', 'A curse that lives and fights like a beast, and signs itself like a psalm. A Malison.'),
    say('haller', 'And if this was Matins… then somewhere, someone is already writing Lauds.'),
    say('stroh', 'A remarkable recovery, Doctor. Remarkable.'),
    say('stroh', 'Tell me — at the end, your hands moved so very quickly. Almost as if time itself were… obliging you.'),
    say('kreuzer', 'Practice, Inquisitor. And the grace of Saint Ildra.'),
    say('stroh', 'Of course. The grace of the Saint. I shall pray on it.'),
    n('END OF CHAPTER I — THE HOUR OF MATINS'),
  ],
};

// ====================================================================== operations

const ALL_BUT_LENS = ['lancet', 'tongs', 'leech', 'thread', 'salve', 'tincture', 'brand'] as const;

export const OP_1_1: OperationDef = {
  id: 'op1-1',
  title: 'A Tavern Knife',
  patient: 'Jost, drover',
  diagnosis: 'Knife wounds to the forearm and flank after a dice dispute. Moderate bleeding.',
  organ: 'flesh',
  timeLimit: 180,
  tools: ['thread', 'leech', 'salve'],
  ranks: { S: 3950, A: 3150, B: 2350 },
  litany: false,
  seed: 11,
  phases: [
    {
      callout: ['Two deep cuts. Take the gut thread and zig-zag across each wound to stitch it.', 'Cross the wound again and again, moving along it. One smooth stroke earns the best marks.'],
      spawn: () => [new Laceration(at(-140, -40), 0.3, 120, 0.5), new Laceration(at(130, 50), -0.4, 100, 0.5)],
    },
    {
      callout: ['Blood’s pooling. Hold the leech-pipe over it to draw it off.', 'You can’t stitch through a pool of blood — drain first.'],
      spawn: () => [new Laceration(at(0, 20), 1.2, 110, 0.9)],
    },
    {
      callout: ['Just nicks left. Brush Saint’s Salve over the small ones — no need for thread.'],
      spawn: () => [new Laceration(at(-200, 80), 0.9, 36, 0.3), new Laceration(at(190, -90), 2.1, 40, 0.3), new Laceration(at(40, -120), 0.1, 32, 0.3)],
    },
  ],
};

export const OP_1_2: OperationDef = {
  id: 'op1-2',
  title: 'The Barbed Shaft',
  patient: 'Pieter, militiaman',
  diagnosis: 'Barbed arrow lodged in the left flank; crossbow bolt in the thigh. Raider ambush.',
  organ: 'flesh',
  timeLimit: 200,
  tools: ['lancet', 'tongs', 'leech', 'thread', 'salve'],
  ranks: { S: 4450, A: 3550, B: 2650 },
  litany: false,
  seed: 12,
  phases: [
    {
      callout: ['The arrow’s barbed. Lancet first — two nicks at the entry wound. Then seize it with the tongs and pull it well clear.', 'Then drain and stitch the wound it leaves.'],
      spawn: () => [new Embedded(at(-60, 0), 'arrow', -0.5)],
    },
    {
      callout: ['The bolt in his thigh has no barbs. Tongs, and pull it straight out.', 'Quick, clean pulls earn the best marks.'],
      spawn: () => [new Embedded(at(150, 60), 'bolt', 0.4, false), new Embedded(at(-180, -70), 'shard', 2.2, false)],
    },
  ],
};

export const OP_1_3: OperationDef = {
  id: 'op1-3',
  title: 'Powder Burns',
  patient: 'Anno, gunsmith’s apprentice',
  diagnosis: 'Burst-barrel injury: powder burns across the chest, lead fragments embedded beneath the skin.',
  organ: 'flesh',
  timeLimit: 240,
  baseDrain: 0.25,
  vitals: 70,
  tools: ['lancet', 'tongs', 'leech', 'thread', 'salve', 'tincture'],
  ranks: { S: 4750, A: 3800, B: 2850 },
  litany: false,
  seed: 13,
  phases: [
    {
      callout: ['His pulse is weak already. Hold the tincture to the flesh to steady him if you need it.', 'Burns first. Pluck the black eschar away with the tongs, then salve the raw flesh.'],
      spawn: (op) => [new Burn(at(-170, -60), 48, op), new Burn(at(180, -80), 40, op)],
    },
    {
      callout: ['Now open him along the inked line with the lancet. Keep to the line — start at the glowing end.'],
      spawn: () => [new Incision([at(-150, 60), at(-50, 40), at(60, 50), at(160, 30)])],
    },
    {
      callout: ['There — the shot. Pull each ball out with the tongs.'],
      spawn: () => [new Embedded(at(-80, 40), 'shot'), new Embedded(at(30, 70), 'shot'), new Embedded(at(120, 20), 'shot')],
    },
    closeIncision(),
  ],
};

export const OP_1_4: OperationDef = {
  id: 'op1-4',
  title: 'Pestilent Humours',
  patient: 'Unknown vagrant, Tanners’ Rows',
  diagnosis: 'Plague buboes, spreading rot and an infested sore. High fever.',
  organ: 'flesh',
  timeLimit: 240,
  baseDrain: 0.15,
  tools: ['lancet', 'tongs', 'leech', 'thread', 'salve', 'tincture', 'brand'],
  ranks: { S: 5250, A: 4200, B: 3150 },
  litany: false,
  seed: 14,
  phases: [
    {
      callout: ['Lance each bubo with a single touch of the lancet before it bursts. Then drain the pus and salve it.'],
      spawn: () => [new Bubo(at(-160, -40), 22), new Bubo(at(40, -100), 20), new Bubo(at(170, 60), 24)],
    },
    {
      callout: ['Grubs in the sore! The cautery brand — hold it on each one until it stops moving.', 'Don’t linger on bare flesh with the brand.'],
      spawn: (op) => [new Grub(at(-40, 40), op, 35), new Grub(at(60, 60), op, 35), new Grub(at(10, -10), op, 35), new Rot(at(20, 40), 60, 0.3)],
    },
    {
      callout: ['The rot’s spreading. Salve every patch — quickly, it creeps back.'],
      spawn: () => [new Rot(at(-180, 70), 50, 0.6), new Rot(at(180, -60), 55, 0.6)],
    },
  ],
};

export const OP_1_5: OperationDef = {
  id: 'op1-5',
  title: 'The Hour of Matins',
  patient: 'Emmerich, page-boy',
  diagnosis: 'Unknown. Moving marks on the chest. Delirium. “The choir is singing in me.”',
  organ: 'flesh',
  timeLimit: 330,
  baseDrain: 0.1,
  tools: ALL_BUT_LENS,
  ranks: { S: 6950, A: 5550, B: 4150 },
  litany: true,
  seed: 15,
  phases: [
    {
      callout: ['Those sigils are draining him. Trace every stroke of each one with the brand to sear it out.'],
      spawn: () => [new Sigil(at(-170, -30), SIGILS.eye, 70), new Sigil(at(170, 20), SIGILS.trident, 60)],
    },
    {
      callout: ['Something is moving beneath the skin. We have to open him. The lancet — along the line.'],
      spawn: () => [new Incision([at(-180, 0), at(-60, -20), at(60, -10), at(180, 10)])],
    },
    {
      callout: ['Saints preserve us… what is that?', 'Doctor — if ever there were a time for the Litany, it is now. Draw the star with the right hand.'],
      spawn: (op) => [new Malison(at(0, 40), op, 'matins', 100)],
    },
    {
      callout: ['It’s gone. Tend the wounds it left.'],
      spawn: (op) => [new Laceration(at(-90, 90), 0.4, 60, 0.8), new Rot(at(110, -60), 40, 0.4), new Grub(at(0, 0), op, 40)],
    },
    closeIncision(),
  ],
};

export const CHAPTER_1 = {
  id: 'ch1',
  numeral: 'I',
  title: 'The Hour of Matins',
  steps: [
    { kind: 'story', story: PROLOGUE },
    { kind: 'op', op: OP_1_1 },
    { kind: 'story', story: STORY_1_2 },
    { kind: 'op', op: OP_1_2 },
    { kind: 'story', story: STORY_1_3 },
    { kind: 'op', op: OP_1_3 },
    { kind: 'story', story: STORY_1_4 },
    { kind: 'op', op: OP_1_4 },
    { kind: 'story', story: STORY_1_5 },
    { kind: 'op', op: OP_1_5 },
    { kind: 'story', story: STORY_1_END },
  ],
} as const;
