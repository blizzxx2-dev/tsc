/**
 * Case notes (NAR-0087, NAR-0088): Kreuzer's hand in the hospice day-book after each operation.
 * Template: patient, presenting complaint, procedure, outcome (varies by rank band) and one
 * personal observation. `renderCaseNote` lays it out as the ledger page shows it; each note is
 * ≤ 120 words in every variant. Content only; the results/codex scenes draw it.
 */
import { rankBand, type RankBand } from './conditions';
import type { Rank } from '../surgery/types';
import { CASE_NOTES_LATER } from './casenotesLater';

export interface CaseNote {
  /** Operation id (op1-1 … op2-5). */
  op: string;
  /** Who, as the ledger names them. */
  patient: string;
  /** Presenting complaint, as first seen. */
  presenting: string;
  /** What was done, in order. */
  procedure: string;
  /** How it went: one sentence per rank band (high XS/S, mid A/B, low C). */
  outcome: Record<RankBand, string>;
  /** One personal line, not for the Guild. */
  observation: string;
}

const DEMO_NOTES: readonly CaseNote[] = [
  {
    op: 'op1-1',
    patient: 'Jost, drover. Pays in turnips.',
    presenting: 'Two knife wounds, forearm and flank, after a dice dispute at the Crooked Goose. Moderate bleeding into the straw.',
    procedure: 'Drained the pool. Stitched both deep cuts in a single pass each; salved the nicks.',
    outcome: {
      high: 'Closed clean and tight; he will scarcely scar. Walked out arguing about the dice.',
      mid: 'Closed sound. He will keep the arm and a scar to show for it.',
      low: 'Closed, at length and with more thread than the wound deserved. He will mend.',
    },
    observation: 'Master Haller said “hm”. Sister Ilse entered the turnips.',
  },
  {
    op: 'op1-2',
    patient: 'Pieter, militiaman of the Watch.',
    presenting: 'Horned-folk arrow lodged in the left flank, barbed like a fish-hook; a crossbow bolt in the thigh. Ambush at dawn on the Timber Road.',
    procedure: 'Two nicks with the lancet at the entry to free the barbs; tongs, and the head drawn well clear. The bolt pulled straight. Drained and stitched both.',
    outcome: {
      high: 'Both drawn whole and the wounds closed at once. He will march.',
      mid: 'Drawn and closed; the barb tore a little coming free. He will march late.',
      low: 'Drawn, but the barb took flesh with it and the bleeding was hard to hold. He will keep the side.',
    },
    observation: 'He asked to keep the arrow. Somewhere in the Grauwald an antler has a fresh notch.',
  },
  {
    op: 'op1-3',
    patient: 'Anno, gunsmith’s apprentice.',
    presenting: 'Burst proof-barrel. Powder burns across the chest; lead fragments under the skin. Pulse weak from the first.',
    procedure: 'Plucked the black eschar and salved the raw flesh. Opened along the inked line; drew out each ball with the tongs. Closed with thread.',
    outcome: {
      high: 'Every fragment out and the chest closed clean. The Guild will bill him for the barrel.',
      mid: 'Lead out, burns dressed, closed sound. He will not raise the arm for a month.',
      low: 'Lead out. The burns were slow to settle and the closure is rough. He lives, and the Guild still bills him.',
    },
    observation: 'The barrel was proofed twice, he says. So was the apprentice.',
  },
  {
    op: 'op1-4',
    patient: 'Matthis Kolb, tanner’s man, Tanners’ Rows.',
    presenting: 'Plague buboes in the groin and armpit, spreading rot, an old sore alive with grubs. High fever. The Inquisitor watching.',
    procedure: 'Lanced each bubo with a single touch before it burst; drained and salved. Brand on every grub. Salve over the rot until it stopped creeping.',
    outcome: {
      high: 'Not a bubo burst; the rot checked and the sore clean. The fever broke before dawn.',
      mid: 'Buboes drained, rot checked, sore burned clean. The fever broke by noon.',
      low: 'A bubo burst before the lancet reached it and the rot came back twice. He lives. The Rows are still coughing.',
    },
    observation: 'Stroh said pestilence has a sponsor. He did not say who sponsors the cure.',
  },
  {
    op: 'op1-5',
    patient: 'Emmerich, page-boy. Brought by a carriage with no crest.',
    presenting: 'Moving marks on the chest: curse-sigils, one of them an eye with a stroke through it. Delirium. “The choir is singing in me.” Something beneath the ribs, with an eye.',
    procedure: 'Seared out every stroke of every sigil. Opened him. The thing — the Hour of Matins — fought; the brand on its eye whenever it opened. Tended what it left and closed.',
    outcome: {
      high: 'It is gone and he is closed clean. He asked whether the voice was gone. It is.',
      mid: 'Gone, and he is closed. He will carry the scar and, I think, the memory.',
      low: 'Gone, at a cost: he bled hard and the closure is rough. He lives. He still hears it in his sleep.',
    },
    observation: 'The candles stopped; I do not know for how long. The Inquisitor does.',
  },
  {
    op: 'op2-1',
    patient: 'Tomas, scout of the Watch.',
    presenting: 'Mauled by a gravehound out of the barrow-fields: fangs lodged in the shoulder, one broken off; venom spreading from the bite; three claw rakes across the back with grave-dirt in them.',
    procedure: 'Tincture on the bite until it drew. Tongs for every fang, twice for the broken one: crown, then root. The grave-dirt leeched out of the rakes before anything touched them; then drained and stitched each rake.',
    outcome: {
      high: 'Venom drawn before it reached the heart; every fang out; rakes closed clean. Fit to scout.',
      mid: 'Venom drawn, fangs out, rakes closed. A week before he is fit to march.',
      low: 'The venom got well in before the draught took and he is grey with it. He lives. He will not scout this season.',
    },
    observation: 'Mauer asked whether he was fit to march before I had washed my hands.',
  },
  {
    op: 'op2-2',
    patient: 'Orsa Flintvein, dwarf prospector.',
    presenting: 'Cave-in at a black seam; her lamp burst with it. Rock and glass splinters on the surface; hexstone and lamp-glass under the skin, invisible to the eye; the flesh around them spoiling.',
    procedure: 'Tongs for the surface splinters. Scrying Lens passed slowly until it shimmered; each shard brought to light and drawn. Spoiled flesh cleaned and the wounds closed.',
    outcome: {
      high: 'Every shard found and drawn whole; the spoiled flesh cleaned clean. She sat up and tied a knot.',
      mid: 'Shards out; the flesh cleaned; closed sound. She tied a knot in her beard for the Sister.',
      low: 'Shards out at last; the spoiling had spread and the cleaning was rough. She lives, and has not tied a knot for anyone.',
    },
    observation: 'The shards were warm in the tongs. One of them had a pulse.',
  },
  {
    op: 'op2-3',
    patient: 'Ilvaren, elf forager.',
    presenting: 'Two web-spinner bites at the neck, a day old; venom spreading; several egg sacs laid beneath the skin, one deep. A fever-bubo rising from the bite.',
    procedure: 'Tincture on each bite. Lanced every sac with a single touch and seared the hatchlings. The deep sac found with the lens and opened. Lanced and cleansed the bubo.',
    outcome: {
      high: 'Nothing hatched. Every sac gone, the venom drawn, the bubo drained. He will forage again, elsewhere.',
      mid: 'Sacs gone, venom drawn, bubo drained. A hatchling or two got loose and were seared. He will mend.',
      low: 'A sac hatched before the lancet reached it and the brand was busy. The venom went deep. He lives, and will not sleep well.',
    },
    observation: 'He says the brood-mother saw his face. He says she remembers.',
  },
  {
    op: 'op2-4',
    patient: 'A lay-cantor of the Hollow Choir. Prisoner of the Ash Tribunal.',
    presenting: 'Silence-sigils igniting across the chest as hexfire; poison swallowed on capture, and something else with it; maggots in an old sore from the cells.',
    procedure: 'Tincture for the poison, at once. Seared out every stroke of every sigil. Plucked the hexfire eschar and salved. Brand on the maggots. The lens on the stomach; opened along the line and drew out a pewter hymn-token.',
    outcome: {
      high: 'The poison drawn in time, every sigil out, the burns dressed clean. He asked why I would close him.',
      mid: 'Poison drawn, sigils out, burns dressed. He will live to be questioned.',
      low: 'The poison got well in and the sigils burned deep before the brand reached them. He lives, barely, and the Tribunal has him.',
    },
    observation: 'He sang while I worked — who keeps the watch before the sun. Stroh wrote it down.',
  },
  {
    op: 'op2-5',
    patient: 'Jorg, standard-bearer of the Watch.',
    presenting: 'Collapsed during the dawn hymn. Something beneath the sternum, singing in two voices: the Hour of Lauds.',
    procedure: 'Opened along the line. Silenced each of its Voices with the brand as they circled; struck its two halves each before the other could answer; then the heart at dawn. Tended what it left and closed him.',
    outcome: {
      high: 'Every Voice silenced in turn and the heart bared clean. Closed gently. He has a banner to carry.',
      mid: 'Voices silenced, the thing put down, closed sound. He will carry the banner in a month.',
      low: 'The Voices answered each other faster than the brand could follow and he bled for it. He lives. The banner can wait.',
    },
    observation: 'Every candle in the tent stood still. Stroh counted eight; so did I.',
  },
];

/** Every operation's note: the demo's, then Chapters III–V (NAR-0170). */
export const CASE_NOTES: readonly CaseNote[] = [...DEMO_NOTES, ...CASE_NOTES_LATER];

export const caseNote = (opId: string): CaseNote | undefined => CASE_NOTES.find((n) => n.op === opId);

export interface RenderedCaseNote {
  patient: string;
  presenting: string;
  procedure: string;
  outcome: string;
  observation: string;
}

/** The note as the ledger page shows it for the rank earned (null: the canonical mid band). */
export function renderCaseNote(note: CaseNote, rank: Rank | null): RenderedCaseNote {
  const band: RankBand = rank ? rankBand(rank) : 'mid';
  return { patient: note.patient, presenting: note.presenting, procedure: note.procedure, outcome: note.outcome[band], observation: note.observation };
}

/** The note as plain text, for the day-book export and tests. */
export const caseNoteText = (note: CaseNote, rank: Rank | null): string => {
  const r = renderCaseNote(note, rank);
  return `${r.patient}\n${r.presenting}\n${r.procedure}\n${r.outcome}\n${r.observation}`;
};
