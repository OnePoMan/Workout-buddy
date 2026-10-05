import { describe, expect, it } from 'vitest';
import { addDays } from '../src/domain/dates';
import { snapshot } from '../src/domain/progress';
import { nextThreshold, rankFor, sessionPoints } from '../src/domain/rules';
import { MON, counter, log, save, week } from './helpers';

const W2 = addDays(MON, 7); // 2026-10-12
const W3 = addDays(MON, 14);
const W4 = addDays(MON, 21);
const states = (s: ReturnType<typeof snapshot>, i = 0) => s.weeks[i]!.slots.map((x) => x.state);

describe('streak', () => {
  it('counts completed sessions and leaves today pending', () => {
    const s = snapshot(save(MON, [log(MON), log('2026-10-06'), log('2026-10-07')]), '2026-10-08');
    expect(s.streak).toBe(3);
    expect(states(s)).toEqual(['done', 'done', 'done', 'pending', 'future', 'future']);
  });

  it('does not break on pending sessions within the current week', () => {
    const s = snapshot(save(MON, [log(MON), log('2026-10-07')]), '2026-10-08');
    expect(s.streak).toBe(2);
    expect(states(s).slice(0, 3)).toEqual(['done', 'pending', 'done']);
  });

  it('breaks on a miss once the week ends', () => {
    const s = snapshot(save(MON, week(MON, [1])), W2);
    expect(states(s)).toEqual(['done', 'missed', 'done', 'done', 'done', 'done']);
    expect(s.streak).toBe(4);
    expect(s.longestStreak).toBe(4);
  });

  it('treats a partial session as a miss at week end', () => {
    const sessions = [...week(MON, [1]), log('2026-10-06', { fraction: 0.5 })];
    const s = snapshot(save(MON, sessions), W2);
    expect(s.weeks[0]!.slots[1]).toMatchObject({ state: 'missed', fraction: 0.5 });
  });

  it('counts a make-up from the day it is logged', () => {
    const sessions = [...week(MON, [1]), log('2026-10-06', { loggedOn: '2026-10-08' })];
    expect(snapshot(save(MON, sessions), '2026-10-07').streak).toBe(2);
    expect(snapshot(save(MON, sessions), W2).streak).toBe(6);
  });

  it('ignores sessions outside the season', () => {
    const s = snapshot(save(W2, [...week(MON), log(W2)]), addDays(W2, 1));
    expect(s.streak).toBe(1);
    expect(s.weeks).toHaveLength(1);
  });
});

describe('freezes', () => {
  it('a perfect week banks a freeze that covers a later miss', () => {
    const s = snapshot(save(MON, [...week(MON), ...week(W2, [1])]), W3);
    expect(states(s, 1)).toEqual(['done', 'frozen', 'done', 'done', 'done', 'done']);
    expect(s.streak).toBe(11);
    expect(s.freezesBanked).toBe(0);
    expect(s.freezesUsed).toBe(1);
  });

  it('applies freezes oldest first and lets the rest break the streak', () => {
    const s = snapshot(save(MON, [...week(MON), ...week(W2, [1, 3])]), W3);
    expect(states(s, 1)).toEqual(['done', 'frozen', 'done', 'missed', 'done', 'done']);
    expect(s.streak).toBe(2);
    expect(s.longestStreak).toBe(8);
  });

  it('caps banked freezes at 2', () => {
    const s = snapshot(save(MON, [...week(MON), ...week(W2), ...week(W3)]), W4);
    expect(s.perfectWeeks).toBe(3);
    expect(s.freezesBanked).toBe(2);
  });

  it('does not spend freezes before the week ends', () => {
    const s = snapshot(save(MON, [...week(MON), ...week(W2, [1])]), addDays(W2, 6));
    expect(s.freezesBanked).toBe(1);
    expect(s.weeks[1]!.slots[1]!.state).toBe('pending');
  });

  it('banks a freeze as soon as the week is perfect', () => {
    expect(snapshot(save(MON, week(MON)), '2026-10-10').freezesBanked).toBe(1);
  });
});

describe('perfect weeks', () => {
  it('requires a full 6-slot week', () => {
    // Season starts Saturday: the first week only has the run.
    const s = snapshot(save('2026-10-03', [log('2026-10-03')]), MON);
    expect(s.weeks[0]!.eligible).toBe(false);
    expect(s.perfectWeeks).toBe(0);
    expect(s.freezesBanked).toBe(0);
  });

  it('records the day the week became perfect', () => {
    const sessions = [...week(MON, [5]), log('2026-10-10', { loggedOn: '2026-10-11' })];
    expect(snapshot(save(MON, sessions), W2).weeks[0]!.perfectOn).toBe('2026-10-11');
  });

  it('tracks consecutive perfect weeks', () => {
    const sessions = [...week(MON), ...week(W2), ...week(W3, [0])];
    const s = snapshot(save(MON, sessions), W4);
    expect(s.perfectWeekRun).toBe(0);
    expect(s.longestPerfectWeekRun).toBe(2);
    // While week 3 is still open the run is not broken.
    expect(snapshot(save(MON, sessions), addDays(W3, 3)).perfectWeekRun).toBe(2);
  });

  it('finalises the last partial week when the season ends', () => {
    const start = '2026-12-21';
    const sessions = [...week(start), log('2026-12-28'), log('2026-12-29'), log('2026-12-30')];
    expect(snapshot(save(start, sessions), '2026-12-31').weeks[1]!.slots[3]!.state).toBe('pending');
    const after = snapshot(save(start, sessions), '2027-01-01');
    expect(after.weeks[1]!.slots[3]!.state).toBe('frozen');
    expect(after.streak).toBe(9);
  });
});

describe('stats', () => {
  it('awards floored points per exercise', () => {
    const sessions = [
      log(MON), // 10 + 5 (set baseline)
      log('2026-10-06', { sets: [15] }), // 5 + 5
      log('2026-10-07', { sets: [45] }), // floor(20 × 0.75) = 15 + 5
      log('2026-10-08', { sets: [21] }), // floor(10 × 0.7) = 7, set 21 < 30 so no record
      log('2026-10-10', { distance: 0.5 }), // 10, no time so no pace record
    ];
    const s = snapshot(save(MON, sessions), W2);
    expect(s.stats.strength.points).toBe(22);
    expect(s.stats.back.points).toBe(10);
    expect(s.stats.legs.points).toBe(20);
    expect(s.stats.stamina.points).toBe(10);
    expect(s.stats.strength.rank).toBe(2);
    expect(s.stats.strength.next).toBe(35);
  });

  it('adds +5 for each personal best, baselines included', () => {
    const s = snapshot(save(MON, [log(MON, { durationSec: 90 })]), '2026-10-06');
    // 10 session + 5 set baseline + 5 time baseline
    expect(s.stats.strength.points).toBe(20);
  });

  it('scores discipline days that have data and stay under caps', () => {
    const counters = [
      ...counter(MON), // 1/2 → qualifies
      ...counter('2026-10-06', 'dr_pepper', 3), // over cap
      // 10-07: no data
      ...counter('2026-10-08', 'dr_pepper', 2), // at cap → qualifies
      ...counter('2026-10-09'), // today → not decided yet
    ];
    const sv = { ...save(MON, [], counters), confirmedZeroDays: ['2026-10-07'] };
    const s = snapshot(sv, '2026-10-09');
    expect(s.disciplineDays).toEqual([MON, '2026-10-07', '2026-10-08']);
    expect(s.stats.discipline.points).toBe(9);
    expect(s.disciplineRun).toBe(2);
    expect(s.longestDisciplineRun).toBe(2);
  });

  it('ignores logs for the retired snacks counter', () => {
    const counters = [...counter(MON, 'snacks', 9), ...counter('2026-10-06'), ...counter('2026-10-06', 'snacks', 9)];
    const s = snapshot(save(MON, [], counters), '2026-10-07');
    // MON had only snack logs: no data. 10-06 is scored on Diet Dr Pepper alone.
    expect(s.disciplineDays).toEqual(['2026-10-06']);
  });

  it('maps points to ranks', () => {
    expect(rankFor(0)).toBe(1);
    expect(rankFor(14)).toBe(1);
    expect(rankFor(15)).toBe(2);
    expect(rankFor(284)).toBe(9);
    expect(rankFor(285)).toBe(10);
    expect(rankFor(9999)).toBe(10);
    expect(nextThreshold(1)).toBe(15);
    expect(nextThreshold(10)).toBeNull();
  });

  it('floors without float error', () => {
    expect(sessionPoints('pushups', 0.7)).toBe(7);
    expect(sessionPoints('squats', 0.3)).toBe(6);
    expect(sessionPoints('run', 1.5)).toBe(20);
  });
});

describe('personal bests', () => {
  it('tracks the biggest set and ignores ties', () => {
    const sessions = [log(MON, { sets: [20, 10] }), log('2026-10-08', { sets: [25, 5] }), log(W2, { sets: [25, 5] })];
    const s = snapshot(save(MON, sessions), addDays(W2, 1));
    const sets = s.pbEvents.filter((e) => e.metric === 'pushups_set');
    expect(sets.map((e) => [e.value, e.previous])).toEqual([
      [20, null],
      [25, 20],
    ]);
    expect(s.bests.pushups_set!.day).toBe('2026-10-08');
  });

  it('only times sessions that reached their target, per target', () => {
    const sessions = [
      log(MON, { sets: [25], durationSec: 50 }), // short of target: no time
      log('2026-10-08', { durationSec: 80 }),
      log(W2, { durationSec: 70 }),
      log(addDays(W2, 3), { target: 40, sets: [40], durationSec: 100 }),
    ];
    const s = snapshot(save(MON, sessions), addDays(W2, 4));
    expect(s.bests['pushups_time@30']).toMatchObject({ value: 70, previous: 80 });
    expect(s.bests['pushups_time@40']).toMatchObject({ value: 100, previous: null });
  });

  it('compares runs by pace and needs the full distance and a time', () => {
    const sessions = [
      log('2026-10-10', { distance: 1, durationSec: 600 }),
      log(addDays(W2, 5), { distance: 1.2, durationSec: 690 }), // 575 s/mi
      log(addDays(W3, 5), { distance: 0.8, durationSec: 400 }), // too short
    ];
    const s = snapshot(save(MON, sessions), W4);
    expect(s.bests['run_pace@1']).toMatchObject({ value: 575, previous: 600, timeSec: 690 });
    expect(s.pbEvents.filter((e) => e.kind === 'pace')).toHaveLength(2);
  });

  it('orders records by the day they were logged', () => {
    // Monday's session is a make-up logged after Thursday's.
    const sessions = [log(MON, { sets: [30], loggedOn: '2026-10-09' }), log('2026-10-08', { sets: [28, 2] })];
    const sets = snapshot(save(MON, sessions), W2).pbEvents.filter((e) => e.metric === 'pushups_set');
    expect(sets.map((e) => e.value)).toEqual([28, 30]);
  });
});
