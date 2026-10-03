import { addDays } from '../src/domain/dates';
import { exerciseFor } from '../src/domain/schedule';
import { DEFAULT_TARGETS } from '../src/domain/settings';
import type { CounterEntry, LogicalDay, SaveFile, SessionLog } from '../src/domain/types';
import { emptySave } from '../src/storage/storage';

/** Season starting Monday 2026-10-05 so weeks are full. */
export const MON = '2026-10-05';

export function save(seasonStart: LogicalDay = MON, sessions: SessionLog[] = [], counters: CounterEntry[] = []): SaveFile {
  const s = emptySave(seasonStart, new Date('2026-10-05T12:00:00Z'));
  return { ...s, settings: { ...s.settings, seasonStart }, sessions, counters };
}

interface Opts {
  loggedOn?: LogicalDay;
  fraction?: number;
  sets?: number[];
  durationSec?: number;
  distance?: number;
  target?: number;
}

/** A session for the slot on `day`; complete unless `fraction`, `sets` or `distance` say otherwise. */
export function log(day: LogicalDay, o: Opts = {}): SessionLog {
  const exercise = exerciseFor(day);
  if (!exercise) throw new Error(`${day} is a rest day`);
  const target = o.target ?? DEFAULT_TARGETS[exercise];
  const s: SessionLog = {
    id: `s-${day}`,
    slot: day,
    loggedOn: o.loggedOn ?? day,
    exercise,
    target,
    updatedAt: `${day}T12:00:00.000Z`,
  };
  if (exercise === 'run') {
    s.distance = o.distance ?? target * (o.fraction ?? 1);
  } else {
    s.sets = o.sets ?? [Math.round(target * (o.fraction ?? 1))].filter((n) => n > 0);
  }
  if (o.durationSec !== undefined) s.durationSec = o.durationSec;
  return s;
}

/** Complete sessions for every slot Mon–Sat of the week starting `monday`, except skipped weekday indexes (0 = Mon). */
export function week(monday: LogicalDay, skip: number[] = []): SessionLog[] {
  return [0, 1, 2, 3, 4, 5].filter((i) => !skip.includes(i)).map((i) => log(addDays(monday, i)));
}

export function counter(day: LogicalDay, counterId = 'dr_pepper', times = 1): CounterEntry[] {
  return Array.from({ length: times }, (_, i) => ({
    id: `c-${day}-${counterId}-${i}`,
    counterId,
    day,
    at: `${day}T15:00:00.000Z`,
    delta: 1 as const,
  }));
}
