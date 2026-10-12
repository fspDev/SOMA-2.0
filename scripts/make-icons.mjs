// Genera los íconos de la PWA (tres puntos del logo) sin dependencias: PNG escrito a mano.
// Uso: node scripts/make-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [0xf5, 0xf5, 0xf3];
const DOTS = [
  { c: [0x3b, 0x3f, 0xe0] },
  { c: [0xd3, 0xd5, 0xe0] },
  { c: [0xd3, 0xd5, 0xe0] },
];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size) {
  // Los puntos ocupan el 60 % central (zona segura para íconos "maskable").
  const r = size * 0.085;
  const gap = size * 0.035;
  const total = 6 * r + 2 * gap;
  const cx0 = (size - total) / 2 + r;
  const cy = size / 2;
  const centers = DOTS.map((d, i) => ({ ...d, x: cx0 + i * (2 * r + gap) }));
  const SS = 4;
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let acc = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          let col = BG;
          for (const d of centers) if ((px - d.x) ** 2 + (py - cy) ** 2 <= r * r) col = d.c;
          acc = acc.map((v, i) => v + col[i]);
        }
      const o = y * (size * 3 + 1) + 1 + x * 3;
      for (let i = 0; i < 3; i++) raw[o + i] = Math.round(acc[i] / (SS * SS));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

writeFileSync('public/icon-192.png', png(192));
writeFileSync('public/icon-512.png', png(512));
writeFileSync(
  'public/icon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#F5F5F3"/><circle cx="17" cy="32" r="7" fill="#3B3FE0"/><circle cx="32" cy="32" r="7" fill="#D3D5E0"/><circle cx="47" cy="32" r="7" fill="#D3D5E0"/></svg>\n`,
);
console.log('íconos generados');
