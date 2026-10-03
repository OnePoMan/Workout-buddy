import { PixelBuffer } from './buffer';
import { withAlpha, type Color } from './color';

export const BAYER4: readonly (readonly number[])[] = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

export function bayer(x: number, y: number): number {
  return (BAYER4[((y % 4) + 4) % 4]![((x % 4) + 4) % 4]! + 0.5) / 16;
}

/**
 * Vertical gradient through colour stops with 4x4 ordered dithering.
 * Box is [x0, y0, x1, y1) (end-exclusive), as in gfx.dither_vgrad.
 */
export function ditherVGrad(
  buf: PixelBuffer,
  box: readonly [number, number, number, number],
  stops: readonly (readonly [number, Color])[],
): void {
  const [x0, y0, x1, y1] = box;
  const hgt = Math.max(y1 - y0 - 1, 1);
  for (let y = y0; y < y1; y++) {
    const t = (y - y0) / hgt;
    let a = stops[0]!;
    let b = stops[stops.length - 1]!;
    for (let i = 0; i < stops.length - 1; i++) {
      if (stops[i]![0] <= t && t <= stops[i + 1]![0]) {
        a = stops[i]!;
        b = stops[i + 1]!;
        break;
      }
    }
    const f = (t - a[0]) / Math.max(b[0] - a[0], 1e-6);
    for (let x = x0; x < x1; x++) buf.set(x, y, f > bayer(x, y) ? b[1] : a[1]);
  }
}

/** Radial glow overlay quantised to 4 alpha steps with ordered dithering (gfx.glow_layer). */
export function glowLayer(
  w: number,
  h: number,
  cx: number,
  cy: number,
  r: number,
  color: Color,
  strength = 1,
): PixelBuffer {
  const out = new PixelBuffer(w, h);
  const baseA = color >>> 24;
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(h - 1, Math.floor(cy + r)); y++) {
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(w - 1, Math.floor(cx + r)); x++) {
      const d = Math.hypot(x - cx, y - cy) / r;
      if (d >= 1) continue;
      const v = (1 - d) ** 1.6 * strength;
      const lv = Math.min(Math.floor(v * 4 + bayer(x, y)), 4);
      if (lv > 0) out.set(x, y, withAlpha(color, (baseA * lv) / 4));
    }
  }
  return out;
}
