import { useDeferredValue, useMemo } from 'react';
import { computeProgress, type Progress } from '../../domain/achievements';
import type { LogicalDay } from '../../domain/types';
import { useSave } from './useStore';

/**
 * Derived progress for `today`. Computed from a deferred copy of the save so
 * taps (counters, logging) render first and the replay follows.
 */
export function useProgress(today: LogicalDay): Progress {
  const save = useDeferredValue(useSave());
  return useMemo(() => computeProgress(save, today), [save, today]);
}
