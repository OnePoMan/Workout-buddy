/** Tier 4 season finale: title card, shards, hero shot over rays, final ranks, season numbers, star iris. */
import type { SeasonRecap } from '../domain/rewards';
import { MAX_RANK, STATS, STAT_LABEL } from '../domain/rules';
import type { PixelBuffer } from '../pixel/buffer';
import { clamp01, easeOutBack, prog } from '../pixel/easing';
import { drawText } from '../pixel/font';
import { C } from '../pixel/palette';
import { renderCharacter, stand, type Outfit } from '../pixel/sprites/character';
import { drawBanner } from './banner';
import { centredText, outlinedText, para, shift } from './common';
import { drawRansom, fitRansom } from './ransom';
import { iris, rays, shards, titleCard } from './scenery';
import { FINALE } from './timeline';

export interface FinaleSpec {
  recap: SeasonRecap;
  outfit: Omit<Outfit, 'sway'>;
  seed: number;
}

export function finaleNumbers(recap: SeasonRecap): [string, string][] {
  const rows: [string, string][] = [
    ['SESSIONS', String(recap.sessions)],
    ['PERFECT WEEKS', String(recap.perfectWeeks)],
    ['LONGEST STREAK', String(recap.longestStreak)],
  ];
  if (recap.bestPace) rows.push(['BEST MILE PACE', recap.bestPace]);
  return rows;
}

function panel(buf: PixelBuffer, y0: number, h: number, title: string): number {
  const x0 = 8;
  const w = buf.width - 16;
  const box = para(x0, y0, x0 + w, y0 + h, 4);
  buf.polygon(shift(box, 4, 4), C.red);
  buf.polygon(para(x0 - 2, y0 - 2, x0 + w + 2, y0 + h + 2, 4), C.white);
  buf.polygon(box, C.black);
  outlinedText(buf, title, x0 + 8, y0 + 6, C.red, C.black);
  return x0;
}

function ranksPanel(buf: PixelBuffer, tl: number, recap: SeasonRecap, still: boolean): void {
  const y0 = Math.round(buf.height * 0.2);
  const x0 = panel(buf, y0, 22 + STATS.length * 14, 'FINAL RANKS');
  STATS.forEach((st, i) => {
    const y = y0 + 20 + i * 14;
    const start = 0.3 + i * FINALE.rankGap;
    if (!still && tl < start) return;
    drawText(buf, STAT_LABEL[st], x0 + 8, y, C.white);
    const shown = still ? recap.ranks[st] : Math.min(recap.ranks[st], Math.floor((tl - start) / 0.06) + 1);
    for (let k = 0; k < MAX_RANK; k++) {
      const px = x0 + 80 + k * 8;
      const py = y + 3;
      buf.polygon(
        [
          [px, py - 3],
          [px + 3, py],
          [px, py + 3],
          [px - 3, py],
        ],
        k < shown ? C.gold : C.red_d,
      );
    }
  });
}

function numbersPanel(buf: PixelBuffer, tl: number, recap: SeasonRecap, still: boolean, seed: number): void {
  const rows = finaleNumbers(recap);
  const y0 = Math.round(buf.height * 0.2);
  const rowH = 38;
  panel(buf, y0, 22 + rows.length * rowH, 'FALL 2026');
  rows.forEach(([label, value], i) => {
    const at = 0.2 + i * FINALE.numberGap;
    if (!still && tl < at) return;
    const y = y0 + 20 + i * rowH;
    centredText(buf, label, buf.width / 2, y, C.gold_l);
    // Scale-2 tiles are ~22 px tall: centre them well below the label.
    const r = fitRansom(value, buf.width - 40, { seed: seed + i, scale: 2, big: false });
    drawRansom(buf, r, Math.round(buf.width / 2), y + 22, still ? 99 : tl - at - 0.1, { anchor: 'center', stagger: 0.04, pop: !still });
  });
}

export function drawFinale(buf: PixelBuffer, t: number, spec: FinaleSpec, still: boolean): void {
  const W = buf.width;
  const H = buf.height;
  const cx = Math.round(W / 2);
  const cy = Math.round(H * 0.45);
  const banner = {
    header: 'ACHIEVEMENT UNLOCKED',
    title: 'FALL 2026 CLEAR',
    subtitle: ['SEE YOU NEXT SEASON', 'NEW: SEASON MEDAL'],
    icon: 'flag' as const,
    seed: spec.seed,
  };
  if (still) {
    rays(buf, cx, cy, 0, 1);
    drawBanner(buf, 0, banner, 1, true);
    return;
  }
  if (t < FINALE.title[1]) {
    const slash = titleCard(buf, t);
    const big = fitRansom('FALL 2026', W - 16, { seed: spec.seed, scale: 3, big: false });
    drawRansom(buf, big, cx, slash - 10, t - 0.2, { anchor: 'center', stagger: 0.07 });
    const small = fitRansom('SEASON COMPLETE', W - 16, { seed: spec.seed + 1 });
    drawRansom(buf, small, cx, slash + 22, t - 1.0, { anchor: 'center', stagger: 0.05 });
  }
  if (t >= FINALE.hero[0] && t < FINALE.iris[1]) rays(buf, cx, cy, t, clamp01((t - FINALE.hero[0]) / 0.5));
  if (t >= FINALE.hero[0] && t < FINALE.hero[1]) {
    const hop = Math.round(Math.abs(Math.sin((t - FINALE.hero[0]) * 4)) * 6);
    const hero = renderCharacter(stand(0, 'happy', { outfit: { ...spec.outfit, sway: Math.round(Math.sin(t * 6)) } })).scaled(2);
    const enter = easeOutBack(clamp01((t - FINALE.hero[0]) / 0.4));
    buf.blit(hero, cx - hero.width / 2, Math.round(H - hero.height - 10 - hop + (1 - enter) * 80));
    drawBanner(buf, t - FINALE.bannerAt, banner, FINALE.hero[1] - FINALE.bannerAt);
  }
  if (t >= FINALE.ranks[0] && t < FINALE.ranks[1]) ranksPanel(buf, t - FINALE.ranks[0], spec.recap, false);
  if (t >= FINALE.numbers[0] && t < FINALE.iris[1]) numbersPanel(buf, t - FINALE.numbers[0], spec.recap, false, spec.seed);
  shards(buf, prog(t, FINALE.shards[0], FINALE.shards[1]), spec.seed % 5);
  iris(buf, prog(t, FINALE.iris[0], FINALE.iris[1] - 0.2), cx, cy);
}
