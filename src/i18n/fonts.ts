import type { FontId } from '../render/text';
import { localeInfo, type Script } from './locales';

/**
 * Per-locale font-role map (LOC-0024). Each text role (body, italic, display)
 * resolves to an ordered list of faces; the first face is preferred and the
 * rest are fallbacks for code points it lacks. `scripts/i18n/glyphs.mjs` reads
 * the shipped faces' cmaps to prove coverage per locale and role.
 *
 * Faces marked `shipped: false` are candidates awaiting ART approval and the
 * ENG font-subsetting build; they are listed so the map is complete, and the
 * glyph check reports them as "not bundled" rather than silently passing.
 */
export type FaceId =
  | 'garamond'
  | 'garamond-italic'
  | 'garamond-ext'
  | 'garamond-italic-ext'
  | 'cinzel'
  | 'cinzel-ext'
  | 'atkinson'
  | 'atkinson-italic'
  | 'grenze-gotisch'
  | 'old-standard'
  | 'old-standard-italic'
  | 'noto-serif-sc'
  | 'lxgw-wenkai'
  | 'noto-serif-jp'
  | 'klee-one'
  | 'noto-serif-kr'
  | 'gowun-batang';

export interface Face {
  family: string;
  style: 'normal' | 'italic';
  /** Bundled font file (relative to node_modules) when shipped. */
  file?: string;
  shipped: boolean;
  licence: 'OFL-1.1';
  scripts: Script[];
}

export const FACES: Record<FaceId, Face> = {
  garamond: { family: 'EB Garamond', style: 'normal', file: '@fontsource/eb-garamond/files/eb-garamond-latin-500-normal.woff', shipped: true, licence: 'OFL-1.1', scripts: ['latin', 'pseudo'] },
  'garamond-italic': { family: 'EB Garamond', style: 'italic', file: '@fontsource/eb-garamond/files/eb-garamond-latin-500-italic.woff', shipped: true, licence: 'OFL-1.1', scripts: ['latin', 'pseudo'] },
  // Latin Extended subsets load alongside (unicode-range), covering PL/CS/HU and the pseudo-locale.
  'garamond-ext': { family: 'EB Garamond', style: 'normal', file: '@fontsource/eb-garamond/files/eb-garamond-latin-ext-500-normal.woff', shipped: true, licence: 'OFL-1.1', scripts: ['latin', 'pseudo'] },
  'garamond-italic-ext': { family: 'EB Garamond', style: 'italic', file: '@fontsource/eb-garamond/files/eb-garamond-latin-ext-500-italic.woff', shipped: true, licence: 'OFL-1.1', scripts: ['latin', 'pseudo'] },
  cinzel: { family: 'Cinzel', style: 'normal', file: '@fontsource/cinzel/files/cinzel-latin-600-normal.woff', shipped: true, licence: 'OFL-1.1', scripts: ['latin', 'pseudo'] },
  'cinzel-ext': { family: 'Cinzel', style: 'normal', file: '@fontsource/cinzel/files/cinzel-latin-ext-600-normal.woff', shipped: true, licence: 'OFL-1.1', scripts: ['latin', 'pseudo'] },
  // Readable-font option (UIX-0150): replaces body and italic text when enabled.
  atkinson: { family: 'Atkinson Hyperlegible', style: 'normal', file: '@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff', shipped: true, licence: 'OFL-1.1', scripts: ['latin', 'pseudo'] },
  'atkinson-italic': { family: 'Atkinson Hyperlegible', style: 'italic', file: '@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-italic.woff', shipped: true, licence: 'OFL-1.1', scripts: ['latin', 'pseudo'] },
  // Latin Extended-A blackletter candidate for PL display titles (ART approval pending).
  'grenze-gotisch': { family: 'Grenze Gotisch', style: 'normal', shipped: false, licence: 'OFL-1.1', scripts: ['latin', 'pseudo'] },
  'old-standard': { family: 'Old Standard TT', style: 'normal', shipped: false, licence: 'OFL-1.1', scripts: ['latin', 'cyrillic'] },
  'old-standard-italic': { family: 'Old Standard TT', style: 'italic', shipped: false, licence: 'OFL-1.1', scripts: ['latin', 'cyrillic'] },
  'noto-serif-sc': { family: 'Noto Serif SC', style: 'normal', shipped: false, licence: 'OFL-1.1', scripts: ['han'] },
  // CJK has no italics: the "italic" role (narration, asides) maps to a Kai face.
  'lxgw-wenkai': { family: 'LXGW WenKai', style: 'normal', shipped: false, licence: 'OFL-1.1', scripts: ['han'] },
  'noto-serif-jp': { family: 'Noto Serif JP', style: 'normal', shipped: false, licence: 'OFL-1.1', scripts: ['kana', 'han'] },
  'klee-one': { family: 'Klee One', style: 'normal', shipped: false, licence: 'OFL-1.1', scripts: ['kana', 'han'] },
  'noto-serif-kr': { family: 'Noto Serif KR', style: 'normal', shipped: false, licence: 'OFL-1.1', scripts: ['hangul'] },
  'gowun-batang': { family: 'Gowun Batang', style: 'normal', shipped: false, licence: 'OFL-1.1', scripts: ['hangul'] },
};

type RoleMap = Record<FontId, FaceId[]>;

const BY_SCRIPT: Record<Script, RoleMap> = {
  latin: { body: ['garamond', 'garamond-ext'], italic: ['garamond-italic', 'garamond-italic-ext'], display: ['cinzel', 'cinzel-ext', 'garamond'] },
  pseudo: { body: ['garamond', 'garamond-ext'], italic: ['garamond-italic', 'garamond-italic-ext'], display: ['cinzel', 'cinzel-ext', 'garamond'] },
  cyrillic: { body: ['old-standard'], italic: ['old-standard-italic'], display: ['old-standard'] },
  han: { body: ['noto-serif-sc'], italic: ['lxgw-wenkai'], display: ['noto-serif-sc'] },
  kana: { body: ['noto-serif-jp'], italic: ['klee-one'], display: ['noto-serif-jp'] },
  hangul: { body: ['noto-serif-kr'], italic: ['gowun-batang'], display: ['noto-serif-kr'] },
};

/** Per-locale overrides on top of the script defaults. */
const OVERRIDES: Record<string, Partial<RoleMap>> = {};

/** Ordered faces for every role of a locale. Unknown locales use the Latin map. */
export function fontRoles(code: string): RoleMap {
  const script = localeInfo(code)?.script ?? 'latin';
  return { ...BY_SCRIPT[script], ...OVERRIDES[code] };
}

/** CSS font-family list for a role (used when the renderer rasterises glyphs). */
export function cssFamily(code: string, role: FontId): string {
  return [...fontRoles(code)[role].map((f) => `"${FACES[f].family}"`), 'Georgia', 'serif'].join(', ');
}
