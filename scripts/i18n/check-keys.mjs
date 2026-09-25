// Key-usage scanner (LOC-0015) and hard-coded text audit (LOC-0013).
//
//   node scripts/i18n/check-keys.mjs [--strict]
//
// Uses the TypeScript compiler API over src/**/*.ts:
//  - every t()/tr() call (whatever local name `t` is imported under) → literal keys, template-literal
//    key patterns (`tool.${id}.name`) and non-literal keys;
//  - string literals equal to a key count as references (option-row tables, `t(c ? 'a' : 'b')`);
//  - simulation text that the HUD resolves with tSource() (rate labels, popups, loss reasons in
//    src/surgery) must have a key in the label./popup./loss. namespaces;
//  - text-draw calls in src/scenes, src/ui, src/input and src/audio (g.text, g.textBlock, giltText, button, op.popup) must
//    not receive English literals or template literals that assemble sentences.
// Fails on missing keys, untranslatable simulation text and hard-coded draw text; reports unused
// keys and non-literal keys (failing on those too with --strict).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { readJson, ROOT, STRINGS_DIR } from './lib.mjs';

export function scan() {
  const en = readJson(join(STRINGS_DIR, 'en.json'));
  const keys = new Set(Object.keys(en).filter((k) => !k.startsWith('@')));
  const byText = new Map([...keys].filter((k) => /^(label|popup|loss)\./.test(k)).map((k) => [en[k], k]));
  const used = new Set();
  const missing = [];
  const nonLiteral = [];
  const hardcoded = [];
  const simUntranslatable = [];

  const files = [];
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.ts')) files.push(p);
    }
  };
  walk(join(ROOT, 'src'));

  const DRAW = { text: 0, textBlock: 0, popup: 0 };
  const DRAW_FN = { giltText: 1, button: 2 };
  const hasWords = (s) => /\p{L}{2,}/u.test(s);

  for (const file of files) {
    const rel = relative(ROOT, file);
    if (rel.startsWith('src/i18n/')) continue;
    const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.ES2022, true);
    const tNames = new Set();
    for (const st of src.statements) {
      if (
        ts.isImportDeclaration(st) &&
        /\/i18n(\/index)?['"]$/.test(st.moduleSpecifier.getText(src)) &&
        st.importClause?.namedBindings &&
        ts.isNamedImports(st.importClause.namedBindings)
      ) {
        for (const el of st.importClause.namedBindings.elements) if ((el.propertyName ?? el.name).text === 't') tNames.add(el.name.text);
      }
    }
    const isUi =
      rel.startsWith('src/scenes/') ||
      rel.startsWith('src/ui/') ||
      rel.startsWith('src/input/') ||
      (rel.startsWith('src/audio/') && !rel.endsWith('debug-overlay.ts'));
    const isSim = rel.startsWith('src/surgery/');
    const where = (n) => `${rel}:${src.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
    const literalsIn = (n, acc = []) => {
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) acc.push(n.text);
      ts.forEachChild(n, (c) => {
        literalsIn(c, acc);
      });
      return acc;
    };

    const visit = (node) => {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        if (keys.has(node.text)) used.add(node.text);
        // Simulation and content text is matched to its key by value (tSource).
        if ((isSim || rel.startsWith('src/content/')) && byText.has(node.text)) used.add(byText.get(node.text));
      }
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        const fn = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : '';
        // t(key) calls.
        if (ts.isIdentifier(callee) && tNames.has(callee.text)) {
          const a = node.arguments[0];
          if (a && (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a))) {
            if (!keys.has(a.text)) missing.push(`${where(a)} "${a.text}"`);
          } else if (a && ts.isTemplateExpression(a)) {
            const re = new RegExp(
              `^${[a.head.text, ...a.templateSpans.map((s) => s.literal.text)].map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^.]+')}$`,
            );
            const hits = [...keys].filter((k) => re.test(k));
            if (hits.length === 0) missing.push(`${where(a)} pattern ${re}`);
            hits.forEach((k) => used.add(k));
          } else if (a) {
            const lits = literalsIn(a).filter((s) => /^[a-z]+\./.test(s));
            lits.forEach((s) => (keys.has(s) ? used.add(s) : missing.push(`${where(a)} "${s}"`)));
            if (lits.length === 0) nonLiteral.push(`${where(a)} ${a.getText(src).slice(0, 60)}`);
          }
        }
        // Simulation text resolved by tSource(): rate labels, popups, loss reasons.
        if (isSim && (fn === 'rate' || fn === 'popup' || fn === 'lose')) {
          const idx = fn === 'rate' ? 2 : 0;
          const a = node.arguments[idx];
          if (a && (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) && hasWords(a.text) && !byText.has(a.text))
            simUntranslatable.push(`${where(a)} "${a.text}"`);
        }
        // Hard-coded text reaching a draw call.
        const idx = isUi ? (ts.isPropertyAccessExpression(callee) ? DRAW[fn] : DRAW_FN[fn]) : undefined;
        if (idx !== undefined) {
          const a = node.arguments[idx];
          if (a && (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) && hasWords(a.text)) hardcoded.push(`${where(a)} "${a.text}"`);
          if (a && ts.isTemplateExpression(a) && hasWords([a.head.text, ...a.templateSpans.map((s) => s.literal.text)].join('')))
            hardcoded.push(`${where(a)} template ${a.getText(src).slice(0, 60)}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(src);
  }
  // Embedded-object labels live in a spec table rather than a call.
  for (const k of keys) if (/^label\.embedded\./.test(k)) used.add(k);
  // Action names are looked up by action id (`action.${id}`), and ids contain dots.
  for (const k of keys) if (/^action\./.test(k)) used.add(k);
  // Vitals popups ("-12", "+25") are matched by pattern in tSource().
  used.add('popup.vitals_loss');
  used.add('popup.vitals_gain');
  const unused = [...keys].filter((k) => !used.has(k)).sort();
  return { keys: keys.size, used: used.size, missing, unused, nonLiteral, hardcoded, simUntranslatable };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const strict = process.argv.includes('--strict');
  const r = scan();
  const section = (title, list) => list.length && console.log(`\n${title} (${list.length}):\n  ${list.join('\n  ')}`);
  console.log(`i18n:check — ${r.keys} keys in en.json, ${r.used} referenced`);
  section('MISSING from en.json', r.missing);
  section('Simulation text with no label./popup./loss. key', r.simUntranslatable);
  section('Hard-coded text in draw calls', r.hardcoded);
  section('Unused keys', r.unused);
  section('Non-literal keys', r.nonLiteral);
  const fail = r.missing.length + r.simUntranslatable.length + r.hardcoded.length + (strict ? r.unused.length + r.nonLiteral.length : 0);
  console.log(fail ? `\nFAILED (${fail} problems)` : '\nOK');
  process.exit(fail ? 1 : 0);
}
