/** Reward timing in seconds: one source of truth, like achievement-video/timeline.py. */

export const TOAST = {
  dur: 1.6,
  enter: 0.15,
  leave: 0.15,
} as const;

export const BANNER = {
  full: 4.0,
  short: 2.4,
  enter: 0.18,
  leave: 0.2,
  lettersAt: 0.1,
  letterGap: 0.032,
  shineAt: 0.62,
  shineLen: 0.35,
  /** Settled frame used when motion is reduced. */
  still: 1.2,
} as const;

export const RANKUP = {
  dur: 3.0,
  enter: 0.16,
  leave: 0.18,
  fillAt: 0.6,
  still: 1.4,
} as const;

/** Static cards shown instead of animations when motion is reduced. */
export const STILL_DUR = {
  toast: 1.6,
  banner: 3.0,
  rankup: 3.0,
  perfectWeek: 5.0,
  finale: 5.0,
} as const;

/** Tier 3: perfect week (~10 s). Windows are [start, end) in seconds. */
export const PERFECT = {
  dur: 10,
  shards: [0, 1.1],
  raysAt: 0.55,
  cutIn: [0.6, 3.2],
  banner: [3.2, 6.6],
  stats: [6.6, 9.8],
  /** Into the stats window: rows fill, then the freeze callout. */
  rowGap: 0.25,
  freezeAt: 1.8,
} as const;

/** Tier 4: season finale (~22 s). */
export const FINALE = {
  dur: 22,
  title: [0, 2.6],
  shards: [2.2, 3.4],
  hero: [2.8, 7.0],
  bannerAt: 3.2,
  ranks: [7.0, 13.0],
  rankGap: 0.9,
  numbers: [13.0, 19.4],
  numberGap: 1.2,
  iris: [19.4, 21.8],
} as const;
