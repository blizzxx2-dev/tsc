/** GAM-0189: the bot playback scene plays exactly the run the headless bot plays, at any speed. */
import { describe, expect, it } from 'vitest';
import { OP_1_1 } from '../../../src/content/chapter1';
import { BotPlaybackScene, isProfile } from '../../../src/debug/botPlayback';
import { playWithBot } from '../../bot';

describe('GAM-0189 bot visual playback', () => {
  it('plays the operation through the real scene and reproduces the headless bot run', () => {
    let done = 0;
    const view = new BotPlaybackScene(OP_1_1, 'steady', 4, () => done++);
    for (let i = 0; i < 60 * 120 && done === 0; i++) view.update(1 / 60);
    const headless = playWithBot(view.op.def, { ...view.op.opts, profile: 'steady' }).op; // the same definition and options the scene built
    expect(view.op.status).toBe('won');
    expect(view.op.score).toBe(headless.score);
    expect(done).toBe(1);
    expect(isProfile('expert')).toBe(true);
    expect(isProfile('wizard')).toBe(false);
  });
});
