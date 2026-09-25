import { Embedded, Incision, Laceration, Rot } from '../surgery/entities';
import { TinctureSite, Vessel } from '../surgery/ailments/kilnrows';
import { Bud, Cyst, HexBall, Infant, VocalFold } from '../surgery/ailments/hollownight';
import { ComplineMalison } from '../surgery/bosses/compline';
import { NoneMalison, NONE_DEFAULT } from '../surgery/bosses/none';
import { OfficeMalison } from '../surgery/bosses/office';
import { PrimeMalison, PRIME_DEFAULT } from '../surgery/bosses/prime';
import { TerceMalison, TERCE_DEFAULT } from '../surgery/bosses/terce';
import { TallowClot, VespersMalison } from '../surgery/bosses/vespers';
import type { Operation, OperationDef } from '../surgery/operation';
import { at, closeIncision } from './chapter1';
import type { Chapter } from './campaign';
import { n, say, type StoryDef } from './story';

const ALL = ['lancet', 'tongs', 'leech', 'thread', 'salve', 'tincture', 'brand', 'lens'] as const;

/** Reduced-strength Hours for the Precentor's gauntlet (op5-7): same modules, 40 % of the HP. */
export const GAUNTLET_HP = 40;

// ====================================================================== stories

export const STORY_5_1: StoryDef = {
  id: 's5-1',
  place: 'Kessendorf — the Hospice of Saint Ildra, two days before Hollow Night',
  backdrop: 'hospice',
  lines: [
    n('CHAPTER V — VESPERS AND COMPLINE'),
    n('Vespers is the lamp-lighting, sung as the day fails. Compline is the last office: the prayer for a quiet night and a perfect end.'),
    n('The warrant is served at the hospice door in the middle of a shift, with a patient still open on the table.'),
    say('patient', 'By order of the council of Kessendorf: Doctor Kreuzer, for witchcraft practised under colour of surgery.', 'A council bailiff'),
    say('kreuzer', 'Let me close him. Five minutes.'),
    say('patient', 'The warrant says now.', 'A council bailiff'),
    say('ilse', 'Then the warrant can wait on the step. Doctor — go. I will close him.'),
    n('They take Kreuzer out through the ward. Behind him he hears Ilse counting stitches under her breath, steady as a bell.'),
  ],
};

export const STORY_5_2: StoryDef = {
  id: 's5-2',
  place: 'The Tribunal Court — the trial of Doctor Kreuzer',
  backdrop: 'chapel',
  lines: [
    n('The court sits in the old Tribunal hall. The council insists on a fair trial, which means the Widow Reiss chose the judges.'),
    say('patient', 'Evidence the first: a certificate. “A natural growth.” The child’s bone was a year old. The Doctor knew it.', 'The Prosecutor'),
    say('patient', 'Evidence the second: at the muster, for eight heartbeats, every candle in the tent stood still. Witnessed.', 'The Prosecutor'),
    say('mauer', 'I witnessed it. I witnessed him save my standard-bearer in the same eight heartbeats. Put that in your ledger too.'),
    say('patient', 'He took a stone out of me that sang, and he didn’t charge me for the tunnel he dug to do it. Witchcraft? Pah.', 'Orsa Flintvein'),
    say('patient', 'A letter from Master Haller, read into the record: “If the Doctor is a witch, so am I, and I taught him.”', 'The Clerk'),
    say('patient', 'My Liesl is home, and she sleeps. He lied on a piece of paper to do it. Hang me for thanking him.', 'Liesl’s mother'),
    say('stroh', 'The Tribunal’s charter in this city lapsed at the new year. Every arrest in its name since is void. Including this one.'),
    say('patient', 'The council renewed the charter this morning, Inquisitor. The Widow Reiss moved it. Sit down.', 'The Prosecutor'),
  ],
};

export const STORY_5_3: StoryDef = {
  id: 's5-3',
  place: 'The Tribunal Court — the verdict',
  backdrop: 'chapel',
  lines: [
    say('patient', 'The court finds Doctor Kreuzer guilty. He will burn at the east gate on the morning after Hollow Night.', 'The Presiding Judge'),
    n('He is taken below, to a cell cut into the rock under the Tribunal court. The rock is very old. The wall is very thin.'),
    n('At midnight the wall knocks. Twice, then once, then twice: mountain-folk courtesy.'),
    say('patient', 'Doctor! I have named this one the Kreuzer Tunnel. It is a very good tunnel. Mind your head.', 'Orsa Flintvein'),
    say('mauer', 'Thirty-five of mine at the other end, and not one of them saw a thing. Move, Doctor.'),
    say('kreuzer', 'Captain — you’ll hang for this.'),
    say('mauer', 'Then I’ll hang with thirty-five witnesses. Hollow Night is tomorrow; the Choir will finish its Office, and you’re the surgeon they fear.'),
  ],
};

export const STORY_5_4: StoryDef = {
  id: 's5-4',
  place: 'Kessendorf — Hollow Night',
  backdrop: 'street',
  lines: [
    n('Hollow Night. The streets empty at dusk. Charms of iron nails and dried rue hang on every door. Only the Choir walks abroad.'),
    n('For the first time, they sing openly: grey-robed lines of them, lanterns high, walking the city toward the hospice.'),
    say('choir', 'Light the lamp, and let it fail; / every flame must learn to kneel.', 'The Choir'),
    say('choir', 'Hush the ward, and hush the street; / sleep is kind, and death is sweet.', 'The Choir'),
    say('mauer', 'The Watch tried to turn one procession back at the Penny Stair. Sergeant Harrach took a ball — a black one. It’s budding.'),
    say('ilse', 'Hexstone shot. The flesh around it grows teeth, fingers, eyes. Lift the ball out with the tongs only, into the lead dish.'),
    say('ilse', 'And, Doctor — nothing else touches it. Hexstone remembers every hand that handles it. The Tribunal counts such things.'),
  ],
};

export const STORY_5_5: StoryDef = {
  id: 's5-5',
  place: 'The Cathedral Steps — Hollow Night',
  backdrop: 'street',
  lines: [
    n('On the cathedral steps a chorister boy, Jakob, sings the Choir’s hymn in a voice that is not his own, and cannot stop.'),
    say('ilse', 'Extra vocal folds. They’ve grown in his throat, and they hum with the procession. While they sing, I can’t hear a thing.'),
    say('kreuzer', 'Then we cut in the silences. Between the verses.'),
    say('patient', '…Light the lamp… and let it… Doctor, make it stop, I want my own voice back…', 'Jakob'),
  ],
};

export const STORY_5_6: StoryDef = {
  id: 's5-6',
  place: 'A tanner’s house off the Tanners’ Rows',
  backdrop: 'night',
  lines: [
    n('Dietmar the tanner has a cyst in his belly the size of a fist. It has a mouth. It has opinions.'),
    say('patient', '“Good evening, Doctor. Escaped, I hear. The Inquisitor would so like to know where you are.”', 'The cyst'),
    say('ilse', 'It must come out whole. Cut all the way round it, clear of the wall, then lift it with the tongs. If it bursts—'),
    say('patient', '“—something crawls out. Yes. Do be careful, Doctor. I would hate to tell anyone what I know.”', 'The cyst'),
    say('patient', 'I never asked for it to talk. It just started one morning, during the hymns.', 'Dietmar'),
  ],
};

export const STORY_5_7: StoryDef = {
  id: 's5-7',
  place: 'A chandler’s shop on Wick Lane',
  backdrop: 'night',
  lines: [
    n('The chandler’s daughter, Greta, has been pale for a week. Tonight her blood runs thick and pale as tallow.'),
    say('ilse', 'It’s setting in the vessels like wax. A touch of the brand to soften each clot — a touch only — then draw it off.'),
    say('patient', 'We made the candles for the Widow’s charity. Hundreds. She said they were for the hospice ward.', 'The chandler'),
    say('ilse', '…The ward’s candles. Doctor, every lamp in Saint Ildra’s is burning her tallow tonight.'),
  ],
};

export const STORY_5_8: StoryDef = {
  id: 's5-8',
  place: 'A midwife’s house by the east gate — under the Hollow Moon',
  backdrop: 'night',
  lines: [
    n('Rosina has laboured for a day and a night. The midwives will not bring a child into the world on Hollow Night. They wait.'),
    say('patient', 'A child born on Hollow Night belongs to the Choir. Everybody knows it. We wait for dawn.', 'Old Brigid, midwife'),
    say('kreuzer', 'If we wait for dawn, there will be no child and no mother. Nobody belongs to the Choir, Brigid. Not tonight, not ever.'),
    say('ilse', 'Open her, gently; lift the child with the tongs, and settle your grip before you move. Then the vessels, then close.'),
    say('patient', 'Do it, Doctor. I’ll take my chances with the Choir. I won’t take them with the waiting.', 'Rosina'),
  ],
};

export const STORY_5_9: StoryDef = {
  id: 's5-9',
  place: 'The Hospice of Saint Ildra — Vespers',
  backdrop: 'hospice',
  lines: [
    n('They come back to Saint Ildra’s at the lamp-lighting. Every candle in the ward is burning with a pale, sweet smoke.'),
    n('Sister Ilse stands in the middle of the ward with a taper in her hand. She is singing.'),
    n('One by one, as she sings, the lamps of the ward begin to go out.'),
    say('ilse', 'Light the lamp, and let it fail… Doctor. Doctor, I can’t stop. The lamps are in me. Every one of them.'),
    say('patient', 'Vespers! She’s the host — the Widow’s candles did it! Doctor, I’ll call the work. Tell me what you need.', 'Orsa Flintvein'),
    say('kreuzer', 'Keep the lamps lit, Orsa. Whatever happens. In the dark it hides.'),
    say('ilse', 'Doctor… I lied to the Inquisitor for you. On the certificate. I would do it again. Tell him, after.'),
  ],
};

export const STORY_5_9B: StoryDef = {
  id: 's5-9b',
  place: 'Beneath the Tribunal Court — the old cellars',
  backdrop: 'night',
  lines: [
    n('Ilse lives. She sleeps under Orsa’s coat. The last lamp in the ward burns clean.'),
    say('mauer', 'The Choir went down under the Tribunal court. Orsa’s tunnel comes out right beneath it. Thirty-five, Doctor. All of us.'),
    n('In the cellars they find the Burgomaster’s guard captain, sewn through with every Hour so far: ink, fire, and something burrowing.'),
    say('patient', 'He… he’s below. The Precentor. He took the Inquisitor. He said… he needed a strong heart for the last one.', 'Guard-captain Ebner'),
    say('kreuzer', 'Prime, Terce and None, all at once. Orsa — call them as they come.'),
  ],
};

export const STORY_5_10: StoryDef = {
  id: 's5-10',
  place: 'The crypt beneath the Tribunal Court',
  backdrop: 'chapel',
  lines: [
    n('In a crypt lit by the Widow’s candles, a thin grey man in a surgeon’s apron sits beside Inquisitor Stroh, who is not moving.'),
    say('choir', 'Doctor Kreuzer. Haller’s last pupil. Sit, please. You look as though you have been standing for a week.', 'The Precentor'),
    say('kreuzer', 'Aurel Vennholt. Let him go.'),
    say('choir', 'He is not in pain. That is more than you have ever managed for anyone. Look at his face.', 'The Precentor'),
    say('kreuzer', 'I stop pain so that people can go on living with the rest of it.'),
    say('choir', 'And they do go on. To the next wound, the next plague, the next war the council hires. You mend them for that.', 'The Precentor'),
    say('kreuzer', 'I mend them because they asked me to. Emmerich asked. Jorg asked. Liesl’s mother asked. Did anyone ask you?'),
    say('choir', 'Nobody asks for Compline, Doctor. It is sung for them. A quiet night and a perfect end — for a whole city.', 'The Precentor'),
    say('kreuzer', 'A city that doesn’t wake up in the morning is not at peace. It is dead. You have written that on a lot of skin.'),
    say('choir', 'Haller struck me off for mercy. Now you would strike me off for mercy. It is a very crowded word.', 'The Precentor'),
    say('kreuzer', 'You learned the Litany from the old offices. So did I. You used it to hold people still. I use it to hold them together.'),
    say('choir', 'The same hymn. You see? You and I have always been singing the same thing.', 'The Precentor'),
    say('kreuzer', 'No. I stop singing when the patient wakes up.'),
    say('patient', 'Doctor. I can reach him with a pick from here. One swing. Say the word.', 'Orsa Flintvein'),
    say('kreuzer', 'No. Nobody else dies in this crypt tonight. Not even him.'),
    say('choir', 'You would save me too. Haller never could stand you, I expect. You are what he hoped I would be.', 'The Precentor'),
    say('kreuzer', 'Haller stands me fine. He shouts at me by letter. You could have had letters, Aurel.'),
    say('choir', 'I had a Choir instead. They listen better.', 'The Precentor'),
    n('The Precentor smiles, and lays a hand on Stroh’s chest, and begins the last office.'),
    say('choir', 'Now let your servant depart in peace.', 'The Precentor'),
  ],
};

export const STORY_5_11: StoryDef = {
  id: 's5-11',
  place: 'The crypt — Compline',
  backdrop: 'chapel',
  lines: [
    n('Every sound in the crypt stops. Kreuzer’s own breath goes silent in his ears.'),
    say('patient', 'Doctor, his heart — it’s slowing like a clock nobody wound. He’s smiling!', 'Orsa Flintvein'),
    n('Kreuzer draws the star for the Litany. It comes out of him wrong — cold, and grey, and the Precentor’s.'),
    say('choir', 'Your stillness was always mine, Doctor. I only lent it to you.', 'The Precentor'),
    say('kreuzer', 'Then I’ll take it back. Orsa — lamps, tongs, brand. On the table with him.'),
  ],
};

export const STORY_5_12: StoryDef = {
  id: 's5-12',
  place: 'The crypt — after Compline',
  backdrop: 'chapel',
  lines: [
    n('Stroh breathes. The Precentor staggers, and the grey robe falls open. Beneath it, burned into his skin, a clock-face of eight sigils.'),
    say('choir', 'It will not stop. It was never mine to stop. The Office sings itself now — through me, and then through the city.', 'The Precentor'),
    say('stroh', 'Doctor. Let it take him. Let it end in him and go no further. No court on earth would blame you.'),
    say('kreuzer', 'I would. He’s a patient, Inquisitor. On the table.'),
    say('ilse', 'I’m here. Orsa carried me down. I’ll hold his vitals, Doctor. You unsing it.'),
  ],
};

export const STORY_5_END: StoryDef = {
  id: 's5-end',
  place: 'Kessendorf — the morning after Hollow Night',
  backdrop: 'hospice',
  lines: [
    n('Dawn comes up on Kessendorf, and the city wakes: which is to say it complains, and coughs, and goes to work.'),
    n('Aurel Vennholt lives, in a Tribunal cell, and asks each morning for news of the patients. He has not sung since.'),
    say('stroh', 'The council has withdrawn the warrant. The Widow Reiss has left the city, in a carriage without a crest.'),
    say('stroh', 'I have written to the Tribunal that the matter of the Doctor’s hands is closed. I did not say how I closed it.'),
    say('mauer', 'Thirty-five. All thirty-five, Doctor. I said the names at the gate this morning, the six and the thirty-five.'),
    say('patient', 'I have named a new mine for you. The Kreuzer Hope. It is a very good mine. It has not fallen in once.', 'Orsa Flintvein'),
    say('haller', 'I read your letter. Unsang it, you say. Well. I only ever taught you to sing it. The rest was your own.'),
    say('ilse', 'Doctor. There’s a drover on the table. Somebody at the Gilded Goose disagreed with his dice.'),
    say('kreuzer', 'Knife wounds. Simple work.'),
    say('ilse', 'And in this hospice, we do not lose patients to simple work.'),
    n('THE END — THE QUIET NIGHT, AVERTED'),
  ],
};

// ====================================================================== operations

export const OP_5_5: OperationDef = {
  id: 'op5-5',
  title: 'Hexstone Shot',
  patient: 'Sergeant Lotte Harrach, Kessendorf Watch',
  diagnosis: 'A black hexstone ball in the shoulder. The flesh around it is budding teeth, fingers and eyes.',
  organ: 'flesh',
  timeLimit: 300,
  baseDrain: 0.1,
  tools: ALL,
  ranks: { S: 5100, A: 4100, B: 3050 },
  litany: true,
  seed: 55,
  phases: [
    {
      callout: ['Cut the buds before they root. Then the ball — tongs only — into the lead dish.'],
      spawn: () => [new HexBall(at(-20, 0), 7, 3), new Bud(at(-120, -50), 0), new Bud(at(90, 50), 2)],
    },
    {
      callout: ['Clear the last of the buds, and dress the wound.'],
      spawn: () => [new Rot(at(-20, 40), 34, 0.4)],
    },
  ],
};

export const OP_5_1: OperationDef = {
  id: 'op5-1',
  title: 'Choir-Throat',
  patient: 'Jakob, cathedral chorister',
  diagnosis: 'Extra vocal folds grown in the larynx, humming the Choir’s hymn. While they sing, every other sound is drowned.',
  organ: 'flesh',
  timeLimit: 270,
  baseDrain: 0.1,
  tools: ALL,
  ranks: { S: 4850, A: 3900, B: 2900 },
  litany: true,
  seed: 51,
  phases: [
    {
      callout: ['Open the throat — carefully, it’s a small one.'],
      spawn: () => [new Incision([at(-120, -20), at(0, -30), at(120, -20)])],
    },
    {
      callout: ['Cut each fold only in the silence between verses. Watch the ring.'],
      spawn: () => [new VocalFold(at(-70, 20), 3, 2, 0), new VocalFold(at(0, 40), 3, 2, 1.6), new VocalFold(at(70, 20), 3, 2, 3.2)],
    },
    closeIncision(['Close him. He’ll sing again — his own songs.']),
  ],
};

export const OP_5_2: OperationDef = {
  id: 'op5-2',
  title: 'The Mouth Beneath',
  patient: 'Dietmar, tanner',
  diagnosis: 'A talking abdominal cyst. It must come out whole; if it ruptures, something crawls out.',
  organ: 'gut',
  timeLimit: 300,
  baseDrain: 0.1,
  tools: ALL,
  ranks: { S: 5100, A: 4100, B: 3050 },
  litany: true,
  seed: 52,
  phases: [
    {
      callout: ['Cut all the way round it, clear of the wall. Don’t touch the cyst itself with the blade.'],
      spawn: () => [new Cyst(at(10, 10), 30)],
    },
    {
      callout: ['Close the bed it lay in.'],
      spawn: () => [new Rot(at(-120, -40), 30, 0.3)],
    },
  ],
};

export const OP_5_3: OperationDef = {
  id: 'op5-3',
  title: 'Blood of Tallow',
  patient: 'Greta, chandler’s daughter',
  diagnosis: 'Blood setting like wax in the vessels. Soften each clot with a light touch of the brand, then draw it off.',
  organ: 'flesh',
  timeLimit: 270,
  baseDrain: 0.15,
  tools: ALL,
  ranks: { S: 4850, A: 3900, B: 2900 },
  litany: true,
  seed: 53,
  phases: [
    {
      callout: ['A touch of the brand to soften — no more than a moment — then the leech-pipe.'],
      spawn: () => [new TallowClot(at(-150, -20)), new TallowClot(at(-50, 50)), new TallowClot(at(60, -40)), new TallowClot(at(160, 30))],
    },
    {
      callout: ['A thinning draught, to keep the rest of it moving.'],
      spawn: () => [new TinctureSite(at(0, 0), 'Blood thinned', 1.0, 0.3, '#e8d8a0'), new TallowClot(at(100, 80), 16)],
    },
  ],
};

export const OP_5_4: OperationDef = {
  id: 'op5-4',
  title: 'Under the Hollow Moon',
  patient: 'Rosina, labouring mother',
  diagnosis: 'Obstructed labour through a night and a day. The child must be delivered by the knife, gently.',
  organ: 'flesh',
  timeLimit: 330,
  baseDrain: 0.1,
  tools: ALL,
  ranks: { S: 5400, A: 4300, B: 3250 },
  litany: true,
  seed: 54,
  phases: [
    {
      callout: ['A low incision, along the line.'],
      spawn: () => [new Incision([at(-160, 60), at(-50, 80), at(60, 80), at(160, 60)])],
    },
    {
      callout: ['Now the child. Tongs — hold still until the grip is sure, then lift slowly, off the table to Brigid.'],
      spawn: () => [new Infant(at(0, 20))],
    },
    {
      callout: ['Tie off the vessels. Thread, if you can — she has a child to raise.'],
      spawn: () => [new Vessel(at(-50, 50), Math.PI / 2), new Vessel(at(50, 50), Math.PI / 2)],
    },
    closeIncision(['Close her. Gently. Hollow Night has one good thing in it after all.']),
  ],
};

export const OP_5_6: OperationDef = {
  id: 'op5-6',
  title: 'The Hour of Vespers',
  patient: 'Sister Ilse, of the Merciful Order',
  diagnosis: 'Wick-filaments through the vessels, blood turning to tallow; the ward’s lamps are dying with her. Callouts: Orsa.',
  organ: 'flesh',
  timeLimit: 420,
  baseDrain: 0.05,
  tools: ALL,
  ranks: { S: 8650, A: 6900, B: 5200 },
  litany: true,
  seed: 56,
  phases: [
    {
      callout: ['Orsa: Lamps! Keep them burning — brand on a lamp relights it. The wicks only show in the light.', 'Orsa: Cut the wicks across with the lancet, soften the tallow, draw it off.'],
      spawn: (op: Operation) => [new VespersMalison(at(0, 0), op)],
    },
    {
      callout: ['Orsa: It’s gone out of her! Tidy her up, Doctor — she’ll want to do it herself otherwise.'],
      spawn: () => [new Laceration(at(-90, 60), 0.4, 50, 0.5), new Rot(at(120, -40), 30, 0.3)],
    },
  ],
};

export const OP_5_7: OperationDef = {
  id: 'op5-7',
  title: 'The Precentor’s Remnants',
  patient: 'Guard-captain Ebner, the Burgomaster’s guard',
  diagnosis: 'Sewn through with remnants of the Hours already sung: Prime’s ink, Terce’s fire, None’s burrower.',
  organ: 'flesh',
  timeLimit: 300,
  baseDrain: 0.05,
  tools: ALL,
  ranks: { S: 9350, A: 7500, B: 5600 },
  litany: true,
  seed: 57,
  phases: [
    {
      callout: ['Orsa: Prime’s quill — names! Strike them out, newest ink first.'],
      spawn: (op: Operation) => [new PrimeMalison(at(0, 20), op, { ...PRIME_DEFAULT, hp: GAUNTLET_HP })],
    },
    {
      callout: ['Orsa: Fire now — Terce! Salve, never the brand!'],
      spawn: (op: Operation) => [new TerceMalison(op, { ...TERCE_DEFAULT, hp: GAUNTLET_HP })],
    },
    {
      callout: ['Orsa: And a burrower — None — for his heart. Lens!'],
      spawn: (op: Operation) => [new NoneMalison(op, { ...NONE_DEFAULT, hp: GAUNTLET_HP })],
    },
    {
      callout: ['Orsa: That’s the last of them in him. Patch him up.'],
      spawn: () => [new Laceration(at(-60, 70), 0.5, 50, 0.5), new Embedded(at(90, -40), 'shard', 1.1, false)],
    },
  ],
};

export const OP_5_8: OperationDef = {
  id: 'op5-8',
  title: 'The Hour of Compline',
  patient: 'Inquisitor Stroh, Ash Tribunal',
  diagnosis: 'Compline, sung into him by the Precentor. His heart slows toward “a perfect end”. The Litany has been stolen.',
  organ: 'heart',
  timeLimit: 480,
  baseDrain: 0.05,
  tools: ALL,
  ranks: { S: 10300, A: 8250, B: 6200 },
  litany: true,
  seed: 58,
  phases: [
    {
      callout: ['Orsa: It’s wearing the old Hours like masks. Beat each one as it comes.'],
      spawn: (op: Operation) => [new ComplineMalison(at(0, 0), op)],
    },
    {
      callout: ['Orsa: Quiet’s broken. He’s breathing! Mend him.'],
      spawn: () => [new Laceration(at(-110, 60), 0.3, 56, 0.5), new Rot(at(110, -30), 30, 0.3)],
    },
  ],
};

export const OP_5_9: OperationDef = {
  id: 'op5-9',
  title: 'The Office',
  patient: 'Aurel Vennholt, the Precentor',
  diagnosis: 'The complete Office of eight Hours, turned on the man who wrote it. A clock-face of sigils around his heart.',
  organ: 'heart',
  timeLimit: 720,
  baseDrain: 0.05,
  tools: ALL,
  ranks: { S: 18950, A: 15150, B: 11350 },
  litany: true,
  seed: 59,
  phases: [
    {
      callout: ['Ilse: Every Hour, one at a time — the hand shows which. Beat each and its sigil goes out.'],
      spawn: (op: Operation) => [new OfficeMalison(op)],
    },
    {
      callout: ['Ilse: It’s over. He’s only a man now. Close what’s left.'],
      spawn: () => [new Laceration(at(-80, 60), 0.3, 50, 0.4), new Laceration(at(90, -50), 2.4, 46, 0.4)],
    },
  ],
};

export const CHAPTER_5: Chapter = {
  id: 'ch5',
  numeral: 'V',
  title: 'Vespers and Compline',
  steps: [
    { kind: 'story', story: STORY_5_1 },
    { kind: 'story', story: STORY_5_2 },
    { kind: 'story', story: STORY_5_3 },
    { kind: 'story', story: STORY_5_4 },
    { kind: 'op', op: OP_5_5 },
    { kind: 'story', story: STORY_5_5 },
    { kind: 'op', op: OP_5_1 },
    { kind: 'story', story: STORY_5_6 },
    { kind: 'op', op: OP_5_2 },
    { kind: 'story', story: STORY_5_7 },
    { kind: 'op', op: OP_5_3 },
    { kind: 'story', story: STORY_5_8 },
    { kind: 'op', op: OP_5_4 },
    { kind: 'story', story: STORY_5_9 },
    { kind: 'op', op: OP_5_6 },
    { kind: 'story', story: STORY_5_9B },
    { kind: 'op', op: OP_5_7 },
    { kind: 'story', story: STORY_5_10 },
    { kind: 'story', story: STORY_5_11 },
    { kind: 'op', op: OP_5_8 },
    { kind: 'story', story: STORY_5_12 },
    { kind: 'op', op: OP_5_9 },
    { kind: 'story', story: STORY_5_END },
  ],
};
