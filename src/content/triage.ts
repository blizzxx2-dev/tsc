/**
 * Field triage scenarios (CON-0228): the Kilnrows blast (Chapter III), the ambush at the ford on the
 * Vennmark road (Chapter IV) and the streets on Hollow Night (Chapter V). Ten stretchers each — the
 * wounds and signs are what the Doctor sees; `truth` is the tag they call for. Played by
 * src/surgery/triage.ts; placed as `discipline` steps in the campaign.
 */
import type { TriageScenario } from '../surgery/triage';

/** Chapter III: the powder-mill blast, before the three worst go to the table (op3-4). */
export const TRIAGE_KILNROWS: TriageScenario = {
  id: 'tr3-kilnrows',
  title: 'Kilnrows Blast',
  place: 'The powder-mill yard — smoke still rising',
  intro: 'The mill has gone up. The yard is full of stretchers and the carts are an hour away. Ilse holds the lamp.',
  clock: 150,
  tutorial: [
    'Read each stretcher: the wounds, then the breathing and the pulse. Tag it — Immediate, Delayed, Walking, or Beyond Help.',
    'Immediate patients are dying now. Give them what they need: a tourniquet for a spurting limb, a pack for a deep wound, a splint for a broken bone.',
    'Your hands do one thing at a time. The walking can wait; so can the delayed. The beyond-help cannot be helped. Give them the words, and move on.',
  ],
  cards: [
    { id: 'k1', name: 'Grete, mill-hand', wounds: 'Left forearm torn open by flying iron; bright blood spurting in beats.', signs: 'Pale, breathing fast, pulse quick and thready.', truth: 'immediate', life: 45, needs: ['tourniquet'] },
    { id: 'k2', name: 'Anton, carter', wounds: 'A splinter of beam through the side, below the ribs. Blood welling round it.', signs: 'Grey, sweating. Breathing shallow. Pulse fast.', truth: 'immediate', life: 60, needs: ['pack'] },
    { id: 'k3', name: 'Lene, powder-girl', wounds: 'Burns on both hands and the face; eyebrows gone.', signs: 'Crying, talking, asking for her mother. Pulse strong.', truth: 'walking', life: 999 },
    { id: 'k4', name: 'Old Matthias, foreman', wounds: 'Crushed beneath the mill wheel from the waist down.', signs: 'Breathing in gasps, long pauses between. No pulse at the wrist.', truth: 'beyond', life: 30, rites: ['Matthias grips the Doctor’s sleeve. “The wheel — tell them it was the wheel, not the powder.”', 'The Doctor tells him he will. His hand loosens.'] },
    { id: 'k5', name: 'Klaus, stoker', wounds: 'Shin bent wrong, bone white through the stocking; bleeding from the break.', signs: 'Swearing steadily. Pulse fast but strong.', truth: 'immediate', life: 70, needs: ['splint', 'pack'] },
    { id: 'k6', name: 'Hans, water-boy', wounds: 'Cut across the scalp; bleeding into his eyes.', signs: 'Sitting up. Wants to go back in for his dog.', truth: 'walking', life: 999 },
    { id: 'k7', name: 'Marthe, sifter', wounds: 'Broken collarbone; arm held against her chest.', signs: 'Steady. Breathing even. Pulse strong.', truth: 'delayed', life: 999, arrives: 25 },
    { id: 'k8', name: 'Dietrich, mixer', wounds: 'Thigh opened by a hoop of barrel-iron; blood pooling fast under him.', signs: 'White lips, confused. Pulse faint.', truth: 'immediate', life: 40, needs: ['tourniquet', 'pack'], arrives: 30 },
    { id: 'k9', name: 'Bettina, clerk', wounds: 'Glass in the back of both legs from the counting-house window.', signs: 'Lying still, answering questions. Pulse steady.', truth: 'delayed', life: 999, arrives: 55 },
    { id: 'k10', name: 'A man with no name yet', wounds: 'Burned black over the chest and belly. The skin does not blanch.', signs: 'Silent. Breathing rattles. Pulse barely there.', truth: 'beyond', life: 25, arrives: 60, rites: ['Nobody knows his name. The Doctor asks it anyway, and waits.', 'The rattle stops. Ilse writes “a mill-hand” in the day-book.'] },
  ],
};

/** Chapter IV: Mauer's column ambushed at the ford on the Vennmark road. */
export const TRIAGE_FORD: TriageScenario = {
  id: 'tr4-ford',
  title: 'After the Ford',
  place: 'The Vennmark road — the east bank of the ford',
  intro: 'Raiders hit the column in mid-stream. The men they dragged out are laid on the bank in the rain. Mauer is counting.',
  clock: 150,
  cards: [
    { id: 'f1', name: 'Pikeman Oskar Brenner', wounds: 'Crossbow quarrel through the thigh; blood jetting past it.', signs: 'Pale and shaking. Pulse racing.', truth: 'immediate', life: 45, needs: ['tourniquet'] },
    { id: 'f2', name: 'Drummer Lukas', wounds: 'Water in the lungs; pulled from the ford blue.', signs: 'Coughing water now. Breathing on his own. Pulse steady.', truth: 'delayed', life: 999 },
    { id: 'f3', name: 'Sergeant Kaspar Ulm', wounds: 'Axe-cut deep into the shoulder, to the bone.', signs: 'Cursing the raiders by name. Pulse fast, strong.', truth: 'immediate', life: 65, needs: ['pack'] },
    { id: 'f4', name: 'Crossbowman Grisk', wounds: 'Orc, a raider’s horn broken off in his forearm; the arm bent in the middle.', signs: 'Silent, as orcs are. Pulse slow and strong.', truth: 'delayed', life: 999 },
    { id: 'f5', name: 'Raider, unnamed', wounds: 'A horned raider, a pike through the belly and out the back.', signs: 'Eyes open. Breathing wet. Pulse fading.', truth: 'beyond', life: 30, rites: ['The raider says something in the horned tongue. Grisk, from his stretcher, answers it.', '“He asked if his herd got across,” Grisk says. “I said yes.”'] },
    { id: 'f6', name: 'Carter Ilsabe', wounds: 'Wagon rolled on her; forearm and wrist broken, the hand cold.', signs: 'Talking through her teeth. Pulse strong.', truth: 'immediate', life: 80, needs: ['splint'] },
    { id: 'f7', name: 'Pikeman Jorn', wounds: 'Kicked by a horse in the crossing; bruised ribs.', signs: 'Walking about, asking for his pike.', truth: 'walking', life: 999, arrives: 20 },
    { id: 'f8', name: 'Ensign Veit Lammers', wounds: 'Sword-cut across the belly, the gut showing; bleeding hard.', signs: 'Grey, very quiet. Pulse thready.', truth: 'immediate', life: 45, needs: ['pack', 'tourniquet'], arrives: 35 },
    { id: 'f9', name: 'Old Sepp, farrier', wounds: 'Trampled in the stream; chest stove in on the left.', signs: 'Pink froth at the mouth. Breaths shallow and few.', truth: 'beyond', life: 25, arrives: 50, rites: ['Sepp asks whether the grey mare made it across. She did.', '“Good,” he says. “She was the only one that listened.”'] },
    { id: 'f10', name: 'Scout Tomas', wounds: 'A graze along the ribs from a thrown spear.', signs: 'Standing. Wants to go back to the ford for his bow.', truth: 'walking', life: 999, arrives: 60 },
  ],
};

/** Chapter V: Hollow Night — the procession has passed, and the streets behind it. */
export const TRIAGE_HOLLOW: TriageScenario = {
  id: 'tr5-hollow',
  title: 'Hollow Night Streets',
  place: 'Kessendorf — the Penny Stair, Hollow Night',
  intro: 'The Choir walked the Penny Stair singing, and the Watch fired into the dark. The steps are lined with the hurt. Lotte Harrach’s squad carries lanterns.',
  clock: 150,
  cards: [
    { id: 'h1', name: 'Watchman Albrecht', wounds: 'Musket-ball through the upper arm; blood coming in spurts.', signs: 'Pale, gritting his teeth. Pulse quick.', truth: 'immediate', life: 45, needs: ['tourniquet'] },
    { id: 'h2', name: 'A chorister girl', wounds: 'No wound. Humming the hymn, eyes open, not blinking.', signs: 'Breathing easy. Pulse slow and even.', truth: 'delayed', life: 999 },
    { id: 'h3', name: 'Baker Ruprecht', wounds: 'Fell down the Stair in the crush; the leg broken above the ankle.', signs: 'Groaning. Pulse strong.', truth: 'immediate', life: 75, needs: ['splint'] },
    { id: 'h4', name: 'Widow Kranz', wounds: 'Trampled in the crush; ribs broken, lips blue.', signs: 'Breath comes in sips. No pulse at the wrist.', truth: 'beyond', life: 30, rites: ['Widow Kranz asks if the singing has stopped. It has.', '“Then I’ll sleep,” she says, and does.'] },
    { id: 'h5', name: 'Watchwoman Ada Frey', wounds: 'Knife in the side from a grey robe; blood soaking her coat.', signs: 'Swearing. Breathing fast. Pulse fast.', truth: 'immediate', life: 55, needs: ['pack'] },
    { id: 'h6', name: 'A lamplighter’s boy', wounds: 'Burned hand from a dropped lantern.', signs: 'Crying, but walking. Pulse strong.', truth: 'walking', life: 999 },
    { id: 'h7', name: 'Jakob’s father', wounds: 'Cut on the forehead from a thrown stone.', signs: 'Wants to find his son on the cathedral steps.', truth: 'walking', life: 999, arrives: 25 },
    { id: 'h8', name: 'Watchman Dirk Hahn', wounds: 'Both legs torn by his own powder-flask going off; one bleeding in jets, the shin broken.', signs: 'White, shivering. Pulse faint.', truth: 'immediate', life: 50, needs: ['tourniquet', 'splint'], arrives: 30 },
    { id: 'h9', name: 'A grey-robed singer', wounds: 'Shot through the chest by the Watch. The hymn still on his lips.', signs: 'Bubbling breath. Pulse fading fast.', truth: 'beyond', life: 25, arrives: 45, rites: ['He sings two more words of the verse. Then, in his own voice: “I don’t know this song.”', 'The Doctor closes his eyes. Stroh, watching, says nothing.'] },
    { id: 'h10', name: 'Nun of Saint Ildra', wounds: 'Arm broken shielding a child from the crush.', signs: 'Calm, praying. Pulse steady.', truth: 'delayed', life: 999, arrives: 60 },
  ],
};

export const TRIAGE_SCENARIOS: readonly TriageScenario[] = [TRIAGE_KILNROWS, TRIAGE_FORD, TRIAGE_HOLLOW];
