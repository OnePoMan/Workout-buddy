import { COUNTERS } from './counters';
import { addDays, weekStart } from './dates';
import {
  DISCIPLINE_POINTS,
  EXERCISE_STAT,
  FREEZE_CAP,
  FULL_WEEK_SLOTS,
  PB_BONUS,
  STATS,
  nextThreshold,
  rankFor,
  sessionPoints,
  type Stat,
} from './rules';
import { weekSlots } from './schedule';
import { completionFraction, totalReps } from './sessions';
import type { Exercise, LogicalDay, SaveFile, SessionLog } from './types';

export type SlotState = 'done' | 'pending' | 'missed' | 'frozen' | 'future';

export interface SlotStatus {
  day: LogicalDay;
  exercise: Exercise;
  fraction: number;
  state: SlotState;
}

export interface WeekStatus {
  start: LogicalDay;
  slots: SlotStatus[];
  /** Week has passed (or the season is over); misses are final. */
  ended: boolean;
  /** Has all FULL_WEEK_SLOTS slots in season. */
  eligible: boolean;
  perfect: boolean;
  /** Day the last session needed for PERFECT WEEK was logged. */
  perfectOn?: LogicalDay;
  freezesUsed: number;
}

export type PbKind = 'set' | 'time' | 'pace';

export interface PbEvent {
  /** e.g. "pushups_set", "pushups_time@30", "run_pace@1". */
  metric: string;
  kind: PbKind;
  exercise: Exercise;
  /** The session's target; time and pace records are kept per target. */
  target: number;
  /** Reps for 'set'; seconds for 'time'; seconds per mile for 'pace'. */
  value: number;
  /** Null for the baseline (first value). */
  previous: number | null;
  day: LogicalDay;
  sessionId: string;
  /** Run time in seconds, for 'pace'. */
  timeSec?: number;
}

export interface StatStatus {
  points: number;
  rank: number;
  /** Points needed for the next rank, or null at max rank. */
  next: number | null;
}

export interface Snapshot {
  asOf: LogicalDay;
  weeks: WeekStatus[];
  streak: number;
  longestStreak: number;
  freezesBanked: number;
  freezesUsed: number;
  perfectWeeks: number;
  perfectWeekRun: number;
  longestPerfectWeekRun: number;
  completedSessions: number;
  completedByExercise: Record<Exercise, number>;
  stats: Record<Stat, StatStatus>;
  /** Current best per metric (the latest event for it). */
  bests: Record<string, PbEvent>;
  /** Every baseline and record, in the order they were set. */
  pbEvents: PbEvent[];
  disciplineDays: LogicalDay[];
  disciplineRun: number;
  longestDisciplineRun: number;
}

/** Sessions that count: slot inside the season and logged on or before `asOf`. */
function countedSessions(save: SaveFile, asOf: LogicalDay): SessionLog[] {
  const { seasonStart, seasonEnd } = save.settings;
  return save.sessions
    .filter((s) => s.slot >= seasonStart && s.slot <= seasonEnd && s.loggedOn <= asOf)
    .sort((a, b) => (a.loggedOn === b.loggedOn ? cmp(a.slot, b.slot) : cmp(a.loggedOn, b.loggedOn)));
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function walkWeeks(save: SaveFile, asOf: LogicalDay, byslot: Map<LogicalDay, SessionLog>) {
  const { settings } = save;
  const weeks: WeekStatus[] = [];
  let banked = 0;
  let used = 0;
  let streak = 0;
  let longest = 0;
  let perfectRun = 0;
  let longestPerfectRun = 0;

  const lastDay = asOf < settings.seasonEnd ? asOf : settings.seasonEnd;
  const seasonOver = asOf > settings.seasonEnd;
  if (lastDay < settings.seasonStart) {
    return { weeks, banked, used, streak, longest, perfectRun, longestPerfectRun };
  }

  for (let w = weekStart(settings.seasonStart); w <= lastDay; w = addDays(w, 7)) {
    const slots = weekSlots(w, settings);
    const ended = seasonOver || asOf >= addDays(w, 7);
    const fractions = slots.map((s) => completionFraction(byslot.get(s.day)));

    // Week end: banked freezes cover this week's misses, oldest first.
    const missIdx = ended ? fractions.flatMap((f, i) => (f < 1 ? [i] : [])) : [];
    const frozen = new Set(missIdx.slice(0, banked));
    banked -= frozen.size;
    used += frozen.size;

    const statuses: SlotStatus[] = slots.map((slot, i) => {
      const fraction = fractions[i]!;
      let state: SlotState;
      if (slot.day > asOf) state = 'future';
      else if (fraction >= 1) {
        state = 'done';
        streak++;
        longest = Math.max(longest, streak);
      } else if (!ended) state = 'pending';
      else if (frozen.has(i)) state = 'frozen';
      else {
        state = 'missed';
        streak = 0;
      }
      return { day: slot.day, exercise: slot.exercise, fraction, state };
    });

    const eligible = slots.length === FULL_WEEK_SLOTS;
    const perfect = eligible && fractions.every((f) => f >= 1);
    const week: WeekStatus = { start: w, slots: statuses, ended, eligible, perfect, freezesUsed: frozen.size };
    if (perfect) {
      week.perfectOn = slots.map((s) => byslot.get(s.day)!.loggedOn).sort().at(-1);
      banked = Math.min(FREEZE_CAP, banked + 1);
    }
    if (eligible) {
      if (perfect) {
        perfectRun++;
        longestPerfectRun = Math.max(longestPerfectRun, perfectRun);
      } else if (ended) {
        perfectRun = 0;
      }
    }
    weeks.push(week);
  }
  return { weeks, banked, used, streak, longest, perfectRun, longestPerfectRun };
}

function personalBests(sessions: readonly SessionLog[]): { events: PbEvent[]; bests: Record<string, PbEvent> } {
  const bests: Record<string, PbEvent> = {};
  const events: PbEvent[] = [];
  const consider = (s: SessionLog, kind: PbKind, value: number, lowerIsBetter: boolean, extra?: Partial<PbEvent>) => {
    const metric = kind === 'set' ? `${s.exercise}_set` : `${s.exercise}_${kind}@${s.target}`;
    const prev = bests[metric];
    if (prev && (lowerIsBetter ? value >= prev.value : value <= prev.value)) return;
    const ev: PbEvent = {
      metric,
      kind,
      exercise: s.exercise,
      target: s.target,
      value,
      previous: prev ? prev.value : null,
      day: s.loggedOn,
      sessionId: s.id,
      ...extra,
    };
    bests[metric] = ev;
    events.push(ev);
  };

  for (const s of sessions) {
    if (s.exercise === 'run') {
      const distance = s.distance ?? 0;
      if (s.durationSec && s.durationSec > 0 && distance >= s.target) {
        consider(s, 'pace', Math.round((s.durationSec / distance) * 10) / 10, true, { timeSec: s.durationSec });
      }
    } else {
      const sets = s.sets ?? [];
      if (sets.length > 0) consider(s, 'set', sets.reduce((a, b) => Math.max(a, b)), false);
      if (s.durationSec && s.durationSec > 0 && totalReps(sets) >= s.target) {
        consider(s, 'time', s.durationSec, true);
      }
    }
  }
  return { events, bests };
}

function discipline(save: SaveFile, asOf: LogicalDay) {
  const { settings, counters, confirmedZeroDays } = save;
  const days: LogicalDay[] = [];
  let run = 0;
  let longest = 0;
  // A day is decided at rollover, so only days before `asOf` are scored.
  const last = addDays(asOf, -1) < settings.seasonEnd ? addDays(asOf, -1) : settings.seasonEnd;
  const zero = new Set(confirmedZeroDays);
  // day -> counterId -> running sum, built once instead of rescanning entries per day.
  const sums = new Map<LogicalDay, Map<string, number>>();
  for (const e of counters) {
    const day = sums.get(e.day) ?? new Map<string, number>();
    day.set(e.counterId, (day.get(e.counterId) ?? 0) + e.delta);
    sums.set(e.day, day);
  }
  for (let d = settings.seasonStart; d <= last; d = addDays(d, 1)) {
    const day = sums.get(d);
    const hasData = day !== undefined || zero.has(d);
    const underCaps = COUNTERS.every(
      (c) => Math.max(0, day?.get(c.id) ?? 0) <= (settings.caps[c.id] ?? c.defaultCap),
    );
    if (hasData && underCaps) {
      days.push(d);
      run++;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }
  return { days, run, longest };
}

/** Everything derived from the save as it stood at the end of `asOf` (SPEC §4). */
export function snapshot(save: SaveFile, asOf: LogicalDay): Snapshot {
  const sessions = countedSessions(save, asOf);
  const byslot = new Map(sessions.map((s) => [s.slot, s]));
  const walk = walkWeeks(save, asOf, byslot);
  const pb = personalBests(sessions);
  const disc = discipline(save, asOf);

  const points: Record<Stat, number> = { strength: 0, back: 0, legs: 0, stamina: 0, discipline: 0 };
  const completedByExercise: Record<Exercise, number> = { pushups: 0, pullups: 0, squats: 0, run: 0 };
  let completedSessions = 0;
  for (const s of sessions) {
    const f = completionFraction(s);
    points[EXERCISE_STAT[s.exercise]] += sessionPoints(s.exercise, f);
    if (f >= 1) {
      completedSessions++;
      completedByExercise[s.exercise]++;
    }
  }
  for (const ev of pb.events) points[EXERCISE_STAT[ev.exercise]] += PB_BONUS;
  points.discipline += disc.days.length * DISCIPLINE_POINTS;

  const stats = Object.fromEntries(
    STATS.map((st) => {
      const rank = rankFor(points[st]);
      return [st, { points: points[st], rank, next: nextThreshold(rank) }];
    }),
  ) as Record<Stat, StatStatus>;

  return {
    asOf,
    weeks: walk.weeks,
    streak: walk.streak,
    longestStreak: walk.longest,
    freezesBanked: walk.banked,
    freezesUsed: walk.used,
    perfectWeeks: walk.weeks.filter((w) => w.perfect).length,
    perfectWeekRun: walk.perfectRun,
    longestPerfectWeekRun: walk.longestPerfectRun,
    completedSessions,
    completedByExercise,
    stats,
    bests: pb.bests,
    pbEvents: pb.events,
    disciplineDays: disc.days,
    disciplineRun: disc.run,
    longestDisciplineRun: disc.longest,
  };
}
