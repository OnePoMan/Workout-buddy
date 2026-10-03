import { describe, expect, it } from 'vitest';
import {
  addDays,
  dayLabel,
  fullDate,
  diffDays,
  formatDuration,
  isValidDay,
  logicalDay,
  sameWeek,
  weekStart,
  weekday,
} from '../src/domain/dates';

describe('logicalDay', () => {
  it('uses the calendar day at or after the rollover hour', () => {
    expect(logicalDay(new Date(2026, 9, 3, 3, 0), 3)).toBe('2026-10-03');
    expect(logicalDay(new Date(2026, 9, 3, 23, 59), 3)).toBe('2026-10-03');
  });

  it('counts hours before rollover toward the previous day', () => {
    expect(logicalDay(new Date(2026, 9, 3, 2, 59), 3)).toBe('2026-10-02');
    expect(logicalDay(new Date(2026, 9, 1, 1, 0), 3)).toBe('2026-09-30');
    expect(logicalDay(new Date(2027, 0, 1, 0, 30), 3)).toBe('2026-12-31');
  });

  it('with rollover 0 matches the calendar day', () => {
    expect(logicalDay(new Date(2026, 9, 3, 0, 0), 0)).toBe('2026-10-03');
  });
});

describe('day arithmetic', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('is unaffected by DST changes', () => {
    // US DST ends 2026-11-01.
    expect(addDays('2026-10-31', 2)).toBe('2026-11-02');
    expect(diffDays('2026-10-31', '2026-11-02')).toBe(2);
  });

  it('computes Monday-based weekdays and week starts', () => {
    expect(weekday('2026-10-05')).toBe(0); // Monday
    expect(weekday('2026-10-03')).toBe(5); // Saturday
    expect(weekday('2026-10-04')).toBe(6); // Sunday
    expect(weekStart('2026-10-04')).toBe('2026-09-28');
    expect(weekStart('2026-10-05')).toBe('2026-10-05');
    expect(sameWeek('2026-10-05', '2026-10-11')).toBe(true);
    expect(sameWeek('2026-10-11', '2026-10-12')).toBe(false);
  });

  it('validates days', () => {
    expect(isValidDay('2026-10-03')).toBe(true);
    expect(isValidDay('2026-02-30')).toBe(false);
    expect(isValidDay('2026-1-3')).toBe(false);
    expect(isValidDay(20261003)).toBe(false);
  });
});

describe('formatting', () => {
  it('labels days', () => {
    expect(dayLabel('2026-10-03')).toBe('SAT 10/3');
    expect(dayLabel('2026-12-31')).toBe('THU 12/31');
    expect(fullDate('2026-10-03')).toBe('10/3/2026');
  });

  it('formats durations', () => {
    expect(formatDuration(65.34)).toBe('1:05');
    expect(formatDuration(65.34, true)).toBe('1:05.3');
    expect(formatDuration(0, true)).toBe('0:00.0');
  });
});
