/** ENG-0186: exact device-pixel backbuffer sizing and DPR re-evaluation across monitors. */
import { describe, expect, it } from 'vitest';
import { backbufferSize, watchDevicePixelRatio } from '../../../src/render/viewport';

describe('backbuffer sizing (ENG-0186)', () => {
  it('uses the device-pixel content box when the browser reports it', () => {
    // 1.25× Windows scaling: the device box is authoritative (the browser snaps CSS edges to physical pixels).
    expect(backbufferSize({ devicePixelContentBoxSize: [{ inlineSize: 1279, blockSize: 719 }] }, 1023.2, 575.4, 1.25)).toEqual({
      w: 1279,
      h: 719,
      exact: true,
    });
    expect(backbufferSize(null, 1280, 720, 1.5)).toEqual({ w: 1920, h: 1080, exact: false });
    expect(backbufferSize({ contentBoxSize: [{ inlineSize: 1280, blockSize: 720 }] }, 1280, 720, 2)).toEqual({ w: 2560, h: 1440, exact: false });
  });

  it('ignores a stale box from before a resize', () => {
    expect(backbufferSize({ devicePixelContentBoxSize: [{ inlineSize: 1280, blockSize: 720 }] }, 1600, 900, 1)).toEqual({ w: 1600, h: 900, exact: false });
  });

  it('re-evaluates when the window moves to a monitor with another scale', () => {
    const listeners = new Map<string, () => void>();
    const win = {
      devicePixelRatio: 1,
      matchMedia: (q: string) =>
        ({
          media: q,
          addEventListener: (_t: string, fn: () => void) => listeners.set(q, fn),
          removeEventListener: (_t: string, fn: () => void) => listeners.get(q) === fn && listeners.delete(q),
        }) as unknown as MediaQueryList,
    };
    const seen: number[] = [];
    const stop = watchDevicePixelRatio((d) => seen.push(d), win as unknown as Window);
    expect([...listeners.keys()]).toEqual(['(resolution: 1dppx)']);
    // Dragged onto a 150 % monitor: the 1 dppx query stops matching and fires.
    win.devicePixelRatio = 1.5;
    listeners.get('(resolution: 1dppx)')!();
    expect(seen).toEqual([1.5]);
    expect([...listeners.keys()]).toEqual(['(resolution: 1.5dppx)']);
    win.devicePixelRatio = 1;
    listeners.get('(resolution: 1.5dppx)')!();
    expect(seen).toEqual([1.5, 1]);
    stop();
    expect(listeners.size).toBe(0);
  });
});
