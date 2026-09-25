import { when } from './conditions';
import { n, say, type StoryDef } from './story';

/**
 * Post-operation micro-scenes (NAR-0038, NAR-0039, NAR-0056) and failure framing
 * (NAR-0040, NAR-0058) for the demo chapters.
 *
 * An aftermath plays after a won operation's results, before the next campaign step, so every
 * result is acknowledged before the next briefing. A failure scene plays when the patient dies,
 * before the results screen offers a retry. Neither is a campaign step: step indices, saves and
 * the demo carry-over table (src/platform/carryover.ts) are unaffected.
 *
 * Ids: `a<ch>-<n>` (aftermath of op<ch>-<n>) and `f<ch>-<n>` (failure of op<ch>-<n>); lines are
 * exported for translation as `<id>.<NNN>` like any story scene.
 */
const aftermath = (id: string, place: string, backdrop: StoryDef['backdrop'], lines: StoryDef['lines']): StoryDef => ({ id, place, backdrop, lines });

export const AFTERMATH: Readonly<Record<string, StoryDef>> = {
  'op1-1': aftermath('a1-1', 'The Hospice — after the knife-work', 'hospice', [
    n('The drover lives. He pays in turnips and a promise not to gamble again. He will break it by Friday.'),
    ...when({ rank: 'high' }, say('haller', 'Clean. Quick. Hm. Don’t let it go to your head, Kreuzer. It was simple work.')),
    ...when({ rank: 'mid' }, say('haller', 'Adequate. The Weissburg Guild would call that adequate. I call it Tuesday.')),
    ...when({ rank: 'low' }, say('haller', 'He’ll live. Eventually. I said simple work, Kreuzer. I did not say leisurely.')),
    say('kreuzer', 'Turnips, Sister?'),
    say('ilse', 'Under “fees, vegetable”. We have a column. It is the longest one in the ledger.'),
  ]),
  'op1-2': aftermath('a1-2', 'The Hospice — after the barbed shaft', 'hospice', [
    n('Pieter will keep his side, and his opinion of the horned folk.'),
    say('mauer', 'Twelve. Twelve walking. The Watch pays its debts, Doctor. Slowly, but it pays.'),
    ...when({ rank: 'high' }, say('haller', 'You nicked those barbs like a tailor. Where did Weissburg find the time to teach you that?')),
    ...when({ rank: 'low' }, say('haller', 'You tore him on the second barb. He will heal. He will also remember you.')),
  ]),
  'op1-3': aftermath('a1-3', 'The Hospice — after the burst barrel', 'hospice', [
    n('Anno keeps both hands. The Guild keeps its fee. Nobody keeps the barrel.'),
    say('ilse', 'His master called. He asked whether the lead we took out of the boy could be melted down again.'),
    say('kreuzer', 'Tell him yes. Tell him it is the best-proven lead in Kessendorf.'),
    ...when({ rank: 'low' }, say('haller', 'The boy will scar. Burns remember every minute you wasted, Kreuzer. So do I.')),
  ]),
  'op1-4': aftermath('a1-4', 'The Hospice — after dark', 'night', [
    n('Matthis Kolb sleeps in a clean bed for the first time in a year. He asks Ilse to read his name back to him, twice.'),
    say('stroh', 'Buboes in winter. The pestilence is early this year, Doctor. Or it was invited.'),
    say('kreuzer', 'Fevers don’t wait for invitations, Inquisitor.'),
    say('stroh', 'In my experience, everything does.'),
  ]),
  'op2-1': aftermath('a2-1', 'The muster camp — after the gravehound', 'camp', [
    n('The scout will limp, but he will limp home.'),
    say('mauer', 'Forty. Still forty. I am starting to like you, Doctor, and I don’t care for it.'),
    ...when({ rank: 'high' }, say('ilse', 'Every tooth, and not a drop of venom left. Master Haller would pretend not to be impressed.')),
  ]),
  'op2-2': aftermath('a2-2', 'The muster camp — the supply wagon', 'camp', [
    say('patient', 'A strong arm after all. I shall name a mine for you, Doctor. The Kreuzer Deep.', 'Orsa Flintvein'),
    say('kreuzer', 'Is it a good mine?'),
    say('patient', 'It is not dug yet. It will probably be a bad one. The first ones always are.', 'Orsa Flintvein'),
    ...when({ rank: 'high' }, say('patient', 'Here. One knot, untied. You owe me nothing, and I owe you one.', 'Orsa Flintvein')),
  ]),
  'op2-3': aftermath('a2-3', 'The muster camp — after midnight', 'night', [
    n('Ilvaren wakes asking after his snares. The web-trees are left to the foresters, and to the fire.'),
    say('mauer', 'Forty, and a forager who will never set a snare again. My lads are calling you the spider-cutter.'),
    say('kreuzer', 'Tell them I have been called worse by better men.'),
  ]),
  'op2-4': aftermath('a2-4', 'The muster camp — the Inquisitor’s tent', 'camp', [
    n('The cantor breathes. The sigils on his chest are ash. Stroh’s men stand at the tent flap and do not let the Doctor leave.'),
    say('stroh', 'He lives. Good. Now he can tell me who taught him to sing.'),
    say('ilse', 'He is a patient until he walks out of this tent, Inquisitor. Then he is yours. Not one hour sooner.'),
  ]),
};

const failure = (id: string, place: string, backdrop: StoryDef['backdrop'], lines: StoryDef['lines']): StoryDef => ({ id, place, backdrop, lines });

/** One or two lines before the retry prompt. Consolation and resolve, never mockery of the dead. */
export const FAILURE: Readonly<Record<string, StoryDef>> = {
  'op1-1': failure('f1-1', 'The Hospice — the table goes still', 'hospice', [
    say('haller', 'Simple work, Kreuzer. Wash your hands. Look at the wounds again. Then do it properly.'),
  ]),
  'op1-2': failure('f1-2', 'The Hospice — the table goes still', 'hospice', [
    say('mauer', 'Eleven.'),
    say('haller', 'Free the barbs before you pull, not after. Again, Kreuzer. He is not yet cold, and neither are you.'),
  ]),
  'op1-3': failure('f1-3', 'The Hospice — the table goes still', 'hospice', [
    say('ilse', 'His pulse was fading, Doctor, and we let it fade. The tincture is there to be used.'),
  ]),
  'op1-4': failure('f1-4', 'The Hospice — the table goes still', 'street', [
    say('ilse', 'I wrote his name down. I will not write it in the other ledger. Not tonight. Again, Doctor.'),
  ]),
  'op1-5': failure('f1-5', 'The Hospice — the small hours', 'night', [
    say('haller', 'It fights, Kreuzer. It is meant to. Brand it only when it opens its eye — and remember the star.'),
  ]),
  'op2-1': failure('f2-1', 'The muster camp — the table goes still', 'camp', [
    say('mauer', 'Thirty-nine. …No. Not yet. Doctor, do it again. I’m not writing that number down.'),
  ]),
  'op2-2': failure('f2-2', 'The muster camp — the table goes still', 'camp', [
    say('ilse', 'The shards we could not see were the ones that killed her. Slower with the lens, Doctor.'),
  ]),
  'op2-3': failure('f2-3', 'The muster camp — the table goes still', 'night', [
    say('ilse', 'The sacs hatched before we lanced them. We know which ones now. Again.'),
  ]),
  'op2-4': failure('f2-4', 'The muster camp — the table goes still', 'camp', [
    say('stroh', 'His masters will be pleased. I am not. You will try again, Doctor.'),
  ]),
  'op2-5': failure('f2-5', 'The muster camp — dawn', 'camp', [
    say('ilse', 'Two voices, Doctor. Strike one and the other answers. Don’t give it time to answer.'),
  ]),
};
