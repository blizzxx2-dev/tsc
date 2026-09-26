/**
 * Forensic examinations (CON-0241…0245): a body on the slab, by candle-light, for the Tribunal.
 * Examine and tag what it carries, question who found it, and give cause and manner of death.
 * Played by the interview engine with a candle (src/surgery/interview.ts).
 */
import type { InterviewDef } from '../surgery/interview';

/** Chapter III: a body in the Hall of Records, a name half-written into its skin (CON-0244). */
export const FORENSIC_PREDECESSOR: InterviewDef = {
  id: 'fo3-predecessor',
  title: 'The Registrar’s Predecessor',
  subject: 'Old Registrar Mattheus Grell, found in the record cellar',
  place: 'The Hall of Records — the cellar, before dawn',
  intro: 'The old registrar, dead three days among the plague rolls. Stroh wants to know how. The candle will last as long as it lasts.',
  question: 'Cause and manner of death?',
  needed: 4,
  candle: 110,
  regions: [
    { id: 'sigil', label: 'Mark on the chest', at: [0.5, 0.36], finding: 'Across the chest, a name in fine black strokes, half-written: “MATTHEUS G—”. His own. The strokes stop mid-letter.' },
    { id: 'hands', label: 'Hands', at: [0.24, 0.55], finding: 'Ink under every nail, and the right hand clenched around nothing, as if it had held a quill.' },
    { id: 'face', label: 'Face', at: [0.5, 0.12], finding: 'The face is calm. Too calm for a man found face-down among fallen ledgers.' },
    { id: 'wrists', label: 'Wrists', at: [0.76, 0.55], finding: 'No marks of a struggle or a cord. Nobody held him.' },
    { id: 'rolls', label: 'The rolls beside him', at: [0.5, 0.86], finding: 'The plague roll he was copying: the last line is his own name, in his own hand, unfinished.' },
  ],
  topics: [
    { id: 'clerk', label: 'Who found him?', speaker: 'A records clerk', answer: 'I did, sir. He’d been copying the plague roll all week. He said the names kept coming back after he blotted them.' },
    { id: 'apoplexy', label: 'The physician’s certificate?', speaker: 'A records clerk', answer: 'Apoplexy, the physician wrote. Old men fall down. He didn’t come down to look.' },
    { id: 'successor', label: 'Who took his post?', speaker: 'A records clerk', answer: 'Master Tallert. He’s copying the same roll now. He says he sleeps well.', requires: ['clerk'] },
  ],
  contradictions: [
    { topic: 'apoplexy', evidence: 'sigil', text: 'Apoplexy does not write a man’s name on his chest. The physician’s certificate goes into Stroh’s ledger, face down.' },
    { topic: 'clerk', evidence: 'rolls', text: 'The names came back after he blotted them — and the last name that came was his own.' },
  ],
  conclusions: [
    { id: 'prime', label: 'Cause: a name written into him. Manner: a Choir killing — an Hour, rehearsed.', correct: true, flags: { predecessorFinding: 'prime' }, text: 'Something that writes names killed him by writing his. It will do the same to his successor. Stroh underlines “Tallert” twice.' },
    { id: 'apoplexy', label: 'Cause: apoplexy. Manner: natural.', flags: { predecessorFinding: 'natural' }, text: 'An old man, a stroke, a fall among ledgers. Stroh writes it down and does not look satisfied.' },
    { id: 'poison', label: 'Cause: ink poisoning. Manner: accident.', flags: { predecessorFinding: 'natural' }, text: 'Too long among the inks. Stroh sniffs the inkwell and says nothing.' },
  ],
};

/**
 * Chapter IV, branch B of the dead man's pulse (CON-0243): certified dead, examined for the Tribunal.
 * A careful examination finds the life in him — and overturns the Doctor's own verdict.
 */
export const FORENSIC_SALM: InterviewDef = {
  id: 'fo4-salm',
  title: 'The Dead Man’s Pulse',
  subject: 'Lord Eckbert von Salm, certified dead',
  place: 'The field hospital — the officers’ tent, by one candle',
  intro: 'The Doctor has signed him dead. The Tribunal requires the body examined before it is burned. Stroh holds the candle himself.',
  question: 'Undead, dead, or entranced?',
  needed: 4,
  candle: 100,
  regions: [
    { id: 'bite', label: 'Neck', at: [0.5, 0.2], finding: 'Two punctures on the neck, and fang fragments deep in them, still wet.' },
    { id: 'livor', label: 'Back and flanks', at: [0.3, 0.6], finding: 'Twelve hours on his back, and no lividity pooled beneath. The blood has not settled. It is still moving.' },
    { id: 'pupils', label: 'Eyes', at: [0.5, 0.1], finding: 'The pupils narrow — barely — as the candle comes close.' },
    { id: 'chest', label: 'Chest', at: [0.5, 0.36], finding: 'A long wait with a hand on the chest: one beat. A minute later, another.' },
    { id: 'teeth', label: 'Mouth', at: [0.58, 0.14], finding: 'His own teeth are ordinary. Whatever bit him had the fangs; he does not.' },
  ],
  topics: [
    { id: 'valet', label: 'His valet', speaker: 'The valet', answer: 'Cold as a ditch at dawn, sir. But I felt his heart go, once, when I lifted him. I swear it.' },
    { id: 'stroh', label: 'The Tribunal’s law', speaker: 'Inquisitor Stroh', answer: 'A corpse with a heartbeat is a revenant. The law says burn it before it rises. The law is quite clear.' },
    { id: 'chaplain', label: 'The chaplain', speaker: 'The chaplain', answer: 'I gave him the last rites. He did not seem to mind them, which the undead do.' },
  ],
  contradictions: [
    { topic: 'stroh', evidence: 'teeth', text: 'A revenant has the fangs. He does not; he was bitten. Stroh looks at the mouth for a long time.' },
    { topic: 'valet', evidence: 'livor', text: 'Cold as a ditch, and twelve hours on his back — yet his blood has not settled. Cold, then, but not dead.' },
    { topic: 'chaplain', evidence: 'pupils', text: 'The eyes answer the candle. Dead eyes do not. The chaplain crosses himself for a different reason.' },
  ],
  conclusions: [
    { id: 'entranced', label: 'Bite-trance. He is alive — restart the heart.', correct: true, flags: { deadManVerdict: 'entranced' }, text: 'The Doctor tears up his own certificate. “I was wrong, Inquisitor. Clear the tent.” Stroh does.' },
    { id: 'undead', label: 'Revenant. Burn him, as the law says.', flags: { deadManVerdict: 'dead' }, text: 'Undead, then. Stroh signs beneath the Doctor’s name. The pyre is built by dusk.' },
    { id: 'dead', label: 'Dead. The beat is the body settling.', flags: { deadManVerdict: 'dead' }, text: 'Dead, as certified. The pyre is built by dusk.' },
  ],
};

/** Chapter IV: a coachman found in the Vennmark ditch, and a carriage without a crest (CON-0245). */
export const FORENSIC_COACHMAN: InterviewDef = {
  id: 'fo4-coachman',
  title: 'The Widow’s Coachman',
  subject: 'A coachman, found in the ditch by the Vennmark road',
  place: 'The Vennmark camp — the burial tent',
  intro: 'A coachman in good boots, dead in a ditch four days from any town. Mauer wants him buried. Stroh wants him examined first.',
  question: 'Who was he driving for, and what killed him?',
  needed: 4,
  candle: 100,
  regions: [
    { id: 'gloves', label: 'Gloves', at: [0.26, 0.58], finding: 'Black kid gloves, a lady’s cast-offs cut down for a man. Under the left, a sigil in the skin of the palm.' },
    { id: 'coat', label: 'Coat', at: [0.5, 0.42], finding: 'A good livery coat with the crest cut away. The stitching where it was is fresh.' },
    { id: 'throat', label: 'Throat', at: [0.5, 0.22], finding: 'Extra folds in the throat, like the chorister boys’ — grown, then withered. He sang for someone once.' },
    { id: 'wound', label: 'Back', at: [0.74, 0.5], finding: 'A single knife-wound under the shoulder blade. Somebody he trusted stood behind him.' },
    { id: 'pocket', label: 'Pocket', at: [0.36, 0.72], finding: 'A candle-merchant’s bill, made out to the Hospice of Saint Ildra, paid by the charity seat of the council.' },
  ],
  topics: [
    { id: 'mauer', label: 'Where was he found?', speaker: 'Captain Mauer', answer: 'In the ditch by the east road. A carriage went by in the night, no crest, driving hard. Nobody stopped it.' },
    { id: 'stroh', label: 'Who drives without a crest?', speaker: 'Inquisitor Stroh', answer: 'Couriers. Smugglers. Ladies who do not wish to be seen visiting. I have seen that carriage outside your hospice, Doctor.' },
    { id: 'thief', label: 'A robbery?', speaker: 'Captain Mauer', answer: 'Robbed and dumped, I’d say. The road’s thick with deserters.', requires: ['mauer'] },
  ],
  contradictions: [
    { topic: 'thief', evidence: 'pocket', text: 'Robbers take purses and leave bills. This one took a crest and left the bill — made out to our hospice, paid by the charity seat.' },
    { topic: 'stroh', evidence: 'gloves', text: 'Black gloves, and a Choir sigil under the left. Stroh knows whose cast-offs they were.' },
  ],
  conclusions: [
    { id: 'choir', label: 'The Widow Reiss’s coachman, silenced by the Choir: a knife from behind.', correct: true, flags: { coachmanFinding: 'choir' }, text: 'Her coachman, who knew where the carriage went at night. Stroh folds the bill into his ledger.' },
    { id: 'robbery', label: 'A coachman robbed and killed by deserters.', flags: { coachmanFinding: 'robbery' }, text: 'Robbed on the road. Mauer buries him with his boots on, which is a courtesy.' },
    { id: 'brawl', label: 'A drunk, knifed in a brawl.', flags: { coachmanFinding: 'robbery' }, text: 'A tavern knife. Nobody asks which tavern, four days from one.' },
  ],
};
