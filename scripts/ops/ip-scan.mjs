// IP-safety name scan (supports OPS-0052 and the counsel review).
//
//   node scripts/ops/ip-scan.mjs [--json]
//
// 1. Builds the blocklist from the "Avoid" column of the IP table in
//    docs/research/warhammer-fantasy-tone.md §7 (Games Workshop and other IP) plus the Atlus/SEGA
//    Trauma Center terms in BLOCK_EXTRA below.
// 2. Collects every player-facing string: UI keys (src/i18n/strings/en.json), story/operation content and
//    barks (the export used for translation), and every string literal in src/content and src/surgery
//    (internal ids and enum values included).
// 3. Reports each blocklisted term found (word-boundary, case-insensitive) with where it occurs, and the
//    inventory of proper-name candidates (capitalised words and phrases not at sentence start) that the
//    counsel review signs off one by one (docs/production/legal/ip-name-review.md).
// Exit code 1 when a blocklisted term appears in player-facing text that is not on the ALLOW list.
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collect } from '../i18n/content.mjs';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

const BLOCK_EXTRA = ['Trauma Center', 'Trauma Team', 'Under the Knife', 'Second Opinion', 'New Blood', 'GUILT', 'Healing Touch', 'Caduceus', 'Delphi', 'Kyriaki', 'Deftera', 'Triti', 'Tetarti', 'Pempti', 'Paraskevi', 'Savato', 'Stigma', 'Rosalia', 'Derek Stiles', 'Angie Thompson', 'Hope Hospital', 'Atlus', 'SEGA', 'Games Workshop', 'Warhammer', 'Warpstone', 'Chaos'];
/** Terms that match the blocklist on purpose, with the reason (reviewed; see ip-name-review.md). */
export const ALLOW = {
  'hollow choir': 'Low-risk title overlap noted in research §7 #43; trademark knock-out search in the counsel clearance (OPS-0058).',
};

const DROP = new Set(['capital C', 'of Man', 'low risk', 'Butcher', 'Grandfather', 'strain names', 'sacred numbers 7', '9 tied to gods']);

export function blocklist() {
  const md = readFileSync(join(ROOT, 'docs/research/warhammer-fantasy-tone.md'), 'utf8');
  const sec = md.slice(md.indexOf('## 7.'), md.indexOf('## 8.'));
  const terms = new Set(BLOCK_EXTRA);
  for (const line of sec.split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length < 5 || !/^\d+$/.test(cells[1])) continue;
    const avoid = cells[2]
      .replace(/\*\*/g, '')
      .replace(/"/g, '')
      .replace(/^(Winds of Magic|Spell names|Trauma Center terms):/, '');
    for (let piece of avoid.split(/[,();]/)) {
      piece = piece.replace(/\s+as\s.*$/, '').replace(/\banything\b|…/g, '').replace(/\bthe\b\s*$/, '').trim();
      if (!piece || DROP.has(piece) || /^[a-z ]+$/.test(piece) && !/stone$/.test(piece)) continue;
      const parts = piece.split('/').map((x) => x.trim());
      const last = parts[parts.length - 1];
      const suffix = parts.length > 1 && last.includes(' ') ? last.slice(last.lastIndexOf(' ')) : '';
      for (const p of parts) {
        const t = (suffix && !p.endsWith(suffix) ? p + suffix : p).replace(/-$/, '').trim();
        if (t.length >= 3 && !DROP.has(t)) terms.add(t);
      }
    }
  }
  return [...terms];
}

/** Single-word terms match case-sensitively in player text (so "the empire" in prose is not "the Empire"). */
function matcher(term, caseSensitive) {
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}])${esc}(s)?($|[^\\p{L}])`, caseSensitive && !term.includes(' ') ? 'u' : 'iu');
}

function sourceLiterals() {
  const out = [];
  for (const dir of ['src/content', 'src/surgery']) {
    for (const f of readdirSync(join(ROOT, dir)).filter((x) => x.endsWith('.ts'))) {
      const text = readFileSync(join(ROOT, dir, f), 'utf8');
      for (const m of text.matchAll(/'([^'\n]+)'|`([^`\n]+)`/g)) out.push({ where: `${dir}/${f}`, text: m[1] ?? m[2] });
    }
  }
  return out;
}

export async function scan() {
  const { ui, content } = await collect();
  const texts = [...ui.map((e) => ({ where: `ui:${e.id}`, text: e.text, player: true })), ...content.map((e) => ({ where: `content:${e.id}`, text: e.text, player: true })), ...sourceLiterals().map((e) => ({ ...e, player: false }))];
  const hits = [];
  for (const term of blocklist()) {
    const strict = matcher(term, true);
    const loose = matcher(term, false);
    for (const t of texts) if ((t.player ? strict : loose).test(t.text)) hits.push({ term, where: t.where, player: t.player, text: t.text.slice(0, 90), allowed: ALLOW[term.toLowerCase()] });
  }
  const names = new Map();
  const STOP = new Set('The A An And But Then Now So If It Its It’s He She His Her We You They I Our My Your This That Those These There Where When What Who How Why Hold Get Put Pull Use Keep Make Take Tell Draw Trace Sear Seize Pluck Lance Tend Close Brush Stitch Nick Listen Wait Please Careful Quick Just Almost One Two Three Six Of In On By For After Across Near Off Too Do Don’t Everything Something Someone Somebody Whatever Steady Simple Show Clean Clear Cleanly Gently Moving Remarkable Speaking Practice Self-administered Surrounding Collapsed Moderate Mind Pass Rip Put Went Word High Letters Hands Burns Found Wounded Seared Stitched Sealed Torn Plucked Lanced Drained Cleansed Closed Debrided Hatched Silenced Cast Incision Antidote Restores Hover'.split(' '));
  for (const t of texts.filter((x) => x.player)) {
    for (const m of t.text.matchAll(/(?<=[\p{L},;:—–-]\s|\s\()(\p{Lu}[\p{L}’'-]+(?:\s(?:of\s|the\s)?\p{Lu}[\p{L}’'-]+)*)/gu)) {
      const n = m[1].replace(/’s$/, '');
      if (STOP.has(n)) continue;
      names.set(n, (names.get(n) ?? 0) + 1);
    }
  }
  return { terms: blocklist().length, hits, names: [...names].sort((a, b) => a[0].localeCompare(b[0])) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = await scan();
  if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 2));
  else {
    console.log(`ip-scan: ${r.terms} blocklisted terms; ${r.hits.length} hit(s); ${r.names.length} proper-name candidates`);
    for (const h of r.hits) console.log(`  ${h.allowed ? 'allowed' : h.player ? 'PLAYER ' : 'source '} "${h.term}" in ${h.where}: ${h.text}`);
    console.log(`\nnames: ${r.names.map(([n, c]) => `${n}(${c})`).join(', ')}`);
  }
  process.exit(r.hits.some((h) => h.player && !h.allowed) ? 1 : 0);
}
