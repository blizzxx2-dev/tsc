// Import a TypeScript module from a Node script by bundling it with esbuild (a Vite dependency).
import { build } from 'esbuild';
import { resolve } from 'node:path';

export async function importTs(file) {
  const out = await build({
    entryPoints: [resolve(file)],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'silent',
    define: { 'import.meta.env': '{"DEV":false}' },
  });
  const code = out.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}
