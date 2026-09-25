// Loudness CI: measure every audio asset (EBU R128 via ffmpeg) against its category's
// target from docs/audio/loudness.md, or a gameplay capture against the mix spec.
//
// Usage: node scripts/audio-loudness.mjs                 check every file in public/audio/manifest.json
//        node scripts/audio-loudness.mjs --capture x.wav check a gameplay capture (−18 LUFS ±2, ≤ −1 dBTP)
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loudness } from './audio-build.mjs';

const OUT = process.env.AUDIO_OUT ?? 'public/audio';

/** Targets per category: integrated LUFS window (null = unchecked) and max true peak (dBTP). */
export const TARGETS = {
  sfx: { lufs: null, tp: -3 },
  amb: { lufs: [-30, -22], tp: -6 },
  music: { lufs: [-22, -18], tp: -1 },
  vo: { lufs: [-25, -23], tp: -3 },
  capture: { lufs: [-20, -16], tp: -1 },
};

export function judge(category, m) {
  const t = TARGETS[category];
  const bad = [];
  if (t.lufs && !(m.lufs >= t.lufs[0] && m.lufs <= t.lufs[1])) bad.push(`integrated ${m.lufs.toFixed(1)} LUFS outside ${t.lufs[0]}…${t.lufs[1]}`);
  if (m.truePeak > t.tp) bad.push(`true peak ${m.truePeak.toFixed(1)} dBTP above ${t.tp}`);
  return bad;
}

const args = process.argv.slice(2);
const ci = args.indexOf('--capture');
if (ci >= 0) {
  const file = args[ci + 1];
  const m = loudness(file);
  const bad = judge('capture', m);
  console.log(`${file}: ${m.lufs.toFixed(1)} LUFS integrated, ${m.truePeak.toFixed(1)} dBTP, LRA ${m.lra.toFixed(1)} LU`);
  if (bad.length) {
    console.error(`  ✗ ${bad.join('; ')}`);
    process.exit(1);
  }
  process.exit(0);
}

const manifestFile = join(OUT, 'manifest.json');
if (!existsSync(manifestFile)) {
  console.log('audio loudness: no manifest — nothing to check');
  process.exit(0);
}
const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
let failures = 0;
for (const [key, e] of Object.entries(manifest.files)) {
  const m = loudness(join(OUT, e.path));
  const bad = judge(e.category, m);
  if (bad.length) {
    failures++;
    console.error(`  ✗ ${key}: ${bad.join('; ')}`);
  }
}
console.log(`audio loudness: ${Object.keys(manifest.files).length} files, ${failures} out of tolerance`);
process.exit(failures ? 1 : 0);
