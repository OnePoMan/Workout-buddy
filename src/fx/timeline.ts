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
} as const;

export const SCRIM_FADE = 0.2;
