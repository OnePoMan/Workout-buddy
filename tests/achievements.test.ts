import { describe, expect, it } from 'vitest';
import {
  LOCKABLE,
  computeProgress,
  markSeen,
  metricLabel,
  unseen,
  type Earned,
} from '../src/domain/achievements';
import { addDays } from '../src/domain/dates';
import { MON, counter, log, save, week } from './helpers';

const W2 = addDays(MON, 7);
const W3 = addDays(MON, 14);

function byId(earned: Earned[]): Record<string, Earned> {
  return Object.fromEntries(earned.map((e) => [e.def.id, e]));
}

describe('computeProgress', () => {
  it('dates first-session achievements', () => {
    const p = byId(computeProgress(save(MON, [log('2026-10-06'), log('2026-10-07')]), '2026-10-08').earned);
    expect(p.first_session).toMatchObject({ firstOn: '2026-10-06', count: 1 });
    expect(p.first_pullups!.firstOn).toBe('2026-10-06');
    expect(p.first_squats!.firstOn).toBe('2026-10-07');
    expect(p.first_pushups).toBeUndefined();
    expect(p.first_session!.def.tier).toBe(2);
    expect(p.first_squats!.def.tier).toBe(1);
  });

  it('does not count partial sessions as firsts', () => {
    const p = byId(computeProgress(save(MON, [log(MON, { fraction: 0.5 })]), '2026-10-06').earned);
    expect(p.first_session).toBeUndefined();
  });

  it('awards a streak milestone on the day it is reached, and keeps it after a reset', () => {
    const sessions = [...week(MON, [5]), log('2026-10-10', { loggedOn: '2026-10-11' }), ...week(W2, [0, 1])];
    const p = byId(computeProgress(save(MON, sessions), W3).earned);
    expect(p.streak_6!.firstOn).toBe('2026-10-11');
    expect(p.streak_12).toBeUndefined();
  });

  it('counts perfect weeks', () => {
    const p = byId(computeProgress(save(MON, [...week(MON), ...week(W2)]), W3).earned);
    expect(p.perfect_week).toMatchObject({ count: 2, firstOn: '2026-10-10', lastOn: '2026-10-17' });
    expect(p.perfect_week!.def.tier).toBe(3);
  });

  it('counts records but not baselines', () => {
    const sessions = [log(MON, { sets: [20, 10] }), log('2026-10-08', { sets: [25, 5] }), log(W2, { sets: [26, 4] })];
    const p = byId(computeProgress(save(MON, sessions), addDays(W2, 1)).earned);
    expect(p.pb_pushups_set).toMatchObject({ count: 2, firstOn: '2026-10-08', lastOn: W2 });
    expect(p.pb_pushups_set!.def.description).toBe('MOST PUSH-UPS IN ONE SET');
  });

  it('dates rank-ups', () => {
    // Monday: 10 + 5 set baseline = 15 → STRENGTH rank 2.
    const p = byId(computeProgress(save(MON, [log(MON)]), '2026-10-06').earned);
    expect(p.rank_strength_2).toMatchObject({ firstOn: MON });
    expect(p.rank_strength_2!.def.kind).toBe('rank');
    expect(p.rank_strength_3).toBeUndefined();
  });

  it('awards IRON WILL the morning after the 7th qualifying day', () => {
    const counters = Array.from({ length: 7 }, (_, i) => counter(addDays(MON, i))).flat();
    const sv = save(MON, [], counters);
    expect(byId(computeProgress(sv, addDays(MON, 6)).earned).cap_7).toBeUndefined();
    expect(byId(computeProgress(sv, W2).earned).cap_7!.firstOn).toBe(W2);
  });

  it('awards SPEED DEMON for 30 s/mi faster than the first run', () => {
    const sessions = [
      log('2026-10-10', { durationSec: 600 }),
      log(addDays(W2, 5), { durationSec: 580 }),
      log(addDays(W3, 5), { durationSec: 570 }),
    ];
    const p = byId(computeProgress(save(MON, sessions), addDays(W3, 6)).earned);
    expect(p.mile_improve_30!.firstOn).toBe(addDays(W3, 5));
  });

  it('awards season completion only after the season ends', () => {
    const start = '2026-12-21';
    expect(byId(computeProgress(save(start), '2026-12-31').earned).season_complete).toBeUndefined();
    const p = byId(computeProgress(save(start), '2027-01-05').earned);
    expect(p.season_complete).toMatchObject({ firstOn: '2027-01-01' });
    expect(p.season_complete!.def.tier).toBe(4);
  });

  it('earns nothing before the season starts', () => {
    expect(computeProgress(save(W2, [log(MON)]), MON).earned).toEqual([]);
  });

  it('recalculates when a log is deleted', () => {
    const sv = save(MON, [log(MON)]);
    expect(computeProgress(sv, W2).earned.length).toBeGreaterThan(0);
    expect(computeProgress({ ...sv, sessions: [] }, W2).earned).toEqual([]);
  });

  it('returns the snapshot for today', () => {
    const p = computeProgress(save(MON, [log(MON)]), '2026-10-06');
    expect(p.today.asOf).toBe('2026-10-06');
    expect(p.today.streak).toBe(1);
  });
});

describe('seen tracking', () => {
  it('reports unseen earnings and marks them seen up to the current count', () => {
    const p = computeProgress(save(MON, [...week(MON), ...week(W2)]), W3);
    const fresh = unseen(p.earned, {});
    expect(fresh.map((e) => e.def.id)).toContain('perfect_week');
    const seen = markSeen({}, fresh);
    expect(seen.perfect_week).toBe(2);
    expect(unseen(p.earned, seen)).toEqual([]);
    // A third perfect week is unseen again.
    const p3 = computeProgress(save(MON, [...week(MON), ...week(W2), ...week(W3)]), addDays(W3, 7));
    expect(unseen(p3.earned, seen).map((e) => e.def.id)).toContain('perfect_week');
  });
});

describe('labels and lockable list', () => {
  it('labels record metrics', () => {
    expect(metricLabel({ kind: 'time', exercise: 'squats', target: 60 })).toBe('FASTEST 60 SQUATS');
    expect(metricLabel({ kind: 'pace', exercise: 'run', target: 1 })).toBe('BEST 1 MI PACE');
  });

  it('lists every static achievement once, without rank-ups or records', () => {
    const ids = LOCKABLE.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      expect.arrayContaining(['first_session', 'streak_48', 'cap_7', 'mile_improve_30', 'perfect_week', 'season_complete']),
    );
    expect(ids.some((id) => id.startsWith('rank_') || id.startsWith('pb_'))).toBe(false);
  });
});

describe('event-day shortcut', () => {
  it('matches a full day-by-day replay', () => {
    const sessions = [
      ...week(MON, [5]),
      log('2026-10-10', { loggedOn: '2026-10-11', durationSec: 600 }),
      ...week(W2, [2]),
      log(addDays(W2, 2), { loggedOn: addDays(W2, 4), sets: [40, 20], durationSec: 200 }),
      ...week(W3, [1, 3]),
      log(addDays(W3, 5), { durationSec: 560 }),
    ];
    const counters = Array.from({ length: 20 }, (_, i) => counter(addDays(MON, i), 'dr_pepper', i % 5)).flat();
    const sv = { ...save(MON, sessions, counters), confirmedZeroDays: [addDays(MON, 21), addDays(MON, 22)] };
    for (const today of [addDays(MON, 3), W2, addDays(W3, 6), addDays(MON, 30)]) {
      expect(computeProgress(sv, today).earned).toEqual(computeProgress(sv, today, { everyDay: true }).earned);
    }
  });
});
