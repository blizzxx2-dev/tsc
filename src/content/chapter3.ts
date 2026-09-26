import { teach } from './teach';
import { TRIAGE_KILNROWS } from './triage';
import { OP_3_12, OP_3_13 } from './ops/bones';
import { BloodPool, Bubo, Burn, Embedded, Incision, Laceration, Rot } from '../surgery/entities';
import { Agitation, Amputation, ClothFragment, DressedBud, HornBud, Jaw, leadDeposit, Molar, TinctureSite, Worm, woundFeverPhase } from '../surgery/ailments/kilnrows';
import { Artery } from '../surgery/ailments/vennmark';
import type { Operation, OperationDef } from '../surgery/operation';
import { at, closeIncision } from './chapter1';
import type { Chapter } from './campaign';
import { choose, n, onlyIf, say, type StoryDef } from './story';
import { whisperThought } from './whisper';
import { INTERVIEW_FOUNDERS, INTERVIEW_LIESL } from './interviews';
import { FORENSIC_PREDECESSOR } from './forensics';
import { byBand, chapterAverageA, flags, licenceKept, atLeast } from './flags';
import { OP_3_10, OP_3_11 } from './ops/hours';
export { OP_3_10, OP_3_11 };

const ALL = ['lancet', 'tongs', 'leech', 'thread', 'salve', 'tincture', 'brand', 'lens'] as const;

// ====================================================================== stories

export const STORY_3_1: StoryDef = {
  id: 's3-1',
  place: 'Kessendorf — the Hospice of Saint Ildra, the morning after the muster returns',
  backdrop: 'hospice',
  lines: [
    n('CHAPTER III — PRIME AND TERCE'),
    n('Prime: the first work of the day. In the old offices, it is when the roll of the dead is read aloud.'),
    n('The Watch comes home down the Timber Road to a city that smells of the Kilnrows: saltpetre, coal, and fear.'),
    say('stroh', 'Doctor. I said we would speak after Prime. It is after Prime.'),
    // The cantor's fate follows s2-4 (`cantorMercy`, NAR-0116); the candles follow how often the star was drawn.
    ...onlyIf({ flag: 'cantorMercy' }, say('stroh', 'Your cantor, by the way. Three days asleep on your poppy, then dead of it, having told us a hymn. I keep a ledger of mercies.')),
    ...onlyIf({ flag: 'cantorMercy', is: false }, say('stroh', 'Your cantor talked, by the way. Four nights of it, awake the whole while, as you promised. I keep a ledger of such things.')),
    ...onlyIf((f) => Number(f.get('litanySeenCount') ?? 0) >= 2, say('stroh', 'And twice now I have stood in a room with you while every candle in it forgot to flicker. That is in the ledger too.')),
    // What the city has seen of the star so far (NAR-0093).
    ...whisperThought(0),
    say('kreuzer', 'I have patients, Inquisitor.'),
    say('stroh', 'You have one more. The council has renewed the Inspection Decree. Every child with a mark is to be examined.'),
    n('A woman in a founder’s apron pushes a small girl forward. Two nubs of horn rise through the child’s fair hair.'),
    say('patient', 'She’s called Liesl. She’s seven. She was born like any child, Doctor, I swear it on my husband’s grave.', 'Liesl’s mother'),
    say('stroh', 'Born with them, she is hornfolk: natural, and she may go home. Turned late, she is the Choir’s. Examine her.'),
    say('ilse', 'Doctor… look beneath the buds. There is something drawn there. The same shapes as on the page-boy.'),
  ],
};

export const STORY_3_2: StoryDef = {
  id: 's3-2',
  place: 'The hospice — the examining room',
  backdrop: 'hospice',
  lines: [
    say('stroh', 'Well? You have examined her. Put it in writing. Born, or turned.'),
    // CON-0233: what the examination found — or what the Doctor let himself see.
    ...onlyIf(
      { not: { flag: 'hornchildFinding', is: 'natural' } },
      n('The buds are new. Anyone with a surgeon’s eye could see it: the bone around them is barely a year old.'),
    ),
    ...onlyIf(
      { flag: 'hornchildFinding', is: 'natural' },
      n('The mother’s word and the marks say born. Something in the bone says otherwise; the Doctor did not look closely enough to be sure.'),
    ),
    // The certificate (NAR-0119): a kind lie or a true sentence. Writes `hornchildCertificate` for Chapters IV–V.
    choose('narrator', 'Liesl’s mother has not breathed since the question. The certificate waits for a signature.', [
      { id: 'natural', text: 'She was born with them. A natural growth. I will cut them back so they don’t press on the skull.', set: { hornchildCertificate: 'natural' } },
      { id: 'turned', text: 'The bone is new, Inquisitor. Turned late — within the year. Write what I say, and let the Tribunal answer for it.', set: { hornchildCertificate: 'turned' } },
    ]),
    ...onlyIf(
      { flag: 'hornchildCertificate', is: 'natural' },
      say('stroh', 'A natural growth. With a sigil under each.'),
      say('kreuzer', 'Hornfolk children are often marked. Midwives’ charms. It means nothing.'),
      say('ilse', '…I will witness it, Inquisitor. Sister Ilse, of the Merciful Order. A natural growth.'),
      say('stroh', 'Two signatures. Very well. Paper is patient, Doctor. It keeps.'),
    ),
    ...onlyIf(
      { flag: 'hornchildCertificate', is: 'turned' },
      say('stroh', 'Turned. Then she is the Choir’s, and the Choir’s things go to the Tribunal. Sister — the mother will want holding.'),
      say('ilse', '…Doctor. She is seven.'),
      say('kreuzer', 'And the truth is the truth at any age, Sister. I cut first. The Tribunal may have what I leave.'),
    ),
    n('He folds the certificate into his coat. Somewhere beneath the hospice roof, a bird that should not be awake begins to sing.'),
    say('haller', 'Trepan the buds, lift the bone, cut them out clean and sear what’s under. She is seven. Be quick.'),
  ],
};

export const STORY_3_3: StoryDef = {
  id: 's3-3',
  place: 'The Kilnrows — the foundry quarter, noon',
  backdrop: 'street',
  lines: [
    n('At noon the powder-mill on Saltpetre Lane goes up. The windows of the hospice bow inward and then, politely, stay whole.'),
    say('mauer', 'Doctor! Three dead in the mill yard, a dozen more coming. The guild’s own guard took a ball when the magazine cooked off.'),
    say('ilse', 'We can’t take them all at once. Sort them — the ones who’ll die without us, first. The walking wounded can wait on the steps.'),
    // NAR-0114: Anno (op1-3) comes back to carry stretchers; how his face healed follows his operation.
    ...byBand('op1-3', {
      high: say('patient', 'Anno, Doctor — the gunsmith’s boy. My face healed so clean the master thinks I’ve been shirking. I’ll carry. I know powder.', 'Anno'),
      mid: say('patient', 'Anno, Doctor. The eyebrows grew back crooked. I’ve come to carry stretchers — I know what powder does.', 'Anno'),
      low: say('patient', 'Anno, Doctor. Still picking black grains out of my cheek. I know what powder does. Let me carry.', 'Anno'),
    }),
    say('ilse', 'This one — Kaspar, the mill guard. A ball through the thigh, and it carried his doublet in with it.'),
    say('haller', 'Wadding. Cloth in a wound festers. Find every scrap with the lens, Kreuzer, or he will be burning by Vespers.'),
  ],
};

export const STORY_3_4: StoryDef = {
  id: 's3-4',
  place: 'The hospice — evening',
  backdrop: 'hospice',
  lines: [
    n('The last of the mill-hands are stitched and sent home. The bells have rung for Vespers, and nobody went.'),
    // CON-0228: the Kilnrows field (tr3-kilnrows).
    ...onlyIf(atLeast('kilnrowsSaved', 7), n('Ilse closes the day-book on the blast. Every stretcher in the yard that could be saved, was.')),
    ...onlyIf({ not: atLeast('kilnrowsSaved', 7) }, n('Ilse closes the day-book on the blast. Some of the names from the yard have a line drawn through them.')),
    say('patient', 'Ute Brandt, bell-founder. The belly-gripes, Doctor. Forty years of pouring lead has made my blood heavy.', 'Ute Brandt'),
    say('ilse', 'Founder’s colic. The lead settles in the flesh like grey silt — you won’t see it without the lens.'),
    say('haller', 'A chelating draught lifts it. Tincture on each deposit, then draw off the grey bile it leaves.'),
    n('A clerk in guild livery hands Ilse a folded bill. She reads it twice.'),
    say('ilse', 'The Founders’ Guild is invoicing us. For the lead we remove from their members. It is guild property.'),
    say('haller', 'Tell them they may collect it from the privy.'),
  ],
};

export const STORY_3_5: StoryDef = {
  id: 's3-5',
  place: 'The Iron Bridge — morning',
  backdrop: 'street',
  lines: [
    n('Overnight the council raises the bridges. The Kilnrows are quarantined: the fever that came with the smoke has a name now.'),
    say('mauer', 'Plague on the Saltpetre side. Nobody crosses. Council’s orders, and my lads have to enforce them on their own cousins.'),
    n('Vapour-wardens in beaked masks hang sides of beef from poles to draw the bad air. The beef is stolen by noon.'),
    n('A brotherhood of flagellants marches past the hospice, scourging each other bloody for the sins that brought the fever.'),
    say('ilse', 'A carter tried to cross as the chains went up. The bridge came down on his leg. There is not enough of it left to save.'),
    say('haller', 'Then take it off. Saw below the knee, then the vessels: thread if he can bear the time, the brand if he can’t.'),
    say('kreuzer', 'Berthold. Look at me, not at the saw. You’ll drive a cart again, with a peg and a cushion.'),
  ],
};

export const STORY_3_6: StoryDef = {
  id: 's3-6',
  place: 'The quarantine side — the Penny Stair',
  backdrop: 'street',
  lines: [
    n('Inside the quarantine, the hospice keeps a second ward in a requisitioned pie-shop. The pie-shop is not happy about it.'),
    say('patient', 'It’s not the pies! Everyone who ate my pies is perfectly well! Apart from the ones who aren’t!', 'Gottfried, pie-man'),
    say('ilse', 'Frieda, laundress. Gut-worms — dozens. The pies were eel, he says. They were not eel.'),
    say('haller', 'Draw the worms out whole with the tongs, slow as a sermon. Tear one and the head stays in to grow again.'),
    n('A letter arrives with the Merciful Order’s seal. Ilse reads it in the doorway, where Kreuzer can see her face.'),
    say('ilse', 'Mother Superior orders me back to the convent. The Order does not keep sisters in a ward the Tribunal is watching.'),
    say('kreuzer', 'Then go. No one would blame you.'),
    say('ilse', 'I would. Hand me the tongs, Doctor.'),
  ],
};

export const STORY_3_6B: StoryDef = {
  id: 's3-6b',
  place: 'The quarantine ward — the Penny Stair, night',
  backdrop: 'night',
  lines: [
    n('The plague ward fills. Mother Agathe of the Grey Beguines, elf-born and older than the ward, is carried in with six buboes.'),
    say('patient', 'Clean lancet, boy. And don’t let the pus touch your cuts, or you’ll be on this table after me.', 'Mother Agathe'),
    n('Past midnight, a brotherhood of flagellants marches by the Penny Stair, scourging each other bloody for the city’s sins.'),
    say('mauer', 'One of them fell in the gutter. Brother Ansgar. His back is a field of nails, and he won’t lie still.'),
    say('patient', 'Leave them in. The pain is owed. Every nail is a name I failed.', 'Brother Ansgar'),
    say('ilse', 'Calm him with the tincture before each nail, Doctor, or he will thrash himself open again.'),
    say('kreuzer', 'Brother, your debts are with God. Your back is with me.'),
  ],
};

export const STORY_3_7: StoryDef = {
  id: 's3-7',
  place: 'The Hall of Records — dawn, the hour of Prime',
  backdrop: 'chapel',
  lines: [
    n('Every dawn of the quarantine, Registrar Oswin Tallert reads the roll of the plague dead from the steps of the Hall of Records.'),
    n('This dawn he reads on after the roll is finished. Names nobody knows. Names nobody has lost yet.'),
    say('patient', '…Aldo Brenck. Grete Hollweg. Martin Sauerbrey. I can’t stop, Doctor. They write themselves on me as I read them.', 'Registrar Tallert'),
    say('ilse', 'Doctor, look at his arms — the ink is moving. Letters, stroke by stroke, writing names into his skin.'),
    say('haller', 'Prime. The roll of the dead. Scrape each name out before it is finished — newest ink first, Kreuzer.'),
    say('stroh', 'I am staying. If this is the Choir, I will see it with my own eyes. And I will see what you do.'),
  ],
};

export const STORY_3_8: StoryDef = {
  id: 's3-8',
  place: 'The hospice — the third night of the quarantine',
  backdrop: 'night',
  lines: [
    n('Near midnight there is a knock. Inquisitor Stroh stands in the rain with his jaw swollen like a plum.'),
    say('stroh', 'A tooth. The Tribunal’s barber is in the quarantine and the council’s is drunk. You are what remains.'),
    say('ilse', 'An abscess over the molar. We’ll drain it, then rock the tooth loose with the tongs. Pull too soon and the root snaps.'),
    say('stroh', 'Doctor. While you have me in the chair. The registrar’s names stopped writing when you touched him. Why?'),
    say('kreuzer', 'Open wider, Inquisitor.'),
    say('stroh', 'And the certificate for the founder’s child. “A natural growth.” The bone around those buds was a year old at most.'),
    say('haller', 'Mind the blade near his teeth. A man in pain bites — even a man of the Tribunal.'),
  ],
};

export const STORY_3_9: StoryDef = {
  id: 's3-9',
  place: 'The Guildhall of the Barber-Surgeons — the licence vote',
  backdrop: 'theatre',
  lines: [
    n('The Guild meets to vote on Kreuzer’s licence. The Tribunal has asked whether a man with such lucky hands is a surgeon at all.'),
    say('patient', 'The motion: that Doctor Kreuzer’s Weissburg letters be struck from the rolls of Kessendorf, pending inquiry.', 'Guildmaster Voss'),
    say('haller', 'I have struck one man from these rolls in my life. I was right to, and I have regretted it for twenty years.'),
    say('haller', 'I will not do it twice. Kreuzer — tell them why you left Weissburg. Tell them what the Guild there taught you.'),
    say('kreuzer', 'A carter’s boy with a crushed hand. Guild rule: no surgery without a guild fee paid first. His father had no fee.'),
    say('kreuzer', 'I waited, as I was sworn to. He died of the waiting. I tore up my oath, and then my letters. The rules killed him, not the hand.'),
    say('haller', 'And before you vote, count his patients. Every one who went on the table this year. Count how many walked off it.'),
    n('The clerks count. Ledgers are opened, the hospice books are sent for, and the hall waits while the tally is chalked up.'),
    ...onlyIf(
      (f) => licenceKept(f),
      say('patient', 'For striking: seven. Against: twenty-two. The licence stands. The Guild notes the Doctor’s results with— reluctance.', 'Guildmaster Voss'),
      say('haller', 'Reluctance. From Voss that is practically a garland.'),
    ),
    ...onlyIf(
      (f) => !licenceKept(f),
      say('patient', 'For striking: sixteen. Against: thirteen. The licence is suspended until the Tribunal has ruled on the Doctor’s hands.', 'Guildmaster Voss'),
      say('kreuzer', 'Suspended. So I am to go on cutting, and simply stop being paid for it. Weissburg all over again.'),
    ),
    n('The hall is quiet. Somewhere below it, in the old cellars, something is humming the third hour.'),
    say('patient', 'The minutes will record— what is that smell? Is the hall on fire?', 'Guildmaster Voss'),
  ],
};

export const STORY_3_10: StoryDef = {
  id: 's3-10',
  place: 'The Guildhall — burning',
  backdrop: 'theatre',
  lines: [
    n('Violet fire runs along the benches and up the old oak panels. The guild portraits curl and scream in their frames.'),
    say('ilse', 'Master Haller! Doctor — he stood to speak and the fire went into him. It’s inside him — tongues of it, leaping!'),
    say('haller', 'Terce… the third hour. Kreuzer, listen. Hexfire drinks heat. Don’t you dare put a brand on me.'),
    say('haller', 'Salve the flame-front, then cut the root out. When it splits, douse the tongues one on the heels of the next.'),
    say('kreuzer', 'Save your breath, Master. You’ll want it for shouting at me afterwards.'),
  ],
};

export const STORY_3_END: StoryDef = {
  id: 's3-end',
  place: 'The hospice — the morning after Terce',
  backdrop: 'hospice',
  lines: [
    n('The Guildhall is ash. The vote is never counted. Master Haller lies in the hospice with both hands wrapped to the wrist.'),
    say('haller', 'Kreuzer. Sit. I have kept something from you, and the fire has made me honest, which is inconvenient.'),
    say('haller', 'Twenty years ago I had a pupil. The best pair of hands I ever trained. Aurel Vennholt.'),
    say('haller', 'He would not stop at the Guild’s limits. Opium for the dying, far past the measure. Then worse — a way to still pain entirely.'),
    say('haller', 'He found it in the old offices. A hymn that holds the body still. I struck him from the rolls. He called it mercy.'),
    say('kreuzer', 'A hymn that holds the body still. Master… that is the Litany.'),
    say('haller', 'I know what it is. I taught it to you. I learned it from him, the week before I struck him off.'),
    say('haller', 'He calls himself the Precentor now. He leads the Choir. Every Hour he sings is a lesson I gave him, turned inside out.'),
    say('ilse', 'Then the Office is his. Matins, Lauds, Prime, Terce… four hours sung. Four to come.'),
    say('stroh', 'Vennholt. A name at last. You might have spoken it before the Guildhall burned, Master Haller.'),
    say('mauer', 'Orders from the council, Doctor. The hired companies march east to the Vennmark tomorrow. The surgeon marches with them.'),
    say('haller', 'Go. My hands are done for a while. Write to me. I will answer — badly, and with a great deal of advice.'),
    n('END OF CHAPTER III — PRIME AND TERCE'),
    // NAR-0097: Ilse's side scene, for a Chapter III averaging A or better.
    ...onlyIf(
      (f) => chapterAverageA(3, f),
      n('Later, in the laundry yard, Ilse is boiling bandages that do not need boiling.'),
      say('ilse', 'Stroh asked me this morning whether you drew a star over Master Haller. I said I was holding the lamp and saw nothing.'),
      say('kreuzer', 'You lied to an Inquisitor.'),
      say('ilse', 'I held the lamp very carefully. It is not a lie if you are looking at the lamp.'),
      say('ilse', 'The Mother Superior taught us that God is in the work of the hands. I have watched your hands for a year.'),
      say('ilse', 'I have not seen God in them. I have seen a man who is very tired and will not stop. I am not sure which is holier.'),
      say('kreuzer', 'Neither. The bandages are clean, Sister. They have been clean for an hour.'),
      say('ilse', 'I know. It is the only thing in this city I can make clean by boiling it.'),
      say('ilse', 'Go and sleep, Doctor. I will tell Stroh you are praying. It will worry him.'),
    ),
  ],
};

// ====================================================================== operations

export const OP_3_1: OperationDef = {
  id: 'op3-1',
  title: 'The Hornchild',
  patient: 'Liesl, a founder’s daughter, aged seven',
  diagnosis: 'Two horn-buds pressing through the scalp. A Choir sigil beneath each. Certified “a natural growth”.',
  organ: 'flesh',
  timeLimit: 300,
  tools: ALL,
  ranks: { S: 5240, A: 4190, B: 3140 },
  litany: true,
  seed: 31,
  phases: [
    {
      callout: ['The first bud. Hold the lancet on the bone until the disc is cut — no longer than you must.', 'Then lift the disc with the tongs, and cut out the bud.'],
      spawn: () => [new HornBud(at(-110, -40))],
    },
    {
      // CON-0103: a certificate of "natural growth" means the second bud stays; it is dressed, not cut.
      get callout() {
        return flags.get('hornchildCertificate') === 'natural'
          ? ['The certificate says natural, so the second bud stays. Salve the scalp around it — gently. No lancet.']
          : ['The second bud. Same again — steady hands.'];
      },
      spawn: () => [flags.get('hornchildCertificate') === 'natural' ? new DressedBud(at(120, -30)) : new HornBud(at(120, -30))],
    },
    {
      callout: ['Salve what we’ve opened. She has a long life to wear this scalp.'],
      spawn: () => [new Laceration(at(0, 60), 0.2, 40, 0.4)],
    },
  ],
};

export const OP_3_2: OperationDef = {
  id: 'op3-2',
  title: 'Ball and Wadding',
  patient: 'Kaspar, powder-mill guard',
  diagnosis: 'Lead ball through the thigh, carrying doublet cloth into the wound. Heavy bleeding from the powder-mill blast.',
  organ: 'flesh',
  timeLimit: 330,
  baseDrain: 0.12,
  tools: ALL,
  ranks: { S: 6200, A: 4960, B: 3720 },
  litany: true,
  seed: 32,
  phases: [
    {
      callout: ['Open along the wound track, Doctor.'],
      spawn: () => [new Incision([at(-170, 10), at(-50, -10), at(80, 0), at(180, 20)])],
    },
    {
      callout: ['The ball — tongs. And the cloth it carried: sweep the lens slowly. Every scrap, or he festers.'],
      spawn: () => [new Embedded(at(10, 0), 'shot', 0, false), new BloodPool(at(-40, 40), 30), new ClothFragment(at(-80, 30)), new ClothFragment(at(70, -40)), new ClothFragment(at(130, 50))],
    },
    {
      callout: ['Splinters from the blast. Out with them, then close the gaps.'],
      spawn: () => [new Embedded(at(-150, -60), 'shard', 0.6, false), new Embedded(at(160, -70), 'shard', 2.2, false)],
    },
    closeIncision(),
    woundFeverPhase(),
  ],
};

export const OP_3_4: OperationDef = {
  id: 'op3-4',
  title: 'Kilnrows Blast',
  patient: 'Three powder-mill hands — Jannik, Old Rudi, and Wenzel',
  diagnosis: 'Mass casualties from the mill explosion. Three patients on one table in turn: burns, shrapnel and a torn artery.',
  organ: 'flesh',
  timeLimit: 420,
  baseDrain: 0.1,
  tools: ALL,
  ranks: { S: 7670, A: 6140, B: 4600 },
  litany: true,
  seed: 34,
  phases: [
    {
      callout: ['Jannik first — powder burns across the chest. Eschar off, then salve. Quickly; two more behind him.'],
      spawn: (op: Operation) => [new Burn(at(-120, -20), 42, op, 'fire'), new Burn(at(110, 30), 36, op, 'fire')],
    },
    {
      callout: ['Old Rudi. Mill-iron in his side — and a vessel beside it. Clamp that before you pull anything.'],
      spawn: () => {
        const shard = new Embedded(at(20, 10), 'shard', 0.9, false);
        return [shard, new Artery(at(-40, 20), 1.2, shard), new Embedded(at(-160, -50), 'shard', 2.4, false)];
      },
    },
    {
      callout: ['Wenzel — the youngest. Glass, a gash, and he took smoke. Tend all of it.'],
      spawn: () => [new Embedded(at(-80, -40), 'glass', 0.3, false), new Embedded(at(90, -60), 'glass', 1.9, false), new Laceration(at(30, 70), 0.4, 80, 1), new TinctureSite(at(160, 20), 'Smoke cleared', 0.9, 0.3, '#909090')],
    },
  ],
};

export const OP_3_3: OperationDef = {
  id: 'op3-3',
  title: 'Founder’s Colic',
  patient: 'Ute Brandt, bell-founder',
  diagnosis: 'Lead poisoning after forty years at the bell-pits. Grey deposits in the flesh, visible only to the Scrying Lens.',
  organ: 'gut',
  timeLimit: 300,
  baseDrain: 0.15,
  tools: ALL,
  tinctures: ['green'],
  ranks: { S: 5350, A: 4280, B: 3210 },
  litany: true,
  // CON-0234: a wrong verdict at the inquiry sends her in untreated for the lead — weaker.
  get vitals() {
    return flags.get('foundersVerdict') === 'curse' ? 75 : undefined;
  },
  seed: 33,
  phases: [
    {
      callout: ['The lead hides. Lens first — slowly — then hold the tincture on each deposit to lift it.'],
      spawn: () => [leadDeposit(at(-150, -30)), leadDeposit(at(-20, 60)), leadDeposit(at(130, -50)), leadDeposit(at(170, 60))],
    },
    {
      callout: ['Draw off the grey bile before it settles again.'],
      spawn: () => [new BloodPool(at(40, -80), 26, 'blackbile')],
    },
    {
      callout: ['She has a founder’s ulcer as well. Salve it.'],
      spawn: () => [new Rot(at(-60, 20), 38, 0.4)],
    },
  ],
};

export const OP_3_5: OperationDef = {
  id: 'op3-5',
  title: 'The Crow’s Beak',
  patient: 'Berthold, carter',
  diagnosis: 'Leg crushed beneath the Iron Bridge as it was raised. The shin is past saving: amputation below the knee.',
  organ: 'bone',
  drape: 'linen',
  timeLimit: 300,
  baseDrain: 0.2,
  vitals: 85,
  tools: ALL,
  ranks: { S: 5070, A: 4060, B: 3040 },
  litany: true,
  seed: 35,
  phases: [
    // The first amputation teaches the saw (GAM-0212): he cannot slip away during it.
    teach({
      callout: ['Give him the tincture first — he will need it.', 'Then saw along the line with the lancet, stroke by stroke. Take your time with this one; I have him.'],
      spawn: () => [new TinctureSite(at(-200, 60), 'Poppy draught', 0.8, 0.2, '#c0a0d0'), new Amputation(at(-40, -110), at(-40, 110), 3, 6)],
    }),
    {
      callout: ['Bone splinters in the stump. Out with them.'],
      spawn: () => [new Embedded(at(10, -40), 'shard', 0.2, false), new Embedded(at(20, 50), 'shard', -0.4, false)],
    },
    {
      callout: ['Close the flap over the stump.'],
      spawn: () => [new Laceration(at(-20, 0), Math.PI / 2, 120, 0.6)],
    },
  ],
};

export const OP_3_6: OperationDef = {
  id: 'op3-6',
  title: 'The Pieman’s Revenge',
  patient: 'Frieda, laundress',
  diagnosis: 'Gut-worms from a bad penny-pie. Flux, cramps and fever; the heads are showing at the old surgical scar.',
  organ: 'gut',
  timeLimit: 300,
  baseDrain: 0.1,
  tools: ALL,
  ranks: { S: 5220, A: 4180, B: 3130 },
  litany: true,
  seed: 36,
  phases: [
    {
      callout: ['The flux first — draw it off.'],
      spawn: () => [new BloodPool(at(-100, 40), 34, 'pus'), new BloodPool(at(90, 60), 30, 'pus')],
    },
    {
      callout: ['Worm heads. Tongs on each head and draw it out slowly — slowly! — or it tears.'],
      spawn: () => [new Worm(at(-130, -20), Math.PI + 0.4), new Worm(at(20, 30), -Math.PI / 2), new Worm(at(150, -40), -0.3)],
    },
    {
      callout: ['An anthelmintic draught, now, for the eggs we can’t see.'],
      spawn: () => [new TinctureSite(at(0, 0), 'Worm-draught', 1.2, 0.3, '#c0b070')],
    },
  ],
};

export const OP_3_7: OperationDef = {
  id: 'op3-7',
  title: 'Lance the Buboes',
  patient: 'Mother Agathe, elf of the Grey Beguines',
  race: 'elf',
  diagnosis: 'Plague of the quarantine: six buboes, spreading rot. Candle-light only in the requisitioned ward.',
  organ: 'flesh',
  timeLimit: 330,
  baseDrain: 0.2,
  tools: ALL,
  ranks: { S: 6590, A: 5270, B: 3950 },
  litany: true,
  seed: 37,
  phases: [
    {
      callout: ['Six buboes. Lance each with one clean touch, before they ripen.', 'Draw off the pus before you salve — it mustn’t touch the cuts.'],
      spawn: () => [new Bubo(at(-190, -40), 18), new Bubo(at(-90, 70), 20), new Bubo(at(10, -80), 16), new Bubo(at(90, 50), 22), new Bubo(at(180, -50), 18), new Bubo(at(200, 70), 16)],
    },
    {
      callout: ['The plague-rot spreads faster than any I’ve seen. Salve it before it takes the skin.'],
      spawn: () => [new Rot(at(-110, -20), 44, 1.0), new Rot(at(120, 0), 40, 1.0)],
    },
  ],
};

export const OP_3_8: OperationDef = {
  id: 'op3-8',
  title: 'The Flagellant’s Back',
  patient: 'Brother Ansgar, penitent',
  diagnosis: 'Scourge wounds studded with nails, festering. The patient is agitated and will thrash unless calmed.',
  organ: 'flesh',
  timeLimit: 330,
  baseDrain: 0.1,
  tools: ALL,
  ranks: { S: 5950, A: 4760, B: 3570 },
  litany: true,
  seed: 38,
  phases: [
    {
      callout: ['Calm him first — the tincture, at his brow. Then the nails, one by one.'],
      spawn: () => [
        new Agitation(at(0, -190)),
        new Embedded(at(-150, -40), 'shard', 0.5, false),
        new Embedded(at(-60, 30), 'shard', 2.0, false),
        new Embedded(at(40, -50), 'shard', 1.2, false),
        new Embedded(at(140, 20), 'shard', -0.6, false),
      ],
    },
    {
      callout: ['The welts are festering. Salve the rot, and stitch the worst of them.'],
      spawn: () => [new Rot(at(-100, 60), 36, 0.5), new Laceration(at(80, 70), 0.3, 70, 0.7), new Laceration(at(-30, -90), 2.6, 60, 0.6)],
    },
  ],
};


export const OP_3_9: OperationDef = {
  id: 'op3-9',
  title: 'The Most Hated Avocation',
  patient: 'Inquisitor Stroh, Ash Tribunal',
  diagnosis: 'Dental abscess over a rotten lower molar. The patient asks a great many questions for a man with his mouth open.',
  organ: 'flesh',
  timeLimit: 240,
  tools: ['lancet', 'tongs', 'leech', 'thread', 'salve', 'tincture'],
  ranks: { S: 4540, A: 3630, B: 2720 },
  litany: true,
  seed: 39,
  phases: [
    {
      callout: ['Lance the abscess, and draw off the pus. Don’t leave the blade idling in his mouth.'],
      spawn: () => [new Jaw(at(0, 0)), new Bubo(at(-60, 20), 20, 40)],
    },
    {
      // CON-0128: the Inquisitor interrogates between phases, whatever the state of his mouth.
      interject: [
        { who: 'stroh', text: 'Mmh. Why did the names stop, Doctor? The Registrar’s skin. They stopped mid-word.' },
        { who: 'kreuzer', text: 'Because I stopped them. Open wider, Inquisitor.' },
        { who: 'stroh', text: 'That is not an answer. That is a dentist’s instruction.' },
      ],
      callout: ['Tongs on the molar. Rock it, three times, then draw it.'],
      spawn: () => [new Molar(at(40, -10))],
    },
    {
      interject: () => [
        { who: 'stroh', text: 'And the founder’s child. Liesl. What did you write on her certificate?' },
        ...(flags.get('hornchildCertificate') === 'natural'
          ? [
              { who: 'kreuzer', text: 'What the bone told me.' },
              { who: 'stroh', text: 'Bone is very rarely that polite, Doctor. I shall read it again.' },
            ]
          : [
              { who: 'kreuzer', text: 'That she was turned. You read it. You signed under it.' },
              { who: 'stroh', text: 'I did. I wanted to know whether you would flinch. You did not. Noted.' },
            ]),
      ],
      callout: ['Salve the socket, Doctor. And perhaps the Inquisitor’s temper.'],
      spawn: () => [new Laceration(at(40, 10), 0.2, 34, 0.4)],
    },
  ],
};


export const CHAPTER_3: Chapter = {
  id: 'ch3',
  numeral: 'III',
  title: 'Prime and Terce',
  // NAR-0116: reads the demo's choice and Litany count; writes the certificate, Stroh's tooth (op3-9) and Haller's fate (op3-11).
  flags: {
    reads: ['kilnrowsSaved', 'cantorMercy', 'litanySeenCount', 'hornchildCertificate', 'guildMarks', 'guildOps', 'hornchildFinding', 'foundersVerdict'],
    writes: ['kilnrowsSaved', 'hornchildCertificate', 'strohTooth', 'strohToothFine', 'hallerFate', 'hornchildFinding', 'foundersVerdict', 'predecessorFinding'],
  },
  steps: [
    { kind: 'story', story: STORY_3_1 },
    // CON-0233: the examination Stroh waits on — born, or turned?
    { kind: 'discipline', discipline: { id: 'iv3-liesl', title: INTERVIEW_LIESL.title, place: INTERVIEW_LIESL.place, backdrop: 'hospice', mode: 'interview', interview: INTERVIEW_LIESL } },
    { kind: 'story', story: STORY_3_2 },
    { kind: 'op', op: OP_3_1 },
    { kind: 'story', story: STORY_3_3 },
    { kind: 'op', op: OP_3_2 },
    { kind: 'discipline', discipline: { id: TRIAGE_KILNROWS.id, title: TRIAGE_KILNROWS.title, place: TRIAGE_KILNROWS.place, backdrop: 'street', mode: 'triage', triage: TRIAGE_KILNROWS, savedFlag: 'kilnrowsSaved' } },
    { kind: 'op', op: OP_3_4 },
    { kind: 'op', op: OP_3_12 },
    { kind: 'story', story: STORY_3_4 },
    // CON-0234: the Founders' Guild asks for an opinion in writing before Ute Brandt reaches the table.
    { kind: 'discipline', discipline: { id: 'iv3-founders', title: INTERVIEW_FOUNDERS.title, place: INTERVIEW_FOUNDERS.place, backdrop: 'guildhall', mode: 'interview', interview: INTERVIEW_FOUNDERS } },
    { kind: 'op', op: OP_3_3 },
    { kind: 'story', story: STORY_3_5 },
    { kind: 'op', op: OP_3_5 },
    { kind: 'op', op: OP_3_13 },
    { kind: 'story', story: STORY_3_6 },
    { kind: 'op', op: OP_3_6 },
    { kind: 'story', story: STORY_3_6B },
    { kind: 'op', op: OP_3_7 },
    // CON-0244: the old registrar in the record cellar, before Prime wakes in the new one.
    { kind: 'discipline', discipline: { id: 'fo3-predecessor', title: FORENSIC_PREDECESSOR.title, place: FORENSIC_PREDECESSOR.place, backdrop: 'chapel', mode: 'forensic', interview: FORENSIC_PREDECESSOR } },
    { kind: 'op', op: OP_3_8 },
    { kind: 'story', story: STORY_3_7 },
    { kind: 'op', op: OP_3_10 },
    { kind: 'story', story: STORY_3_8 },
    { kind: 'op', op: OP_3_9 },
    { kind: 'story', story: STORY_3_9 },
    { kind: 'story', story: STORY_3_10 },
    { kind: 'op', op: OP_3_11 },
    { kind: 'story', story: STORY_3_END },
  ],
};
