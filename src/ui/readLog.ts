/**
 * Read-text tracking (UIX-0124): which story lines this profile has already seen. Fast-forward
 * only runs through seen lines unless "Skip unread text" is on, and stops at the first unread one.
 * Stored in browser storage; a missing or blocked store simply means nothing counts as read.
 */
const KEY = 'suture-and-steel.read-lines';

export class ReadLog {
  private seen = new Set<string>();
  private dirty = false;

  constructor(private store: Pick<Storage, 'getItem' | 'setItem'> | null = typeof localStorage === 'undefined' ? null : localStorage) {
    try {
      const raw = this.store?.getItem(KEY);
      if (raw) for (const id of JSON.parse(raw) as string[]) this.seen.add(id);
    } catch {
      // Unreadable storage: start with nothing read.
    }
  }

  static lineId(storyId: string, index: number): string {
    return `${storyId}#${index}`;
  }

  has(id: string): boolean {
    return this.seen.has(id);
  }

  mark(id: string): void {
    if (this.seen.has(id)) return;
    this.seen.add(id);
    this.dirty = true;
  }

  /** Persist if anything changed (call when a scene ends or periodically). */
  flush(): void {
    if (!this.dirty) return;
    this.dirty = false;
    try {
      this.store?.setItem(KEY, JSON.stringify([...this.seen]));
    } catch {
      // Storage full or blocked: keep the in-memory log.
    }
  }
}

export const readLog = new ReadLog();

/** May fast-forward pass this line? */
export const canSkip = (seen: boolean, skipUnread: boolean): boolean => seen || skipUnread;
