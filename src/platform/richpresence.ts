/**
 * Steam rich presence (PLT-0045): the game sets `steam_display` to a localisation token and fills its
 * substitution keys; the token files uploaded to Steamworks are generated from `PRESENCE_TOKENS`
 * by `scripts/steam-config.mjs` (steam/output/rich_presence_<set>_english.vdf).
 */
import type { Edition } from './editions';

export type Activity =
  | { kind: 'menu' }
  | { kind: 'story'; chapter: string }
  | { kind: 'briefing'; chapter: string; patient: string }
  | { kind: 'operating'; chapter: string; patient: string }
  | { kind: 'results'; chapter: string; patient: string };

/** English token strings per edition's rich presence set (PLT-0060). */
export const PRESENCE_TOKENS: Record<Edition, Record<string, string>> = {
  demo: {
    '#Status_Menu': 'Reading the hospice ledgers (Demo)',
    '#Status_Story': 'Chapter %chapter% — among the living (Demo)',
    '#Status_Operating': 'Chapter %chapter% — operating on %patient% (Demo)',
  },
  full: {
    '#Status_Menu': 'Reading the hospice ledgers',
    '#Status_Story': 'Chapter %chapter% — among the living',
    '#Status_Operating': 'Chapter %chapter% — operating on %patient%',
  },
};

/** Keys and values to send for an activity. Briefing/results count as operating on that patient. */
export function presenceFor(a: Activity): Record<string, string | null> {
  switch (a.kind) {
    case 'menu':
      return { steam_display: '#Status_Menu', chapter: null, patient: null };
    case 'story':
      return { steam_display: '#Status_Story', chapter: a.chapter, patient: null };
    default:
      return { steam_display: '#Status_Operating', chapter: a.chapter, patient: a.patient };
  }
}

/** Steam's rich presence localisation file (VDF) for one language. */
export function tokensVdf(set: Edition, language = 'english', tokens: Record<string, string> = PRESENCE_TOKENS[set]): string {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const lines = Object.entries(tokens).map(([k, v]) => `\t\t\t"${esc(k)}"\t"${esc(v)}"`);
  return `"lang"\n{\n\t"${language}"\n\t{\n\t\t"tokens"\n\t\t{\n${lines.join('\n')}\n\t\t}\n\t}\n}\n`;
}
