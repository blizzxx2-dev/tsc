import { Incision } from '../surgery/entities';
import { FIELD, type Operation } from '../surgery/operation';
import { OP_1_1, OP_1_2, OP_1_3, OP_1_4, OP_1_5 } from './ops/ch1';
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
    say('ilse', '…Inquisitor Stroh. Of the Ash Tribunal.'),
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
    say('haller', 'Do not do it where the Inquisitor can see. The Tribunal does not distinguish between a prayer and a spell.'),
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
// Written as data (CON-0001): src/content/ops/ch1.ts.

export { OP_1_1, OP_1_2, OP_1_3, OP_1_4, OP_1_5 };

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
