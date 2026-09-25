// SFX event list: one row per event in src/audio/events.ts with its bus, loop flag,
// variations, voice limit, priority, caption, ducking, where the code triggers it and
// whether it plays a recording or the synthesised design.
// Usage: node scripts/audio-events-export.mjs [out.csv]   (default docs/audio/sfx-events.csv)
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { importTs } from './lib/ts-import.mjs';

const out = process.argv[2] ?? 'docs/audio/sfx-events.csv';
const { EVENTS } = await importTs('src/audio/events.ts');
const manifest = existsSync('public/audio/manifest.json') ? JSON.parse(readFileSync('public/audio/manifest.json', 'utf8')) : { files: {} };

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const sources = walk('src').filter((f) => f.endsWith('.ts') && !f.endsWith('audio/events.ts'));
const text = Object.fromEntries(sources.map((f) => [f, readFileSync(f, 'utf8')]));

const csv = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const rows = [['id', 'bus', 'loop', 'variations', 'voice_limit', 'priority', 'caption', 'ducks', 'gameplay', 'triggered_in', 'status']];
for (const [id, d] of Object.entries(EVENTS)) {
  const where = sources.filter((f) => text[f].includes(`'${id}'`) || text[f].includes(`"${id}"`) || text[f].includes(`\`${id}\``)).map((f) => f.replace(/^src\//, ''));
  // Families built from templates (e.g. sfx.tool.${id}, sfx.bell.${hour}, sfx.rate.${c}).
  const fam = id.split('.').slice(0, 2).join('.') + '.';
  if (!where.length) for (const f of sources) if (text[f].includes('`' + fam + '${')) where.push(f.replace(/^src\//, '') + ' (template)');
  const recorded = (d.assets ?? []).filter((k) => manifest.files[k]).length;
  const status = d.alias ? `alias → ${d.alias}` : recorded ? `recorded (${recorded})` : 'synthesised';
  rows.push([id, d.bus, d.loop ? 'yes' : '', d.loop ? '' : (d.vars ?? 4), d.limit ?? (d.loop ? 8 : 4), d.prio ?? 50, d.caption ?? '', d.duck ?? '', d.gameplay ? 'yes' : '', where.join('; '), status]);
}
writeFileSync(out, rows.map((r) => r.map(csv).join(',')).join('\n') + '\n');
console.log(`wrote ${rows.length - 1} events to ${out}`);
