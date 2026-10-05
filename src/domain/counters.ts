import { sameWeek } from './dates';
import type { CounterEntry, CounterId, LogicalDay } from './types';

export interface CounterDef {
  id: CounterId;
  label: string;
  unit: string;
  defaultCap: number;
}

/** Daily soft caps: totals reset at each day's rollover. */
export const COUNTERS: readonly CounterDef[] = [
  { id: 'dr_pepper', label: 'DIET DR PEPPER', unit: 'can', defaultCap: 2 },
  { id: 'snacks', label: 'SNACKS', unit: 'item', defaultCap: 3 },
];

export const EATING_OUT: CounterDef = { id: 'eating_out', label: 'EATING OUT', unit: 'meal', defaultCap: 1 };

/** Weekly limits: totals run Monday–Sunday and reset at Monday's rollover. */
export const WEEKLY_COUNTERS: readonly CounterDef[] = [EATING_OUT];

export function isWeeklyCounter(counterId: string): boolean {
  return WEEKLY_COUNTERS.some((c) => c.id === counterId);
}

export const CAP_MIN = 0;
export const CAP_MAX = 20;

export function counterTotal(entries: readonly CounterEntry[], counterId: string, day: LogicalDay): number {
  let total = 0;
  for (const e of entries) {
    if (e.counterId === counterId && e.day === day) total += e.delta;
  }
  return Math.max(0, total);
}

/** Total for the Monday–Sunday week containing `day`. */
export function weekTotal(entries: readonly CounterEntry[], counterId: string, day: LogicalDay): number {
  let total = 0;
  for (const e of entries) {
    if (e.counterId === counterId && sameWeek(e.day, day)) total += e.delta;
  }
  return Math.max(0, total);
}

/** The running total a counter is capped on: per day, or per week for weekly counters. */
export function periodTotal(entries: readonly CounterEntry[], counterId: string, day: LogicalDay): number {
  return isWeeklyCounter(counterId) ? weekTotal(entries, counterId, day) : counterTotal(entries, counterId, day);
}

/** Whether any daily counter has entries on `day` (weekly counters don't count toward "Nothing today"). */
export function dayHasEntries(entries: readonly CounterEntry[], day: LogicalDay): boolean {
  return entries.some((e) => e.day === day && !isWeeklyCounter(e.counterId));
}

/** Appends a +1/-1 entry. A -1 at zero is a no-op so totals never go negative. */
export function applyCounterDelta(
  entries: readonly CounterEntry[],
  entry: CounterEntry,
): CounterEntry[] {
  if (entry.delta < 0 && periodTotal(entries, entry.counterId, entry.day) === 0) return [...entries];
  return [...entries, entry];
}

const byTime = (a: CounterEntry, b: CounterEntry) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0);

/** Today's entries for one counter, oldest first. */
export function counterEntries(entries: readonly CounterEntry[], counterId: string, day: LogicalDay): CounterEntry[] {
  return entries.filter((e) => e.counterId === counterId && e.day === day).sort(byTime);
}

/** Entries for one counter in the week containing `day`, oldest first. */
export function weekCounterEntries(entries: readonly CounterEntry[], counterId: string, day: LogicalDay): CounterEntry[] {
  return entries.filter((e) => e.counterId === counterId && sameWeek(e.day, day)).sort(byTime);
}

/** Removes one entry by id (undo). */
export function removeCounterEntry(entries: readonly CounterEntry[], id: string): CounterEntry[] {
  return entries.filter((e) => e.id !== id);
}
