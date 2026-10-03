/** Full-screen pieces from the achievement video: shards, rays, iris, title card, cut-in. */
import { PixelBuffer, type Point } from '../pixel/buffer';
import { hex, type Color } from '../pixel/color';
import { clamp01, easeOutBack } from '../pixel/easing';
import { C } from '../pixel/palette';
import { mulberry32, randInt } from '../pixel/rng';
import { renderCharacter, stand, type Outfit } from '../pixel/sprites/character';
import { sparkle } from './common';
import { drawRansom, fitRansom } from './ransom';

interface Shard {
  key: number;
  tri: [Point, Point, Point];
  col: Color;
}

const shardCache = new Map<string, Shard[]>();

function shardSet(w: number, h: number, seed: number): Shard[] {
  const ck = `${w}x${h}:${seed}`;
  const hit = shardCache.get(ck);
  if (hit) return hit;
  const rnd = mulberry32(seed);
  const step = Math.max(18, Math.round(w / 8));
  const jit = Math.round(step / 3);
  const pts = new Map<string, Point>();
  const gw = Math.ceil(w / step) + 3;
  const gh = Math.ceil(h / step) + 3;
  for (let gy = -1; gy < gh; gy++) {
    for (let gx = -1; gx < gw; gx++) {
      pts.set(`${gx},${gy}`, [gx * step + randInt(rnd, -jit, jit) + (gy % 2) * (step / 2), gy * step + randInt(rnd, -jit, jit)]);
    }
  }
  const out: Shard[] = [];
  for (let gy = -1; gy < gh - 1; gy++) {
    for (let gx = -1; gx < gw - 1; gx++) {
      const a = pts.get(`${gx},${gy}`)!;
      const b = pts.get(`${gx + 1},${gy}`)!;
      const c = pts.get(`${gx},${gy + 1}`)!;
      const d = pts.get(`${gx + 1},${gy + 1}`)!;
      for (const tri of [
        [a, b, c],
        [b, d, c],
      ] as [Point, Point, Point][]) {
        const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
        const cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
        const r = rnd();
        out.push({
          key: cx * 0.85 + cy * 0.55 + (rnd() - 0.5) * 60,
          tri,
          col: r < 0.55 ? C.black : r < 0.9 ? C.red : C.white,
        });
      }
    }
  }
  shardCache.set(ck, out);
  return out;
}

/** P5 shard wipe. p 0..0.5 covers the screen, 0.5..1 reveals it. */
export function shards(buf: PixelBuffer, p: number, seed = 1): void {
  if (p <= 0 || p >= 1) return;
  const W = buf.width;
  const H = buf.height;
  const kmin = -40;
  const kmax = W * 0.85 + H * 0.55 + 40;
  const covering = p <= 0.5;
  const s = kmin + ((covering ? p : p - 0.5) / 0.5) * (kmax - kmin);
  for (const { key, tri, col } of shardSet(W, H, seed)) {
    const g = covering ? (key < s ? clamp01((s - key) / 60) : 0) : key >= s ? clamp01((key - s) / 60) : 0;
    if (g <= 0) continue;
    const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
    const cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
    buf.polygon(
      tri.map(([x, y]) => [cx + (x - cx) * g, cy + (y - cy) * g] as const),
      col,
    );
  }
}

/** Rotating gold/pink ray burst with a glowing centre. */
export function rays(buf: PixelBuffer, cx: number, cy: number, t: number, strength: number): void {
  if (strength <= 0) return;
  const n = 14;
  const rot = t * 0.5;
  const L = Math.hypot(buf.width, buf.height) * strength;
  for (let k = 0; k < n; k++) {
    const a0 = rot + (k * 2 * Math.PI) / n;
    const a1 = a0 + (Math.PI / n) * 0.8;
    buf.polygon(
      [
        [cx, cy],
        [cx + L * Math.cos(a0), cy + L * Math.sin(a0)],
        [cx + L * Math.cos(a1), cy + L * Math.sin(a1)],
      ],
      k % 2 === 0 ? C.gold : hex('ff3d8e'),
    );
  }
  const r = 14 * strength;
  buf.ellipse(cx - r, cy - r, cx + r, cy + r, C.gold);
  buf.ellipse(cx - r * 0.7, cy - r * 0.7, cx + r * 0.7, cy + r * 0.7, C.gold_l);
}

/** Star-shaped iris wipe. p 0 open .. 1 closed. */
export function iris(buf: PixelBuffer, p: number, cx: number, cy: number): void {
  if (p <= 0) return;
  const R = (1 - p) ** 1.5 * Math.hypot(buf.width, buf.height) * 1.2;
  const mask = new PixelBuffer(buf.width, buf.height);
  if (R > 1) {
    const rot = p * 1.2;
    const pts: Point[] = Array.from({ length: 10 }, (_, k) => {
      const r = k % 2 === 0 ? R : R * 0.5;
      const a = -Math.PI / 2 + rot + (k * Math.PI) / 5;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
    });
    mask.polygon(pts, C.white);
  }
  for (let i = 0; i < buf.data.length; i++) if (mask.data[i] === 0) buf.data[i] = C.black;
}

/** Red title card with moving stripes and a black slash; returns the slash's centre y. */
export function titleCard(buf: PixelBuffer, t: number): number {
  const W = buf.width;
  const H = buf.height;
  buf.rect(0, 0, W, H, C.red);
  const off = Math.floor(t * 40) % 32;
  for (let x = -H; x < W + H; x += 32) {
    buf.polygon(
      [
        [x + off, 0],
        [x + off + 12, 0],
        [x + off - H * 0.6 + 12, H],
        [x + off - H * 0.6, H],
      ],
      C.red_d,
    );
  }
  const cy = Math.round(H * 0.42);
  buf.polygon(
    [
      [-10, cy - 34],
      [W + 10, cy - 50],
      [W + 10, cy + 34],
      [-10, cy + 50],
    ],
    C.black,
  );
  buf.polygon(
    [
      [-10, cy + 46],
      [W + 10, cy + 30],
      [W + 10, cy + 34],
      [-10, cy + 50],
    ],
    C.white,
  );
  return cy;
}

/** The character cropped to head and shoulders, scaled up, for cut-ins. */
export function portrait(outfit: Omit<Outfit, 'sway'>, scale: number, t: number): PixelBuffer {
  const full = renderCharacter(stand(0, 'happy', { outfit: { ...outfit, sway: Math.round(Math.sin(t * 3.5)) } }));
  return full.crop(8, 14, 44, 32).scaled(scale);
}

/** Diagonal cut-in band with the portrait sliding in and a title. `tl` from band start. */
export function cutIn(
  buf: PixelBuffer,
  tl: number,
  dur: number,
  outfit: Omit<Outfit, 'sway'>,
  title: string,
  seed: number,
): void {
  if (tl < 0 || tl > dur) return;
  const W = buf.width;
  const cy = Math.round(buf.height * 0.42);
  const enter = clamp01(tl / 0.14);
  const leave = clamp01((tl - (dur - 0.15)) / 0.15);
  const half = Math.round(34 * enter * (1 - leave));
  if (half <= 0) return;
  const tilt = 8;
  buf.polygon(
    [
      [-10, cy - half - 3 + tilt],
      [W + 10, cy - half - 3 - tilt],
      [W + 10, cy + half + 3 - tilt],
      [-10, cy + half + 3 + tilt],
    ],
    C.white,
  );
  buf.polygon(
    [
      [-10, cy - half + tilt],
      [W + 10, cy - half - tilt],
      [W + 10, cy + half - tilt],
      [-10, cy + half + tilt],
    ],
    C.red,
  );
  const scale = 2;
  const face = portrait(outfit, scale, tl);
  const px = Math.round(-face.width + easeOutBack(clamp01((tl - 0.05) / 0.25)) * (face.width + 4));
  buf.blit(face, px, cy - Math.round(face.height / 2));
  // Glasses glint.
  if (tl > 0.5 && tl < 0.9) sparkle(buf, px + 30 * scale, cy - 4 * scale, 1 + 3 * Math.sin(((tl - 0.5) / 0.4) * Math.PI), C.white);
  const text = fitRansom(title, W - face.width - 8, { seed, overlap: 2, scale: 2 });
  drawRansom(buf, text, Math.round(face.width + (W - face.width) / 2), cy + 2, tl - 0.3, { anchor: 'center', stagger: 0.05 });
}
