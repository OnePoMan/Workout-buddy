/** Tier 1 toast: ransom-note line on a slanted slab, with a gold sub-line. */
import { PixelBuffer } from '../pixel/buffer';
import { clamp01, easeOutBack, easeOutCubic } from '../pixel/easing';
import { C } from '../pixel/palette';
import { centredText, para, shift } from './common';
import { drawRansom, fitRansom } from './ransom';
import { TOAST } from './timeline';

export interface ToastSpec {
  title: string;
  sub?: string;
  seed: number;
}

export function drawToast(buf: PixelBuffer, tl: number, spec: ToastSpec, dur: number, still = false): void {
  if (!still && (tl < 0 || tl > dur)) return;
  const W = buf.width;
  const enter = still ? 1 : clamp01(tl / TOAST.enter);
  const leave = still ? 0 : clamp01((tl - (dur - TOAST.leave)) / TOAST.leave);
  const x = Math.round(8 - (1 - easeOutBack(enter, 1.8)) * (W + 20) + easeOutCubic(leave) * (W + 20));
  const y = 10;
  const w = W - 16;
  const h = spec.sub ? 34 : 24;
  const slab = para(x, y, x + w, y + h, 4);
  buf.polygon(shift(slab, 3, 3), C.red);
  buf.polygon(para(x - 1, y - 1, x + w + 1, y + h + 1, 4), C.white);
  buf.polygon(slab, C.black);
  const title = fitRansom(spec.title, w - 12, { seed: spec.seed, overlap: 2 });
  drawRansom(buf, title, x + Math.round(w / 2), y + 12, still ? 99 : tl - 0.05, { anchor: 'center', stagger: 0.025, pop: !still });
  if (spec.sub) centredText(buf, spec.sub, x + w / 2, y + 23, C.gold);
}
