import { BloodPool, Bubo, Burn, Embedded, Grub, Incision, Laceration, Rot, Sigil, SIGILS, Venom } from '../surgery/entities';
import { EggSac } from '../surgery/lauds';
import type { Operation, OperationDef } from '../surgery/operation';
import { at } from './chapter1';

/**
 * Dev-only: every ailment on one table, for art and rendering review (?op=showcase).
 * Not part of the campaign.
 */
export const SHOWCASE: OperationDef = {
  id: 'showcase',
  title: 'Anatomy Theatre',
  patient: 'A generous cadaver',
  diagnosis: 'Everything, at once. For the edification of students.',
  organ: 'flesh',
  timeLimit: 999,
  tools: ['lancet', 'tongs', 'leech', 'thread', 'salve', 'tincture', 'brand', 'lens'],
  ranks: { S: 99999, A: 99998, B: 99997 },
  seed: 99,
  phases: [
    {
      spawn: (op: Operation) => {
        const inc = new Incision([at(-260, 110), at(-140, 90), at(-20, 110)]);
        inc.state = 'open';
        inc.required = true;
        return [
          inc,
          new Laceration(at(160, -130), 0.3, 110, 0.6),
          new Laceration(at(250, 40), 1.2, 38, 0.2),
          new Burn(at(-250, -80), 52, op),
          new Burn(at(-110, -130), 34, op, 'hexfire'),
          new Bubo(at(40, -150), 26),
          new Embedded(at(90, 30), 'arrow', -0.6),
          new Embedded(at(300, -40), 'warpshard', 2.2, false),
          new Embedded(at(-30, -40), 'shot'),
          new Venom(at(200, 130), op, 0),
          new Sigil(at(60, 150), SIGILS.eye, 48, 999),
          new BloodPool(at(-120, 20), 40),
          new BloodPool(at(-90, 40), 26),
          new BloodPool(at(330, 90), 22, 'pus'),
          new Rot(at(-310, 30), 44, 0),
          new EggSac(at(-200, 190), 3, 999),
          new Grub(at(120, -50), op, 20),
        ];
      },
    },
  ],
};
