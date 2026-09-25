/**
 * Log files with rotation (PLT-0121): `game.log`, rotated to `game.1.log` … `game.4.log` when it would
 * exceed 5 MB (5 files × 5 MB). Every file starts with a header naming the build, OS, locale, GPU and
 * settings tier. Plain Node for unit testing.
 */
import { appendFileSync, existsSync, mkdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_FILES = 5;

export class RotatingLog {
  private size = 0;
  constructor(
    readonly dir: string,
    private header: () => string,
    readonly base = 'game',
    private maxBytes = MAX_BYTES,
    private maxFiles = MAX_FILES,
  ) {
    mkdirSync(dir, { recursive: true });
    const f = this.file(0);
    // Each launch starts a fresh file so the header matches the running build.
    if (existsSync(f) && statSync(f).size > 0) this.rotate();
    this.start();
  }

  file(i: number): string {
    return join(this.dir, i === 0 ? `${this.base}.log` : `${this.base}.${i}.log`);
  }

  private start(): void {
    const h = this.header().trimEnd() + '\n';
    writeFileSync(this.file(0), h);
    this.size = Buffer.byteLength(h);
  }

  private rotate(): void {
    rmSync(this.file(this.maxFiles - 1), { force: true });
    for (let i = this.maxFiles - 2; i >= 0; i--) if (existsSync(this.file(i))) renameSync(this.file(i), this.file(i + 1));
  }

  write(lines: string[]): void {
    if (!lines.length) return;
    const text = lines.map((l) => l.replace(/\r?\n(?!$)/g, '\n    ')).join('\n') + '\n';
    const bytes = Buffer.byteLength(text);
    try {
      if (this.size + bytes > this.maxBytes) {
        this.rotate();
        this.start();
      }
      appendFileSync(this.file(0), text);
      this.size += bytes;
    } catch {
      // disk full / read-only: logging must never take the game down
    }
  }
}
