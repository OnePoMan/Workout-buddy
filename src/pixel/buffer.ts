import { TRANSPARENT, alpha, over, type Color } from './color';

export type Point = readonly [number, number];

/** Integer offsets of a filled disc of the given diameter, cached per diameter. */
const discCache = new Map<number, Point[]>();
function disc(diameter: number): Point[] {
  let pts = discCache.get(diameter);
  if (!pts) {
    pts = [];
    const r = diameter / 2;
    const lim = Math.ceil(r);
    for (let dy = -lim; dy <= lim; dy++) {
      for (let dx = -lim; dx <= lim; dx++) {
        if (dx * dx + dy * dy <= r * r + 1e-9) pts.push([dx, dy]);
      }
    }
    if (pts.length === 0) pts.push([0, 0]);
    discCache.set(diameter, pts);
  }
  return pts;
}

/**
 * A software RGBA framebuffer with PIL-like primitives. Drawing is exact per
 * pixel (no antialiasing), and rectangle/ellipse boxes are inclusive like
 * PIL's ImageDraw, so shapes port 1:1 from the achievement video code.
 */
export class PixelBuffer {
  readonly data: Uint32Array;

  constructor(
    readonly width: number,
    readonly height: number,
    fill: Color = TRANSPARENT,
  ) {
    this.data = new Uint32Array(width * height);
    if (fill !== TRANSPARENT) this.data.fill(fill);
  }

  clone(): PixelBuffer {
    const b = new PixelBuffer(this.width, this.height);
    b.data.set(this.data);
    return b;
  }

  get(x: number, y: number): Color {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return TRANSPARENT;
    return this.data[y * this.width + x]!;
  }

  /** Overwrites the pixel (alpha included), like drawing on an RGBA image in PIL. */
  set(x: number, y: number, c: Color): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.data[y * this.width + x] = c;
  }

  /** Composites the pixel source-over. */
  blend(x: number, y: number, c: Color): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = y * this.width + x;
    this.data[i] = over(this.data[i]!, c);
  }

  /** Inclusive box, in either corner order. */
  rect(x0: number, y0: number, x1: number, y1: number, c: Color): void {
    const xa = Math.max(0, Math.round(Math.min(x0, x1)));
    const xb = Math.min(this.width - 1, Math.round(Math.max(x0, x1)));
    const ya = Math.max(0, Math.round(Math.min(y0, y1)));
    const yb = Math.min(this.height - 1, Math.round(Math.max(y0, y1)));
    for (let y = ya; y <= yb; y++) this.data.fill(c, y * this.width + xa, y * this.width + xb + 1);
  }

  /** Bresenham line; widths > 1 stamp a disc, which also rounds the joints. */
  line(x0: number, y0: number, x1: number, y1: number, c: Color, width = 1): void {
    let ax = Math.round(x0);
    let ay = Math.round(y0);
    const bx = Math.round(x1);
    const by = Math.round(y1);
    const pts = width > 1 ? disc(width) : null;
    const dx = Math.abs(bx - ax);
    const dy = -Math.abs(by - ay);
    const sx = ax < bx ? 1 : -1;
    const sy = ay < by ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (pts) for (const [ox, oy] of pts) this.set(ax + ox, ay + oy, c);
      else this.set(ax, ay, c);
      if (ax === bx && ay === by) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        ax += sx;
      }
      if (e2 <= dx) {
        err += dx;
        ay += sy;
      }
    }
  }

  polyline(pts: readonly Point[], c: Color, width = 1): void {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x0, y0] = pts[i]!;
      const [x1, y1] = pts[i + 1]!;
      this.line(x0, y0, x1, y1, c, width);
    }
    if (pts.length === 1) this.line(pts[0]![0], pts[0]![1], pts[0]![0], pts[0]![1], c, width);
  }

  /** Ellipse in an inclusive bounding box; filled, or a 1px outline. */
  ellipse(x0: number, y0: number, x1: number, y1: number, c: Color, outline = false): void {
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const rx = (x1 - x0) / 2 + 0.5;
    const ry = (y1 - y0) / 2 + 0.5;
    const inside = (x: number, y: number, shrink: number) => {
      const ex = rx - shrink;
      const ey = ry - shrink;
      if (ex <= 0 || ey <= 0) return false;
      const nx = (x - cx) / ex;
      const ny = (y - cy) / ey;
      return nx * nx + ny * ny <= 1;
    };
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
        if (!inside(x, y, 0)) continue;
        if (outline && inside(x, y, 1)) continue;
        this.set(x, y, c);
      }
    }
  }

  /** Filled polygon (even-odd), sampling pixel centres. */
  polygon(pts: readonly Point[], c: Color): void {
    if (pts.length < 3) return;
    const ys = pts.map((p) => p[1]);
    const ya = Math.max(0, Math.floor(Math.min(...ys)));
    const yb = Math.min(this.height - 1, Math.ceil(Math.max(...ys)));
    for (let y = ya; y <= yb; y++) {
      const sy = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [xa, yA] = pts[i]!;
        const [xb, yB] = pts[(i + 1) % pts.length]!;
        if ((yA <= sy && yB > sy) || (yB <= sy && yA > sy)) {
          xs.push(xa + ((sy - yA) / (yB - yA)) * (xb - xa));
        }
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const from = Math.ceil(xs[i]! - 0.5);
        const to = Math.floor(xs[i + 1]! - 0.5);
        for (let x = from; x <= to; x++) this.set(x, y, c);
      }
    }
    // Close thin slivers the centre sampling misses.
    for (let i = 0; i < pts.length; i++) {
      const [xa, yA] = pts[i]!;
      const [xb, yB] = pts[(i + 1) % pts.length]!;
      this.line(xa, yA, xb, yB, c);
    }
  }

  /** Composites `src` at integer (x, y); handles clipping. */
  blit(src: PixelBuffer, x: number, y: number): void {
    x = Math.round(x);
    y = Math.round(y);
    const x0 = Math.max(0, x);
    const y0 = Math.max(0, y);
    const x1 = Math.min(this.width, x + src.width);
    const y1 = Math.min(this.height, y + src.height);
    for (let yy = y0; yy < y1; yy++) {
      const so = (yy - y) * src.width - x;
      const doff = yy * this.width;
      for (let xx = x0; xx < x1; xx++) {
        const c = src.data[so + xx]!;
        const a = alpha(c);
        if (a === 0) continue;
        this.data[doff + xx] = a === 255 ? c : over(this.data[doff + xx]!, c);
      }
    }
  }

  /** Copies a region of `src` (no blending) into this buffer at (0, 0). */
  copyRegion(src: PixelBuffer, sx: number, sy: number): void {
    for (let y = 0; y < this.height; y++) {
      const row = (sy + y) * src.width + sx;
      this.data.set(src.data.subarray(row, row + this.width), y * this.width);
    }
  }

  /** Copies `src` into this buffer at (dx, dy) without blending. `src` must fit. */
  place(src: PixelBuffer, dx: number, dy: number): void {
    for (let y = 0; y < src.height; y++) {
      this.data.set(src.data.subarray(y * src.width, (y + 1) * src.width), (dy + y) * this.width + dx);
    }
  }

  flipX(): PixelBuffer {
    const b = new PixelBuffer(this.width, this.height);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        b.data[y * this.width + (this.width - 1 - x)] = this.data[y * this.width + x]!;
      }
    }
    return b;
  }
}

/** ASCII rows -> buffer. '.' and ' ' are transparent; other characters map through `pal`. */
export function sprite(rows: readonly string[], pal: Readonly<Record<string, Color>>): PixelBuffer {
  const w = Math.max(...rows.map((r) => r.length));
  const b = new PixelBuffer(w, rows.length);
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) {
      const ch = r[x]!;
      if (ch === '.' || ch === ' ') continue;
      const c = pal[ch];
      if (c === undefined) throw new Error(`sprite: no colour for '${ch}'`);
      b.data[y * w + x] = c;
    }
  });
  return b;
}
