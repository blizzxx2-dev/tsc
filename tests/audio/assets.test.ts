import { describe, expect, it } from 'vitest';
import { AssetStore, banksFor } from '../../src/audio/assets';

describe('asset banks', () => {
  it('load with progress, count decoded memory, and release banks the scene no longer needs', async () => {
    const store = new AssetStore('a/');
    const manifest = {
      version: 1,
      files: {
        'sfx/a': { path: 'sfx/a.ogg', bank: 'operation', category: 'sfx', duration: 1, channels: 2, lufs: -20, truePeak: -3, bytes: 10 },
        'sfx/b': { path: 'sfx/b.ogg', bank: 'op1-5', category: 'sfx', duration: 2, channels: 1, lufs: -20, truePeak: -3, bytes: 10 },
        'sfx/c': { path: 'sfx/c.ogg', bank: 'title', category: 'sfx', duration: 1, channels: 1, lufs: -20, truePeak: -3, bytes: 10 },
      },
      banks: { operation: ['sfx/a'], 'op1-5': ['sfx/b'], title: ['sfx/c'] },
    };
    const fetcher = (async (url: string) => ({ ok: true, json: async () => manifest, arrayBuffer: async () => new ArrayBuffer(url.length) })) as unknown as typeof fetch;
    await store.init(fetcher);
    const ctx = { decodeAudioData: async () => ({ length: 48000, numberOfChannels: 2, duration: 1 }) } as unknown as BaseAudioContext;
    const progress: number[] = [];
    await store.loadBank(ctx, 'operation', (p) => progress.push(p), fetcher);
    await store.loadBank(ctx, 'op1-5', undefined, fetcher);
    expect(progress.at(-1)).toBe(1);
    expect(store.has('sfx/a')).toBe(true);
    expect(store.memoryBytes()).toBe(2 * 48000 * 2 * 4);
    // Entering the title releases the operation banks and loads the title bank.
    const orig = store.loadBank.bind(store);
    store.loadBank = (c, n, p) => orig(c, n, p, fetcher);
    await store.require(ctx, ['title']);
    expect(store.loaded()).toEqual(['title']);
    expect(store.has('sfx/a')).toBe(false);
    expect(store.has('sfx/c')).toBe(true);
  });

  it('scenes ask for the banks they use', () => {
    expect(banksFor('operation', 'op1-5')).toEqual(['boot', 'operation', 'vo-ops', 'op1-5']);
    expect(banksFor('story')).toEqual(['boot', 'story', 'vo-story']);
    expect(banksFor('title')).toEqual(['boot', 'title']);
  });
});
