// Generates the PWA icons in public/ from the character head sprite
// (ported from Q-A-Together achievement-video/character.py). No dependencies.
// Usage: node scripts/make-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';

const hex = (s) => [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16), 255];

const C = {
  black: hex('0c0a12'), red: hex('e8102a'), red_d: hex('9c0718'), gold: hex('ffc93c'),
  ink: hex('24122e'),
  hair: hex('7b4526'), hair_d: hex('4e2816'), hair_l: hex('b36b3a'), hair_ll: hex('d99155'),
  skin: hex('f5c7a1'), skin_d: hex('dc9474'), skin_dd: hex('b56a55'), blush: hex('ff8e9a'),
  glass: hex('ff2440'), glass_d: hex('a8102a'), lens: hex('ffe9ef'), eye: hex('2c1530'),
  mouth: hex('a8344a'),
};

const PAL = {
  o: C.ink, h: C.hair, H: C.hair_d, l: C.hair_l, L: C.hair_ll,
  s: C.skin, S: C.skin_d, D: C.skin_dd, b: C.blush,
  r: C.glass, R: C.glass_d, w: C.lens, e: C.eye, m: C.mouth,
};

const HEAD_BASE = [
  '........oooooo.......',
  '......oohhhhhhoo.....',
  '.....ohhhhlllhhhoo...',
  '....ohhhhllLLllhhho..',
  '...ohhhhhhllllhhhhho.',
  '...ohhhhhhhhhhhhhhho.',
  '..ohhhhhhhhhhhhhhhhho',
  '..ohhhhhhhhhhhhHhhhho',
  '..ohhhhhhHHhhhHHhhhho',
  '.ohhhhhhHsshhHsssshho',
  '.ohhhhhHsssssHssssshho',
  '.ohhhhhSrrrrsrrrrsHho',
  '.ohhhhhSr{}rrr{}rsHho',
  '.ohhhhhSr[]rsr[]rsHho',
  '.oHhhhhSsrrssssrrsHho',
  '.oHhhhhhSbsssssbssHho',
  'ohHhhhhhSsss<>sssShho',
  'ohHhHhhhhSsssssssShHo',
  'ohHhHhhhhHSSssssSohho',
  'ohhHhHhhHhoSSSSSo.oHo',
  'ohHlhHhlho..SSS...oho',
  'ohhHhHhhHo........oHo',
  '.ohHlhHlHo........oHo',
  'ohHhoHhHo.........oo.',
  '.oHo.oHo.............',
  '..o...o..............',
];

// "happy" expression: closed eyes, open smile.
const head = HEAD_BASE.map((r) => r.replaceAll('{}', 'ss').replaceAll('[]', 'ee').replaceAll('<>', 'mm'));
const HW = Math.max(...head.map((r) => r.length));
const HH = head.length;

function render(size, scale) {
  const px = new Uint8Array(size * size * 4);
  const set = (x, y, c) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    px.set(c, (y * size + x) * 4);
  };
  // Background: black with a tilted red slab and a gold underline through the middle.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = (y - size * 0.5) + (x - size * 0.5) * -0.18;
      let c = C.black;
      if (Math.abs(t) < size * 0.2) c = C.red;
      else if (Math.abs(t) < size * 0.23) c = C.red_d;
      if (t > size * 0.23 && t < size * 0.26) c = C.gold;
      set(x, y, c);
    }
  }
  const ox = Math.round((size - HW * scale) / 2);
  const oy = Math.round((size - HH * scale) / 2);
  head.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const c = PAL[ch];
      if (!c) return;
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) set(ox + x * scale + dx, oy + y * scale + dy, c);
    });
  });
  // Blush on the happy face, as in character.head().
  for (const bx of [8, 9, 15, 16]) {
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) set(ox + bx * scale + dx, oy + 15 * scale + dy, C.blush);
  }
  return encodePng(size, size, px);
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
}

function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Head stays inside the central 80% safe zone so the 512 icon works as maskable.
writeFileSync('public/icon-512x512.png', render(512, 10));
writeFileSync('public/icon-192x192.png', render(192, 4));
writeFileSync('public/apple-touch-icon.png', render(180, 4));
console.log('Wrote public/icon-512x512.png, icon-192x192.png, apple-touch-icon.png');
