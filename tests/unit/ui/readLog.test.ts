import { describe, expect, it } from 'vitest';
import { canSkip, ReadLog } from '../../../src/ui/readLog';

const memStore = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe('UIX-0124 read-text tracking', () => {
  it('remembers read lines across instances once flushed', () => {
    const store = memStore();
    const a = new ReadLog(store);
    a.mark(ReadLog.lineId('prologue', 3));
    a.flush();
    const b = new ReadLog(store);
    expect(b.has('prologue#3')).toBe(true);
    expect(b.has('prologue#4')).toBe(false);
  });

  it('fast-forward passes only read lines unless skip-unread is on', () => {
    expect(canSkip(true, false)).toBe(true);
    expect(canSkip(false, false)).toBe(false);
    expect(canSkip(false, true)).toBe(true);
  });

  it('survives unreadable storage', () => {
    const broken = {
      getItem: () => '{not json',
      setItem: () => {
        throw new Error('full');
      },
    };
    const log = new ReadLog(broken);
    log.mark('x#1');
    expect(() => log.flush()).not.toThrow();
    expect(log.has('x#1')).toBe(true);
  });
});
