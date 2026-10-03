/** Rank-up bar (achievement-video/ui.py stat_up()), two rows to fit a narrow overlay. */
import { PixelBuffer, type Point } from '../pixel/buffer';
import { hex } from '../pixel/color';
import { clamp01, easeOutBack, easeOutCubic } from '../pixel/easing';
import { textWidth } from '../pixel/font';
import { C } from '../pixel/palette';
import { outlinedText } from './common';
import { drawRansom, ransomTiles } from './ransom';
import { RANKUP } from './timeline';

export interface RankUpSpec {
  label: string;
  from: number;
  to: number;
  maxRank: number;
  /** Optional gold line under the bar, e.g. "NEW: PULL-UP BAR". */
  footer?: string | null;
}

const PIP_DARK = hex('5a0a18');

export function drawRankUp(buf: PixelBuffer, tl: number, spec: RankUpSpec, dur: number, still = false): void {
  if (!still && (tl < 0 || tl > dur)) return;
  const W = buf.width;
  const enter = still ? 1 : clamp01(tl / RANKUP.enter);
  const leave = still ? 0 : clamp01((tl - (dur - RANKUP.leave)) / RANKUP.leave);
  const x = Math.round(-W + easeOutBack(enter, 1.6) * (W + 6) - easeOutCubic(leave) * (W + 20));
  const y = Math.max(18, Math.round(buf.height * 0.2));
  const sw = W - 12;
  const filled = still || tl >= RANKUP.fillAt;

  buf.polygon(
    [
      [x - 4, y - 6],
      [x + sw + 4, y - 12],
      [x + sw, y + 40],
      [x - 8, y + 46],
    ],
    C.black,
  );
  buf.polygon(
    [
      [x, y - 3],
      [x + sw, y - 8],
      [x + sw - 3, y + 36],
      [x - 4, y + 42],
    ],
    C.red,
  );
  buf.polygon(
    [
      [x, y + 30],
      [x + sw - 2, y + 25],
      [x + sw - 2, y + 28],
      [x - 1, y + 33],
    ],
    C.red_d,
  );

  outlinedText(buf, spec.label, x + 4, y, C.white, C.black, 2, C.black);

  // Rank pips: one diamond per rank.
  const rank = filled ? spec.to : spec.from;
  for (let k = 0; k < spec.maxRank; k++) {
    const px = x + 8 + k * 8;
    const py = y + 24 - k * 0.3;
    const dm: Point[] = [
      [px, py - 3],
      [px + 3, py],
      [px, py + 3],
      [px - 3, py],
    ];
    buf.polygon(
      dm.map(([a, b]) => [a + 1, b + 1] as const),
      C.black,
    );
    buf.polygon(dm, k < rank ? C.gold : PIP_DARK);
    const isNew = k >= spec.from && k < spec.to;
    if (!still && isNew && tl >= RANKUP.fillAt && tl < RANKUP.fillAt + 0.12) {
      buf.polygon(
        [
          [px, py - 5],
          [px + 5, py],
          [px, py + 5],
          [px - 5, py],
        ],
        C.white,
      );
    }
  }
  const rankText = filled ? `RANK ${spec.from} > ${spec.to}` : `RANK ${spec.from}`;
  const pipsEnd = x + 8 + spec.maxRank * 8;
  outlinedText(buf, rankText, Math.min(pipsEnd + 2, x + sw - textWidth(rankText) - 6), y + 21 + 10, C.gold_l, C.black);
  if (spec.footer && filled) outlinedText(buf, spec.footer, x + 4, y + 52, C.gold, C.black);

  if (filled && leave < 1) {
    const up = ransomTiles('UP!', {
      scale: 2,
      seed: 9,
      big: false,
      styles: [
        [C.red, C.white],
        [C.white, C.black],
      ],
    });
    drawRansom(buf, up, x + sw - 6, y + 4, still ? 99 : tl - RANKUP.fillAt, { anchor: 'right', stagger: 0.05, pop: !still });
    if (!still) {
      for (let k = 0; k < 3; k++) {
        const ph = ((tl - RANKUP.fillAt) * 2.2 + k / 3) % 1;
        const ax = x + sw - 44 + k * 10;
        const ay = Math.round(y + 26 - ph * 26);
        buf.polygon(
          [
            [ax, ay - 4],
            [ax + 4, ay],
            [ax + 1, ay],
            [ax + 1, ay + 4],
            [ax - 1, ay + 4],
            [ax - 1, ay],
            [ax - 4, ay],
          ],
          k % 2 ? C.gold : C.white,
        );
      }
    }
  }
}
