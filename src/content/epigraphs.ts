/**
 * Title-screen epigraphs (NAR-0069) and the "Remembered Teachings" pause page (NAR-0053).
 * Original verse and notices; nothing quotes a real liturgy. Cosmetic choice by Math.random.
 */

export interface Epigraph {
  text: string;
  /** Where it is supposed to come from, shown as a small attribution. */
  source: string;
}

/** Eight rotating lines under the title: hymn fragments, guild notices, the ledger. */
export const EPIGRAPHS: readonly Epigraph[] = [
  { text: 'Here is the battlefield. Hold it.', source: 'Ink beneath the Wound Man, hospice theatre' },
  { text: 'Keep the lamp; carry the key; refuse no one.', source: 'The Merciful Order, its three vows' },
  { text: 'Practising without a licence is assault with a blade.', source: 'Guildhall of the Barber-Surgeons, notice at the door' },
  { text: 'Fees, vegetable: see overleaf.', source: 'The hospice ledger, Sister Ilse’s hand' },
  { text: 'Anything that works too well is evidence.', source: 'The Ash Tribunal, standing instruction to its officers' },
  { text: 'Who keeps the watch before the sun? The one who wakes, and wakes alone.', source: 'A hymn fragment, provenance unknown' },
  { text: 'Twelve went out. Twelve came back, eleven walking.', source: 'Roll of the Kessendorf Watch, ninth year of the Long Muster' },
  { text: 'Still your heart, and the world waits.', source: 'The old offices, as Master Haller remembers them' },
];

/** One epigraph per boot; `rng` is a unit-interval source (Math.random by default). */
export const pickEpigraph = (rng: () => number = Math.random): Epigraph => EPIGRAPHS[Math.min(EPIGRAPHS.length - 1, Math.floor(rng() * EPIGRAPHS.length))];

export interface Teaching {
  id: string;
  /** Haller's maxim, as he said it. */
  maxim: string;
  /** The plain gloss beneath it, for the pause page. */
  gloss: string;
}

/**
 * Remembered Teachings: Master Haller's maxims, re-openable from the pause overlay. The first two
 * are the Litany tutorial copy (NAR-0053): the star gesture explained in-fiction, in two prompts.
 */
export const REMEMBERED_TEACHINGS: readonly Teaching[] = [
  {
    id: 'litany-1',
    maxim: 'Still your heart, and the world waits. Draw the star — five points, one stroke, the right hand — and it will wait for you.',
    gloss: 'The Litany of Stillness: draw a five-pointed star with the right mouse button held. Time slows for eight heartbeats. Once in an operation.',
  },
  {
    id: 'litany-2',
    maxim: 'Use it when the wound is winning, not when you are tired. And never where the Inquisitor can see.',
    gloss: 'Spend the Litany on the worst moment: a boss phase, a patient slipping, three things bleeding at once. It cannot be spent twice.',
  },
  { id: 'drain', maxim: 'You cannot stitch through a pool of blood. Drain first, then look, then close.', gloss: 'The Leech-Pipe over any pool before the thread. Stitching over blood is blocked.' },
  { id: 'one-stroke', maxim: 'A cut is made once and is sorry never. Keep to the line and start at the glowing end.', gloss: 'Incisions: follow the inked line from its bright end in one motion. Wandering strokes cost vitals.' },
  { id: 'barbs', maxim: 'A barb torn out takes a mouthful of the man with it. Nick it free first.', gloss: 'Two lancet nicks at a barbed arrow’s entry, then the tongs. An un-nicked barb tears a bleeding wound.' },
  { id: 'salve', maxim: 'Salve over dead flesh only feeds the festering. Pluck the eschar, then salve.', gloss: 'Burns: tongs on the black crust first, Saint’s Salve after. Rot: salve every patch, and again where it creeps back.' },
  { id: 'tincture', maxim: 'The cordial steadies a failing heart. A man who does not need it will shake with it.', gloss: 'The Tincture restores vitals held on clean flesh. Overdosing a steady patient shakes your hands.' },
  { id: 'brand', maxim: 'Burn the grubs, not the man. The brand is a mercy for a moment and a wound after.', gloss: 'Hold the Cautery Brand only on grubs, sigils and Malison flesh. Lingering on bare skin damages the patient and the brand overheats.' },
  { id: 'lens', maxim: 'What hides can be found. Pass the glass slowly and trust the shimmer.', gloss: 'The Scrying Lens reveals hidden shards and sacs: pass it slowly, hold still where it shimmers.' },
  { id: 'the-man', maxim: 'A dead man has no wounds worth stitching. Attend to the man, then the wound.', gloss: 'When vitals fall, stop and steady the patient before finishing the task in hand.' },
  { id: 'tribunal', maxim: 'The Tribunal does not distinguish between a prayer and a spell. Neither should you, in company.', gloss: 'Story: the Litany is noticed. Some scenes change depending on whether it was spoken.' },
];
