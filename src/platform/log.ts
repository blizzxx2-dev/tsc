/**
 * Structured logger (PLT-0120) shared by the renderer and — through the same line format — the desktop
 * main process. Every entry carries level, category, ISO timestamp and the frame number; the last
 * 2,000 lines stay in an in-memory ring buffer for bug reports and crash payloads. Sinks (console, the
 * desktop log file) receive already-scrubbed text (PLT-0129).
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export const LOG_LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error'];

export interface LogEntry {
  t: string;
  frame: number;
  level: LogLevel;
  cat: string;
  msg: string;
  data?: unknown;
}

export type LogSink = (line: string, entry: LogEntry) => void;

export const RING_SIZE = 2000;

/** Values that must never reach a log or report: user names, machine name, SteamID. Filled at boot. */
const secrets = new Set<string>();

export function addScrubSecret(value: string | undefined | null): void {
  if (value && value.length >= 3) secrets.add(value);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Remove personally identifying data (PLT-0129): the user-name segment of home-directory paths on
 * Windows, macOS and Linux (plain, escaped and file:// forms), SteamID64s, and any registered secret
 * (persona name, machine name, OS user name).
 */
export function scrub(text: string): string {
  let out = text
    // C:\Users\name\…  C:/Users/name/…  C:\\Users\\name\\… (JSON-escaped)
    .replace(/([A-Za-z]:(?:\\\\|\\|\/)(?:Users|Documents and Settings)(?:\\\\|\\|\/))[^\\/:*?"<>|\r\n]+/gi, '$1<user>')
    // /Users/name/…  /home/name/…  file:///Users/name
    .replace(/(\/(?:Users|home)\/)[^/\s"'`]+/g, '$1<user>')
    // SteamID64 (individual accounts start at 76561197960265728)
    .replace(/\b7656119\d{10}\b/g, '<steamid>');
  for (const s of secrets) out = out.replace(new RegExp(escapeRe(s), 'gi'), '<redacted>');
  return out;
}

export function formatEntry(e: LogEntry): string {
  let data = '';
  if (e.data !== undefined) {
    try {
      data = ' ' + (e.data instanceof Error ? `${e.data.name}: ${e.data.message}\n${e.data.stack ?? ''}` : JSON.stringify(e.data));
    } catch {
      data = ' [unserialisable]';
    }
  }
  return scrub(`${e.t} [${e.level.toUpperCase().padEnd(5)}] #${e.frame} ${e.cat}: ${e.msg}${data}`);
}

export class Logger {
  frame = 0;
  minLevel: LogLevel = 'info';
  private ring: string[] = [];
  private head = 0;
  private sinks: LogSink[] = [];

  constructor(private now: () => Date = () => new Date()) {}

  addSink(sink: LogSink): () => void {
    this.sinks.push(sink);
    return () => {
      this.sinks = this.sinks.filter((s) => s !== sink);
    };
  }

  log(level: LogLevel, cat: string, msg: string, data?: unknown): void {
    if (LOG_LEVELS.indexOf(level) < LOG_LEVELS.indexOf(this.minLevel)) return;
    const entry: LogEntry = { t: this.now().toISOString(), frame: this.frame, level, cat, msg, data };
    const line = formatEntry(entry);
    if (this.ring.length < RING_SIZE) this.ring.push(line);
    else {
      this.ring[this.head] = line;
      this.head = (this.head + 1) % RING_SIZE;
    }
    for (const s of this.sinks) {
      try {
        s(line, entry);
      } catch {
        // a failing sink must never break the game
      }
    }
  }

  debug(cat: string, msg: string, data?: unknown): void {
    this.log('debug', cat, msg, data);
  }
  info(cat: string, msg: string, data?: unknown): void {
    this.log('info', cat, msg, data);
  }
  warn(cat: string, msg: string, data?: unknown): void {
    this.log('warn', cat, msg, data);
  }
  error(cat: string, msg: string, data?: unknown): void {
    this.log('error', cat, msg, data);
  }

  /** Oldest-first copy of the ring buffer (at most 2,000 lines). */
  lines(last = RING_SIZE): string[] {
    const ordered = this.ring.length < RING_SIZE ? this.ring.slice() : [...this.ring.slice(this.head), ...this.ring.slice(0, this.head)];
    return ordered.slice(-last);
  }
}

export const log = new Logger();

export function parseLogLevel(s: string | undefined | null): LogLevel | null {
  return s && (LOG_LEVELS as readonly string[]).includes(s) ? (s as LogLevel) : null;
}
