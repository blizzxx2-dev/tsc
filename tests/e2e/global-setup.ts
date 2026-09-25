/** E2E global setup: serve the QA build (`npm run build:qa`) once for every E2E file. */
import { existsSync } from 'node:fs';
import { preview } from 'vite';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    baseURL: string;
  }
}

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const outDir = process.env.E2E_DIST ?? 'dist-qa';
  if (!existsSync(`${outDir}/index.html`)) throw new Error(`E2E needs the QA build in ${outDir}/ — run "npm run build:qa" first.`);
  const server = await preview({ build: { outDir }, preview: { port: 0, strictPort: false, open: false }, logLevel: 'silent' });
  project.provide('baseURL', server.resolvedUrls!.local[0]);
  return () => new Promise<void>((r) => server.httpServer.close(() => r()));
}
