/** ENG-0253 compact replays, ENG-0254 state hashing + desync detector, ENG-0257 replay headers. */
import { describe, expect, it } from 'vitest';
import { allOperations } from '../../../src/content/campaign';
import { Input } from '../../../src/core/input';
import {
  contentHash,
  decodeReplay,
  encodeReplay,
  packReplay,
  quantize,
  readReplayHeader,
  REPLAY_FORMAT_VERSION,
  unpackReplay,
} from '../../../src/core/replayCodec';
import { checkpoint, describeDesync, firstDesync, HASH_EVERY, HashRecorder, replayHashes } from '../../../src/debug/desync';
import { stateHash } from '../../../src/debug/state';
import { Bindings } from '../../../src/input/bindings';
import { Operation } from '../../../src/surgery/operation';
import { replay, takeLog, type InputLog } from '../../../src/surgery/replay';
import { playWithBot, playWithBotThroughInput } from '../../bot';

const HEADER = { build: '1.0.0+abc.20260925', content: 'deadbeef' };
const byId = (id: string) => allOperations().find((d) => d.id === id)!;

/** A bot playthrough through the real input pipeline (quantised pointer), recorded. */
function liveRun(id: string) {
  const def = byId(id);
  const input = new Input(null, 1280, 720, new Bindings(null));
  const { scene } = playWithBotThroughInput(def, input, { record: true });
  return { op: scene.op, log: takeLog(scene.op) };
}

describe('replay codec (ENG-0253)', () => {
  it('round-trips a log exactly, including off-grid positions from a scripted bot', () => {
    const { op } = playWithBot(byId('op1-2'), { record: true });
    const log = takeLog(op);
    const bytes = encodeReplay(log, HEADER);
    expect(decodeReplay(bytes).log).toEqual(log);
  });

  it('keeps live input on the replay grid, so a packed boss fight stays within 50 KB per 5 minutes', async () => {
    for (const id of ['op1-5', 'op2-5']) {
      const { op, log } = liveRun(id);
      expect(op.status).toBe('won');
      const ptrs = log.ops.filter((o) => o[0] === 'p');
      expect(ptrs.every((o) => o[1] === quantize(o[1]) && o[2] === quantize(o[2]))).toBe(true);
      const bytes = await packReplay(log, HEADER);
      const minutes = op.elapsed / 60;
      const perFiveMin = (bytes.length / minutes) * 5;
      expect(perFiveMin, `${id}: ${bytes.length} B for ${minutes.toFixed(1)} min`).toBeLessThanOrEqual(50 * 1024);
      // Decoding gives the same simulation, bit for bit.
      const again = replay(op.def, (await unpackReplay(bytes)).log);
      expect(stateHash(again)).toBe(stateHash(op));
    }
  });

  it('packs a worst case — the pointer moving every 120 Hz tick for five minutes — into 50 KB', async () => {
    const ops: InputLog['ops'] = [];
    let x = 640;
    let y = 360;
    let px = x;
    let py = y;
    for (let t = 0; t < 5 * 60 * 120; t++) {
      // A hand sweeping arcs: smooth velocity with small changes.
      x = quantize(640 + Math.sin(t / 97) * 300 + Math.sin(t / 13) * 6);
      y = quantize(360 + Math.cos(t / 131) * 180 + Math.cos(t / 17) * 5);
      ops.push(['p', x, y, px, py, t % 400 < 300 ? 1 : 0, t % 400 === 0 ? 1 : 0, t % 400 === 300 ? 1 : 0, 1 / 120]);
      ops.push(['u', 1 / 120]);
      px = x;
      py = y;
    }
    const log: InputLog = { version: 1, opId: 'op1-1', opts: {}, ops };
    const bytes = await packReplay(log, HEADER);
    expect(bytes.length).toBeLessThanOrEqual(50 * 1024);
    expect((await unpackReplay(bytes)).log).toEqual(log);
    expect(decodeReplay(encodeReplay(log, HEADER)).log).toEqual(log);
  });
});

describe('replay header (ENG-0257)', () => {
  it('carries format version, build id and content hash', () => {
    const bytes = encodeReplay({ version: 1, opId: 'op1-1', opts: { seed: 3 }, ops: [['u', 1 / 120]] }, HEADER);
    expect(readReplayHeader(bytes)).toEqual({ version: REPLAY_FORMAT_VERSION, build: HEADER.build, content: HEADER.content, opId: 'op1-1' });
  });

  it('refuses incompatible replays with a clear message', () => {
    const bytes = encodeReplay({ version: 1, opId: 'op1-1', opts: {}, ops: [] }, HEADER);
    expect(() => decodeReplay(bytes, { content: 'cafef00d', build: '1.0.1' })).toThrow(/recorded on build 1\.0\.0\+abc.*cannot be replayed here/);
    const newer = bytes.slice();
    newer[4] = REPLAY_FORMAT_VERSION + 1;
    expect(() => readReplayHeader(newer)).toThrow(/newer than this build reads/);
    expect(() => readReplayHeader(new TextEncoder().encode('PK\u0003\u0004'))).toThrow(/not a Suture & Steel replay/);
    expect(() => decodeReplay(bytes.slice(0, bytes.length - 3))).toThrow(/truncated|corrupt/);
  });

  it('hashes operation content: stable for a def, different when a def changes', () => {
    const def = byId('op1-1');
    expect(contentHash(def)).toBe(contentHash(def));
    expect(contentHash({ ...def, timeLimit: def.timeLimit + 1 })).not.toBe(contentHash(def));
  });
});

describe('state hashing and desync detection (ENG-0254)', () => {
  it('replaying a recording reproduces the live checkpoint hashes every 60 ticks', () => {
    const def = byId('op1-3');
    const rec = new HashRecorder();
    const { op } = playWithBot(def, { record: true, onFrame: (o) => rec.tick(o) });
    const live = rec.checkpoints;
    expect(live.length).toBeGreaterThan(10);
    expect(live[1].tick - live[0].tick).toBe(HASH_EVERY);
    const replayed = replayHashes(op.def, takeLog(op));
    expect(replayed.map((c) => c.hash)).toEqual(live.map((c) => c.hash));
    expect(firstDesync(live, replayed)).toBeNull();
  });

  it('reports the first divergent tick and entity', () => {
    const def = byId('op1-1');
    const { op } = playWithBot(def, { record: true });
    const log = takeLog(op);
    const good = replayHashes(op.def, log);
    // Nudge one pointer sample mid-run: the replay diverges from there.
    const bad: InputLog = {
      ...log,
      ops: log.ops.map((o, i) =>
        i === Math.floor(log.ops.length / 3) && o[0] === 'p' ? (['p', o[1] + 40, o[2], o[3], o[4], o[5], o[6], o[7], o[8]] as const) : o,
      ) as InputLog['ops'],
    };
    let i = Math.floor(log.ops.length / 3);
    while (log.ops[i][0] !== 'p') i++;
    const o = log.ops[i] as Extract<InputLog['ops'][number], ['p', ...unknown[]]>;
    bad.ops[i] = ['p', o[1] + 60, o[2] + 30, o[3], o[4], 1, 1, 0, o[8]];
    const d = firstDesync(good, replayHashes(op.def, bad));
    expect(d).not.toBeNull();
    const ticksBefore = log.ops.slice(0, i).filter((x) => x[0] === 'u').length;
    expect(d!.tick).toBeGreaterThan(ticksBefore);
    expect(d!.tick).toBeLessThanOrEqual(ticksBefore + HASH_EVERY);
    expect(describeDesync(d)).toMatch(/desync at tick \d+/);
    // Entity-level diff names a kind#id when an entity's state changed.
    const a = checkpoint(new Operation(def), 0);
    const b = { ...a, hash: 'x', entities: { ...a.entities, 'Laceration#999': '00000000' } };
    expect(firstDesync([a], [b])).toEqual({ tick: 0, entity: 'Laceration#999', what: 'entity' });
  });
});
