/**
 * Third-party components shipped with the game (PLT-0145), as shown on the in-game notices page.
 * `scripts/third-party-notices.mjs` writes the full licence texts to THIRD_PARTY_NOTICES.txt at the
 * package root (opened from the notices page on desktop); this table is the readable summary and is
 * checked against package.json by tests/unit/ui/notices.test.ts so the two cannot drift apart.
 */
export interface Notice {
  /** Package or product name. */
  name: string;
  /** npm package name when the component comes from the registry. */
  pkg?: string;
  licence: string;
  holder: string;
  /** `runtime` ships with every build; `desktop` only in the Electron package. */
  scope: 'runtime' | 'desktop';
}

export const NOTICES: readonly Notice[] = [
  { name: 'IM Fell English', pkg: '@fontsource/im-fell-english', licence: 'SIL Open Font License 1.1', holder: 'The Fell Types, digitally reproduced by Igino Marini', scope: 'runtime' },
  { name: 'UnifrakturMaguntia', pkg: '@fontsource/unifrakturmaguntia', licence: 'SIL Open Font License 1.1', holder: 'j. mach wust, Peter Wiegel', scope: 'runtime' },
  { name: 'Atkinson Hyperlegible', pkg: '@fontsource/atkinson-hyperlegible', licence: 'SIL Open Font License 1.1', holder: 'Braille Institute of America', scope: 'runtime' },
  { name: 'EB Garamond', pkg: '@fontsource/eb-garamond', licence: 'SIL Open Font License 1.1', holder: 'Georg Duffner, Octavio Pardo', scope: 'runtime' },
  { name: 'Cinzel', pkg: '@fontsource/cinzel', licence: 'SIL Open Font License 1.1', holder: 'Natanael Gama', scope: 'runtime' },
  { name: 'Electron', pkg: 'electron', licence: 'MIT', holder: 'Electron contributors, GitHub Inc.', scope: 'desktop' },
  { name: 'Chromium', licence: 'BSD-3-Clause and others (see LICENSES.chromium.html)', holder: 'The Chromium Authors', scope: 'desktop' },
  { name: 'Node.js', licence: 'MIT and others', holder: 'Node.js contributors', scope: 'desktop' },
  { name: 'steamworks.js', pkg: 'steamworks.js', licence: 'MIT', holder: 'Ceifa', scope: 'desktop' },
  { name: 'Steamworks SDK', licence: 'Steamworks SDK Access Agreement', holder: 'Valve Corporation', scope: 'desktop' },
];
