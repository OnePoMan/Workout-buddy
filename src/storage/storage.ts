import { defaultSettings } from '../domain/settings';
import { SCHEMA_VERSION, type LogicalDay, type SaveFile } from '../domain/types';
import { MigrationError, migrate } from './migrate';

export const STORAGE_KEY = 'workout-buddy';

/** The subset of Web Storage used here, so tests can pass an in-memory fake. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type LoadStatus =
  | { kind: 'ok' }
  | { kind: 'new' }
  | { kind: 'unavailable' }
  | { kind: 'recovered'; backupKey: string; reason: string };

export interface LoadResult {
  save: SaveFile;
  status: LoadStatus;
}

export function emptySave(today: LogicalDay, now: Date): SaveFile {
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: now.toISOString(),
    settings: defaultSettings(today),
    sessions: [],
    counters: [],
    confirmedZeroDays: [],
    seen: {},
  };
}

/** Returns window.localStorage if it can actually be written, otherwise null. */
export function browserStore(): KeyValueStore | null {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    const probe = `${STORAGE_KEY}.probe`;
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}

/**
 * Loads the save. Unreadable data is never overwritten: it is copied to a
 * backup key first, and the app starts from an empty save.
 */
export function load(kv: KeyValueStore | null, today: LogicalDay, now: Date): LoadResult {
  if (!kv) return { save: emptySave(today, now), status: { kind: 'unavailable' } };
  let raw: string | null;
  try {
    raw = kv.getItem(STORAGE_KEY);
  } catch {
    return { save: emptySave(today, now), status: { kind: 'unavailable' } };
  }
  if (raw === null) return { save: emptySave(today, now), status: { kind: 'new' } };
  try {
    return { save: migrate(JSON.parse(raw)), status: { kind: 'ok' } };
  } catch (err) {
    const reason = err instanceof MigrationError ? err.message : 'Saved data is not valid JSON.';
    const backupKey = `${STORAGE_KEY}.backup-${now.getTime()}`;
    try {
      kv.setItem(backupKey, raw);
    } catch {
      return { save: emptySave(today, now), status: { kind: 'unavailable' } };
    }
    return { save: emptySave(today, now), status: { kind: 'recovered', backupKey, reason } };
  }
}

/** Returns false if the write failed (quota, private mode, blocked storage). */
export function persist(kv: KeyValueStore | null, save: SaveFile): boolean {
  if (!kv) return false;
  try {
    kv.setItem(STORAGE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}
