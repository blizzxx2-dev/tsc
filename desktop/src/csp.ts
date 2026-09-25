/**
 * Content Security Policy for the packaged game (PLT-0014). Everything is served from `app://game/`;
 * the only exceptions are inline styles (index.html's critical CSS), data: images (save thumbnails)
 * and, when crash reporting is configured, the report endpoint's origin.
 */
import { extname, normalize, relative, resolve, sep } from 'node:path';

export function buildCsp(connect: readonly string[] = []): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "media-src 'self' blob:",
    `connect-src 'self'${connect.map((c) => ` ${c}`).join('')}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "worker-src 'self' blob:",
  ].join('; ');
}

/** Origin of a Sentry DSN (`https://key@o1.ingest.sentry.io/123` → `https://o1.ingest.sentry.io`). */
export function dsnOrigin(dsn: string | undefined): string | null {
  const m = dsn ? /^(https?):\/\/[^@]+@([^/]+)\//.exec(dsn) : null;
  return m ? `${m[1]}://${m[2]}` : null;
}

/**
 * Map an `app://game/<path>` URL to a file under `root`, or null if it escapes the root.
 * `/` serves index.html.
 */
export function resolveAppFile(root: string, url: string): string | null {
  let pathname: string;
  try {
    const u = new URL(url);
    if (u.protocol !== 'app:' || u.host !== 'game') return null;
    pathname = decodeURIComponent(u.pathname);
  } catch {
    return null;
  }
  if (pathname === '/' || pathname === '') pathname = '/index.html';
  const file = resolve(root, '.' + normalize(pathname));
  const rel = relative(root, file);
  if (rel.startsWith('..') || rel.includes(`..${sep}`) || resolve(root, rel) !== file) return null;
  return file;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8',
};
export const mimeFor = (file: string): string => MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
