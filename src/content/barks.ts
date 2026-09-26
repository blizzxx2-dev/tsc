/**
 * Barks (NAR-0071…NAR-0078): the unscripted lines observers say during an operation, keyed by
 * speaker and trigger. Taxonomy, cooldowns and the anti-repeat rule: docs/narrative/barks.md.
 * Runtime: barkDirector.ts. Nothing here is an instruction the player needs.
 */
import type { Rank } from '../surgery/types';
import { HALLER_LETTER, ORSA, PATIENT_BARKS_LATER } from './barksLater';
export { HALLER_LETTER };

export type BarkTrigger =
  | 'op-start'
  | 'cool'
  | 'good'
  | 'bad'
  | 'miss'
  | 'combo-5'
  | 'combo-10'
  | 'combo-20'
  | 'vitals-30'
  | 'vitals-15'
  | 'tincture'
  | 'litany'
  | 'phase'
  | 'enraged'
  | 'success'
  | 'fail'
  | 'idle'
  | 'time-30';

export const BARK_TRIGGERS: readonly BarkTrigger[] = [
  'op-start',
  'cool',
  'good',
  'bad',
  'miss',
  'combo-5',
  'combo-10',
  'combo-20',
  'vitals-30',
  'vitals-15',
  'tincture',
  'litany',
  'phase',
  'enraged',
  'success',
  'fail',
  'idle',
  'time-30',
];

/** `examiner`: the neutral voice of challenge mode (NAR-0167) — no names, no story. */
export type BarkSpeaker = 'ilse' | 'haller' | 'mauer' | 'stroh' | 'orsa' | 'examiner';

/** Seconds between any two barks in one operation (sim clock). */
export const BARK_COOLDOWN = 6;

/** Most times a trigger may fire in one operation. `phase` is uncapped. */
export const BARK_LIMITS: Record<BarkTrigger, number> = {
  'op-start': 1,
  cool: 6,
  good: 4,
  bad: 4,
  miss: 4,
  'combo-5': 2,
  'combo-10': 2,
  'combo-20': 1,
  'vitals-30': 2,
  'vitals-15': 2,
  tincture: 3,
  litany: 2,
  phase: Infinity,
  enraged: 2,
  success: 1,
  fail: 1,
  idle: 2,
  'time-30': 1,
};

/** Triggers that speak at once, cooldown or no. */
export const BARK_URGENT: readonly BarkTrigger[] = ['litany', 'enraged', 'success', 'fail'];

/** Chance a rating bark fires at all (they would otherwise drown the panel). */
export const BARK_SAMPLE: Partial<Record<BarkTrigger, number>> = { cool: 0.25, good: 1 / 6, bad: 0.5, miss: 1 };

/** Sister Ilse: ledger-dry, kind, frightened of the gift and quiet about it. (NAR-0071) */
const ILSE: Record<BarkTrigger, readonly string[]> = {
  'op-start': [
    'Instruments counted and laid out, Doctor. Eight. I shall count them again after.',
    'The linen is boiled and the candle is fresh. The rest is yours.',
    'I have entered his name in the ledger. Let us not move it to the other column.',
    'Ready when you are, Doctor. He has been ready rather longer.',
    'The Saint keeps the lamp; you keep the hands. Begin.',
    'Bowl, thread, salve, tongs. And a prayer, which costs nothing.',
    'He has had a draught of poppy and a mouthful of brandy. The brandy was his idea.',
  ],
  cool: [
    'Clean. I shall write that down.',
    'That is how the Master draws it in the book — only you did it in flesh.',
    'A neat stroke. Saint Ildra would approve, and she was particular.',
    'Good. Now do that again where it matters.',
    'A single stroke, and nothing wasted. The thread is dear, you know.',
    'That went exactly as it should. I say so seldom; mark it.',
    'The Guild charges a crown to watch work like that. You may bill them.',
  ],
  good: [
    'Well enough. He will not notice the difference; I did.',
    'That will hold. Keep going.',
    'Sound work, Doctor. Not pretty, but sound.',
    'Adequate. A patient is not a portrait.',
    'The wound closes; that is the whole of the argument.',
    'Good. Less of the flourish next time and it will be better.',
  ],
  bad: [
    'That tore. Steady the hand before the next one.',
    'The thread pulled through. Breathe, Doctor, and go again.',
    'Rough. He felt that through the poppy.',
    'The stroke wandered. Look at the wound, not at me.',
    'Careful — that cost him blood he has not got to spare.',
    'A poor stitch is worse than none; it lies about being closed.',
    'Slower. The sand-glass is patient; the wound is not.',
  ],
  miss: [
    'That is healthy flesh, Doctor. Leave him some.',
    'Wrong tool. The tray is in front of you.',
    'Nothing gained there but a scar he did not order.',
    'You cut the air. He has paid for the whole man, not the space around him.',
    'The salve does not stitch and the thread does not drain. Choose.',
    'Missed. Find the wound again; it has not moved.',
  ],
  'combo-5': [
    'Five in a row, clean. I am keeping a tally.',
    'That is a rhythm. Keep it, and do not look up.',
    'Five. Your hands have found the work; let them keep it.',
    'Steady, steady — five without a slip.',
    'Five clean. The Master would grunt, which from him is a hymn.',
    'You are ahead of the bleeding now. Stay there.',
  ],
  'combo-10': [
    'Ten. I have stopped counting the stitches and started counting the miracles.',
    'Ten clean strokes. Do not let me distract you with praise.',
    'Ten. If Haller were here he would say nothing, very loudly.',
    'Ten in a row. The Guild examiners could not do it drunk, and they always are.',
    'Ten. I shall enter it under “fees, forgiven”.',
    'A tenth clean stroke. Whatever you are doing, keep doing it.',
  ],
  'combo-20': [
    'Twenty. Doctor — I have never seen twenty.',
    'Twenty clean. I am going to stop counting before it seems like witchcraft.',
    'Twenty. There is no column in the ledger for that.',
    'Twenty without a slip. I shall write “as if the Saint held the thread”.',
    'Twenty. Do not look at the Inquisitor. Do not look at anyone. Finish.',
    'Twenty in a row, and the candle has not even guttered.',
  ],
  'vitals-30': [
    'He is greying, Doctor. His pulse is thin as thread.',
    'His colour is going. Steady him before you go on.',
    'His breath is shallow. The tincture is by your left hand.',
    'He is slipping. Not yet lost — slipping.',
    'The pulse is faint. I can barely find it at the wrist.',
    'He has gone the colour of the linen. Doctor.',
  ],
  'vitals-15': [
    'Doctor. I cannot find his pulse.',
    'He is nearly gone. Whatever you are going to do, do it now.',
    'His lips are blue. Saint Ildra, keep the lamp a moment longer.',
    'We are losing him, Doctor. The tincture. Now.',
    'He is not breathing well. Please.',
    'The lamp is guttering. Do not let it.',
  ],
  tincture: [
    'There — the colour comes back into his cheek.',
    'His pulse steadies. Good. The cordial is dear; it was worth it.',
    'That took. He is breathing easier.',
    'He steadies. I shall note one draught used.',
    'Better. His heart has remembered its work.',
    'The draught has him. Go on while it holds.',
  ],
  litany: [
    '…Doctor. The candles have stopped.',
    'The world has gone quiet. I shall not say anything. I shall not say anything.',
    'Saints forgive us. The Order says never to halt a soul — and you have halted the room.',
    'I can hear my own heart and nothing else. Finish quickly.',
    'Eight heartbeats. I am counting so that no one else has to.',
    'Whatever this is, it is not in any book I have read. Use it well.',
    'The flame stood still. If anyone asks, it was the draught.',
  ],
  phase: [
    'On to the next. He is holding.',
    'That part is done. The Saint keeps a tally; so do I.',
    'One thing at a time, Doctor. Here is the next thing.',
    'Very well. Now this.',
    'The worst is behind us. Or it is in front of us. Continue.',
    'Another stage. I shall change the bowl.',
    'Fresh linen. Go on.',
  ],
  enraged: [
    'It is answering you. Do not answer it back.',
    'Something in the wound has woken. Keep your hands steady.',
    'Doctor — it moved. All of it.',
    'It knows the brand now. Be quick.',
    'The thing has a temper. So have you; use yours first.',
    'Saints. It is singing.',
  ],
  success: [
    'He will live. I shall write it in the ledger before anyone can argue.',
    'Done. I will tell the family. It is the better errand, for once.',
    'He breathes, he is closed, and the candle is still lit. That is a good day here.',
    'Sound work, Doctor. Now wash your hands; there is another one waiting.',
    'The Saint kept the lamp. You kept the rest.',
    'Closed and breathing. I shall move his name back to the living column.',
    'It is done. Sit down before you fall down; I have seen that too.',
  ],
  fail: [
    'He is gone, Doctor. I will fetch the key.',
    'It is over. I will write his name in the other column. You did what could be done.',
    'The lamp is out. Wash your hands. Someone must tell them, and it will be me.',
    'He has departed. The Order says we do not halt a soul when it is time. It was time.',
    'Enough, Doctor. Let him be still.',
    'I will sit with him a while. Go and breathe.',
  ],
  idle: [
    'Doctor? The wound is still there.',
    'He is waiting, Doctor. So is the bleeding.',
    'Something troubling you? Choose a tool; the choosing is half the work.',
    'The sand runs whether or not we do.',
    'Doctor. Hands.',
    'If you are praying, pray with the thread in your hand.',
  ],
  'time-30': [
    'The glass is nearly run. Finish what you have started.',
    'Half a minute of sand left, Doctor.',
    'Little time. Close what you can and leave the rest to the salve.',
    'The last of the sand. Quickly, but not carelessly.',
    'Thirty heartbeats of sand, no more.',
    'The glass, Doctor. The glass.',
  ],
};

/** Master Haller: dry, critical, contempt for the Guild; supervises op1-1 and op1-2. (NAR-0072) */
const HALLER: Record<BarkTrigger, readonly string[]> = {
  'op-start': [
    'Begin. And do not tell me what Weissburg taught you; show me.',
    'A patient, a knife, a sister with a ledger. All you need to make a corpse. Try not to.',
    'I shall stand here and say nothing. When I say something, listen.',
    'The Guild would want his licence fee first. I want the bleeding stopped. Begin.',
  ],
  cool: [
    'Hm.',
    'That will do. Do not let it go to your head; heads bleed.',
    'Passable. I have seen worse from men who charge more.',
    'Yes. That. Again.',
  ],
  good: [
    'It holds. It is ugly, but it holds.',
    'Acceptable. In Weissburg they would frame it; here we move on.',
    'Well enough. Your hand is better than your letters.',
    'Not wrong. Not right either. Keep going.',
  ],
  bad: [
    'You are sawing. A thread is drawn, not sawn.',
    'That was a butcher’s stroke. He is not a ham.',
    'Clumsy. Again, and think first this time.',
    'The Guild examiners would pass that. That is not a compliment.',
    'If you cannot see the wound, drain it. If you can, why did you miss it?',
  ],
  miss: [
    'You have cut a man who was not wounded there. Now he is.',
    'That is the wrong instrument, and you knew it before you touched it.',
    'Air. You stitched the air. The air is well; the man is not.',
    'Look at the tray, then at the wound, then at your hands. In that order.',
  ],
  'combo-5': [
    'Five. Adequate. Continue.',
    'A run of five. Do not stop to admire it.',
    'Five clean. I said nothing. Take that as I mean it.',
  ],
  'combo-10': [
    'Ten. …Hm. Continue.',
    'Ten without a slip. I taught for thirty years and saw that four times.',
    'Ten. Do not tell the Guild; they will want a fee for it.',
  ],
  'combo-20': [
    'Twenty. I have nothing to say. Remember this day; I shall not repeat it.',
    'Twenty clean. Whatever you were sworn at Weissburg, it was not this.',
    'Twenty. Sister, write that down; nobody will believe me.',
  ],
  'vitals-30': [
    'He is greying. Attend to the man, not the wound.',
    'His pulse is going. You have a cordial. Use it or lose him.',
    'He is failing. A dead man has no wounds worth stitching.',
    'Look at his colour. Now look at your priorities.',
  ],
  'vitals-15': [
    'He is nearly gone. Stop admiring the cut and steady him.',
    'His pulse is a whisper. The tincture. Now, boy.',
    'You are about to lose him. Decide whether you mind.',
  ],
  tincture: [
    'Good. The heart steadies. Now stop wasting it.',
    'That is what the draught is for. Go on.',
    'He comes back. Do not make me watch that twice.',
  ],
  litany: [
    'Quietly. The room has stopped. Do what you must, and do not speak of it.',
    'So. You have it. Say nothing, and finish.',
    'Eight heartbeats. Use them; I have seen men waste them on wonder.',
    'Not a word, Sister. Not one. Doctor — work.',
  ],
  phase: [
    'Next. You are not finished merely because that part is.',
    'On. The wound does not care that you are tired.',
    'Well. The next thing, then.',
    'That is one stage. Do not count them; do them.',
  ],
  enraged: [
    'It has woken. Do not flinch; it is watching for that.',
    'The thing answers the iron. Answer faster.',
    'There. That is what the Guild says does not exist.',
  ],
  success: [
    'He lives. Do not expect that to be remarked on. It has been remarked on.',
    'Adequate. Sister, the ledger. Doctor, the basin. Next.',
    'He will walk. Probably. Well done, in so far as I say such things.',
    'A living man. That is the only mark the Guild cannot grade.',
  ],
  fail: [
    'He is gone. Wash your hands. There is no lesson in it that you do not already know.',
    'Dead. It happens to the best of us, and you are not that yet. Wash.',
    'Enough. Cover him. We will talk of it tomorrow, not tonight.',
  ],
  idle: [
    'Are you waiting for the wound to close itself? It is considering it.',
    'Hands, Doctor. Thinking is for afterwards.',
    'The sand runs. So does the blood. Which of them are you watching?',
  ],
  'time-30': [
    'The glass is nearly out. Close what you can.',
    'Thirty heartbeats of sand. Finish.',
    'Little time. A closed wound beats a perfect one.',
  ],
};

/** Captain Mauer: counts everything, wants him fit to march; the camp tent, Ch2. (NAR-0073) */
const MAUER: Partial<Record<BarkTrigger, readonly string[]>> = {
  'op-start': ['Do what you do, Doctor. I have forty men and the council pays for thirty-nine.', 'He is one of mine. I would like him back with the same number of parts.', 'Begin. The mules are watching, and they are the only ones with sense.'],
  cool: ['Is that good? That looked good.', 'Oswy’s wheel. I have seen a farrier take longer over a hoof.', 'Neat. Can you teach the cook that?'],
  good: ['That will do. Will he march?', 'Sound enough for a soldier. He is not a burgher.', 'Good. Next wound, Doctor; he has several.'],
  bad: ['That looked like it hurt. It did, I can tell by the language.', 'Steady, Doctor. The council pays late but it pays for whole men.', 'Rough. Do it again and I will not tell him.'],
  miss: ['You missed. He did not; he is bleeding on the map.', 'Wrong end of the man, Doctor.', 'The wound is under your hand, not beside it.'],
  'combo-5': ['Five clean. I count that as a good day’s march.', 'Five. The Sister is keeping a tally; so am I.'],
  'combo-10': ['Ten. If you could stitch the council as fast we would all be paid.', 'Ten in a row. I shall mention it in the roll, under “miracles, minor”.'],
  'combo-20': ['Twenty. Do not let the Inquisitor hear me say it, but that was something.', 'Twenty. I have counted a lot of things, Doctor. Never that.'],
  'vitals-30': ['He is grey as a tent-wall. Is he fit to march?', 'He is going, Doctor. I have seen that colour on the Timber Road.'],
  'vitals-15': ['Doctor. I have written enough letters this year.', 'He is nearly gone. Whatever is in that bottle, give it to him.'],
  tincture: ['There. He looks like a soldier again instead of a sack.', 'Better. Whatever that was, put it on the requisition.'],
  phase: ['Next, then. He has more holes than the tent.', 'On, Doctor. The scouts go out again at dawn.', 'What now? Is he fit to march?'],
  success: ['He lives. Forty men. Forty. Sister, the mule-count stands.', 'Good. Tell him he has a week off and then he carries the banner.', 'Alive and closed. Put it on the council’s bill; they will pay it in the spring.'],
  fail: ['…Eleven walking. Cover him, Sister. I will write the letter.', 'He is gone. Doctor, it is not the first, and the Grauwald is not done with us.'],
  idle: ['Doctor? The scouts go out at dawn.', 'He is waiting. So is the Grauwald.'],
  'time-30': ['Little time, Doctor. Close him and let us go.', 'The glass is nearly run. A soldier walks with a scar.'],
};

/** Inquisitor Stroh: counts evidence; Litany, boss temper, phases, outcomes only. (NAR-0074) */
const STROH: Partial<Record<BarkTrigger, readonly string[]>> = {
  litany: [
    'The candle. Did anyone else see the candle?',
    '…Eight. I counted eight. Carry on, Doctor.',
    'The flame stood still. I shall write “a draught”, for now.',
    'Curious. The room went quiet, and you did not.',
    'Remarkable, Doctor. I only wish to watch.',
    'Nobody moved. Not even the Sister. I have that in my notes.',
  ],
  enraged: [
    'It answers you. A curse that answers is a curse that was called.',
    'Note the hour. Note who was present.',
    'So it lives. And it sings. The Tribunal will want to know who taught it the words.',
    'It fights you, Doctor. Things fight what they fear.',
  ],
  phase: [
    'Proceed. I am writing.',
    'Every stage, Doctor. I miss nothing; it is my office.',
    'The Sister is very calm. I note that also.',
    'Continue. Pestilence always has a sponsor; so, I find, does skill.',
  ],
  success: ['A remarkable recovery, Doctor. Remarkable.', 'He lives. I shall record how, as far as I could see it.', 'Well done. I mean that as plainly as I can, which is not very.'],
  fail: ['A pity. The Tribunal does not grudge a man his dead. Only his miracles.', 'He is gone. I will need a statement, Doctor. Tomorrow will do.', 'Note the hour. That is all.'],
};

/** The examiner (NAR-0167): X-operations' neutral proctor — no spoilers, no names; four per trigger for the anti-repeat rule. */
const EXAMINER: Partial<Record<BarkTrigger, readonly string[]>> = {
  'op-start': ['The examination begins. The clock is running.', 'Your instruments are laid out. Begin when ready.', 'This is a set case. It will be marked.', 'Candidate, the table is yours.'],
  cool: ['Exemplary.', 'Noted: textbook.', 'That is the standard.', 'Precisely so.'],
  good: ['Acceptable.', 'Sound. Continue.', 'Adequate work.', 'Within tolerance.'],
  bad: ['That will cost marks.', 'Imprecise. Noted.', 'The examiner saw that.', 'Careless.'],
  miss: ['Nothing there.', 'Wasted motion.', 'No target.', 'That touched nothing.'],
  'combo-5': ['A clean run. Keep it.', 'Five without fault.', 'Consistent. Continue.', 'The run holds.'],
  'combo-10': ['Ten without fault. Rare.', 'Ten. The marks are climbing.', 'An unbroken ten.', 'Ten clean strokes.'],
  'combo-20': ['Twenty. The examiner has stopped writing.', 'Twenty without fault.', 'An exceptional run.', 'Twenty. Remarkable.'],
  'vitals-30': ['The patient is failing. Prioritise.', 'Vitals are low. Stabilise first.', 'Blood loss is marked against you.', 'Attend to the bleeding.'],
  'vitals-15': ['Critical. One more error ends the case.', 'The patient is nearly lost.', 'Stabilise now or fail.', 'Last chance to save the case.'],
  phase: ['Next stage.', 'The case changes. Adapt.', 'Proceed.', 'New findings. Continue.'],
  idle: ['The clock does not wait.', 'Hesitation is marked as time.', 'Candidate?', 'Continue the procedure.'],
  'time-30': ['Thirty seconds remain.', 'Time is nearly out.', 'Finish the case.', 'The clock is against you.'],
  success: ['Case closed. Your mark will follow.', 'Complete. The examiner is satisfied.', 'Examination passed.', 'The case is closed.'],
  fail: ['The case is failed. Review and retry.', 'The patient is lost. The examination ends.', 'Failed. The table will be reset.', 'The examination is over.'],
};

export const BARKS: Record<BarkSpeaker, Partial<Record<BarkTrigger, readonly string[]>>> = { ilse: ILSE, haller: HALLER, mauer: MAUER, stroh: STROH, orsa: ORSA, examiner: EXAMINER };

/** Operations where Inquisitor Stroh is present and adds his lines. */
export const STROH_PRESENT: readonly string[] = ['op1-4', 'op1-5', 'op2-4', 'op2-5', 'op3-10', 'op5-9'];

/** Which observer talks at the table for a given operation (docs/narrative/barks.md §1). */
export function speakerFor(opId: string): BarkSpeaker {
  if (opId === 'op1-1' || opId === 'op1-2') return 'haller';
  if (opId === 'op2-1' || opId === 'op2-2' || opId === 'op2-3' || opId === 'op2-5') return 'mauer';
  // Orsa (NAR-0162): at the table for her delvers, and while Ilse is on it or recovering.
  if (opId === 'op4-3' || opId === 'op5-6' || opId === 'op5-7' || opId === 'op5-8') return 'orsa';
  return 'ilse';
}

// ------------------------------------------------------------------ patients (NAR-0075)

export type PatientTrigger = 'first-cut' | 'extract' | 'closing' | 'pain' | 'relief';

/** The demo patients, keyed by operation id; fired on first incision, extraction, closing. */
export const PATIENT_BARKS: Record<string, Partial<Record<PatientTrigger, readonly string[]>>> = {
  ...PATIENT_BARKS_LATER,
  'op1-1': {
    'first-cut': ['Hff. Go on, then. I have had worse from a goose.'],
    pain: ['Saints — the dice were loaded, I swear it.', 'Gently, master. I am a drover, not a hide.'],
    closing: ['Am I closed? I feel closed.'],
    relief: ['Ah. That is better. That is a great deal better.'],
  },
  'op1-2': {
    'first-cut': ['Do it. I held the line; I can hold this.', 'Hornfolk barbs, they said. I felt it go in like a hook.'],
    extract: ['Out — is it out? Show me the cursed thing.', 'I want that arrow. I am going to keep it.'],
    closing: ['Will I march, Doctor? Tell the Captain I will march.'],
    pain: ['Ahh — Saint Oswy’s wheel —'],
  },
  'op1-3': {
    'first-cut': ['The barrel was proofed. It was proofed twice.', 'I can’t feel my arm. Is that the poppy or the powder?'],
    extract: ['Lead. There was lead in me. The Guild will want it back.', 'Pull it. I would sooner know it is out.'],
    closing: ['Master Founder will say I stood too close. I stood where he put me.'],
    relief: ['…Oh. Oh, that is cool. Thank you.'],
  },
  'op1-4': {
    'first-cut': ['Do not let the Inquisitor near me. Please.', 'Lance it. I do not care; lance it.'],
    pain: ['The Rows are all coughing. All of them. Nobody has come for them.', 'It burns. Saints, the sore burns.'],
    closing: ['If I live, tell them at the Rows the hospice took me. Tell them.'],
    relief: ['Ah. The burning stops. Is that the salve?'],
  },
  'op1-5': {
    'first-cut': ['Doctor, there is a voice under my ribs. It is counting.', 'I can hear it. It says the watch is closed.'],
    pain: ['It is singing — make it stop singing —', 'My lady said the carriage would bring me home. It brought me here.'],
    closing: ['Is it gone? Doctor, is the voice gone?'],
    relief: ['…Quiet. It is quiet now.'],
  },
  'op2-1': {
    'first-cut': ['The thing had eyes like wet coins. Pull the teeth, Doctor.', 'It followed us out of the barrows. It was not in a hurry.'],
    extract: ['A fang. Saints. I want to show the Captain.', 'That was in me? That?'],
    closing: ['Tell Mauer I can scout tomorrow. Do not tell him I said it lying down.'],
    pain: ['The spit burns — it is still burning —'],
  },
  'op2-2': {
    'first-cut': ['Cut, surgeon. I have been cut by better rock than you.', 'Mind the beard. Every knot in it is owed to somebody.'],
    extract: ['That is the seam. Black as a wet eye. Get it out of me.', 'It is humming. Do you hear it humming?'],
    closing: ['Tie a knot for you, surgeon. I pay my debts.'],
    pain: ['By Saint Hedda’s cracked bell —'],
  },
  'op2-3': {
    'first-cut': ['She saw my face. They say she remembers.', 'Two bites. The second was for looking back.'],
    extract: ['Do not let them hatch. Doctor. Do not let them hatch in me.', 'Out. Out, out, out.'],
    closing: ['Is the last one gone? You are certain?'],
    relief: ['…The crawling has stopped. Thank you.'],
  },
  'op2-4': {
    'first-cut': ['You should let it burn. It is the mark of the closed watch.', 'The Tribunal fed me once in three days. Cut what you like.'],
    pain: ['The Office is not finished. It is never finished.', 'Who keeps the watch before the sun —'],
    closing: ['Why? Why would you close me?'],
    relief: ['…Ah. A mercy. I did not expect one.'],
  },
  'op2-5': {
    'first-cut': ['Two of us in here, Doctor. I only brought one.', 'The banner. Somebody hold the banner.'],
    pain: ['It answers. Every time I breathe, something answers.', 'Dawn. It keeps saying dawn.'],
    closing: ['Am I one man again? Count me.'],
    relief: ['Quiet. Both of us, quiet.'],
  },
};

// ------------------------------------------------------------------ the Hours (NAR-0076)

/** Matins whispers a vigil; Lauds answers itself. Keyed to boss phases; original verse. */
export const MALISON_WHISPERS: Record<'matins' | 'lauds', readonly string[]> = {
  matins: [
    'Who keeps the watch when the watch is closed?',
    'One eye, and the night is long enough for it.',
    'Hush. The house is asleep. The house was told to sleep.',
    'I was sung into him by candle-light. Put out the candle.',
    'The first hour. There is no last one.',
    'Count with me, surgeon. I have all night.',
    'You are a bright little flame. I have snuffed brighter.',
    'Every stitch you make, I open my eye to watch.',
  ],
  lauds: [
    'Who keeps the watch before the sun?',
    'The one who wakes, and wakes alone.',
    'Who sings the day when day is done?',
    'The one we answer, bone to bone.',
    'Two voices. One flesh. You cannot silence half a hymn.',
    'Answer me. — I answer.',
    'The dawn is a wound the sky opens every morning. Close that, surgeon.',
    'He carried a banner. Now he carries us.',
    'Sing back, little brand. We shall wait for the echo.',
    'When one of us is quiet, the other remembers the words.',
    'Lauds. Praise. You are praising us with every cut.',
    'Bone to bone. Bone to bone. Bone —',
  ],
};

// ------------------------------------------------------------------ rank quips (NAR-0078)

/** One italic line under the rank seal, in the voice of the op's speaker. */
export const RANK_QUIPS: Record<BarkSpeaker, Record<Rank, readonly string[]>> = {
  orsa: {
    XS: ['I’m naming the next three mines after that. The good ones.', 'Not a wasted stroke. Delvers would weep, if delvers wept.', 'That was rock-perfect, surgeon. I don’t say that about rock.', 'Tell nobody I said so, but that was beautiful.'],
    S: ['Clean work. I’d have you on my crew.', 'Fast and sound. The way a good shaft goes down.', 'Barely a slip. I was watching for one.', 'That’s a proper job, surgeon.'],
    A: ['Good digging. A bit slow in the middle.', 'Sound. He’ll walk out of here.', 'Well done. Mostly well done.', 'It holds. Most things do, if you did them right.'],
    B: ['He lives. I’ve seen tidier, I’ve seen worse.', 'Rough seam, but it’s through.', 'It’ll hold. Don’t lean on it.', 'Alive. That’s what we came for.'],
    C: ['Alive, just. We’ll call it a win and not talk about it.', 'That was a cave-in with a happy ending.', 'He breathes. Let’s not do that again.', 'We got him out. Ugly, but out.'],
  },
  ilse: {
    XS: ['I have no column for this. I shall rule one.', 'The Saint held the thread, and you held the Saint.', 'Not a slip. Not one. I counted twice.', 'The Master will say “hm”. Treasure it.'],
    S: ['Sound, swift and clean. I shall write it plainly.', 'That is work the Guild would frame and then fine.', 'Nearly faultless. The candle barely moved.', 'I have seen worse called a miracle.'],
    A: ['Good work, Doctor. He will scarcely scar.', 'Well done. The ledger is content.', 'Sound. A little slow, but sound.', 'He lives and he is whole. That is the mark that matters.'],
    B: ['He lives. The rest is polish.', 'Rough in places. He will not know; I do.', 'Adequate. I have entered it as such.', 'It held. Next time, it will hold prettier.'],
    C: ['He lives. That is the whole of the argument today.', 'A hard case, badly weathered. But weathered.', 'We got him through. We did not get him through well.', 'Alive. I shall not write more than that.'],
  },
  haller: {
    XS: ['Hm.', 'I have nothing to say. Remember this day.', 'Faultless. Do not let the Guild hear of it.', 'Sister, write it down. Nobody will believe me.'],
    S: ['Passable. Very passable.', 'That would pass in Weissburg. It passes here, which is harder.', 'Clean work. Not a compliment; an observation.', 'Well. Yes.'],
    A: ['Adequate. He will walk.', 'Sound hands, slow head. Continue.', 'It holds. It is not pretty.', 'Better than the Guild deserves.'],
    B: ['Clumsy in places. Alive in all of them.', 'He will live to complain of the scar.', 'A butcher’s stitch here and there. Acceptable.', 'You were lucky. Luck is not a method.'],
    C: ['He lives, and that is the whole of my praise.', 'Barely. Learn from it.', 'That was nearly a funeral. Next time, sooner.', 'Alive. We will speak of the rest tomorrow.'],
  },
  mauer: {
    XS: ['Oswy’s wheel. Put that on the council’s bill.', 'I have counted a lot of things. Never that.', 'Fit to march, fit to dance. Well done.', 'If you could do that to the council we would all be paid.'],
    S: ['He will march by Friday. Good.', 'Clean. The mules were impressed.', 'Sound work. I shall say so in the roll.', 'That is a soldier again, not a sack.'],
    A: ['He will march. That is the mark I wanted.', 'Good enough for the Grauwald.', 'Whole and closed. Forty men.', 'Well done. Next.'],
    B: ['He will limp. Limping marches.', 'Rough, but he is on the roll, not the letter.', 'It held. The council pays for held.', 'Alive. The rest is a week’s rest.'],
    C: ['He lives. I shall not write how.', 'That was close, Doctor. Too close for the roll.', 'Alive. Barely fit to be carried.', 'We keep him. We nearly did not.'],
  },
  examiner: {
    XS: ['Beyond the marking scheme.', 'Flawless. Recorded.', 'No marks deducted.', 'A model answer.'],
    S: ['Distinction.', 'Excellent. Recorded.', 'First class.', 'Very few marks lost.'],
    A: ['Merit.', 'A good pass.', 'Upper second.', 'Solid work.'],
    B: ['Pass.', 'Adequate. Recorded.', 'Lower second.', 'Passed, with remarks.'],
    C: ['Bare pass.', 'Survived. Only just.', 'Third class.', 'Passed on appeal.'],
  },
  stroh: {
    XS: ['Remarkable. I have written “remarkable” twice.', 'Faultless. I note the hour.', 'A perfect recovery. I shall want to know how.', 'Nobody moved. Not even you.'],
    S: ['Very fine. I have that in my notes.', 'Skilful. Skill always has a sponsor.', 'Clean work, Doctor. I watched every stroke.', 'Well done. I mean it as plainly as I can.'],
    A: ['Competent. Nothing to report. Yet.', 'Good work, by ordinary lights.', 'He lives. I record it as ordinary.', 'Sound. No candle was troubled.'],
    B: ['Ordinary. Which is to say, unremarkable.', 'He lives. Nothing here for the Tribunal.', 'Adequate. I note nothing.', 'Rough. Reassuringly so.'],
    C: ['He lives. Barely counts as evidence.', 'A hard case. Nothing unnatural in it.', 'Nothing to note. That is a mercy for you.', 'Alive. I have seen worse from the Guild.'],
  },
};

// ------------------------------------------------------------------ picking (NAR-0077)

const HISTORY = new Map<string, string[]>();
/** A line is not repeated within this many fires of its trigger. */
export const NO_REPEAT_WINDOW = 3;

/** Forget what has been said (call at the start of every operation). */
export function resetBarkHistory(): void {
  HISTORY.clear();
}

/**
 * Pick a line from `lines` for the history key `key`, never one of the last three picked for that
 * key (or the last n − 1 when the set is small). `rng` is a unit-interval source; cosmetic only.
 */
// eslint-disable-next-line no-restricted-properties -- presentation-only choice; the simulation never reads it
export function pickLine(key: string, lines: readonly string[], rng: () => number = Math.random): string | undefined {
  if (!lines.length) return undefined;
  const recent = HISTORY.get(key) ?? [];
  const window = Math.min(NO_REPEAT_WINDOW, lines.length - 1);
  const banned = window > 0 ? recent.slice(-window) : [];
  const pool = lines.filter((l) => !banned.includes(l));
  const line = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
  recent.push(line);
  if (recent.length > NO_REPEAT_WINDOW) recent.splice(0, recent.length - NO_REPEAT_WINDOW);
  HISTORY.set(key, recent);
  return line;
}

/** A bark for `speaker` on `trigger`, obeying the anti-repeat rule; undefined if they have none. */
// eslint-disable-next-line no-restricted-properties -- presentation-only choice; the simulation never reads it
export function pickBark(speaker: BarkSpeaker, trigger: BarkTrigger, rng: () => number = Math.random): string | undefined {
  return pickLine(`${speaker}:${trigger}`, BARKS[speaker][trigger] ?? [], rng);
}

/** A patient's line for the op, if they have one for that moment. */
// eslint-disable-next-line no-restricted-properties -- presentation-only choice; the simulation never reads it
export function pickPatientBark(opId: string, trigger: PatientTrigger, rng: () => number = Math.random): string | undefined {
  return pickLine(`patient:${opId}:${trigger}`, PATIENT_BARKS[opId]?.[trigger] ?? [], rng);
}

/** A whisper from the Hour, in order of phase (wraps), never the same line twice running. */
// eslint-disable-next-line no-restricted-properties -- presentation-only choice; the simulation never reads it
export function pickWhisper(hour: keyof typeof MALISON_WHISPERS, rng: () => number = Math.random): string {
  return pickLine(`whisper:${hour}`, MALISON_WHISPERS[hour], rng)!;
}

/** The rank-card quip for this op's speaker and rank. */
// eslint-disable-next-line no-restricted-properties -- presentation-only choice; the simulation never reads it
export function rankQuip(opId: string, rank: Rank, rng: () => number = Math.random): string {
  const speaker = speakerFor(opId);
  return pickLine(`quip:${speaker}:${rank}`, RANK_QUIPS[speaker][rank], rng)!;
}

/**
 * Whisper-band barks (NAR-0166): after the star is drawn when the city already Suspects or Accuses
 * Kreuzer, Ilse (or Stroh, where he watches) remarks on what the witnesses will make of it.
 */
export const WHISPER_BAND_BARKS: Record<'suspected' | 'accused', Record<'ilse' | 'stroh', readonly [string, string]>> = {
  suspected: {
    ilse: ['Again, Doctor? There are people at the door who count.', 'Close the shutter first, next time. Please.'],
    stroh: ['Another candle that forgot itself. I will note the hour.', 'You do it so easily now. That is what troubles me.'],
  },
  accused: {
    ilse: ['They will say this in court, Doctor. Every word of it.', 'I did not see that. Do you hear me? I saw nothing.'],
    stroh: ['That is not a thing a man can explain to a jury, Doctor.', 'I had hoped to be wrong about you. I am so rarely wrong.'],
  },
};

/** Environment barks (NAR-0164): Ilse warns of the table's conditions as the operation opens. */
export const ENV_BARKS: Record<'rain' | 'cart' | 'candle', readonly string[]> = {
  rain: [
    'Rain through the canvas, Doctor. Every drip thins the blood — mind the pools.',
    'The roof is weeping again. Work around the wet or it will run into the cuts.',
    'Water on the table. It dilutes what you drain; count on more pools than wounds.',
    'Listen to it drum. Every few breaths another drip lands in the field.',
    'The tent leaks where the pole meets the ridge. Keep a leech ready for the puddles.',
    'Wet hands, wet field, wet everything. Slow and sure, Doctor.',
  ],
  cart: [
    'The road is rutted. The whole table will sway — aim with the swing, not against it.',
    'We are moving, Doctor. Brace your wrist on the rail; the wheels will not wait.',
    'The cart lurches every few yards. Watch the field drift and let it come back to you.',
    'Hold steady. The driver cannot slow on this stretch.',
    'Every stone in the road is in your hands now. Short strokes, Doctor.',
    'The patient rocks with the axle. Time your cuts to the lull between jolts.',
  ],
  candle: [
    'One candle, Doctor. The corners are black — bring the work to the light.',
    'The lamp oil is gone. We have this stub, and it shows only the middle of the table.',
    'Little light tonight. The lens will struggle; trust your hands where your eyes cannot go.',
    'Keep inside the candle’s circle. What is outside it may as well be in another room.',
    'I will hold the candle as close as I dare. Do not ask me to move it.',
    'The flame gutters when you breathe. Mind what hides at the edge of the field.',
  ],
};
