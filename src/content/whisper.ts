/**
 * The Whisper (NAR-0093): how much of the Choir the city has begun to smell on Dr. Kreuzer. It is
 * not a flag of its own but read from the ones that feed it (docs/narrative/flags.md): every
 * operation where the star was drawn in front of witnesses (`litanySeenCount`), and a certificate
 * that lied for a hornchild (`hornchildCertificate` = 'natural' counts twice — Stroh can read).
 *
 * Four bands, each with three lines of Kreuzer's own — one for the opening of each of Chapters
 * III, IV and V, where he takes stock of what the city has seen.
 */
import type { FlagCondition, FlagReader } from './flags';
import { onlyIf, say, type Line } from './story';

export type WhisperBand = 'unremarked' | 'noted' | 'suspected' | 'accused';
export const WHISPER_BANDS: readonly WhisperBand[] = ['unremarked', 'noted', 'suspected', 'accused'];

/** The Whisper score from the flags that feed it. */
export function whisperScore(f: Pick<FlagReader, 'get'>): number {
  return Number(f.get('litanySeenCount') ?? 0) + (f.get('hornchildCertificate') === 'natural' ? 2 : 0);
}

/** Band thresholds: 0 unremarked, 1–2 noted, 3–4 suspected, 5+ accused. */
export function whisperBand(score: number): WhisperBand {
  return score <= 0 ? 'unremarked' : score <= 2 ? 'noted' : score <= 4 ? 'suspected' : 'accused';
}

/** Kreuzer's interior lines per band, one per chapter opening (III, IV, V). */
export const WHISPER_LINES: Record<WhisperBand, readonly [string, string, string]> = {
  unremarked: [
    '(No one has seen anything. Every flame keeps its own time. I wash my hands like any barber and keep the star folded in my chest.)',
    '(Still nothing in anyone’s ledger. I have begun to wonder whether the Litany is a thing I did, or a thing I dreamed.)',
    '(They will try me for what they think I am, not for what they saw. They saw nothing. That is almost worse.)',
  ],
  noted: [
    '(Someone has written my name beside a flame that went out. Only once. A single line in a long book.)',
    '(Ilse counts the times I draw it. She does not say so; she only stands a little closer to the door.)',
    '(A few remember. Enough to cough when I pass. Not yet enough to build a fire.)',
  ],
  suspected: [
    '(Stroh watches my hands now, not my face. He has stopped asking questions he already knows the answers to.)',
    '(Mothers take their children to the other side of the street. The Watch salutes me, and then crosses itself.)',
    '(Every witness they call will have seen the star. I taught them all to see it, one saved life at a time.)',
  ],
  accused: [
    '(The word is out in the Kilnrows: the doctor sings to the dead. They are not wrong, and that is the trouble.)',
    '(Stroh no longer bothers with the ledger. He has what he needs. He is waiting for the city to ask for it.)',
    '(They have my name, my hands and every candle I ever put out. All that is left to decide is the wood.)',
  ],
};

/** A condition true when the Whisper is in `band`. */
export const inBand =
  (band: WhisperBand): FlagCondition =>
  (f) =>
    whisperBand(whisperScore(f)) === band;

/** Kreuzer's stock-taking at the opening of Chapter III (0), IV (1) or V (2): one line, by band. */
export function whisperThought(chapter: 0 | 1 | 2): Line[] {
  return WHISPER_BANDS.flatMap((b) => onlyIf(inBand(b), say('kreuzer', WHISPER_LINES[b][chapter])));
}
