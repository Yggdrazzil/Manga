// Génère les icônes SerieTime pour Expo (écran TV noir sur fond jaune).
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

function crc32(buf) {
  let t = crc32.t;
  if (!t) { t = crc32.t = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; }); }
  let c = -1;
  for (const b of buf) c = (c >>> 8) ^ t[(c ^ b) & 0xff];
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function draw(size, full) {
  const Y = [255, 212, 0, 255], B = [0, 0, 0, 255], W = [255, 255, 255, 255];
  const rgba = Buffer.alloc(size * size * 4);
  const set = (x, y, c) => { if (x < 0 || y < 0 || x >= size || y >= size) return; const i = (y * size + x) * 4; rgba[i] = c[0]; rgba[i + 1] = c[1]; rgba[i + 2] = c[2]; rgba[i + 3] = c[3]; };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) set(x, y, Y);
  const pad = full ? 0.3 : 0.24;
  const x0 = Math.round(size * pad), x1 = Math.round(size * (1 - pad));
  const y0 = Math.round(size * (pad + 0.06)), y1 = Math.round(size * (1 - pad + 0.03));
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) set(x, y, B);
  const th = Math.max(2, Math.round(size * 0.03)), cx = Math.round(size / 2), aTop = Math.round(size * (pad - 0.08));
  for (let y = aTop; y < y0; y++) { const p = (y - aTop) / Math.max(1, y0 - aTop), off = Math.round((1 - p) * size * 0.12); for (let t = 0; t < th; t++) { set(cx - off + t, y, B); set(cx + off + t, y, B); } }
  const tw = (x1 - x0) * 0.34, tht = (y1 - y0) * 0.44, pcx = (x0 + x1) / 2 - tw * 0.15, pcy = (y0 + y1) / 2;
  for (let y = Math.round(pcy - tht / 2); y < Math.round(pcy + tht / 2); y++) { const p = Math.abs(y - pcy) / (tht / 2), rw = tw * (1 - p); for (let x = Math.round(pcx); x < Math.round(pcx + rw); x++) set(x, y, W); }
  return png(size, size, rgba);
}
const out = path.resolve(process.argv[2] ?? 'assets');
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'icon.png'), draw(1024, false));
writeFileSync(path.join(out, 'adaptive-icon.png'), draw(1024, true));
console.log('icons written to', out);
