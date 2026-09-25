import type { Operation } from './operation';

/**
 * Dynamic hints: after repeated losses on the same operation, Sister Ilse
 * offers one line of strategy specific to what went wrong. The cause is read
 * from the failed run (loss reason, one-shot warning flags, ratings).
 */
interface TipRule {
  id: string;
  /** Does this failed run show the problem? */
  test: (op: Operation) => boolean;
  tip: string;
}

const flag = (f: string) => (op: Operation) => op.flags.has(f);

/** Most specific first. */
export const TIP_RULES: readonly TipRule[] = [
  { id: 'acid', test: flag('acid-first'), tip: 'Draw the acid off with the leech-pipe before you salve — it eats through the salve otherwise.' },
  { id: 'barbs', test: flag('barbs'), tip: 'Two lancet nicks at the entry free a barbed head. Then pull along the shaft.' },
  { id: 'bolt', test: flag('bolt-snap'), tip: 'Bolts come in two pulls: ease it out a little, hold still a breath, then draw it clear.' },
  { id: 'axis', test: flag('axis'), tip: 'Pull things out the way they went in — follow the shaft’s line.' },
  { id: 'flooded', test: flag('flooded'), tip: 'You can’t stitch through a pool of blood. Drain first, then thread.' },
  { id: 'stitch-first', test: flag('stitch-first'), tip: 'A pool that keeps refilling has a wound beneath it: stitch the wound, then drain.' },
  { id: 'pus', test: flag('pus-wound'), tip: 'Drain the pus before it reaches an open cut — it festers into rot.' },
  { id: 'bubo', test: (op) => op.counts.miss > 0 && op.flags.has('bubo-cut'), tip: 'Lance buboes with a short cut across the crown, not a prick.' },
  { id: 'sigil', test: flag('sigil-order'), tip: 'Curse-sigils burn in order: hold the brand on node 1, trace it, then node 2.' },
  { id: 'sigil-regress', test: flag('sigil-regress'), tip: 'Finish a sigil stroke once you start it — the curse knits back what you leave.' },
  { id: 'grub-split', test: flag('grub-split'), tip: 'Keep the brand on a grub until it stops wriggling. Let go early and it splits.' },
  { id: 'hexstone', test: flag('hex-whisper'), tip: 'Brand hexstone still first, then carry it straight to the lead dish — don’t dawdle with it in the tongs.' },
  { id: 'hexfire', test: flag('hex-tell'), tip: 'Hexfire burns rekindle unless you brand out the ember before you salve.' },
  { id: 'overheat', test: flag('overheat'), tip: 'The brand overheats after six seconds of use — lift it between searings.' },
  { id: 'venom', test: flag('venom-mote'), tip: 'Treat venom first: the longer it lives, the more drops race for the heart.' },
  { id: 'brand-flesh', test: (op) => op.flags.has('brand-flesh') && op.counts.bad > 0, tip: 'Only put the brand down on what needs searing — healthy flesh burns.' },
  { id: 'malison', test: (op) => op.bossOp && op.lostCause === 'vitals', tip: 'Against the Malison, brand only while it is open, and keep the tincture ready between its openings.' },
  { id: 'vitals', test: (op) => op.lostCause === 'vitals', tip: 'Inject the tincture as soon as vitals drop below forty — don’t wait for the alarm.' },
  { id: 'time', test: (op) => op.lostCause === 'time', tip: 'We ran out of time. Pick the instrument before you reach the wound — hotkeys 1 to 8 are quickest.' },
];

/** The most relevant tip for a failed operation, or null if nothing specific applies. */
export function tipFor(op: Operation): { id: string; text: string } | null {
  const own = op.def.tips?.[op.lostCause];
  if (own) return { id: `own-${op.lostCause}`, text: own };
  for (const r of TIP_RULES) if (r.test(op)) return { id: r.id, text: r.tip };
  return null;
}

/** Tips are offered once the same operation has been failed this many times. */
export const TIP_AFTER_FAILURES = 2;
