// Scripted 3D asset build: runs each art-src/blender/models/<name>.py under Blender's Python
// module (bpy), writing assets/models/*.glb and review renders into docs/art/renders/.
//   npm run art:models              every model script
//   npm run art:models -- tools     only art-src/blender/models/tools.py
// Needs `bpy` (pip install bpy==4.2.0 into a Python 3.11 env); set BLENDER_PY to that python.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PY = process.env.BLENDER_PY ?? (existsSync('/opt/bpyenv/bin/python') ? '/opt/bpyenv/bin/python' : 'python3');
const dir = 'art-src/blender/models';
const only = process.argv.slice(2);
const scripts = readdirSync(dir).filter((f) => f.endsWith('.py') && (!only.length || only.includes(f.replace(/\.py$/, ''))));
let failed = 0;
for (const f of scripts) {
  const t0 = Date.now();
  const r = spawnSync(PY, [join(dir, f)], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  const tail = (r.stdout + r.stderr)
    .split('\n')
    .filter((l) => /error|Traceback|built|Exception/i.test(l))
    .slice(-12)
    .join('\n');
  if (r.status !== 0) {
    failed++;
    console.error(`✖ ${f} (${r.status})\n${tail}`);
  } else console.log(`✔ ${f} in ${((Date.now() - t0) / 1000).toFixed(1)} s${tail ? `\n${tail}` : ''}`);
}
if (failed) process.exit(1);
// GPU texture compression of the fresh exports (KTX2 UASTC), then the asset manifest.
for (const [cmd, args] of [
  ['node', ['scripts/art/compress-models.mjs', ...only.flatMap((o) => (o === 'tools' ? [] : [`set-${o}`]))]],
  ['node', ['scripts/build-assets.ts']],
  ['node', ['scripts/art/check-models.mjs', '--stamp']],
]) {
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
