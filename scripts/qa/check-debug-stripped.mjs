// Release gate (QAT-0074): the production bundle must not contain the QA debug API, console or
// cheat menu. Run after `npm run build` (vite build, production mode).
// Usage: node scripts/qa/check-debug-stripped.mjs [distDir]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dist = process.argv[2] ?? 'dist';
const MARKERS = ['QA cheats', '__qaWrapped', 'Suture & Steel QA console', 'skipPhase'];
const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|mjs|html)$/.test(f)) files.push(p);
  }
};
walk(dist);
const hits = files.flatMap((f) => {
  const text = readFileSync(f, 'utf8');
  return MARKERS.filter((m) => text.includes(m)).map((m) => `${f}: contains "${m}"`);
});
if (!files.length) {
  console.error(`no built files in ${dist}/ — run npm run build first`);
  process.exit(1);
}
if (hits.length) {
  console.error(`Debug tooling leaked into the production build:\n${hits.join('\n')}`);
  process.exit(1);
}
console.log(`ok: ${files.length} production files contain no debug tooling`);
