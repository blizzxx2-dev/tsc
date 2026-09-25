/**
 * Heartbeat sonification. Beats are scheduled on the audio clock with a
 * look-ahead from the ECG beat phase, so the thump lands on the QRS spike of
 * the trace instead of on the frame after it (rAF jitter).
 */

/** Phase (0..1 within a beat) of the QRS spike in the ECG waveform. */
export const QRS_PHASE = 0.21;
export const HEART_LOOKAHEAD = 0.1;

export class HeartbeatScheduler {
  private beat = 0;
  private prevPhase = 0;
  private lastScheduled = -1;

  /**
   * Given the current beat phase and effective bpm at audio time `now`,
   * return the audio time of the next QRS if it falls inside the look-ahead
   * window and has not been scheduled yet.
   */
  update(phase: number, bpm: number, now: number, lookahead = HEART_LOOKAHEAD): { at: number; beat: number } | null {
    if (phase < this.prevPhase - 0.5) this.beat++;
    this.prevPhase = phase;
    if (bpm <= 0) return null;
    const period = 60 / bpm;
    const [idx, dPhase] = phase < QRS_PHASE ? [this.beat, QRS_PHASE - phase] : [this.beat + 1, 1 + QRS_PHASE - phase];
    const at = now + dPhase * period;
    if (idx <= this.lastScheduled || at - now > lookahead) return null;
    this.lastScheduled = idx;
    return { at, beat: idx };
  }

  reset(): void {
    this.beat = 0;
    this.prevPhase = 0;
    this.lastScheduled = -1;
  }
}

/** Heartbeat colour from vitals: strength rises as vitals fall; timbre muffles below 25. */
export function heartParams(vitals: number, bpm: number): { strength: number; muffle: number; gap: number } {
  const strength = Math.max(0.2, Math.min(1, (60 - vitals) / 50));
  const muffle = vitals < 25 ? Math.min(1, (25 - vitals) / 20) : 0;
  const gap = Math.max(0.1, Math.min(0.22, 0.16 * (80 / Math.max(40, bpm))));
  return { strength, muffle, gap };
}

/** Count the sharp corners in a drawn path (star vertices). */
export function countCorners(pts: readonly { x: number; y: number }[], minTurnDeg = 100, spacing = 10): number {
  if (pts.length < 3) return 0;
  // Resample to even spacing.
  const r: { x: number; y: number }[] = [pts[0]];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = r[r.length - 1];
    const b = pts[i];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    acc += d;
    if (acc >= spacing) {
      r.push(b);
      acc = 0;
    }
  }
  const w = 3;
  let corners = 0;
  let cool = 0;
  for (let i = w; i < r.length - w; i++) {
    if (cool > 0) {
      cool--;
      continue;
    }
    const a1 = Math.atan2(r[i].y - r[i - w].y, r[i].x - r[i - w].x);
    const a2 = Math.atan2(r[i + w].y - r[i].y, r[i + w].x - r[i].x);
    let turn = Math.abs(a2 - a1);
    if (turn > Math.PI) turn = 2 * Math.PI - turn;
    if ((turn * 180) / Math.PI >= minTurnDeg) {
      corners++;
      cool = w * 2;
    }
  }
  return corners;
}
