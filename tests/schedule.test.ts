import { describe, expect, it } from 'vitest';
import { exerciseFor, slotFor, weekSlots } from '../src/domain/schedule';
import { defaultSettings } from '../src/domain/settings';

const settings = { ...defaultSettings('2026-10-03') };

describe('schedule', () => {
  it('maps weekdays to exercises', () => {
    expect(exerciseFor('2026-10-05')).toBe('pushups'); // Mon
    expect(exerciseFor('2026-10-06')).toBe('pullups'); // Tue
    expect(exerciseFor('2026-10-07')).toBe('squats'); // Wed
    expect(exerciseFor('2026-10-08')).toBe('pushups'); // Thu
    expect(exerciseFor('2026-10-09')).toBe('pullups'); // Fri
    expect(exerciseFor('2026-10-10')).toBe('run'); // Sat
    expect(exerciseFor('2026-10-11')).toBeNull(); // Sun
  });

  it('has no slots outside the season', () => {
    expect(slotFor('2026-10-02', settings)).toBeNull(); // Fri before start
    expect(slotFor('2026-10-03', settings)).toEqual({ day: '2026-10-03', exercise: 'run' });
    expect(slotFor('2027-01-01', settings)).toBeNull();
  });

  it('lists in-season slots for a week', () => {
    // Season starts Saturday, so only Saturday is in the first week.
    expect(weekSlots('2026-10-04', settings).map((s) => s.day)).toEqual(['2026-10-03']);
    expect(weekSlots('2026-10-07', settings)).toHaveLength(6);
    // Last week: Mon 12-28 … Thu 12-31.
    expect(weekSlots('2026-12-30', settings).map((s) => s.exercise)).toEqual([
      'pushups',
      'pullups',
      'squats',
      'pushups',
    ]);
  });
});
