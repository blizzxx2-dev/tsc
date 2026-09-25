// electron-builder afterPack hook (PLT-0027): strip artefacts the target OS never loads — the other
// OSes' Steamworks binaries and import libraries — and record the unpacked size so the delta is logged
// in CI. Chromium locale paks are already limited by `electronLanguages` in the config.
const { readdirSync, rmSync, statSync, existsSync } = require('node:fs');
const { join } = require('node:path');

function du(dir) {
  let total = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) total += du(p);
    else if (e.isFile()) total += statSync(p).size;
  }
  return total;
}

function findUnpacked(appOutDir) {
  const candidates = [join(appOutDir, 'resources', 'app.asar.unpacked')];
  for (const e of existsSync(appOutDir) ? readdirSync(appOutDir) : []) if (e.endsWith('.app')) candidates.push(join(appOutDir, e, 'Contents', 'Resources', 'app.asar.unpacked'));
  return candidates.find((c) => existsSync(c));
}

exports.default = async function afterPack(context) {
  const { appOutDir, electronPlatformName } = context;
  const before = du(appOutDir);
  const unpacked = findUnpacked(appOutDir);
  const keep = { win32: 'win64', darwin: 'osx', linux: 'linux64' }[electronPlatformName];
  if (unpacked) {
    const sw = join(unpacked, 'node_modules', 'steamworks.js', 'dist');
    if (existsSync(sw)) for (const d of readdirSync(sw)) if (d !== keep) rmSync(join(sw, d), { recursive: true, force: true });
    // Import library is only needed to link, never at runtime.
    rmSync(join(sw, 'win64', 'steam_api64.lib'), { force: true });
  }
  const after = du(appOutDir);
  console.log(`  • afterPack ${electronPlatformName}: ${(before / 1e6).toFixed(1)} MB → ${(after / 1e6).toFixed(1)} MB (stripped ${((before - after) / 1e6).toFixed(1)} MB)`);
};
