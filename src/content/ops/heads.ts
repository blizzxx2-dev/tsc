/**
 * Trepanation: a head wound worked down through the layers. The field shows the scalp, then the
 * skull, then the brain beneath as each is opened (PhaseDef.organ). Rank thresholds are calibrated
 * in src/surgery/ranks.ts.
 */
import { BloodPool, Embedded, Incision } from '../../surgery/entities';
import { Trepanation } from '../../surgery/ailments/organs';
import type { OperationDef } from '../../surgery/operation';
import { at, closeIncision } from '../chapter1';

const ALL = ['lancet', 'tongs', 'leech', 'thread', 'salve', 'tincture', 'brand', 'lens'] as const;

/** Chapter III: a slater struck by a roof slate in the mill blast; blood is pressing under the skull. */
export const OP_3_14: OperationDef = {
  id: 'op3-14',
  title: 'The Slate from the Roof',
  patient: 'Jakob Brenner, slater at the powder mill',
  diagnosis: 'A roof slate from the blast struck him above the ear. He talked sense for an hour, then slept and would not wake: blood is pressing under the skull.',
  organ: 'skin',
  timeLimit: 330,
  baseDrain: 0.12,
  tools: ALL,
  ranks: { S: 5860, A: 4690, B: 3520 },
  litany: true,
  seed: 314,
  phases: [
    {
      objective: 'Open the scalp',
      callout: ['He was talking an hour ago. Now he won’t wake. There’s blood under the bone, Doctor.', 'Open the scalp over the bruise — one curve, above the ear.'],
      spawn: () => [new Incision([at(-150, 40), at(-60, 70), at(60, 70), at(150, 40)])],
    },
    {
      objective: 'Trephine the skull',
      organ: 'bone',
      callout: ['Bone. The awl, in three slow circles round the mark — then lift the disc away with the tongs.', 'Slowly. Too fast and you’re through to the brain.'],
      spawn: () => [new Trepanation(at(0, -20))],
    },
    {
      objective: 'Draw off the clot',
      organ: 'brain',
      callout: ['There — the clot, black on the brain. The Leech-Pipe, gently. Nothing sharp near it.', 'And a sliver of slate went in with it. Tongs, and steady.'],
      spawn: () => [new BloodPool(at(-20, -10), 34), new BloodPool(at(40, 20), 22), new Embedded(at(90, -40), 'shard', 2.6, false)],
    },
    { ...closeIncision(['He’s breathing easier. Put the bone back and close the scalp over it.']), organ: 'skin' },
  ],
};
