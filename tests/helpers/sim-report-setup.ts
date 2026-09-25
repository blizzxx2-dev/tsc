/** Global setup for the `sim` project: clears stale report parts and merges them into sim-report.json afterwards. */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const REPORT_FILE = resolve(process.env.SIM_REPORT_FILE ?? 'reports/sim-report.json');
const PARTS_DIR = resolve('reports/.sim-parts');

export default function setup(): () => void {
  rmSync(PARTS_DIR, { recursive: true, force: true });
  return () => {
    if (!existsSync(PARTS_DIR)) return;
    const merged: Record<string, unknown> = {};
    for (const f of readdirSync(PARTS_DIR)
      .filter((n) => n.endsWith('.json'))
      .sort()) {
      merged[f.replace(/\.json$/, '')] = JSON.parse(readFileSync(join(PARTS_DIR, f), 'utf8'));
    }
    mkdirSync(dirname(REPORT_FILE), { recursive: true });
    writeFileSync(REPORT_FILE, JSON.stringify(merged, null, 2));
    rmSync(PARTS_DIR, { recursive: true, force: true });
  };
}
