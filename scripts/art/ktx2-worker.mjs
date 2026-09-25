// Worker for compress-models.mjs: encodes one image to KTX2 UASTC (see there for settings).
import { parentPort } from 'node:worker_threads';
import { encodeToKTX2 } from 'ktx2-encoder';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

async function decode(buf) {
  const b = Buffer.from(buf);
  if (b[0] === 0x89 && b[1] === 0x50) {
    const png = PNG.sync.read(b);
    return { width: png.width, height: png.height, data: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.byteLength) };
  }
  const img = jpeg.decode(b, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 4096, maxResolutionInMP: 400 });
  return { width: img.width, height: img.height, data: img.data };
}

parentPort.on('message', async ({ id, image, color, normal }) => {
  try {
    const ktx = await encodeToKTX2(image, {
      isUASTC: true,
      uastcLDRQualityLevel: 3,
      enableRDO: false,
      needSupercompression: true,
      generateMipmap: true,
      isPerceptual: color,
      isNormalMap: normal,
      imageDecoder: decode,
    });
    parentPort.postMessage({ id, ktx }, [ktx.buffer]);
  } catch (e) {
    parentPort.postMessage({ id, error: String(e?.stack ?? e) });
  }
});
