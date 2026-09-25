/**
 * Atomic save files (PLT-0082): write `<name>.tmp`, fsync, keep the previous *valid* file as
 * `<name>.bak`, rename the temp file over the target, fsync the directory. A crash or power cut at any
 * point leaves either the old or the new file intact, plus a backup. Plain Node — no Electron — so the
 * kill-mid-write test drives it from a child process.
 */
import { closeSync, copyFileSync, existsSync, fsyncSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, rmSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { isSafeName } from './paths';

/** Returns true if `text` is a well-formed save envelope (so it is worth keeping as a backup). */
export type Validator = (name: string, text: string) => boolean;

function fsyncDir(dir: string): void {
  if (process.platform === 'win32') return; // directories cannot be opened for fsync on Windows
  try {
    const fd = openSync(dir, 'r');
    try {
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  } catch {
    // best effort
  }
}

export function atomicWrite(dir: string, name: string, data: string, valid: Validator): void {
  if (!isSafeName(name)) throw new Error(`Refusing unsafe file name: ${name}`);
  mkdirSync(dir, { recursive: true });
  const target = join(dir, name);
  const tmp = `${target}.tmp`;
  const fd = openSync(tmp, 'w');
  try {
    const buf = Buffer.from(data, 'utf8');
    let off = 0;
    while (off < buf.length) off += writeSync(fd, buf, off, buf.length - off);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  if (existsSync(target) && !name.endsWith('.bak')) {
    let current: string | null = null;
    try {
      current = readFileSync(target, 'utf8');
    } catch {
      current = null;
    }
    if (current !== null && current !== data && valid(name, current)) {
      const bakTmp = `${target}.bak.tmp`;
      copyFileSync(target, bakTmp);
      const bfd = openSync(bakTmp, 'r+');
      try {
        fsyncSync(bfd);
      } finally {
        closeSync(bfd);
      }
      renameSync(bakTmp, `${target}.bak`);
    }
  }
  renameSync(tmp, target);
  fsyncDir(dir);
}

export function removeFile(dir: string, name: string): void {
  if (!isSafeName(name)) throw new Error(`Refusing unsafe file name: ${name}`);
  rmSync(join(dir, name), { force: true });
}

/** Snapshot every file of a save folder (skipping temp files, which are removed as crash debris). */
export function readAll(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  let names: string[] = [];
  try {
    names = readdirSync(dir);
  } catch {
    return out;
  }
  for (const n of names) {
    if (n.endsWith('.tmp')) {
      rmSync(join(dir, n), { force: true });
      continue;
    }
    if (!isSafeName(n)) continue;
    try {
      out[n] = readFileSync(join(dir, n), 'utf8');
    } catch {
      // unreadable file: skip, the loader falls back to .bak
    }
  }
  return out;
}
