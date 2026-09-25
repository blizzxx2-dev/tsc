/**
 * Chapter I operations as data (CON-0001). Positions are offsets from the centre of the
 * operating field; see src/content/schema.ts for the entity ids and their parameters.
 */
import { defineOp } from '../schema';

const ALL_BUT_LENS = ['lancet', 'tongs', 'leech', 'thread', 'salve', 'tincture', 'brand'] as const;

export const OP_1_1 = defineOp({
  id: 'op1-1',
  title: 'A Tavern Knife',
  patient: 'Jost, drover',
  diagnosis: 'Knife wounds to the forearm and flank after a dice dispute. Moderate bleeding.',
  organ: 'flesh',
  timeLimit: 180,
  tools: ['thread', 'leech', 'salve'],
  ranks: { S: 3950, A: 3150, B: 2350 },
  litany: false,
  seed: 11,
  phases: [
    {
      callout: ['Two deep cuts. Take the gut thread and zig-zag across each wound to stitch it.', 'Cross the wound again and again, moving along it. One smooth stroke earns the best marks.'],
      spawn: [
        { e: 'laceration', at: [-140, -40], angle: 0.3, len: 120, bleed: 0.5 },
        { e: 'laceration', at: [130, 50], angle: -0.4, len: 100, bleed: 0.5 },
      ],
    },
    {
      callout: ['Blood’s pooling. Hold the leech-pipe over it to draw it off.', 'You can’t stitch through a pool of blood — drain first.'],
      spawn: [{ e: 'laceration', at: [0, 20], angle: 1.2, len: 110, bleed: 0.9 }],
    },
    {
      callout: ['Just nicks left. Brush Saint’s Salve over the small ones — no need for thread.'],
      spawn: [
        { e: 'laceration', at: [-200, 80], angle: 0.9, len: 36, bleed: 0.3 },
        { e: 'laceration', at: [190, -90], angle: 2.1, len: 40, bleed: 0.3 },
        { e: 'laceration', at: [40, -120], angle: 0.1, len: 32, bleed: 0.3 },
      ],
    },
  ],
});

export const OP_1_2 = defineOp({
  id: 'op1-2',
  title: 'The Barbed Shaft',
  patient: 'Pieter, militiaman',
  diagnosis: 'Barbed arrow lodged in the left flank; crossbow bolt in the thigh. Raider ambush.',
  organ: 'flesh',
  timeLimit: 200,
  tools: ['lancet', 'tongs', 'leech', 'thread', 'salve'],
  ranks: { S: 4450, A: 3550, B: 2650 },
  litany: false,
  seed: 12,
  phases: [
    {
      callout: ['The arrow’s barbed. Lancet first — two nicks at the entry wound. Then seize it with the tongs and pull it well clear.', 'Then drain and stitch the wound it leaves.'],
      spawn: [{ e: 'embedded', at: [-60, 0], kind: 'arrow', angle: -0.5 }],
    },
    {
      callout: ['The bolt in his thigh has no barbs. Tongs, and pull it straight out.', 'Quick, clean pulls earn the best marks.'],
      spawn: [
        { e: 'embedded', at: [150, 60], kind: 'bolt', angle: 0.4, barbed: false },
        { e: 'embedded', at: [-180, -70], kind: 'shard', angle: 2.2, barbed: false },
      ],
    },
  ],
});

export const OP_1_3 = defineOp({
  id: 'op1-3',
  title: 'Powder Burns',
  patient: 'Anno, gunsmith’s apprentice',
  diagnosis: 'Burst-barrel injury: powder burns across the chest, lead fragments embedded beneath the skin.',
  organ: 'flesh',
  timeLimit: 240,
  baseDrain: 0.25,
  vitals: 70,
  tools: ['lancet', 'tongs', 'leech', 'thread', 'salve', 'tincture'],
  ranks: { S: 4750, A: 3800, B: 2850 },
  litany: false,
  seed: 13,
  phases: [
    {
      callout: ['His pulse is weak already. Hold the tincture to the flesh to steady him if you need it.', 'Burns first. Pluck the black eschar away with the tongs, then salve the raw flesh.'],
      spawn: [
        { e: 'burn', at: [-170, -60], r: 48 },
        { e: 'burn', at: [180, -80], r: 40 },
      ],
    },
    {
      callout: ['Now open him along the inked line with the lancet. Keep to the line — start at the glowing end.'],
      spawn: [{ e: 'incision', path: [[-150, 60], [-50, 40], [60, 50], [160, 30]] }],
    },
    {
      callout: ['There — the shot. Pull each ball out with the tongs.'],
      spawn: [
        { e: 'embedded', at: [-80, 40], kind: 'shot' },
        { e: 'embedded', at: [30, 70], kind: 'shot' },
        { e: 'embedded', at: [120, 20], kind: 'shot' },
      ],
    },
    { callout: ['Everything’s clear. Close the incision with the thread.'], close: true },
  ],
});

export const OP_1_4 = defineOp({
  id: 'op1-4',
  title: 'Pestilent Humours',
  patient: 'Matthis Kolb, tanner’s man, Tanners’ Rows',
  diagnosis: 'Plague buboes, spreading rot and an infested sore. High fever.',
  organ: 'flesh',
  timeLimit: 240,
  baseDrain: 0.15,
  tools: ['lancet', 'tongs', 'leech', 'thread', 'salve', 'tincture', 'brand'],
  ranks: { S: 5250, A: 4200, B: 3150 },
  litany: false,
  seed: 14,
  phases: [
    {
      callout: ['Lance each bubo with a single touch of the lancet before it bursts. Then drain the pus and salve it.'],
      spawn: [
        { e: 'bubo', at: [-160, -40], r: 22 },
        { e: 'bubo', at: [40, -100], r: 20 },
        { e: 'bubo', at: [170, 60], r: 24 },
      ],
    },
    {
      callout: ['Grubs in the sore! The cautery brand — hold it on each one until it stops moving.', 'Don’t linger on bare flesh with the brand.'],
      spawn: [
        { e: 'grub', at: [-40, 40], speed: 35 },
        { e: 'grub', at: [60, 60], speed: 35 },
        { e: 'grub', at: [10, -10], speed: 35 },
        { e: 'rot', at: [20, 40], r: 60, spread: 0.3 },
      ],
    },
    {
      callout: ['The rot’s spreading. Salve every patch — quickly, it creeps back.'],
      spawn: [
        { e: 'rot', at: [-180, 70], r: 50, spread: 0.6 },
        { e: 'rot', at: [180, -60], r: 55, spread: 0.6 },
      ],
    },
  ],
});

export const OP_1_5 = defineOp({
  id: 'op1-5',
  title: 'The Hour of Matins',
  patient: 'Emmerich, page-boy',
  diagnosis: 'Unknown. Moving marks on the chest. Delirium. “The choir is singing in me.”',
  organ: 'flesh',
  timeLimit: 330,
  baseDrain: 0.1,
  tools: ALL_BUT_LENS,
  ranks: { S: 6950, A: 5550, B: 4150 },
  litany: true,
  seed: 15,
  phases: [
    {
      callout: ['Those sigils are draining him. Trace every stroke of each one with the brand to sear it out.'],
      spawn: [
        { e: 'sigil', at: [-170, -30], shape: 'eye', size: 70 },
        { e: 'sigil', at: [170, 20], shape: 'trident', size: 60 },
      ],
    },
    {
      callout: ['Something is moving beneath the skin. We have to open him. The lancet — along the line.'],
      spawn: [{ e: 'incision', path: [[-180, 0], [-60, -20], [60, -10], [180, 10]] }],
    },
    {
      callout: ['Saints preserve us… what is that?', 'Doctor — if ever there were a time for the Litany, it is now. Draw the star with the right hand.'],
      spawn: [{ e: 'malison-matins', at: [0, 40], hp: 100 }],
    },
    {
      callout: ['It’s gone. Tend the wounds it left.'],
      spawn: [
        { e: 'laceration', at: [-90, 90], angle: 0.4, len: 60, bleed: 0.8 },
        { e: 'rot', at: [110, -60], r: 40, spread: 0.4 },
        { e: 'grub', at: [0, 0], speed: 40 },
      ],
    },
    { callout: ['Everything’s clear. Close the incision with the thread.'], close: true },
  ],
});
