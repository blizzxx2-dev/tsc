/** ENG-0083: every shader variant compiles and links in headless Chromium (SwiftShader); a failure names the variant. */
import { describe, expect, it } from 'vitest';
import { useGame } from './helpers';

describe('shader compile check', () => {
  const game = useGame();

  it('every program variant compiles and links', async () => {
    const g = game();
    await g.boot();
    const r = (await g.api('compileShaders')) as { variants: number; failures: { name: string; stage: string; log: string }[] };
    expect(r.variants).toBeGreaterThan(30);
    expect(r.failures.map((f) => `${f.name} (${f.stage}): ${f.log.split('\n')[0]}`)).toEqual([]);
  });
});
