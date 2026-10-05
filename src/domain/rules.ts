import type { Exercise } from './types';

/** Tunable game constants (SPEC §4). */

export type Stat = 'strength' | 'back' | 'legs' | 'stamina' | 'discipline';

export const STATS: readonly Stat[] = ['strength', 'back', 'legs', 'stamina', 'discipline'];

export const STAT_LABEL: Record<Stat, string> = {
  strength: 'STRENGTH',
  back: 'BACK',
  legs: 'LEGS',
  stamina: 'STAMINA',
  discipline: 'DISCIPLINE',
};

export const EXERCISE_STAT: Record<Exercise, Stat> = {
  pushups: 'strength',
  pullups: 'back',
  squats: 'legs',
  run: 'stamina',
};

/** Points for a fully completed session; partial sessions get floor(base × fraction). */
export const SESSION_POINTS: Record<Exercise, number> = {
  pushups: 10,
  pullups: 10,
  squats: 20,
  run: 20,
};

export const DISCIPLINE_POINTS = 3;
export const PB_BONUS = 5;
export const FREEZE_CAP = 2;
/** Slots a week needs to be eligible for PERFECT WEEK (partial season weeks are not). */
export const FULL_WEEK_SLOTS = 6;

/** Cumulative points for ranks 1–10. */
export const RANK_THRESHOLDS: readonly number[] = [0, 15, 35, 60, 90, 125, 165, 205, 245, 285];
export const MAX_RANK = RANK_THRESHOLDS.length;

export const STREAK_MILESTONES: readonly number[] = [6, 12, 24, 48];
export const CAP_RUN_DAYS = 7;
/** Weeks in a row at or under the eating-out limit for the HOME COOKING achievements. */
export const EAT_IN_MILESTONES: readonly number[] = [4, 8, 12];
/** Seconds per mile faster than the first run, for SPEED DEMON. */
export const MILE_IMPROVE_SEC = 30;

export function rankFor(points: number): number {
  let rank = 0;
  for (const t of RANK_THRESHOLDS) if (points >= t) rank++;
  return Math.max(1, rank);
}

/** Points needed for the next rank, or null at max rank. */
export function nextThreshold(rank: number): number | null {
  return rank >= MAX_RANK ? null : RANK_THRESHOLDS[rank]!;
}

export function sessionPoints(exercise: Exercise, fraction: number): number {
  // Epsilon guards against 0.7 × 10 = 6.999… style float error.
  return Math.floor(SESSION_POINTS[exercise] * Math.min(1, Math.max(0, fraction)) + 1e-9);
}
