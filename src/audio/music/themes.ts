/**
 * Procedural score. Each theme is a set of synchronised layers ("stems")
 * generated bar by bar from a mode, a chord cycle and composed phrases, so the
 * adaptive system can fade stems in and out and change sections on the bar.
 *
 * The Hollow Choir leitmotif (root, ♭2, 5, 4, ♭2, root) threads through every
 * Malison hour, the title theme and the demo-end teaser.
 */
import type { InstId } from './instruments';

export type LayerId = 'bed' | 'pulse' | 'melody' | 'tension' | 'danger' | 'clock' | 'flow' | 'stillness';
export const LAYERS: readonly LayerId[] = ['bed', 'pulse', 'melody', 'tension', 'danger', 'clock', 'flow', 'stillness'];

export interface NoteEv {
  inst: InstId;
  midi: number;
  beat: number;
  dur: number;
  vel: number;
}

export interface BarCtx {
  /** Bar index within the current section. */
  bar: number;
  /** Bars since the track started. */
  abs: number;
  /** Chord (scale degree) of this bar. */
  chord: number;
  section: string;
  beats: number;
  root: number;
  /** MIDI note of a scale degree (0 = root), shifted by octaves. */
  deg(d: number, oct?: number): number;
}

export type Pattern = (c: BarCtx) => NoteEv[];

export interface Section {
  chords: readonly number[];
  layers?: Partial<Record<LayerId, Pattern>>;
}

export interface Theme {
  id: string;
  bpm: number;
  beats: number;
  /** MIDI root. */
  root: number;
  mode: readonly number[];
  layers: Partial<Record<LayerId, Pattern>>;
  sections: Record<string, Section>;
  /** Sections played in sequence (a through-composed loop). Omit for state-driven sections. */
  order?: readonly string[];
  /** Played once before the loop (e.g. first boot of the title). */
  intro?: Section;
  /** Default layer gains 0..1. */
  defaults: Partial<Record<LayerId, number>>;
}

export const MODES = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  phrygianDom: [0, 1, 4, 5, 7, 8, 10],
} as const;

/** The Hollow Choir leitmotif: [semitones from root | null rest, beats]. */
export const LEITMOTIF: readonly (readonly [number | null, number])[] = [
  [0, 1],
  [1, 1],
  [7, 1.5],
  [5, 0.5],
  [1, 1],
  [0, 3],
];

// ---------------------------------------------------------------- pattern builders

const n = (inst: InstId, midi: number, beat: number, dur: number, vel: number): NoteEv => ({ inst, midi, beat, dur, vel });

/** Sustain chord-relative degrees for the whole bar. */
export const sus =
  (inst: InstId, rel: readonly number[], oct = 0, vel = 0.7): Pattern =>
  (c) =>
    rel.map((k) => n(inst, c.deg(c.chord + k, oct), 0, c.beats, vel));

/** Sustain fixed scale degrees (pedals, drones). */
export const pedal =
  (inst: InstId, degs: readonly number[], oct = 0, vel = 0.7, everyBars = 1): Pattern =>
  (c) =>
    c.abs % everyBars === 0 ? degs.map((d) => n(inst, c.deg(d, oct), 0, c.beats * everyBars, vel)) : [];

/** Arpeggiate chord-relative degrees at a fixed step (beats). */
export const arp =
  (inst: InstId, seq: readonly number[], step: number, oct = 0, vel = 0.6, accent = 0.25): Pattern =>
  (c) => {
    const out: NoteEv[] = [];
    let i = 0;
    for (let b = 0; b < c.beats - 1e-6; b += step, i++) out.push(n(inst, c.deg(c.chord + seq[i % seq.length], oct), b, step, vel * (b % 1 === 0 && b === 0 ? 1 + accent : 1)));
    return out;
  };

/** Percussion or stabs on given beats, pitched on the chord root (+rel). */
export const hits =
  (inst: InstId, beats: readonly number[], vel = 0.7, oct = 0, rel = 0, dur = 0.5): Pattern =>
  (c) =>
    beats.filter((b) => b < c.beats).map((b, i) => n(inst, c.deg(c.chord + rel, oct), b, dur, vel * (i === 0 ? 1 : 0.8)));

/** Fixed-pitch percussion (MIDI), independent of the harmony. */
export const perc =
  (inst: InstId, midi: number, beats: readonly number[], vel = 0.7): Pattern =>
  (c) =>
    beats.filter((b) => b < c.beats).map((b, i) => n(inst, midi, b, 0.25, vel * (i === 0 ? 1 : 0.75)));

/** A through-composed melody in scale degrees, looping over its own length. */
export const tune = (inst: InstId, phrase: readonly (readonly [number | null, number])[], oct = 0, vel = 0.7, semitone = false): Pattern => {
  const onsets: [number | null, number, number][] = [];
  let t = 0;
  for (const [d, len] of phrase) {
    onsets.push([d, t, len]);
    t += len;
  }
  const total = t;
  return (c) => {
    const start = (c.bar * c.beats) % total;
    const out: NoteEv[] = [];
    for (const [d, on, len] of onsets) {
      if (d === null) continue;
      let rel = on - start;
      if (rel < 0) rel += total;
      if (rel >= c.beats) continue;
      const midi = semitone ? c.root + d + 12 * oct : c.deg(d, oct);
      out.push(n(inst, midi, rel, len * 0.95, vel));
    }
    return out;
  };
};

/** Only on bars where abs % every === offset. */
export const every =
  (everyBars: number, p: Pattern, offset = 0): Pattern =>
  (c) =>
    c.abs % everyBars === offset ? p(c) : [];

export const both =
  (...ps: Pattern[]): Pattern =>
  (c) =>
    ps.flatMap((p) => p(c));

/** Upper pedal a semitone above the root: the tension clash. */
const clash =
  (inst: InstId, oct = 1, vel = 0.5): Pattern =>
  (c) => [n(inst, c.root + 1 + 12 * oct, 0, c.beats, vel)];

/** Leitmotif on a chosen instrument (semitones from the root). */
export const leit = (inst: InstId, oct = 1, vel = 0.7): Pattern => tune(inst, LEITMOTIF, oct, vel, true);

/** Ornamental runs for the "flow" layer. */
const runs =
  (inst: InstId, oct = 1, vel = 0.45): Pattern =>
  (c) => {
    if (c.abs % 2 === 1) return [];
    const out: NoteEv[] = [];
    const up = c.abs % 4 === 0;
    for (let i = 0; i < 6; i++) out.push(n(inst, c.deg(c.chord + (up ? i : 5 - i), oct), 2 + i * 0.25, 0.25, vel * (i === 0 ? 1.2 : 1)));
    out.push(n(inst, c.deg(c.chord + (up ? 7 : 0), oct), 3.5, 0.5, vel));
    return out;
  };

// ---------------------------------------------------------------- phrases

const TITLE_A: [number | null, number][] = [
  [4, 1], [3, 0.5], [2, 0.5], [3, 1], [4, 1],
  [5, 1.5], [4, 0.5], [3, 2],
  [2, 1], [1, 0.5], [0, 0.5], [1, 1], [2, 1],
  [1, 2], [0, 2],
  [4, 1], [5, 0.5], [6, 0.5], [7, 1], [6, 1],
  [5, 1.5], [4, 0.5], [3, 2],
  [2, 1], [3, 0.5], [2, 0.5], [1, 1], [-1, 1],
  [0, 4],
];
const TITLE_B: [number | null, number][] = [
  [7, 1], [6, 0.5], [5, 0.5], [4, 1], [5, 1],
  [6, 1.5], [5, 0.5], [4, 2],
  [3, 1], [4, 0.5], [5, 0.5], [4, 1], [3, 1],
  [2, 2], [1, 1], [0, 1],
  [2, 1.5], [3, 0.5], [4, 2],
  [5, 1], [4, 1], [3, 1], [2, 1],
  [1, 3], [null, 1],
  [0, 4],
];
const HOSPICE: [number | null, number][] = [
  [2, 1.5], [3, 0.5], [4, 1],
  [3, 1], [2, 1], [1, 1],
  [0, 2], [null, 1],
  [4, 1.5], [5, 0.5], [6, 1],
  [5, 1], [4, 2],
  [3, 1], [2, 1], [1, 1],
  [2, 3],
];
const SORROW: [number | null, number][] = [
  [4, 2], [3, 1], [2, 1],
  [3, 3], [null, 1],
  [2, 2], [1, 1], [0, 1],
  [1, 2], [-1, 2],
  [0, 4],
  [null, 4],
];
const TENSE: [number | null, number][] = [
  [0, 1.5], [1, 0.5], [0, 2],
  [null, 2], [-2, 1], [-1, 1],
  [0, 1], [1, 1], [3, 1], [1, 1],
  [0, 4],
];
const OP_A_HOOK: [number | null, number][] = [
  [4, 0.5], [4, 0.5], [5, 0.5], [4, 0.5], [3, 1], [2, 1],
  [3, 0.5], [3, 0.5], [4, 0.5], [3, 0.5], [2, 1], [1, 1],
  [2, 1], [0, 1], [1, 1], [-1, 1],
  [0, 2], [null, 2],
];
const OP_B_HOOK: [number | null, number][] = [
  [0, 0.5], [1, 0.5], [0, 0.5], [-1, 0.5], [0, 1], [null, 1],
  [2, 0.5], [3, 0.5], [2, 0.5], [1, 0.5], [0, 1], [null, 1],
  [4, 1], [3, 0.5], [1, 0.5], [2, 1], [1, 1],
  [0, 2], [null, 2],
];
const MAGNIFICAT_INV: [number | null, number][] = [
  [4, 1], [4, 1], [3, 1], [4, 1],
  [3, 1], [2, 1], [1, 2],
  [2, 1], [1, 1], [0, 1], [-1, 1],
  [0, 4],
];
const PRIME_CHANT: [number | null, number][] = [
  [0, 1], [2, 1], [3, 1], [4, 1],
  [4, 1], [4, 1], [3, 1], [4, 1],
  [5, 1], [4, 1], [3, 1], [2, 1],
  [3, 2], [2, 2],
];

// ---------------------------------------------------------------- operation layers shared shape

function opLayers(o: { bed: InstId; pulse: InstId; drumLo: InstId; tension: InstId; brass: InstId; flow: InstId; hook: [number | null, number][]; hookInst: InstId }): Partial<Record<LayerId, Pattern>> {
  return {
    bed: both(sus(o.bed, [0, 4], -1, 0.6), sus('organ', [0, 2, 4], 0, 0.35)),
    pulse: both(arp(o.pulse, [0, 2, 4, 2, 7, 4, 2, 4], 0.5, 0, 0.55), perc('drum', 45, [0, 2], 0.7), perc(o.drumLo, 50, [1.5, 3.5], 0.5)),
    melody: tune(o.hookInst, o.hook, 0, 0.5),
    tension: both(sus(o.tension, [2, 6], 0, 0.45), clash('violTrem', 1, 0.3)),
    danger: both(hits(o.brass, [0, 1.5, 3], 0.75, -1, 0, 0.6), perc('drum', 43, [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], 0.5), (c) => [n(o.brass, c.deg(c.chord, -1) + 6, 3.5, 0.4, 0.5)]),
    clock: both(perc('tick', 84, [0, 1, 2, 3], 0.6), perc('tick', 79, [0.5, 1.5, 2.5, 3.5], 0.35)),
    flow: runs(o.flow, 1, 0.45),
    stillness: sus('pad', [0, 4, 8], 0, 0.8),
  };
}

// ---------------------------------------------------------------- boss themes

interface BossSpec {
  id: string;
  root: number;
  mode: readonly number[];
  bpm: number;
  bed: InstId;
  voice: InstId;
  bellEvery: number;
  pulse: InstId;
  brass: InstId;
  sections: Record<string, readonly number[]>;
  /** Per-section intensity: 0 calm, 1 driven, 2 frantic. */
  drive: Record<string, number>;
  melody?: [number | null, number][];
}

function bossTheme(b: BossSpec): Theme {
  const sections: Record<string, Section> = {};
  for (const [name, chords] of Object.entries(b.sections)) {
    const d = b.drive[name] ?? 1;
    sections[name] = {
      chords,
      layers: {
        pulse:
          d === 0
            ? both(perc('drum', 40, [0], 0.6), every(2, pedal('bell', [0], -1, 0.6)))
            : d === 1
              ? both(arp(b.pulse, [0, 4, 7, 4], 0.5, -1, 0.5), perc('drum', 40, [0, 1.5, 2, 3], 0.7))
              : both(arp(b.pulse, [0, 1, 4, 1, 7, 4, 1, 4], 0.25, -1, 0.45), perc('drum', 40, [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], 0.6), perc('tabor', 55, [1, 3], 0.6)),
      },
    };
  }
  return {
    id: b.id,
    bpm: b.bpm,
    beats: 4,
    root: b.root,
    mode: b.mode,
    sections,
    defaults: { bed: 1, pulse: 1, melody: 0.9, tension: 0, danger: 0, clock: 0, flow: 0, stillness: 0 },
    layers: {
      bed: both(sus(b.bed, [0, 4], -1, 0.6), pedal('drone', [0], -2, 0.5), every(b.bellEvery, pedal('bell', [0], -1, 0.8))),
      melody: both(leit(b.voice, 0, 0.6), b.melody ? every(4, tune('chant', b.melody, 1, 0.4), 2) : () => []),
      tension: both(sus('violTrem', [1, 5], 0, 0.45), clash('violTrem', 1, 0.35)),
      danger: both(hits(b.brass, [0, 1.5, 3], 0.8, -1, 0, 0.6), perc('drum', 38, [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], 0.55), (c) => [n(b.brass, c.deg(c.chord, -1) + 6, 3.5, 0.4, 0.5)]),
      clock: both(perc('tick', 84, [0, 1, 2, 3], 0.6), perc('tick', 79, [0.5, 1.5, 2.5, 3.5], 0.35)),
      flow: runs('recorder', 1, 0.35),
      stillness: sus('pad', [0, 4, 7], 0, 0.8),
    },
  };
}

// ---------------------------------------------------------------- the themes

export const THEMES: Record<string, Theme> = {
  title: {
    id: 'title',
    bpm: 76,
    beats: 4,
    root: 50,
    mode: MODES.dorian,
    intro: { chords: [0, 0, 6, 6, 0, 0], layers: { melody: every(3, leit('chant', 0, 0.55), 1), pulse: every(3, pedal('bell', [0], -1, 0.7)) } },
    sections: {
      A: { chords: [0, 0, 6, 6, 3, 3, 4, 4, 0, 0, 6, 6, 3, 4, 0, 0] },
      B: { chords: [5, 5, 3, 3, 6, 6, 4, 4, 5, 5, 3, 3, 1, 1, 4, 4], layers: { melody: both(tune('gurdy', TITLE_B, 1, 0.6), every(8, leit('chant', 0, 0.45), 4)) } },
      A2: { chords: [0, 0, 6, 6, 3, 3, 4, 4, 0, 0, 6, 6, 3, 4, 0, 0], layers: { melody: both(tune('gurdy', TITLE_A, 1, 0.55), tune('recorder', TITLE_A, 2, 0.35)) } },
    },
    order: ['A', 'B', 'A2'],
    defaults: { bed: 1, pulse: 1, melody: 1, stillness: 0 },
    layers: {
      bed: both(pedal('drone', [0], -1, 0.7), sus('choirU', [0, 2, 4], 0, 0.45)),
      pulse: both(perc('drum', 38, [0], 0.45), arp('lute', [0, 4, 7, 4], 1, 0, 0.4)),
      melody: tune('gurdy', TITLE_A, 1, 0.6),
      stillness: sus('pad', [0, 4, 7], 0, 0.7),
    },
  },
  hospice: {
    id: 'hospice',
    bpm: 72,
    beats: 4,
    root: 55,
    mode: MODES.mixolydian,
    sections: { A: { chords: [0, 0, 3, 3, 4, 4, 0, 0, 5, 5, 3, 3, 6, 6, 4, 4] }, B: { chords: [3, 3, 0, 0, 5, 5, 4, 4, 3, 3, 6, 6, 1, 1, 4, 0], layers: { melody: tune('recorder', HOSPICE, 2, 0.4) } } },
    order: ['A', 'B'],
    defaults: { bed: 1, pulse: 1, melody: 0.9 },
    layers: {
      bed: sus('viol', [0, 4], -1, 0.45),
      pulse: arp('lute', [0, 2, 4, 7, 4, 2], 2 / 3, -1, 0.5),
      melody: tune('recorder', HOSPICE, 1, 0.5),
      stillness: sus('pad', [0, 4], 0, 0.6),
    },
  },
  tense: {
    id: 'tense',
    bpm: 66,
    beats: 4,
    root: 48,
    mode: MODES.phrygian,
    sections: { A: { chords: [0, 0, 1, 0, 0, 0, 6, 1, 0, 0, 1, 0, 5, 5, 6, 1, 0, 0, 1, 0, 0, 0, 6, 1, 0, 1, 0, 0] } },
    order: ['A'],
    defaults: { bed: 1, pulse: 1, melody: 0.8, tension: 0.6 },
    layers: {
      bed: both(pedal('drone', [0], -1, 0.6), sus('viol', [0], -1, 0.5)),
      pulse: both(perc('drum', 36, [0, 0.4], 0.6), arp('violPizz', [0, 4, 1, 4], 1, -1, 0.5)),
      melody: tune('sackbut', TENSE, -1, 0.5),
      tension: clash('violTrem', 0, 0.3),
      stillness: sus('pad', [0, 4], 0, 0.6),
    },
  },
  sorrow: {
    id: 'sorrow',
    bpm: 58,
    beats: 4,
    root: 57,
    mode: MODES.aeolian,
    sections: { A: { chords: [0, 0, 5, 5, 3, 3, 4, 4, 0, 5, 3, 6, 2, 2, 4, 4, 5, 5, 3, 3, 1, 1, 4, 4] } },
    order: ['A'],
    defaults: { bed: 1, pulse: 0.8, melody: 1 },
    layers: {
      bed: sus('organ', [0, 2, 4], -1, 0.5),
      pulse: arp('lute', [0, 4, 2, 4], 1, -1, 0.35),
      melody: tune('viol', SORROW, 0, 0.55),
      stillness: sus('pad', [0, 4], 0, 0.6),
    },
  },
  briefing: {
    id: 'briefing',
    bpm: 70,
    beats: 4,
    root: 50,
    mode: MODES.dorian,
    sections: { A: { chords: [0, 0, 6, 6, 3, 3, 4, 4, 0, 0, 6, 6, 5, 5, 4, 4, 3, 3, 4, 0] } },
    order: ['A'],
    defaults: { bed: 1, pulse: 1 },
    layers: {
      bed: sus('viol', [0], -1, 0.35),
      pulse: arp('lute', [0, 4, 7, 9, 7, 4], 2 / 3, -1, 0.35),
      stillness: sus('pad', [0, 4], 0, 0.6),
    },
  },
  opA: {
    id: 'opA',
    bpm: 120,
    beats: 4,
    root: 50,
    mode: MODES.dorian,
    sections: {
      A: { chords: [0, 0, 6, 6, 3, 3, 4, 4, 0, 0, 6, 6, 3, 3, 4, 0] },
      B: { chords: [5, 5, 6, 6, 3, 3, 4, 4, 5, 5, 6, 6, 1, 1, 4, 4] },
      C: { chords: [0, 3, 6, 4, 0, 3, 6, 4, 5, 3, 6, 4, 5, 3, 4, 4], layers: { melody: tune('recorder', OP_A_HOOK, 1, 0.4) } },
    },
    order: ['A', 'B', 'A', 'C'],
    defaults: { bed: 1, pulse: 1, melody: 0.6, tension: 0, danger: 0, clock: 0, flow: 0, stillness: 0 },
    layers: opLayers({ bed: 'viol', pulse: 'lute', drumLo: 'tabor', tension: 'violTrem', brass: 'sackbut', flow: 'recorder', hook: OP_A_HOOK, hookInst: 'gurdy' }),
  },
  opB: {
    id: 'opB',
    bpm: 126,
    beats: 4,
    root: 52,
    mode: MODES.phrygian,
    sections: {
      A: { chords: [0, 0, 1, 1, 6, 6, 0, 0, 3, 3, 1, 1, 6, 5, 0, 0] },
      B: { chords: [3, 3, 1, 1, 5, 5, 6, 6, 3, 3, 1, 1, 4, 4, 0, 0] },
      C: { chords: [0, 1, 0, 6, 0, 1, 3, 1, 5, 6, 0, 1, 5, 6, 0, 0], layers: { melody: tune('shawm', OP_B_HOOK, 1, 0.35) } },
    },
    order: ['A', 'B', 'A', 'C'],
    defaults: { bed: 1, pulse: 1, melody: 0.6, tension: 0, danger: 0, clock: 0, flow: 0, stillness: 0 },
    layers: opLayers({ bed: 'shawm', pulse: 'violPizz', drumLo: 'tabor', tension: 'violTrem', brass: 'sackbut', flow: 'shawm', hook: OP_B_HOOK, hookInst: 'gurdy' }),
  },
  matins: bossTheme({
    id: 'matins',
    root: 47,
    mode: MODES.phrygian,
    bpm: 72,
    bed: 'organ',
    voice: 'chant',
    bellEvery: 2,
    pulse: 'violPizz',
    brass: 'sackbut',
    sections: { veiled: [0, 0, 1, 0, 6, 6, 1, 0], open: [0, 1, 3, 1, 0, 6, 5, 1], shards: [0, 1, 0, 1, 6, 1, 6, 1] },
    drive: { veiled: 0, open: 1, shards: 2 },
    melody: PRIME_CHANT,
  }),
  lauds: bossTheme({
    id: 'lauds',
    root: 55,
    mode: MODES.lydian,
    bpm: 96,
    bed: 'organ',
    voice: 'choir',
    bellEvery: 4,
    pulse: 'lute',
    brass: 'sackbut',
    sections: { choir: [0, 4, 1, 0, 3, 4, 1, 0], exposed: [0, 1, 4, 1, 0, 3, 1, 1], submerged: [0, 0, 1, 1, 0, 0, 6, 6], shattered: [0, 1, 0, 1, 3, 1, 4, 1] },
    drive: { choir: 1, exposed: 2, submerged: 0, shattered: 2 },
    melody: MAGNIFICAT_INV,
  }),
  prime: bossTheme({ id: 'prime', root: 57, mode: MODES.dorian, bpm: 84, bed: 'organ', voice: 'chant', bellEvery: 4, pulse: 'lute', brass: 'sackbut', sections: { a: [0, 3, 4, 0], b: [5, 3, 1, 4], c: [0, 1, 0, 1] }, drive: { a: 0, b: 1, c: 2 }, melody: PRIME_CHANT }),
  terce: bossTheme({ id: 'terce', root: 48, mode: MODES.mixolydian, bpm: 104, bed: 'sackbut', voice: 'sackbut', bellEvery: 4, pulse: 'violPizz', brass: 'sackbut', sections: { a: [0, 4, 6, 0], b: [0, 1, 6, 1], c: [0, 1, 0, 1] }, drive: { a: 1, b: 1, c: 2 } }),
  sext: bossTheme({ id: 'sext', root: 50, mode: MODES.phrygianDom, bpm: 92, bed: 'shawm', voice: 'shawm', bellEvery: 8, pulse: 'violPizz', brass: 'shawm', sections: { a: [0, 0, 1, 0], b: [0, 1, 5, 1], c: [0, 1, 0, 1] }, drive: { a: 0, b: 1, c: 2 } }),
  none: bossTheme({ id: 'none', root: 41, mode: MODES.aeolian, bpm: 60, bed: 'organ', voice: 'organ', bellEvery: 1, pulse: 'violPizz', brass: 'sackbut', sections: { a: [0, 5, 3, 4], b: [0, 1, 5, 4], c: [0, 1, 0, 1] }, drive: { a: 0, b: 1, c: 2 }, melody: SORROW }),
  vespers: bossTheme({ id: 'vespers', root: 52, mode: MODES.aeolian, bpm: 80, bed: 'viol', voice: 'choir', bellEvery: 4, pulse: 'lute', brass: 'sackbut', sections: { a: [0, 3, 4, 0], b: [5, 1, 4, 0], c: [0, 1, 0, 1] }, drive: { a: 0, b: 1, c: 2 }, melody: MAGNIFICAT_INV }),
  compline: bossTheme({ id: 'compline', root: 49, mode: MODES.phrygian, bpm: 66, bed: 'choirU', voice: 'choir', bellEvery: 2, pulse: 'violPizz', brass: 'sackbut', sections: { a: [0, 0, 1, 0], b: [0, 1, 6, 1], c: [0, 1, 0, 1], d: [0, 6, 5, 1] }, drive: { a: 0, b: 1, c: 2, d: 2 }, melody: PRIME_CHANT }),
  resultsWin: {
    id: 'resultsWin',
    bpm: 80,
    beats: 4,
    root: 53,
    mode: MODES.ionian,
    sections: { A: { chords: [0, 3, 4, 0, 5, 3, 4, 4] } },
    order: ['A'],
    defaults: { bed: 1, pulse: 1 },
    layers: { bed: sus('organ', [0, 2, 4], -1, 0.45), pulse: arp('lute', [0, 2, 4, 7], 1, 0, 0.45), stillness: sus('pad', [0, 4], 0, 0.5) },
  },
  resultsLoss: {
    id: 'resultsLoss',
    bpm: 60,
    beats: 4,
    root: 50,
    mode: MODES.aeolian,
    sections: { A: { chords: [0, 5, 3, 4, 0, 5, 1, 4] } },
    order: ['A'],
    defaults: { bed: 1, pulse: 0.7 },
    layers: { bed: sus('organ', [0, 2, 4], -1, 0.4), pulse: every(2, pedal('bell', [0], -1, 0.4)), stillness: sus('pad', [0, 4], 0, 0.5) },
  },
  demoEnd: {
    id: 'demoEnd',
    bpm: 70,
    beats: 4,
    root: 57,
    mode: MODES.dorian,
    sections: { A: { chords: [0, 0, 3, 3, 0, 0, 6, 6] } },
    order: ['A'],
    defaults: { bed: 1, melody: 0.8, pulse: 0.6 },
    layers: {
      bed: both(pedal('drone', [0], -1, 0.45), sus('choirU', [0, 4], 0, 0.3)),
      melody: every(2, leit('recorder', 1, 0.5)),
      pulse: every(4, pedal('bell', [0], -1, 0.45)),
    },
  },
};

// ---------------------------------------------------------------- full game (Alpha–Release)

const OP_C_HOOK: [number | null, number][] = [
  [0, 0.5], [2, 0.5], [3, 0.5], [4, 0.5], [3, 1], [2, 1],
  [1, 0.5], [0, 0.5], [-1, 1], [0, 2],
  [4, 0.5], [5, 0.5], [6, 0.5], [7, 0.5], [6, 1], [4, 1],
  [3, 1], [2, 1], [1, 2],
];
const OP_D_HOOK: [number | null, number][] = [
  [0, 1], [1, 0.5], [0, 0.5], [4, 1], [3, 1],
  [1, 1], [0, 1], [-2, 2],
  [0, 0.5], [1, 0.5], [3, 0.5], [4, 0.5], [5, 1], [4, 1],
  [1, 3], [null, 1],
];
const CREDITS: [number | null, number][] = [
  [0, 2], [1, 1], [0, 1],
  [4, 3], [3, 1],
  [1, 2], [2, 2],
  [0, 4],
  [4, 2], [5, 1], [4, 1],
  [7, 3], [6, 1],
  [4, 2], [2, 2],
  [0, 4],
];

/** A faster, busier variant of a theme (challenge mode). */
function remix(base: Theme, id: string, bpmScale: number): Theme {
  return {
    ...base,
    id,
    bpm: Math.round(base.bpm * bpmScale),
    defaults: { ...base.defaults, clock: 0.6, melody: 0.8 },
    layers: { ...base.layers, pulse: both(base.layers.pulse ?? (() => []), perc('tabor', 52, [0.5, 1.5, 2.5, 3.5], 0.45)) },
  };
}

function discipline(id: string, root: number, mode: readonly number[], bpm: number, layers: Partial<Record<LayerId, Pattern>>, chords: readonly number[], defaults: Partial<Record<LayerId, number>>): Theme {
  return { id, bpm, beats: 4, root, mode, sections: { A: { chords } }, order: ['A'], defaults: { stillness: 0, ...defaults }, layers: { stillness: sus('pad', [0, 4], 0, 0.7), ...layers } };
}

export const LATER_THEMES: Record<string, Theme> = {
  opC: {
    id: 'opC',
    bpm: 132,
    beats: 4,
    root: 55,
    mode: MODES.aeolian,
    sections: {
      A: { chords: [0, 0, 5, 5, 3, 3, 4, 4, 0, 0, 5, 5, 6, 6, 4, 4] },
      B: { chords: [3, 3, 4, 4, 0, 0, 5, 5, 3, 3, 1, 1, 4, 4, 4, 4] },
      C: { chords: [0, 5, 3, 4, 0, 5, 1, 4, 5, 6, 0, 4, 5, 6, 4, 4], layers: { melody: tune('shawm', OP_C_HOOK, 1, 0.35) } },
    },
    order: ['A', 'B', 'A', 'C'],
    defaults: { bed: 1, pulse: 1, melody: 0.6, tension: 0, danger: 0, clock: 0, flow: 0, stillness: 0 },
    layers: opLayers({ bed: 'viol', pulse: 'violPizz', drumLo: 'tabor', tension: 'violTrem', brass: 'sackbut', flow: 'recorder', hook: OP_C_HOOK, hookInst: 'gurdy' }),
  },
  opD: {
    id: 'opD',
    bpm: 138,
    beats: 4,
    root: 49,
    mode: MODES.phrygianDom,
    sections: {
      A: { chords: [0, 0, 1, 1, 0, 0, 6, 6, 0, 0, 1, 1, 5, 5, 1, 1] },
      B: { chords: [3, 3, 1, 1, 6, 6, 0, 0, 3, 3, 1, 1, 4, 4, 0, 0] },
      C: { chords: [0, 1, 0, 1, 6, 1, 0, 1, 3, 1, 6, 1, 5, 1, 0, 0], layers: { melody: tune('sackbut', OP_D_HOOK, 0, 0.4) } },
    },
    order: ['A', 'B', 'A', 'C'],
    defaults: { bed: 1, pulse: 1, melody: 0.6, tension: 0.2, danger: 0, clock: 0, flow: 0, stillness: 0 },
    layers: opLayers({ bed: 'shawm', pulse: 'lute', drumLo: 'tabor', tension: 'violTrem', brass: 'sackbut', flow: 'shawm', hook: OP_D_HOOK, hookInst: 'shawm' }),
  },
  // Disciplines: field triage (distant battle drums), diagnosis (sparse viol),
  // forensic/inquisition (tense low strings), bone-setting (rhythmic, percussive).
  triage: discipline('triage', 50, MODES.dorian, 100, {
    bed: both(pedal('drone', [0], -1, 0.5), sus('viol', [0, 4], -1, 0.4)),
    pulse: both(perc('drum', 38, [0, 0.75, 1.5, 2, 3], 0.7), perc('tabor', 55, [1, 2.5, 3.5], 0.45)),
    melody: every(2, tune('sackbut', OP_A_HOOK, -1, 0.35)),
    tension: sus('violTrem', [2, 6], 0, 0.4),
  }, [0, 0, 6, 6, 3, 3, 4, 4], { bed: 1, pulse: 1, melody: 0.5, tension: 0 }),
  diagnosis: discipline('diagnosis', 57, MODES.dorian, 64, {
    bed: sus('viol', [0], -1, 0.35),
    pulse: arp('violPizz', [0, 4, 2, 4], 1, 0, 0.35),
    melody: every(2, tune('recorder', HOSPICE, 1, 0.3)),
  }, [0, 0, 3, 3, 5, 5, 4, 4], { bed: 1, pulse: 1, melody: 0.6 }),
  forensic: discipline('forensic', 45, MODES.phrygian, 58, {
    bed: both(pedal('drone', [0], -1, 0.5), sus('viol', [0, 1], -1, 0.45)),
    pulse: perc('drum', 34, [0, 0.35], 0.55),
    tension: clash('violTrem', 0, 0.3),
  }, [0, 0, 1, 0, 6, 6, 1, 1], { bed: 1, pulse: 1, tension: 0.6 }),
  boneset: discipline('boneset', 52, MODES.mixolydian, 108, {
    bed: sus('organ', [0, 4], -1, 0.35),
    pulse: both(perc('tabor', 55, [0, 0.5, 1, 1.75, 2, 2.5, 3, 3.75], 0.55), perc('tick', 80, [0.25, 1.25, 2.25, 3.25], 0.5), arp('lute', [0, 4, 7, 4], 0.5, -1, 0.35)),
    melody: every(4, tune('gurdy', OP_A_HOOK, 0, 0.35)),
  }, [0, 0, 3, 3, 4, 4, 0, 0], { bed: 1, pulse: 1, melody: 0.5 }),
  credits: {
    id: 'credits',
    bpm: 66,
    beats: 4,
    root: 50,
    mode: MODES.dorian,
    sections: { A: { chords: [0, 0, 5, 5, 3, 4, 0, 0, 3, 3, 4, 4, 5, 6, 0, 0] }, B: { chords: [0, 3, 4, 0, 5, 3, 4, 0], layers: { melody: both(tune('choir', CREDITS, 1, 0.55), leit('chant', 0, 0.4)) } } },
    order: ['A', 'B'],
    defaults: { bed: 1, pulse: 0.7, melody: 1 },
    layers: {
      bed: both(pedal('drone', [0], -1, 0.45), sus('choirU', [0, 2, 4], 0, 0.5), sus('organ', [0, 4], -1, 0.3)),
      pulse: both(every(4, pedal('bell', [0], -1, 0.5)), arp('lute', [0, 4, 7, 9], 1, 0, 0.3)),
      // The Hollow Choir's motif, resolved: the ♭2 lifted to the natural 2nd and home to a major third.
      melody: tune('choir', CREDITS, 1, 0.55),
      stillness: sus('pad', [0, 4], 0, 0.6),
    },
  },
};
LATER_THEMES.opAChallenge = remix(THEMES.opA, 'opAChallenge', 1.18);
LATER_THEMES.opBChallenge = remix(THEMES.opB, 'opBChallenge', 1.18);
Object.assign(THEMES, LATER_THEMES);

/** The Malison hours in canonical order, each with its theme id. */
export const HOURS = ['matins', 'lauds', 'prime', 'terce', 'sext', 'none', 'vespers', 'compline'] as const;
export type HourId = (typeof HOURS)[number];

/** MIDI of a scale degree for a theme. */
export function degreeMidi(t: Pick<Theme, 'root' | 'mode'>, d: number, oct = 0): number {
  const m = t.mode.length;
  const i = ((d % m) + m) % m;
  return t.root + t.mode[i] + 12 * (Math.floor(d / m) + oct);
}

/** Loop length of a through-composed theme, in seconds. */
export function loopSeconds(t: Theme): number {
  const bars = (t.order ?? Object.keys(t.sections)).reduce((a, s) => a + t.sections[s].chords.length, 0);
  return (bars * t.beats * 60) / t.bpm;
}
