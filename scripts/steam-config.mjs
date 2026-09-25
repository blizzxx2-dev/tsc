// Generates every Steamworks-side file from src/platform/editions.ts (one source of truth, PLT-0052):
//   steam/output/<edition>/app_build_<appid>.vdf           SteamPipe app build (all three OS depots)
//   steam/output/<edition>/depot_build_<depotid>.vdf       one per OS depot (PLT-0025)
//   steam/output/<edition>/rich_presence_english.vdf       rich presence tokens (PLT-0045)
//   steam/output/<edition>/achievements.json               achievement API names + strings for the admin page (PLT-0049)
//   steam/output/<edition>/launch_options.md               launch options to enter in Steamworks (PLT-0055)
// Usage: node scripts/steam-config.mjs [--edition=demo|full|all] [--branch=qa|beta] [--desc="build text"] [--content=release]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { importTs } from './lib/ts-import.mjs';

const { EDITIONS } = await importTs('src/platform/editions.ts');
const { tokensVdf } = await importTs('src/platform/richpresence.ts');
const { achievementsFor } = await importTs('src/platform/achievements.ts');

const opt = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, ...v]) => [k, v.join('=') || '1']));
const editions = !opt.edition || opt.edition === 'all' ? ['demo', 'full'] : [opt.edition];
const branch = opt.branch ?? '';
if (branch === 'default') {
  console.error('Refusing to SetLive the default branch from a script — promote builds manually (docs/release.md).');
  process.exit(2);
}
const contentRoot = resolve(opt.content ?? 'release');
const q = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/** Depot content folder per OS inside release/<edition>/ (electron-builder output). */
const DEPOT_DIRS = { windows: 'win-unpacked', mac: 'mac-universal', linux: 'linux-unpacked' };

let missing = false;
for (const ed of editions) {
  const e = EDITIONS[ed];
  const out = join('steam', 'output', ed);
  mkdirSync(out, { recursive: true });
  const appId = e.steamAppId || `<${ed.toUpperCase()}_APP_ID>`;
  if (!e.steamAppId || Object.values(e.depots).some((d) => !d)) missing = true;
  const depotLines = [];
  for (const [os, dir] of Object.entries(DEPOT_DIRS)) {
    const depotId = e.depots[os] || `<${ed.toUpperCase()}_${os.toUpperCase()}_DEPOT_ID>`;
    const depotFile = `depot_build_${depotId}.vdf`.replace(/[<>]/g, '');
    depotLines.push(`\t\t${q(depotId)} ${q(depotFile)}`);
    writeFileSync(
      join(out, depotFile),
      [
        '"DepotBuild"',
        '{',
        `\t"DepotID" ${q(depotId)}`,
        `\t"ContentRoot" ${q(join(contentRoot, ed, dir))}`,
        '\t"FileMapping"',
        '\t{',
        '\t\t"LocalPath" "*"',
        '\t\t"DepotPath" "."',
        '\t\t"Recursive" "1"',
        '\t}',
        // Symbols and maps are uploaded to the crash backend, never shipped.
        '\t"FileExclusion" "*.pdb"',
        '\t"FileExclusion" "*.map"',
        '\t"FileExclusion" "*.dSYM"',
        '\t"FileExclusion" "steam_appid.txt"',
        '}',
        '',
      ].join('\n'),
    );
  }
  writeFileSync(
    join(out, `app_build_${appId}.vdf`.replace(/[<>]/g, '')),
    [
      '"AppBuild"',
      '{',
      `\t"AppID" ${q(appId)}`,
      `\t"Desc" ${q(opt.desc ?? `${ed} build`)}`,
      `\t"BuildOutput" ${q(resolve('steam', 'output', 'logs'))}`,
      `\t"ContentRoot" ${q(contentRoot)}`,
      ...(branch ? [`\t"SetLive" ${q(branch)}`] : []),
      '\t"Depots"',
      '\t{',
      ...depotLines,
      '\t}',
      '}',
      '',
    ].join('\n'),
  );
  writeFileSync(join(out, 'rich_presence_english.vdf'), tokensVdf(e.richPresenceSet));
  writeFileSync(
    join(out, 'achievements.json'),
    JSON.stringify(
      achievementsFor(e.achievementSet).map((a) => ({ apiName: a.id, name: a.name, description: a.description, hidden: !!a.hidden, iconLocked: `steam/art/achievements/${a.id}_locked.jpg`, iconUnlocked: `steam/art/achievements/${a.id}.jpg` })),
      null,
      2,
    ),
  );
  const exe = e.executableName;
  writeFileSync(
    join(out, 'launch_options.md'),
    [
      `# Steam launch options — ${e.productName} (app ${appId})`,
      '',
      'Enter these in Steamworks → Installation → General Installation → Launch Options.',
      '',
      '| # | Operating system | Executable | Arguments | Description |',
      '|---|---|---|---|---|',
      `| 1 | Windows (64-bit) | \`${exe}.exe\` | | Play ${e.productName} |`,
      `| 2 | Windows (64-bit) | \`${exe}.exe\` | \`--safe-mode\` | Launch in safe mode (lowest graphics, windowed) |`,
      `| 3 | macOS | \`${e.productName}.app\` | | Play ${e.productName} |`,
      `| 4 | macOS | \`${e.productName}.app\` | \`--safe-mode\` | Launch in safe mode (lowest graphics, windowed) |`,
      `| 5 | Linux + SteamOS | \`${exe}\` | | Play ${e.productName} |`,
      `| 6 | Linux + SteamOS | \`${exe}\` | \`--safe-mode\` | Launch in safe mode (lowest graphics, windowed) |`,
      '',
      'Set "Launch type" to *Launch (default)* for 1/3/5 and *Launch in safe mode* for 2/4/6.',
      '',
    ].join('\n'),
  );
  console.log(`steam/output/${ed}: app ${appId}, depots ${Object.values(e.depots).join('/')}`);
}
if (missing) console.warn('warning: Steam app/depot ids are not assigned yet (src/platform/editions.ts) — placeholders written; upload is disabled until they are set.');
if (opt.strict && missing) process.exit(1);
