/**
 * Chapter II operations as data (CON-0001). Positions are offsets from the centre of the
 * operating field; see src/content/schema.ts for the entity ids and their parameters.
 */
import { flags } from '../flags';
import { defineOp, type EntitySpec } from '../schema';

const ALL = ['lancet', 'tongs', 'leech', 'thread', 'salve', 'tincture', 'brand', 'lens'] as const;

/** Three parallel claw rakes. */
export const clawRake = (x: number, y: number, angle: number, len = 90): EntitySpec[] =>
  [-1, 0, 1].map((i) => ({ e: 'laceration', at: [x - Math.sin(angle) * i * 26, y + Math.cos(angle) * i * 26], angle, len: len - Math.abs(i) * 14, bleed: 0.8 }));

const hiddenShard = (x: number, y: number, angle: number): EntitySpec => ({ e: 'embedded', at: [x, y], kind: 'hexstone', angle, barbed: false, hidden: true });
const hiddenGlass = (x: number, y: number, angle: number): EntitySpec => ({ e: 'embedded', at: [x, y], kind: 'glass', angle, barbed: false, hidden: true });

export const OP_2_1 = defineOp({
  id: 'op2-1',
  title: 'Gravehound',
  patient: 'Tomas, scout',
  patientGender: 'm',
  diagnosis: 'Mauled by a corpse-eating hound. Claw rakes across the back, fangs lodged in the shoulder, venom spreading from the bite.',
  organ: 'flesh',
  timeLimit: 240,
  tools: ['lancet', 'tongs', 'leech', 'thread', 'salve', 'tincture'],
  ranks: { S: 4920, A: 3940, B: 2950 },
  litany: true,
  seed: 21,
  phases: [
    {
      objective: 'Draw out the venom',

      callout: ['The venom first — hold the Tincture on the bite until it takes.', 'The longer it spreads, the harder it drags on him.'],
      spawn: [{ e: 'venom', at: [-120, -30], rate: 7 }],
    },
    {
      objective: 'Pull the fangs',

      callout: ['Now the fangs. Tongs — pull each one clear.'],
      // CON-0057: three or four fangs by seed; the second is broken and comes out crown first, then root.
      spawn: [
        {
          e: 'elite-fangnest',
          path: [
            [-150, -50],
            [-100, -10],
            [-80, -60],
            [-140, 30],
          ],
          angles: [0.9, 1.2, 0.6, 1.0],
          optional: 1,
          broken: 1,
        },
      ],
    },
    {
      objective: 'Stitch the claw rakes',

      callout: ['Claw rakes. Three deep lines — drain and stitch each.', 'Grave-dirt in them too — Leech-Pipe it out before any Saint’s Salve.'],
      // CON-0058: the hound feeds on the dead; two clots of grave-dirt ride in on the rakes.
      spawn: [...clawRake(110, 20, -0.5, 100), { e: 'gravedirt', at: [70, -40] }, { e: 'gravedirt', at: [165, 70] }],
    },
  ],
});

export const OP_2_2 = defineOp({
  id: 'op2-2',
  title: 'The Black Seam',
  patient: 'Orsa Flintvein, dwarf prospector',
  patientGender: 'f',
  race: 'dwarf',
  diagnosis: 'Cave-in at a hexstone seam. Shards driven beneath the skin, invisible to the eye. Surrounding flesh spoiling.',
  organ: 'flesh',
  timeLimit: 270,
  baseDrain: 0.05,
  tools: ALL,
  ranks: { S: 6010, A: 4810, B: 3610 },
  litany: true,
  seed: 22,
  phases: [
    {
      objective: 'Pull the splinters',

      callout: ['Rock splinters on the surface first. Tongs.'],
      spawn: [
        { e: 'embedded', at: [-160, 60], kind: 'shard', angle: 2.4, barbed: false },
        { e: 'embedded', at: [150, -70], kind: 'shard', angle: -0.6, barbed: false },
        { e: 'embedded', at: [40, 90], kind: 'glass', angle: 1.1, barbed: false },
      ],
    },
    {
      objective: 'Find the hidden shards',

      callout: ['Now — the Scrying Lens. Pass it slowly over the flesh; where something hides, it shimmers.', 'Hold it still over the shimmer to bring the shard to light, then pull it.'],
      // CON-0060: the first hexstone lies near the middle and shows itself under the lens; one more hexstone and
      // two to four glass splinters (by seed) must be found.
      spawn: [
        { ...hiddenShard(-20, -10, 0.9), guide: true },
        hiddenShard(90, 30, 2.1),
        { e: 'pick', n: [2, 4], of: [hiddenGlass(0, -100, -1.2), hiddenGlass(170, -60, -0.5), hiddenGlass(-170, 70, 2.6), hiddenGlass(60, 110, 1.6)] },
        { e: 'rot', at: [-110, -30], r: 40, spread: 0.4 },
      ],
    },
    {
      objective: 'Clean the spoiled flesh',

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
  patient: 'Ilvaren, elf forager',
  patientGender: 'm',
  race: 'elf',
  diagnosis: 'Web-spinner bite, a day old. Neurotoxic venom spreading from the neck; several egg sacs laid beneath the skin.',
  organ: 'flesh',
  timeLimit: 240,
  baseDrain: 0.1,
  // GAM-0197/0199: the venom has had a day in him — he comes in weak, so the brood needn't bite so hard.
  vitals: 80,
  tools: ALL,
  ranks: { S: 8230, A: 6580, B: 4940 },
  litany: true,
  seed: 23,
  phases: [
    {
      objective: 'Cut away the silk',

      callout: ['Silk over the bites. Cut each strand with one stroke of the Lancet.'],
      spawn: [{ e: 'silk', at: [0, -40], strands: 5, r: 120 }],
    },
    {
      objective: 'Treat the bites',

      callout: ['Venom from two bites. Tincture on each, quickly.'],
      spawn: [
        { e: 'venom', at: [-60, -80], rate: 9 },
        { e: 'venom', at: [70, -90], rate: 9 },
      ],
    },
    {
      objective: 'Lance the egg sacs',

      callout: ['The sacs — lance each with one touch, then sear the hatchlings with the Cautery Brand.', 'Mind the ones that are close to hatching.'],
      // GAM-0197: one hatchling to a lanced sac, on a slower stagger, so the steady drain peaks under 1.2/s.
      spawn: [
        { e: 'eggsac', at: [-170, 30], brood: 1, hatchIn: 22 },
        { e: 'eggsac', at: [0, 70], brood: 1, hatchIn: 32 },
        { e: 'eggsac', at: [170, 10], brood: 1, hatchIn: 42 },
      ],
    },
    {
      objective: 'Cut the brood-cluster free',

      callout: ['Her brood-cluster — three sacs under one skin.', 'Cut the membrane right around them with the Lancet first, or they’ll wake as one.'],
      spawn: [{ e: 'elite-broodcluster', at: [-20, 20], hatchIn: 34, brood: 1 }],
    },
    {
      objective: 'Find the last sac',

      callout: ['One more sac, deeper. Use the Scrying Lens to find it, then open it.', 'And he’s taken a fever-bubo from the bite — lance and cleanse it.'],
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
  diagnosis: 'Silence-sigils igniting across the chest (hexfire). Self-administered poison; something else swallowed. Prisoner of the Ash Tribunal.',
  organ: 'flesh',
  timeLimit: 330,
  baseDrain: 0.2,
  vitals: 80,
  tools: ALL,
  ranks: { S: 7000, A: 5600, B: 4200 },
  litany: true,
  seed: 24,
  phases: [
    {
      objective: 'Counter the poison',

      callout: ['The poison he swallowed — Tincture, now, or he’s gone before we start.'],
      spawn: [{ e: 'venom', at: [0, 20], rate: 5 }],
    },
    {
      objective: 'Sear the sigils',

      callout: ['Those sigils are burning him from within. Sear each one out — every stroke.'],
      spawn: [
        // They ignite on a stagger, one after another (CON-0068), not all at once.
        { e: 'sigil', at: [-160, -20], shape: 'crown', size: 55, lashEvery: 4.5, lashStart: 1.5 },
        { e: 'sigil', at: [160, -10], shape: 'hourglass', size: 55, lashEvery: 4.5 },
        { e: 'sigil', at: [0, -90], shape: 'eye', size: 50, lashEvery: 4.5, lashStart: 3 },
      ],
    },
    {
      objective: 'Burn out the cantor’s knot',

      callout: ['There — a knot of it round his throat. Every time he hums, it ties itself again.', 'Burn it out between the verses.'],
      spawn: [{ e: 'elite-cantor', at: [0, -150] }],
    },
    {
      objective: 'Dress the hexfire burns',

      callout: ['The hexfire burns. Pluck the eschar, then Saint’s Salve on them.'],
      spawn: [
        { e: 'burn', at: [-150, 60], r: 44, source: 'hexfire' },
        { e: 'burn', at: [150, 70], r: 40, source: 'hexfire' },
        { e: 'burn', at: [10, 100], r: 36, source: 'hexfire' },
      ],
    },
    {
      objective: 'Brand the maggots',

      callout: ['Maggots in an old sore — the Tribunal’s cells are filthy. Cautery Brand.'],
      spawn: [
        { e: 'grub', at: [-40, 20], speed: 45 },
        { e: 'grub', at: [50, 30], speed: 45 },
        { e: 'rot', at: [0, 30], r: 50, spread: 0.4 },
      ],
    },
    {
      objective: 'Recover what he swallowed',
      // CON-0069: the Scrying Lens finds a hymn-token in the stomach; the Tongs reach it only through the incision.
      callout: ['One more thing — the Scrying Lens. He swallowed something the Tribunal wasn’t to find.', 'Open him along the line with the Lancet, then the Tongs.'],
      spawn: [
        { e: 'incision', path: [[-80, 55], [0, 45], [80, 55]] },
        { e: 'embedded', at: [10, 85], kind: 'token', hidden: true },
      ],
    },
  ],
});

export const OP_2_5 = defineOp({
  id: 'op2-5',
  title: 'The Hour of Lauds',
  patient: 'Jorg, standard-bearer',
  patientGender: 'm',
  diagnosis: 'Collapsed during the dawn hymn. Two voices beneath the sternum are singing, one against the other.',
  organ: 'flesh',
  timeLimit: 480,
  baseDrain: 0.1,
  tools: ALL,
  ranks: { S: 7600, A: 6100, B: 4550 },
  litany: true,
  seed: 25,
  phases: [
    {
      objective: 'Open the incision',

      callout: ['We have to open him — along the line, Doctor.'],
      spawn: [{ e: 'incision', path: [[-190, 20], [-70, -10], [70, -10], [190, 20]] }],
    },
    {
      objective: 'Silence the choir',

      callout: ['A choir! Those lights are its Voices — hold the Cautery Brand on each as it circles.', 'Silence all of them and its heart will be bare.'],
      spawn: [{ e: 'malison-lauds', at: [0, 30] }],
    },
    {
      objective: 'Tend the wounds',

      callout: ['It’s done. Tend what it left of him.'],
      spawn: [
        { e: 'laceration', at: [-110, 80], angle: 0.3, len: 60, bleed: 0.7 },
        { e: 'laceration', at: [120, -70], angle: 2.4, len: 55, bleed: 0.7 },
        { e: 'rot', at: [20, 90], r: 40, spread: 0.4 },
        { e: 'grub', at: [0, 0], speed: 40 },
      ],
    },
    { objective: 'Close the incision', callout: ['Close him up. Gently — he has a banner to carry.'], close: true },
  ],
});

// CON-0070: a surgeon who stood up to Stroh over the cantor (s2-4) has Ilse's poppy ready: he comes in 10 stronger.
Object.defineProperty(OP_2_4, 'vitals', { get: () => 80 + (flags.get('cantorMercy') === true ? 10 : 0), enumerable: true });

// Dev hot-reload (CON-0011): an edit here restarts the running operation (src/scenes/operation.ts).
if (import.meta.hot) import.meta.hot.accept((m) => (globalThis as { __opHotReload?: (m: unknown) => void }).__opHotReload?.(m));
