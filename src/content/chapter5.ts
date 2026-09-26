import { JOURNAL_STORY } from './journal';
import { OP_5_10 } from './ops/bones';
import { EPILOGUE_STORY } from './epilogue';
import { ENDING_EXILE, ENDING_PARDON, ENDING_PYRE, endingIs, hostIs, strohTrust, trialVerdict, verdictIs } from './endings';
import { whisperBand, whisperScore, whisperThought, type WhisperBand } from './whisper';
import { trialInterview } from './interviews';
import { byBand, chapterAverageA, flags } from './flags';
import { Embedded, Incision, Laceration, Rot } from '../surgery/entities';
import { TinctureSite, Vessel } from '../surgery/ailments/kilnrows';
import { Bud, Cyst, HexBall, Infant, VocalFold } from '../surgery/ailments/hollownight';
import { NoneMalison, NONE_DEFAULT } from '../surgery/bosses/none';
import { OfficeMalison } from '../surgery/bosses/office';
import { PrimeMalison, PRIME_DEFAULT } from '../surgery/bosses/prime';
import { TerceMalison, TERCE_DEFAULT } from '../surgery/bosses/terce';
import { TallowClot } from '../surgery/bosses/vespers';
import type { Operation, OperationDef } from '../surgery/operation';
import { at, closeIncision } from './chapter1';
import type { Chapter } from './campaign';
import { choose, n, onlyIf, say, type StoryDef } from './story';
import { OP_5_6, OP_5_8 } from './ops/hours';
export { OP_5_6, OP_5_8 };

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
    // NAR-0114: Jost (op1-1) drives the bailiff's cart, as slowly as a drover can.
    n('The bailiff’s cart is driven by a drover the Doctor knows.'),
    ...byBand('op1-1', {
      high: say('patient', 'Two stitchings, Doctor, and I can’t find either scar. My wife says I’m lying. I’ll drive you. Slowly.', 'Jost'),
      mid: say('patient', 'Your stitches still itch when it rains, Doctor. I’m to drive you to the cells. I’m driving very slowly.', 'Jost'),
      low: say('patient', 'I’ve a scar like a ploughed field, Doctor, and I’d take it again. They’ll drive this cart without me or not at all.', 'Jost'),
    }),
    say('patient', 'The warrant says now.', 'A council bailiff'),
    say('ilse', 'Then the warrant can wait on the step. Doctor — go. I will close him.'),
    n('They take Kreuzer out through the ward. Behind him he hears Ilse counting stitches under her breath, steady as a bell.'),
    // On the way to the cells, what the city will say it saw (NAR-0093).
    ...whisperThought(2),
  ],
};

export const STORY_5_2: StoryDef = {
  id: 's5-2',
  place: 'The Tribunal Court — the trial of Doctor Kreuzer',
  backdrop: 'chapel',
  // NAR-0147: the evidence is what the player did. Every false certificate and witnessed Litany is entered;
  // the witnesses are whoever the campaign left standing; Stroh's stance follows his trust.
  lines: [
    n('The court sits in the old Tribunal hall. The council insists on a fair trial, which means the Widow Reiss chose the judges.'),
    say('patient', 'The fair-trial rule: the accused may answer every charge, and call any witness who can walk here. Proceed.', 'The Presiding Judge'),
    ...onlyIf(
      { flag: 'hornchildCertificate', is: 'natural' },
      say('patient', 'Evidence the first: a certificate. “A natural growth.” The child’s bone was a year old. The Doctor knew it.', 'The Prosecutor'),
    ),
    ...onlyIf(
      { flag: 'hornchildCertificate', is: 'turned' },
      say('patient', 'Evidence the first: a certificate, true in every word. Even the Doctor’s honesty is entered against him today.', 'The Prosecutor'),
      say('patient', 'You wrote that my Liesl was turned, and they came for her. He is an honest man. I hope he burns for it.', 'Liesl’s mother'),
    ),
    ...onlyIf(
      (f) => Number(f.get('litanySeenCount') ?? 0) >= 3,
      say('patient', 'Evidence the second: three times and more, witnessed, every candle in a room stood still while he worked.', 'The Prosecutor'),
    ),
    ...onlyIf(
      (f) => {
        const seen = Number(f.get('litanySeenCount') ?? 0);
        return seen >= 1 && seen < 3;
      },
      say('patient', 'Evidence the second: at the muster, for eight heartbeats, every candle in the tent stood still. Witnessed.', 'The Prosecutor'),
    ),
    ...onlyIf(
      (f) => Number(f.get('litanySeenCount') ?? 0) === 0,
      say('patient', 'Evidence the second: rumour. No witness saw a candle stand still. The court notes that none was looking.', 'The Prosecutor'),
    ),
    // Interview-mode questioning, as far as the story scene carries it (the full mode is CON-0235).
    say('patient', 'Doctor Kreuzer. Under oath. Have you, at the table, drawn a star in the air and stopped the hour?', 'The Prosecutor'),
    choose('kreuzer', 'The hall is silent. Stroh has stopped writing. Ilse, in the gallery, has her eyes shut.', [
      { id: 'confess', text: 'I have. A star, and a prayer I learned in Weissburg. Every time, a patient lived who would not have.', set: { trialAnswer: 'confess' } },
      { id: 'deny', text: 'I have not. I am a surgeon. I cut, I close, and I pray like any man does, with my mouth shut.', set: { trialAnswer: 'deny' } },
    ]),
    ...onlyIf(
      { all: [{ flag: 'trialAnswer', is: 'deny' }, (f) => Number(f.get('litanySeenCount') ?? 0) > 0] },
      say('patient', 'Let the record show the accused denies what witnesses swore to. Perjury, then, as well as witchcraft.', 'The Prosecutor'),
    ),
    ...onlyIf(
      { flag: 'trialAnswer', is: 'confess' },
      say('patient', 'Let the record show the accused confesses it. The court had not expected to be saved the trouble.', 'The Prosecutor'),
    ),
    ...onlyIf(
      { flag: 'mauerFate', is: 'hale' },
      say('mauer', 'I witnessed the candles. I witnessed him save my standard-bearer in the same eight heartbeats. Put that in your ledger too.'),
    ),
    ...onlyIf(
      { flag: 'mauerFate', is: 'maimed' },
      say('patient', 'A deposition from Captain Mauer, taken at his bedside: “He sewed me back together. Ask the Hour who unsewed me.”', 'The Clerk'),
    ),
    say('patient', 'He took a stone out of me that sang, and he didn’t charge me for the tunnel he dug to do it. Witchcraft? Pah.', 'Orsa Flintvein'),
    ...onlyIf(
      { flag: 'hallerFate', is: 'hands' },
      say('haller', 'If the Doctor is a witch, so am I, and I taught him. These hands are proof. Look at them. He saved them.'),
    ),
    ...onlyIf(
      { flag: 'hallerFate', is: 'scarred' },
      say('patient', 'A letter from Master Haller, read into the record: “If the Doctor is a witch, so am I, and I taught him.”', 'The Clerk'),
    ),
    ...onlyIf(
      { flag: 'hallerFate', is: 'lost' },
      say('patient', 'A letter found in Master Haller’s desk after the fire, written the night before: “If the Doctor is a witch, so was I, and I taught him.”', 'The Clerk'),
    ),
    ...onlyIf(
      { flag: 'hornchildCertificate', is: 'natural' },
      say('patient', 'My Liesl is home, and she sleeps. He lied on a piece of paper to do it. Hang me for thanking him.', 'Liesl’s mother'),
    ),
    ...onlyIf(
      (f) => strohTrust(f) >= 2,
      say('stroh', 'I call myself for the defence. I kept a ledger of this man’s candles for a year. Every one went out over a living patient.'),
      say('stroh', 'The Tribunal’s charter lapsed at the new year. Every arrest in its name since is void. Including this one. Including mine.'),
      say('patient', 'The council renewed the charter this morning, Inquisitor. The Widow Reiss moved it. Sit down.', 'The Prosecutor'),
      say('stroh', 'Then I will stand, and the court may renew me too.'),
    ),
    ...onlyIf(
      (f) => strohTrust(f) === 1,
      say('stroh', 'The Tribunal’s charter in this city lapsed at the new year. Every arrest in its name since is void. Including this one.'),
      say('patient', 'The council renewed the charter this morning, Inquisitor. The Widow Reiss moved it. Sit down.', 'The Prosecutor'),
    ),
    ...onlyIf(
      (f) => strohTrust(f) <= 0,
      say('stroh', 'I enter my ledger. Every candle that stood still at this man’s table, with the date and the name of the patient.'),
      say('stroh', 'I do not know what he is. The court should not burn a man for that. But it should know what I have seen.'),
    ),
  ],
};

export const STORY_5_3: StoryDef = {
  id: 's5-3',
  place: 'The Tribunal Court — the verdict',
  backdrop: 'chapel',
  // NAR-0148: acquittal (a thin case with Stroh for the defence), or a conviction broken by Mauer's Watch
  // (if the captain is hale) or by Orsa's tunnel. Every route ends under the court for Hollow Night.
  lines: [
    ...onlyIf(
      verdictIs('acquitted'),
      say('patient', 'The court finds the case not proven. The accused is free to— the council has a writ, Your Honour.', 'The Presiding Judge'),
      say('patient', 'The Doctor is held in the council’s cells until the Tribunal’s appeal, after Hollow Night. For his own safety.', 'A council bailiff'),
      say('stroh', 'His safety. Under the Widow’s court, on Hollow Night. I will be at the door, Doctor.'),
    ),
    ...onlyIf(
      (f) => trialVerdict(f) !== 'acquitted',
      say('patient', 'The court finds Doctor Kreuzer guilty. He will burn at the east gate on the morning after Hollow Night.', 'The Presiding Judge'),
    ),
    n('He is taken below, to a cell cut into the rock under the Tribunal court. The rock is very old. The wall is very thin.'),
    ...onlyIf(
      verdictIs('rescued'),
      n('At midnight the guardroom door opens without a key. The Watch comes in wearing its own colours, and nobody stops it.'),
      say('mauer', 'Thirty-five of mine, and the gaolers are having a very long supper. Move, Doctor.'),
      say('kreuzer', 'Captain — you’ll hang for this.'),
      say('mauer', 'Then I’ll hang with thirty-five witnesses. Hollow Night is tomorrow, and you’re the surgeon the Choir fears.'),
      n('Behind them, the wall of the cell knocks. Twice, then once, then twice: dwarf courtesy, a minute late.'),
      say('patient', 'You are out already? I dug a whole tunnel. It is a very good tunnel. Nobody has even looked at it.', 'Orsa Flintvein'),
      say('mauer', 'Keep it open. The Choir went down under this court. We may want a back door.'),
    ),
    ...onlyIf(
      (f) => trialVerdict(f) !== 'rescued',
      n('At midnight the wall knocks. Twice, then once, then twice: dwarf courtesy.'),
      say('patient', 'Doctor! I have named this one the Kreuzer Tunnel. It is a very good tunnel. Mind your head.', 'Orsa Flintvein'),
    ),
    ...onlyIf(
      verdictIs('tunnelled'),
      say('mauer', 'Thirty-five of mine at the other end, and not one of them saw a thing. Move, Doctor.'),
      say('kreuzer', 'Captain — you’ll hang for this. And you can barely stand.'),
      say('mauer', 'Then I’ll hang leaning on a crutch. Hollow Night is tomorrow; the Choir will finish its Office, and you’re the surgeon they fear.'),
    ),
    ...onlyIf(
      verdictIs('acquitted'),
      say('stroh', 'I said I would be at the door. I did not say which one. Go with the dwarf, Doctor. I will tell the council you were never here.'),
    ),
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
    // NAR-0114: Emmerich (op1-5), who once carried Matins, knows this hymn.
    ...byBand('op1-5', {
      high: say('patient', 'Emmerich, Doctor — the page. I know that hymn. It sang in me once, and you made it stop. Make it stop for him.', 'Emmerich'),
      mid: say('patient', 'Emmerich, Doctor. I still hear it sometimes, in my sleep. Make it stop for him the way you did for me.', 'Emmerich'),
      low: say('patient', 'Emmerich, Doctor. The mark on my collarbone aches when they sing. I still hear them. Please — make it stop for him.', 'Emmerich'),
    }),
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
    // NAR-0097: Ilse's side scene, for a Chapter V averaging A or better.
    ...onlyIf(
      (f) => chapterAverageA(5, f),
      n('For a moment, before they go down into the cellars, she wakes.'),
      say('ilse', 'The lamps. Did you keep the lamps?'),
      say('kreuzer', 'Every one. Orsa relit the last with her pipe.'),
      say('ilse', 'I could hear it, Doctor. Vespers. It sang the way the convent sings at evening, and I wanted to go with it.'),
      say('ilse', 'That is the worst of it. I wanted to.'),
      say('kreuzer', 'You didn’t go.'),
      say('ilse', 'You would not let me. You never let anyone go. It is your most irritating quality.'),
      say('ilse', 'When this is over I want a ward with windows. And a surgeon who sleeps. One of those, at least.'),
      say('kreuzer', 'I’ll see about the windows.'),
      n('She is asleep again before he can say anything more foolish.'),
    ),
    say('mauer', 'The Choir went down under the Tribunal court. Orsa’s tunnel comes out right beneath it. Thirty-five, Doctor. All of us.'),
    n('In the cellars they find the Burgomaster’s guard captain, sewn through with every Hour so far: ink, fire, and something burrowing.'),
    ...onlyIf(
      hostIs('stroh'),
      say('patient', 'He… he’s below. The Precentor. He took the Inquisitor. He said… he needed a strong heart for the last one.', 'Guard-captain Ebner'),
    ),
    ...onlyIf(
      hostIs('burgomaster'),
      say('patient', 'He… he’s below. The Precentor. He took the Burgomaster. He said… a city should go to sleep with its father.', 'Guard-captain Ebner'),
    ),
    say('kreuzer', 'Prime, Terce and None, all at once. Orsa — call them as they come.'),
  ],
};

export const STORY_5_10: StoryDef = {
  id: 's5-10',
  place: 'The crypt beneath the Tribunal Court',
  backdrop: 'chapel',
  lines: [
    // NAR-0155 / CON-0199: the host is Stroh, or the Burgomaster if Stroh stood with the prosecution.
    ...onlyIf(
      hostIs('stroh'),
      n('In a crypt lit by the Widow’s candles, a thin grey man in a surgeon’s apron sits beside Inquisitor Stroh, who is not moving.'),
    ),
    ...onlyIf(
      hostIs('burgomaster'),
      n('In a crypt lit by the Widow’s candles, a thin grey man in a surgeon’s apron sits beside the Burgomaster, who is not moving.'),
    ),
    say('choir', 'Doctor Kreuzer. Haller’s last pupil. Sit, please. You look as though you have been standing for a week.', 'The Precentor'),
    say('kreuzer', 'Aurel Vennholt. Let him go.'),
    say('choir', 'He is not in pain. That is more than you have ever managed for anyone. Look at his face.', 'The Precentor'),
    ...onlyIf(
      hostIs('burgomaster'),
      say('choir', 'I wanted your Inquisitor. But he sits with the council tonight, drafting your sentence. The Burgomaster came when called.', 'The Precentor'),
    ),
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
    ...onlyIf(hostIs('stroh'), n('The Precentor smiles, and lays a hand on Stroh’s chest, and begins the last office.')),
    ...onlyIf(hostIs('burgomaster'), n('The Precentor smiles, and lays a hand on the Burgomaster’s chest, and begins the last office.')),
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
    ...onlyIf(
      hostIs('stroh'),
      n('Stroh breathes. The Precentor staggers, and the grey robe falls open. Beneath it, burned into his skin, a clock-face of eight sigils.'),
    ),
    ...onlyIf(
      hostIs('burgomaster'),
      n('The Burgomaster breathes, and complains. The Precentor staggers; the grey robe falls open on a clock-face of eight burned sigils.'),
      n('Boots on the crypt stair: Inquisitor Stroh, with a council lantern and a drawn sword, come down to arrest the wrong man.'),
    ),
    say('choir', 'It will not stop. It was never mine to stop. The Office sings itself now — through me, and then through the city.', 'The Precentor'),
    say('stroh', 'Doctor. Let it take him. Let it end in him and go no further. No court on earth would blame you.'),
    say('kreuzer', 'I would. He’s a patient, Inquisitor. On the table.'),
    say('ilse', 'I’m here. Orsa carried me down. I’ll hold his vitals, Doctor. You unsing it.'),
  ],
};

/** The pardon ending keeps the historical id `s5-end` (NAR-0157; the others live in endings.ts). */
export const STORY_5_END: StoryDef = ENDING_PARDON;

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
  ranks: { S: 4900, A: 3920, B: 2940 },
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
  ranks: { S: 5010, A: 4010, B: 3010 },
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

/** The talking cyst's threat (CON-0176), by the Whisper band: the evidence it would carry to Stroh. */
const CYST_THREAT: Record<WhisperBand, string> = {
  unremarked: 'Nobody watches you, surgeon. Nobody at all. How lonely. Let me out, and I will watch you.',
  noted: 'The Inquisitor keeps a ledger of candles. I could tell him what the candles did while your lips moved.',
  suspected: 'Eight heartbeats in the muster tent. A founder’s child. I know every page of his ledger, and the one he hasn’t written.',
  accused: 'They already know, surgeon. I would only tell them where you keep the star. Just under your breath.',
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
  ranks: { S: 5090, A: 4070, B: 3050 },
  litany: true,
  seed: 52,
  phases: [
    {
      // CON-0128 / CON-0176: the cyst talks, and what it threatens to tell Stroh is what the city has seen.
      interject: () => [
        { name: 'Dietmar, tanner', text: 'It isn’t me talking, Doctor. I swear on my mother it isn’t me.' },
        { name: 'The cyst', text: CYST_THREAT[whisperBand(whisperScore(flags))] },
        { who: 'kreuzer', text: 'I know it isn’t you, Dietmar. Hold still, and don’t listen to it.' },
      ],
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
  ranks: { S: 4840, A: 3870, B: 2900 },
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
  ranks: { S: 5630, A: 4500, B: 3380 },
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


export const OP_5_7: OperationDef = {
  id: 'op5-7',
  title: 'The Precentor’s Remnants',
  patient: 'Guard-captain Ebner, the Burgomaster’s guard',
  diagnosis: 'Sewn through with remnants of the Hours already sung: Prime’s ink, Terce’s fire, None’s burrower.',
  organ: 'flesh',
  timeLimit: 300,
  baseDrain: 0.05,
  tools: ALL,
  ranks: { S: 9370, A: 7500, B: 5620 },
  litany: true,
  seed: 57,
  // CON-0190: Ilse is still recovering; Orsa calls the phases.
  assistant: 'orsa',
  phases: [
    {
      callout: ['Prime’s quill — names! Strike them out, newest ink first.'],
      spawn: (op: Operation) => [new PrimeMalison(at(0, 20), op, { ...PRIME_DEFAULT, hp: GAUNTLET_HP })],
    },
    {
      callout: ['Fire now — Terce! Salve, never the brand!'],
      spawn: (op: Operation) => [new TerceMalison(op, { ...TERCE_DEFAULT, hp: GAUNTLET_HP })],
    },
    {
      callout: ['And a burrower — None — for his heart. Lens!'],
      spawn: (op: Operation) => [new NoneMalison(op, { ...NONE_DEFAULT, hp: GAUNTLET_HP })],
    },
    {
      callout: ['That’s the last of them in him. Patch him up.'],
      spawn: () => [new Laceration(at(-60, 70), 0.5, 50, 0.5), new Embedded(at(90, -40), 'shard', 1.1, false)],
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
  ranks: { S: 12600, A: 10080, B: 7560 },
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
  // NAR-0145/0158: the finale reads every prior flag; the ending is derived from them (src/content/endings.ts).
  flags: {
    reads: ['cantorMercy', 'litanySeenCount', 'hornchildCertificate', 'strohTooth', 'strohToothFine', 'hallerFate', 'thirstChoice', 'mauerFate', 'deadManVerdict', 'trialAnswer', 'trialRebuttals'],
    writes: ['trialAnswer', 'trialRebuttals'],
  },
  steps: [
    { kind: 'story', story: STORY_5_1 },
    { kind: 'story', story: STORY_5_2 },
    // CON-0235: the cross-examination; each rebuttal comes off the prosecution's case.
    {
      kind: 'discipline',
      discipline: {
        id: 'iv5-trial',
        title: 'The Trial of Doctor Kreuzer',
        place: 'The Tribunal Court — cross-examination',
        backdrop: 'chapel',
        mode: 'interview',
        interview: trialInterview,
        after: (_r, session) => ({ trialRebuttals: session.exposed.length }),
        writes: ['trialRebuttals'],
      },
    },
    { kind: 'story', story: STORY_5_3 },
    { kind: 'story', story: STORY_5_4 },
    { kind: 'op', op: OP_5_5 },
    { kind: 'op', op: OP_5_10 },
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
    // The ending matrix (NAR-0158): one of three for a won finale; the Perfect End is its failure scene.
    { kind: 'story', story: STORY_5_END, if: endingIs('pardon') },
    { kind: 'story', story: ENDING_PYRE, if: endingIs('pyre') },
    { kind: 'story', story: ENDING_EXILE, if: endingIs('exile') },
    // Epilogue cards (NAR-0159): twelve people, each in the fate the ending and the flags earned.
    { kind: 'story', story: EPILOGUE_STORY },
    // Kreuzer's journal (NAR-0094): one page for the ending that played.
    { kind: 'story', story: JOURNAL_STORY },
  ],
};
