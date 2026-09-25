// Import a game TypeScript module from a Node build script: bundle it with esbuild (resolving the
// extensionless imports the game uses) and load the result from a data: URL.
import { build } from 'esbuild';

export async function importTs(entry) {
  const r = await build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'silent',
    define: { 'import.meta.env': '{"DEV":false}' },
  });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`);
}
