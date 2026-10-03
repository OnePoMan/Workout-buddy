import { createContext, useContext, useDeferredValue, useMemo } from 'react';
import { computeProgress, type Progress } from '../../domain/achievements';
import type { LogicalDay, SaveFile } from '../../domain/types';

export const ProgressContext = createContext<Progress | null>(null);

/**
 * Computes progress once for the app. Uses a deferred copy of the save so taps
 * (counters, logging) render first and the replay follows.
 */
export function useComputedProgress(save: SaveFile, today: LogicalDay): Progress {
  const deferred = useDeferredValue(save);
  return useMemo(() => computeProgress(deferred, today), [deferred, today]);
}

export function useProgress(): Progress {
  const p = useContext(ProgressContext);
  if (!p) throw new Error('ProgressContext missing');
  return p;
}
