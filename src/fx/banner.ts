/**
 * "ACHIEVEMENT UNLOCKED" banner (achievement-video/ui.py achievement()),
 * re-laid out for a ~180–240 px wide portrait overlay.
 */
import { PixelBuffer } from '../pixel/buffer';
import { alpha, over, withAlpha } from '../pixel/color';
import { clamp01, easeOutBack, easeOutCubic } from '../pixel/easing';
import { textWidth, wrapText } from '../pixel/font';
import { C } from '../pixel/palette';
import { mulberry32 } from '../pixel/rng';
import { badgeIcon, burst, centredText, outlinedText, para, shift, sparkle, type BadgeIcon } from './common';
import { drawRansom, fitRansom } from './ransom';
import { BANNER } from './timeline';

export interface BannerSpec {
  header: string;
  title: string;
  /** Up to two lines; each is wrapped to fit, and the total is capped at two. */
  subtitle: string[];
  icon: BadgeIcon;
  seed: number;
}

const SK = 6;
const MARGIN = 10;

export interface BannerLayout {
  bw: number;
  bh: number;
  by: number;
  subtitleLines: string[];
}

export function bannerLayout(w: number, h: number, spec: BannerSpec): BannerLayout {
  const bw = w - MARGIN * 2;
  const subtitleLines = spec.subtitle.flatMap((l) => wrapText(l, bw - 16)).slice(0, 2);
  const bh = 50 + subtitleLines.length * 9;
  return { bw, bh, by: Math.max(18, Math.round(h * 0.2)), subtitleLines };
}

let layerCache: PixelBuffer | null = null;
function layer(w: number, h: number): PixelBuffer {
  if (!layerCache || layerCache.width !== w || layerCache.height !== h) layerCache = new PixelBuffer(w, h);
  else layerCache.data.fill(0);
  return layerCache;
}

/**
 * Draws the banner at `tl` seconds into an animation lasting `dur`.
 * With `still`, draws the settled frame without motion, shine or sparkles.
 */
export function drawBanner(buf: PixelBuffer, tl: number, spec: BannerSpec, dur: number, still = false): void {
  if (!still && (tl < 0 || tl > dur)) return;
  const W = buf.width;
  const { bw, bh, by, subtitleLines } = bannerLayout(W, buf.height, spec);
  const enter = still ? 1 : clamp01(tl / BANNER.enter);
  const leave = still ? 0 : clamp01((tl - (dur - BANNER.leave)) / BANNER.leave);
  const bx = Math.round(MARGIN + (1 - easeOutBack(enter, 2.2)) * (W + 40) - easeOutCubic(leave) * (W + 60));

  const L = layer(W, buf.height);
  const body = para(bx, by, bx + bw, by + bh, SK);
  L.polygon(shift(body, 5, 5), C.red);
  L.polygon(para(bx - 2, by - 2, bx + bw + 2, by + bh + 2, SK), C.white);
  L.polygon(body, C.black);
  L.polygon(para(bx + 30, by + bh - 6, bx + bw - 8, by + bh - 4, 1), C.red);

  // Header to the right of the badge, which sticks out over the top-left corner.
  outlinedText(L, spec.header, bx + 32, by + 6, C.red, C.black);
  L.rect(bx + 31, by + 15, bx + 32 + textWidth(spec.header) + 8, by + 15, C.white);

  const ransom = fitRansom(spec.title, bw - 16, { seed: spec.seed, overlap: 2 });
  const titleT = still ? 99 : tl - BANNER.lettersAt;
  drawRansom(L, ransom, bx + Math.round(bw / 2), by + 29, titleT, {
    anchor: 'center',
    stagger: BANNER.letterGap,
    pop: !still,
  });
  subtitleLines.forEach((line, i) => centredText(L, line, bx + bw / 2, by + 41 + i * 9, C.gold_l));

  // Badge last so it overlaps the frame.
  const rot = still ? 0 : tl * 2;
  burst(L, bx + 10, by + 6, 13, 8, rot);
  badgeIcon(L, spec.icon, bx + 10, by + 6);

  if (!still && tl >= BANNER.shineAt) shine(L, tl, bx, by, bw, bh);

  buf.blit(L, 0, 0);

  if (!still && tl > BANNER.shineAt + 0.1 && leave < 1) {
    const rnd = mulberry32(77);
    for (let k = 0; k < 10; k++) {
      const st = BANNER.shineAt + 0.1 + rnd() * 1.4;
      const x = bx + rnd() * (bw + 20) - 10;
      const y = by + rnd() * (bh + 20) - 10;
      const ph = (tl - st) / 0.45;
      if (ph >= 0 && ph <= 1) sparkle(buf, x, y, 1 + 2 * Math.sin(ph * Math.PI), k % 2 ? C.gold_l : C.white);
    }
  }
}

/** Diagonal white glint sweeping across opaque pixels of the banner layer. */
function shine(L: PixelBuffer, tl: number, bx: number, by: number, bw: number, bh: number): void {
  const sp = clamp01((tl - BANNER.shineAt) / BANNER.shineLen);
  const sx = bx - 30 + sp * (bw + 60);
  const top = by - 4;
  const slope = 24 / (bh + 8);
  for (let y = top; y <= by + bh + 4; y++) {
    for (let x = Math.floor(sx - 30); x <= Math.ceil(sx + 24); x++) {
      const u = x - sx + (y - top) * slope;
      const a = u >= 0 && u < 10 ? 170 : u >= 14 && u < 17 ? 120 : 0;
      if (!a) continue;
      const c = L.get(x, y);
      if (alpha(c) === 0) continue;
      L.set(x, y, over(c, withAlpha(C.white, a)));
    }
  }
}
