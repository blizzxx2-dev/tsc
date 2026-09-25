// Independent-creation archive snapshot (OPS-0055).
//
//   node scripts/ops/archive-snapshot.mjs <label> [outDir]
//
// Writes <outDir>/<yyyy-mm-dd>-<label>/ (default outDir: archive/, git-ignored):
//   repo.bundle        full git history (git bundle --all) — every commit with author dates
//   docs.tar.gz        docs/ (design docs, research, roadmap, production, loc) and extra folders
//                      listed in ARCHIVE_EXTRA (e.g. sketches/, story drafts) if they exist
//   MANIFEST.sha256    SHA-256 of every file above, plus HEAD commit and timestamp
// The folder is then uploaded to write-once (object-lock / WORM) storage by a human — see
// docs/production/legal/independent-creation-archive.md. Nothing is uploaded by this script.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const [label, outRoot = join(ROOT, 'archive')] = process.argv.slice(2);
if (!label || !/^[\w.-]+$/.test(label)) {
  console.error('usage: node scripts/ops/archive-snapshot.mjs <label: e.g. M0, demo, alpha> [outDir]');
  process.exit(2);
}
const ARCHIVE_EXTRA = ['sketches', 'story-drafts', 'art/source'];
const date = new Date().toISOString().slice(0, 10);
const dir = join(outRoot, `${date}-${label}`);
mkdirSync(dir, { recursive: true });
const run = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] });

run('git', ['bundle', 'create', join(dir, 'repo.bundle'), '--all']);
const folders = ['docs', ...ARCHIVE_EXTRA.filter((f) => existsSync(join(ROOT, f)))];
run('tar', ['-czf', join(dir, 'docs.tar.gz'), ...folders]);
const head = run('git', ['rev-parse', 'HEAD']).toString().trim();
const sha = (f) => createHash('sha256').update(readFileSync(join(dir, f))).digest('hex');
const manifest = [`# Suture & Steel independent-creation archive`, `label: ${label}`, `created: ${new Date().toISOString()}`, `head: ${head}`, `folders: ${folders.join(', ')}`, '', ...['repo.bundle', 'docs.tar.gz'].map((f) => `${sha(f)}  ${f}`), ''].join('\n');
writeFileSync(join(dir, 'MANIFEST.sha256'), manifest);
console.log(`archive written to ${dir}\n${manifest}`);
