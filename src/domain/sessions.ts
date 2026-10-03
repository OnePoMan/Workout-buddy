import { sameWeek } from './dates';
import { weekSlots, type Slot } from './schedule';
import type { LogicalDay, SessionLog, Settings } from './types';

export function totalReps(sets: readonly number[] | undefined): number {
  return (sets ?? []).reduce((a, b) => a + b, 0);
}

/** 0–1. Reps (or miles) done over the session's own target snapshot. */
export function completionFraction(session: SessionLog | undefined): number {
  if (!session || session.target <= 0) return 0;
  const done = session.exercise === 'run' ? (session.distance ?? 0) : totalReps(session.sets);
  return Math.min(1, done / session.target);
}

export function isComplete(session: SessionLog | undefined): boolean {
  return completionFraction(session) >= 1;
}

export function findSession(sessions: readonly SessionLog[], slotDay: LogicalDay): SessionLog | undefined {
  return sessions.find((s) => s.slot === slotDay);
}

/** One session per slot: replaces any existing log for the same slot. */
export function upsertSession(sessions: readonly SessionLog[], session: SessionLog): SessionLog[] {
  return [...sessions.filter((s) => s.slot !== session.slot), session];
}

export function removeSession(sessions: readonly SessionLog[], slotDay: LogicalDay): SessionLog[] {
  return sessions.filter((s) => s.slot !== slotDay);
}

/** A slot can be logged or edited from its own day until its week ends. */
export function isEditable(slotDay: LogicalDay, today: LogicalDay): boolean {
  return slotDay <= today && sameWeek(slotDay, today);
}

/** Earlier slots this week that have not reached their target yet. */
export function pendingMakeups(today: LogicalDay, settings: Settings, sessions: readonly SessionLog[]): Slot[] {
  return weekSlots(today, settings).filter(
    (slot) => slot.day < today && !isComplete(findSession(sessions, slot.day)),
  );
}

/** Target to snapshot: an existing log keeps its own, a new log takes the current setting. */
export function targetFor(slot: Slot, existing: SessionLog | undefined, settings: Settings): number {
  return existing ? existing.target : settings.targets[slot.exercise];
}

/** Same logged content, ignoring id and timestamps. */
export function sameContent(a: SessionLog, b: SessionLog): boolean {
  const setsA = a.sets ?? [];
  const setsB = b.sets ?? [];
  return (
    a.slot === b.slot &&
    a.exercise === b.exercise &&
    a.target === b.target &&
    a.distance === b.distance &&
    a.durationSec === b.durationSec &&
    setsA.length === setsB.length &&
    setsA.every((n, i) => n === setsB[i])
  );
}
