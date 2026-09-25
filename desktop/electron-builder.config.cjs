// electron-builder configuration (PLT-0024/0026/0027/0019/0060). One config, parameterised by env:
//   VITE_EDITION=demo|full     edition (identifiers, output folder)
//   VITE_PLATFORM=desktop|none none = no Steam binaries in the package (GOG/itch, PLT-0183)
// Output: release/<edition>[-nosteam]/{win-unpacked, mac-universal, linux-unpacked} — each one a Steam depot.
// Signing: Windows via Azure Trusted Signing or CSC_LINK, macOS via CSC_LINK + APPLE_* notarisation env;
// see docs/handoff/PLT/signing.md. Unsigned local builds work without any of it.
const { readFileSync } = require('node:fs');

const edition = process.env.VITE_EDITION === 'full' ? 'full' : 'demo';
const noSteam = process.env.VITE_PLATFORM === 'none';
// DRM-free installers for GOG/itch (PLT-0033): SS_INSTALLERS=1 (or any no-Steam build) adds NSIS, a
// signed .dmg and tar.gz + AppImage beside the unpacked folders. Steam depots stay 'dir'.
const installers = noSteam || process.env.SS_INSTALLERS === '1';
const src = readFileSync(`${__dirname}/../src/platform/editions.ts`, 'utf8');
// Pull the edition block's identifiers out of the TS source (single source of truth, no TS loader needed in CJS).
function field(name) {
  const block = src.slice(src.indexOf(`  ${edition}: {`));
  const m = new RegExp(`${name}: '([^']+)'`).exec(block);
  if (!m) throw new Error(`editions.ts: ${edition}.${name} not found`);
  return m[1];
}
const productName = field('productName');
const executableName = field('executableName');
const versions = JSON.parse(readFileSync(`${__dirname}/../versions.json`, 'utf8'));

/** Chromium UI locales kept (PLT-0027): only the languages the game ships or plans to. */
const LOCALES = ['en-US', 'de', 'fr', 'es', 'it', 'pl', 'pt-BR', 'ru', 'zh-CN', 'ja', 'ko'];

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: field('bundleId'),
  productName,
  executableName,
  copyright: 'Copyright © Suture & Steel',
  directories: { output: `release/${edition}${noSteam ? '-nosteam' : ''}`, buildResources: 'desktop/build' },
  extraMetadata: { main: 'desktop/dist/main.cjs', version: versions[edition], productName },
  files: [
    'package.json',
    'dist/**/*',
    '!dist/**/*.map',
    'desktop/dist/*.cjs',
    'desktop/build/icons/512x512.png',
    'THIRD_PARTY_NOTICES.txt',
    '!node_modules/@fontsource/**',
    '!node_modules/@types/**',
    '!node_modules/undici-types/**',
    ...(noSteam ? ['!node_modules/steamworks.js/**'] : []),
  ],
  asar: true,
  // The generated 3D models (hundreds of MB, 4K KTX2 textures) stay outside the asar archive and
  // are read straight from disk; Steam ships the unpacked folder (win target 'dir') at any size.
  // Content (sprites, fonts, audio, models) stays outside the asar too (PLT-0028): SteamPipe patches
  // per file, so a code-only hotfix re-ships just the small asar, not the content.
  asarUnpack: ['node_modules/steamworks.js/dist/**', 'dist/assets/**', 'dist/audio/**'],
  electronLanguages: LOCALES,
  compression: 'normal',
  npmRebuild: false,
  buildDependenciesFromSource: false,
  // Electron fuses (PLT-0026) — verified by scripts/check-package.mjs with `@electron/fuses read`.
  electronFuses: {
    runAsNode: false,
    enableCookieEncryption: true,
    enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: false,
    enableEmbeddedAsarIntegrityValidation: true,
    onlyLoadAppFromAsar: true,
    loadBrowserProcessSpecificV8Snapshot: false,
    grantFileProtocolExtraPrivileges: false,
  },
  afterPack: 'desktop/build/afterPack.cjs',
  win: {
    target: [{ target: 'dir', arch: ['x64'] }, ...(installers ? [{ target: 'nsis', arch: ['x64'] }] : [])],
    icon: 'desktop/build/icons/icon.ico',
    requestedExecutionLevel: 'asInvoker',
    signAndEditExecutable: true,
    // Azure Trusted Signing when configured (PLT-0034); otherwise CSC_LINK/CSC_KEY_PASSWORD if present.
    ...(process.env.AZURE_TRUSTED_SIGNING_ENDPOINT
      ? {
          azureSignOptions: {
            endpoint: process.env.AZURE_TRUSTED_SIGNING_ENDPOINT,
            codeSigningAccountName: process.env.AZURE_CODE_SIGNING_ACCOUNT,
            certificateProfileName: process.env.AZURE_CERT_PROFILE,
            publisherName: process.env.AZURE_PUBLISHER_NAME,
            timestampRfc3161: 'http://timestamp.acs.microsoft.com',
            timestampDigest: 'SHA256',
          },
        }
      : {}),
  },
  mac: {
    target: [{ target: 'dir', arch: ['universal'] }, ...(installers ? [{ target: 'dmg', arch: ['universal'] }] : [])],
    icon: 'desktop/build/icons/icon.icns',
    category: 'public.app-category.role-playing-games',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'desktop/build/entitlements.mac.plist',
    entitlementsInherit: 'desktop/build/entitlements.mac.plist',
    // Native add-ons ship both slices already; tell the universal merger they may differ (PLT-0029).
    x64ArchFiles: 'Contents/Resources/app.asar.unpacked/node_modules/steamworks.js/dist/osx/*',
    notarize: !!process.env.APPLE_TEAM_ID,
    minimumSystemVersion: '11.0',
    extendInfo: { LSApplicationCategoryType: 'public.app-category.role-playing-games', NSHighResolutionCapable: true },
  },
  linux: {
    target: [
      { target: 'dir', arch: ['x64'] },
      ...(installers
        ? [
            { target: 'tar.gz', arch: ['x64'] },
            { target: 'AppImage', arch: ['x64'] },
          ]
        : []),
    ],
    icon: 'desktop/build/icons',
    category: 'Game',
    executableName,
    synopsis: 'A grimdark surgery-action game.',
  },
  // Installer behaviour: per-user install with a Start-menu and desktop shortcut; the uninstaller
  // never touches the save folder (saves live under the OS app-data root, PLT-0132).
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    deleteAppDataOnUninstall: false,
    artifactName: '${productName}-${version}-setup.${ext}',
    shortcutName: productName,
  },
  dmg: {
    artifactName: '${productName}-${version}.${ext}',
    sign: !!process.env.CSC_LINK,
    contents: [
      { x: 130, y: 220 },
      { x: 410, y: 220, type: 'link', path: '/Applications' },
    ],
  },
  appImage: { artifactName: '${productName}-${version}.${ext}' },
  publish: null,
};
