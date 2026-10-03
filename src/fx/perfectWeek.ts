/** Tier 3 perfect-week sequence: shards, cut-in, ray burst, banner, the week's stat bars, freeze callout. */
import type { Stat } from '../domain/rules';
import { STATS, STAT_LABEL } from '../domain/rules';
import { PixelBuffer } from '../pixel/buffer';
import { clamp01, easeOutBack, easeOutCubic, prog } from '../pixel/easing';
import { drawText, textWidth } from '../pixel/font';
import { C } from '../pixel/palette';
import type { Outfit } from '../pixel/sprites/character';
import { drawBanner } from './banner';
import { outlinedText, para, shift } from './common';
import { cutIn, rays, shards } from './scenery';
import { PERFECT } from './timeline';

export interface PerfectWeekSpec {
  count: number;
  weekPoints: Record<Stat, number>;
  freezeEarned: boolean;
  outfit: Omit<Outfit, 'sway'>;
  seed: number;
  /** "NEW: HEADBAND" style line, if the week unlocked something. */
  footer: string | null;
}

/** Weekly maximum for the bar scale: 20 per exercise stat, 21 for discipline. */
const WEEK_MAX: Record<Stat, number> = { strength: 20, back: 20, legs: 20, stamina: 20, discipline: 21 };

function snowflake(buf: PixelBuffer, cx: number, cy: number): void {
  buf.line(cx - 4, cy, cx + 4, cy, C.white);
  buf.line(cx, cy - 4, cx, cy + 4, C.white);
  buf.line(cx - 3, cy - 3, cx + 3, cy + 3, C.white);
  buf.line(cx - 3, cy + 3, cx + 3, cy - 3, C.white);
}

/** Panel listing what the week added to each stat; `tl` from panel start. */
export function weekStats(buf: PixelBuffer, tl: number, dur: number, spec: PerfectWeekSpec, still: boolean): void {
  if (!still && (tl < 0 || tl > dur)) return;
  const W = buf.width;
  const enter = still ? 1 : clamp01(tl / 0.16);
  const leave = still ? 0 : clamp01((tl - (dur - 0.18)) / 0.18);
  const x0 = Math.round(8 + (1 - easeOutBack(enter, 1.6)) * (W + 10) - easeOutCubic(leave) * (W + 20));
  const y0 = Math.max(18, Math.round(buf.height * 0.2));
  const w = W - 16;
  const rowH = 13;
  const h = 22 + STATS.length * rowH + 16;
  const box = para(x0, y0, x0 + w, y0 + h, 4);
  buf.polygon(shift(box, 4, 4), C.red);
  buf.polygon(para(x0 - 2, y0 - 2, x0 + w + 2, y0 + h + 2, 4), C.white);
  buf.polygon(box, C.black);
  outlinedText(buf, 'THIS WEEK', x0 + 8, y0 + 6, C.red, C.black);

  const barX = x0 + 72;
  const barW = w - 72 - 30;
  STATS.forEach((st, i) => {
    const y = y0 + 20 + i * rowH;
    drawText(buf, STAT_LABEL[st], x0 + 8, y, C.white);
    const f = still ? 1 : easeOutCubic(prog(tl, 0.2 + i * PERFECT.rowGap, 0.5 + i * PERFECT.rowGap));
    const pts = spec.weekPoints[st];
    buf.rect(barX, y + 1, barX + barW, y + 5, C.ink);
    const fill = Math.round(barW * Math.min(1, pts / WEEK_MAX[st]) * f);
    if (fill > 0) buf.rect(barX, y + 1, barX + fill, y + 5, st === 'discipline' ? C.gold : C.top);
    const label = `+${Math.round(pts * f)}`;
    drawText(buf, label, x0 + w - 6 - textWidth(label), y, C.gold_l);
  });

  if (still || tl >= PERFECT.freezeAt) {
    const y = y0 + 20 + STATS.length * rowH + 2;
    const pop = still ? 1 : easeOutBack(clamp01((tl - PERFECT.freezeAt) / 0.2));
    if (pop > 0.3) {
      snowflake(buf, x0 + 14, y + 3);
      drawText(buf, spec.freezeEarned ? '+1 STREAK FREEZE' : 'FREEZES FULL', x0 + 24, y, C.white);
    }
  }
}

export function drawPerfectWeek(buf: PixelBuffer, t: number, spec: PerfectWeekSpec, still: boolean): void {
  const W = buf.width;
  const cx = Math.round(W / 2);
  const cy = Math.round(buf.height * 0.45);
  const banner = {
    header: 'ACHIEVEMENT UNLOCKED',
    title: 'PERFECT WEEK',
    subtitle: [spec.count > 1 ? `PERFECT WEEK NUMBER ${spec.count}` : 'ALL 6 SESSIONS DONE', ...(spec.footer ? [spec.footer] : [])],
    icon: 'week' as const,
    seed: spec.seed,
  };
  if (still) {
    rays(buf, cx, cy, 0, 1);
    drawBanner(buf, 0, banner, 1, true);
    weekStatsBelow(buf, spec);
    return;
  }
  const strength = t < PERFECT.raysAt ? 0 : easeOutCubic(prog(t, PERFECT.raysAt, PERFECT.raysAt + 0.5)) * (1 - prog(t, PERFECT.dur - 0.4, PERFECT.dur));
  rays(buf, cx, cy, t, strength);
  cutIn(buf, t - PERFECT.cutIn[0], PERFECT.cutIn[1] - PERFECT.cutIn[0], spec.outfit, 'PERFECT WEEK!', spec.seed);
  drawBanner(buf, t - PERFECT.banner[0], banner, PERFECT.banner[1] - PERFECT.banner[0]);
  weekStats(buf, t - PERFECT.stats[0], PERFECT.stats[1] - PERFECT.stats[0], spec, false);
  shards(buf, prog(t, PERFECT.shards[0], PERFECT.shards[1]), spec.seed % 7);
}

/** Reduced-motion layout: the stats panel sits lower so it does not cover the banner. */
function weekStatsBelow(buf: PixelBuffer, spec: PerfectWeekSpec): void {
  const lower = new PixelBuffer(buf.width, buf.height);
  weekStats(lower, 0, 1, spec, true);
  buf.blit(lower, 0, 92);
}
