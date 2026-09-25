/**
 * DOM boot splash (ENG-0213): shown from the first paint (index.html) until the
 * title scene is ready, so the window never shows a blank canvas. Also hosts
 * the "Restoring the lamps…" veil during WebGL context loss (ENG-0199), which
 * must be drawn without GL.
 */
function el(id: string): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.getElementById(id);
}

export function splashProgress(frac: number, label?: string): void {
  const bar = el('boot-bar');
  if (bar) bar.style.width = `${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%`;
  const txt = el('boot-label');
  if (txt && label) txt.textContent = label;
}

export function splashDone(): void {
  const s = el('boot');
  if (!s) return;
  s.style.opacity = '0';
  setTimeout(() => s.remove(), 400);
}

/** Show or hide the context-loss veil. */
export function lampsVeil(show: boolean): void {
  let v = el('lamps');
  if (!v && show) {
    v = document.createElement('div');
    v.id = 'lamps';
    v.textContent = 'Restoring the lamps…';
    v.setAttribute('role', 'status');
    document.body.appendChild(v);
  }
  if (v) v.style.display = show ? 'flex' : 'none';
}
