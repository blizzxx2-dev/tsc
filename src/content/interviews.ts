/**
 * The interviews (CON-0233, CON-0234, CON-0235): Liesl's examination, the Founders' Guild inquiry and
 * the cross-examination at the Doctor's trial. Data for src/surgery/interview.ts; the campaign places
 * them as `discipline` steps. The trial's evidence is whoever the campaign left able to speak.
 */
import type { FlagReader } from './flags';
import { strohTrust } from './endings';
import type { InterviewDef, InterviewEvidence } from '../surgery/interview';

/** Chapter III: the late-turned child. Born with the buds, or turned — and when? */
export const INTERVIEW_LIESL: InterviewDef = {
  id: 'iv3-liesl',
  title: 'The Late-Turned Child',
  subject: 'Liesl, a founder’s daughter, aged seven',
  place: 'The hospice — the examining room',
  intro: 'Liesl sits on the table swinging her feet. Her mother stands at her shoulder. Stroh waits by the door with a blank certificate.',
  question: 'Were the horn-buds born with her, or sung into her?',
  needed: 4,
  regions: [
    { id: 'left-bud', label: 'Left bud', at: [0.38, 0.12], finding: 'The left bud: bone the width of a thumbnail, pressing the scalp. The skin over it is thin and new.' },
    { id: 'right-bud', label: 'Right bud', at: [0.62, 0.12], finding: 'The right bud: the same, a little smaller. Growing, not grown.' },
    { id: 'bone-age', label: 'Bone at the root', at: [0.5, 0.2], finding: 'At the root the bone is soft and porous — a year old at most. A seven-year-old’s own bone is not.' },
    { id: 'sigil', label: 'Mark beneath', at: [0.44, 0.22], finding: 'Under the left bud, a sigil in the skin: fresh, the lines still pink. A Choir mark, not a midwife’s charm.' },
    { id: 'throat', label: 'Throat', at: [0.5, 0.42], finding: 'Her throat hums faintly under the fingers when she breathes out, like a held note.' },
  ],
  evidence: [{ id: 'stroh-note', label: 'Stroh’s note', text: 'Stroh’s note: the child sang at the cathedral at Candlemas.' }],
  topics: [
    { id: 'born', label: 'When did the buds appear?', speaker: 'Liesl’s mother', answer: 'She was born with them, Doctor. Always had them. Her father’s people are from the hills.' },
    { id: 'hurt', label: 'Do they hurt, Liesl?', speaker: 'Liesl', answer: 'Only when the choir sings. Then they itch, and I hum.' },
    { id: 'choir', label: 'The Candlemas choir?', speaker: 'Liesl’s mother', answer: 'She sang with the children’s choir last winter. So sweetly. A lady gave her a ribbon.', requires: ['stroh-note'], gives: 'ribbon' },
    { id: 'lady', label: 'Who was the lady?', speaker: 'Liesl', answer: 'She had black gloves. She sang to me after, very quietly, in my ear. It went round and round in my head.', requires: ['ribbon'] },
    { id: 'hill-folk', label: 'Your husband’s people?', speaker: 'Liesl’s mother', answer: 'From the hills, where the horned folk are. It runs in families. Everyone knows that.' },
  ],
  contradictions: [
    { topic: 'born', evidence: 'bone-age', text: 'The mother looks at the soft bone under your thumb, and then away. “…Last winter,” she says. “After the choir. I was afraid.”', gives: 'admission' },
    { topic: 'hill-folk', evidence: 'sigil', text: 'Hill children carry antler-tallies, not Choir marks. The mother has no answer. Stroh writes something down.' },
  ],
  conclusions: [
    { id: 'turned', label: 'Turned — sung into her last winter', correct: true, flags: { hornchildFinding: 'turned' }, text: 'The bone is a year old and the mark is the Choir’s. She was turned, late, by a lady in black gloves.' },
    { id: 'natural', label: 'Natural — born with them', flags: { hornchildFinding: 'natural' }, text: 'Hill blood, and a charm-mark. A natural growth, as the mother says.' },
    { id: 'injury', label: 'An injury healed badly', flags: { hornchildFinding: 'natural' }, text: 'A knock to the head, healed over into bone. Nothing to trouble the Tribunal.' },
  ],
};

/** Chapter III: the Founders' Guild inquiry. Lead from the furnaces, or a curse on the foundry? */
export const INTERVIEW_FOUNDERS: InterviewDef = {
  id: 'iv3-founders',
  title: 'The Founders’ Guild Inquiry',
  subject: 'Three bell-founders: Ute Brandt, Master Oskar Kessel, and the journeyman Veit',
  place: 'The Founders’ Guildhall — the pouring floor',
  intro: 'Three founders sick with the same gripes. The Guild says a curse; the Tribunal would like to agree. The Doctor is asked for an opinion, in writing.',
  question: 'Is it the lead, or a curse on the foundry?',
  needed: 4,
  regions: [
    { id: 'gums', label: 'Ute’s gums', at: [0.3, 0.18], finding: 'A blue-grey line along Ute Brandt’s gums, where tooth meets flesh. The founder’s line.' },
    { id: 'wrist', label: 'Kessel’s wrist', at: [0.52, 0.5], finding: 'Master Kessel’s right hand hangs at the wrist; he cannot lift it. Wrist-drop. Lead in the nerve.' },
    { id: 'belly', label: 'Veit’s belly', at: [0.74, 0.46], finding: 'The journeyman’s belly is hard and tender. Colic, not a wound. No mark, no burn, no sigil.' },
    { id: 'furnace', label: 'The furnace hood', at: [0.5, 0.82], finding: 'The furnace hood is cracked; the fumes from the new pour come straight back into the room.' },
  ],
  topics: [
    { id: 'when', label: 'When did the gripes begin?', speaker: 'Ute Brandt', answer: 'The week we poured the great bell for the cathedral. The Choir came to bless it. After that, all three of us.' },
    { id: 'blessing', label: 'The Choir blessed the bell?', speaker: 'Master Kessel', answer: 'They sang over the mould. A curse, I say. It sang into the bronze and out into us.', requires: ['when'] },
    { id: 'metal', label: 'What went into the bell-metal?', speaker: 'Veit', answer: 'Copper and tin, and old lead from the roofs to eke it out. The Guild bought the roofs cheap.' },
    { id: 'hood', label: 'The cracked hood?', speaker: 'Ute Brandt', answer: 'Cracked in the frost before the great pour. There was no time to mend it.', requires: ['furnace'] },
  ],
  contradictions: [
    { topic: 'blessing', evidence: 'gums', text: 'A curse leaves no blue line on the gums. Lead does. Master Kessel closes his mouth and says nothing more about singing.' },
    { topic: 'when', evidence: 'furnace', text: 'The week of the great pour was also the first pour under a cracked hood, with roof-lead in the metal. The Choir sang; the lead did the work.' },
  ],
  conclusions: [
    { id: 'lead', label: 'Lead — the roof-lead in the pour, under a cracked hood', correct: true, flags: { foundersVerdict: 'lead' }, text: 'Lead, from the cheap roofs and the cracked hood. The Guild will not like paying for it.' },
    { id: 'curse', label: 'A curse — the Choir’s blessing on the bell', flags: { foundersVerdict: 'curse' }, text: 'A curse on the foundry. The Tribunal is delighted. Ute Brandt is sent to the hospice with nobody treating the lead.' },
    { id: 'fever', label: 'A foundry fever from the damp', flags: { foundersVerdict: 'curse' }, text: 'A foundry fever. Rest and warm ale. The lead stays where it is.' },
  ],
};

/**
 * Chapter V: the cross-examination (CON-0235). Kreuzer answers the Tribunal's charges and presents
 * the witnesses the campaign has left him. Each rebuttal comes off the prosecution's case
 * (`trialRebuttals`, read by trialEvidence).
 */
export function trialInterview(f: Pick<FlagReader, 'get'>): InterviewDef {
  const ev: InterviewEvidence[] = [{ id: 'charter-roll', label: 'The council roll', text: 'The council roll: the Tribunal’s charter unsigned at the new year.' }];
  if (f.get('mauerFate') === 'hale' || f.get('mauerFate') === 'maimed') ev.push({ id: 'mauer', label: 'Captain Mauer’s word', text: 'Mauer: the candles stood still while the Doctor saved his standard-bearer.' });
  if (f.get('hallerFate') === 'hands' || f.get('hallerFate') === 'scarred' || f.get('hallerFate') === 'lost') ev.push({ id: 'haller', label: 'Master Haller’s letter', text: 'Haller: he taught the Doctor the Litany, and learned it from the Precentor.' });
  if (f.get('hornchildCertificate') === 'natural') ev.push({ id: 'mother', label: 'Liesl’s mother', text: 'Liesl’s mother: her daughter is home and asleep.' });
  if (strohTrust(f) >= 2) ev.push({ id: 'ledger', label: 'Stroh’s ledger', text: 'Stroh’s ledger: every candle that stood still stood over a living patient.' });
  ev.push({ id: 'orsa', label: 'Orsa Flintvein’s word', text: 'Orsa: he took a singing stone out of her and did not charge for the tunnel.' });
  return {
    id: 'iv5-trial',
    title: 'The Trial of Doctor Kreuzer',
    subject: 'Doctor Kreuzer, accused',
    place: 'The Tribunal Court — cross-examination',
    intro: 'The prosecutor reads the charges one by one. The fair-trial rule lets the accused answer each, and put his witnesses against it.',
    question: 'How does the Doctor close his defence?',
    needed: 2,
    evidence: ev,
    regions: [
      { id: 'certificate', label: 'The certificate', at: [0.3, 0.4], finding: 'The certificate, in the Doctor’s hand. The ink has faded; the signature has not.' },
      { id: 'ledger-page', label: 'The Tribunal ledger', at: [0.7, 0.4], finding: 'The Tribunal ledger: every candle dated, and beside each, a patient’s name. Not one is marked dead.' },
    ],
    topics: [
      { id: 'charge-witch', label: 'Charge: witchcraft at the table', speaker: 'The Prosecutor', answer: 'Candles stood still at his table. That is witchcraft, and the Doctor has never denied it.' },
      { id: 'charge-choir', label: 'Charge: the Choir’s hymn', speaker: 'The Prosecutor', answer: 'His stillness is the Choir’s own verse. Whoever taught it to him is one of them.' },
      { id: 'charge-certificate', label: 'Charge: a false certificate', speaker: 'The Prosecutor', answer: 'He certified a turned child natural, or a natural child turned. Either way, he lied to the Tribunal or ruined a family.' },
      { id: 'charge-authority', label: 'Charge: the Tribunal’s authority', speaker: 'The Prosecutor', answer: 'This court sits under the Tribunal’s charter, renewed this morning. Its authority is not in question.' },
    ],
    contradictions: [
      { topic: 'charge-witch', evidence: 'mauer', text: 'Mauer: “Witchcraft that saves a standard-bearer. Hang me beside him.” Two of the judges look at their hands.' },
      { topic: 'charge-witch', evidence: 'ledger', text: 'Stroh reads from his own ledger: every stilled candle, a living patient. The prosecutor asks for water.' },
      { topic: 'charge-choir', evidence: 'haller', text: 'Haller’s letter: the verse is older than the Choir, and he taught it. The Guild’s own master stands where the Doctor does.' },
      { topic: 'charge-certificate', evidence: 'mother', text: 'Liesl’s mother: “My daughter is home, and asleep. Hang me for thanking him.” Nobody moves to.' },
      { topic: 'charge-authority', evidence: 'charter-roll', text: 'The council roll: the charter lapsed at the new year, and every arrest since was made by a private man. Renewed this morning, by the Widow Reiss.' },
    ],
    conclusions: [
      { id: 'mercy', label: 'Close on mercy: “I kept them alive. Judge that.”', correct: true, text: 'The Doctor sits. He has said what he did, and why. The court withdraws to consider it.' },
      { id: 'law', label: 'Close on the law: “This court has no charter to try me.”', correct: true, text: 'The Doctor sits. The court is not pleased to be reminded of its charter. It withdraws.' },
      { id: 'silence', label: 'Close in silence', correct: true, text: 'The Doctor says nothing more. The silence is long enough that somebody coughs. The court withdraws.' },
    ],
  };
}
