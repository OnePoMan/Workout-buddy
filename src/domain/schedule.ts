import { addDays, weekStart, weekday } from './dates';
import type { Exercise, LogicalDay, Settings } from './types';

/** Monday … Sunday. Sunday is the rest day. */
export const WEEKLY_SCHEDULE: readonly (Exercise | null)[] = [
  'pushups',
  'pullups',
  'squats',
  'pushups',
  'pullups',
  'run',
  null,
];

export const EXERCISE_LABEL: Record<Exercise, string> = {
  pushups: 'PUSH-UPS',
  pullups: 'PULL-UPS',
  squats: 'SQUATS',
  run: 'RUN',
};

export interface Slot {
  day: LogicalDay;
  exercise: Exercise;
}

export function exerciseFor(day: LogicalDay): Exercise | null {
  return WEEKLY_SCHEDULE[weekday(day)] ?? null;
}

export function inSeason(day: LogicalDay, settings: Settings): boolean {
  return day >= settings.seasonStart && day <= settings.seasonEnd;
}

/** The scheduled slot for a day, or null for rest days and days outside the season. */
export function slotFor(day: LogicalDay, settings: Settings): Slot | null {
  const exercise = exerciseFor(day);
  if (!exercise || !inSeason(day, settings)) return null;
  return { day, exercise };
}

/** All in-season scheduled slots in the week containing `day`. */
export function weekSlots(day: LogicalDay, settings: Settings): Slot[] {
  const monday = weekStart(day);
  const slots: Slot[] = [];
  for (let i = 0; i < 7; i++) {
    const slot = slotFor(addDays(monday, i), settings);
    if (slot) slots.push(slot);
  }
  return slots;
}

export function formatTarget(exercise: Exercise, target: number): string {
  return exercise === 'run' ? `${target} MI` : `${target} ${EXERCISE_LABEL[exercise]}`;
}
