/**
 * Minimal ZIP writer (stored, no compression) for support bundles (PLT-0093, PLT-0131): logs, saves,
 * settings and input recordings are small text files, so compression is not worth a dependency.
 * Pure `Uint8Array`, so the same writer serves the Electron main process and the browser build.
 */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const encoder = new TextEncoder();
const bytes = (v: Uint8Array | string): Uint8Array => (typeof v === 'string' ? encoder.encode(v) : v);

function header(size: number, fields: [offset: number, value: number, width: 2 | 4][]): Uint8Array {
  const b = new Uint8Array(size);
  const dv = new DataView(b.buffer);
  for (const [o, v, w] of fields) if (w === 2) dv.setUint16(o, v & 0xffff, true);
  else dv.setUint32(o, v >>> 0, true);
  return b;
}

export function zip(files: Record<string, Uint8Array | string>, date = new Date(1980, 0, 1)): Uint8Array {
  const dosTime = ((date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)) & 0xffff;
  const dosDate = (((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xffff;
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = bytes(content);
    const nameBuf = encoder.encode(name);
    const crc = crc32(data);
    // Local file header: signature, version 2.0, UTF-8 names flag, stored, time, date, crc, sizes, name length.
    local.push(
      header(30, [
        [0, 0x04034b50, 4],
        [4, 20, 2],
        [6, 0x0800, 2],
        [8, 0, 2],
        [10, dosTime, 2],
        [12, dosDate, 2],
        [14, crc, 4],
        [18, data.length, 4],
        [22, data.length, 4],
        [26, nameBuf.length, 2],
        [28, 0, 2],
      ]),
      nameBuf,
      data,
    );
    central.push(
      header(46, [
        [0, 0x02014b50, 4],
        [4, 20, 2],
        [6, 20, 2],
        [8, 0x0800, 2],
        [10, 0, 2],
        [12, dosTime, 2],
        [14, dosDate, 2],
        [16, crc, 4],
        [20, data.length, 4],
        [24, data.length, 4],
        [28, nameBuf.length, 2],
        [42, offset, 4],
      ]),
      nameBuf,
    );
    offset += 30 + nameBuf.length + data.length;
  }
  const cdLength = central.reduce((n, b) => n + b.length, 0);
  const count = Object.keys(files).length;
  const end = header(22, [
    [0, 0x06054b50, 4],
    [8, count, 2],
    [10, count, 2],
    [12, cdLength, 4],
    [16, offset, 4],
  ]);
  const parts = [...local, ...central, end];
  const out = new Uint8Array(parts.reduce((n, b) => n + b.length, 0));
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}
