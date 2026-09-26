/**
 * Every gameplay tuning constant, keyed by system or ailment. Entity `update()`
 * and tool handlers read these through `op.tuning` so a single operation can
 * override any value (`OperationDef.tuning`) without touching the classes.
 *
 * Units: seconds, pixels (virtual 1280×720 space), vitals points, px/s.
 */
export const DEFAULT_TUNING = {
  scoring: {
    cool: 100,
    good: 60,
    bad: 15,
    miss: 0,
    /** Combo multiplier: 1 + min(combo, comboCap) × comboStep. */
    comboStep: 0.05,
    comboCap: 20,
    /** Seconds without a rated action before the combo lapses. */
    comboTimeout: 6,
    comboMilestones: [10, 20] as readonly number[],
    /** Ratings earned on boss-spawned adds are worth this fraction… */
    addPointsFactor: 0.25,
    /** …never push the combo past this… */
    addComboCap: 5,
    /** …and in total never exceed this fraction of the op's S threshold. */
    addScoreCapFrac: 0.15,
    vitalsBonus: 20,
    timeBonus: 10,
    /** Boss operations pay per remaining second at this rate instead. */
    bossTimeBonus: 8,
    /** Below this many seconds left the time bonus is forfeit. */
    timeBonusFloor: 10,
    /** XS: vitals must never have dipped below this. */
    xsVitalsFloor: 50,
    /** Closing the initial incision with a COOL adds this flat bonus. */
    closureBonus: 200,
  },
  vitals: {
    max: 99,
    warn: 30,
    critical: 15,
    hysteresis: 5,
    /** Recovery per second while nothing on the table drains the patient. */
    passiveRecovery: 0.15,
    /** Checkpoint restarts begin with this much vitals. */
    checkpoint: 70,
  },
  flow: {
    /** "Begin" beat before the first phase; input is ignored. */
    intro: 2,
    /** Breather between phases: drain frozen. */
    breather: 1.5,
    /** Timer turns red for the last N seconds. */
    timerWarn: 30,
  },
  litany: {
    duration: 8,
    scale: 0.15,
    /** Each COOL during the Litany extends it… */
    coolExtend: 0.25,
    /** …up to this much in total. */
    coolExtendMax: 3,
    /** Vigil / Mercy / Wrath variants last this long. */
    variantDuration: 6,
    wrathBrandMult: 2,
  },
  tincture: {
    time: 0.7,
    heal: 25,
    cooldown: 6,
    /** Rated COOL below this vitals value (needed)… */
    coolBelow: 40,
    /** …GOOD up to this… */
    goodBelow: 70,
    /** …and BAD ("wasteful") above this. */
    badAbove: 85,
    /** Must be at least this far from any open wound. */
    woundClearance: 30,
    /** Overdose: more than `overdoseDoses` doses within `overdoseWindow` s. */
    overdoseDoses: 3,
    overdoseWindow: 20,
    tremorTime: 5,
    tremorPx: 4,
    antivenomHold: 0.9,
    /** Stabilising doses that pay points (the rating still counts for the combo). Rescue is not surgery: none pay. */
    paidDoses: 0,
  },
  miss: {
    /** A tool held on nothing for this long is a MISS (plain clicks never are). */
    emptyHold: 0.25,
    strayCutHurt: 3,
  },
  incision: {
    startTol: 22,
    resumeTol: 30,
    slipDist: 34,
    coolDev: 6,
    goodDev: 14,
    overshoot: 20,
    overshootNick: 18,
    rushedSpeed: 1400,
    slowSpeed: 60,
    guideFade: 0.3,
    idleBleed: 0.2,
    slipHurt: 2,
  },
  stitch: {
    /** Stitches needed per px of wound. */
    pxPerStitch: 22,
    minSpacing: 10,
    coolMin: 10,
    coolMax: 28,
    goodMin: 6,
    goodMax: 40,
    gapBleed: 0.3,
    reach: 40,
    /** A crossing this close beyond either end of the wound still counts as a stitch (INP-0037). */
    endReach: 4,
  },
  laceration: {
    baseDrain: 0.05,
    drainPerPx: 0.01,
    poolEvery: 4,
    poolBase: 4,
    poolPerPx: 0.06,
    /** Pus touching an open wound turns it to rot after this long. */
    pusRotTime: 5,
    festerMinR: 24,
    festerPad: 8,
    festerSpread: 0.4,
    salveCoverage: 0.85,
  },
  blood: {
    baseDrain: 0.03,
    drainPerPx: 0.003,
    ichorDrain: 0.05,
    /** One "pool unit" is this many px of radius; drawn off in `unitTime` s at the centre. */
    unitPx: 25,
    unitTime: 0.9,
    rimFactor: 0.4,
    reach: 10,
    /** Pools below this fraction of their peak clear themselves. */
    autoClear: 0.1,
    coolTime: 1.5,
    goodTime: 3,
    minRated: 20,
    maxR: 70,
    refillHint: 3,
  },
  tongs: {
    grab: 22,
    assistPad: 6,
    coolAngle: 25,
    goodAngle: 50,
    /** Distance from the entry at which the pull direction is judged. */
    judgeAt: 18,
    heavyLag: 0.06,
    glassSpeed: 500,
    boltStage: 0.4,
    boltSnap: 0.7,
    boltPause: 0.3,
    boltStill: 40,
    hexWhisperEvery: 2,
    hexWhisperHurt: 2,
    hexCalm: 0.5,
    hexJitter: 8,
    tornBleed: 1.6,
    tornHurt: 8,
    tornExtra: 30,
    hexCorruptEvery: 10,
    hexCorruptMax: 4,
    hexCorruptDist: 60,
    hexCorruptRot: 18,
    hexCorruptAspect: 0.75,
    /** Silver Tongs upgrade: whisper damage multiplier. */
    silverTongs: 0.5,
  },
  salve: {
    capacity: 46,
    /** Capacity used per coverage cell. */
    perCell: 0.5,
    refillIdle: 3,
    brush: 26,
    coolCoverage: 0.95,
    goodCoverage: 0.8,
    regrowFrac: 0.2,
    woundLimit: 20,
  },
  brand: {
    grubHold: 0.8,
    grubSplitMin: 0.15,
    grubSplitMax: 0.4,
    sigilNode: 1.0,
    /** The brand does not hurt healthy flesh for the first N s of a hold (INP-0035): passing between grubs is free. */
    fleshGrace: 0.12,
    fleshBurnAfter: 0.5,
    fleshHurt: 4,
    overheatAfter: 6,
    overheatLock: 2,
    coolRate: 1.5,
    hexfireEmber: 0.5,
  },
  lens: {
    radius: 90,
    reveal: 0.4,
  },
  tools: {
    wheelDebounce: 0.08,
    wheelScale: 0.35,
  },
  burn: {
    fireDrain: 0.3,
    hexDrain: 0.5,
    acidDrain: 0.4,
    perFlake: 0.06,
    grade3Radius: 45,
    acidSpread: 6,
    acidMax: 80,
    acidNeutralise: 1,
    hexReignite: 3,
    hexTell: 0.8,
    reigniteHurt: 3,
    coverage: 0.9,
  },
  bubo: {
    swellTime: 30,
    burstHurt: 10,
    burstPool: 40,
    burstCut: 40,
    burstBleed: 0.7,
    lancedDrain: 0.1,
    drainBase: 0.2,
    drainPerPx: 0.01,
    minCut: 8,
  },
  rot: {
    growth: 2,
    maxR: 60,
    coverage: 0.95,
    baseDrain: 0.1,
    drainPerPx: 0.005,
  },
  venom: {
    baseDrain: 0.2,
    drainPerPx: 0.012,
    maxSpread: 120,
    moteEvery: 5,
    /** At most this many drops alive on a vein at once (CON-0052), so the field stays readable. */
    moteCap: 6,
    moteSpeed: 38,
    moteHurt: 10,
    moteHit: 16,
    antivenomSlow: 0.5,
  },
  grub: {
    drain: 0.35,
    burrowAfter: 6,
    hiddenDrain: 0.2,
    heatDecay: 0.5,
    grab: 18,
    seekStop: 12,
    steer: 2,
    wander: 2,
    smallSpeed: 1.3,
    bounceTurn: 0.75,
  },
  sigil: {
    drain: 0.4,
    lashHurt: 4,
    regressEvery: 4,
    wrongHurt: 3,
    reach: 14,
  },
  fever: {
    drain: 0.4,
    duration: 20,
  },
} as const;

type Widen<T> = T extends number ? number : T extends boolean ? boolean : T extends readonly (infer U)[] ? readonly Widen<U>[] : T extends object ? { -readonly [K in keyof T]: Widen<T[K]> } : T;
export type Tuning = Widen<typeof DEFAULT_TUNING>;
export type TuningOverride = { [K in keyof Tuning]?: Partial<Tuning[K]> };

/** Merge per-system overrides over the defaults (one level deep: system → key). */
export function mergeTuning(...overrides: (TuningOverride | undefined)[]): Tuning {
  const out = JSON.parse(JSON.stringify(DEFAULT_TUNING)) as Tuning;
  for (const o of overrides) {
    if (!o) continue;
    for (const k of Object.keys(o) as (keyof Tuning)[]) Object.assign(out[k], o[k]);
  }
  return out;
}
