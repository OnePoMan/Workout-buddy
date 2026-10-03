/**
 * Colours are packed 32-bit RGBA in the byte order of ImageData on
 * little-endian machines (0xAABBGGRR), so a Uint32Array view over
 * ImageData can be written directly.
 */
export type Color = number;

export const TRANSPARENT: Color = 0;

export function rgba(r: number, g: number, b: number, a = 255): Color {
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

export function hex(s: string, a = 255): Color {
  const h = s.replace('#', '');
  return rgba(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), a);
}

export function channels(c: Color): [number, number, number, number] {
  return [c & 0xff, (c >>> 8) & 0xff, (c >>> 16) & 0xff, c >>> 24];
}

export function alpha(c: Color): number {
  return c >>> 24;
}

export function withAlpha(c: Color, a: number): Color {
  return ((c & 0x00ffffff) | (Math.max(0, Math.min(255, Math.round(a))) << 24)) >>> 0;
}

/** Linear mix of two colours, alpha included. */
export function mix(c1: Color, c2: Color, t: number): Color {
  const a = channels(c1);
  const b = channels(c2);
  const m = (i: number) => Math.round(a[i]! + (b[i]! - a[i]!) * t);
  return rgba(m(0), m(1), m(2), m(3));
}

/** Source-over composite of `src` on `dst`. */
export function over(dst: Color, src: Color): Color {
  const sa = alpha(src);
  if (sa === 255) return src;
  if (sa === 0) return dst;
  const [sr, sg, sb] = channels(src);
  const [dr, dg, db, da] = channels(dst);
  const s = sa / 255;
  const d = (da / 255) * (1 - s);
  const oa = s + d;
  if (oa === 0) return TRANSPARENT;
  return rgba(
    Math.round((sr * s + dr * d) / oa),
    Math.round((sg * s + dg * d) / oa),
    Math.round((sb * s + db * d) / oa),
    Math.round(oa * 255),
  );
}
