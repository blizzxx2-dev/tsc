/** ENG-0256: the running or last operation's replay rides along with crash reports and support bundles. */
import { afterEach, describe, expect, it } from 'vitest';
import { allOperations } from '../../../src/content/campaign';
import { unpackReplay } from '../../../src/core/replayCodec';
import { makeReport, sentryEnvelope } from '../../../src/platform/crash';
import { currentReplay, fromBase64, rememberReplay, replayForReport, resetReplays, setLiveReplay } from '../../../src/platform/lastReplay';
import { stateHash } from '../../../src/debug/state';
import { replay, takeLog } from '../../../src/surgery/replay';
import { playWithBot } from '../../bot';

const header = { build: '1.0.0+t.20260925', content: 'c0ffee00' };

describe('replay in bug reports (ENG-0256)', () => {
  afterEach(() => resetReplays());

  it('attaches the live operation while it runs, then the packed last replay', async () => {
    const def = allOperations()[0];
    const { op } = playWithBot(def, { record: true });
    expect(currentReplay()).toBeNull();
    setLiveReplay(() => ({ log: takeLog(op), header }));
    const live = replayForReport()!;
    expect(live.opId).toBe(def.id);
    setLiveReplay(null);
    await rememberReplay(takeLog(op), header);
    const last = replayForReport()!;
    // The attached bytes re-simulate to the same final state.
    const back = await unpackReplay(fromBase64(last.base64));
    expect(stateHash(replay(op.def, back.log))).toBe(stateHash(op));
    expect(fromBase64(last.base64).length).toBeLessThan(fromBase64(live.base64).length);
  });

  it('includes the replay in the crash event', async () => {
    const def = allOperations()[0];
    const { op } = playWithBot(def, { record: true });
    await rememberReplay(takeLog(op), header);
    const r = makeReport(new Error('boom'), 'error', 'linux');
    expect(r.replay?.opId).toBe(def.id);
    const { body } = sentryEnvelope(r, { protocol: 'https', publicKey: 'k', host: 'h', projectId: '1' });
    const event = JSON.parse(body.split('\n')[2]) as { extra: { replay?: string; replayOp?: string } };
    expect(event.extra.replayOp).toBe(def.id);
    expect(event.extra.replay).toBe(r.replay!.base64);
  });
});
