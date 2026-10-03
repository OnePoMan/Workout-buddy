import { describe, expect, it } from 'vitest';
import { characterMood, describeMood } from '../src/domain/mood';
import { MON, counter, log, save } from './helpers';

describe('characterMood', () => {
  it('idles on a workout day with nothing done', () => {
    expect(characterMood(save(MON), MON)).toEqual({ pose: 'stand', face: 'normal', cans: 0, wrappers: 0 });
  });

  it('is happy after completing a session today, including a make-up', () => {
    expect(characterMood(save(MON, [log(MON)]), MON).face).toBe('happy');
    const makeup = log(MON, { loggedOn: '2026-10-06' });
    expect(characterMood(save(MON, [makeup]), '2026-10-06').face).toBe('happy');
    expect(characterMood(save(MON, [log(MON, { fraction: 0.5 })]), MON).face).toBe('normal');
  });

  it('looks at you when make-ups are pending', () => {
    expect(characterMood(save(MON), '2026-10-07').face).toBe('look');
  });

  it('side-eyes when a counter is over its cap, above everything else', () => {
    const sv = save(MON, [log(MON)], counter(MON, 'dr_pepper', 3));
    expect(characterMood(sv, MON).face).toBe('sideeye');
    expect(characterMood(save(MON, [], counter(MON, 'dr_pepper', 2)), MON).face).toBe('normal');
  });

  it('sits and smiles on Sunday and outside the season', () => {
    const all = [MON, '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'].map((d) => log(d));
    expect(characterMood(save(MON, all), '2026-10-11')).toMatchObject({ pose: 'sit', face: 'smile' });
    expect(characterMood(save('2026-10-12'), MON)).toMatchObject({ pose: 'sit', face: 'smile' });
  });

  it('describes itself for screen readers', () => {
    expect(describeMood({ pose: 'sit', face: 'smile', cans: 0, wrappers: 0 })).toBe(
      'Your character is relaxing at the table, smiling.',
    );
    expect(describeMood({ pose: 'stand', face: 'sideeye', cans: 3, wrappers: 1 })).toBe(
      'Your character is standing in the apartment, giving you a side-eye about the counters. ' +
        'Today: 3 cans of Diet Dr Pepper on the counter and 1 snack wrapper on the table.',
    );
  });

  it('counts today\'s cans and wrappers for the room', () => {
    const sv = save(MON, [], [...counter(MON, 'dr_pepper', 2), ...counter(MON, 'snacks', 3), ...counter('2026-10-06')]);
    expect(characterMood(sv, MON)).toMatchObject({ cans: 2, wrappers: 3 });
  });
});
