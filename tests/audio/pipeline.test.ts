import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import { describe, expect, it } from 'vitest';

const tone = (file: string, rate: number, fmt: string, secs = 1, vol = 0.25) =>
  spawnSync(ffmpegPath as unknown as string, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `sine=frequency=440:duration=${secs}:sample_rate=${rate}`, '-af', `volume=${vol}`, '-ac', '2', '-c:a', fmt, file]);

const build = (src: string, out: string, ...args: string[]) => spawnSync('node', ['scripts/audio-build.mjs', ...args], { encoding: 'utf8', env: { ...process.env, AUDIO_SRC: src, AUDIO_OUT: out } });

describe('audio asset pipeline', () => {
  it('encodes 48 kHz/24-bit sources to Opus with a measured manifest, and rejects bad sources', () => {
    const root = mkdtempSync(join(tmpdir(), 'aud-'));
    const src = join(root, 'src');
    const out = join(root, 'out');
    mkdirSync(join(src, 'sfx/operation'), { recursive: true });
    mkdirSync(join(src, 'vo/ilse'), { recursive: true });
    tone(join(src, 'sfx/operation/extract.arrow.01.wav'), 48000, 'pcm_s24le');
    writeFileSync(join(src, 'sfx/operation/extract.arrow.01.json'), JSON.stringify({ licence: 'CC0', source: 'test tone' }));
    tone(join(src, 'vo/ilse/line.00000001.wav'), 48000, 'pcm_s24le', 1.5);
    const ok = build(src, out);
    expect(ok.status, ok.stderr).toBe(0);
    const m = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
    const e = m.files['sfx/extract.arrow.01'];
    expect(e.path).toBe('sfx/extract.arrow.01.ogg');
    expect(e.bank).toBe('operation');
    expect(e.duration).toBeCloseTo(1, 1);
    expect(e.lufs).toBeLessThan(-5);
    expect(e.truePeak).toBeLessThan(0);
    expect(e.licence).toBe('CC0');
    expect(m.files['vo/line.00000001'].channels).toBe(1);
    expect(m.banks.ilse).toEqual(['vo/line.00000001']);
    expect(build(src, out, '--check').status).toBe(0);
    // Licence audit: the VO take has no provenance sidecar.
    const rel = build(src, out, '--release');
    expect(rel.status).toBe(1);
    expect(rel.stderr).toMatch(/vo\/line\.00000001: no licence/);
    writeFileSync(join(src, 'vo/ilse/line.00000001.json'), JSON.stringify({ licence: 'performer contract', source: 'session 1, take 2' }));
    expect(build(src, out, '--release').status).toBe(0);

    tone(join(src, 'sfx/operation/bad.wav'), 44100, 'pcm_s16le');
    const bad = build(src, out);
    expect(bad.status).toBe(1);
    expect(bad.stderr).toMatch(/48 kHz \/ 24-bit/);
  }, 60_000);
});
