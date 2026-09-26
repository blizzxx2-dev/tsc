/**
 * Bone-setting (CON-0237…0240): four cases of broken bone, one closed and found with the lens, one open
 * and compound, a collarbone set under traction, and a pair of hands broken on the rack. Each ends
 * with the splint bound in thread (CON-0238). Rank thresholds are calibrated in src/surgery/ranks.ts.
 */
import { defineOp } from '../schema';

const ALL = ['lancet', 'tongs', 'leech', 'thread', 'salve', 'tincture', 'brand', 'lens'] as const;

/** Chapter III: a closed shin-break under a bruise. Find it with the lens, then set it under traction. */
export const OP_3_12 = defineOp({
  id: 'op3-12',
  title: 'Kicked by a Dray-Horse',
  patient: 'Gerd Mahler, drayman at the powder mill',
  diagnosis: 'A dray-horse spooked by the blast and kicked him in the shin. No wound, only a bruise — and a leg that will not bear him.',
  organ: 'bone',
  timeLimit: 300,
  baseDrain: 0.08,
  tools: ALL,
  ranks: { S: 3000, A: 2400, B: 1800 },
  litany: true,
  seed: 312,
  tips: { time: 'Pull, then set. Don’t fish for the pieces with the limb slack — and don’t haul once it’s out to length.' },
  phases: [
    {
      objective: 'Find the break',
      callout: ['No wound to open. The break is under the bruise — pass the lens slowly along the shin.', 'Then pull on the ankle, set it, pin it, and bind the splint — a turn of thread across each band.'],
      spawn: [{ e: 'reduction', at: [40, 30], pull: [-230, 30], fragments: 2, wrap: 3, hidden: true }],
    },
    {
      objective: 'Mend the scrapes',
      callout: ['The cobbles took the skin off his knee. Stitch it, and send him home on a cart he didn’t have to pull.'],
      spawn: [{ e: 'laceration', at: [220, -40], angle: 0.2, len: 60, bleed: 0.4 }],
    },
  ],
});

/** Chapter III: a mason off the Iron Bridge scaffold — both forearm bones, one through the skin. */
export const OP_3_13 = defineOp({
  id: 'op3-13',
  title: 'Fall from the Scaffold',
  patient: 'Anka Roth, mason on the Iron Bridge',
  diagnosis: 'Fell two storeys from the bridge scaffold onto her outstretched arm. The radius is through the skin; the ulna is broken beside it.',
  organ: 'bone',
  timeLimit: 360,
  baseDrain: 0.15,
  vitals: 90,
  tools: ALL,
  ranks: { S: 3000, A: 2400, B: 1800 },
  litany: true,
  seed: 313,
  tips: { time: 'The open break first — it bleeds. The closed one will keep a minute longer.' },
  phases: [
    {
      objective: 'Set the open break',
      callout: ['The radius is out through the skin. Set it — seize each piece with the tongs, turn it home, and pin it.'],
      spawn: [
        { e: 'fracture', at: [-40, -50], angle: 0.05, fragments: 3, compound: true, splinters: 1, wrap: 3 },
        { e: 'laceration', at: [-40, -10], angle: 0.1, len: 70, bleed: 0.8 },
      ],
    },
    {
      objective: 'Set the ulna',
      callout: ['Now the ulna, beside it. Closed — pull on the wrist to bring it out to length.'],
      spawn: [{ e: 'reduction', at: [40, 60], pull: [-200, 60], fragments: 2, wrap: 3 }],
    },
    {
      objective: 'Close her',
      callout: ['Both bound. Close what the bone tore, and tell the bridge-master she’s off his scaffold until spring.'],
      spawn: [{ e: 'laceration', at: [150, -60], angle: -0.3, len: 55, bleed: 0.4 }],
    },
  ],
});

/** Chapter IV: a collarbone broken by a pike-shaft in the Vennmark drill-yard. */
export const OP_4_11 = defineOp({
  id: 'op4-11',
  title: 'Pike-Shaft Blow',
  patient: 'Dietz Albrecht, pikeman of Mauer’s company',
  diagnosis: 'Took a pike-shaft across the shoulder at drill. The collarbone is broken in three, and the arm hangs.',
  organ: 'bone',
  timeLimit: 300,
  baseDrain: 0.1,
  tools: ALL,
  ranks: { S: 3000, A: 2400, B: 1800 },
  litany: true,
  seed: 411,
  tips: { time: 'Draw the shoulder back and set the pieces while it’s held. Three pieces — no dawdling between them.' },
  phases: [
    {
      objective: 'Set the collarbone',
      callout: ['Draw the shoulder back — traction on the arm — and set the collarbone while it’s out to length.', 'Then pin it and bind it well. He’ll be carrying a pike again before he should.'],
      spawn: [{ e: 'reduction', at: [-10, -80], pull: [230, -40], angle: 0.15, fragments: 3, wrap: 4 }],
    },
    {
      objective: 'Drain the bruise',
      callout: ['The blood’s pooled under the shoulder. Leech it off.'],
      spawn: [{ e: 'pool', at: [-120, 60], r: 28 }],
    },
  ],
});

/** Chapter V: a scrivener's hands broken on the Tribunal's rack, on Hollow Night. */
export const OP_5_10 = defineOp({
  id: 'op5-10',
  title: 'Rack-Broken Hands',
  patient: 'Konrad Pell, scrivener to the Tribunal',
  diagnosis: 'Racked as a Choir spy on the Tribunal’s own warrant, then released without a word. Both hands broken in the screws; small bones in pieces.',
  organ: 'bone',
  timeLimit: 420,
  baseDrain: 0.12,
  vitals: 85,
  env: ['candle'],
  tools: ALL,
  ranks: { S: 3000, A: 2400, B: 1800 },
  litany: true,
  seed: 510,
  tips: { time: 'Small bones, many of them. Set one hand fully before you start the other.' },
  phases: [
    {
      objective: 'The right hand',
      callout: ['The right hand first — he writes with it. Small pieces. Set each one, pin, and bind.'],
      spawn: [
        { e: 'fracture', at: [-150, -40], angle: 1.3, fragments: 3, splinters: 1, wrap: 2 },
        { e: 'fracture', at: [-40, -30], angle: 1.5, fragments: 2, splinters: 0, wrap: 2 },
      ],
    },
    {
      objective: 'The left hand',
      callout: ['Now the left. The screws went tighter on this side.'],
      spawn: [
        { e: 'fracture', at: [70, 40], angle: 1.4, fragments: 4, splinters: 1, wrap: 2 },
        { e: 'fracture', at: [190, 30], angle: 1.6, fragments: 2, splinters: 0, wrap: 2 },
      ],
    },
    {
      objective: 'The screw-wounds',
      callout: ['The screws broke the skin across both palms. Stitch them.'],
      spawn: [
        { e: 'laceration', at: [-100, 90], angle: 0, len: 60, bleed: 0.5 },
        { e: 'laceration', at: [130, 110], angle: 0.1, len: 60, bleed: 0.5 },
      ],
    },
  ],
});
