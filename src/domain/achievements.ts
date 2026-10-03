import { addDays, formatDuration } from './dates';
import { snapshot, type PbEvent, type Snapshot } from './progress';
import { CAP_RUN_DAYS, MAX_RANK, MILE_IMPROVE_SEC, STATS, STAT_LABEL, STREAK_MILESTONES, type Stat } from './rules';
import { EXERCISE_LABEL } from './schedule';
import { EXERCISES, type Exercise, type LogicalDay, type SaveFile } from './types';

/** Reward tier (SPEC §5). */
export type Tier = 1 | 2 | 3 | 4;

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  /** Short line for the reward banner (pixel font: A–Z, 0–9, basic punctuation). */
  tagline: string;
  tier: Tier;
  repeatable: boolean;
  kind: 'achievement' | 'rank' | 'record';
}

export interface Earned {
  def: AchievementDef;
  /** Times earned; always 1 for one-time achievements. */
  count: number;
  firstOn: LogicalDay;
  lastOn: LogicalDay;
}

const STREAK_NAMES: Record<number, string> = { 6: 'ON A ROLL', 12: 'HOT STREAK', 24: 'UNSTOPPABLE', 48: 'LEGENDARY' };

const def = (d: Omit<AchievementDef, 'repeatable' | 'kind' | 'tagline'> & Partial<AchievementDef>): AchievementDef => ({
  tagline: d.name,
  repeatable: false,
  kind: 'achievement',
  ...d,
});

/** One-time achievements judged on a single day's snapshot. */
interface DailyRule {
  def: AchievementDef;
  test(s: Snapshot): boolean;
}

function firstRunPace(s: Snapshot): number | undefined {
  return s.pbEvents.find((e) => e.kind === 'pace')?.value;
}

function bestRunPace(s: Snapshot): number | undefined {
  const paces = Object.values(s.bests).filter((e) => e.kind === 'pace').map((e) => e.value);
  return paces.length ? Math.min(...paces) : undefined;
}

const DAILY_RULES: DailyRule[] = [
  {
    def: def({
      id: 'first_session',
      name: 'FIRST REP',
      description: 'Complete your first session.',
      tagline: 'FIRST SESSION DONE',
      tier: 2,
    }),
    test: (s) => s.completedSessions >= 1,
  },
  ...EXERCISES.map((ex: Exercise) => ({
    def: def({
      id: `first_${ex}`,
      name: `FIRST ${EXERCISE_LABEL[ex]}`,
      description: `Complete your first ${EXERCISE_LABEL[ex].toLowerCase()} session.`,
      tagline: 'NEW EXERCISE CLEARED',
      tier: 1 as Tier,
    }),
    test: (s: Snapshot) => s.completedByExercise[ex] >= 1,
  })),
  ...STREAK_MILESTONES.map((n) => ({
    def: def({
      id: `streak_${n}`,
      name: STREAK_NAMES[n] ?? `STREAK ${n}`,
      description: `Reach a streak of ${n} sessions.`,
      tagline: `${n} SESSIONS IN A ROW`,
      tier: 2 as Tier,
    }),
    test: (s: Snapshot) => s.longestStreak >= n,
  })),
  {
    def: def({
      id: 'cap_7',
      name: 'IRON WILL',
      description: `Stay under both caps for ${CAP_RUN_DAYS} days in a row.`,
      tagline: `${CAP_RUN_DAYS} DAYS UNDER THE CAPS`,
      tier: 2,
    }),
    test: (s) => s.longestDisciplineRun >= CAP_RUN_DAYS,
  },
  {
    def: def({
      id: 'mile_improve_30',
      name: 'SPEED DEMON',
      description: `Run ${MILE_IMPROVE_SEC} s per mile faster than your first run.`,
      tagline: `${MILE_IMPROVE_SEC} S/MI FASTER THAN DAY ONE`,
      tier: 2,
    }),
    test: (s) => {
      const first = firstRunPace(s);
      const best = bestRunPace(s);
      return first !== undefined && best !== undefined && first - best >= MILE_IMPROVE_SEC;
    },
  },
  ...STATS.flatMap((st: Stat) =>
    Array.from({ length: MAX_RANK - 1 }, (_, i) => i + 2).map((n) => ({
      def: def({
        id: `rank_${st}_${n}`,
        name: `${STAT_LABEL[st]} RANK ${n}`,
        description: `Reach ${STAT_LABEL[st]} rank ${n}.`,
        tagline: `RANK ${n}`,
        tier: 2 as Tier,
        kind: 'rank' as const,
      }),
      test: (s: Snapshot) => s.stats[st].rank >= n,
    })),
  ),
];

export const PERFECT_WEEK = def({
  id: 'perfect_week',
  name: 'PERFECT WEEK',
  description: 'Complete all 6 sessions in a Monday–Sunday week.',
  tagline: 'ALL 6 SESSIONS DONE',
  tier: 3,
  repeatable: true,
});

export const SEASON_COMPLETE = def({
  id: 'season_complete',
  name: 'FALL 2026 CLEAR',
  description: 'Reach the end of the season.',
  tagline: 'SEE YOU NEXT SEASON',
  tier: 4,
});

/** "30 REPS", "1:20.0", "9:35/MI". */
export function formatPbValue(ev: Pick<PbEvent, 'kind' | 'value'>): string {
  if (ev.kind === 'set') return `${ev.value} REPS`;
  if (ev.kind === 'time') return formatDuration(ev.value, true);
  return `${formatDuration(ev.value)}/MI`;
}

/** "MOST PUSH-UPS IN ONE SET", "FASTEST 30 PUSH-UPS", "BEST 1 MI PACE". */
export function metricLabel(ev: Pick<PbEvent, 'kind' | 'exercise' | 'target'>): string {
  const label = EXERCISE_LABEL[ev.exercise];
  if (ev.kind === 'set') return `MOST ${label} IN ONE SET`;
  if (ev.kind === 'time') return `FASTEST ${ev.target} ${label}`;
  return `BEST ${ev.target} MI PACE`;
}

export function recordDef(ev: PbEvent): AchievementDef {
  return def({
    id: `pb_${ev.metric}`,
    name: 'NEW RECORD',
    description: metricLabel(ev),
    tagline: metricLabel(ev),
    tier: 2,
    repeatable: true,
    kind: 'record',
  });
}

/** Achievements that can be listed as locked (dynamic records and rank-ups excluded). */
export const LOCKABLE: readonly AchievementDef[] = [
  ...DAILY_RULES.map((r) => r.def).filter((d) => d.kind === 'achievement'),
  PERFECT_WEEK,
  SEASON_COMPLETE,
];

export interface Progress {
  today: Snapshot;
  earned: Earned[];
}

/**
 * Days on which a daily rule can change: a session was logged, or a day with
 * counter data (or "Nothing today") was scored at rollover. Every daily rule
 * depends only on those inputs, so other days can be skipped.
 */
function eventDays(save: SaveFile, today: LogicalDay): Set<LogicalDay> {
  const days = new Set<LogicalDay>([today]);
  for (const s of save.sessions) days.add(s.loggedOn);
  for (const e of save.counters) days.add(addDays(e.day, 1));
  for (const d of save.confirmedZeroDays) days.add(addDays(d, 1));
  return days;
}

/**
 * Replays the season day by day so each achievement gets the day it was first
 * earned. Repeatable ones are counted from the current snapshot.
 * `everyDay` disables the event-day shortcut (used by tests to check it).
 */
export function computeProgress(save: SaveFile, today: LogicalDay, opts: { everyDay?: boolean } = {}): Progress {
  const { seasonStart, seasonEnd } = save.settings;
  const current = snapshot(save, today);
  const earned = new Map<string, Earned>();
  const once = (d: AchievementDef, on: LogicalDay) => {
    if (!earned.has(d.id)) earned.set(d.id, { def: d, count: 1, firstOn: on, lastOn: on });
  };

  // Discipline for the last season day is decided the morning after.
  const end = today <= seasonEnd ? today : addDays(seasonEnd, 1);
  const candidates = opts.everyDay ? null : eventDays(save, today);
  for (let d = seasonStart; d <= end; d = addDays(d, 1)) {
    if (candidates && !candidates.has(d)) continue;
    const snap = d === today ? current : snapshot(save, d);
    for (const rule of DAILY_RULES) {
      if (!earned.has(rule.def.id) && rule.test(snap)) once(rule.def, d);
    }
  }

  const perfectDays = current.weeks.flatMap((w) => (w.perfectOn ? [w.perfectOn] : [])).sort();
  if (perfectDays.length) {
    earned.set(PERFECT_WEEK.id, {
      def: PERFECT_WEEK,
      count: perfectDays.length,
      firstOn: perfectDays[0]!,
      lastOn: perfectDays.at(-1)!,
    });
  }

  for (const ev of current.pbEvents) {
    if (ev.previous === null) continue;
    const d = recordDef(ev);
    const prev = earned.get(d.id);
    if (prev) earned.set(d.id, { ...prev, count: prev.count + 1, lastOn: ev.day });
    else earned.set(d.id, { def: d, count: 1, firstOn: ev.day, lastOn: ev.day });
  }

  if (today > seasonEnd) once(SEASON_COMPLETE, addDays(seasonEnd, 1));

  return { today: current, earned: [...earned.values()] };
}

/** Earned achievements with more earnings than times shown. */
export function unseen(earned: readonly Earned[], seen: Readonly<Record<string, number>>): Earned[] {
  return earned.filter((e) => e.count > (seen[e.def.id] ?? 0));
}

/** Marks the given achievements as shown up to their current count. */
export function markSeen(seen: Readonly<Record<string, number>>, shown: readonly Earned[]): Record<string, number> {
  const next = { ...seen };
  for (const e of shown) next[e.def.id] = Math.max(next[e.def.id] ?? 0, e.count);
  return next;
}
