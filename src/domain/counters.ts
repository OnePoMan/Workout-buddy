import type { CounterEntry, CounterId, LogicalDay } from './types';

export interface CounterDef {
  id: CounterId;
  label: string;
  unit: string;
  defaultCap: number;
}

export const COUNTERS: readonly CounterDef[] = [
  { id: 'dr_pepper', label: 'DIET DR PEPPER', unit: 'can', defaultCap: 2 },
  { id: 'snacks', label: 'SNACKS', unit: 'item', defaultCap: 3 },
];

export const CAP_MIN = 0;
export const CAP_MAX = 20;

export function counterTotal(entries: readonly CounterEntry[], counterId: string, day: LogicalDay): number {
  let total = 0;
  for (const e of entries) {
    if (e.counterId === counterId && e.day === day) total += e.delta;
  }
  return Math.max(0, total);
}

export function dayHasEntries(entries: readonly CounterEntry[], day: LogicalDay): boolean {
  return entries.some((e) => e.day === day);
}

/** Appends a +1/-1 entry. A -1 at zero is a no-op so totals never go negative. */
export function applyCounterDelta(
  entries: readonly CounterEntry[],
  entry: CounterEntry,
): CounterEntry[] {
  if (entry.delta < 0 && counterTotal(entries, entry.counterId, entry.day) === 0) return [...entries];
  return [...entries, entry];
}
