import { useCallback, useEffect, useRef, useState } from 'react';

export interface Stopwatch {
  elapsed: number;
  running: boolean;
  start(): void;
  /** Stops and returns the elapsed seconds. */
  stop(): number;
  reset(): void;
}

/** Wall-clock stopwatch: elapsed time stays correct while the tab is throttled. */
export function useStopwatch(initialSec = 0): Stopwatch {
  const [running, setRunning] = useState(false);
  const [stored, setStored] = useState(initialSec);
  const startedAt = useRef(0);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 100);
    return () => window.clearInterval(id);
  }, [running]);

  const now = () => performance.now();
  const elapsed = running ? (now() - startedAt.current) / 1000 : stored;

  const start = useCallback(() => {
    if (running) return;
    startedAt.current = now() - stored * 1000;
    setRunning(true);
  }, [running, stored]);

  const stop = useCallback(() => {
    const sec = running ? (now() - startedAt.current) / 1000 : stored;
    setStored(sec);
    setRunning(false);
    return sec;
  }, [running, stored]);

  const reset = useCallback(() => {
    setRunning(false);
    setStored(0);
  }, []);

  return { elapsed, running, start, stop, reset };
}
