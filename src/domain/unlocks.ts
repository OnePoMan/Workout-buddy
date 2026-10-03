import type { Earned, Progress } from './achievements';
import type { HairSetting } from './types';

export type UnlockId =
  | 'pullup_bar'
  | 'yoga_mat'
  | 'dumbbells'
  | 'neon_shoes'
  | 'headband'
  | 'ponytail'
  | 'trophy_shelf'
  | 'calendar'
  | 'plant_1'
  | 'plant_2'
  | 'plant_3'
  | 'medal';

export interface UnlockDef {
  id: UnlockId;
  name: string;
  kind: 'room' | 'outfit' | 'hair';
  /** Achievement id that unlocks it; 'pb_*' means any new record. */
  requires: string;
  condition: string;
}

/** SPEC §6.2. */
export const UNLOCKS: readonly UnlockDef[] = [
  { id: 'pullup_bar', name: 'PULL-UP BAR', kind: 'room', requires: 'rank_back_2', condition: 'BACK rank 2' },
  { id: 'yoga_mat', name: 'YOGA MAT', kind: 'room', requires: 'rank_legs_2', condition: 'LEGS rank 2' },
  { id: 'dumbbells', name: 'DUMBBELLS', kind: 'room', requires: 'rank_strength_3', condition: 'STRENGTH rank 3' },
  { id: 'neon_shoes', name: 'NEON RUNNING SHOES', kind: 'outfit', requires: 'rank_stamina_2', condition: 'STAMINA rank 2' },
  { id: 'headband', name: 'HEADBAND', kind: 'outfit', requires: 'perfect_week', condition: 'First perfect week' },
  { id: 'ponytail', name: 'PONYTAIL', kind: 'hair', requires: 'streak_12', condition: 'Streak of 12' },
  { id: 'trophy_shelf', name: 'TROPHY SHELF', kind: 'room', requires: 'pb_*', condition: 'First new record' },
  { id: 'calendar', name: 'STREAK CALENDAR', kind: 'room', requires: 'streak_6', condition: 'Streak of 6' },
  { id: 'plant_1', name: 'CACTUS GROWS', kind: 'room', requires: 'rank_discipline_3', condition: 'DISCIPLINE rank 3' },
  { id: 'plant_2', name: 'CACTUS BRANCHES', kind: 'room', requires: 'rank_discipline_6', condition: 'DISCIPLINE rank 6' },
  { id: 'plant_3', name: 'CACTUS FLOWERS', kind: 'room', requires: 'rank_discipline_9', condition: 'DISCIPLINE rank 9' },
  { id: 'medal', name: 'SEASON MEDAL', kind: 'room', requires: 'season_complete', condition: 'Finish the season' },
];

export const MAX_TROPHIES = 4;

export interface UnlockState {
  has: ReadonlySet<UnlockId>;
  /** 0–3: how far the window cactus has grown. */
  plantStage: number;
  /** Trophies on the shelf: one per record metric, up to MAX_TROPHIES. */
  trophies: number;
  /** Current streak, shown on the calendar. */
  streak: number;
}

function matches(def: UnlockDef, id: string): boolean {
  return def.requires === 'pb_*' ? id.startsWith('pb_') : def.requires === id;
}

/** Unlocks that the given earning grants (used to announce them with the reward). */
export function unlocksFor(earned: readonly Earned[]): UnlockDef[] {
  return UNLOCKS.filter((u) => earned.some((e) => matches(u, e.def.id)));
}

export function computeUnlocks(progress: Progress): UnlockState {
  const ids = progress.earned.map((e) => e.def.id);
  const has = new Set(UNLOCKS.filter((u) => ids.some((id) => matches(u, id))).map((u) => u.id));
  const plantStage = has.has('plant_3') ? 3 : has.has('plant_2') ? 2 : has.has('plant_1') ? 1 : 0;
  const trophies = Math.min(MAX_TROPHIES, ids.filter((id) => id.startsWith('pb_')).length);
  return { has, plantStage, trophies, streak: progress.today.streak };
}

export function resolveHair(setting: HairSetting, unlocks: UnlockState): 'down' | 'ponytail' {
  if (!unlocks.has.has('ponytail')) return 'down';
  return setting === 'down' ? 'down' : 'ponytail';
}
