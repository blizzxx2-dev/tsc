// Collects every translatable string: UI keys (src/i18n/strings/en.json + en.meta.json),
// story/operation content (src/i18n/extract.ts) and simulation barks (say/sayOnce literals).
import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import ts from 'typescript';
import { loadTs, readJson, ROOT, STRINGS_DIR } from './lib.mjs';

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .split('_')
    .slice(0, 4)
    .join('_');

/** say()/sayOnce() string literals in the simulation and scenes. */
export function scanBarks(dirs = ['src/surgery', 'src/content', 'src/scenes']) {
  const out = [];
  for (const dir of dirs) {
    for (const f of readdirSync(join(ROOT, dir)).filter((x) => x.endsWith('.ts'))) {
      const file = join(ROOT, dir, f);
      const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.ES2022, true);
      const visit = (node) => {
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
          const name = node.expression.name.text;
          const lit = (a) => (a && (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) ? a.text : undefined);
          const line = src.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          if (name === 'sayOnce') {
            const flag = lit(node.arguments[0]);
            const text = lit(node.arguments[1]);
            if (flag && text) out.push({ id: `bark.${flag}`, text, file: `${dir}/${f}`, line });
          } else if (name === 'say') {
            for (const a of node.arguments) {
              const text = lit(a);
              if (text) out.push({ id: `bark.${basename(f, '.ts')}.${slug(text)}`, text, file: `${dir}/${f}`, line });
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(src);
    }
  }
  return out;
}

export async function collect() {
  const en = readJson(join(STRINGS_DIR, 'en.json'));
  const meta = readJson(join(STRINGS_DIR, 'en.meta.json'));
  const ui = Object.entries(en)
    .filter(([k]) => !k.startsWith('@'))
    .map(([id, text]) => ({ id, text, scope: 'ui', chapter: 'global', context: meta[id]?.context ?? '', meta: meta[id] }));
  const { contentEntries } = await loadTs('src/i18n/extract.ts');
  const content = contentEntries();
  const known = new Set(content.map((e) => e.text));
  const seen = new Set();
  const barks = [];
  for (const b of scanBarks()) {
    if (known.has(b.text) || seen.has(b.id)) continue;
    seen.add(b.id);
    barks.push({ id: b.id, text: b.text, scope: 'barks', chapter: 'global', speaker: 'Sister Ilse', context: `Assistant bark spoken during operations (${b.file}:${b.line}).` });
  }
  return { ui, content: [...content, ...barks] };
}

export const words = (s) => (s.replace(/\{[^{}]*\}/g, ' ').match(/[\p{L}\p{N}’'-]+/gu) ?? []).length;
