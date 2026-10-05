/** "YYYY-MM-DD" after the rollover offset has been applied. */
export type LogicalDay = string;

export type Exercise = 'pushups' | 'pullups' | 'squats' | 'run';

export const EXERCISES: readonly Exercise[] = ['pushups', 'pullups', 'squats', 'run'];

export type CounterId = 'dr_pepper' | 'snacks' | 'eating_out';

export type ReduceMotion = 'system' | 'on' | 'off';

/** 'auto' switches to the ponytail as soon as it unlocks. */
export type HairSetting = 'auto' | 'down' | 'ponytail';

export interface Settings {
  seasonStart: LogicalDay;
  seasonEnd: LogicalDay;
  /** 0–23. Hours before this count toward the previous day. */
  rolloverHour: number;
  /** Reps, or miles for the run. */
  targets: Record<Exercise, number>;
  caps: Record<string, number>;
  sound: boolean;
  reduceMotion: ReduceMotion;
  hair: HairSetting;
}

export interface SessionLog {
  id: string;
  /** The scheduled day this session fulfils. */
  slot: LogicalDay;
  /** Differs from slot for make-ups. */
  loggedOn: LogicalDay;
  exercise: Exercise;
  /** Snapshot of the target when the session was first logged. */
  target: number;
  sets?: number[];
  /** Miles. Run only. */
  distance?: number;
  /** Stopwatch completion time, or run time. */
  durationSec?: number;
  updatedAt: string;
}

export interface CounterEntry {
  id: string;
  counterId: string;
  day: LogicalDay;
  /** ISO timestamp. */
  at: string;
  delta: 1 | -1;
}

export const SCHEMA_VERSION = 2;

export interface SaveFile {
  schemaVersion: typeof SCHEMA_VERSION;
  createdAt: string;
  settings: Settings;
  sessions: SessionLog[];
  counters: CounterEntry[];
  /** Days the user tapped "Nothing today". */
  confirmedZeroDays: LogicalDay[];
  /** achievementId -> times shown. */
  seen: Record<string, number>;
}
