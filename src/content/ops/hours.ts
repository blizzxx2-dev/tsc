/**
 * The late Hours as data (CON-0133, CON-0137, CON-0163, CON-0170, CON-0191, CON-0200): Prime, Terce,
 * Sext, None, Vespers and Compline. Each Hour is one registry entity (`malison-*`, src/content/schema.ts);
 * its phase hints come from the boss sheet, and `tips.time` is Ilse's line when the clock beats us.
 * Rank thresholds are calibrated in src/surgery/ranks.ts; `ranks` here is the fallback. Each Hour is
 * fought under its own arena grade (ENG-0268…0270): the records hall's chapel cold, Terce's candle-fire,
 * Sext's noon glare, None's street dusk, and night for Vespers and Compline.
 */
import { complineHost } from '../endings';
import { flags } from '../flags';
import { defineOp } from '../schema';

const ALL = ['lancet', 'tongs', 'leech', 'thread', 'salve', 'tincture', 'brand', 'lens'] as const;

export const OP_3_10 = defineOp({
  id: 'op3-10',
  title: 'The Hour of Prime',
  patient: 'Oswin Tallert, Registrar of Kessendorf',
  diagnosis: 'Collapsed reading the roll of the plague dead. Names are writing themselves across his skin, stroke by stroke.',
  organ: 'flesh',
  timeLimit: 420,
  baseDrain: 0.05,
  grade: 'chapel',
  tools: ALL,
  ranks: { S: 5890, A: 4710, B: 3530 },
  litany: true,
  seed: 310,
  tips: { time: 'Prime writes faster than we read. Strike the newest stroke first, and brand the quill the moment a name is gone.' },
  phases: [
    {
      objective: 'Open along the ink',
      callout: ['The ink goes deep. Open him along the line.'],
      spawn: [{ e: 'incision', path: [[-200, 30], [-80, 0], [70, 0], [200, 30]] }],
    },
    {
      objective: 'Strike out the names',
      callout: ['There — the quill! It writes the names. Strike each one out with the lancet, newest stroke first.', 'When a name is gone, the quill falters. Brand it then.'],
      spawn: [{ e: 'malison-prime', at: [0, 20] }],
    },
    {
      objective: 'Mend what the names cut',
      callout: ['The roll is closed. Mend the cuts the names left in him.'],
      spawn: [
        { e: 'laceration', at: [-100, 80], angle: 0.3, len: 60, bleed: 0.6 },
        { e: 'rot', at: [120, -60], r: 34, spread: 0.4 },
      ],
    },
    { objective: 'Close the incision', callout: ['Close him. Carefully — he has a great deal of paperwork to catch up on.'], close: true },
  ],
});

export const OP_3_11 = defineOp({
  id: 'op3-11',
  title: 'The Hour of Terce',
  patient: 'Master Haller, guild surgeon',
  diagnosis: 'Hexfire took him mid-speech in the burning Guildhall. The fire is inside him, leaping between his organs.',
  organ: 'flesh',
  timeLimit: 420,
  baseDrain: 0.1,
  grade: 'candle',
  tools: ALL,
  ranks: { S: 7260, A: 5810, B: 4360 },
  litany: true,
  seed: 311,
  tips: { time: 'Terce outlasted us. Salve the front to hold it, then cut the root out — every root left standing lights the next organ.' },
  phases: [
    {
      objective: 'Put out the hexfire',
      callout: ['Hexfire, in three organs at once. Salve the front, then cut out the root — and never the brand!'],
      spawn: [{ e: 'malison-terce' }],
    },
    {
      objective: 'Save his hands',
      callout: ['It’s out. Now his hands — the burns go to the bone. Eschar off, salve, and stitch the splits.'],
      spawn: [
        { e: 'burn', at: [-150, 40], r: 38, source: 'hexfire' },
        { e: 'burn', at: [150, 40], r: 38, source: 'hexfire' },
        { e: 'laceration', at: [-150, -60], angle: 0.5, len: 60, bleed: 0.5 },
        { e: 'laceration', at: [150, -60], angle: 2.6, len: 60, bleed: 0.5 },
      ],
    },
    {
      objective: 'Sear the grubs',
      callout: ['Grubs in the ash-burns — the hall was filthy. Sear them.'],
      spawn: [
        { e: 'grub', at: [-60, 20], speed: 40 },
        { e: 'grub', at: [70, 10], speed: 40 },
      ],
    },
  ],
});

export const OP_4_7 = defineOp({
  id: 'op4-7',
  title: 'The Hour of Sext',
  patient: 'Captain Mauer, Kessendorf Watch',
  diagnosis: 'Collapsed at noon reporting all quiet. Vitals read calm; the colour says otherwise. Stone crusting over the organs.',
  organ: 'flesh',
  timeLimit: 420,
  baseDrain: 0.05,
  grade: 'dawn',
  tools: ALL,
  ranks: { S: 5720, A: 4580, B: 3430 },
  litany: true,
  seed: 47,
  tips: { time: 'Sext hides behind calm vitals. Chip the crust in one run, brand what’s beneath, and take the tincture when your hands slow.' },
  phases: [
    {
      objective: 'Open the chest',
      callout: ['Open him — the stone is under the sternum.'],
      spawn: [{ e: 'incision', path: [[-190, 30], [-70, 0], [70, 0], [190, 30]] }],
    },
    {
      objective: 'Break the noonday stone',
      callout: ['Stone crust over it. Chip the plates away with the lancet, then brand what’s beneath.', 'And if your hands slow — tincture. It’s the curse, not you.'],
      spawn: [{ e: 'malison-sext', at: [30, 30] }],
    },
    {
      objective: 'Tend the captain',
      callout: ['Noon has passed. Tend him.'],
      spawn: [
        { e: 'laceration', at: [-100, 70], angle: 0.3, len: 56, bleed: 0.6 },
        { e: 'rot', at: [110, -50], r: 32, spread: 0.3 },
      ],
    },
    { objective: 'Close the incision', callout: ['Close him up. Thirty-five men will want their captain.'], close: true },
  ],
});

export const OP_4_9 = defineOp({
  id: 'op4-9',
  title: 'The Hour of None',
  patient: 'Pieter, militiaman',
  diagnosis: 'Collapsed at the ninth hour. Something that entered with an old arrow wound is tunnelling toward his heart.',
  organ: 'flesh',
  timeLimit: 420,
  baseDrain: 0.05,
  grade: 'street',
  tools: ALL,
  ranks: { S: 5790, A: 4630, B: 3470 },
  litany: true,
  seed: 49,
  tips: { time: 'The burrower was quicker than our search. Keep the lens on its tunnel, cut across the head, and brand before it dives.' },
  phases: [
    {
      objective: 'Stop the burrower',
      callout: ['It’s under the skin, moving for his heart. Lens to find the head — then cut across it and brand it!'],
      spawn: [{ e: 'malison-none' }],
    },
    {
      objective: 'Tend the tunnels',
      callout: ['Out. The tunnels are opening — tend them.'],
      spawn: [
        { e: 'laceration', at: [150, 60], angle: 0.7, len: 50, bleed: 0.5 },
        { e: 'grub', at: [-30, 40], speed: 35 },
      ],
    },
  ],
});

export const OP_5_6 = defineOp({
  id: 'op5-6',
  title: 'The Hour of Vespers',
  patient: 'Sister Ilse, of the Merciful Order',
  diagnosis: 'Wick-filaments through the vessels, blood turning to tallow; the ward’s lamps are dying with her.',
  organ: 'flesh',
  timeLimit: 420,
  baseDrain: 0.05,
  grade: 'night',
  tools: ALL,
  ranks: { S: 8400, A: 6720, B: 5040 },
  litany: true,
  seed: 56,
  // CON-0190: Ilse is the patient; Orsa calls the phases.
  assistant: 'orsa',
  tips: { time: 'The lamps went out before the wicks did. Relight a lamp with the brand first — you can’t cut a wick you can’t see.' },
  phases: [
    {
      objective: 'Keep the lamps lit',
      callout: ['Lamps! Keep them burning — brand on a lamp relights it. The wicks only show in the light.', 'Cut the wicks across with the lancet, soften the tallow, draw it off.'],
      spawn: [{ e: 'malison-vespers', at: [0, 0] }],
    },
    {
      objective: 'Tidy her up',
      callout: ['It’s gone out of her! Tidy her up, Doctor — she’ll want to do it herself otherwise.'],
      spawn: [
        { e: 'laceration', at: [-90, 60], angle: 0.4, len: 50, bleed: 0.5 },
        { e: 'rot', at: [120, -40], r: 30, spread: 0.3 },
      ],
    },
  ],
});

export const OP_5_8 = defineOp({
  id: 'op5-8',
  title: 'The Hour of Compline',
  patient: 'Inquisitor Stroh, Ash Tribunal',
  diagnosis: 'Compline, sung into him by the Precentor. His heart slows toward “a perfect end”. The Litany has been stolen.',
  organ: 'heart',
  timeLimit: 480,
  baseDrain: 0.05,
  grade: 'night',
  tools: ALL,
  ranks: { S: 5610, A: 4490, B: 3370 },
  litany: true,
  seed: 58,
  assistant: 'orsa',
  tips: { time: 'The Silence outlasted us. Beat each echo quickly, break every node to win the Litany back, then lancet and brand together.' },
  // A retry resumes at the stolen Litany or the Great Silence once they are reached.
  bossCheckpoints: [2, 3],
  phases: [
    {
      objective: 'Break the Great Silence',
      callout: ['It’s wearing the old Hours like masks. Beat each one as it comes.'],
      spawn: [{ e: 'malison-compline', at: [0, 0] }],
    },
    {
      objective: 'Mend him',
      callout: ['Quiet’s broken. He’s breathing! Mend him.'],
      spawn: [
        { e: 'laceration', at: [-110, 60], angle: 0.3, len: 56, bleed: 0.5 },
        { e: 'rot', at: [110, -30], r: 30, spread: 0.3 },
      ],
    },
  ],
});

// CON-0199: the host follows the campaign (complineHost) — the patient string only; the fight is the same.
Object.defineProperty(OP_5_8, 'patient', {
  get: () => (complineHost(flags) === 'stroh' ? 'Inquisitor Stroh, Ash Tribunal' : 'The Burgomaster of Kessendorf'),
  enumerable: true,
});

// Dev hot-reload (CON-0011): an edit here restarts the running operation (src/scenes/operation.ts).
if (import.meta.hot) import.meta.hot.accept((m) => (globalThis as { __opHotReload?: (m: unknown) => void }).__opHotReload?.(m));
