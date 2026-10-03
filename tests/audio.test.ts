import { describe, expect, it } from 'vitest';
import { cuesFor } from '../src/audio/cues';
import type { RewardItem } from '../src/domain/rewards';
import { rewardDuration } from '../src/fx/render';

const items: RewardItem[] = [
  { kind: 'toast', key: 't', title: 'PUSH-UPS CLEAR!', sub: '+10 STRENGTH', earned: [] },
  { kind: 'banner', key: 'b', tier: 2, header: 'H', title: 'FIRST REP', subtitle: ['X'], icon: 'star', short: false, earned: [] },
  { kind: 'banner', key: 's', tier: 2, header: 'H', title: 'NEW RECORD', subtitle: ['X'], icon: 'record', short: true, earned: [] },
  { kind: 'rankup', key: 'r', stat: 'back', label: 'BACK', from: 1, to: 2, maxRank: 10, earned: [] },
  {
    kind: 'perfectWeek',
    key: 'p',
    count: 1,
    weekPoints: { strength: 20, back: 20, legs: 20, stamina: 20, discipline: 0 },
    freezeEarned: true,
    earned: [],
  },
  {
    kind: 'finale',
    key: 'f',
    recap: { ranks: { strength: 9, back: 8, legs: 9, stamina: 7, discipline: 6 }, sessions: 72, perfectWeeks: 9, longestStreak: 40, bestPace: null, achievements: 30 },
    earned: [],
  },
];

describe('cuesFor', () => {
  for (const item of items) {
    it(`${item.kind}${item.kind === 'banner' && item.short ? ' (short)' : ''}: sorted and inside the animation`, () => {
      const cues = cuesFor(item, false);
      expect(cues.length).toBeGreaterThan(0);
      const times = cues.map((c) => c.t);
      expect([...times].sort((a, b) => a - b)).toEqual(times);
      expect(Math.min(...times)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...times)).toBeLessThan(rewardDuration(item, false));
    });
  }

  it('plays one tick per banner letter, no slam on short banners', () => {
    const full = cuesFor(items[1]!, false);
    expect(full.filter((c) => c.sound === 'tick')).toHaveLength('FIRSTREP'.length);
    expect(full.some((c) => c.sound === 'slam')).toBe(true);
    expect(cuesFor(items[2]!, false).some((c) => c.sound === 'slam')).toBe(false);
  });

  it('chimes for an earned freeze only', () => {
    const pw = items[4]!;
    const withFreeze = cuesFor(pw, false).filter((c) => c.sound === 'bell').length;
    const without = cuesFor({ ...pw, freezeEarned: false } as RewardItem, false).filter((c) => c.sound === 'bell').length;
    expect(withFreeze).toBeGreaterThan(without);
  });

  it('reduces every item to a single short cue set when motion is reduced', () => {
    for (const item of items) {
      const cues = cuesFor(item, true);
      expect(cues.length).toBeLessThanOrEqual(2);
      expect(Math.max(...cues.map((c) => c.t))).toBeLessThan(0.2);
    }
  });
});
