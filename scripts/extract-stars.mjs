// Build star-corpus fixtures (INP-0055) from input recordings made with `?record=1`.
// Every Litany draw stroke (right mouse or LT held) in the recordings becomes one
// CorpusStroke; tests/starBenchmark.test.ts picks up tests/fixtures/stars/*.json.
//
// Usage: node scripts/extract-stars.mjs <star|other> <mouse|trackpad|pen|gamepad> <out.json> <recording.json ...>
//   Record positives and negatives in separate sessions so the label applies to every stroke.
import { readFileSync, writeFileSync } from 'node:fs';

const [label, device, out, ...files] = process.argv.slice(2);
if (!['star', 'other'].includes(label) || !['mouse', 'trackpad', 'pen', 'gamepad'].includes(device) || !out || !files.length) {
  console.error('usage: node scripts/extract-stars.mjs <star|other> <mouse|trackpad|pen|gamepad> <out.json> <recording.json ...>');
  process.exit(1);
}
const DRAW = new Set(['mouse:2', 'pad:6']);
const strokes = [];
for (const f of files) {
  const rec = JSON.parse(readFileSync(f, 'utf8'));
  if (rec.format !== 'suture-and-steel/input-recording') throw new Error(`${f}: not an input recording`);
  let pos = null;
  let cur = null;
  for (const frame of rec.frames) {
    pos = pos ?? frame.start;
    for (const ev of frame.events) {
      if (ev.type === 'move') {
        pos = { x: ev.x, y: ev.y };
        if (cur) cur.push(pos);
      } else if (ev.type === 'down' && DRAW.has(ev.code)) cur = [pos];
      else if (ev.type === 'up' && DRAW.has(ev.code) && cur) {
        if (cur.length >= 2) strokes.push({ label, kind: label === 'star' ? 'pentagram' : 'recorded', device, points: cur });
        cur = null;
      }
    }
  }
}
writeFileSync(out, JSON.stringify(strokes));
console.log(`${strokes.length} strokes → ${out}`);
