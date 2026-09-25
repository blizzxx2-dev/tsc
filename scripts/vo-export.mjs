// VO script export: every speakable line — story scenes, phase callouts and in-operation
// barks — as a CSV for casting and recording, keyed by a stable content id and by the
// runtime asset key (vo/line.<hash>, see src/audio/vo.ts). Re-exporting against the
// previous file lists added, changed and removed lines (pickups).
// Usage: node scripts/vo-export.mjs [out.csv]   (default docs/audio/vo-script.csv)
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { importTs } from './lib/ts-import.mjs';

const out = process.argv[2] ?? 'docs/audio/vo-script.csv';
const { CAMPAIGN } = await importTs('src/content/campaign.ts');
const { CAST } = await importTs('src/content/characters.ts');
const { lineId } = await importTs('src/audio/vo.ts');

const emotion = (t) => (/!/.test(t) ? 'urgent' : /\?/.test(t) ? 'questioning' : /…|\.\.\./.test(t) ? 'hesitant' : 'neutral');
/** Barks that repeat get three variants (AUD-0099). */
const REPEATING = /vitals|brand|blood|flooded|there!|good|well done|steady/i;
const rows = [];
const add = (id, who, text, context, maxDur, variants = 1) => rows.push({ id, key: lineId(text), who, text, context, emotion: emotion(text), maxDur: maxDur.toFixed(1), variants });

for (const ch of CAMPAIGN) {
  for (const step of ch.steps) {
    if (step.kind === 'story') {
      const s = step.story;
      s.lines.forEach((l, i) => {
        if (l.who === 'narrator') return;
        add(`${s.id}.${String(i + 1).padStart(3, '0')}`, l.as ?? CAST[l.who].name, l.text, `${ch.numeral} · ${s.place}`, 1 + l.text.length * 0.065);
      });
    } else {
      const op = step.op;
      op.phases.forEach((p, pi) =>
        (p.callout ?? []).forEach((line, li) => add(`${op.id}.p${pi}.${li + 1}`, 'Sister Ilse', line, `${op.title} — phase ${pi + 1}`, Math.max(2.4, line.length * 0.055))),
      );
    }
  }
}

// In-operation barks: literal say()/sayOnce() strings in the simulation and scenes.
const barkFiles = ['src/surgery', 'src/scenes'].flatMap((d) => readdirSync(d).filter((f) => f.endsWith('.ts')).map((f) => join(d, f)));
const seen = new Set(rows.map((r) => r.key));
for (const f of barkFiles) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\.say(Once)?\(\s*(?:'([^']+)'\s*,\s*|'[^']*'\s*\+\s*[^,]+,\s*)?'([^']+)'/g)) {
    const flag = m[2] ?? 'say';
    const text = m[3];
    const key = lineId(text);
    if (seen.has(key)) continue;
    seen.add(key);
    const base = `bark.${flag === 'say' ? key.slice(5) : flag.replace(/[^a-z0-9]+/gi, '-')}`;
    add(base, 'Sister Ilse', text, `bark (${f.replace(/^src\//, '')})`, Math.max(2.4, text.length * 0.055), REPEATING.test(text) ? 3 : 1);
  }
}

const csv = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const header = ['id', 'asset_key', 'character', 'line', 'context', 'emotion', 'max_duration_s', 'variants'];
const body = rows.map((r) => [r.id, r.key, r.who, r.text, r.context, r.emotion, r.maxDur, r.variants].map(csv).join(','));

// Diff against the previous export.
if (existsSync(out)) {
  const prev = new Map(
    readFileSync(out, 'utf8')
      .trim()
      .split('\n')
      .slice(1)
      .map((l) => [l.split(',')[0], l]),
  );
  const now = new Map(body.map((l) => [l.split(',')[0], l]));
  const added = [...now.keys()].filter((k) => !prev.has(k));
  const removed = [...prev.keys()].filter((k) => !now.has(k));
  const changed = [...now.keys()].filter((k) => prev.has(k) && prev.get(k).split(',')[1] !== now.get(k).split(',')[1]);
  if (added.length + removed.length + changed.length) {
    console.log(`pickups: ${changed.length} changed, ${added.length} added, ${removed.length} removed`);
    for (const k of changed) console.log(`  ~ ${k}`);
    for (const k of added) console.log(`  + ${k}`);
    for (const k of removed) console.log(`  - ${k}`);
  } else console.log('no line changes since the last export');
}
writeFileSync(out, [header.join(','), ...body].join('\n') + '\n');
console.log(`wrote ${rows.length} lines to ${out}`);
