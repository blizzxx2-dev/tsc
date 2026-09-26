/**
 * Chapters III–V in the codex (NAR-0169): the late afflictions, places, the Choir's ranks and the
 * people Kreuzer meets after the demo, and the six remaining Hours in full. Every entry is a
 * silhouette until its operation or scene: the title shows in the book, the page stays blank.
 */
import type { CodexCategory, CodexEntry, CodexUnlock } from './codex';

const op = (id: string): CodexUnlock => ({ kind: 'op', op: id });
const opS = (id: string): CodexUnlock => ({ kind: 'op', op: id, rank: 'S' });
const story = (id: string): CodexUnlock => ({ kind: 'story', story: id });
const chapter = (n: number): CodexUnlock => ({ kind: 'chapter', chapter: n });

const page = (id: string, title: string, category: CodexCategory, unlock: CodexUnlock, body: string, more?: CodexEntry['more']): CodexEntry => ({
  id,
  title,
  category,
  unlock,
  body,
  image: `wc-${id}`,
  silhouette: true,
  ...(more ? { more } : {}),
});

/** The six remaining Hours (replacing their locked stubs) and the Office they make together. */
export const LATE_HOURS: CodexEntry[] = [
  page('prime', 'Prime', 'The Hours', op('op3-10'), 'The first hour of work, when the roll is read. In Registrar Tallert it was a quill that wrote the plague dead across his skin, a stroke at a time, newest name uppermost. Strike each name out with the lancet, newest stroke first; when a name is gone the quill falters, and only then will the brand take it. It writes the names of the Doctor’s own lost patients first, if it can find them.', {
    unlock: opS('op3-10'),
    body: 'Do not chase the quill. Unwrite the names and it comes to you, empty-handed.',
  }),
  page('terce', 'Terce', 'The Hours', op('op3-11'), 'The third hour, when the fire came down at Pentecost. In Master Haller it was hexfire in three organs at once, a front that leapt between them and a root that fed it. Salve the front to hold it; cut the root to end it; never the brand, which it eats. It burned the Guildhall first, with the vote still uncounted.', {
    unlock: opS('op3-11'),
    body: 'Roots before fronts, once the fronts are held. A root left standing lights the next organ within the minute.',
  }),
  page('sext', 'Sext', 'The Hours', op('op4-7'), 'Noon, the hour of the demon of acedia: the torpor that says all is well. In Captain Mauer it was stone crusting over the organs while the vitals read calm, and a sluggishness that crept into the surgeon’s own hands. Chip the crust with the lancet and brand what lies under it; take the tincture when the hands slow. The false calm on the monitor is part of the curse.'),
  page('none', 'None', 'The Hours', op('op4-9'), 'The ninth hour, when the old books say the heart of the world stopped. In Pieter it was a burrower that came in with an old arrow wound and tunnelled for the heart, segment by segment. The lens finds its head; a cut across it and the brand end it. Every segment left behind is a small burrower of its own.'),
  page('vespers', 'Vespers', 'The Hours', op('op5-6'), 'The lamp-lighting office, sung as the day fails. In Sister Ilse it ran wick-filaments through the vessels and turned the blood to tallow, and the ward’s lamps died with her. A wick shows only in lamplight; relight a lamp with the brand, cut the wick across, soften the tallow and draw it off. She heard it sing, and wanted to follow it.'),
  page('compline', 'Compline', 'The Hours', op('op5-8'), 'The last office, the prayer for a quiet night and a perfect end. It wore the earlier Hours like masks, stole the Litany and turned the stillness on the surgeon’s own hands, and at the end would yield only to two instruments together: the lancet to open, the brand within a breath. Its silence is not peace. The patient smiles all the way down.'),
  page('office', 'The Office', 'The Hours', op('op5-9'), 'All eight Hours at once, sung into one man who wrote them: Aurel Vennholt, the Precentor. A clock-face of eight sigils burned into his skin, each an Hour that must be unsung in its own manner, then pairs of them in unison, then the heart. The Doctor could have let it end in him. He called him a patient instead, and put him on the table.'),
];

/** The late chapters' afflictions. */
export const LATE_AFFLICTIONS: CodexEntry[] = [
  page('horn-buds', 'Horn-Buds', 'Afflictions', op('op3-1'), 'Bone pressing through the scalp of a child, over a Choir sigil. Whether they grow of themselves, as the horned folk’s do, or are sung into a human child, the bone cannot say; only the age of it can. The Doctor wrote one certificate for Liesl, and it decided her life.'),
  page('cloth-wadding', 'Wadding in the Wound', 'Afflictions', op('op3-2'), 'A ball carries whatever it passes through into the body: doublet, shirt, the lining of a purse. Every scrap festers. The lens finds them by their weave against the flesh; the tongs lift them; a wound closed over one scrap is a fever by Vespers.'),
  page('blast-wounds', 'Blast Wounds', 'Afflictions', op('op3-4'), 'A powder-mill going up throws men, timber and iron in every direction at once. Three patients on one timer, each bleeding differently; the surgeon moves between them and the clock never stops. Save the one who will die without you first.'),
  page('lead-colic', 'Founder’s Colic', 'Afflictions', op('op3-3'), 'Lead from the furnaces lodges in the gut as grey veins the lens can see. The chelating tincture dissolves them; the leech-pipe draws off the grey bile they leave. Every founder gets it in the end, they say. The Guild calls it a trade complaint and pays nothing for it.'),
  page('crow-beak', 'The Crow’s Beak', 'Afflictions', op('op3-5'), 'Carrion birds in the Kilnrows grow bold on plague-pit leavings, and a carrion crow will go for a carter’s eye. The beak breaks off like a nail. Draw it along its own line, and mind the eye.'),
  page('pie-worm', 'The Pieman’s Revenge', 'Afflictions', op('op3-6'), 'A worm from bad pie-meat that lives in the gut and grows back what the lancet takes. Cut it in segments from the tail, brand each stump before it regrows, and do not argue with the pieman afterwards; he has a cleaver.'),
  page('flagellant-back', 'The Flagellant’s Back', 'Afflictions', op('op3-8'), 'The penitents scourge themselves through the streets for the city’s sins, and their backs go bad under the ash they rub in. Clean, salve and close; they will ask you not to. A mercy they did not ask for is still a mercy, the Sister says. The Doctor is less sure.'),
  page('rotten-molar', 'The Rotten Molar', 'Afflictions', op('op3-9'), 'An abscess over a rotten lower molar. Lance and drain the abscess, then rock the tooth three times with the tongs before you draw it, or the root breaks and stays. The patient in the chair will ask questions throughout. The most hated avocation in the Guild, and not for the teeth.'),
  page('hexfire', 'Hexfire', 'Afflictions', op('op3-11'), 'Fire that burns inside the body and rekindles unless its ember is branded out before the salve. It was Terce’s weapon at the Guildhall; the burns it left in Master Haller’s hands went to the bone. Eschar off, salve, stitch the splits.'),
  page('gorget-bolt', 'A Quarrel at the Gorget', 'Afflictions', op('op4-1'), 'A crossbow bolt lodged at the throat, beside the great artery. Clamp the artery with the tongs before you draw the bolt, or the patient empties like a cask. Orc hide is thick as a saddle: slow, firm strokes, or the lancet skates.'),
  page('tusk-gore', 'Tusk and Hoof', 'Afflictions', op('op4-2'), 'Road wounds: a boar’s tusk, then a mule’s hoof on the same guard in one morning. The tusk-wound is deep and dirty; the hoof-wound is broad and bruised. Drain the mud before the salve, or it festers under the dressing.'),
  page('delvers-lung', 'Delver’s Lung', 'Afflictions', op('op4-3'), 'Crystal dust from the deep seams grows into nodules in a delver’s lung, and they harden as they age. Crack them early with the lancet; a late one needs the brand first. And never cut the beard: every knot in it is a debt, and a dwarf who dies owing is not buried.'),
  page('strongbox', 'The Swallowed Strongbox', 'Afflictions', op('op4-4'), 'A giant can swallow a pay-chest whole, and the lock goes on working inside him. Three pins, turned with the tongs against the gut’s own rhythm; a slip costs time. The company clerk will want the chest back. The giant will want his pay.'),
  page('bite-trance', 'Bite-Trance', 'Afflictions', op('op4-5'), 'The bite of the thing that drinks leaves fang fragments in the neck and stills the heart to a beat a minute: not death, only its likeness. Pull every fragment under the lens, then restart the heart with the tincture, on the beat and only on it. The Tribunal burns such patients as corpses that will not lie still.'),
  page('blood-thrall', 'The Thirsted Neck', 'Afflictions', op('op4-6'), 'The same bite, again and again, on the same side of the neck: a bond between the drinker and the drunk. Brand the channel and the bond burns away; salve it and it stays. It is her neck, and her choice, and the Doctor made one of them.'),
  page('petrification', 'The Stone Bride', 'Afflictions', op('op4-8'), 'Stone that spreads from the fingertips inward, hand, then arm, then chest, crusted in plates that crack free with the tongs. Halt the front with the tincture before you crack a plate, or it only spreads behind you. Sext’s cousin, the Sister calls it; she does not say which side.'),
  page('hexstone-shot', 'Hexstone Shot', 'Afflictions', op('op5-5'), 'On Hollow Night the procession fired hexstone at the Watch. The shot whispers once it is in the body, and louder in the tongs. Brand it still, carry it straight to the lead dish, and do not stop to listen.'),
  page('choir-throat', 'Choir-Throat', 'Afflictions', op('op5-1'), 'Extra vocal folds grown in a chorister’s throat, humming with the procession’s hymn. While they sing the surgeon can hear nothing; cut in the silences between verses. The boy asked for his own voice back. He has it.'),
  page('talking-cyst', 'The Mouth Beneath', 'Afflictions', op('op5-2'), 'A cyst in the belly that talks, and knows the Doctor’s secrets. It must come out whole; cut all the way round it, clear of the wall, and never touch it with the blade. Burst, it lets out something that crawls. Whole, it only threatens.'),
  page('tallow-blood', 'Blood of Tallow', 'Afflictions', op('op5-3'), 'Blood thickening to wax in the vessels, the way Vespers would turn a whole city’s. Soften the clots with the salve and draw them off with the leech-pipe before they set. A chandler’s daughter caught it first; the candles in her father’s shop would not light.'),
  page('hollow-moon-labour', 'Under the Hollow Moon', 'Afflictions', op('op5-4'), 'A labour on Hollow Night, with the Choir’s hymn in the street outside and something in the room that wanted the child. Two patients, one table, and the surgeon working for both. The mother named the girl after the Sister.'),
  page('wound-fever', 'Wound-Fever', 'Afflictions', chapter(3), 'Anything left in a wound when it is closed — cloth, a splinter, a fragment of fang — becomes a fever within the hour. The patient burns; the surgeon keeps him alive through it with the tincture until it breaks or he does. The cure is not to close too soon.'),
];

/** Places of the late chapters. */
export const LATE_PLACES: CodexEntry[] = [
  page('kilnrows', 'The Kilnrows', 'Places', story('s3-3'), 'The foundry quarter: bell-founders, gunsmiths, the powder-mill on Saltpetre Lane. The air tastes of lead and the gutters run grey. When the mill went up at noon the hospice windows bowed inward and, politely, stayed whole.'),
  page('guildhall', 'The Guildhall of the Barber-Surgeons', 'Places', story('s3-9'), 'Where the Guild met to strike the Doctor from its rolls, and where Terce came down in fire before the vote was counted. It is ash now. The Guild meets in the back room of the Crooked Goose until it is rebuilt, which suits several members.'),
  page('vennmark', 'The Vennmark', 'Places', story('s4-1'), 'The marsh-marches east of Kessendorf, where the city hires its wars. Four days’ march; rain for three of them. Forty-one of the Watch went out with the Ostrau companies. Thirty-five came back.'),
  page('tribunal-court', 'The Tribunal Court', 'Places', story('s5-2'), 'The old hall of the Ash Tribunal, where the Doctor was tried, and the cellars under it, cut into rock so old the walls are thin. Orsa’s tunnel came out under the cells. The Choir had got there first.'),
  page('cathedral', 'The Cathedral Steps on Hollow Night', 'Places', story('s5-5'), 'On Hollow Night the Choir’s procession climbed the cathedral steps singing, and the city came out to listen. A chorister boy sang in a voice that was not his own. The Watch held the Penny Stair with hexstone shot in its ranks.'),
];

/** The Choir's ranks and the companies of the late chapters. */
export const LATE_ORDERS: CodexEntry[] = [
  page('choir-novices', 'Novices of the Choir', 'Orders', chapter(3), 'The lowest rank of the Hollow Choir: men and women who sing without knowing what they sing. They hum the hours in their sleep. Most were patients once, of someone who could not stop their pain; the Choir could.'),
  page('choir-cantors', 'Cantors of the Choir', 'Orders', chapter(4), 'The Choir’s singers proper, in porcelain masks with open mouths. A cantor carries one verse of one Hour and can sing it into flesh. The lay-cantor of Chapter II was one who had swallowed his verse rather than sing it.'),
  page('precentors-hand', 'The Precentor’s Hand', 'Orders', story('s4-8'), 'The Choir’s patrons in the city, who pay for candles and hold council seats. The Widow Reiss was one; the carriage without a crest was hers. They do not sing. They sign.'),
  page('precentor-office', 'The Office of Precentor', 'Orders', story('s5-10'), 'The Choir’s leader, who writes the Hours and teaches them. There has only ever been one: Aurel Vennholt, who learned the old offices in the Guild library and was struck from the rolls for using them.'),
  page('flintvein-delvers', 'The Flintvein Delvers', 'Orders', op('op4-3'), 'Orsa Flintvein’s crew of dwarf miners, who follow the black seams wherever they run and name every mine after somebody who owes them. They dug a tunnel under the Tribunal court for the Doctor, and did not charge for it.'),
  page('ostrau-company', 'The Ostrau Company', 'Orders', story('s4-1'), 'Hired pikes and crossbows from Ostrau, marched east to the Vennmark on Kessendorf’s coin: sixty crossbowmen, an orc called Ushkar worth triple his pay, a giant who swallows strongboxes, and a patron who stopped breathing.'),
];

/** People of the late chapters. */
export const LATE_PEOPLE: CodexEntry[] = [
  page('precentor', 'Aurel Vennholt, the Precentor', 'People', story('s5-10'), 'The best pair of hands Master Haller ever trained, struck from the Guild rolls twenty years ago for stilling pain past any measure. He found the Litany in the old offices, and then the Hours. He wanted a quiet night and a perfect end for everyone. Nobody asked for it.'),
  page('widow-reiss', 'The Widow Reiss', 'People', story('s4-8'), 'Aldegund Reiss, who sat for the charities on the council and paid for the hospice candles. She wore black gloves and never took them off; under the left one, a Choir sigil. Her seat let the Tribunal’s charter lapse. Her carriage waited outside the hospice every night.'),
  page('tallert', 'Registrar Oswin Tallert', 'People', op('op3-10'), 'Keeper of the Hall of Records, who collapsed reading the roll of the plague dead while the names wrote themselves across his skin. He copied the roll again from memory afterwards, every name. He had not lost one.'),
  page('liesl', 'Liesl', 'People', op('op3-1'), 'A founder’s daughter of seven, with two horn-buds pressing through her scalp. What the Doctor wrote on her certificate decided whether she went home or to the Tribunal. She wanted to know if his hands were gentle. They were.'),
  page('margit', 'Margit', 'People', op('op4-6'), 'A camp-follower of the Ostrau company, whom the officers visit and the chaplain pretends not to know. Something drank from her every new moon, and she chose it. She asked the Doctor for salve. He listened.'),
  page('burgomaster', 'The Burgomaster', 'People', chapter(5), 'Kessendorf’s first citizen, who signs everything he is given on Fridays. He came to the Tribunal cellars on Hollow Night when called, and would have been the Precentor’s last patient if the Inquisitor had been elsewhere.'),
];

/** Every late page, for the codex. */
export const LATE_CODEX: readonly CodexEntry[] = [...LATE_PEOPLE, ...LATE_AFFLICTIONS, ...LATE_PLACES, ...LATE_ORDERS];
