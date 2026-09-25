// Render a ~10-minute gameplay capture of the procedural mix (bot replays of the demo's
// operations through the full audio system, offline) and measure it against the loudness spec.
// Usage: node scripts/audio-capture.mjs [out.wav] [minutes]
import { spawnSync } from 'node:child_process';

const [out = 'capture.wav', minutes = '10'] = process.argv.slice(2);
const r = spawnSync('npx', ['vitest', 'run', 'tests/audio/capture.test.ts'], { stdio: 'inherit', env: { ...process.env, AUDIO_CAPTURE: out, AUDIO_MINUTES: minutes } });
if (r.status !== 0) process.exit(r.status ?? 1);
const m = spawnSync('node', ['scripts/audio-loudness.mjs', '--capture', out], { stdio: 'inherit' });
process.exit(m.status ?? 1);
