import { describe, expect, it } from 'vitest';
import { collectSupportFiles, exportSupportBundle, inputBuffer, InputBufferHook, RollingRecorder, INPUT_BUFFER_S } from '../src/platform/support';
import { crc32, zip } from '../src/platform/zip';
import { parseRecording } from '../src/input/record';
import { DEFAULT_PREFS } from '../src/input/bindings';
import type { InputFrame } from '../src/input/types';

const frame = (t: number, x = 0): InputFrame => ({
  t,
  t0: t - 16,
  dt: 0.016,
  start: { x, y: 0 },
  events: [{ t, type: 'move', x, y: 0, src: 'kbm' }],
  sticks: { lx: 0, ly: 0, rx: 0, ry: 0 },
  device: 'kbm',
});

describe('rolling input buffer (PLT-0131)', () => {
  it('keeps only the last 30 s of frames of the current operation', () => {
    const r = new RollingRecorder();
    expect(INPUT_BUFFER_S).toBe(30);
    r.begin('op1-1', 7, 1, DEFAULT_PREFS);
    for (let i = 0; i <= 60 * 45; i++) r.push(frame(i * (1000 / 60), i));
    const snap = r.snapshot()!;
    expect(snap.opId).toBe('op1-1');
    expect(snap.seed).toBe(7);
    const span = snap.frames.at(-1)!.t - snap.frames[0].t;
    expect(span).toBeLessThanOrEqual(30_000);
    expect(span).toBeGreaterThan(29_900);
    expect(snap.frames.at(-1)!.start.x).toBe(2700);
    // The snapshot is a copy that parses as a replay file.
    const rec = parseRecording(JSON.stringify(snap));
    expect(rec.frames.length).toBe(snap.frames.length);
    snap.frames.length = 0;
    expect(r.snapshot()!.frames.length).toBeGreaterThan(0);
  });

  it('a finished buffer stays as the last recording until the next operation begins', () => {
    const r = new RollingRecorder();
    expect(r.snapshot()).toBeNull();
    r.push(frame(0)); // no operation: dropped
    r.begin('op1-2', 1, 1.5, DEFAULT_PREFS);
    r.push(frame(10));
    const done = r.finish({ status: 'lost', score: 0, vitals: 0, timeLeft: 3 });
    expect(done?.result?.status).toBe('lost');
    expect(r.recording).toBe(false);
    expect(r.snapshot()?.opId).toBe('op1-2');
    expect(r.snapshot()?.timerAssist).toBe(1.5);
    r.begin('op1-3', 2, 1, DEFAULT_PREFS);
    expect(r.snapshot()?.opId).toBe('op1-3');
    expect(r.snapshot()?.frames).toEqual([]);
    r.clear();
    expect(r.snapshot()).toBeNull();
  });

  it('the hook chains through any other recorder and steps aside when the setting turns off', () => {
    const ring = new RollingRecorder();
    ring.begin('op', 1, 1, DEFAULT_PREFS);
    const seen: number[] = [];
    const input = { recorder: ((f: InputFrame) => seen.push(f.t)) as ((f: InputFrame) => void) | null };
    const hook = new InputBufferHook(input, ring);
    hook.sync(false);
    expect(seen).toEqual([]);
    hook.sync(true);
    input.recorder!(frame(1));
    expect(seen).toEqual([1]);
    expect(ring.snapshot()!.frames.map((f) => f.t)).toEqual([1]);
    // ?record=1 installed later replaces the recorder: the next sync chains through it.
    const later: number[] = [];
    input.recorder = (f) => later.push(f.t);
    hook.sync(true);
    input.recorder!(frame(2));
    expect(later).toEqual([2]);
    expect(ring.snapshot()!.frames.map((f) => f.t)).toEqual([1, 2]);
    hook.sync(false);
    input.recorder!(frame(3));
    expect(later).toEqual([2, 3]);
    expect(ring.snapshot()).toBeNull();
  });
});

describe('support bundle (PLT-0093)', () => {
  it('collects log, settings, profile, build and the input recording when one exists', () => {
    inputBuffer.clear();
    let files = collectSupportFiles();
    expect(Object.keys(files).sort()).toEqual(['build.txt', 'log.txt', 'profile.json', 'settings.json']);
    expect(files['build.txt']).toContain('web/web');
    inputBuffer.begin('op1-1', 1, 1, DEFAULT_PREFS);
    inputBuffer.push(frame(5));
    files = collectSupportFiles();
    expect(parseRecording(files['input-recording.json']).frames).toHaveLength(1);
    inputBuffer.clear();
  });

  it('writes a valid stored zip from strings and bytes', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    const z = zip({ 'report/log.txt': 'hello', 'report/bin': new Uint8Array([1, 2, 3]) });
    const dv = new DataView(z.buffer, z.byteOffset, z.byteLength);
    expect(dv.getUint32(0, true)).toBe(0x04034b50);
    expect(dv.getUint32(z.length - 22, true)).toBe(0x06054b50);
    expect(dv.getUint16(z.length - 22 + 10, true)).toBe(2);
    const first = 30 + 'report/log.txt'.length;
    expect(new TextDecoder().decode(z.subarray(first, first + 5))).toBe('hello');
    expect(dv.getUint32(14, true)).toBe(crc32(new TextEncoder().encode('hello')));
    // Central directory offset points at the first central header.
    expect(dv.getUint32(dv.getUint32(z.length - 22 + 16, true), true)).toBe(0x02014b50);
  });

  it('headless web build: no document to download into, so the export reports failure instead of throwing', async () => {
    await expect(exportSupportBundle()).resolves.toBeNull();
  });
});
