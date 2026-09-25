/**
 * Credits content (UIX-0085): sections of role → names, then the type faces with their OFL notices
 * (from the locale font map) and the third-party components (from `noticesData`). Role headings are
 * string keys; names and product names are proper nouns and stay as written. Team names come from
 * docs/production/team.md and docs/production/budget/credit-obligations.csv as they are contracted.
 */
import { FACES, type Face } from '../i18n/fonts';
import { NOTICES } from './noticesData';

export interface CreditLine {
  /** String key of the role, or empty for a bare name line. */
  roleKey?: string;
  /** Names as written (never localised). */
  names: string[];
}

export interface CreditSection {
  headingKey: string;
  lines: CreditLine[];
}

const STUDIO = 'Kessendorf Workshop';

export const CREDIT_SECTIONS: readonly CreditSection[] = [
  {
    headingKey: 'ui.credits.section_team',
    lines: [
      { roleKey: 'ui.credits.role_direction', names: [STUDIO] },
      { roleKey: 'ui.credits.role_code', names: [STUDIO] },
      { roleKey: 'ui.credits.role_art', names: [STUDIO] },
      { roleKey: 'ui.credits.role_writing', names: [STUDIO] },
      { roleKey: 'ui.credits.role_audio', names: [STUDIO] },
      { roleKey: 'ui.credits.role_qa', names: [STUDIO] },
    ],
  },
  {
    headingKey: 'ui.credits.section_thanks',
    lines: [{ roleKey: 'ui.credits.role_playtest', names: ['The Kessendorf night watch'] }, { roleKey: 'ui.credits.role_families', names: ['Our families, for the hours'] }],
  },
];

/** One shipped face per family and style, with its licence, for the type section. */
export function fontCredits(faces: Record<string, Face> = FACES): { family: string; style: Face['style']; licence: string }[] {
  const seen = new Set<string>();
  const out: { family: string; style: Face['style']; licence: string }[] = [];
  for (const f of Object.values(faces)) {
    if (!f.shipped) continue;
    const key = `${f.family}/${f.style}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ family: f.family, style: f.style, licence: f.licence });
  }
  return out.sort((a, b) => a.family.localeCompare(b.family) || a.style.localeCompare(b.style));
}

/** Third-party software lines for the credits roll (name and licence). */
export const softwareCredits = (): { name: string; licence: string }[] => NOTICES.map((n) => ({ name: n.name, licence: n.licence }));
