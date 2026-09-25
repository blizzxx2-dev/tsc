/**
 * Credits content (UIX-0085): sections of role → names, then the type faces with their OFL notices
 * (from the locale font map) and the third-party components (from `noticesData`). Role headings are
 * string keys; names and product names are proper nouns and stay as written. Team names come from
 * docs/production/team.md and docs/production/budget/credit-obligations.csv as they are contracted.
 */
import { FACES, type Face } from '../i18n/fonts';
import { NOTICES } from './noticesData';
import ART_CREDITS_MD from '../../docs/art/credits.md?raw';

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

/**
 * Art contributors from docs/art/credits.md (ART-0352): the first column of its table, in order,
 * without duplicates. The art lead maintains that file; the credits roll follows it.
 */
export function parseArtCredits(md: string): string[] {
  const names: string[] = [];
  for (const line of md.split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length < 4 || !cells[1] || cells[1] === 'Credited as' || /^-+$/.test(cells[1])) continue;
    if (!names.includes(cells[1])) names.push(cells[1]);
  }
  return names;
}

export const ART_CREDITS: readonly string[] = parseArtCredits(ART_CREDITS_MD);

export const CREDIT_SECTIONS: readonly CreditSection[] = [
  {
    headingKey: 'ui.credits.section_team',
    lines: [
      { roleKey: 'ui.credits.role_direction', names: [STUDIO] },
      { roleKey: 'ui.credits.role_code', names: [STUDIO] },
      { roleKey: 'ui.credits.role_art', names: ART_CREDITS.length ? [...ART_CREDITS] : [STUDIO] },
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

/** Surface textures shipped in assets/textures (see its README for sources and packing). */
export const TEXTURE_CREDITS: readonly { name: string; licence: string }[] = [
  { name: 'Material Pack Skin 01 — Julio Sillet 3D Art', licence: 'CC-BY' },
  { name: 'Rope001 — ambientCG', licence: 'CC0' },
  { name: 'Rough Linen, Dark Wood — Poly Haven', licence: 'CC0' },
];
