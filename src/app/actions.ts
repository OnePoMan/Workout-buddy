import { markSeen, type Earned } from '../domain/achievements';
import { applyCounterDelta, counterTotal } from '../domain/counters';
import { newId } from '../domain/ids';
import { removeSession, upsertSession } from '../domain/sessions';
import type { LogicalDay, SaveFile, SessionLog, Settings } from '../domain/types';
import { emptySave } from '../storage/storage';
import type { Store } from '../storage/store';

export function saveSession(store: Store, session: SessionLog): void {
  store.update((s) => ({ ...s, sessions: upsertSession(s.sessions, session) }));
}

export function deleteSession(store: Store, slotDay: LogicalDay): void {
  store.update((s) => ({ ...s, sessions: removeSession(s.sessions, slotDay) }));
}

export function changeCounter(store: Store, counterId: string, day: LogicalDay, delta: 1 | -1): void {
  store.update((s) => {
    if (delta < 0 && counterTotal(s.counters, counterId, day) === 0) return s;
    const entry = { id: newId(), counterId, day, at: new Date().toISOString(), delta };
    return { ...s, counters: applyCounterDelta(s.counters, entry) };
  });
}

export function toggleNothingToday(store: Store, day: LogicalDay): void {
  store.update((s) => ({
    ...s,
    confirmedZeroDays: s.confirmedZeroDays.includes(day)
      ? s.confirmedZeroDays.filter((d) => d !== day)
      : [...s.confirmedZeroDays, day],
  }));
}

export function updateSettings(store: Store, patch: Partial<Settings>): void {
  store.update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

export function replaceAll(store: Store, save: SaveFile): void {
  store.update(() => save);
}

export function resetAll(store: Store, today: LogicalDay): void {
  store.update(() => emptySave(today, new Date()));
}

export function markEarnedSeen(store: Store, earned: Earned[]): void {
  store.update((s) => ({ ...s, seen: markSeen(s.seen, earned) }));
}
