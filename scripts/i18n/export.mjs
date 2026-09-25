// Export every translatable string to XLIFF 1.2 (the TMS interchange format) and JSON.
//
//   node scripts/i18n/export.mjs                 → loc/export/{ui,content}.en.xliff + content.en.json
//   node scripts/i18n/export.mjs --lang de       → the same with target-language="de" and empty targets,
//                                                   pre-filled from src/i18n/strings/de.json where present
//
// Story content stays English in the game; this export is how it reaches translators, VO and subtitles.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { collect, words } from './content.mjs';
import { readJson, ROOT, STRINGS_DIR } from './lib.mjs';

const args = process.argv.slice(2);
const lang = args.includes('--lang') ? args[args.indexOf('--lang') + 1] : undefined;
const outDir = args.includes('--out') ? args[args.indexOf('--out') + 1] : join(ROOT, 'loc/export');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function unit(e, target) {
  const attrs = [`id="${esc(e.id)}"`, `resname="${esc(e.id)}"`];
  if (e.meta?.maxPx) attrs.push(`maxwidth="${e.meta.maxPx}"`, 'size-unit="pixel"');
  const notes = [];
  if (e.context) notes.push(`<note from="context">${esc(e.context)}</note>`);
  if (e.speaker) notes.push(`<note from="speaker">${esc(e.speaker)}</note>`);
  if (e.meta?.note) notes.push(`<note from="translator">${esc(e.meta.note)}</note>`);
  if (e.meta) notes.push(`<note from="layout">font=${e.meta.font}; size=${e.meta.size}px; max=${e.meta.maxPx}px${e.meta.maxLines ? `; lines=${e.meta.maxLines}` : ''}${e.meta.charLimit ? `; chars=${e.meta.charLimit}` : ''}${e.meta.dnt ? '; DO NOT TRANSLATE' : ''}</note>`);
  if (e.meta?.screenshot) notes.push(`<note from="screenshot">${esc(e.meta.screenshot)}</note>`);
  const tgt = lang ? (target !== undefined ? `\n        <target state="translated">${esc(target)}</target>` : '\n        <target state="new"></target>') : '';
  return `      <trans-unit ${attrs.join(' ')}>
        <source>${esc(e.text)}</source>${tgt}
        ${notes.join('\n        ')}
      </trans-unit>`;
}

function xliff(name, entries, targets = {}) {
  const groups = new Map();
  for (const e of entries) {
    const g = `${e.chapter}/${e.scope}`;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(e);
  }
  const body = [...groups]
    .map(([g, es]) => `    <group id="${esc(g)}" resname="${esc(g)}">\n${es.map((e) => unit(e, targets[e.id])).join('\n')}\n    </group>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file original="${name}" source-language="en"${lang ? ` target-language="${esc(lang)}"` : ''} datatype="plaintext">
  <header><note>Suture &amp; Steel: The Malison Hours — ${name} strings. ICU MessageFormat: keep {placeholders} and plural/select keywords unchanged. Style guide: docs/loc/style-guide.md. Keys: docs/loc/keys.md.</note></header>
  <body>
${body}
  </body>
  </file>
</xliff>
`;
}

const { ui, content } = await collect();
mkdirSync(outDir, { recursive: true });
const suffix = lang ?? 'en';
const uiTargets = lang && existsSync(join(STRINGS_DIR, `${lang}.json`)) ? readJson(join(STRINGS_DIR, `${lang}.json`)) : {};
const contentTargets = lang && existsSync(join(ROOT, `loc/content/${lang}.json`)) ? readJson(join(ROOT, `loc/content/${lang}.json`)) : {};
writeFileSync(join(outDir, `ui.${suffix}.xliff`), xliff('ui', ui, uiTargets));
writeFileSync(join(outDir, `content.${suffix}.xliff`), xliff('content', content, contentTargets));
if (!lang) writeFileSync(join(outDir, 'content.en.json'), JSON.stringify(Object.fromEntries(content.map(({ id, ...rest }) => [id, rest])), null, 2) + '\n');
const w = (es) => es.reduce((n, e) => n + words(e.text), 0);
console.log(`exported ${ui.length} UI keys (${w(ui)} words) and ${content.length} content strings (${w(content)} words) to ${outDir}`);
