/**
 * Ransom-note lettering (achievement-video/ui.py ransom_tiles / draw_ransom):
 * each letter on its own skewed tile with mixed colours, sizes and offsets.
 */
import { PixelBuffer, type Point } from '../pixel/buffer';
import { TRANSPARENT, alpha, type Color } from '../pixel/color';
import { clamp01, easeOutBack } from '../pixel/easing';
import { GLYPH_HEIGHT, drawText, glyphWidth } from '../pixel/font';
import { C } from '../pixel/palette';
import { mulberry32, randInt } from '../pixel/rng';

/** [glyph colour, tile colour]. */
export type TileStyle = readonly [Color, Color];

export const STYLES: readonly TileStyle[] = [
  [C.white, C.black],
  [C.black, C.white],
  [C.white, C.red],
  [C.black, C.white],
  [C.white, C.black],
];

interface Tile {
  buf: PixelBuffer;
  /** White silhouette shown for the first frames of the pop. */
  flash: PixelBuffer;
  x: number;
  dy: number;
}

export interface RansomOptions {
  scale?: number;
  seed?: number;
  styles?: readonly TileStyle[];
  overlap?: number;
  /** Allow ~30% of letters one size larger. */
  big?: boolean;
}

export interface RansomLayout {
  tiles: Tile[];
  width: number;
  height: number;
}

const cache = new Map<string, RansomLayout>();

export function ransomTiles(text: string, o: RansomOptions = {}): RansomLayout {
  const { scale = 1, seed = 0, styles = STYLES, overlap = 1, big = true } = o;
  const key = JSON.stringify([text, scale, seed, styles, overlap, big]);
  const hit = cache.get(key);
  if (hit) return hit;

  const rnd = mulberry32(seed);
  const tiles: Tile[] = [];
  let x = 0;
  let height = 0;
  for (const ch of text) {
    if (ch === ' ') {
      x += 2 * scale + 2;
      continue;
    }
    const isBig = rnd() < 0.3 && big;
    const s = scale + (isBig ? 1 : 0);
    const [fg, bg] = styles[Math.floor(rnd() * styles.length)]!;
    const pad = Math.max(2, s - 1);
    const tw = glyphWidth(ch) * s + pad * 2;
    const th = GLYPH_HEIGHT * s + pad * 2;
    const sk = [-2, -1, 1, 2][Math.floor(rnd() * 4)]!;
    const buf = new PixelBuffer(tw + 6, th + 4);
    const ox = 2;
    const oy = 1;
    const pts: Point[] = [
      [ox + (sk > 0 ? sk : 0), oy],
      [ox + tw + (sk > 0 ? sk : 0), oy],
      [ox + tw + (sk > 0 ? 0 : -sk), oy + th],
      [ox + (sk > 0 ? 0 : -sk), oy + th],
    ];
    const grow: Point[] = [
      [pts[0]![0] - 1, pts[0]![1] - 1],
      [pts[1]![0] + 1, pts[1]![1] - 1],
      [pts[2]![0] + 1, pts[2]![1] + 1],
      [pts[3]![0] - 1, pts[3]![1] + 1],
    ];
    const edge = bg === C.black || bg === C.red ? C.white : C.black;
    buf.polygon(
      grow.map(([a, b]) => [a + 1, b + 2] as const),
      C.black,
    );
    buf.polygon(grow, edge);
    buf.polygon(pts, bg);
    drawText(buf, ch, ox + pad + Math.floor(Math.abs(sk) / 2), oy + pad, fg, s);

    const flash = new PixelBuffer(buf.width, buf.height);
    for (let i = 0; i < buf.data.length; i++) flash.data[i] = alpha(buf.data[i]!) ? C.white : TRANSPARENT;

    const jitter = scale + 1;
    const dy = randInt(rnd, -jitter, jitter) - (isBig ? 2 : 0);
    tiles.push({ buf, flash, x, dy });
    height = Math.max(height, buf.height);
    x += buf.width - 3 - overlap;
  }
  const layout = { tiles, width: Math.max(0, x), height };
  cache.set(key, layout);
  return layout;
}

/**
 * Largest-looking layout that fits `maxW`: big letters first, then
 * uniform letters, then tighter overlap.
 */
export function fitRansom(text: string, maxW: number, o: RansomOptions = {}): RansomLayout {
  const tries: RansomOptions[] = [
    { ...o },
    { ...o, big: false },
    { ...o, big: false, overlap: (o.overlap ?? 1) + 1 },
    { ...o, big: false, overlap: (o.overlap ?? 1) + 2, scale: 1 },
  ];
  let last = ransomTiles(text, tries[0]);
  for (const t of tries) {
    last = ransomTiles(text, t);
    if (last.width <= maxW) return last;
  }
  return last;
}

export interface DrawRansomOptions {
  /** Seconds between letters popping in. */
  stagger?: number;
  anchor?: 'left' | 'center' | 'right';
  /** Pop letters in; false draws them settled. */
  pop?: boolean;
}

/** Draws a layout centred vertically on y. `tSince` is seconds since the text started. */
export function drawRansom(
  buf: PixelBuffer,
  layout: RansomLayout,
  x: number,
  y: number,
  tSince: number,
  o: DrawRansomOptions = {},
): void {
  const { stagger = 0.04, anchor = 'left', pop = true } = o;
  if (anchor === 'center') x -= Math.floor(layout.width / 2);
  else if (anchor === 'right') x -= layout.width;
  layout.tiles.forEach((tile, n) => {
    const ts = tSince - n * stagger;
    if (pop && ts < 0) return;
    let off = 0;
    if (pop) {
      if (ts < 0.035) {
        buf.blit(tile.flash, x + tile.x, y + tile.dy - Math.floor(tile.buf.height / 2));
        return;
      }
      off = (1 - easeOutBack(clamp01(ts / 0.12))) * -6;
    }
    buf.blit(tile.buf, x + tile.x, y + tile.dy - Math.floor(tile.buf.height / 2) + off);
  });
}
