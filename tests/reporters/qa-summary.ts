/**
 * Vitest reporter that writes `reports/qa-summary.json`: one row per test with project,
 * file, state, duration, retry count and a flaky flag. `scripts/qa/test-summary.mjs` turns it
 * into the CI job summary (pass/fail/flaky, slowest 10, slow unit tests) and
 * `scripts/qa/file-flaky.mjs` opens `flaky` issues from it.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import type { Reporter, TestModule } from 'vitest/node';

export interface QaTestRow {
  project: string;
  file: string;
  name: string;
  state: 'passed' | 'failed' | 'skipped' | 'pending';
  durationMs: number;
  retries: number;
  flaky: boolean;
  error?: string;
}

export interface QaSummary {
  generatedAt: string;
  tests: QaTestRow[];
}

export default class QaSummaryReporter implements Reporter {
  constructor(private opts: { outputFile?: string } = {}) {}

  onTestRunEnd(modules: ReadonlyArray<TestModule>): void {
    const tests: QaTestRow[] = [];
    for (const mod of modules) {
      for (const tc of mod.children.allTests()) {
        const res = tc.result();
        const diag = tc.diagnostic();
        const firstError = res.state === 'failed' ? res.errors?.[0]?.message : undefined;
        tests.push({
          project: tc.project.name || 'default',
          file: relative(process.cwd(), mod.moduleId).replace(/\\/g, '/'),
          name: tc.fullName,
          state: res.state,
          durationMs: Math.round(diag?.duration ?? 0),
          retries: diag?.retryCount ?? 0,
          flaky: diag?.flaky ?? false,
          ...(firstError ? { error: firstError.slice(0, 500) } : {}),
        });
      }
    }
    const out = resolve(this.opts.outputFile ?? process.env.QA_SUMMARY_FILE ?? 'reports/qa-summary.json');
    mkdirSync(dirname(out), { recursive: true });
    const summary: QaSummary = { generatedAt: new Date().toISOString(), tests };
    writeFileSync(out, JSON.stringify(summary, null, 2));
  }
}
