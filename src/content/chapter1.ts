import { Bubo, Burn, Embedded, Grub, Incision, Laceration, Rot, Sigil, SIGILS } from '../surgery/entities';
import { Malison } from '../surgery/malison';
import { FIELD, type Operation, type OperationDef } from '../surgery/operation';
import type { Vec } from '../core/math';
import { n, say, type StoryDef } from './story';
import { when } from './conditions';

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
    n('An old surgeon’s woodcut hangs by the hospice door: a man stuck with every blade, bolt and fang in the world — and standing.'),
    n('Beneath it, in faded ink: “Here is the battlefield. Hold it.”'),
    n('The Free City of Kessendorf. Winter, in the ninth year of the Long Muster.'),
    n('The river has frozen twice. The pyres outside the east gate have not gone out since autumn.'),
    say('haller', 'So. You are the new sawbones the Guild sent me. Kreuzer, is it?'),
    say('kreuzer', 'Apothecary-surgeon, sworn at Weissburg. I have my letters, Master Haller—'),
    say('haller', 'Letters. Letters don’t stop a man bleeding into the straw. Hands do. Show me your hands.'),
    say('haller', '…Steady enough. Why would a sworn Weissburg man take a charity bed in a city that burns its sick?'),
    say('kreuzer', 'Weissburg taught me the rules, Master. I came somewhere too poor to afford them.'),
    say('haller', 'Hm. Sister! Our young doctor has arrived just in time for the Tuesday knife-fights.'),
    say('ilse', 'Sister Ilse, of the Merciful Order. I keep the instruments, the ledgers, and the Master’s temper.'),
    say('ilse', 'There’s a drover on the table already. Somebody at the Crooked Goose disagreed with his dice.'),
    say('haller', 'Knife wounds. Simple work. I’ll watch.'),
    say('haller', 'And Kreuzer — in this hospice we do not lose patients to simple work.'),
  ],
};

export const STORY_1_2: StoryDef = {
  id: 's1-2',
  place: 'The Hospice — the next morning',
  backdrop: 'hospice',
  lines: [
    n('The next morning the Watch arrives before the bread does.'),
    say('mauer', 'Make way! Make way, damn you! Surgeon! Where’s the surgeon?'),
    say('ilse', 'Captain Mauer of the Watch. Lower your voice, Captain, this is a house of mercy.'),
    say('mauer', 'Twelve went out with the timber-road caravan. Twelve came back, eleven walking. Horned folk hit us at dawn.'),
    say('mauer', 'Young Pieter took a shaft in the side. Twelve, Doctor. I’d like it to stay twelve.'),
    say('kreuzer', 'Then put him down gently, Captain, and stop counting him among the dead.'),
    say('haller', 'Horned-folk heads are barbed like fish-hooks. They cut a notch in their antlers for every one that sticks in a man.'),
    say('haller', 'Rip it straight out and you’ll take half his side with it. Free the barbs first, then pull. Cleanly.'),
    say('mauer', 'Twelve. Say it with me, Doctor. Twelve.'),
  ],
};

export const STORY_1_3: StoryDef = {
  id: 's1-3',
  place: 'The Hospice — noon',
  backdrop: 'hospice',
  lines: [
    n('Noon. A second sack of turnips arrives at the gate. The drover has told his friends about us.'),
    say('ilse', 'Doctor, the gunsmiths’ quarter. An apprentice was proving a new handgun barrel and it burst in his hands.'),
    say('ilse', 'Burns across the chest, lead driven under the skin — and a note from the Gunsmiths’ Guild pinned to his shirt.'),
    say('ilse', 'The Guild will pay for his care. Once we have paid the Guild’s fee for inspecting its own burst barrel.'),
    say('haller', 'Naturally. In Kessendorf a man pays the Guild for the privilege of being shot by its work.'),
    say('kreuzer', 'Then we send the Guild a bill for the lead we take out of him. Itemised, by the ounce.'),
    say('haller', 'Powder burns. The black crust is dead meat: off with it before any salve, or it festers underneath.'),
    say('haller', 'The shot is deep. You’ll open him along the line I’ve inked. And if his pulse flags — the tincture.'),
  ],
};

export const STORY_1_4: StoryDef = {
  id: 's1-4',
  place: 'The Hospice — dusk',
  backdrop: 'street',
  lines: [
    n('Word travels fast in Kessendorf. By dusk, there is a queue at the hospice door.'),
    say('ilse', 'This one was found in the Tanners’ Rows. Swellings at the neck and groin. Fever. Maggots in an old sore.'),
    say('patient', 'Matthis Kolb. Twenty years a tanner’s man. Write that, Sister, not “vagrant”. I had a trade before I had a fever.', 'Matthis Kolb'),
    say('ilse', 'Matthis Kolb, tanner’s man. Written, and underlined.'),
    say('haller', 'Buboes, and a rotting sore. He’s slept in the Rows among the hides. Burn the grubs, Kreuzer — not the man.'),
    n('Nobody hears the door. There is simply a man in black standing in the ward, where a moment ago there was not.'),
    say('stroh', 'A plague case. In the city. How very interesting.'),
    say('ilse', '…Inquisitor Stroh. Of the Ash Tribunal.'),
    say('stroh', 'Carry on, Doctor. I only wish to watch. Pestilence so often has a sponsor — and I hear the Kilnrows are coughing too.'),
    say('kreuzer', 'Then stand back from the table, Inquisitor. Whoever sponsors it, it isn’t particular whom it takes.'),
  ],
};

export const STORY_1_5: StoryDef = {
  id: 's1-5',
  place: 'The Hospice — the small hours',
  backdrop: 'night',
  lines: [
    n('Near midnight a carriage stops at the gate. Its door panel has been planed smooth where a crest should be — on purpose.'),
    say('patient', 'The choir… they’re singing in me… make them stop singing…', 'Page-boy Emmerich'),
    say('ilse', 'Doctor, look at his chest. Those marks — they’re moving. That one is an eye, with a stroke drawn through it.'),
    say('haller', '…That is no disease. Those are sigils. Someone has written on this boy.'),
    say('kreuzer', 'Then we unwrite him. The brand, Sister. And more light.'),
    say('haller', 'If something answers when you do — there is an old apothecary’s rite. The Litany of Stillness.'),
    say('haller', 'Draw the five-pointed star and still your heart. For a few breaths, the world will wait for you.'),
    say('haller', 'Do not do it where the Inquisitor can see. The Tribunal does not distinguish between a prayer and a spell.'),
  ],
};

export const STORY_1_END: StoryDef = {
  id: 's1-end',
  place: 'The Hospice — before dawn',
  backdrop: 'chapel',
  lines: [
    n('The thing in the boy’s chest came apart like wet ash. The boy sleeps. He no longer hears singing.'),
    say('ilse', 'Doctor… after it broke, a word was left seared into the flesh. Matins. And beside it, fading: the struck-through eye.'),
    say('haller', 'The first of the canonical hours. The first prayer of the night.'),
    say('haller', 'A curse that lives and fights like a beast, and signs itself like a psalm. A Malison.'),
    say('haller', 'And if this was Matins… then somewhere, someone is already writing Lauds.'),
    n('In the yard, the carriage without a crest pulls away before anyone thinks to ask whose it is.'),
    say('stroh', 'A remarkable recovery, Doctor. Remarkable.'),
    ...when(
      { litany: true },
      say('stroh', 'Tell me — at the end, your hands moved so very quickly. Almost as if time itself were… obliging you.'),
      say('kreuzer', 'Practice, Inquisitor. And the grace of Saint Ildra.'),
      say('stroh', 'Of course. The grace of the Saint. I shall pray on it.'),
    ),
    ...when(
      { litany: false },
      say('stroh', 'I watched every stroke. No tricks, no prayers. Only a surgeon, working. I find it almost disappointing.'),
      say('kreuzer', 'Surgery usually is, Inquisitor. That is how you know it worked.'),
    ),
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
  patient: 'Matthis Kolb, tanner’s man, Tanners’ Rows',
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
