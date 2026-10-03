import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../src/domain/settings';
import {
  completionFraction,
  findSession,
  isComplete,
  isEditable,
  pendingMakeups,
  removeSession,
  sameContent,
  targetFor,
  upsertSession,
} from '../src/domain/sessions';
import type { SessionLog } from '../src/domain/types';

const settings = defaultSettings('2026-10-01');

function log(slot: string, extra: Partial<SessionLog>): SessionLog {
  return {
    id: `id-${slot}`,
    slot,
    loggedOn: slot,
    exercise: 'pushups',
    target: 30,
    updatedAt: '2026-10-05T12:00:00.000Z',
    ...extra,
  };
}

describe('completion', () => {
  it('uses reps over the snapshot target, capped at 1', () => {
    expect(completionFraction(log('2026-10-05', { sets: [10, 5] }))).toBe(0.5);
    expect(completionFraction(log('2026-10-05', { sets: [20, 20] }))).toBe(1);
    expect(isComplete(log('2026-10-05', { sets: [30] }))).toBe(true);
    expect(completionFraction(undefined)).toBe(0);
  });

  it('uses distance for the run', () => {
    expect(completionFraction(log('2026-10-10', { exercise: 'run', target: 1, distance: 0.5 }))).toBe(0.5);
    expect(isComplete(log('2026-10-10', { exercise: 'run', target: 1, distance: 1.2 }))).toBe(true);
  });
});

describe('session list', () => {
  it('keeps one session per slot', () => {
    let list = upsertSession([], log('2026-10-05', { sets: [10] }));
    list = upsertSession(list, log('2026-10-05', { sets: [30] }));
    expect(list).toHaveLength(1);
    expect(findSession(list, '2026-10-05')?.sets).toEqual([30]);
    expect(removeSession(list, '2026-10-05')).toEqual([]);
  });

  it('snapshots targets only for new logs', () => {
    const slot = { day: '2026-10-05', exercise: 'pushups' as const };
    const changed = { ...settings, targets: { ...settings.targets, pushups: 40 } };
    expect(targetFor(slot, undefined, changed)).toBe(40);
    expect(targetFor(slot, log('2026-10-05', { target: 30 }), changed)).toBe(30);
  });

  it('compares content ignoring timestamps', () => {
    const a = log('2026-10-05', { sets: [10, 20] });
    expect(sameContent(a, { ...a, updatedAt: 'later' })).toBe(true);
    expect(sameContent(a, { ...a, sets: [10, 21] })).toBe(false);
  });
});

describe('make-ups', () => {
  it('lists earlier incomplete slots in the current week', () => {
    const sessions = [log('2026-10-05', { sets: [30] }), log('2026-10-06', { exercise: 'pullups', sets: [12] })];
    // Thursday: Mon done, Tue partial, Wed missing.
    expect(pendingMakeups('2026-10-08', settings, sessions).map((s) => s.day)).toEqual([
      '2026-10-06',
      '2026-10-07',
    ]);
  });

  it('never includes today, future days, or other weeks', () => {
    expect(pendingMakeups('2026-10-05', settings, [])).toEqual([]);
    expect(pendingMakeups('2026-10-11', settings, []).map((s) => s.day)).toHaveLength(6);
  });

  it('allows editing only within the slot week, up to today', () => {
    expect(isEditable('2026-10-05', '2026-10-11')).toBe(true);
    expect(isEditable('2026-10-05', '2026-10-12')).toBe(false);
    expect(isEditable('2026-10-06', '2026-10-05')).toBe(false);
  });
});
