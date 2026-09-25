import { when } from './conditions';
import { n, say, type StoryDef } from './story';

/**
 * Chapter III post-operation micro-scenes (NAR-0129). Full edition only: this module is reached
 * through `src/content/narrative.ts` behind `EDITION === 'full'`, so demo bundles never contain it.
 * Terce (op3-11) has none: s3-end is its aftermath.
 */
const beat = (id: string, place: string, backdrop: StoryDef['backdrop'], lines: StoryDef['lines']): StoryDef => ({ id, place, backdrop, lines });

export const LATER_AFTERMATH: Readonly<Record<string, StoryDef>> = {
  'op3-1': beat('a3-1', 'The hospice — the examining room', 'hospice', [
    n('Liesl wakes with a bandage like a crown and asks whether she may keep the bits of horn. Her mother says no. Kreuzer says yes.'),
    say('stroh', 'Two buds, cut clean. And two sigils seared away beneath them, where no certificate will mention them.'),
    say('kreuzer', 'The certificate mentions a natural growth, Inquisitor. I removed it.'),
  ]),
  'op3-2': beat('a3-2', 'The hospice — the steps', 'street', [
    n('Kaspar’s doublet goes into a basin, a scrap at a time. Ilse counts them twice and matches every thread to the hole it came from.'),
    ...when({ rank: 'high' }, say('ilse', 'Every scrap, Doctor. He’ll not be burning by Vespers. He may be dancing by Terce.')),
    ...when({ rank: ['mid', 'low'] }, say('ilse', 'I pray that was every scrap. We’ll know by Vespers, if he’s burning.')),
    say('mauer', 'Next! Three off the mill cart, Doctor, and the cart’s coming back for more.'),
  ]),
  'op3-3': beat('a3-3', 'The hospice — night', 'night', [
    n('Ute Brandt goes home lighter by a quarter-pound of lead, which Ilse weighs, wraps, and labels for the Founders’ Guild.'),
    say('haller', 'Put it in the privy basket. The Guild may send a clerk to collect its property.'),
    say('ilse', 'I have already written the receipt, Master. “One quarter-pound of lead, lightly used.”'),
  ]),
  'op3-4': beat('a3-4', 'The hospice — the steps, evening', 'street', [
    n('Jannik, Old Rudi and Wenzel lie in a row on the hospice steps, wrapped in one blanket, arguing about whose fault the magazine was.'),
    say('mauer', 'Three off the table and three still talking. That’s a good count for the Kilnrows.'),
    say('kreuzer', 'Keep them talking, Captain. A man complaining is a man breathing.'),
  ]),
  'op3-5': beat('a3-5', 'The Iron Bridge — the Watch hut', 'street', [
    n('Berthold wakes to find his leg gone and his cart-horse tethered outside the window, which he says is the right way round.'),
    say('patient', 'A peg and a cushion, you said. I’ll hold you to the cushion, Doctor.', 'Berthold'),
    say('mauer', 'The council has sent a clerk to ask who will pay for the bridge-chain he bent. I sent the clerk away. Twice.'),
  ]),
  'op3-6': beat('a3-6', 'The quarantine side — the Penny Stair', 'street', [
    n('Forty-one worms, whole, in a jar. Gottfried the pie-man is asked to look at it, and does, and is quiet for a while.'),
    say('patient', 'Eel. They told me it was eel.', 'Gottfried, pie-man'),
    say('ilse', 'Then someone owes Frieda an apology, Gottfried, and you owe the city a new recipe.'),
  ]),
  'op3-7': beat('a3-7', 'The quarantine ward — before dawn', 'night', [
    n('Mother Agathe of the Grey Beguines sits up at the fourth bell and demands her beads, her boots, and a list of the other sick.'),
    say('patient', 'You lance like a Beguine, boy. That is the highest praise I have. Now go and do it to someone else.', 'Mother Agathe'),
  ]),
  'op3-8': beat('a3-8', 'The quarantine ward — dawn', 'night', [
    n('Brother Ansgar sleeps face-down with his hands open. The nails are in a bowl beside him. He has not asked for them back.'),
    say('ilse', 'He asked me whether a debt can be paid by someone else. I told him the Order thinks so. I hope it does.'),
    say('kreuzer', 'Let him sleep, Sister. We can argue theology when his back has closed.'),
  ]),
  'op3-10': beat('a3-10', 'The Hall of Records — morning', 'chapel', [
    n('The Registrar’s skin is clean. The roll of the dead is the right length again, and every name on it had a family to miss it.'),
    say('patient', 'I read the names of strangers, Doctor. People who had not died. Did they… will they?', 'Registrar Tallert'),
    say('kreuzer', 'Not from anything you read, Registrar. Go home. Read something with a happy ending.'),
    say('stroh', 'The names stopped when you touched him, Doctor. I noticed. I notice things.'),
  ]),
  'op3-9': beat('a3-9', 'The hospice — past midnight', 'night', [
    n('The Inquisitor sits with a cloth to his jaw and his tooth in a twist of paper, which he pockets like evidence.'),
    ...when({ rank: 'high' }, say('stroh', 'That was… gentle, Doctor. I had been told barbers enjoy it. I shall have to revise the Tribunal’s view of your trade.')),
    ...when({ rank: ['mid', 'low'] }, say('stroh', 'The root came out in two pieces. So, very nearly, did I. We shall say no more of it.')),
    say('kreuzer', 'Rinse with salt, Inquisitor. And ask your questions in daylight.'),
  ]),
};
