import { describe, expect, it } from 'vitest';
import { applyCounterDelta, counterTotal, dayHasEntries } from '../src/domain/counters';
import type { CounterEntry } from '../src/domain/types';

const entry = (day: string, delta: 1 | -1, counterId = 'dr_pepper'): CounterEntry => ({
  id: `${day}-${Math.random()}`,
  counterId,
  day,
  at: `${day}T12:00:00.000Z`,
  delta,
});

describe('counters', () => {
  it('sums entries per counter and day', () => {
    const list = [entry('2026-10-03', 1), entry('2026-10-03', 1), entry('2026-10-03', -1), entry('2026-10-04', 1)];
    expect(counterTotal(list, 'dr_pepper', '2026-10-03')).toBe(1);
    expect(counterTotal(list, 'eating_out', '2026-10-03')).toBe(0);
    expect(dayHasEntries(list, '2026-10-04')).toBe(true);
    expect(dayHasEntries(list, '2026-10-05')).toBe(false);
  });

  it('ignores a decrement at zero', () => {
    const list = applyCounterDelta([], entry('2026-10-03', -1));
    expect(list).toEqual([]);
    expect(counterTotal(list, 'dr_pepper', '2026-10-03')).toBe(0);
  });
});
