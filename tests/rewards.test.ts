import { describe, expect, it } from 'vitest';
import { computeProgress, markSeen, unseen, type Earned } from '../src/domain/achievements';
import { addDays } from '../src/domain/dates';
import { MAX_IN_A_ROW, announce, buildQueue, earnedKey, sessionClearedToast } from '../src/domain/rewards';
import { MON, log, save, week } from './helpers';

const W2 = addDays(MON, 7);

function queueFor(sessions: ReturnType<typeof log>[], today: string, seen: Record<string, number> = {}) {
  const sv = { ...save(MON, sessions), seen };
  const p = computeProgress(sv, today);
  return { p, q: buildQueue(unseen(p.earned, seen), p) };
}

describe('buildQueue', () => {
  it('orders a first session: toast, full banner, then rank-up', () => {
    const { q } = queueFor([log(MON)], MON);
    expect(q.map((i) => i.kind)).toEqual(['toast', 'banner', 'rankup']);
    const [toast, banner, rank] = q;
    expect(toast).toMatchObject({ title: 'FIRST PUSH-UPS!' });
    expect(banner).toMatchObject({ title: 'FIRST REP', short: false, header: 'ACHIEVEMENT UNLOCKED', icon: 'star' });
    expect(rank).toMatchObject({ stat: 'strength', from: 1, to: 2, maxRank: 10 });
  });

  it('puts the highest tier first and shortens the remaining banners', () => {
    // A perfect week brings T3 PERFECT WEEK, T2 FIRST REP and ON A ROLL, records and rank-ups.
    const { q } = queueFor(week(MON), W2);
    const blocking = q.filter((i) => i.kind !== 'toast');
    expect(blocking[0]).toMatchObject({ kind: 'banner', title: 'PERFECT WEEK', tier: 3, short: false, icon: 'week' });
    expect(blocking.length).toBeLessThanOrEqual(MAX_IN_A_ROW + 1);
    const shortBanners = blocking.filter((i) => i.kind === 'banner' && i.short);
    for (const b of shortBanners) expect(b).toMatchObject({ tier: 2 });
  });

  it('merges several ranks of one stat and keeps stat order', () => {
    const { q } = queueFor(week(MON), W2);
    const ranks = q.filter((i) => i.kind === 'rankup');
    const stats = ranks.map((r) => (r.kind === 'rankup' ? r.stat : ''));
    expect(new Set(stats).size).toBe(stats.length);
    const order = ['strength', 'back', 'legs', 'stamina', 'discipline'];
    expect([...stats].sort((a, b) => order.indexOf(a) - order.indexOf(b))).toEqual(stats);
  });

  it('collapses everything past three blocking items into one card', () => {
    const { p, q } = queueFor(week(MON), W2);
    const blocking = q.filter((i) => i.kind !== 'toast');
    expect(blocking).toHaveLength(MAX_IN_A_ROW + 1);
    const more = blocking.at(-1)!;
    expect(more.kind).toBe('more');
    // Every unseen earning is carried by exactly one item.
    const carried = q.flatMap((i) => i.earned.map(earnedKey)).sort();
    expect(carried).toEqual(unseen(p.earned, {}).map(earnedKey).sort());
    if (more.kind === 'more') expect(more.count).toBe(more.earned.length);
  });

  it('shows record values on two lines', () => {
    const sessions = [log(MON, { sets: [20, 10] }), log('2026-10-08', { sets: [25, 5] })];
    const sv = save(MON, sessions);
    const p = computeProgress(sv, '2026-10-08');
    const record = p.earned.find((e) => e.def.id === 'pb_pushups_set')!;
    const [item] = buildQueue([record], p);
    expect(item).toMatchObject({ kind: 'banner', title: 'NEW RECORD', icon: 'record', subtitle: ['MOST PUSH-UPS IN ONE SET', '25 REPS'] });
  });

  it('counts repeat perfect weeks in the subtitle', () => {
    const sv = save(MON, [...week(MON), ...week(W2)]);
    const p = computeProgress(sv, addDays(W2, 7));
    const pw = p.earned.find((e) => e.def.id === 'perfect_week')!;
    expect(buildQueue([pw], p)[0]).toMatchObject({ subtitle: ['ALL 6 SESSIONS DONE', 'TOTAL: 2'] });
  });

  it('queues nothing once everything is seen', () => {
    const { p } = queueFor([log(MON)], MON);
    const seen = markSeen({}, p.earned);
    expect(buildQueue(unseen(p.earned, seen), p)).toEqual([]);
  });

  it('gives repeat earnings a new key', () => {
    const e = { def: { id: 'perfect_week' }, count: 2 } as Earned;
    expect(earnedKey(e)).toBe('perfect_week#2');
    expect(earnedKey({ ...e, count: 3 })).not.toBe(earnedKey(e));
  });
});

describe('session toast and announcements', () => {
  it('builds the CLEAR! toast', () => {
    expect(sessionClearedToast('squats', 20, 'k')).toMatchObject({
      kind: 'toast',
      title: 'SQUATS CLEAR!',
      sub: '+20 LEGS',
      earned: [],
    });
    expect((sessionClearedToast('run', 0, 'k') as { sub?: string }).sub).toBeUndefined();
  });

  it('announces each kind in plain text', () => {
    const { q } = queueFor([log(MON)], MON);
    expect(q.map(announce)).toEqual([
      'FIRST PUSH-UPS! NEW EXERCISE CLEARED',
      'ACHIEVEMENT UNLOCKED: FIRST REP. FIRST SESSION DONE',
      'STRENGTH rank up: 1 to 2.',
    ]);
  });
});

describe('toast merging', () => {
  it('merges several firsts into one toast that marks them all seen', () => {
    const { q } = queueFor(week(MON), W2);
    const toasts = q.filter((i) => i.kind === 'toast');
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({ title: '4 FIRSTS!', sub: 'NEW EXERCISES CLEARED' });
    expect(toasts[0]!.earned.map((e) => e.def.id).sort()).toEqual(['first_pullups', 'first_pushups', 'first_run', 'first_squats']);
  });
});
