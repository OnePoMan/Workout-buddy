import { describe, expect, it } from 'vitest';
import { counterEntries, counterTotal, removeCounterEntry } from '../src/domain/counters';
import { addDays } from '../src/domain/dates';
import { buildHeatmap, heatLevel } from '../src/domain/heatmap';
import { snapshot } from '../src/domain/progress';
import type { CounterEntry } from '../src/domain/types';
import { MON, log, save, week } from './helpers';

const W2 = addDays(MON, 7);

describe('heatLevel', () => {
  it('buckets completion into four steps', () => {
    expect(heatLevel(0)).toBe(0);
    expect(heatLevel(0.2)).toBe(1);
    expect(heatLevel(0.5)).toBe(2);
    expect(heatLevel(0.99)).toBe(2);
    expect(heatLevel(1)).toBe(3);
  });
});

describe('buildHeatmap', () => {
  it('spans the whole season in Monday–Sunday columns', () => {
    const sv = save('2026-10-03');
    const weeks = buildHeatmap(snapshot(sv, '2026-10-05'), sv.settings, '2026-10-05');
    expect(weeks[0]!.start).toBe('2026-09-28');
    expect(weeks.at(-1)!.start).toBe('2026-12-28');
    expect(weeks).toHaveLength(14);
    for (const w of weeks) expect(w.cells).toHaveLength(7);
    // Days before the start and after the end are outside.
    expect(weeks[0]!.cells[4]!.state).toBe('outside'); // Fri Oct 2
    expect(weeks[0]!.cells[5]!.state).not.toBe('outside'); // Sat Oct 3
    expect(weeks.at(-1)!.cells[4]!.state).toBe('outside'); // Fri Jan 1
  });

  it('labels months where they start', () => {
    const sv = save('2026-10-03');
    const weeks = buildHeatmap(snapshot(sv, '2026-10-05'), sv.settings, '2026-10-05');
    expect(weeks.filter((w) => w.month).map((w) => w.month)).toEqual(['OCT', 'NOV', 'DEC']);
  });

  it('marks state, level, rest days and today', () => {
    const sessions = [...week(MON, [1, 2]), log('2026-10-07', { fraction: 0.6 })];
    const sv = save(MON, sessions);
    const today = addDays(W2, 2);
    const cells = buildHeatmap(snapshot(sv, today), sv.settings, today).flatMap((w) => w.cells);
    const at = (d: string) => cells.find((c) => c.day === d)!;
    expect(at(MON)).toMatchObject({ state: 'done', level: 3, exercise: 'pushups' });
    expect(at('2026-10-06')).toMatchObject({ state: 'missed', level: 0 });
    expect(at('2026-10-07')).toMatchObject({ state: 'missed', level: 2 });
    expect(at('2026-10-11')).toMatchObject({ state: 'rest', exercise: null });
    expect(at(W2)).toMatchObject({ state: 'pending' });
    expect(at(today)).toMatchObject({ isToday: true, state: 'pending' });
    expect(at(addDays(W2, 7))).toMatchObject({ state: 'future' });
  });

  it('shows frozen sessions', () => {
    const sv = save(MON, [...week(MON), ...week(W2, [3])]);
    const today = addDays(W2, 7);
    const cells = buildHeatmap(snapshot(sv, today), sv.settings, today).flatMap((w) => w.cells);
    expect(cells.find((c) => c.day === addDays(W2, 3))!.state).toBe('frozen');
  });
});

describe('counter history', () => {
  const e = (id: string, at: string, delta: 1 | -1, counterId = 'eating_out'): CounterEntry => ({
    id,
    counterId,
    day: MON,
    at,
    delta,
  });

  it('lists one counter oldest first and undoes by id', () => {
    const entries = [e('b', `${MON}T15:00:00Z`, 1), e('a', `${MON}T09:00:00Z`, 1), e('c', `${MON}T10:00:00Z`, 1, 'dr_pepper')];
    expect(counterEntries(entries, 'eating_out', MON).map((x) => x.id)).toEqual(['a', 'b']);
    const after = removeCounterEntry(entries, 'b');
    expect(counterTotal(after, 'eating_out', MON)).toBe(1);
    expect(after).toHaveLength(2);
  });
});
