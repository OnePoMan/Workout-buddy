import { isValidDay } from '../domain/dates';
import { exerciseFor } from '../domain/schedule';
import {
  MAX_REPS_PER_SET,
  SEASON_EARLIEST_START,
  isValidCap,
  isValidRolloverHour,
  isValidTarget,
} from '../domain/settings';
import {
  EXERCISES,
  SCHEMA_VERSION,
  type CounterEntry,
  type Exercise,
  type SaveFile,
  type SessionLog,
  type Settings,
} from '../domain/types';

export class MigrationError extends Error {}

type Obj = Record<string, unknown>;

/** Sanity bound on sets per session; far above any real log. */
const MAX_SETS = 1000;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function fail(path: string, why: string): never {
  throw new MigrationError(`Invalid save data at ${path}: ${why}`);
}

function str(o: Obj, key: string, path: string): string {
  const v = o[key];
  if (typeof v !== 'string' || v === '') fail(`${path}.${key}`, 'expected a non-empty string');
  return v;
}

function day(o: Obj, key: string, path: string): string {
  const v = o[key];
  if (!isValidDay(v)) fail(`${path}.${key}`, 'expected a YYYY-MM-DD date');
  return v;
}

function num(o: Obj, key: string, path: string): number {
  const v = o[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(`${path}.${key}`, 'expected a number');
  return v;
}

function optNum(o: Obj, key: string, path: string): number | undefined {
  return o[key] === undefined ? undefined : num(o, key, path);
}

function isExercise(v: unknown): v is Exercise {
  return typeof v === 'string' && (EXERCISES as readonly string[]).includes(v);
}

function parseSettings(v: unknown): Settings {
  if (!isObj(v)) fail('settings', 'expected an object');
  const p = 'settings';
  const seasonStart = day(v, 'seasonStart', p);
  const seasonEnd = day(v, 'seasonEnd', p);
  if (seasonStart > seasonEnd) fail(`${p}.seasonStart`, 'must not be after seasonEnd');
  if (seasonStart < SEASON_EARLIEST_START) fail(`${p}.seasonStart`, `must not be before ${SEASON_EARLIEST_START}`);

  const rolloverHour = num(v, 'rolloverHour', p);
  if (!isValidRolloverHour(rolloverHour)) fail(`${p}.rolloverHour`, 'expected an integer 0–23');

  if (!isObj(v.targets)) fail(`${p}.targets`, 'expected an object');
  const targets = {} as Record<Exercise, number>;
  for (const ex of EXERCISES) {
    const t = num(v.targets, ex, `${p}.targets`);
    if (!isValidTarget(ex, t)) fail(`${p}.targets.${ex}`, 'out of range');
    targets[ex] = t;
  }

  if (!isObj(v.caps)) fail(`${p}.caps`, 'expected an object');
  const caps: Record<string, number> = {};
  for (const [k, c] of Object.entries(v.caps)) {
    if (typeof c !== 'number' || !isValidCap(c)) fail(`${p}.caps.${k}`, 'expected an integer 0–20');
    caps[k] = c;
  }

  if (typeof v.sound !== 'boolean') fail(`${p}.sound`, 'expected a boolean');
  const rm = v.reduceMotion;
  if (rm !== 'system' && rm !== 'on' && rm !== 'off') fail(`${p}.reduceMotion`, 'expected system|on|off');

  const hair = v.hair;
  if (hair !== 'auto' && hair !== 'down' && hair !== 'ponytail') fail(`${p}.hair`, 'expected auto|down|ponytail');

  return { seasonStart, seasonEnd, rolloverHour, targets, caps, sound: v.sound, reduceMotion: rm, hair };
}

function parseSession(v: unknown, i: number): SessionLog {
  const p = `sessions[${i}]`;
  if (!isObj(v)) fail(p, 'expected an object');
  if (!isExercise(v.exercise)) fail(`${p}.exercise`, 'unknown exercise');
  const s: SessionLog = {
    id: str(v, 'id', p),
    slot: day(v, 'slot', p),
    loggedOn: day(v, 'loggedOn', p),
    exercise: v.exercise,
    target: num(v, 'target', p),
    updatedAt: str(v, 'updatedAt', p),
  };
  if (exerciseFor(s.slot) !== s.exercise) fail(`${p}.exercise`, `not scheduled on ${s.slot}`);
  if (v.sets !== undefined) {
    if (
      !Array.isArray(v.sets) ||
      v.sets.length > MAX_SETS ||
      !v.sets.every((n) => Number.isInteger(n) && n > 0 && n <= MAX_REPS_PER_SET)
    ) {
      fail(`${p}.sets`, `expected at most ${MAX_SETS} integers 1–${MAX_REPS_PER_SET}`);
    }
    s.sets = v.sets as number[];
  }
  if (s.target <= 0) fail(`${p}.target`, 'must be positive');
  const distance = optNum(v, 'distance', p);
  if (distance !== undefined) {
    if (distance < 0) fail(`${p}.distance`, 'must not be negative');
    s.distance = distance;
  }
  const durationSec = optNum(v, 'durationSec', p);
  if (durationSec !== undefined) {
    if (durationSec < 0) fail(`${p}.durationSec`, 'must not be negative');
    s.durationSec = durationSec;
  }
  return s;
}

function parseCounter(v: unknown, i: number): CounterEntry {
  const p = `counters[${i}]`;
  if (!isObj(v)) fail(p, 'expected an object');
  if (v.delta !== 1 && v.delta !== -1) fail(`${p}.delta`, 'expected 1 or -1');
  return {
    id: str(v, 'id', p),
    counterId: str(v, 'counterId', p),
    day: day(v, 'day', p),
    at: str(v, 'at', p),
    delta: v.delta,
  };
}

function parseCurrent(v: Obj): SaveFile {
  if (!Array.isArray(v.sessions)) fail('sessions', 'expected an array');
  if (!Array.isArray(v.counters)) fail('counters', 'expected an array');
  if (!Array.isArray(v.confirmedZeroDays) || !v.confirmedZeroDays.every(isValidDay)) {
    fail('confirmedZeroDays', 'expected an array of dates');
  }
  if (!isObj(v.seen) || !Object.values(v.seen).every((n) => Number.isInteger(n) && (n as number) >= 0)) {
    fail('seen', 'expected a map of counts');
  }
  const sessions = v.sessions.map(parseSession);
  const slots = new Set<string>();
  for (const s of sessions) {
    if (slots.has(s.slot)) fail('sessions', `duplicate slot ${s.slot}`);
    slots.add(s.slot);
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: str(v, 'createdAt', '$'),
    settings: parseSettings(v.settings),
    sessions,
    counters: v.counters.map(parseCounter),
    confirmedZeroDays: v.confirmedZeroDays as string[],
    seen: v.seen as Record<string, number>,
  };
}

/** Upgrade steps, keyed by the version they upgrade *from*. */
const STEPS: Record<number, (v: Obj) => Obj> = {
  // v2 (M6): hair setting for the ponytail unlock.
  1: (v) => ({ ...v, schemaVersion: 2, settings: isObj(v.settings) ? { ...v.settings, hair: 'auto' } : v.settings }),
};

/** Validates raw data of any known schema version and returns a current SaveFile. */
export function migrate(raw: unknown): SaveFile {
  if (!isObj(raw)) throw new MigrationError('Not a Workout Buddy save file.');
  let version = raw.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new MigrationError('Not a Workout Buddy save file (missing schemaVersion).');
  }
  if (version > SCHEMA_VERSION) {
    throw new MigrationError(
      `This file is from a newer version of Workout Buddy (schema ${version}). Update the app first.`,
    );
  }
  let data: Obj = raw;
  while (version < SCHEMA_VERSION) {
    const step = STEPS[version];
    if (!step) throw new MigrationError(`No migration from schema ${version}.`);
    data = step(data);
    version += 1;
  }
  return parseCurrent(data);
}
