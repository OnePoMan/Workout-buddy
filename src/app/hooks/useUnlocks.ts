import { useMemo } from 'react';
import type { HairSetting } from '../../domain/types';
import { computeUnlocks, resolveHair, type UnlockState } from '../../domain/unlocks';
import type { Outfit } from '../../pixel/sprites/character';
import type { RoomExtras } from '../../pixel/sprites/room';
import { useProgress } from './useProgress';

export function useUnlocks(): UnlockState {
  const progress = useProgress();
  return useMemo(() => computeUnlocks(progress), [progress]);
}

export function roomExtras(u: UnlockState): RoomExtras {
  return {
    pullupBar: u.has.has('pullup_bar'),
    yogaMat: u.has.has('yoga_mat'),
    dumbbells: u.has.has('dumbbells'),
    trophies: u.has.has('trophy_shelf') ? Math.max(1, u.trophies) : 0,
    calendar: u.has.has('calendar') ? u.streak : null,
    plantStage: u.plantStage,
    medal: u.has.has('medal'),
  };
}

export function outfitFor(u: UnlockState, hair: HairSetting): Omit<Outfit, 'sway'> {
  return { hair: resolveHair(hair, u), headband: u.has.has('headband'), neonShoes: u.has.has('neon_shoes') };
}
