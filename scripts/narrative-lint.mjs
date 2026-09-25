// Narrative lint (NAR-0003, NAR-0015, NAR-0021): scans every string literal in the script and
// the localisation tables for
//   - banned modern words and anachronisms (diction rules, docs/narrative/style-guide.md §3),
//   - mock-archaic pronouns (thee/thou/thy… — the register is early-modern *without* them),
//   - avoid-list names from other fantasy IP and Trauma Center terms (docs/research §7).
//
//   node scripts/narrative-lint.mjs            → report, exit 1 on any hit
//   node scripts/narrative-lint.mjs --json     → machine-readable hits
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Diction: modern words that break the early-modern register. Word-boundary, case-insensitive. */
export const BANNED_MODERN = [
  'okay',
  'ok',
  'stress',
  'stressed',
  'germ',
  'germs',
  'bacteria',
  'bacterium',
  'virus',
  'viruses',
  'infection',
  'infections',
  'infected',
  'infectious',
  'adrenaline',
  'sterile',
  'sterilise',
  'sterilize',
  'antiseptic',
  'antibiotic',
  'antibiotics',
  'oxygen',
  'hormone',
  'hormones',
  'trauma',
  'guys',
  'weekend',
];

/** Mock-archaic pronouns and verb forms: never used, not even by the Choir. */
export const BANNED_ARCHAIC = ['thee', 'thou', 'thy', 'thine', 'ye', 'hath', 'doth', 'dost', 'shalt', 'wilt'];

/**
 * Avoid-list (docs/research/warhammer-fantasy-tone.md §7): names, places, gods and coinages from
 * Games Workshop settings and other IP, plus Trauma Center terms. Case-insensitive unless noted.
 */
export const AVOID = [
  // Gods and cosmology
  'sigmar', 'sigmarite', 'shallya', 'ulric', 'taal', 'rhya', 'manann', 'morr', 'verena', 'myrmidia', 'ranald', 'khaine',
  'nurgle', 'nurgling', 'nurglings', 'tzeentch', 'khorne', 'slaanesh', 'hashut', 'horned rat', 'ruinous powers', 'dark gods',
  'plaguefather', 'great unclean one', 'plaguebearer', 'plaguebearers', 'daemon prince', 'chaos spawn', 'chaos god', 'chaos gods',
  // Substances, moons, holidays
  'warp', 'warpstone', 'warpshard', 'wyrdstone', 'morrslieb', 'mannslieb', 'geheimnisnacht', 'hexensnacht',
  // Peoples and factions
  'skaven', 'beastman', 'beastmen', 'bray-shaman', 'herdstone', 'ungor', 'turnskin', 'turnskins', 'greenskin', 'greenskins',
  'waaagh', 'squig', 'snotling', 'gnoblar', 'dawi', 'khazalid', 'karak', 'asur', 'druchii', 'asrai', 'ulthuan', 'naggaroth',
  'athel loren', 'witch elves', 'death hags', 'von carstein', 'lahmia', 'strigoi', 'necrarch', 'vargheist', 'varghulf',
  'red thirst', 'blood kiss', 'swain', 'swains', 'nagash', 'nehekhara', 'tomb kings', 'crypt ghouls', 'rat ogre',
  'clan moulder', 'master moulder', 'hell pit', 'ogre kingdoms', 'gut magic', 'pie week',
  // Places
  'old world', 'altdorf', 'nuln', 'middenheim', 'marienburg', 'talabheim', 'mordheim', 'averheim', 'wurtbad', 'reikland',
  'stirland', 'sylvania', 'ostland', 'averland', 'wissenland', 'hochland', 'middenland', 'talabecland', 'ostermark',
  'nordland', 'drakwald', 'kislev', 'bretonnia', 'tilea', 'tilean', 'estalia', 'norsca', 'border princes', 'mallus',
  // Institutions, titles, orders, named people and diseases
  'elector count', 'grand theogonist', 'colleges of magic', 'winds of magic', 'magister', 'order of the pyre',
  'knights panther', 'white wolf', 'blazing sun', 'silver hammer', 'sisters of sigmar', 'purple hand', 'red crown',
  'magnus the pious', 'teclis', 'karl franz', 'reikspiel', 'queekish', 'mandrake man',
  'red pox', 'ratte fever', "packer's pox", 'packer’s pox', 'galloping trots', 'tomb rot', 'mercy boils', 'blood rot',
  "nurgle's rot", 'crumbling ague', 'grim world of perilous adventure',
  'aqshy', 'azyr', 'chamon', 'ghur', 'ghyran', 'hysh', 'shyish', 'ulgu', 'dhar', 'witchsight',
  // Trauma Center (Atlus)
  'healing touch', 'caduceus', 'delphi', 'kyriaki', 'deuteros', 'triti', 'tetarti', 'pempti', 'paraskevi', 'savato', 'angie',
];
/** Case-sensitive entries (common English words in lower case). */
export const AVOID_CASED = ['GUILT', 'Chaos'];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const words = (list, flags) => new RegExp(`(?<![\\p{L}])(?:${list.map(esc).join('|')})(?![\\p{L}])`, flags);
export const RE_MODERN = words(BANNED_MODERN, 'iu');
export const RE_ARCHAIC = words(BANNED_ARCHAIC, 'iu');
export const RE_AVOID = words(AVOID, 'iu');
export const RE_AVOID_CASED = words(AVOID_CASED, 'u');

/** Every string literal (and template text) in a TS file, with its line. */
export function literals(file) {
  const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.ES2022, true);
  const out = [];
  const visit = (n) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) out.push({ text: n.text, line: src.getLineAndCharacterOfPosition(n.getStart()).line + 1 });
    else if (ts.isTemplateExpression(n)) for (const part of [n.head, ...n.templateSpans.map((s) => s.literal)]) out.push({ text: part.text, line: src.getLineAndCharacterOfPosition(n.getStart()).line + 1 });
    ts.forEachChild(n, visit);
  };
  visit(src);
  return out;
}

const tsFiles = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? tsFiles(p) : p.endsWith('.ts') ? [p] : [];
  });

/** Script sources: src/content plus the boss voice lines. */
export const SCRIPT_FILES = () => [...tsFiles(join(ROOT, 'src/content')), join(ROOT, 'src/surgery/bosses/voices.ts')];

/** Localisation tables (English source plus any translated tables on disk). */
export const STRING_TABLES = () => readdirSync(join(ROOT, 'src/i18n/strings')).filter((f) => f.endsWith('.json') && !f.endsWith('.meta.json')).map((f) => join(ROOT, 'src/i18n/strings', f));

export function lint() {
  const hits = [];
  const check = (where, text, rules) => {
    for (const [rule, re] of rules) {
      const m = re.exec(text);
      if (m) hits.push({ where, rule, match: m[0], text });
    }
  };
  const all = [
    ['avoid-list', RE_AVOID],
    ['avoid-list', RE_AVOID_CASED],
  ];
  const diction = [
    ['modern-word', RE_MODERN],
    ['mock-archaic', RE_ARCHAIC],
  ];
  for (const f of SCRIPT_FILES()) {
    for (const l of literals(f)) {
      // Import specifiers and ids are not prose.
      if (/^\.{1,2}\//.test(l.text) || !/\s/.test(l.text)) {
        check(`${relative(ROOT, f)}:${l.line}`, l.text, all);
        continue;
      }
      check(`${relative(ROOT, f)}:${l.line}`, l.text, [...all, ...diction]);
    }
  }
  for (const f of STRING_TABLES()) {
    for (const [k, v] of Object.entries(JSON.parse(readFileSync(f, 'utf8')))) if (!k.startsWith('@')) check(`${relative(ROOT, f)}:${k}`, String(v), all);
  }
  return hits;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const hits = lint();
  if (process.argv.includes('--json')) console.log(JSON.stringify(hits, null, 2));
  else if (hits.length) {
    console.error(`narrative lint: ${hits.length} problem(s)`);
    for (const h of hits) console.error(`  ${h.where}  [${h.rule}] “${h.match}” in: ${h.text}`);
  } else console.log('narrative lint OK');
  process.exit(hits.length ? 1 : 0);
}
