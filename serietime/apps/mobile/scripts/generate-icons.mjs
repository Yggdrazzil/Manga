// Génère les icônes SerieTime (jaune #FFD400, écran TV noir stylisé).
// Aucune dépendance : encodage PNG minimal via zlib.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256).map((_, n) => {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      return c;
    });
  }
  let crc = -1;
  for (const b of buf) crc = (crc >>> 8) ^ table[(crc ^ b) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const YELLOW = [255, 212, 0, 255];
const BLACK = [0, 0, 0, 255];
const WHITE = [255, 255, 255, 255];

function drawIcon(size, { maskable = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const set = (x, y, c) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    rgba[i] = c[0]; rgba[i + 1] = c[1]; rgba[i + 2] = c[2]; rgba[i + 3] = c[3];
  };
  const radius = maskable ? 0 : Math.round(size * 0.18);
  const inCorner = (x, y) => {
    const corners = [
      [radius, radius], [size - 1 - radius, radius],
      [radius, size - 1 - radius], [size - 1 - radius, size - 1 - radius],
    ];
    if (x >= radius && x < size - radius) return false;
    if (y >= radius && y < size - radius) return false;
    for (const [cx, cy] of corners) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= radius * radius) return false;
    }
    return true;
  };

  // fond jaune arrondi (plein pour maskable)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      set(x, y, inCorner(x, y) ? [0, 0, 0, 0] : YELLOW);

  // écran TV noir arrondi
  const pad = maskable ? 0.3 : 0.22;
  const tvX0 = Math.round(size * pad);
  const tvX1 = Math.round(size * (1 - pad));
  const tvY0 = Math.round(size * (pad + 0.06));
  const tvY1 = Math.round(size * (1 - pad + 0.02));
  for (let y = tvY0; y < tvY1; y++)
    for (let x = tvX0; x < tvX1; x++) set(x, y, BLACK);

  // antennes (deux traits diagonaux au-dessus)
  const thick = Math.max(2, Math.round(size * 0.03));
  const antennaTop = Math.round(size * (pad - 0.08));
  const cx = Math.round(size / 2);
  for (let y = antennaTop; y < tvY0; y++) {
    const progress = (y - antennaTop) / Math.max(1, tvY0 - antennaTop);
    const offset = Math.round((1 - progress) * size * 0.12);
    for (let t = 0; t < thick; t++) {
      set(cx - offset + t, y, BLACK);
      set(cx + offset + t, y, BLACK);
    }
  }

  // triangle play blanc au centre de l'écran
  const tw = (tvX1 - tvX0) * 0.34;
  const th = (tvY1 - tvY0) * 0.44;
  const pcx = (tvX0 + tvX1) / 2 - tw * 0.15;
  const pcy = (tvY0 + tvY1) / 2;
  for (let y = Math.round(pcy - th / 2); y < Math.round(pcy + th / 2); y++) {
    const progress = Math.abs(y - pcy) / (th / 2);
    const rowW = tw * (1 - progress);
    for (let x = Math.round(pcx); x < Math.round(pcx + rowW); x++) set(x, y, WHITE);
  }

  return encodePng(size, size, rgba);
}

const outDir = path.resolve(process.argv[2] ?? 'public/icons');
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'icon-192.png'), drawIcon(192));
writeFileSync(path.join(outDir, 'icon-512.png'), drawIcon(512));
writeFileSync(path.join(outDir, 'icon-maskable-512.png'), drawIcon(512, { maskable: true }));

// screenshot placeholder blanc 390x844
const w = 390, h = 844;
const shot = Buffer.alloc(w * h * 4, 255);
mkdirSync(path.resolve(outDir, '../screenshots'), { recursive: true });
writeFileSync(path.resolve(outDir, '../screenshots/home-mobile.png'), encodePng(w, h, shot));
console.log('icons generated in', outDir);
