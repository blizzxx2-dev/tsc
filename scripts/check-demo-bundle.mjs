// CI gate for demo builds (PLT-0057, PLT-0059): fails if a demo `dist/` contains any Chapter III–V code
// module or content id, or exceeds the size budget. Usage: node scripts/check-demo-bundle.mjs [dist] [--max-mb=40]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--')) ?? 'dist';
const maxMb = Number(args.find((a) => a.startsWith('--max-mb='))?.split('=')[1] ?? 40);

function walk(d) {
  return readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
}

const files = walk(dir);
const problems = [];
let total = 0;
// Module file names Vite emits for lazily loaded chapters, and ids that only exist in Chapters III–V.
const badName = /chapter[3-5]|ch[3-5][._-]/i;
const badId = /["'`](?:op[3-5]-\d+|s[3-5]-(?:\d+|end)|ch[3-5]\.(?:op|s)\d+)["'`]/;
for (const f of files) {
  total += statSync(f).size;
  if (badName.test(f)) problems.push(`non-demo module file: ${f}`);
  if (/\.(js|mjs|json|html)$/.test(f)) {
    const m = badId.exec(readFileSync(f, 'utf8'));
    if (m) problems.push(`non-demo content id ${m[0]} in ${f}`);
  }
}
const mb = total / 1024 / 1024;
if (mb > maxMb) problems.push(`demo web bundle is ${mb.toFixed(1)} MB (budget ${maxMb} MB)`);
if (problems.length) {
  console.error(`demo bundle check FAILED:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`demo bundle OK: ${files.length} files, ${mb.toFixed(2)} MB, no Chapter III–V modules or ids`);
