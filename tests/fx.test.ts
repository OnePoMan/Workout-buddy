import { describe, expect, it } from 'vitest';
import { bannerLayout, drawBanner } from '../src/fx/banner';
import { drawRankUp } from '../src/fx/rankup';
import { fitRansom, ransomTiles } from '../src/fx/ransom';
import { isBlocking, renderReward, rewardDuration } from '../src/fx/render';
import { BANNER, RANKUP, STILL_DUR, TOAST } from '../src/fx/timeline';
import { drawToast } from '../src/fx/toast';
import type { RewardItem } from '../src/domain/rewards';
import { PixelBuffer } from '../src/pixel/buffer';
import { alpha } from '../src/pixel/color';
import { hasGlyph } from '../src/pixel/font';
import { LOCKABLE } from '../src/domain/achievements';
import { DEFAULT_OUTFIT } from '../src/pixel/sprites/character';

function opaqueCount(b: PixelBuffer): number {
  let n = 0;
  for (const c of b.data) if (alpha(c)) n++;
  return n;
}

function columnsUsed(b: PixelBuffer): [number, number] {
  let lo = b.width;
  let hi = -1;
  for (let y = 0; y < b.height; y++) {
    for (let x = 0; x < b.width; x++) {
      if (alpha(b.get(x, y))) {
        lo = Math.min(lo, x);
        hi = Math.max(hi, x);
      }
    }
  }
  return [lo, hi];
}

const banner: RewardItem = {
  kind: 'banner',
  key: 'b',
  tier: 2,
  header: 'ACHIEVEMENT UNLOCKED',
  title: 'FALL 2026 CLEAR',
  subtitle: ['MOST PUSH-UPS IN ONE SET', '30 REPS'],
  icon: 'flag',
  short: false,
  earned: [],
};

describe('ransom text', () => {
  it('lays out one tile per letter and skips spaces', () => {
    const r = ransomTiles('UP UP', { seed: 1 });
    expect(r.tiles).toHaveLength(4);
    expect(r.width).toBeGreaterThan(0);
  });

  it('is deterministic per seed and cached', () => {
    expect(ransomTiles('HELLO', { seed: 3 })).toBe(ransomTiles('HELLO', { seed: 3 }));
    const a = ransomTiles('HELLO', { seed: 3 }).tiles.map((t) => t.dy);
    const b = ransomTiles('HELLO', { seed: 4 }).tiles.map((t) => t.dy);
    expect(a).not.toEqual(b);
  });

  it('shrinks to fit narrow widths', () => {
    const wide = ransomTiles('FALL 2026 CLEAR', { seed: 11, overlap: 2 });
    const fit = fitRansom('FALL 2026 CLEAR', 150, { seed: 11, overlap: 2 });
    expect(fit.width).toBeLessThanOrEqual(150);
    expect(fit.width).toBeLessThanOrEqual(wide.width);
  });
});

describe('reward frames', () => {
  for (const w of [179, 195, 214, 240]) {
    it(`banner stays on screen once settled at ${w}px`, () => {
      const b = new PixelBuffer(w, 400);
      drawBanner(b, 1.2, { ...banner, seed: 11 }, BANNER.full);
      const [lo, hi] = columnsUsed(b);
      expect(lo).toBeGreaterThanOrEqual(0);
      expect(hi).toBeLessThan(w);
      expect(opaqueCount(b)).toBeGreaterThan(2000);
    });

    it(`rank-up and toast draw at ${w}px`, () => {
      const r = new PixelBuffer(w, 400);
      drawRankUp(r, 1.4, { label: 'DISCIPLINE', from: 2, to: 3, maxRank: 10 }, RANKUP.dur);
      expect(opaqueCount(r)).toBeGreaterThan(1500);
      const t = new PixelBuffer(w, 400);
      drawToast(t, 0.8, { title: 'PULL-UPS CLEAR!', sub: '+10 BACK', seed: 2 }, TOAST.dur);
      expect(opaqueCount(t)).toBeGreaterThan(800);
    });
  }

  it('slides in from off-screen and out again', () => {
    const at = (t: number) => {
      const b = new PixelBuffer(195, 400);
      drawBanner(b, t, { ...banner, seed: 11 }, BANNER.full);
      return columnsUsed(b)[0];
    };
    expect(at(0.01)).toBeGreaterThan(100);
    expect(at(1.2)).toBeLessThan(20);
    expect(opaqueCount((() => { const b = new PixelBuffer(195, 400); drawBanner(b, BANNER.full + 0.1, { ...banner, seed: 11 }, BANNER.full); return b; })())).toBe(0);
  });

  it('draws a still frame when motion is reduced, the same every time', () => {
    const a = new PixelBuffer(195, 400);
    const b = new PixelBuffer(195, 400);
    renderReward(a, banner, 0, true, { outfit: DEFAULT_OUTFIT });
    renderReward(b, banner, 2.5, true, { outfit: DEFAULT_OUTFIT });
    expect([...a.data]).toEqual([...b.data]);
  });

  it('times items and blocks input for all but toasts', () => {
    const toast: RewardItem = { kind: 'toast', key: 't', title: 'X', earned: [] };
    expect(isBlocking(toast)).toBe(false);
    expect(isBlocking(banner)).toBe(true);
    expect(rewardDuration(toast, false)).toBe(TOAST.dur);
    expect(rewardDuration(banner, false)).toBe(BANNER.full);
    expect(rewardDuration({ ...banner, short: true }, false)).toBe(BANNER.short);
    expect(rewardDuration(banner, true)).toBe(STILL_DUR.banner);
    expect(rewardDuration({ kind: 'more', key: 'm', count: 2, earned: [] }, false)).toBe(Infinity);
  });

  it('fits long subtitles into two lines', () => {
    const l = bannerLayout(179, 400, { ...banner, seed: 1, subtitle: ['A VERY LONG LINE THAT HAS TO WRAP AROUND SOMEWHERE', 'X'] });
    expect(l.subtitleLines).toHaveLength(2);
  });

  it('only uses characters the pixel font has', () => {
    const texts = LOCKABLE.flatMap((d) => [d.name, d.tagline]);
    for (const t of texts) for (const ch of t) expect(hasGlyph(ch), `${t}: '${ch}'`).toBe(true);
  });
});

describe('tier 3 and 4 frames', () => {
  const outfit = { hair: 'ponytail' as const, headband: true, neonShoes: true };
  const pw: RewardItem = {
    kind: 'perfectWeek',
    key: 'p',
    count: 2,
    weekPoints: { strength: 20, back: 20, legs: 20, stamina: 20, discipline: 9 },
    freezeEarned: false,
    earned: [],
  };
  const fin: RewardItem = {
    kind: 'finale',
    key: 'f',
    recap: { ranks: { strength: 9, back: 8, legs: 9, stamina: 7, discipline: 6 }, sessions: 72, perfectWeeks: 9, longestStreak: 40, bestPace: '9:10/MI', achievements: 31 },
    earned: [],
  };

  for (const w of [179, 240]) {
    it(`draw every phase at ${w}px`, () => {
      for (const [item, dur] of [
        [pw, rewardDuration(pw, false)],
        [fin, rewardDuration(fin, false)],
      ] as const) {
        // From 0.3 s: the shard wipe starts from an empty frame by design.
        for (let t = 0.3; t < dur; t += 0.7) {
          const b = new PixelBuffer(w, 420);
          renderReward(b, item, t, false, { outfit });
          expect(opaqueCount(b), `${item.kind} @${t.toFixed(2)}`).toBeGreaterThan(500);
        }
        const s = new PixelBuffer(w, 420);
        renderReward(s, item, 0, true, { outfit });
        expect(opaqueCount(s)).toBeGreaterThan(500);
      }
    });
  }

  it('closes the finale with the star iris', () => {
    const b = new PixelBuffer(195, 420);
    renderReward(b, fin, 21.7, false, { outfit });
    const black = [...b.data].filter((c) => c === 0xff120a0c).length;
    expect(black / b.data.length).toBeGreaterThan(0.9);
  });
});
