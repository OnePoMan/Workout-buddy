import { CAP_MAX, CAP_MIN, COUNTERS } from './counters';
import type { Exercise, LogicalDay, Settings } from './types';

export const SEASON_END: LogicalDay = '2026-12-31';

/** Earliest allowed season start. Bounds the day-by-day replay in the rules engine. */
export const SEASON_EARLIEST_START: LogicalDay = '2026-01-01';

/** Upper bound for a single strength set. */
export const MAX_REPS_PER_SET = 500;

export const DEFAULT_ROLLOVER_HOUR = 3;

export const DEFAULT_TARGETS: Record<Exercise, number> = {
  pushups: 30,
  pullups: 30,
  squats: 60,
  run: 1,
};

/** Inclusive bounds per exercise. Run is in miles. */
export const TARGET_LIMITS: Record<Exercise, { min: number; max: number; step: number }> = {
  pushups: { min: 1, max: 500, step: 1 },
  pullups: { min: 1, max: 500, step: 1 },
  squats: { min: 1, max: 500, step: 1 },
  run: { min: 0.1, max: 26.2, step: 0.1 },
};

export function defaultSettings(today: LogicalDay): Settings {
  return {
    seasonStart: today <= SEASON_END ? today : SEASON_END,
    seasonEnd: SEASON_END,
    rolloverHour: DEFAULT_ROLLOVER_HOUR,
    targets: { ...DEFAULT_TARGETS },
    caps: Object.fromEntries(COUNTERS.map((c) => [c.id, c.defaultCap])),
    sound: false,
    reduceMotion: 'system',
  };
}

export function isValidTarget(exercise: Exercise, value: number): boolean {
  const { min, max } = TARGET_LIMITS[exercise];
  if (!Number.isFinite(value) || value < min || value > max) return false;
  return exercise === 'run' ? Math.abs(value * 10 - Math.round(value * 10)) < 1e-9 : Number.isInteger(value);
}

export function isValidCap(value: number): boolean {
  return Number.isInteger(value) && value >= CAP_MIN && value <= CAP_MAX;
}

export function isValidRolloverHour(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 23;
}
