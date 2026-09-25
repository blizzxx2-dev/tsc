/**
 * Korean particle selection (LOC-0020). Translators write the combined form
 * after an inserted name or term — `{name}은(는)`, `{name}이(가)`, `{name}을(를)`,
 * `{name}(으)로`, `{name}과(와)`, `{name}이나(나)` — which reads acceptably even
 * unprocessed; `resolveParticles` replaces each with the correct allomorph from
 * the final consonant (batchim) of the preceding syllable.
 */

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;
/** Jongseong index of ㄹ in a precomposed syllable. */
const RIEUL = 8;

/** Final consonant of the last pronounced character: 'none', 'rieul' or 'other'; undefined when unknown. */
export function finalSound(word: string): 'none' | 'rieul' | 'other' | undefined {
  const chars = [...word.trim()];
  // Skip trailing punctuation/quotes that do not change pronunciation.
  while (chars.length && /[\s"'’”」』)\]]/.test(chars[chars.length - 1])) chars.pop();
  const last = chars[chars.length - 1];
  if (!last) return undefined;
  const code = last.codePointAt(0)!;
  if (code >= HANGUL_START && code <= HANGUL_END) {
    const jong = (code - HANGUL_START) % 28;
    return jong === 0 ? 'none' : jong === RIEUL ? 'rieul' : 'other';
  }
  // Sino-Korean readings of digits: 영 일 이 삼 사 오 육 칠 팔 구.
  const DIGITS: Record<string, 'none' | 'rieul' | 'other'> = { '0': 'other', '1': 'rieul', '2': 'none', '3': 'other', '4': 'none', '5': 'none', '6': 'other', '7': 'rieul', '8': 'rieul', '9': 'none' };
  return DIGITS[last];
}

type Pair = { withFinal: string; withoutFinal: string; rieulTakesShort?: boolean };

const PAIRS: Record<string, Pair> = {
  '은(는)': { withFinal: '은', withoutFinal: '는' },
  '이(가)': { withFinal: '이', withoutFinal: '가' },
  '을(를)': { withFinal: '을', withoutFinal: '를' },
  '과(와)': { withFinal: '과', withoutFinal: '와' },
  '이나(나)': { withFinal: '이나', withoutFinal: '나' },
  '아(야)': { withFinal: '아', withoutFinal: '야' },
  // 으로/로: ㄹ-final words take the short form (서울로, 칼로).
  '(으)로': { withFinal: '으로', withoutFinal: '로', rieulTakesShort: true },
};

/** Choose the particle for a word, e.g. particle('크로이처', '은(는)') → '는'. */
export function particle(word: string, combined: keyof typeof PAIRS): string {
  const p = PAIRS[combined];
  const fin = finalSound(word);
  if (fin === undefined) return combined;
  if (fin === 'none' || (fin === 'rieul' && p.rieulTakesShort)) return p.withoutFinal;
  return p.withFinal;
}

const PATTERN = new RegExp(`(\\S)(${Object.keys(PAIRS).map((k) => k.replace(/[()]/g, '\\$&')).join('|')})`, 'g');

/** Resolve every combined particle in a formatted Korean string. */
export function resolveParticles(text: string): string {
  return text.replace(PATTERN, (_m, prev: string, combined: string) => prev + particle(prev, combined as keyof typeof PAIRS));
}
