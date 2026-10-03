import type { Earned, Progress, Tier } from './achievements';
import { formatPbValue, metricLabel } from './achievements';
import { EXERCISE_STAT, MAX_RANK, STATS, STAT_LABEL, type Stat } from './rules';
import { EXERCISE_LABEL } from './schedule';
import type { Exercise } from './types';

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
  | { kind: 'rankup'; key: string; stat: Stat; label: string; from: number; to: number; maxRank: number; earned: Earned[] }
  | { kind: 'more'; key: string; count: number; earned: Earned[] };

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

  const blocking: RewardItem[] = [];
  if (banners[0]) blocking.push(banner(banners[0], progress, false));
  blocking.push(...rankups);
  blocking.push(...banners.slice(1).map((e) => banner(e, progress, true)));

  if (blocking.length <= MAX_IN_A_ROW) return [...toasts, ...blocking];
  const rest = blocking.slice(MAX_IN_A_ROW);
  const restEarned = rest.flatMap((r) => r.earned);
  return [
    ...toasts,
    ...blocking.slice(0, MAX_IN_A_ROW),
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

/** Plain-text announcement for screen readers. */
export function announce(item: RewardItem): string {
  switch (item.kind) {
    case 'toast':
      return [item.title, item.sub].filter(Boolean).join(' ');
    case 'banner':
      return `${item.header}: ${item.title}. ${item.subtitle.join(' ')}`;
    case 'rankup':
      return `${item.label} rank up: ${item.from} to ${item.to}.`;
    case 'more':
      return `${item.count} more achievements unlocked.`;
  }
}
