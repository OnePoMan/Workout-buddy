import { describe, expect, it } from 'vitest';
import { computeProgress } from '../src/domain/achievements';
import { addDays } from '../src/domain/dates';
import { UNLOCKS, computeUnlocks, resolveHair, unlocksFor } from '../src/domain/unlocks';
import { MON, log, save, week } from './helpers';

const W2 = addDays(MON, 7);
const W3 = addDays(MON, 14);

describe('unlocks', () => {
  it('starts with nothing', () => {
    const u = computeUnlocks(computeProgress(save(MON), MON));
    expect(u.has.size).toBe(0);
    expect(u.plantStage).toBe(0);
    expect(u.trophies).toBe(0);
  });

  it('follows the achievements that grant them', () => {
    // Two perfect weeks: headband (perfect week), calendar (streak 6), ponytail (streak 12), rank-ups.
    const u = computeUnlocks(computeProgress(save(MON, [...week(MON), ...week(W2)]), W3));
    for (const id of ['headband', 'calendar', 'ponytail', 'pullup_bar', 'yoga_mat', 'neon_shoes'] as const) {
      expect(u.has.has(id), id).toBe(true);
    }
    expect(u.has.has('medal')).toBe(false);
    expect(u.streak).toBe(12);
  });

  it('adds a trophy per record metric, up to 4', () => {
    const sessions = [
      log(MON, { sets: [20, 10], durationSec: 90 }),
      log('2026-10-08', { sets: [25, 5], durationSec: 80 }),
      log('2026-10-06', { sets: [20, 10] }),
      log('2026-10-09', { sets: [22, 8] }),
    ];
    const u = computeUnlocks(computeProgress(save(MON, sessions), W2));
    expect(u.has.has('trophy_shelf')).toBe(true);
    expect(u.trophies).toBe(3); // pushups set, pushups time, pullups set
  });

  it('maps earnings to unlock names', () => {
    const p = computeProgress(save(MON, week(MON)), W2);
    const pw = p.earned.filter((e) => e.def.id === 'perfect_week');
    expect(unlocksFor(pw).map((u) => u.name)).toEqual(['HEADBAND']);
  });

  it('only shows the ponytail once unlocked, and respects the setting', () => {
    const none = computeUnlocks(computeProgress(save(MON), MON));
    expect(resolveHair('ponytail', none)).toBe('down');
    const got = computeUnlocks(computeProgress(save(MON, [...week(MON), ...week(W2)]), W3));
    expect(resolveHair('auto', got)).toBe('ponytail');
    expect(resolveHair('down', got)).toBe('down');
  });

  it('has unique ids and a condition for each', () => {
    expect(new Set(UNLOCKS.map((u) => u.id)).size).toBe(UNLOCKS.length);
    for (const u of UNLOCKS) expect(u.condition.length).toBeGreaterThan(0);
  });
});
