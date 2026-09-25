// Generates the application icon set (PLT-0019) from one SVG: desktop/build/icons/<n>x<n>.png (Linux),
// icon.ico (Windows, PNG-compressed entries up to 256 px) and icon.icns (macOS, PNG entries up to 1024 px).
// Rendered with Playwright's Chromium so the blackletter font matches the game. Usage: node scripts/make-icons.mjs
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const OUT = 'desktop/build/icons';
mkdirSync(OUT, { recursive: true });
const font = readFileSync('node_modules/@fontsource/unifrakturmaguntia/files/unifrakturmaguntia-latin-400-normal.woff2').toString('base64');

// A red wax seal stamped "S&S" on dark tooled leather, with a gilt rim — the game's results-screen seal.
function sealPath(cx, cy, r, n = 48) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (1 + 0.035 * Math.sin(i * 2.7) + 0.025 * Math.cos(i * 5.3));
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <style>@font-face{font-family:F;src:url(data:font/woff2;base64,${font})}</style>
    <radialGradient id="leather" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#3a2216"/><stop offset="1" stop-color="#120a06"/></radialGradient>
    <linearGradient id="gilt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0c0"/><stop offset=".45" stop-color="#d8a040"/><stop offset="1" stop-color="#6a4a1a"/></linearGradient>
    <radialGradient id="wax" cx="42%" cy="38%" r="65%"><stop offset="0" stop-color="#c8283a"/><stop offset=".6" stop-color="#8a1016"/><stop offset="1" stop-color="#4a060a"/></radialGradient>
  </defs>
  <rect x="64" y="64" width="896" height="896" rx="200" fill="url(#leather)"/>
  <rect x="96" y="96" width="832" height="832" rx="172" fill="none" stroke="url(#gilt)" stroke-width="14"/>
  <rect x="124" y="124" width="776" height="776" rx="148" fill="none" stroke="#d8a040" stroke-opacity=".35" stroke-width="4" stroke-dasharray="10 12"/>
  <path d="${sealPath(512, 530, 300)}" fill="#2a0406" opacity=".6" transform="translate(10 18)"/>
  <path d="${sealPath(512, 512, 300)}" fill="url(#wax)"/>
  <circle cx="512" cy="512" r="232" fill="none" stroke="#3a0408" stroke-width="10" opacity=".55"/>
  <circle cx="512" cy="512" r="218" fill="none" stroke="#e05060" stroke-width="3" opacity=".35"/>
  <text x="512" y="600" font-family="F" font-size="250" text-anchor="middle" fill="url(#gilt)" stroke="#3a0408" stroke-width="6" paint-order="stroke">S&amp;S</text>
</svg>`;
writeFileSync(`${OUT}/icon.svg`, svg);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1100, height: 1100 } });
await page.setContent('<html><body style="margin:0"></body></html>');
const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
// Rasterise the SVG once at 1024 px, then downscale in a canvas (high-quality smoothing) per size.
const b64 = await page.evaluate(
  async ({ src, sizes }) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    await new Promise((r) => setTimeout(r, 200));
    const out = {};
    for (const s of sizes) {
      const c = document.createElement('canvas');
      c.width = c.height = s;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, s, s);
      out[s] = c.toDataURL('image/png').split(',')[1];
    }
    return out;
  },
  { src: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`, sizes },
);
const png = {};
for (const s of sizes) {
  png[s] = Buffer.from(b64[s], 'base64');
  writeFileSync(`${OUT}/${s}x${s}.png`, png[s]);
}
await browser.close();

// ICO with PNG entries (Vista+).
const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const header = Buffer.alloc(6 + 16 * icoSizes.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(icoSizes.length, 4);
let offset = header.length;
icoSizes.forEach((s, i) => {
  const e = 6 + 16 * i;
  header.writeUInt8(s >= 256 ? 0 : s, e);
  header.writeUInt8(s >= 256 ? 0 : s, e + 1);
  header.writeUInt16LE(1, e + 4);
  header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(png[s].length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += png[s].length;
});
writeFileSync(`${OUT}/icon.ico`, Buffer.concat([header, ...icoSizes.map((s) => png[s])]));

// ICNS with PNG entries.
const icnsTypes = [
  ['icp4', 16],
  ['icp5', 32],
  ['icp6', 64],
  ['ic07', 128],
  ['ic08', 256],
  ['ic09', 512],
  ['ic10', 1024],
  ['ic11', 32],
  ['ic12', 64],
  ['ic13', 256],
  ['ic14', 512],
];
const chunks = icnsTypes.map(([t, s]) => {
  const h = Buffer.alloc(8);
  h.write(t, 0, 'ascii');
  h.writeUInt32BE(8 + png[s].length, 4);
  return Buffer.concat([h, png[s]]);
});
const body = Buffer.concat(chunks);
const ih = Buffer.alloc(8);
ih.write('icns', 0, 'ascii');
ih.writeUInt32BE(8 + body.length, 4);
writeFileSync(`${OUT}/icon.icns`, Buffer.concat([ih, body]));
console.log(`icons written to ${OUT}: ${sizes.join(', ')} px, icon.ico, icon.icns`);
