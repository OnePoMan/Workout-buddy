import { describe, expect, it } from 'vitest';
import { computeProgress, LOCKABLE, type Earned } from '../src/domain/achievements';
import {
  EATING_OUT,
  applyCounterDelta,
  dayHasEntries,
  periodTotal,
  weekCounterEntries,
  weekTotal,
} from '../src/domain/counters';
import { addDays } from '../src/domain/dates';
import { snapshot } from '../src/domain/progress';
import { buildQueue } from '../src/domain/rewards';
import type { CounterEntry } from '../src/domain/types';
import { friesPositions, MAX_VISIBLE_FRIES, NEON, WINDOW } from '../src/pixel/sprites/room';
import { MON, counter, log, save } from './helpers';

const EAT = EATING_OUT.id;
const week = (n: number) => addDays(MON, 7 * n);
const minus = (day: string): CounterEntry => ({ id: `m-${day}`, counterId: EAT, day, at: `${day}T20:00:00.000Z`, delta: -1 });

function byId(earned: Earned[]): Record<string, Earned> {
  return Object.fromEntries(earned.map((e) => [e.def.id, e]));
}

describe('weekly eating-out counter', () => {
  it('defaults to a limit of one per week', () => {
    expect(EATING_OUT.defaultCap).toBe(1);
    expect(save(MON).settings.caps[EAT]).toBe(1);
  });

  it('keeps a running total for the whole Monday–Sunday week, then resets', () => {
    const entries = [...counter(MON, EAT), ...counter('2026-10-09', EAT), ...counter('2026-10-11', EAT)];
    expect(weekTotal(entries, EAT, '2026-10-11')).toBe(3);
    expect(weekTotal(entries, EAT, '2026-10-07')).toBe(3);
    expect(weekTotal(entries, EAT, '2026-10-12')).toBe(0);
    expect(weekCounterEntries(entries, EAT, '2026-10-11').map((e) => e.day)).toEqual([MON, '2026-10-09', '2026-10-11']);
  });

  it('allows undo on a later day of the same week, never below zero', () => {
    let list = counter(MON, EAT);
    list = applyCounterDelta(list, minus('2026-10-08'));
    expect(periodTotal(list, EAT, '2026-10-08')).toBe(0);
    expect(applyCounterDelta(list, minus('2026-10-09'))).toHaveLength(list.length);
    // Last week's meals cannot be undone from a new week.
    expect(applyCounterDelta(counter(MON, EAT), minus(week(1)))).toHaveLength(1);
  });

  it('does not count toward the daily caps, "Nothing today" or DISCIPLINE', () => {
    expect(dayHasEntries(counter(MON, EAT), MON)).toBe(false);
    const withMeal = snapshot(save(MON, [], counter(MON, EAT, 3)), '2026-10-06');
    expect(withMeal.disciplineDays).toEqual([]);
    const withCan = snapshot(save(MON, [], [...counter(MON, 'dr_pepper'), ...counter(MON, EAT, 3)]), '2026-10-06');
    expect(withCan.disciplineDays).toEqual([MON]);
  });
});

describe('eating-out weeks', () => {
  it('judges a full, active week once it ends', () => {
    const sv = save(MON, [log(MON)], counter('2026-10-08', EAT));
    expect(snapshot(sv, '2026-10-11').eatInWeeks).toEqual([]);
    expect(snapshot(sv, week(1)).eatInWeeks).toEqual([
      { start: MON, total: 1, cap: 1, under: true, decidedOn: week(1) },
    ]);
  });

  it('marks a week over the limit and breaks the run', () => {
    const sv = save(MON, [log(MON), log(week(1)), log(week(2))], [...counter(week(1), EAT, 2)]);
    const s = snapshot(sv, week(3));
    expect(s.eatInWeeks.map((w) => w.under)).toEqual([true, false, true]);
    expect(s.eatInRun).toBe(1);
    expect(s.longestEatInRun).toBe(1);
  });

  it('skips idle weeks and partial season weeks', () => {
    // Season starts on a Saturday: that week is partial and never judged.
    const sv = save('2026-10-03', [log('2026-10-03'), log(week(1))]);
    const s = snapshot(sv, week(2));
    expect(s.eatInWeeks.map((w) => w.start)).toEqual([week(1)]);
    // The week of MON had no activity, so the run is broken before week(1).
    expect(s.eatInRun).toBe(1);
  });

  it('follows the limit from settings', () => {
    const sv = save(MON, [log(MON)], counter(MON, EAT, 3));
    expect(snapshot(sv, week(1)).eatInWeeks[0]!.under).toBe(false);
    const relaxed = { ...sv, settings: { ...sv.settings, caps: { ...sv.settings.caps, [EAT]: 3 } } };
    expect(snapshot(relaxed, week(1)).eatInWeeks[0]!.under).toBe(true);
  });
});

describe('eating-out achievements', () => {
  it('earns HOLD THE FRIES each week under the limit, dated the Monday after', () => {
    const sv = save(MON, [log(MON), log(week(1)), log(week(2))], counter(week(1), EAT, 2));
    const p = byId(computeProgress(sv, week(3)).earned);
    expect(p.eat_in_week).toMatchObject({ count: 2, firstOn: week(1), lastOn: week(3) });
    expect(p.eat_in_week!.def).toMatchObject({ name: 'HOLD THE FRIES', repeatable: true, tier: 2 });
  });

  it('earns HOME COOKING after 4 weeks in a row, on the day the 4th week ends', () => {
    const sessions = [0, 1, 2, 3].map((n) => log(week(n)));
    const p3 = byId(computeProgress(save(MON, sessions), week(3)).earned);
    expect(p3.eat_in_4).toBeUndefined();
    const p4 = byId(computeProgress(save(MON, sessions), week(4)).earned);
    expect(p4.eat_in_4).toMatchObject({ firstOn: week(4), count: 1 });
    expect(p4.eat_in_4!.def.name).toBe('HOME COOKING');
    // The day-skipping replay agrees with a full day-by-day replay.
    expect(computeProgress(save(MON, sessions), week(4), { everyDay: true }).earned).toEqual(
      computeProgress(save(MON, sessions), week(4)).earned,
    );
  });

  it('lists the new achievements as lockable and shows them with the fries badge', () => {
    const ids = LOCKABLE.map((d) => d.id);
    expect(ids).toEqual(expect.arrayContaining(['eat_in_week', 'eat_in_4', 'eat_in_8', 'eat_in_12']));
    const progress = computeProgress(save(MON, [log(MON)]), week(1));
    const queue = buildQueue(progress.earned.filter((e) => e.def.id === 'eat_in_week'), progress);
    expect(queue[0]).toMatchObject({ kind: 'banner', title: 'HOLD THE FRIES', icon: 'fries' });
  });
});

describe('fries in the room', () => {
  it('sits on the windowsill clear of the curtains and the neon sign', () => {
    expect(friesPositions(0)).toEqual([]);
    const all = friesPositions(50);
    expect(all).toHaveLength(MAX_VISIBLE_FRIES);
    for (const [x, y] of all) {
      expect(x).toBeGreaterThan(26); // right of the cactus
      expect(x + 6).toBeLessThan(WINDOW.x1 - 2); // left of the curtain
      expect(y).toBeLessThanOrEqual(WINDOW.y1 + 3); // on or above the sill
      const overlapsNeon = y - 7 <= NEON.y && y >= NEON.y && x <= NEON.x1 && x + 6 >= NEON.x0;
      expect(overlapsNeon).toBe(false);
    }
  });
});
