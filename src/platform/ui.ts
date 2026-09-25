/**
 * Small DOM overlays owned by the platform layer, drawn above the WebGL canvas so they work in any
 * scene and even if rendering fails: notices (save repaired, disk full, controller lost), the autosave
 * quill (PLT-0088), the press/festival build watermark (PLT-0061), the first-run privacy notice
 * (PLT-0125) and the display-change confirmation (PLT-0104).
 */
import type { NoticeKind } from './notify';

const INK = '#e8dcc0';
const PANEL = 'rgba(20,12,8,0.92)';
const BORDER = '#8a6a3a';
const FONT = '"IM Fell English", Georgia, serif';

let root: HTMLDivElement | null = null;

function layer(): HTMLDivElement | null {
  if (typeof document === 'undefined') return null;
  if (root && root.isConnected) return root;
  root = document.createElement('div');
  root.id = 'platform-ui';
  root.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:5;font:18px ${FONT};color:${INK}`;
  document.body.appendChild(root);
  return root;
}

function panel(css: string): HTMLDivElement {
  const d = document.createElement('div');
  d.style.cssText = `position:absolute;background:${PANEL};border:1px solid ${BORDER};padding:10px 16px;box-shadow:0 4px 18px rgba(0,0,0,.6);${css}`;
  return d;
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.style.cssText = `font:inherit;color:${INK};background:#3a2216;border:1px solid ${BORDER};padding:4px 14px;margin:8px 8px 0 0;cursor:pointer;pointer-events:auto`;
  b.onclick = onClick;
  return b;
}

let stack = 0;
/** Non-blocking notice, bottom-centre, fades after `ms`. */
export function showNotice(message: string, kind: NoticeKind = 'info', ms = 6000): void {
  const l = layer();
  if (!l) return;
  const d = panel(`left:50%;transform:translateX(-50%);bottom:${24 + stack * 56}px;max-width:70%;text-align:center;transition:opacity .6s;${kind === 'warning' ? 'border-color:#b8401c;' : ''}`);
  d.setAttribute('role', 'status');
  d.textContent = message;
  l.appendChild(d);
  stack++;
  setTimeout(() => {
    d.style.opacity = '0';
    setTimeout(() => {
      d.remove();
      stack = Math.max(0, stack - 1);
    }, 700);
  }, ms);
}

/** Autosave quill: visible while a write is in flight, and for at least 1 s (UIX-0093). */
export class SaveIndicator {
  static readonly MIN_VISIBLE_MS = 1000;
  private el: HTMLDivElement | null = null;
  private shownAt = 0;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  constructor(private now: () => number = () => performance.now()) {}

  set(busy: boolean): void {
    const l = layer();
    if (!l) return;
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.setAttribute('aria-label', 'Saving');
      this.el.textContent = '✒';
      this.el.style.cssText = `position:absolute;right:22px;bottom:18px;font-size:30px;color:#d8a040;opacity:0;transition:opacity .2s;text-shadow:0 0 8px #000`;
      l.appendChild(this.el);
    }
    if (busy) {
      if (this.hideTimer) clearTimeout(this.hideTimer);
      this.hideTimer = null;
      if (this.el.style.opacity !== '1') this.shownAt = this.now();
      this.el.style.opacity = '1';
    } else {
      const wait = Math.max(0, SaveIndicator.MIN_VISIBLE_MS - (this.now() - this.shownAt));
      if (this.hideTimer) clearTimeout(this.hideTimer);
      this.hideTimer = setTimeout(() => {
        if (this.el) this.el.style.opacity = '0';
      }, wait);
    }
  }
}

/** Corner stamp for press/festival builds. */
export function showWatermark(text: string): void {
  const l = layer();
  if (!l) return;
  const d = document.createElement('div');
  d.textContent = text;
  d.style.cssText = 'position:absolute;left:12px;top:10px;font-size:13px;opacity:.55;letter-spacing:.05em;text-shadow:0 0 4px #000';
  l.appendChild(d);
}

/** Modal-ish prompt with buttons; resolves with the chosen index, or `timeoutIndex` after `timeoutMs`. */
export function prompt(opts: { title: string; message: string; buttons: string[]; timeoutMs?: number; timeoutIndex?: number; countdown?: boolean }): Promise<number> {
  const l = layer();
  if (!l) return Promise.resolve(opts.timeoutIndex ?? 0);
  return new Promise((resolve) => {
    const d = panel('left:50%;top:40%;transform:translate(-50%,-50%);min-width:420px;max-width:640px;padding:18px 24px;pointer-events:auto;cursor:default');
    d.setAttribute('role', 'dialog');
    const h = document.createElement('div');
    h.textContent = opts.title;
    h.style.cssText = 'font-size:26px;color:#fff0c0;margin-bottom:8px';
    const p = document.createElement('div');
    p.textContent = opts.message;
    const count = document.createElement('div');
    count.style.cssText = 'font-size:14px;color:#a89870;margin-top:6px';
    d.append(h, p, count);
    let timer: ReturnType<typeof setInterval> | null = null;
    const done = (i: number) => {
      if (timer) clearInterval(timer);
      d.remove();
      resolve(i);
    };
    opts.buttons.forEach((b, i) => d.appendChild(button(b, () => done(i))));
    l.appendChild(d);
    if (opts.timeoutMs) {
      const end = performance.now() + opts.timeoutMs;
      const tick = () => {
        const left = Math.ceil((end - performance.now()) / 1000);
        if (opts.countdown) count.textContent = `Reverting in ${Math.max(0, left)} s`;
        if (left <= 0) done(opts.timeoutIndex ?? 0);
      };
      tick();
      timer = setInterval(tick, 250);
    }
  });
}
