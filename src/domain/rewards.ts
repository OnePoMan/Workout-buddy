import type { Earned, Progress, Tier } from './achievements';
import { formatPbValue, metricLabel } from './achievements';
import { addDays, formatDuration } from './dates';
import { DISCIPLINE_POINTS, EXERCISE_STAT, MAX_RANK, STATS, STAT_LABEL, sessionPoints, type Stat } from './rules';
import { EXERCISE_LABEL } from './schedule';
import type { Exercise } from './types';
import { unlocksFor } from './unlocks';

export type RewardIcon = 'star' | 'record' | 'streak' | 'week' | 'flag';

/** Every item carries the earnings it marks as seen once shown or skipped. */
export type RewardItem =
  | { kind: 'toast'; key: string; title: string; sub?: string; earned: Earned[] }
  | {
      kind: 'banner';
      key: string;
      tier: Tier;
      header: string;
      title: string;
      subtitle: string[];
      icon: RewardIcon;
      /** Banner only, shorter: for the extra T2 items after the first. */
      short: boolean;
      earned: Earned[];
    }
  | {
      kind: 'rankup';
      key: string;
      stat: Stat;
      label: string;
      from: number;
      to: number;
      maxRank: number;
      earned: Earned[];
    }
  | {
      kind: 'perfectWeek';
      key: string;
      count: number;
      /** Points the week added to each stat. */
      weekPoints: Record<Stat, number>;
      freezeEarned: boolean;
      earned: Earned[];
    }
  | { kind: 'finale'; key: string; recap: SeasonRecap; earned: Earned[] }
  | { kind: 'summary'; key: string; recap: SeasonRecap; earned: Earned[] }
  | { kind: 'more'; key: string; count: number; earned: Earned[] };

export interface SeasonRecap {
  ranks: Record<Stat, number>;
  sessions: number;
  perfectWeeks: number;
  longestStreak: number;
  /** "9:35/MI", or null without a timed run. */
  bestPace: string | null;
  achievements: number;
}

/** Item decoration: unlocks granted by the item's earnings ("NEW: HEADBAND"). */
export function unlockNote(item: RewardItem): string | null {
  const names = unlocksFor(item.earned).map((u) => u.name);
  return names.length ? `NEW: ${names.join(', ')}` : null;
}

export function seasonRecap(progress: Progress): SeasonRecap {
  const s = progress.today;
  const paces = Object.values(s.bests).filter((b) => b.kind === 'pace').map((b) => b.value);
  return {
    ranks: Object.fromEntries(STATS.map((st) => [st, s.stats[st].rank])) as Record<Stat, number>,
    sessions: s.completedSessions,
    perfectWeeks: s.perfectWeeks,
    longestStreak: s.longestStreak,
    bestPace: paces.length ? `${formatDuration(Math.min(...paces))}/MI` : null,
    achievements: progress.earned.reduce((n, e) => n + e.count, 0),
  };
}

/** Stat points earned during the most recent perfect week (sessions plus discipline days). */
export function lastPerfectWeek(progress: Progress): { weekPoints: Record<Stat, number>; freezeEarned: boolean } {
  const s = progress.today;
  const week = [...s.weeks].reverse().find((w) => w.perfect);
  const weekPoints: Record<Stat, number> = { strength: 0, back: 0, legs: 0, stamina: 0, discipline: 0 };
  if (!week) return { weekPoints, freezeEarned: false };
  for (const slot of week.slots) weekPoints[EXERCISE_STAT[slot.exercise]] += sessionPoints(slot.exercise, slot.fraction);
  const end = addDays(week.start, 6);
  weekPoints.discipline = s.disciplineDays.filter((d) => d >= week.start && d <= end).length * DISCIPLINE_POINTS;
  return { weekPoints, freezeEarned: week.freezeEarned };
}

/** Blocking animations played in a row before the rest collapse into a "+N more" card. */
export const MAX_IN_A_ROW = 3;

export const ACHIEVEMENT_HEADER = 'ACHIEVEMENT UNLOCKED';

/** Identifies one earning; repeatables get a new key each time they are earned again. */
export function earnedKey(e: Earned): string {
  return `${e.def.id}#${e.count}`;
}

function iconFor(e: Earned): RewardIcon {
  if (e.def.kind === 'record') return 'record';
  if (e.def.id.startsWith('streak_')) return 'streak';
  if (e.def.id === 'perfect_week') return 'week';
  if (e.def.id === 'season_complete') return 'flag';
  return 'star';
}

function banner(e: Earned, progress: Progress, short: boolean): RewardItem {
  let subtitle = [e.def.tagline];
  if (e.def.kind === 'record') {
    const best = progress.today.bests[e.def.id.slice('pb_'.length)];
    subtitle = best ? [metricLabel(best), formatPbValue(best)] : [e.def.tagline];
  } else if (e.def.repeatable && e.count > 1) {
    subtitle = [e.def.tagline, `TOTAL: ${e.count}`];
  }
  return {
    kind: 'banner',
    key: earnedKey(e),
    tier: e.def.tier,
    header: ACHIEVEMENT_HEADER,
    title: e.def.name,
    subtitle,
    icon: iconFor(e),
    short,
    earned: [e],
  };
}

function byImportance(a: Earned, b: Earned): number {
  if (a.def.tier !== b.def.tier) return b.def.tier - a.def.tier;
  if (a.lastOn !== b.lastOn) return a.lastOn < b.lastOn ? -1 : 1;
  return a.def.id < b.def.id ? -1 : 1;
}

/**
 * Orders newly earned rewards (SPEC §5): T1 toasts (merged into one when
 * there are several), then the most important
 * banner in full, then rank-ups in stat order (several ranks of one stat merge
 * into one bar), then the remaining banners in short form. Past
 * MAX_IN_A_ROW blocking items, the rest collapse into one "+N more" card.
 */
export function buildQueue(unseen: readonly Earned[], progress: Progress): RewardItem[] {
  // Several T1 firsts at once (e.g. a whole week imported) share one toast.
  const firsts = unseen.filter((e) => e.def.tier === 1 && e.def.kind === 'achievement').sort(byImportance);
  const toasts: RewardItem[] =
    firsts.length > 1
      ? [
          {
            kind: 'toast',
            key: firsts.map(earnedKey).join('+'),
            title: `${firsts.length} FIRSTS!`,
            sub: 'NEW EXERCISES CLEARED',
            earned: firsts,
          },
        ]
      : firsts.map((e) => ({ kind: 'toast', key: earnedKey(e), title: `${e.def.name}!`, sub: e.def.tagline, earned: [e] }));

  const banners = unseen.filter((e) => e.def.kind !== 'rank' && e.def.tier >= 2).sort(byImportance);

  const rankups: RewardItem[] = [];
  for (const stat of STATS) {
    const ranks = unseen.filter((e) => e.def.kind === 'rank' && e.def.id.startsWith(`rank_${stat}_`));
    if (ranks.length === 0) continue;
    const ns = ranks.map((e) => Number(e.def.id.slice(`rank_${stat}_`.length)));
    rankups.push({
      kind: 'rankup',
      key: ranks.map(earnedKey).sort().join('+'),
      stat,
      label: STAT_LABEL[stat],
      from: Math.min(...ns) - 1,
      to: Math.max(...ns),
      maxRank: MAX_RANK,
      earned: ranks,
    });
  }

  const special = (e: Earned, short: boolean): RewardItem[] => {
    if (e.def.id === 'perfect_week') {
      return [{ kind: 'perfectWeek', key: earnedKey(e), count: e.count, ...lastPerfectWeek(progress), earned: [e] }];
    }
    if (e.def.id === 'season_complete') {
      const recap = seasonRecap(progress);
      return [
        { kind: 'finale', key: earnedKey(e), recap, earned: [e] },
        { kind: 'summary', key: `summary:${earnedKey(e)}`, recap, earned: [] },
      ];
    }
    return [banner(e, progress, short)];
  };

  const blocking: RewardItem[] = [];
  if (banners[0]) blocking.push(...special(banners[0], false));
  blocking.push(...rankups);
  blocking.push(...banners.slice(1).flatMap((e) => special(e, true)));

  // The season summary card follows the finale and does not count toward the cap.
  const counted = blocking.filter((b) => b.kind !== 'summary').length;
  if (counted <= MAX_IN_A_ROW) return [...toasts, ...blocking];
  let n = 0;
  const cut = blocking.findIndex((b) => b.kind !== 'summary' && ++n > MAX_IN_A_ROW);
  const rest = blocking.slice(cut);
  const restEarned = rest.flatMap((r) => r.earned);
  return [
    ...toasts,
    ...blocking.slice(0, cut),
    { kind: 'more', key: `more:${restEarned.map(earnedKey).sort().join('+')}`, count: restEarned.length, earned: restEarned },
  ];
}

/** T1 toast for a session that just reached its target. */
export function sessionClearedToast(exercise: Exercise, points: number, key: string): RewardItem {
  return {
    kind: 'toast',
    key,
    title: `${EXERCISE_LABEL[exercise]} CLEAR!`,
    sub: points > 0 ? `+${points} ${STAT_LABEL[EXERCISE_STAT[exercise]]}` : undefined,
    earned: [],
  };
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** Plain-text announcement for screen readers. */
export function announce(item: RewardItem): string {
  switch (item.kind) {
    case 'toast':
      return [item.title, item.sub].filter(Boolean).join(' ');
    case 'banner':
      return `${item.header}: ${item.title}. ${item.subtitle.join(' ')}`;
    case 'rankup':
      return `${item.label} rank up: ${item.from} to ${item.to}.`;
    case 'perfectWeek':
      return `Perfect week!${item.count > 1 ? ` That makes ${item.count}.` : ''}${item.freezeEarned ? ' Streak freeze earned.' : ''}`;
    case 'finale':
      return 'Fall 2026 season complete!';
    case 'summary':
      return `Season summary: ${plural(item.recap.sessions, 'session')}, ${plural(item.recap.perfectWeeks, 'perfect week')}, longest streak ${item.recap.longestStreak}.`;
    case 'more':
      return `${item.count} more achievements unlocked.`;
  }
}
