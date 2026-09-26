/**
 * Endings (NAR-0157, NAR-0158) and Stroh's trust (NAR-0104).
 *
 * Stroh's trust is read from the choices that move it, never stored (docs/narrative/flags.md):
 *   cantorMercy false (the cantor kept awake for his questions) +1 · hornchildCertificate
 *   'turned' (the true sentence) +1, 'natural' (the kind lie) −2 · strohTooth (his molar out) +1,
 *   strohToothFine (out at S or better, NAR-0102) +1 more · every 2 operations won with the Litany −1.
 *
 * The ending matrix, for a finale won (op5-9):
 *   pardon — trust ≥ 2; or trust ≥ 1 with the Whisper short of Accused and no lie on the certificate.
 *   pyre   — no pardon, the Whisper short of Accused, and someone the city listens to stands up for
 *            him: Mauer hale (op4-7 at B or better) or Haller with his hands (op3-11 at S or better).
 *   exile  — everything else: the sentence stands, and he leaves the city with Ilse.
 * The Perfect End is the failure state: the finale lost, the Office completes, the city sleeps.
 */
import type { FlagReader } from './flags';
import { n, onlyIf, say, type StoryDef } from './story';
import { whisperBand, whisperScore, type WhisperBand } from './whisper';

/** Kreuzer's journal page for the Perfect End (NAR-0094; the won endings' pages are in journal.ts). */
export const PERFECT_JOURNAL: readonly string[] = [
  'Written in the silence, Hollow Night.',
  'Every candle in Kessendorf is out. Every breath is slow and even and wrong.',
  'Ilse is asleep on the ward floor with her hands folded, and she will not wake.',
  'Aurel calls it a perfect end. He is mistaken. I have seen a great many ends. Not one of them was perfect, and not one of them was the last.',
  'The Litany keeps me awake. So I will do what I have always done with it: hold on, and go again, from the first Hour.',
];

export type Ending = 'pardon' | 'pyre' | 'exile' | 'perfect';
export const ENDINGS: readonly Ending[] = ['pardon', 'pyre', 'exile', 'perfect'];

type Reader = Pick<FlagReader, 'get'>;

/** Stroh's trust in the Doctor (NAR-0104), from the choices that move it. */
export function strohTrust(f: Reader): number {
  let t = 0;
  if (f.get('cantorMercy') === false) t += 1;
  const cert = f.get('hornchildCertificate');
  if (cert === 'turned') t += 1;
  else if (cert === 'natural') t -= 2;
  if (f.get('strohTooth')) t += 1;
  if (f.get('strohToothFine')) t += 1;
  // The dead man's verdict (NAR-0136): siding with the Tribunal's reading of von Salm.
  if (f.get('deadManVerdict') === 'dead') t += 1;
  // At the trial (NAR-0147): owning the Litany under oath.
  if (f.get('trialAnswer') === 'confess') t += 1;
  t -= Math.floor(Number(f.get('litanySeenCount') ?? 0) / 2);
  return t;
}

/**
 * The prosecution's case at the trial (NAR-0147), net of the defence: every false certificate and
 * witnessed Litany entered as evidence, weighed against who is left to speak for the Doctor.
 */
export function trialEvidence(f: Reader): number {
  const seen = Number(f.get('litanySeenCount') ?? 0);
  const trust = strohTrust(f);
  let e = Math.min(seen, 3);
  const cert = f.get('hornchildCertificate');
  if (cert === 'natural') e += 2;
  // A true certificate cost a mother her child: she speaks for the prosecution.
  if (cert === 'turned') e += 1;
  // A denial the witnesses contradict is perjury; one nobody can contradict stands.
  if (f.get('trialAnswer') === 'deny') e += seen > 0 ? 1 : -1;
  if (trust <= 0) e += 2;
  if (trust >= 2) e -= 2;
  if (f.get('mauerFate') === 'hale') e -= 1;
  if (f.get('hallerFate') === 'hands') e -= 1;
  return e;
}

/** How the Doctor leaves the Tribunal court (NAR-0148). */
export type TrialVerdict = 'acquitted' | 'rescued' | 'tunnelled';

/**
 * Acquittal needs the Inquisitor standing for the defence and a thin case — and so always leads to the
 * pardon. A conviction is broken open by Mauer's Watch if the captain is hale, else by Orsa's tunnel.
 */
export function trialVerdict(f: Reader): TrialVerdict {
  if (strohTrust(f) >= 2 && trialEvidence(f) <= 1) return 'acquitted';
  return f.get('mauerFate') === 'hale' ? 'rescued' : 'tunnelled';
}

/** A line condition on the trial's outcome. */
export const verdictIs =
  (v: TrialVerdict) =>
  (f: FlagReader): boolean =>
    trialVerdict(f) === v;

/**
 * Who the Precentor sings Compline into (NAR-0155, CON-0199). An Inquisitor who prosecuted the Doctor
 * (trust ≤ 0) is up in the council chamber, not under the court with him; the Precentor takes the
 * Burgomaster instead. The pardon needs trust ≥ 1, so it always follows Stroh as the host.
 */
export type ComplineHost = 'stroh' | 'burgomaster';
export const complineHost = (f: Reader): ComplineHost => (strohTrust(f) <= 0 ? 'burgomaster' : 'stroh');
export const hostIs =
  (h: ComplineHost) =>
  (f: FlagReader): boolean =>
    complineHost(f) === h;

/** The inputs the ending reads, for the matrix test and the docs. */
export interface EndingInputs {
  trust: number;
  whisper: WhisperBand;
  certificate: 'natural' | 'turned' | undefined;
  mauerFate: 'hale' | 'maimed' | undefined;
  hallerFate: 'hands' | 'scarred' | 'lost' | undefined;
}

export function endingInputs(f: Reader): EndingInputs {
  return {
    trust: strohTrust(f),
    whisper: whisperBand(whisperScore(f)),
    certificate: f.get('hornchildCertificate') as EndingInputs['certificate'],
    mauerFate: f.get('mauerFate') as EndingInputs['mauerFate'],
    hallerFate: f.get('hallerFate') as EndingInputs['hallerFate'],
  };
}

/** The ending matrix (NAR-0158) for a won finale. */
export function endingFor(i: EndingInputs): Exclude<Ending, 'perfect'> {
  if (i.trust >= 2 || (i.trust >= 1 && i.whisper !== 'accused' && i.certificate !== 'natural')) return 'pardon';
  if (i.whisper !== 'accused' && (i.mauerFate === 'hale' || i.hallerFate === 'hands')) return 'pyre';
  return 'exile';
}

/** A step condition: this ending is the one the flags lead to. */
export const endingIs =
  (e: Exclude<Ending, 'perfect'>) =>
  (f: FlagReader): boolean =>
    endingFor(endingInputs(f)) === e;

// ---------------------------------------------------------------- the endings

/** The Quiet Night, averted — with Stroh's pardon. */
export const ENDING_PARDON: StoryDef = {
  id: 's5-end',
  place: 'Kessendorf — the morning after Hollow Night',
  backdrop: 'hospice',
  lines: [
    n('Dawn comes up on Kessendorf, and the city wakes: which is to say it complains, and coughs, and goes to work.'),
    n('Aurel Vennholt lives, in a Tribunal cell, and asks each morning for news of the patients. He has not sung since.'),
    say('stroh', 'The council has withdrawn the warrant. The Widow Reiss has left the city, in a carriage without a crest.'),
    ...onlyIf((f) => trialVerdict(f) !== 'acquitted', say('kreuzer', 'And the verdict? I was to burn at the east gate this morning. I had rather got used to the idea.')),
    ...onlyIf(verdictIs('acquitted'), say('kreuzer', 'And the council’s writ? I was to sit in that cell until the Widow’s appeal. I had rather got used to the damp.')),
    say('stroh', 'Void. The court sat under a charter renewed by a woman who has since fled the city with the Choir’s ledgers.'),
    say('stroh', 'I have written to the Tribunal that the matter of the Doctor’s hands is closed. I did not say how I closed it.'),
    say('kreuzer', 'You kept a ledger of every candle I put out.'),
    say('stroh', 'I did. I burned it this morning. It made a very small fire. I thought you would appreciate the irony.'),
    say('mauer', 'Thirty-five. All thirty-five, Doctor. I said the names at the gate this morning, the six and the thirty-five.'),
    say('mauer', 'The council wants to know who dug a tunnel under their court. I told them it was rats. Very large, very polite rats.'),
    say('patient', 'I have named a new mine for you. The Kreuzer Hope. It is a very good mine. It has not fallen in once.', 'Orsa Flintvein'),
    say('patient', 'Also, the tunnel. You may keep the tunnel. Every city should have one.', 'Orsa Flintvein'),
    say('haller', 'I read your letter. Unsang it, you say. Well. I only ever taught you to sing it. The rest was your own.'),
    say('haller', 'The Guild has restored your licence, by the way. Voss voted against. I have never enjoyed a vote so much.'),
    ...onlyIf((f) => trialVerdict(f) !== 'acquitted', n('At the east gate, the pyre they built for him is taken apart plank by plank and carried off for firewood before noon.')),
    ...onlyIf(verdictIs('acquitted'), n('At the east gate, the stakes the council had ordered cut for a pyre are sold back to the timber yard at a loss.')),
    say('ilse', 'The Mother Superior writes. She wants me back at the convent, out of trouble.'),
    say('kreuzer', 'And?'),
    say('ilse', 'I wrote that I have never once been out of trouble, and do not intend to start. Doctor — you have a patient.'),
    say('ilse', 'There’s a drover on the table. Somebody at the Crooked Goose disagreed with his dice.'),
    say('kreuzer', 'Knife wounds. Simple work.'),
    say('ilse', 'And in this hospice, we do not lose patients to simple work.'),
    n('THE END — THE QUIET NIGHT, AVERTED'),
  ],
};

/** The Pyre Refused — the sentence stands, and the city will not carry it out. */
export const ENDING_PYRE: StoryDef = {
  id: 's5-end-pyre',
  place: 'Kessendorf — the east gate, the morning after Hollow Night',
  backdrop: 'street',
  lines: [
    n('The sentence stands. The court that passed it has fled, but a sentence, the clerks explain, does not need a court to stand.'),
    n('So at dawn they bring Kreuzer to the east gate, where the pyre was built on the night before Hollow Night.'),
    say('stroh', 'I cannot void it, Doctor. I tried. Too many candles, too many witnesses. The law has a very long memory.'),
    say('kreuzer', 'Then do your office, Inquisitor. You have waited long enough for it.'),
    n('The executioner comes with a torch. He stops at the edge of the crowd. The crowd does not part.'),
    say('patient', 'You’ll have to go through me. He sewed my arm on. I’d like to keep it where it is.', 'Tomas, scout'),
    say('patient', 'And me. I’m a drover, and I owe him two stitchings and a lecture.', 'Jost'),
    say('patient', 'My Liesl is at home, asleep. You’ll light nothing here while I’m standing.', 'Liesl’s mother'),
    say('mauer', 'The Watch is present, Inquisitor. The Watch sees a riot. The Watch declines to do anything about it.'),
    say('haller', 'I have stood on this spot before, you know. For the Precentor. I did nothing then. Today I will stand here all day.'),
    n('The torch burns down to the executioner’s glove. He drops it into a puddle. Someone in the crowd applauds.'),
    say('stroh', 'Well. The sentence stands, Doctor. Nobody will carry it out. I find that a very Kessendorf solution.'),
    say('kreuzer', 'And my licence?'),
    say('stroh', 'Struck. You may not practise surgery in this city. I cannot stop anyone from bringing you their wounds, of course.'),
    n('That afternoon the hospice has a sign on the door: NO SURGEON. The queue outside goes round the block.'),
    say('ilse', 'Doctor. Officially, you are a man who happens to own a very sharp knife and a great many friends.'),
    say('kreuzer', 'Officially. And unofficially?'),
    say('ilse', 'Unofficially there’s a drover on the table, and the Crooked Goose disagreed with his dice again.'),
    say('kreuzer', 'Knife wounds. Simple work.'),
    say('ilse', 'And in this hospice — with or without a licence — we do not lose patients to simple work.'),
    n('THE END — THE PYRE REFUSED'),
  ],
};

/** Exile, with Ilse — the sentence stands, and they go. */
export const ENDING_EXILE: StoryDef = {
  id: 's5-end-exile',
  place: 'The Timber Road — dawn, the morning after Hollow Night',
  backdrop: 'dawn',
  lines: [
    n('The sentence stands. By the time the city wakes, the man it condemned is three leagues down the Timber Road.'),
    n('Ilse drives the cart. The instruments ride in the back in their oilcloth roll, and a small crate of lead dishes.'),
    say('kreuzer', 'You needn’t have come, Sister. You could have stayed. They would never have tried you.'),
    say('ilse', 'They would have asked me to swear I saw nothing. I have lied for you once. I will not start lying for them.'),
    say('kreuzer', 'The Mother Superior will be furious.'),
    say('ilse', 'She is always furious. It is the one reliable thing in the Order.'),
    n('At the milestone the road forks: east toward the Vennmark, north toward the mountain delvings, south toward nowhere in particular.'),
    say('patient', 'North! There is always work in the delvings, and nobody there has ever heard of a Tribunal. We don’t allow it.', 'Orsa Flintvein'),
    say('kreuzer', 'Orsa. How long have you been in the back of this cart?'),
    say('patient', 'Since the tunnel. It was a very good tunnel. I did not like to leave it without a goodbye.', 'Orsa Flintvein'),
    n('Behind them, on the city wall, a small figure in a dark hat watches the cart until it is out of sight, and writes nothing down.'),
    say('kreuzer', 'Stroh.'),
    say('ilse', 'He could have sent riders. He sent none.'),
    say('kreuzer', 'He kept a ledger of every candle I put out. I suppose I owe him the candles.'),
    n('The Precentor lives, in a Tribunal cell, and asks each morning for news of the patients. Nobody in Kessendorf can tell him.'),
    n('A letter reaches the delvings in the spring, in Haller’s shaking hand: the hospice has a new surgeon, and she is terrible.'),
    say('ilse', 'Doctor. There’s a miner at the door. A rockfall, and a very rude pick.'),
    say('kreuzer', 'Crush wounds. Simple work.'),
    say('ilse', 'And wherever we are, we do not lose patients to simple work.'),
    n('THE END — EXILE, WITH ILSE'),
  ],
};

/** The Perfect End — the failure state: the Office completes in the Precentor, and the city sleeps. */
export const ENDING_PERFECT: StoryDef = {
  id: 's5-end-perfect',
  place: 'Kessendorf — Hollow Night, after Compline',
  backdrop: 'night',
  lines: [
    n('The last sigil on the Precentor’s heart turns, and the clock-face of eight Hours is complete.'),
    n('He does not die. He only stops. And the silence goes out of him like a tide.'),
    say('choir', 'Now let your servant depart in peace.', 'The Precentor'),
    n('It reaches the crypt first. Orsa sits down on the stone floor with her pick across her knees and closes her eyes.'),
    n('Then the stair. Then the street. Then the ward.'),
    say('ilse', 'Doctor — the patients. Their breathing. It’s slowing, all of them, together, like one—'),
    n('She does not finish the word. She lies down on the ward floor beside the cots, very neatly, as if she means to rest a moment.'),
    n('The Watch on the Penny Stair lowers its pikes. Mauer counts his men once, and does not reach the end of the count.'),
    n('The drover at the Crooked Goose puts down his dice. The girl with the horn-buds sleeps, and her mother sleeps beside her.'),
    n('Every candle in Kessendorf stands perfectly still, and then, one by one, goes quietly out.'),
    say('choir', 'Hush the ward, and hush the street; / sleep is kind, and death is sweet.', 'The Choir'),
    n('Only Kreuzer is awake. The Litany keeps him, the way it kept every patient he ever held together with it.'),
    say('kreuzer', 'Aurel. Wake them. You were a surgeon once. You swore to it.'),
    say('choir', 'I am keeping it, Doctor. No more pain. No more plague. No more surgeons. It is the perfect end.', 'The Precentor'),
    say('kreuzer', 'It is the end. It is not perfect. There is no such thing as a perfect end. There is only the next patient.'),
    n('He picks up the lancet. His hands are the only moving thing in the city.'),
    say('kreuzer', 'Again. From the first Hour.'),
    // His journal page (NAR-0094), written in the silence.
    ...PERFECT_JOURNAL.map((l) => say('kreuzer', l)),
    n('THE PERFECT END — the Office is complete. Try the operation again.'),
  ],
};

/** Every ending scene by id, for the loc export and tests. */
export const ENDING_STORIES: Record<Ending, StoryDef> = { pardon: ENDING_PARDON, pyre: ENDING_PYRE, exile: ENDING_EXILE, perfect: ENDING_PERFECT };
