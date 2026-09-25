/**
 * Renderer error capture and reporting (PLT-0122, PLT-0124, PLT-0125, PLT-0127).
 *
 *  - `window.onerror` / `unhandledrejection` go to the logger.
 *  - If the main loop stops advancing after an error, the error-boundary screen replaces the canvas:
 *    "Suture & Steel has stopped", report id, Open log folder, Restart.
 *  - With crash-report consent (`settings.crashReports === 'on'`) and a DSN configured at build time
 *    (`VITE_SENTRY_DSN`), a scrubbed report is sent to the same Sentry project that receives the
 *    Crashpad minidumps from the main process. Source maps are uploaded from CI, never shipped.
 */
import { BUILD } from './build';
import { log, scrub } from './log';

export interface Dsn {
  host: string;
  projectId: string;
  publicKey: string;
  protocol: string;
}

/** Parse `https://<key>@<host>/<project>`. */
export function parseDsn(dsn: string | undefined | null): Dsn | null {
  if (!dsn) return null;
  const m = /^(https?):\/\/([^@]+)@([^/]+)\/(\d+)$/.exec(dsn.trim());
  return m ? { protocol: m[1], publicKey: m[2], host: m[3], projectId: m[4] } : null;
}

export interface ErrorReport {
  eventId: string;
  message: string;
  stack: string;
  level: 'error' | 'fatal';
  build: string;
  edition: string;
  os: string;
  logTail: string[];
}

const hex32 = (): string => {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, '');
  let s = '';
  for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
};

export function makeReport(err: unknown, level: ErrorReport['level'], os: string): ErrorReport {
  const e = err instanceof Error ? err : new Error(typeof err === 'string' ? err : JSON.stringify(err));
  return {
    eventId: hex32(),
    message: scrub(`${e.name}: ${e.message}`),
    stack: scrub(e.stack ?? ''),
    level,
    build: BUILD.id,
    edition: BUILD.edition,
    os,
    logTail: log.lines(200),
  };
}

/** Sentry envelope (https://develop.sentry.dev/sdk/envelopes/) for one error event. */
export function sentryEnvelope(r: ErrorReport, dsn: Dsn): { url: string; body: string } {
  const event = {
    event_id: r.eventId,
    timestamp: Date.now() / 1000,
    platform: 'javascript',
    level: r.level,
    release: `suture-and-steel-${r.edition}@${r.build}`,
    environment: r.edition,
    tags: { os: r.os, edition: r.edition },
    exception: { values: [{ type: r.message.split(':')[0], value: r.message, stacktrace: { frames: [] as unknown[] }, raw_stacktrace: r.stack }] },
    extra: { stack: r.stack, log: r.logTail.join('\n') },
  };
  const body = [JSON.stringify({ event_id: r.eventId, sent_at: new Date().toISOString(), dsn: `${dsn.protocol}://${dsn.publicKey}@${dsn.host}/${dsn.projectId}` }), JSON.stringify({ type: 'event' }), JSON.stringify(event)].join('\n');
  return { url: `${dsn.protocol}://${dsn.host}/api/${dsn.projectId}/envelope/?sentry_key=${dsn.publicKey}&sentry_version=7`, body };
}

export interface CaptureOptions {
  os: string;
  consent: () => boolean;
  dsn: Dsn | null;
  /** Open the log folder (desktop) — hidden on the web. */
  openLogs: (() => void) | null;
  restart: () => void;
}

let lastFrame = 0;
let frames = 0;
/** Called once per frame by the session glue so a dead main loop can be detected. */
export function markFrame(): void {
  frames++;
  lastFrame = performance.now();
}

let shown = false;
let sent = 0;

export function send(r: ErrorReport, opts: CaptureOptions): void {
  if (!opts.consent() || !opts.dsn || sent >= 5) return;
  sent++;
  const { url, body } = sentryEnvelope(r, opts.dsn);
  void fetch(url, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/x-sentry-envelope' } }).catch(() => undefined);
}

export function installErrorCapture(opts: CaptureOptions): void {
  const handle = (err: unknown, source: string) => {
    log.error('error', `uncaught ${source}`, err);
    const report = makeReport(err, 'error', opts.os);
    const before = frames;
    // If the frame loop is still alive after a second the game survived; otherwise show the boundary.
    setTimeout(() => {
      const dead = frames === before || performance.now() - lastFrame > 900;
      if (dead) report.level = 'fatal';
      send(report, opts);
      if (dead) showErrorBoundary(report, opts);
    }, 1000);
  };
  globalThis.addEventListener?.('error', (e: ErrorEvent) => handle(e.error ?? e.message, 'error'));
  globalThis.addEventListener?.('unhandledrejection', (e: PromiseRejectionEvent) => handle(e.reason, 'rejection'));
}

/** DOM error screen: works even if WebGL is gone. */
export function showErrorBoundary(r: ErrorReport, opts: CaptureOptions): void {
  if (shown || typeof document === 'undefined') return;
  shown = true;
  const wrap = document.createElement('div');
  wrap.id = 'fatal';
  wrap.setAttribute('role', 'alertdialog');
  wrap.style.cssText = 'position:fixed;inset:0;max-width:none;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#070505;color:#e8dcc0;font:18px "IM Fell English",Georgia,serif;text-align:center;gap:14px;z-index:10';
  const h = document.createElement('h1');
  h.textContent = 'Suture & Steel has stopped';
  h.style.cssText = 'font-weight:normal;font-size:40px;margin:0;color:#fff0c0';
  const p = document.createElement('p');
  p.textContent = 'Something went wrong and the game cannot continue. Your journal was saved at the last autosave.';
  p.style.maxWidth = '640px';
  const id = document.createElement('p');
  id.textContent = `Report id: ${r.eventId.slice(0, 12)} · Build ${r.build}`;
  id.style.cssText = 'font-size:14px;color:#a89870';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:16px';
  const btn = (label: string, fn: () => void) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'font:inherit;padding:8px 20px;background:#2a1a12;color:#e8dcc0;border:1px solid #8a6a3a;cursor:pointer';
    b.onclick = fn;
    row.appendChild(b);
  };
  if (opts.openLogs) btn('Open log folder', opts.openLogs);
  btn('Restart', opts.restart);
  wrap.append(h, p, id, row);
  document.body.appendChild(wrap);
  const canvas = document.querySelector('canvas');
  if (canvas) canvas.style.display = 'none';
  document.body.style.cursor = 'default';
}
