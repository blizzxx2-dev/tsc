/**
 * Chapters III–V barks (NAR-0162, NAR-0165): Orsa Flintvein as an observer, Master Haller by letter
 * (read out at the start of the Chapter IV field operations), and a voice for every named patient of
 * the late chapters. Merged into the tables in barks.ts; the same taxonomy and cooldowns apply.
 */
import type { BarkTrigger, PatientTrigger } from './barks';

/** Orsa Flintvein: loud, practical, pays her debts; at the table for her delvers and while Ilse is down. */
export const ORSA: Record<BarkTrigger, readonly string[]> = {
  'op-start': [
    'Cut where it’s soft, stop where it’s rock. That’s mining and surgery both.',
    'I’ve held a lamp over worse. Mind, the worse was a seam, and it didn’t bleed.',
    'Begin. I’ll call out what I see. Loudly. It’s the only way I know how to call.',
  ],
  cool: ['Clean! Like a good pick-stroke — one, and done.', 'That’s a proper cut. I’d hire you for the face.', 'Neat as a pit-prop. Do it again.'],
  good: ['That’ll hold. Most things hold, if you don’t ask too much of them.', 'Good enough. Not pretty; sound.', 'Fair. Keep going, he’s not done.'],
  bad: ['Ooh. That went sideways. Steady the hand.', 'Rough! I’ve seen gentler work with a hammer.', 'Easy, surgeon — he’s not a vein of flint.'],
  miss: ['Nothing there but air, surgeon.', 'Missed. He’s bleeding over here.', 'Wrong gallery. Look where I’m pointing.'],
  'combo-5': ['Five clean. I’d buy you a drink if the tavern was still standing.', 'Five. I’m counting, the way the Captain does.', 'Five in a row. Keep that rhythm.'],
  'combo-10': ['Ten! I’m naming a shaft after that.', 'Ten clean. The delvers would sing about it, if they sang.', 'Ten. Don’t stop now, you’ll jinx it.'],
  'combo-20': ['Twenty. I’ve never seen a thing done twenty times right. Not even beer.', 'Twenty clean! Somebody write that on a wall.', 'Twenty. I take back what I said about surgeons.'],
  'vitals-30': ['He’s going grey as tailings, surgeon.', 'Colour’s leaving him. Do the red bottle thing.', 'He’s sinking. Whatever you do fast, do it now.'],
  'vitals-15': ['Surgeon! He’s nearly gone!', 'That’s a dead man’s colour. Bottle, now!', 'Don’t you lose him. I’ve lost enough to rock.'],
  tincture: ['There — he’s pinking up. Good.', 'Better. Whatever that was, I want a crate.', 'Back from the edge. Keep him there.'],
  litany: ['…The lamp stopped flickering. Don’t tell me what that was. I don’t want to know.', 'Everything went quiet. Even me.', 'Hm. The flame stood still. I saw that.'],
  phase: ['Next! What’s next?', 'On to the next seam, surgeon.', 'Right. What else is in there?'],
  enraged: ['It’s angry now. Good — angry things make mistakes.', 'It’s fighting back! Hit it harder.', 'It knows you’re winning. Keep at it.'],
  success: ['Alive! I owe you another mine.', 'Done, and breathing. That’s a good day’s digging.', 'He lives. I’ll tie a knot in my beard for you. Someone’s beard.'],
  fail: ['…He’s gone. Cover him. I’ll say his name at the pithead.', 'Lost him. The rock takes who it takes, surgeon. So does this.', 'He’s gone. You did what you could. I saw.'],
  idle: ['Surgeon? He’s waiting.', 'Don’t stand there like a pit-pony. Cut.', 'Surgeon — the clock!'],
  'time-30': ['Not much time, surgeon. Close him up.', 'Glass is nearly run! Finish it.', 'Time’s short. Close, and we’ll argue after.'],
};

/** Master Haller by letter (NAR-0162): Ilse reads a line of his latest before a Chapter IV field operation. */
export const HALLER_LETTER: readonly string[] = [
  'Haller writes: “Field work is surgery in the rain. Dry your hands before every cut.”',
  'Haller writes: “An army brings you ten at once. Save the one who can be saved first.”',
  'Haller writes: “A soldier who says it does not hurt is either lying or dying.”',
  'Haller writes: “Boil the thread. Boil the knives. Boil the Sister, if she lets you.”',
  'Haller writes: “The mud gets in everything. So will you, if careless. Salve twice.”',
];

/** The late chapters' patients (NAR-0165), keyed by operation id. */
export const PATIENT_BARKS_LATER: Record<string, Partial<Record<PatientTrigger, readonly string[]>>> = {
  'op3-1': {
    'first-cut': ['Mama said you have gentle hands. Are they gentle?', 'Will it hurt? Mama said to be brave.'],
    pain: ['Ow — you said it wouldn’t —'],
    extract: ['Is it gone? Can I see it?'],
    relief: ['…It doesn’t press any more. Thank you, Doctor.'],
  },
  'op3-2': {
    'first-cut': ['I was on the gate. I never even saw the flash.', 'Get the ball out. I can feel it sitting in there.'],
    extract: ['Is that my doublet? That’s my good doublet.'],
    pain: ['Christ’s wounds — the cloth, it’s pulling —'],
    closing: ['Will I walk the gate again, Doctor?'],
  },
  'op3-4': {
    'first-cut': ['Me first — no, Rudi first, he’s older —', 'The mill went up like a bell ringing.'],
    pain: ['Wenzel? Is Wenzel breathing?', 'Burns — everything burns —'],
    relief: ['…Thank you. All three of us thank you.'],
    closing: ['We’ll not go back to that mill. Not ever.'],
  },
  'op3-3': {
    'first-cut': ['It’s the lead. Every founder gets it in the end.', 'My belly aches like a cracked bell.'],
    pain: ['The cramp — it wrings me out —'],
    relief: ['…It eases. It hasn’t eased in a month.'],
    closing: ['Don’t tell the Guild I’m poorly. They’ll give my furnace away.'],
  },
  'op3-5': {
    'first-cut': ['The crow had a beak like a nail. I swear it aimed.', 'Do it quick, Doctor. I’ve a cart to drive.'],
    extract: ['That came out of me? That crow was a devil.'],
    pain: ['Saints, the eye — mind the eye —'],
    closing: ['Can I drive tomorrow? The horse won’t wait.'],
  },
  'op3-6': {
    'first-cut': ['It was the pie. I knew it was the pie.', 'Something’s moving in there, Doctor. It isn’t me.'],
    extract: ['A worm! A worm in the pie! I’ll have the pieman’s licence.'],
    pain: ['It’s wriggling — make it stop wriggling —'],
    relief: ['…Still. It’s gone still. Thank the Saint.'],
  },
  'op3-7': {
    'first-cut': ['I have nursed plague for sixty years, child. Lance it; I shall not flinch.', 'The Beguines will pray for your hands.'],
    pain: ['Hm. That one I felt.'],
    relief: ['Ah. Sixty years, and this is the first time someone has nursed me.'],
    closing: ['Go and see to the Rows. I shall manage.'],
  },
  'op3-8': {
    'first-cut': ['Mortify it. The flesh deserves no mercy.', 'I scourged myself for the city’s sins. Do not heal them away.'],
    pain: ['Yes. Good. Pain is a prayer.'],
    relief: ['…Why does it not hurt? I asked it to hurt.'],
    closing: ['You have taken my penance from me, Doctor. What shall I carry now?'],
  },
  'op3-9': {
    'first-cut': ['Mmh — gently, Doctor. I remember everything.', 'I have questions. Open your ears while I open my mouth.'],
    pain: ['MMF. Noted. That is noted.', 'Nnh — your hand slipped, or your mind did.'],
    extract: ['…Is that it? It is smaller than it felt.'],
    relief: ['Ahh. I may forgive you. Not yet.'],
  },
  'op3-10': {
    'first-cut': ['The names — they’re still writing, I can feel the quill —', 'Strike them out, Doctor. I cannot bear to read my own skin.'],
    pain: ['There’s another — a child’s name — oh, God —'],
    relief: ['…The quill has stopped. I can feel it stop.'],
    closing: ['I must copy the roll again. From memory. Every name.'],
  },
  'op3-11': {
    'first-cut': ['Well, boy? Cut. I taught you how; do it properly.', 'The fire’s in my chest. Get it out before it reaches my hands.'],
    pain: ['Pah! I have had worse from a pupil. From you, in fact.'],
    relief: ['…Hm. Not bad. I shan’t say good.'],
    closing: ['My hands, Kreuzer. Save my hands.'],
  },
  'op4-1': {
    'first-cut': ['Orc hide is thick. Cut like you mean it, little surgeon.', 'Quarrel at the gorget. Our own. Stupid.'],
    extract: ['Ha! Out. I keep that one. For luck.'],
    pain: ['Grr — you tickle, surgeon.'],
    closing: ['Ostrau pays double for me. You tell them I’m worth it.'],
  },
  'op4-10': {
    'first-cut': ['Him first. He’s got a family. See to him.', 'Two cots, one surgeon. The Captain always did count short.'],
    pain: ['Ahh — is he breathing? The other one?'],
    relief: ['…We both made it? Both of us?'],
    closing: ['I’ll carry him back myself if I have to.'],
  },
  'op4-2': {
    'first-cut': ['A boar and a mule, in one morning. The road hates me.', 'Tusk went in, hoof came down. In that order.'],
    extract: ['That’s the tusk? Keep it. I’ll make a dagger.'],
    pain: ['Ow! The hoof bit was worse, I swear it.'],
    closing: ['I’ll guard the convoy tomorrow. From the wagon.'],
  },
  'op4-3': {
    'first-cut': ['Crystal in the lungs. It rattles when I laugh.', 'Mind the beard. Every knot is a debt.'],
    pain: ['Hhh — it grinds. Like a stone in a sack.'],
    relief: ['I can breathe. Orsa, I can breathe!'],
    closing: ['I owe you a knot, surgeon. Pick a strand.'],
  },
  'op4-4': {
    'first-cut': ['I did not swallow the box. The box went in by itself.', 'Big man, big belly. Cut big.'],
    extract: ['My pay! That was my pay in there!'],
    pain: ['OOF. Giants feel it too, little doctor.'],
    closing: ['Do not tell the sergeant about the box.'],
  },
  'op4-5': {
    'first-cut': ['…', '…the dark is… so kind…'],
    pain: ['…ah…'],
    relief: ['— I— breathe? I breathe. Where am I?'],
    closing: ['Who… who pulled me back?'],
  },
  'op4-6': {
    'first-cut': ['Gently. He is always gentle.', 'Close the bites. Leave the rest to me.'],
    pain: ['Hh. You are not him.'],
    relief: ['…It is quiet. I had forgotten quiet.'],
    closing: ['Whatever you chose — thank you for asking me first.'],
  },
  'op4-8': {
    'first-cut': ['My hand went cold at the altar. Then it went grey.', 'I was to be married today. Is it still today?'],
    pain: ['It cracks — I can hear it crack —'],
    relief: ['…I can move my fingers. I can move them!'],
    closing: ['Tell him to wait. Tell him I’ll still come.'],
  },
  'op4-7': {
    'first-cut': ['All quiet, Doctor. All quiet. Report all quiet.', 'Thirty-five men. I have to count them. Let me count.'],
    pain: ['Stone… in my chest. Is it noon? It feels like noon.'],
    relief: ['…Thirty-five. Thirty-five. I can count again.'],
    closing: ['Close me up. The men will want to see me standing.'],
  },
  'op4-9': {
    'first-cut': ['Something’s crawling, Doctor. From the old wound. Toward my heart.', 'The ninth hour. It keeps saying the ninth hour.'],
    pain: ['It bit — inside — it bit —'],
    relief: ['…It’s gone. I can feel it gone.'],
    closing: ['Tell the Captain I held. Tell him I held.'],
  },
  'op3-12': {
    'first-cut': ['No cut? Good. I’ve seen what you do with the knife.', 'The horse didn’t mean it. It was the bang.'],
    pain: ['Gahh — that’s the leg you’re pulling, not a rope!'],
    relief: ['Oh. Oh, that’s — it’s straight. I can feel it’s straight.'],
    closing: ['Tell the yard I’ll be back. Tell the horse too.'],
  },
  'op3-13': {
    'first-cut': ['Don’t look at the bone. I’ve looked. Don’t.', 'Two storeys. The timber gave. It wasn’t my footing.'],
    pain: ['Hnnh — mind the wrist, that’s my trowel hand —'],
    extract: ['Was that a bit of me? Keep it. I don’t want it.'],
    closing: ['Tell the bridge-master I’ll want a word. When I can hold one.'],
  },
  'op4-11': {
    'first-cut': ['It was drill, Doctor. Just drill. He swung wide.', 'Don’t tell the captain I cried out.'],
    pain: ['Ahh — the shoulder — pull the other way, the other way!'],
    relief: ['That clicked. Is it meant to click?'],
    closing: ['Bind it tight. I’m on the line in a week, whatever you say.'],
  },
  'op5-10': {
    'first-cut': ['Gently. Please. They were not gentle.', 'I wrote their warrants for eleven years. Mine was in another hand.'],
    pain: ['Ah — the screws — no, it’s you, it’s only you. Go on.'],
    relief: ['I can feel the thumb. I thought I never would.'],
    closing: ['I will write again, Doctor. And I know what I will write.'],
  },
  'op5-5': {
    'first-cut': ['Hexstone shot. They fired it at us from the procession.', 'I held the line on the Penny Stair. Get it out.'],
    extract: ['That’s it? It’s humming. Why is it humming?'],
    pain: ['Hnn — it’s whispering to me —'],
    closing: ['Put me back on the line, Doctor. Hollow Night isn’t over.'],
  },
  'op5-1': {
    'first-cut': ['…light the lamp… and let it… no, that isn’t me singing —', 'Make it stop, Doctor. I want my own voice.'],
    pain: ['…ahhh… AHHH… no, stop, stop singing —'],
    relief: ['…Is that — is that my voice? It’s mine!'],
    closing: ['Will I sing again? My own songs?'],
  },
  'op5-2': {
    'first-cut': ['It talks, Doctor. It talks when I sleep.', 'Cut it out. Don’t listen to it.'],
    pain: ['It’s laughing — can you hear it laughing?'],
    extract: ['Is it out? Whole? It said it would burst.'],
    relief: ['…Silence. God, silence.'],
  },
  'op5-3': {
    'first-cut': ['My blood’s gone thick, Doctor. Like the wax in Da’s shop.', 'I smell tallow on my own breath.'],
    pain: ['It drags — everything drags —'],
    relief: ['…It runs again. I can feel it run.'],
    closing: ['Da will want to know. Tell him the candles didn’t get me.'],
  },
  'op5-4': {
    'first-cut': ['The baby — save the baby first —', 'Under the Hollow Moon. Of course it had to be tonight.'],
    pain: ['Mother of God — it’s coming —'],
    relief: ['…Is that crying? Is that my baby crying?'],
    closing: ['Her name is — I want to name her after the Sister.'],
  },
  'op5-6': {
    'first-cut': ['The lamps, Doctor — keep the lamps —', 'I can hear the evening office. It’s beautiful. Don’t let me go to it.'],
    pain: ['Ah — it pulls, it pulls me to the light —'],
    relief: ['…The lamps are lit. I can see them.'],
    closing: ['Ledger… write it in the ledger… we did not lose me.'],
  },
  'op5-7': {
    'first-cut': ['He sewed every Hour into me, Doctor. Every one.', 'Ink, fire, and something burrowing. Get them out in that order.'],
    pain: ['The fire’s back — no, the ink —'],
    relief: ['…One Hour gone. Just one. It’s enough to breathe.'],
    closing: ['He’s below. The Precentor. Go.'],
  },
  'op5-8': {
    'first-cut': ['…so quiet… let me sleep, Doctor… let me…', '…a perfect end… it promised a perfect end…'],
    pain: ['…no… not yet… I had not finished…'],
    relief: ['…Loud. Everything is loud again. Good.'],
    closing: ['…I am still here. Why am I still here? …Thank you.'],
  },
  'op5-9': {
    'first-cut': ['Cut, Kreuzer. Haller’s last pupil. Cut, and hear the whole Office.', 'You would save me too. Of course you would.'],
    pain: ['There — you hear it? Every Hour at once.'],
    relief: ['…Silence. Is this what you meant? Waking up?'],
    closing: ['Close me, then. I will live with it. Everyone else has to.'],
  },
};
