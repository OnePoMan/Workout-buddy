import type { RewardIcon as BadgeIcon } from '../domain/rewards';
import { PixelBuffer, sprite, type Point } from '../pixel/buffer';
import { type Color } from '../pixel/color';
import { bayer } from '../pixel/dither';
import { drawText, textWidth } from '../pixel/font';
import { C } from '../pixel/palette';

/** Dithered black scrim; `p` 0..1 is coverage (0.6 max reads as ~60% dim). */
export function scrim(buf: PixelBuffer, p: number): void {
  const cover = Math.min(1, Math.max(0, p)) * 0.6;
  if (cover <= 0) return;
  for (let y = 0; y < buf.height; y++) {
    for (let x = 0; x < buf.width; x++) if (bayer(x, y) < cover) buf.set(x, y, C.black);
  }
}

/** Parallelogram with horizontal top/bottom, skewed right by `sk` at the top. */
export function para(x0: number, y0: number, x1: number, y1: number, sk: number): Point[] {
  return [
    [x0 + sk, y0],
    [x1 + sk, y0],
    [x1 - sk, y1],
    [x0 - sk, y1],
  ];
}

export function shift(pts: Point[], dx: number, dy: number): Point[] {
  return pts.map(([x, y]) => [x + dx, y + dy] as const);
}

/** 16-point burst star, as on the achievement badge. */
export function burst(buf: PixelBuffer, cx: number, cy: number, rOut: number, rIn: number, rot: number): void {
  const pts: Point[] = Array.from({ length: 16 }, (_, k) => {
    const r = k % 2 === 0 ? rOut : rIn;
    const a = rot + (k * Math.PI) / 8;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  });
  buf.polygon(shift(pts, 2, 2), C.red_d);
  buf.polygon(pts, C.gold);
  buf.polygon(
    pts.map(([x, y]) => [cx + (x - cx) * 0.7, cy + (y - cy) * 0.7] as const),
    C.gold_l,
  );
}

export function sparkle(buf: PixelBuffer, x: number, y: number, s: number, col: Color): void {
  x = Math.round(x);
  y = Math.round(y);
  s = Math.max(1, Math.round(s));
  buf.line(x - s, y, x + s, y, col);
  buf.line(x, y - s, x, y + s, col);
  if (s > 2) {
    buf.set(x - 1, y - 1, col);
    buf.set(x + 1, y + 1, col);
    buf.set(x + 1, y - 1, col);
    buf.set(x - 1, y + 1, col);
  }
}

/** Text with an outline and optional drop shadow, top-left at (x, y). */
export function outlinedText(
  buf: PixelBuffer,
  text: string,
  x: number,
  y: number,
  fill: Color,
  outline: Color,
  scale = 1,
  shadow?: Color,
): void {
  if (shadow !== undefined) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) drawText(buf, text, x + dx * scale + scale, y + dy * scale + scale, shadow, scale);
    }
  }
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) if (dx || dy) drawText(buf, text, x + dx * scale, y + dy * scale, outline, scale);
  }
  drawText(buf, text, x, y, fill, scale);
}

export function centredText(buf: PixelBuffer, text: string, cx: number, y: number, col: Color, scale = 1): void {
  drawText(buf, text, Math.round(cx - textWidth(text, scale) / 2), y, col, scale);
}

const ICONS: Record<Exclude<BadgeIcon, 'star' | 'record'>, string[]> = {
  streak: ['...o...', '..oro..', '.orrro.', '.oryro.', 'orryyro', 'oryyyro', '.oryro.', '..ooo..'],
  week: ['......o', '.....oo', 'o...oo.', 'oo.oo..', '.ooo...', '..o....'],
  flag: ['oooooo', 'oWWoWo', 'oWoWWo', 'oWWoWo', 'oooooo', 'o.....', 'o.....', 'o.....'],
};

export type { BadgeIcon };

/** Small ink icon centred on (cx, cy), drawn inside the burst badge. */
export function badgeIcon(buf: PixelBuffer, icon: BadgeIcon, cx: number, cy: number): void {
  if (icon === 'record') {
    drawText(buf, 'PB', Math.round(cx - textWidth('PB') / 2), Math.round(cy - 3), C.ink);
    return;
  }
  if (icon === 'star') {
    const pts: Point[] = Array.from({ length: 10 }, (_, k) => {
      const r = k % 2 === 0 ? 5 : 2.2;
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
    });
    buf.polygon(pts, C.red);
    return;
  }
  const s = sprite(ICONS[icon], { o: C.ink, r: C.red, y: C.gold_l, W: C.white });
  buf.blit(s, Math.round(cx - s.width / 2), Math.round(cy - s.height / 2));
}
