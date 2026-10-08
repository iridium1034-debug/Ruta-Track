import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Pure Node.js PNG generator for RutaTrack PWA icons (192x192, 512x512, maskable 512x512, apple-touch-icon 180x180)
function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const combined = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createRutaTrackPNG(size, isMaskable = false) {
  const rawData = Buffer.alloc(size * (size * 4 + 1));
  const cx = size / 2;
  const cy = size * 0.43;

  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    rawData[rowStart] = 0; // filter type 0

    for (let x = 0; x < size; x++) {
      const idx = rowStart + 1 + x * 4;
      const nx = x / size;
      const ny = y / size;

      // Radial navy gradient background (#082C64 center -> #031533 outer)
      const distBg = Math.hypot(nx - 0.5, ny - 0.42);
      let r = Math.max(2, Math.min(255, Math.round(10 - distBg * 10)));
      let g = Math.max(18, Math.min(255, Math.round(50 - distBg * 42)));
      let b = Math.max(44, Math.min(255, Math.round(110 - distBg * 85)));
      let a = 255;

      // Rounded rect clipping if not maskable
      if (!isMaskable) {
        const rad = 0.21;
        let dx = 0;
        let dy = 0;
        if (nx < rad && ny < rad) {
          dx = rad - nx;
          dy = rad - ny;
        } else if (nx > 1 - rad && ny < rad) {
          dx = nx - (1 - rad);
          dy = rad - ny;
        } else if (nx < rad && ny > 1 - rad) {
          dx = rad - nx;
          dy = ny - (1 - rad);
        } else if (nx > 1 - rad && ny > 1 - rad) {
          dx = nx - (1 - rad);
          dy = ny - (1 - rad);
        }
        if (Math.hypot(dx, dy) > rad) {
          a = 0;
        }
      }

      // Map Pin Ring (#00A8FF)
      const scale = isMaskable ? 0.84 : 1.0;
      const px = (nx - 0.5) / scale;
      const py = (ny - 0.42) / scale;
      const pinDist = Math.hypot(px, py + 0.04);

      if (a > 0) {
        // Pin ring
        if (pinDist > 0.24 && pinDist < 0.29 && py < 0.18) {
          r = 0;
          g = 168;
          b = 255;
        }
        // Pin bottom V-cone
        if (py >= 0.08 && py <= 0.30) {
          const targetW = (0.30 - py) * 1.15;
          if (Math.abs(px) > targetW - 0.045 && Math.abs(px) < targetW) {
            r = 0;
            g = 168;
            b = 255;
          }
        }
        // White Tanker Truck Silhouette in center
        if (px > -0.20 && px < 0.04 && py > -0.14 && py < 0.03) {
          // Tank cylinder
          r = 240;
          g = 248;
          b = 255;
        }
        if (px >= 0.05 && px < 0.21 && py > -0.17 && py < 0.08) {
          // Truck cab
          r = 255;
          g = 255;
          b = 255;
          // Windshield & Grille cutout
          if (px > 0.09 && px < 0.19 && py > -0.12 && py < -0.04) {
            r = 5;
            g = 34;
            b = 77;
          }
          if (px > 0.10 && px < 0.19 && py > -0.01 && py < 0.06) {
            r = 4;
            g = 27;
            b = 62;
          }
        }
        //RutaTrack bar indicator at bottom
        if (py > 0.34 && py < 0.41 && Math.abs(px) < 0.34) {
          if (px < -0.02) {
            r = 255;
            g = 255;
            b = 255;
          } else {
            r = 0;
            g = 168;
            b = 255;
          }
        }
      }

      rawData[idx] = r;
      rawData[idx + 1] = g;
      rawData[idx + 2] = b;
      rawData[idx + 3] = a;
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(rawData);
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', iend),
  ]);
}

const pubDir = path.resolve('public');
if (!fs.existsSync(pubDir)) {
  fs.mkdirSync(pubDir, { recursive: true });
}

fs.writeFileSync(path.join(pubDir, 'pwa-192x192.png'), createRutaTrackPNG(192, false));
fs.writeFileSync(path.join(pubDir, 'pwa-512x512.png'), createRutaTrackPNG(512, false));
fs.writeFileSync(path.join(pubDir, 'pwa-maskable-512x512.png'), createRutaTrackPNG(512, true));
fs.writeFileSync(path.join(pubDir, 'apple-touch-icon.png'), createRutaTrackPNG(180, false));
console.log('Generated RutaTrack PNG icons in public/');
