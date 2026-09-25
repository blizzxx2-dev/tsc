// Shared roadmap parsing for the production scripts (OPS-0007, OPS-0009).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const TASK = /^- \[([ x])\] ([A-Z]{3})-(\d{4}) · (M0|Demo|Alpha|Beta|Release|Post) · (P[0-3]) · ([SML]) · (.+)$/;
export const PHASES = ['M0', 'Demo', 'Alpha', 'Beta', 'Release', 'Post'];
export const POINTS = { S: 1, M: 3, L: 8 };

/** Parse task lines from markdown text. */
export function parseTasks(text, file = '') {
  const out = [];
  text.split('\n').forEach((line, i) => {
    const m = TASK.exec(line);
    if (!m) return;
    const [title, acceptance = ''] = m[7].split(' — ');
    out.push({ file, line: i + 1, done: m[1] === 'x', prefix: m[2], id: `${m[2]}-${m[3]}`, phase: m[4], pri: m[5], size: m[6], title: title.trim(), acceptance: acceptance.trim(), text: m[7] });
  });
  return out;
}

export function readRoadmap(root, dir = 'docs/roadmap') {
  const files = readdirSync(join(root, dir)).filter((f) => /^0\d-.*\.md$/.test(f)).sort();
  return files.flatMap((f) => parseTasks(readFileSync(join(root, dir, f), 'utf8'), `${dir}/${f}`));
}
