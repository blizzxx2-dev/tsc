import { teach } from './teach';
import { BloodPool, Embedded, Grub, Incision, Laceration, Rot } from '../surgery/entities';
import { TinctureSite } from '../surgery/ailments/kilnrows';
import { Artery, BiteChannel, Contamination, Lockbox, NoCutZone, Nodule, PetrifyFront, RainDrip, Retractor, StilledHeart, Tick } from '../surgery/ailments/vennmark';
import { NoneMalison } from '../surgery/bosses/none';
import { SextMalison } from '../surgery/bosses/sext';
import type { Operation, OperationDef } from '../surgery/operation';
import { at, closeIncision } from './chapter1';
import type { Chapter } from './campaign';
import { choose, n, say, type StoryDef } from './story';

const ALL = ['lancet', 'tongs', 'leech', 'thread', 'salve', 'tincture', 'brand', 'lens'] as const;

// ====================================================================== stories

export const STORY_4_1: StoryDef = {
  id: 's4-1',
  place: 'The Vennmark road — four days east of Kessendorf',
  backdrop: 'camp',
  lines: [
    n('CHAPTER IV — SEXT AND NONE'),
    n('Sext is the noon office; None, the ninth hour, when the old books say the heart of the world stopped.'),
    n('Kessendorf hires its wars. Three companies march east to the Vennmark marches: pikes, crossbows, and men nobody asks about.'),
    say('mauer', 'Forty-one of mine. Forty-one. Sixty crossbowmen from Ostrau. Nine deserters we’ve caught and four we haven’t. Forty-one.'),
    say('ilse', 'He counts them every morning. He counted them twice while you were asleep.'),
    say('mauer', 'Someone has to. Doctor, your field kit is in the second wagon. Rain gets in the tent. Mud gets in everything.'),
    n('The men nobody asks about sit apart. One is an orc, grey as slate, holding his own neck shut with two fingers.'),
    say('patient', 'Ushkar. Crossbow. Took one of our own quarrels at the butts. Pulled at it. It pulled back.', 'Ushkar'),
    say('mauer', 'Ostrau pays him double. He is worth triple. Do not let him die in my tent, Doctor.'),
    say('ilse', 'Orc hide is thick as a saddle. Slow, firm strokes, or the lancet skates. Tinctures barely touch them.'),
    say('ilse', 'Clamp the artery with the tongs before you pull that bolt. Even an orc empties like a cask.'),
  ],
};

export const STORY_4_2: StoryDef = {
  id: 's4-2',
  place: 'The field hospital — rain in the tents',
  backdrop: 'night',
  lines: [
    n('It rains for three days. The tent drips onto the table in a rhythm Ilse starts humming without noticing.'),
    say('ilse', 'Doctor. The Litany. When you draw the star, what do you hear?'),
    say('kreuzer', 'Nothing. That is the point of it. Everything stops.'),
    say('ilse', 'I hear something. Under the stillness, like a choir very far off. Five notes. The same five the Lauds antiphon began with.'),
    say('kreuzer', '…Master Haller would say you have been in the rain too long.'),
    say('ilse', 'Master Haller wrote. He says the Litany is older than the Guild, and to keep my feet dry. Here — a goring from the road.'),
    say('patient', 'Wendel, convoy guard. Horned folk hit the carts. One of ’em got me with his own head, the rude bastard.', 'Wendel'),
    say('ilse', 'Horn tip broken off inside — the lens will find it. Pluck the ticks before they burrow, and flush the dung out of it.'),
  ],
};

export const STORY_4_3: StoryDef = {
  id: 's4-3',
  place: 'The field hospital — a wagon of miners',
  backdrop: 'camp',
  lines: [
    say('patient', 'DOCTOR! You’re alive! Good. I told the Kreuzer Deep you would be. Collapsed, the Kreuzer Deep. Last month. Very sad.', 'Orsa Flintvein'),
    say('kreuzer', 'You named a mine after me and it fell in.'),
    say('patient', 'Only the lower galleries. It was a terrible mine. Very like you, on your first day. Now — this is Brakka.', 'Orsa Flintvein'),
    say('ilse', 'Delver’s lung. Crystal dust from the seams, grown into nodules. The later they are, the harder they come out.'),
    say('patient', 'And Doctor. The beard. You do not cut the beard. Every knot in it is a debt he owes; cut one and he dies owing.', 'Orsa Flintvein'),
    say('ilse', 'He looks better this morning than last night… no. That’s the crystal. It stiffens the lung and lies about it.'),
  ],
};

export const STORY_4_4: StoryDef = {
  id: 's4-4',
  place: 'The field hospital — the quartermaster’s wagon',
  backdrop: 'camp',
  lines: [
    n('A giant of the Ostrau company, Gutram, is brought in by eight men and a cart. He has eaten a strongbox.'),
    say('mauer', 'Thirty-nine. The council’s pay-chest — strongbox, lock and all. He says he was keeping it safe. From whom, Gutram?'),
    say('patient', 'From… thieves.', 'Gutram'),
    say('mauer', 'And where were the thieves?'),
    say('patient', 'Outside of me.', 'Gutram'),
    say('ilse', 'Giant’s hide — three layers to the incision. The organs lie low; pull the muscle flap aside with the tongs to see them.'),
    say('mauer', 'And pick the lock before you pull it, Doctor. There are council papers in that box I want to read before anyone else does.'),
  ],
};

export const STORY_4_5: StoryDef = {
  id: 's4-5',
  place: 'The field hospital — the officers’ tent',
  backdrop: 'chapel',
  lines: [
    n('Lord Eckbert von Salm, patron of the Ostrau company, was found at dawn in his tent, cold and grey. His valet says he still has a pulse.'),
    say('stroh', 'One beat a minute. The Tribunal has a word for a corpse with a heartbeat, Doctor. I want your verdict.'),
    say('ilse', 'There are fang fragments in the neck. Bite-trance, not death. The heart is stilled, not stopped.'),
    say('kreuzer', 'Then I can restart it. A tincture, but only on the beat — between beats it will simply pool.'),
    say('stroh', 'And if you are wrong, you will have raised a dead man in a camp of four hundred soldiers.'),
    say('kreuzer', 'If I am wrong, Inquisitor, you may burn us both.'),
  ],
};

export const STORY_4_6: StoryDef = {
  id: 's4-6',
  place: 'The camp-followers’ lines — night',
  backdrop: 'night',
  lines: [
    n('Among the camp-followers is Margit, whom the officers visit and the chaplain pretends not to know.'),
    say('ilse', 'Bitten, again and again, on the same side of the neck. Something has been drinking from her for weeks.'),
    say('patient', 'He is gentle, Doctor. He comes on the new moon and takes only a little. And for a week after, nothing hurts.', 'Margit'),
    say('patient', 'Close the bites. Take out his teeth if they broke off. But the channel — leave it, if I ask you to. Please.', 'Margit'),
    say('kreuzer', 'It is killing you slowly.'),
    say('patient', 'Everything in this camp is killing someone slowly. This, at least, I chose. Brand it or salve it, Doctor. I ask for salve.', 'Margit'),
    // NAR-0137: the bond is hers to keep or the surgeon's to sever. Writes `thirstChoice`.
    choose('narrator', 'The bite-channel pulses under the lamp, slow as a new moon. Ilse holds the brand in one hand and the salve in the other.', [
      { id: 'salve', text: 'Salve. It is her neck, Sister, and her choosing. We close the bites and leave the channel.', set: { thirstChoice: 'salve' } },
      { id: 'brand', text: 'The brand. Forgive me, Margit. I will not stitch you shut and leave him a way back in.', set: { thirstChoice: 'brand' } },
    ]),
  ],
};

export const STORY_4_7: StoryDef = {
  id: 's4-7',
  place: 'The Vennmark camp — noon',
  backdrop: 'camp',
  lines: [
    n('At noon a stillness comes over the camp. Men sit down where they stand. The sentries lean on their pikes and do not blink.'),
    say('mauer', 'All… all in order, Doctor. Thirty-eight… thirty-seven. All quiet. Nothing to report. I’ll just sit a moment.'),
    say('ilse', 'Doctor, he’s grey. His pulse is steady as a clock, but look at his lips — he’s dying and his heart is lying about it.'),
    say('kreuzer', 'Sext. The noonday demon. Sister — watch his heart with the lens. Don’t trust anything else.'),
    say('ilse', 'And your own hands, Doctor. You’re moving like a man under water. If you slow, take a tincture yourself.'),
  ],
};

export const STORY_4_8: StoryDef = {
  id: 's4-8',
  place: 'The captain’s tent — evening',
  backdrop: 'chapel',
  lines: [
    n('Mauer wakes at dusk, weak as a kitten and furious about it. The first thing he asks for is the strongbox papers.'),
    say('mauer', 'Thirty-six, while I slept. The council roll, Doctor: every chartered office, signed at the new year. Inquisitor — here.'),
    say('stroh', 'Captain.'),
    say('mauer', 'The Ash Tribunal’s charter in Kessendorf. It is not on the roll. It was not renewed. It lapsed at the new year.'),
    say('stroh', 'That is a clerk’s error.'),
    say('mauer', 'Then it is a clerk’s error with your name on every arrest since. Whoever sat on the council this winter let you lapse.'),
    say('stroh', 'Who struck it?'),
    say('mauer', 'No one struck it. Someone simply didn’t sign. The Widow Reiss’s seat. She sits for the charities.'),
    say('ilse', 'The Widow Reiss. The hospice’s patron. She pays for the candles in our ward.'),
    say('stroh', '…Then for four months I have been a private man with a hat and a sword, making arrests.'),
    say('kreuzer', 'And your prisoners?'),
    say('stroh', 'Are held on nothing. I know. I am not a fool, Doctor, only a man who did not read his own warrant.'),
    say('mauer', 'You’ll do what, then?'),
    say('stroh', 'What I have always done. Find the truth, and act on it. It is only that no one has to let me any more.'),
  ],
};

export const STORY_4_9: StoryDef = {
  id: 's4-9',
  place: 'The camp-followers’ lines — a wedding',
  backdrop: 'camp',
  lines: [
    n('Hanne the sutler’s daughter marries a Watch pikeman under a bower of wet ribbons. At the vow, her fingers turn to stone.'),
    say('patient', 'It’s climbing, Doctor. My hand, my wrist… I can’t feel the ring any more.', 'Hanne'),
    say('ilse', 'Petrification — the front is moving toward her heart. Crack the stone plates in the order they formed, then salve the margin.'),
    say('mauer', 'Thirty-six. My pikeman’s getting married if I have to hold his bride together with my own hands. Get on with it.'),
    say('ilse', 'If it runs too fast, Doctor — the Litany will hold it still.'),
  ],
};

export const STORY_4_10: StoryDef = {
  id: 's4-10',
  place: 'The Vennmark camp — a letter from Kessendorf',
  backdrop: 'hospice',
  lines: [
    n('A letter from Master Haller, in a hand shaky with burns and furious with capital letters.'),
    say('haller', 'KREUZER. The Widow Reiss came to visit me. Brought grapes. Asked after you, and the Sister, and your Litany.'),
    say('haller', 'She wore black gloves and never took them off. Under the left one, when she reached for the grapes: a sigil. Choir work.'),
    say('haller', 'Her carriage waits outside the hospice every night. No crest on it. You saw it the night of the page-boy. So did I.'),
    say('ilse', 'She paid for the candles. She paid for the beds. She knew every patient we took in, and when.'),
    say('stroh', 'Every patient the Choir chose went through a hospice she paid for. The Precentor did not need spies. He had a benefactor.'),
    say('kreuzer', 'Then the Choir knows exactly where the Office ends. At Saint Ildra’s. With us.'),
  ],
};

export const STORY_4_11: StoryDef = {
  id: 's4-11',
  place: 'The Vennmark camp — the ninth hour',
  backdrop: 'night',
  lines: [
    n('At the ninth hour, a militiaman of Kessendorf falls in the mud without a sound.'),
    say('ilse', 'Doctor — it’s Pieter. Pieter, from the barbed arrow, the first week. He came east with the Watch.'),
    say('patient', 'Doctor… something went in with that arrow and it never came out. It’s been waiting. It’s going for my heart now.', 'Pieter'),
    say('ilse', 'A burrower — through the organs, toward the heart. If it reaches it, he’s gone in an instant. Track it with the lens!'),
    say('mauer', 'Thirty-five. Not thirty-four, Doctor. Do you hear me? Thirty-five.'),
  ],
};

export const STORY_4_END: StoryDef = {
  id: 's4-end',
  place: 'The road west — returning to Kessendorf',
  backdrop: 'street',
  lines: [
    n('Pieter lives. The companies are recalled; the Vennmark is quiet, as if something there has finished what it came to do.'),
    say('mauer', 'Thirty-five. We marched out forty-one. Six in the ground at the Vennmark. I’ll say their names to the Burgomaster myself.'),
    say('ilse', 'Six hours sung now. Only Vespers and Compline are left. And Hollow Night is in three days.'),
    say('kreuzer', 'The Precentor spoke through Pieter. He wants me home for Hollow Night.'),
    say('stroh', 'He will have you. So will the council. A rider came this morning with a warrant for your arrest, Doctor.'),
    say('stroh', 'It is signed by the Widow Reiss for the council. It is sealed with the Tribunal seal. My seal, which I no longer have the right to use.'),
    say('kreuzer', 'And will you serve it?'),
    say('stroh', 'I will ride beside you to the city gate. What happens after the gate is not in my gift. It never was.'),
    n('END OF CHAPTER IV — SEXT AND NONE'),
  ],
};

// ====================================================================== operations

export const OP_4_1: OperationDef = {
  id: 'op4-1',
  title: 'Quarrel at the Gorget',
  patient: 'Ushkar Split-Tusk, orc crossbowman of the Ostrau company',
  race: 'orc',
  diagnosis: 'Crossbow bolt lodged beside the great artery of the neck. Rain through the tent roof.',
  organ: 'flesh',
  timeLimit: 270,
  baseDrain: 0.1,
  tools: ALL,
  ranks: { S: 4840, A: 3870, B: 2900 },
  litany: true,
  seed: 41,
  venue: 'field',
  phases: [
    {
      callout: ['Clamp the artery first — tongs on the vessel. Then the bolt.'],
      spawn: () => {
        const bolt = new Embedded(at(20, -20), 'bolt', 0.5, false);
        return [new RainDrip(7), bolt, new Artery(at(-40, 20), 1.1, bolt)];
      },
    },
    {
      callout: ['Now tend the wound it left, and mop up the rain-water blood.'],
      spawn: () => [new Laceration(at(60, 60), 0.2, 60, 0.6)],
    },
  ],
};

/**
 * The Two Cots (GAM-0248): triage. Two brought in from the Gorget together, one on each cot; Tab
 * goes between them, each has vitals of their own, and losing either loses the operation.
 */
export const OP_4_10: OperationDef = {
  id: 'op4-10',
  title: 'The Two Cots',
  patient: 'Jorgen, pikeman of the Ostrau company',
  second: { patient: 'Wendel, drummer boy', vitals: 80 },
  venue: 'field',
  diagnosis: 'Two brought in from the Gorget together: a pikeman with a spear-rent thigh, and the drummer boy trampled in the rout. Keep them both.',
  organ: 'flesh',
  regions: [
    { kind: 'flesh', ...at(-200, 0), rx: 200, ry: 200 },
    { kind: 'flesh', ...at(200, 0), rx: 200, ry: 200 },
  ],
  timeLimit: 300,
  baseDrain: 0.05,
  tools: ALL,
  ranks: { S: 5200, A: 4160, B: 3120 },
  litany: true,
  seed: 410,
  phases: [
    {
      callout: ['Two at once. Tab takes you between the cots — and watch both of them, not just the one in front of you.', 'The pikeman’s thigh first. Stitch it.'],
      spawn: () => [new Laceration(at(-200, -20), 0.3, 90, 0.55), new Laceration(at(200, 30), -0.5, 40, 0.3)],
    },
    {
      callout: ['The boy is fading. Draw the blood off his chest and close him — then the splinter in the pikeman.'],
      spawn: () => [new BloodPool(at(210, -30), 30), new Laceration(at(180, 50), 1.2, 70, 0.7), new Embedded(at(-180, 60), 'shard', 0.4, false)],
    },
  ],
};

export const OP_4_2: OperationDef = {
  id: 'op4-2',
  title: 'Tusk and Hoof',
  patient: 'Wendel, convoy guard',
  diagnosis: 'Gored by a horned raider: horn tip broken off inside, ticks crawling from the wound, dung in the flesh.',
  organ: 'flesh',
  timeLimit: 300,
  baseDrain: 0.1,
  tools: ALL,
  ranks: { S: 5340, A: 4270, B: 3200 },
  litany: true,
  seed: 42,
  phases: [
    {
      callout: ['Ticks! Pluck them with the tongs before they burrow in.'],
      spawn: (op: Operation) => [new Tick(at(-40, 10), op), new Tick(at(30, -20), op), new Tick(at(0, 40), op)],
    },
    {
      callout: ['The dung fouling — flush it with the leech-pipe, and hold it there.'],
      spawn: () => [new Contamination(at(-60, 30)), new Contamination(at(80, -10))],
    },
    {
      callout: ['The horn tip is still in there. Lens, then tongs.', 'And one tick got under the skin — find it.'],
      spawn: (op: Operation) => {
        const tip = new Embedded(at(10, 20), 'shard', 1.4, false);
        tip.hidden = true;
        const t = new Tick(at(150, 60), op);
        t.burrowed = true;
        t.hidden = true;
        return [tip, t];
      },
    },
    {
      callout: ['Stitch the goring shut.'],
      spawn: () => [new Laceration(at(0, 20), 0.3, 90, 0.8)],
    },
  ],
};

export const OP_4_3: OperationDef = {
  id: 'op4-3',
  title: 'Delver’s Lung',
  patient: 'Brakka, of Orsa Flintvein’s crew',
  race: 'dwarf',
  diagnosis: 'Crystal nodules through the lung from the deep seams, stage I to III and growing. Do not cut the beard.',
  organ: 'lung',
  timeLimit: 300,
  baseDrain: 0.15,
  tools: ALL,
  ranks: { S: 5820, A: 4660, B: 3490 },
  litany: true,
  seed: 43,
  phases: [
    {
      callout: ['Open him along the ribs — well clear of the beard.'],
      spawn: () => [new NoCutZone(at(-40, -190), 170, 60), new Incision([at(-180, 60), at(-60, 40), at(60, 40), at(180, 60)])],
    },
    {
      callout: ['The nodules. Cut the small ones out; the hard ones need the brand to crack them first.', 'Quickly — they grow while we watch.'],
      spawn: () => [new Nodule(at(-150, -30), 12), new Nodule(at(-40, 0), 12), new Nodule(at(70, -40), 12), new Nodule(at(160, 0), 12), new Nodule(at(10, 100), 12)],
    },
    {
      callout: ['Crystal dust in the airways. Draw it off.'],
      spawn: () => [new BloodPool(at(-80, 60), 28, 'blackbile'), new BloodPool(at(100, 50), 24, 'blackbile')],
    },
    closeIncision(['Close him. His beard is intact — Orsa will be relieved.']),
  ],
};

export const OP_4_4: OperationDef = {
  id: 'op4-4',
  title: 'The Swallowed Strongbox',
  patient: 'Gutram, giant of the Ostrau company',
  race: 'giant',
  diagnosis: 'Swallowed the council’s strongbox, lock and all. Thick hide in three layers; the organs lie low.',
  organ: 'gut',
  timeLimit: 360,
  baseDrain: 0.1,
  tools: ALL,
  ranks: { S: 6490, A: 5190, B: 3890 },
  litany: true,
  seed: 44,
  phases: [
    {
      callout: ['Giant’s hide. First layer — along the line.'],
      spawn: () => [new Incision([at(-200, -20), at(-60, -30), at(80, -30), at(200, -20)])],
    },
    {
      callout: ['Second layer. Same line, deeper.'],
      spawn: () => [new Incision([at(-190, 0), at(-60, -10), at(80, -10), at(190, 0)])],
    },
    {
      callout: ['Third. Nearly through.'],
      spawn: () => [new Incision([at(-180, 20), at(-60, 10), at(80, 10), at(180, 20)])],
    },
    {
      callout: ['The muscle flap hides everything — drag it aside with the tongs. It won’t stay long.', 'The strongbox. Tap each pin with the tongs as its notch comes to the top.'],
      spawn: (op: Operation) => {
        const box = new Lockbox(at(40, 40), op);
        const ulcer = new Rot(at(-110, 80), 30, 0.3);
        return [new Retractor(at(40, 40), [box, ulcer]), box, ulcer];
      },
    },
    {
      callout: ['The lock scraped his gut raw. Tend it.'],
      spawn: () => [new Laceration(at(40, 40), 0.1, 70, 0.7)],
    },
    {
      callout: ['The deep layers will knit on their own. Close the hide over them — a giant’s stitches.'],
      spawn(op: Operation) {
        const layers = op.entities.filter((e): e is Incision => e instanceof Incision && e.alive);
        for (const l of layers.slice(1)) l.kill();
        layers[0]?.beginClosing();
        return [];
      },
    },
  ],
};

export const OP_4_5: OperationDef = {
  id: 'op4-5',
  title: 'The Dead Man’s Pulse',
  patient: 'Lord Eckbert von Salm, patron of the Ostrau company',
  diagnosis: 'Found cold and grey with one heartbeat a minute. Fang fragments in the neck. Bite-trance, not death.',
  organ: 'heart',
  timeLimit: 300,
  baseDrain: 0.1,
  vitals: 60,
  tools: ALL,
  ranks: { S: 4340, A: 3470, B: 2600 },
  litany: true,
  seed: 45,
  phases: [
    {
      callout: ['Fang fragments, deep. The lens will show them; pull every one.'],
      spawn: () => {
        const fangs = [new Embedded(at(-120, -40), 'tooth', 0.8, false), new Embedded(at(-80, 30), 'tooth', 2.1, false), new Embedded(at(-160, 20), 'tooth', 1.4, false)];
        for (const f of fangs) f.hidden = true;
        return fangs;
      },
    },
    {
      callout: ['Now the heart. Inject on the beat — watch it swell — and hold until it takes. Twice.'],
      spawn: () => [new StilledHeart(at(60, 0), 6, 0.9, 2)],
    },
    {
      callout: ['He’s breathing. Close the bite.'],
      spawn: () => [new Laceration(at(-120, 0), 0.6, 50, 0.4)],
    },
  ],
};

export const OP_4_6: OperationDef = {
  id: 'op4-6',
  title: 'The Thirsted Neck',
  patient: 'Margit, camp-follower',
  diagnosis: 'Repeated bite wounds on the neck, tooth fragments lodged, marked anaemia. A bite-channel she asks to keep.',
  organ: 'flesh',
  timeLimit: 270,
  baseDrain: 0.25,
  vitals: 75,
  tools: ALL,
  ranks: { S: 4380, A: 3500, B: 2630 },
  litany: true,
  seed: 46,
  phases: [
    {
      callout: ['Broken teeth in the bites. Tongs.'],
      spawn: () => [new Embedded(at(-100, -20), 'tooth', 0.6, false), new Embedded(at(-40, 30), 'tooth', 2.2, false)],
    },
    {
      callout: ['She’s lost too much blood. Tincture, and close the older bites.'],
      spawn: () => [new TinctureSite(at(40, -40), 'Blood restored', 1.0, 0.3, '#c03040'), new Laceration(at(-120, 40), 0.4, 40, 0.5), new Laceration(at(-20, -60), 2.4, 44, 0.5)],
    },
    {
      callout: ['The channel. Brand it and the bond is burned away; salve it and it stays. It is her choice, Doctor. She asked for salve.'],
      spawn: () => [new BiteChannel(at(-60, 0))],
    },
  ],
};

export const OP_4_7: OperationDef = {
  id: 'op4-7',
  title: 'The Hour of Sext',
  patient: 'Captain Mauer, Kessendorf Watch',
  diagnosis: 'Collapsed at noon reporting all quiet. Vitals read calm; the colour says otherwise. Stone crusting over the organs.',
  organ: 'flesh',
  timeLimit: 420,
  baseDrain: 0.05,
  tools: ALL,
  ranks: { S: 6990, A: 5590, B: 4190 },
  litany: true,
  seed: 47,
  phases: [
    {
      callout: ['Open him — the stone is under the sternum.'],
      spawn: () => [new Incision([at(-190, 30), at(-70, 0), at(70, 0), at(190, 30)])],
    },
    {
      callout: ['Stone crust over it. Chip the plates away with the lancet, then brand what’s beneath.', 'And if your hands slow — tincture. It’s the curse, not you.'],
      spawn: (op: Operation) => [new SextMalison(at(30, 30), op)],
    },
    {
      callout: ['Noon has passed. Tend him.'],
      spawn: () => [new Laceration(at(-100, 70), 0.3, 56, 0.6), new Rot(at(110, -50), 32, 0.3)],
    },
    closeIncision(['Close him up. Thirty-five men will want their captain.']),
  ],
};

export const OP_4_8: OperationDef = {
  id: 'op4-8',
  title: 'The Stone Bride',
  patient: 'Hanne, sutler’s daughter',
  diagnosis: 'Petrification from the fingertips, advancing at her wedding. Hand, then arm, then chest.',
  organ: 'flesh',
  // Two regions (GAM-0247): the arm on the left, the chest on the right; Tab pans between them.
  regions: [
    { kind: 'flesh', ...at(-210, -20), rx: 230, ry: 190 },
    { kind: 'flesh', ...at(120, 30), rx: 230, ry: 190 },
  ],
  timeLimit: 330,
  baseDrain: 0.1,
  tools: ALL,
  ranks: { S: 6410, A: 5130, B: 3850 },
  litany: true,
  seed: 48,
  phases: [
    // The first petrification teaches the stone (GAM-0212): the hand is safe to learn on.
    teach({
      callout: ['The hand. Crack the plates in order — the numbers — then salve the margin. Learn it here; the hand can wait.'],
      spawn: () => [new PetrifyFront([at(-380, 30), at(-280, 20), at(-160, 0), at(-60, -30), at(-40, -60)], 3, 4)],
    }),
    {
      callout: ['It’s jumped to the arm! Again — in order.'],
      spawn: () => [new PetrifyFront([at(-300, -100), at(-200, -80), at(-100, -70), at(-40, -60)], 4, 4.5)],
    },
    {
      callout: ['The chest — it’s nearly at her heart. Quickly, and in order!'],
      spawn: () => [new PetrifyFront([at(140, 140), at(60, 80), at(0, 0), at(-40, -60)], 4, 5)],
    },
    {
      callout: ['It’s stopped. Salve the stone-burns, and stitch where it cracked her.'],
      spawn: () => [new Rot(at(-200, 20), 36, 0.3), new Laceration(at(60, 60), 0.9, 50, 0.4)],
    },
  ],
};

export const OP_4_9: OperationDef = {
  id: 'op4-9',
  title: 'The Hour of None',
  patient: 'Pieter, militiaman',
  diagnosis: 'Collapsed at the ninth hour. Something that entered with an old arrow wound is tunnelling toward his heart.',
  organ: 'flesh',
  timeLimit: 420,
  baseDrain: 0.05,
  tools: ALL,
  ranks: { S: 6900, A: 5520, B: 4140 },
  litany: true,
  seed: 49,
  phases: [
    {
      callout: ['It’s under the skin, moving for his heart. Lens to find the head — then cut across it and brand it!'],
      spawn: (op: Operation) => [new NoneMalison(op)],
    },
    {
      callout: ['Out. The tunnels are opening — tend them.'],
      spawn: (op: Operation) => [new Laceration(at(150, 60), 0.7, 50, 0.5), new Grub(at(-30, 40), op, 35)],
    },
  ],
};

export const CHAPTER_4: Chapter = {
  id: 'ch4',
  numeral: 'IV',
  title: 'Sext and None',
  // NAR-0131: reads Chapter III's outcomes; writes `thirstChoice` (s4-6). `mauerFate`, `charterRevealed`,
  // `deadManVerdict` and `strohTrust` are not authored yet — see docs/narrative/flags.md.
  flags: { reads: ['hallerFate', 'hornchildCertificate'], writes: ['thirstChoice'] },
  steps: [
    { kind: 'story', story: STORY_4_1 },
    { kind: 'op', op: OP_4_1 },
    { kind: 'op', op: OP_4_10 },
    { kind: 'story', story: STORY_4_2 },
    { kind: 'op', op: OP_4_2 },
    { kind: 'story', story: STORY_4_3 },
    { kind: 'op', op: OP_4_3 },
    { kind: 'story', story: STORY_4_4 },
    { kind: 'op', op: OP_4_4 },
    { kind: 'story', story: STORY_4_5 },
    { kind: 'op', op: OP_4_5 },
    { kind: 'story', story: STORY_4_6 },
    { kind: 'op', op: OP_4_6 },
    { kind: 'story', story: STORY_4_7 },
    { kind: 'op', op: OP_4_7 },
    { kind: 'story', story: STORY_4_8 },
    { kind: 'story', story: STORY_4_9 },
    { kind: 'op', op: OP_4_8 },
    { kind: 'story', story: STORY_4_10 },
    { kind: 'story', story: STORY_4_11 },
    { kind: 'op', op: OP_4_9 },
    { kind: 'story', story: STORY_4_END },
  ],
};
