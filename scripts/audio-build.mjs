// Audio asset pipeline.
//
//   assets-src/audio/<category>/<bank>/<name>.wav   (48 kHz / 24-bit PCM sources)
//   assets-src/audio/<category>/<bank>/<name>.json  (optional: { "loop": [a, b], "licence": "...", "source": "..." })
//
// category: sfx | music | vo | amb. The asset key is "<category>/<name>" (VO names are
// line ids, e.g. vo/line.1a2b3c4d — see src/audio/vo.ts). Output: Ogg Opus in
// public/audio/<category>/<name>.ogg (SFX/ambience 96 kbps, music 160 kbps, VO 64 kbps
// mono) and public/audio/manifest.json with duration, integrated LUFS, true peak,
// bytes, bank and provenance.
//
// Usage: node scripts/audio-build.mjs            encode changed files, write the manifest
//        node scripts/audio-build.mjs --check    CI: fail on bad sources, missing or oversized files,
//                                                or a decoded footprint over the demo budget (150 MB)
//        node scripts/audio-build.mjs --release  also fail on any file without licence + provenance,
//                                                or marked temporary ("temp": true / name contains "temp")
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import { importTs } from './lib/ts-import.mjs';

const SRC = process.env.AUDIO_SRC ?? 'assets-src/audio';
const OUT = process.env.AUDIO_OUT ?? 'public/audio';
const RELEASE = process.argv.includes('--release');
const CHECK = process.argv.includes('--check') || RELEASE;
/** Decoded PCM budget for the demo (float32, 48 kHz). */
const MEMORY_BUDGET_MB = 150;

export const CATEGORY = {
  sfx: { kbps: 96, mono: false, maxBytes: 1_000_000 },
  amb: { kbps: 96, mono: false, maxBytes: 4_000_000 },
  music: { kbps: 160, mono: false, maxBytes: 8_000_000 },
  vo: { kbps: 64, mono: true, maxBytes: 400_000 },
};

/** Parse a RIFF/WAVE header: format, channels, rate, bits, data length. */
export function wavInfo(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not a RIFF/WAVE file');
  let p = 12;
  let fmt = null;
  let dataBytes = 0;
  while (p + 8 <= buf.length) {
    const id = buf.toString('ascii', p, p + 4);
    const size = buf.readUInt32LE(p + 4);
    if (id === 'fmt ') fmt = { format: buf.readUInt16LE(p + 8), channels: buf.readUInt16LE(p + 10), rate: buf.readUInt32LE(p + 12), bits: buf.readUInt16LE(p + 22) };
    if (id === 'data') dataBytes = size;
    p += 8 + size + (size & 1);
  }
  if (!fmt) throw new Error('no fmt chunk');
  return { ...fmt, duration: dataBytes / (fmt.rate * fmt.channels * (fmt.bits / 8)) };
}

/** Integrated loudness (LUFS), true peak (dBTP) and loudness range via ffmpeg's EBU R128 scanner. */
export function loudness(file) {
  const r = spawnSync(ffmpegPath, ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`ffmpeg failed on ${file}: ${r.stderr.slice(-400)}`);
  return parseEbur(r.stderr);
}

export function parseEbur(text) {
  const summary = text.slice(text.lastIndexOf('Summary:'));
  const i = /I:\s+(-?[\d.]+|-inf) LUFS/.exec(summary);
  const tp = /Peak:\s+(-?[\d.]+|-inf) dBFS/.exec(summary);
  const lra = /LRA:\s+(-?[\d.]+) LU/.exec(summary);
  const num = (m) => (!m ? NaN : m[1] === '-inf' ? -Infinity : Number(m[1]));
  return { lufs: num(i), truePeak: num(tp), lra: num(lra) };
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

async function main() {
  const problems = [];
  const files = {};
  const banks = {};
  const prev = existsSync(join(OUT, 'manifest.json')) ? JSON.parse(readFileSync(join(OUT, 'manifest.json'), 'utf8')) : { files: {} };
  for (const wav of walk(SRC).filter((f) => f.endsWith('.wav'))) {
    const rel = relative(SRC, wav).split(/[\\/]/);
    const [category, bank, ...rest] = rel;
    const spec = CATEGORY[category];
    if (!spec || !bank || !rest.length) {
      problems.push(`${wav}: expected ${SRC}/<sfx|music|vo|amb>/<bank>/<name>.wav`);
      continue;
    }
    const name = rest.join('/').replace(/\.wav$/, '');
    const key = `${category}/${name}`;
    let info;
    try {
      info = wavInfo(readFileSync(wav));
    } catch (e) {
      problems.push(`${wav}: ${e.message}`);
      continue;
    }
    if (info.rate !== 48000 || info.bits !== 24) problems.push(`${wav}: source must be 48 kHz / 24-bit (is ${info.rate} Hz / ${info.bits}-bit)`);
    const sidecar = wav.replace(/\.wav$/, '.json');
    const meta = existsSync(sidecar) ? JSON.parse(readFileSync(sidecar, 'utf8')) : {};
    const outRel = `${category}/${name}.ogg`;
    const outFile = join(OUT, outRel);
    const srcTime = statSync(wav).mtimeMs;
    const fresh = existsSync(outFile) && statSync(outFile).mtimeMs >= srcTime && prev.files[key];
    if (!CHECK && !fresh) {
      mkdirSync(dirname(outFile), { recursive: true });
      execFileSync(ffmpegPath, ['-y', '-hide_banner', '-loglevel', 'error', '-i', wav, '-c:a', 'libopus', '-b:a', `${spec.kbps}k`, ...(spec.mono ? ['-ac', '1'] : []), outFile]);
    }
    if (!existsSync(outFile)) {
      problems.push(`${key}: not encoded (run node scripts/audio-build.mjs)`);
      continue;
    }
    const bytes = statSync(outFile).size;
    if (bytes > spec.maxBytes) problems.push(`${key}: ${bytes} bytes exceeds the ${category} limit of ${spec.maxBytes}`);
    const m = fresh ? prev.files[key] : loudness(wav);
    if (RELEASE && (!meta.licence || !meta.source)) problems.push(`${key}: no licence/provenance recorded (add ${sidecar})`);
    if (RELEASE && (meta.temp || /temp/i.test(name))) problems.push(`${key}: temporary asset in a release build`);
    files[key] = { path: outRel, bank, category, duration: Number(info.duration.toFixed(3)), channels: spec.mono ? 1 : info.channels, lufs: m.lufs, truePeak: m.truePeak, bytes, ...(meta.loop ? { loop: meta.loop } : {}), ...(meta.licence ? { licence: meta.licence } : {}), ...(meta.source ? { source: meta.source } : {}) };
    (banks[bank] ??= []).push(key);
  }
  // Every asset an event names must exist.
  const { EVENTS } = await importTs('src/audio/events.ts');
  for (const [id, def] of Object.entries(EVENTS)) for (const k of def.assets ?? []) if (!files[k]) problems.push(`event ${id}: asset ${k} is missing`);
  const manifest = { version: 1, files, banks };
  if (!CHECK) {
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  } else if (existsSync(join(OUT, 'manifest.json'))) {
    const onDisk = JSON.parse(readFileSync(join(OUT, 'manifest.json'), 'utf8'));
    if (JSON.stringify(Object.keys(onDisk.files).sort()) !== JSON.stringify(Object.keys(files).sort())) problems.push('manifest.json is stale: run node scripts/audio-build.mjs');
  }
  const n = Object.keys(files).length;
  // Resident at once: the banks one scene needs (see banksFor in src/audio/assets.ts).
  const bankMb = (b) => (banks[b] ?? []).reduce((a, k) => a + files[k].duration * 48000 * files[k].channels * 4, 0) / 1048576;
  const extra = Object.keys(banks).filter((b) => !['boot', 'title', 'story', 'operation', 'vo-ops', 'vo-story'].includes(b));
  const sets = [['boot', 'title'], ['boot', 'story', 'vo-story'], ['boot', 'operation', 'vo-ops'], ...extra.map((b) => ['boot', 'operation', 'vo-ops', b])];
  const peak = sets.reduce((m, set) => Math.max(m, set.reduce((a, b) => a + bankMb(b), 0)), 0);
  console.log(`audio: ${n} files in ${Object.keys(banks).length} banks, peak resident ≈${peak.toFixed(1)} MB decoded`);
  if (peak > MEMORY_BUDGET_MB) problems.push(`peak decoded footprint ${peak.toFixed(1)} MB exceeds the ${MEMORY_BUDGET_MB} MB budget`);
  if (problems.length) {
    console.error(problems.map((p) => `  ✗ ${p}`).join('\n'));
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
