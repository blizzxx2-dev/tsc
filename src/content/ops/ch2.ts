/**
 * Chapter II operations as data (CON-0001). Positions are offsets from the centre of the
 * operating field; see src/content/schema.ts for the entity ids and their parameters.
 */
import { defineOp, type EntitySpec } from '../schema';

const ALL = ['lancet', 'tongs', 'leech', 'thread', 'salve', 'tincture', 'brand', 'lens'] as const;

/** Three parallel claw rakes. */
export const clawRake = (x: number, y: number, angle: number, len = 90): EntitySpec[] =>
  [-1, 0, 1].map((i) => ({ e: 'laceration', at: [x - Math.sin(angle) * i * 26, y + Math.cos(angle) * i * 26], angle, len: len - Math.abs(i) * 14, bleed: 0.8 }));

const hiddenShard = (x: number, y: number, angle: number): EntitySpec => ({ e: 'embedded', at: [x, y], kind: 'hexstone', angle, barbed: false, hidden: true });

export const OP_2_1 = defineOp({
  id: 'op2-1',
  title: 'Gravehound',
  patient: 'Tomas, scout',
  patientGender: 'm',
  diagnosis: 'Mauled by a corpse-eating hound. Claw rakes across the back, fangs lodged in the shoulder, venom spreading from the bite.',
  organ: 'flesh',
  timeLimit: 240,
  tools: ['lancet', 'tongs', 'leech', 'thread', 'salve', 'tincture'],
  ranks: { S: 4850, A: 3900, B: 2900 },
  litany: true,
  seed: 21,
  phases: [
    {
      callout: ['The venom first — hold the tincture on the bite until it takes.', 'The longer it spreads, the harder it drags on him.'],
      spawn: [{ e: 'venom', at: [-120, -30], rate: 7 }],
    },
    {
      callout: ['Now the fangs. Tongs — pull each one clear.'],
      spawn: [
        { e: 'embedded', at: [-150, -50], kind: 'tooth', angle: 0.9, barbed: false },
        { e: 'embedded', at: [-100, -10], kind: 'tooth', angle: 1.2, barbed: false },
        { e: 'embedded', at: [-80, -60], kind: 'tooth', angle: 0.6, barbed: false },
      ],
    },
    {
      callout: ['Claw rakes. Three deep lines — drain and stitch each.'],
      spawn: clawRake(110, 20, -0.5, 100),
    },
  ],
});

export const OP_2_2 = defineOp({
  id: 'op2-2',
  title: 'The Black Seam',
  patient: 'Orsa Flintvein, mountain-folk prospector',
  patientGender: 'f',
  race: 'mountainfolk',
  diagnosis: 'Cave-in at a hexstone seam. Shards driven beneath the skin, invisible to the eye. Surrounding flesh spoiling.',
  organ: 'flesh',
  timeLimit: 270,
  baseDrain: 0.1,
  tools: ALL,
  ranks: { S: 5650, A: 4500, B: 3400 },
  litany: true,
  seed: 22,
  phases: [
    {
      callout: ['Rock splinters on the surface first. Tongs.'],
      spawn: [
        { e: 'embedded', at: [-160, 60], kind: 'shard', angle: 2.4, barbed: false },
        { e: 'embedded', at: [150, -70], kind: 'shard', angle: -0.6, barbed: false },
        { e: 'embedded', at: [40, 90], kind: 'glass', angle: 1.1, barbed: false },
      ],
    },
    {
      callout: ['Now — the Scrying Lens. Pass it slowly over the flesh; where something hides, it shimmers.', 'Hold it still over the shimmer to bring the shard to light, then pull it.'],
      spawn: [hiddenShard(-120, -40, 0.4), hiddenShard(90, 30, 2.1), hiddenShard(0, -100, -1.2), { e: 'rot', at: [-110, -30], r: 40, spread: 0.4 }],
    },
    {
      callout: ['Clean up the spoiled flesh and any wounds left.'],
      spawn: [
        { e: 'rot', at: [120, 60], r: 45, spread: 0.5 },
        { e: 'laceration', at: [-30, 110], angle: 0.2, len: 70, bleed: 0.6 },
      ],
    },
  ],
});

export const OP_2_3 = defineOp({
  id: 'op2-3',
  title: 'Brood-Mother’s Kiss',
  patient: 'Henning, forager',
  patientGender: 'm',
  diagnosis: 'Web-spinner bite. Neurotoxic venom spreading from the neck; several egg sacs laid beneath the skin.',
  organ: 'flesh',
  timeLimit: 240,
  baseDrain: 0.15,
  tools: ALL,
  ranks: { S: 6750, A: 5400, B: 4050 },
  litany: true,
  seed: 23,
  phases: [
    {
      callout: ['Venom from two bites. Tincture on each, quickly.'],
      spawn: [
        { e: 'venom', at: [-60, -80], rate: 9 },
        { e: 'venom', at: [70, -90], rate: 9 },
      ],
    },
    {
      callout: ['The sacs — lance each one with a single touch, then sear the hatchlings with the brand.', 'Mind the ones that are close to hatching.'],
      spawn: [
        { e: 'eggsac', at: [-170, 30], brood: 3, hatchIn: 16 },
        { e: 'eggsac', at: [0, 70], brood: 3, hatchIn: 22 },
        { e: 'eggsac', at: [170, 10], brood: 3, hatchIn: 28 },
      ],
    },
    {
      callout: ['One more sac, deeper. Use the lens to find it, then open it.', 'And he’s taken a fever-bubo from the bite — lance and cleanse it.'],
      spawn: [
        { e: 'eggsac', at: [90, 90], brood: 4, hatchIn: 30, hidden: true },
        { e: 'bubo', at: [-120, -40], r: 22 },
      ],
    },
  ],
});

export const OP_2_4 = defineOp({
  id: 'op2-4',
  title: 'The Silenced Cantor',
  patient: 'A lay-cantor of the Hollow Choir',
  patientGender: 'unknown',
  diagnosis: 'Silence-sigils igniting across the chest (hexfire). Self-administered poison. Prisoner of the Ash Tribunal.',
  organ: 'flesh',
  timeLimit: 300,
  baseDrain: 0.2,
  vitals: 80,
  tools: ALL,
  ranks: { S: 5950, A: 4750, B: 3550 },
  litany: true,
  seed: 24,
  phases: [
    {
      callout: ['The poison he swallowed — tincture, now, or he’s gone before we start.'],
      spawn: [{ e: 'venom', at: [0, 20], rate: 5 }],
    },
    {
      callout: ['Those sigils are burning him from within. Sear each one out — every stroke.'],
      spawn: [
        { e: 'sigil', at: [-160, -20], shape: 'crown', size: 55, lashEvery: 4.5 },
        { e: 'sigil', at: [160, -10], shape: 'hourglass', size: 55, lashEvery: 4.5 },
        { e: 'sigil', at: [0, -90], shape: 'eye', size: 50, lashEvery: 4.5 },
      ],
    },
    {
      callout: ['The hexfire burns. Pluck the eschar, then salve them.'],
      spawn: [
        { e: 'burn', at: [-150, 60], r: 44, source: 'hexfire' },
        { e: 'burn', at: [150, 70], r: 40, source: 'hexfire' },
        { e: 'burn', at: [10, 100], r: 36, source: 'hexfire' },
      ],
    },
    {
      callout: ['Maggots in an old sore — the Tribunal’s cells are filthy. Brand them.'],
      spawn: [
        { e: 'grub', at: [-40, 20], speed: 45 },
        { e: 'grub', at: [50, 30], speed: 45 },
        { e: 'rot', at: [0, 30], r: 50, spread: 0.4 },
      ],
    },
  ],
});

export const OP_2_5 = defineOp({
  id: 'op2-5',
  title: 'The Hour of Lauds',
  patient: 'Jorg, standard-bearer',
  patientGender: 'm',
  diagnosis: 'Collapsed during the dawn hymn. Something beneath the sternum is singing.',
  organ: 'flesh',
  timeLimit: 420,
  baseDrain: 0.1,
  tools: ALL,
  ranks: { S: 7600, A: 6100, B: 4550 },
  litany: true,
  seed: 25,
  phases: [
    {
      callout: ['We have to open him — along the line, Doctor.'],
      spawn: [{ e: 'incision', path: [[-190, 20], [-70, -10], [70, -10], [190, 20]] }],
    },
    {
      callout: ['Saints… it has a choir. Those little lights are its Voices — hold the brand on each as it circles.', 'Silence all of them and its heart will be bare.'],
      spawn: [{ e: 'malison-lauds', at: [0, 30] }],
    },
    {
      callout: ['It’s done. Tend what it left of him.'],
      spawn: [
        { e: 'laceration', at: [-110, 80], angle: 0.3, len: 60, bleed: 0.7 },
        { e: 'laceration', at: [120, -70], angle: 2.4, len: 55, bleed: 0.7 },
        { e: 'rot', at: [20, 90], r: 40, spread: 0.4 },
        { e: 'grub', at: [0, 0], speed: 40 },
      ],
    },
    { callout: ['Close him up. Gently — he has a banner to carry.'], close: true },
  ],
});
