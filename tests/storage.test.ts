import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, type SaveFile } from '../src/domain/types';
import { parseImport, serialize } from '../src/storage/exportImport';
import { MigrationError, migrate } from '../src/storage/migrate';
import { STORAGE_KEY, emptySave, load, persist, type KeyValueStore } from '../src/storage/storage';
import { createStore } from '../src/storage/store';

const NOW = new Date('2026-10-03T15:00:00Z');

class MemoryStore implements KeyValueStore {
  data = new Map<string, string>();
  failWrites = false;
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.failWrites) throw new Error('QuotaExceededError');
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

function sample(): SaveFile {
  const s = emptySave('2026-10-03', NOW);
  s.sessions.push({
    id: 'a',
    slot: '2026-10-03',
    loggedOn: '2026-10-03',
    exercise: 'run',
    target: 1,
    distance: 1,
    durationSec: 540,
    updatedAt: NOW.toISOString(),
  });
  s.counters.push({ id: 'c', counterId: 'dr_pepper', day: '2026-10-03', at: NOW.toISOString(), delta: 1 });
  s.confirmedZeroDays.push('2026-10-02');
  return s;
}

describe('emptySave', () => {
  it('starts the season on the first launch day with default settings', () => {
    const s = emptySave('2026-10-03', NOW);
    expect(s.schemaVersion).toBe(SCHEMA_VERSION);
    expect(s.settings.seasonStart).toBe('2026-10-03');
    expect(s.settings.seasonEnd).toBe('2026-12-31');
    expect(s.settings.rolloverHour).toBe(3);
    expect(s.settings.targets).toEqual({ pushups: 30, pullups: 30, squats: 60, run: 1 });
    expect(s.settings.caps).toEqual({ dr_pepper: 2, eating_out: 1 });
    expect(s.settings.sound).toBe(false);
  });
});

describe('migrate', () => {
  it('round-trips a valid save', () => {
    const s = sample();
    expect(migrate(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it('refuses files from a newer schema', () => {
    expect(() => migrate({ ...sample(), schemaVersion: SCHEMA_VERSION + 1 })).toThrow(/newer version/);
  });

  it('refuses non-save data', () => {
    expect(() => migrate(null)).toThrow(MigrationError);
    expect(() => migrate({ hello: 1 })).toThrow(/schemaVersion/);
    expect(() => migrate([])).toThrow(MigrationError);
  });

  it('reports the failing field', () => {
    const bad = JSON.parse(JSON.stringify(sample()));
    bad.settings.targets.squats = -5;
    expect(() => migrate(bad)).toThrow(/settings\.targets\.squats/);
    const bad2 = JSON.parse(JSON.stringify(sample()));
    bad2.sessions[0].slot = '2026-13-01';
    expect(() => migrate(bad2)).toThrow(/sessions\[0\]\.slot/);
  });

  it('rejects duplicate slots', () => {
    const s = sample();
    s.sessions.push({ ...s.sessions[0]!, id: 'b' });
    expect(() => migrate(JSON.parse(JSON.stringify(s)))).toThrow(/duplicate slot/);
  });

  it('rejects a session whose exercise is not scheduled on its slot', () => {
    const bad = JSON.parse(JSON.stringify(sample()));
    bad.sessions[0].exercise = 'pushups';
    bad.sessions[0].sets = [30];
    expect(() => migrate(bad)).toThrow(/sessions\[0\]\.exercise/);
  });

  it('rejects out-of-range or oversized set lists', () => {
    const strength = (sets: number[]) => {
      const s = JSON.parse(JSON.stringify(sample()));
      s.sessions[0] = { ...s.sessions[0], slot: '2026-10-05', loggedOn: '2026-10-05', exercise: 'pushups', target: 30, sets };
      delete s.sessions[0].distance;
      return s;
    };
    expect(() => migrate(strength([30]))).not.toThrow();
    expect(() => migrate(strength([501]))).toThrow(/sessions\[0\]\.sets/);
    expect(() => migrate(strength(Array.from({ length: 1001 }, () => 1)))).toThrow(/sessions\[0\]\.sets/);
  });

  it('rejects a season start before the earliest allowed date', () => {
    const bad = JSON.parse(JSON.stringify(sample()));
    bad.settings.seasonStart = '1901-01-01';
    expect(() => migrate(bad)).toThrow(/settings\.seasonStart/);
  });
});

describe('load / persist', () => {
  it('returns a new save when nothing is stored', () => {
    const r = load(new MemoryStore(), '2026-10-03', NOW);
    expect(r.status.kind).toBe('new');
  });

  it('loads what was persisted', () => {
    const kv = new MemoryStore();
    expect(persist(kv, sample())).toBe(true);
    const r = load(kv, '2026-10-05', NOW);
    expect(r.status.kind).toBe('ok');
    expect(r.save).toEqual(sample());
  });

  it('backs up unreadable data instead of overwriting it', () => {
    const kv = new MemoryStore();
    kv.setItem(STORAGE_KEY, '{not json');
    const r = load(kv, '2026-10-03', NOW);
    expect(r.status.kind).toBe('recovered');
    if (r.status.kind !== 'recovered') return;
    expect(kv.getItem(r.status.backupKey)).toBe('{not json');
  });

  it('reports unavailable storage', () => {
    expect(load(null, '2026-10-03', NOW).status.kind).toBe('unavailable');
    const kv = new MemoryStore();
    kv.failWrites = true;
    expect(persist(kv, sample())).toBe(false);
  });
});

describe('store', () => {
  it('persists each update and tracks write failures', () => {
    const kv = new MemoryStore();
    const store = createStore(sample(), (s) => persist(kv, s));
    let calls = 0;
    store.subscribe(() => calls++);
    store.update((s) => ({ ...s, confirmedZeroDays: [] }));
    expect(calls).toBe(1);
    expect(JSON.parse(kv.getItem(STORAGE_KEY)!).confirmedZeroDays).toEqual([]);
    kv.failWrites = true;
    store.update((s) => ({ ...s, seen: { x: 1 } }));
    expect(store.isPersisting()).toBe(false);
    store.update((s) => s);
    expect(calls).toBe(2);
  });
});

describe('export / import', () => {
  it('round-trips through serialize and parseImport', () => {
    expect(parseImport(serialize(sample()))).toEqual(sample());
  });

  it('gives a readable error for non-JSON', () => {
    expect(() => parseImport('nope')).toThrow('That file is not valid JSON.');
  });
});

describe('migration v1 -> v2', () => {
  it('adds the hair setting to v1 saves', () => {
    const v1 = JSON.parse(JSON.stringify(sample()));
    v1.schemaVersion = 1;
    delete v1.settings.hair;
    const m = migrate(v1);
    expect(m.schemaVersion).toBe(2);
    expect(m.settings.hair).toBe('auto');
    expect(m.sessions).toEqual(sample().sessions);
  });

  it('rejects an unknown hair value', () => {
    const bad = JSON.parse(JSON.stringify(sample()));
    bad.settings.hair = 'mohawk';
    expect(() => migrate(bad)).toThrow(/settings\.hair/);
  });
});
