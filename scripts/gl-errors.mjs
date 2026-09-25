// Dev diagnostic: reports the first GL errors per program label while a scene runs.
// Builds must exist (npx vite build). Usage: node scripts/gl-errors.mjs [query] [waitMs]
import { chromium } from 'playwright';
import { preview } from 'vite';

const [query = '?op=showcase', wait = '2500'] = process.argv.slice(2);
const server = await preview({ preview: { port: 0, strictPort: false, open: false }, logLevel: 'silent' });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log(`PAGE ERROR: ${e}`));
await page.goto(url + query);
await page.waitForTimeout(1500);
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
const report = await page.evaluate(async (ms) => {
  const g = window.__game.gfx;
  const gl = g.gl;
  const labels = g.registry.entries;
  const seen = {};
  for (const fn of ['drawArrays', 'drawElements', 'clear', 'blitFramebuffer']) {
    const orig = gl[fn].bind(gl);
    gl[fn] = (...a) => {
      const r = orig(...a);
      const e = gl.getError();
      if (e) {
        const p = gl.getParameter(gl.CURRENT_PROGRAM);
        const key = `${fn}:${labels.get(p)?.label ?? 'none'}:0x${e.toString(16)}`;
        seen[key] = (seen[key] ?? 0) + 1;
      }
      return r;
    };
  }
  await new Promise((r) => setTimeout(r, ms));
  return seen;
}, Number(wait));
console.log(JSON.stringify(report, null, 1));
await browser.close();
await new Promise((r) => server.httpServer.close(r));
process.exit(0);
