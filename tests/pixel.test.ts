import { describe, expect, it } from 'vitest';
import { PixelBuffer, sprite } from '../src/pixel/buffer';
import { TRANSPARENT, alpha, channels, hex, mix, over, rgba } from '../src/pixel/color';
import { ditherVGrad, glowLayer } from '../src/pixel/dither';
import { drawText, textWidth } from '../src/pixel/font';
import { computeScale, cropX } from '../src/pixel/scale';

const R = hex('ff0000');
const G = hex('00ff00');
const B = hex('0000ff');

function opaque(b: PixelBuffer): [number, number][] {
  const out: [number, number][] = [];
  for (let y = 0; y < b.height; y++) for (let x = 0; x < b.width; x++) if (alpha(b.get(x, y)) > 0) out.push([x, y]);
  return out;
}

describe('color', () => {
  it('packs in ImageData byte order', () => {
    const c = rgba(1, 2, 3, 4);
    expect(channels(c)).toEqual([1, 2, 3, 4]);
    const bytes = new Uint8Array(new Uint32Array([c]).buffer);
    expect([...bytes]).toEqual([1, 2, 3, 4]); // little-endian
    expect(channels(hex('#24122e'))).toEqual([0x24, 0x12, 0x2e, 255]);
  });

  it('mixes and composites', () => {
    expect(channels(mix(rgba(0, 0, 0), rgba(200, 100, 50), 0.5))).toEqual([100, 50, 25, 255]);
    expect(over(R, G)).toBe(G);
    expect(over(R, TRANSPARENT)).toBe(R);
    expect(channels(over(rgba(0, 0, 0), rgba(255, 255, 255, 128)))).toEqual([128, 128, 128, 255]);
  });
});

describe('PixelBuffer', () => {
  it('fills inclusive rectangles and clips', () => {
    const b = new PixelBuffer(10, 10);
    b.rect(2, 3, 4, 5, R);
    expect(opaque(b)).toHaveLength(9);
    expect(b.get(4, 5)).toBe(R);
    expect(b.get(5, 5)).toBe(TRANSPARENT);
    b.rect(-5, -5, 0, 0, G);
    expect(b.get(0, 0)).toBe(G);
    b.rect(8, 8, 50, 50, B);
    expect(opaque(b)).toHaveLength(9 + 1 + 4);
  });

  it('draws lines through both endpoints, wider with a disc', () => {
    const b = new PixelBuffer(12, 12);
    b.line(1, 1, 9, 5, R);
    expect(b.get(1, 1)).toBe(R);
    expect(b.get(9, 5)).toBe(R);
    expect(opaque(b)).toHaveLength(9);
    const w = new PixelBuffer(12, 12);
    w.line(5, 5, 5, 5, R, 3);
    expect(opaque(w)).toHaveLength(9); // 3x3 disc
    const w5 = new PixelBuffer(12, 12);
    w5.line(5, 5, 5, 5, R, 5);
    expect(opaque(w5)).toHaveLength(21); // 5-wide disc without corners
  });

  it('fills symmetric ellipses inside their box, or outlines them', () => {
    const b = new PixelBuffer(20, 20);
    b.ellipse(2, 4, 12, 10, R);
    for (const [x, y] of opaque(b)) {
      expect(x).toBeGreaterThanOrEqual(2);
      expect(x).toBeLessThanOrEqual(12);
      expect(y).toBeGreaterThanOrEqual(4);
      expect(y).toBeLessThanOrEqual(10);
      expect(b.get(14 - x, y)).toBe(R); // mirror about x = 7
    }
    expect(b.get(7, 7)).toBe(R);
    const o = new PixelBuffer(20, 20);
    o.ellipse(2, 2, 14, 14, R, true);
    expect(o.get(8, 8)).toBe(TRANSPARENT);
    expect(o.get(8, 2)).toBe(R);
  });

  it('fills polygons', () => {
    const b = new PixelBuffer(10, 10);
    b.polygon(
      [
        [2, 2],
        [6, 2],
        [6, 6],
        [2, 6],
      ],
      R,
    );
    expect(b.get(4, 4)).toBe(R);
    expect(b.get(2, 2)).toBe(R);
    expect(b.get(6, 6)).toBe(R);
    expect(b.get(7, 4)).toBe(TRANSPARENT);
  });

  it('blits with transparency and clipping', () => {
    const src = sprite(['r.', '.g'], { r: R, g: G });
    const dst = new PixelBuffer(4, 4, B);
    dst.blit(src, 3, 3);
    expect(dst.get(3, 3)).toBe(R);
    dst.blit(src, -1, -1);
    expect(dst.get(0, 0)).toBe(G);
    dst.blit(src, 1, 1);
    expect(dst.get(2, 1)).toBe(B); // transparent pixel keeps the background
  });

  it('flips, copies regions and parses sprites', () => {
    const s = sprite(['rg.'], { r: R, g: G });
    expect([...s.flipX().data]).toEqual([TRANSPARENT, G, R]);
    const big = new PixelBuffer(4, 2);
    big.set(2, 1, R);
    const view = new PixelBuffer(2, 1);
    view.copyRegion(big, 1, 1);
    expect([...view.data]).toEqual([TRANSPARENT, R]);
    expect(() => sprite(['x'], {})).toThrow(/no colour/);
  });
});

describe('dither', () => {
  it('runs a gradient from the first to the last stop', () => {
    const b = new PixelBuffer(8, 10);
    ditherVGrad(b, [0, 0, 8, 10], [
      [0, R],
      [1, B],
    ]);
    for (let x = 0; x < 8; x++) {
      expect(b.get(x, 0)).toBe(R);
      expect(b.get(x, 9)).toBe(B);
    }
    const mid = Array.from({ length: 8 }, (_, x) => b.get(x, 5));
    expect(mid).toContain(R);
    expect(mid).toContain(B);
  });

  it('makes a glow strongest at the centre and empty outside', () => {
    const g = glowLayer(20, 20, 10, 10, 8, hex('ffffff', 200));
    expect(alpha(g.get(10, 10))).toBe(200);
    expect(g.get(0, 0)).toBe(TRANSPARENT);
    expect(alpha(g.get(10, 10))).toBeGreaterThanOrEqual(alpha(g.get(15, 10)));
  });
});

describe('font', () => {
  it('measures proportional glyphs', () => {
    expect(textWidth('A')).toBe(5);
    expect(textWidth('I')).toBe(3);
    expect(textWidth('AI')).toBe(9);
    expect(textWidth('AI', 2)).toBe(18);
  });

  it('draws uppercase for lowercase, and ? for unknown characters', () => {
    const a = new PixelBuffer(6, 7);
    const b = new PixelBuffer(6, 7);
    drawText(a, 'a', 0, 0, R);
    drawText(b, 'A', 0, 0, R);
    expect([...a.data]).toEqual([...b.data]);
    const q = new PixelBuffer(6, 7);
    const u = new PixelBuffer(6, 7);
    drawText(q, '?', 0, 0, R);
    drawText(u, '@', 0, 0, R);
    expect([...u.data]).toEqual([...q.data]);
    expect(opaque(a).length).toBeGreaterThan(10);
  });
});

describe('scale', () => {
  it('uses whole device pixels and at least 180 art pixels', () => {
    // 390px phone, 16px gutters.
    expect(computeScale(358, 3, 240, 160)).toMatchObject({ devicePerPixel: 5, nativeW: 214 });
    expect(computeScale(358, 2, 240, 160)).toMatchObject({ devicePerPixel: 3, nativeW: 238 });
    // Desktop: whole room, capped at the art width.
    expect(computeScale(528, 1, 240, 160)).toMatchObject({ devicePerPixel: 2, nativeW: 240, cssW: 480, cssH: 320 });
    for (const dpr of [1, 1.5, 2, 2.625, 3]) {
      const s = computeScale(358, dpr, 240, 160);
      expect(Number.isInteger(s.devicePerPixel)).toBe(true);
      expect(s.nativeW).toBeGreaterThanOrEqual(179);
      expect(s.cssW * dpr).toBeCloseTo(s.nativeW * s.devicePerPixel, 6);
      expect(s.cssW).toBeLessThanOrEqual(358);
    }
  });

  it('crops around a focus point and clamps to the art', () => {
    expect(cropX(240, 180, 140)).toBe(50);
    expect(cropX(240, 180, 10)).toBe(0);
    expect(cropX(240, 180, 239)).toBe(60);
    expect(cropX(240, 240, 140)).toBe(0);
  });
});
