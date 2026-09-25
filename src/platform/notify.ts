/**
 * Player-facing, non-blocking notices from platform services (save repaired, disk full, controller
 * disconnected …). Messages raised before a presenter is attached (e.g. while the save loads during
 * module evaluation) are queued and delivered when one attaches.
 */
export type NoticeKind = 'info' | 'warning';
export type Presenter = (message: string, kind: NoticeKind) => void;

let presenter: Presenter | null = null;
const queued: [string, NoticeKind][] = [];

export function notify(message: string, kind: NoticeKind = 'info'): void {
  if (presenter) presenter(message, kind);
  else queued.push([message, kind]);
}

export function attachPresenter(p: Presenter): void {
  presenter = p;
  for (const [m, k] of queued.splice(0)) p(m, k);
}

/** Busy indicator hooks (autosave quill, PLT-0088). */
type Busy = (busy: boolean) => void;
let busyHandler: Busy | null = null;
export function setBusyHandler(b: Busy): void {
  busyHandler = b;
}
export function setBusy(busy: boolean): void {
  busyHandler?.(busy);
}
