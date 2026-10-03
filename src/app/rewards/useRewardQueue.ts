import { useCallback, useEffect, useRef, useState } from 'react';
import { unseen, type Earned, type Progress } from '../../domain/achievements';
import { buildQueue, earnedKey, type RewardItem } from '../../domain/rewards';

/** Delay before replaying rewards on app open, so the screen settles first. */
const OPEN_DELAY_MS = 600;

export interface RewardQueue {
  current: RewardItem | null;
  push(item: RewardItem): void;
  /** Ends the item with this key (finished or skipped) and marks its earnings seen. */
  finish(key: string): void;
}

/**
 * Keeps the reward queue: newly unseen achievements are appended as they
 * appear, pushed items (session toasts) go to the front of what is waiting,
 * and each item marks its earnings seen only when it ends.
 */
export function useRewardQueue(
  progress: Progress,
  seen: Readonly<Record<string, number>>,
  markSeen: (earned: Earned[]) => void,
): RewardQueue {
  const [queue, setQueue] = useState<RewardItem[]>([]);
  const [ready, setReady] = useState(false);
  const queued = useRef(new Set<string>());
  const queueRef = useRef(queue);
  queueRef.current = queue;

  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), OPEN_DELAY_MS);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const fresh = unseen(progress.earned, seen).filter((e) => !queued.current.has(earnedKey(e)));
    if (fresh.length === 0) return;
    for (const e of fresh) queued.current.add(earnedKey(e));
    const items = buildQueue(fresh, progress);
    setQueue((q) => [...q, ...items]);
  }, [progress, seen]);

  const push = useCallback((item: RewardItem) => {
    // Ahead of waiting items, but never interrupting the one on screen.
    setQueue((q) => (q.length === 0 ? [item] : [q[0]!, item, ...q.slice(1)]));
  }, []);

  const current = ready ? (queue[0] ?? null) : null;

  const finish = useCallback(
    (key: string) => {
      const done = queueRef.current[0];
      if (!done || done.key !== key) return;
      queueRef.current = queueRef.current.slice(1);
      if (done.earned.length > 0) markSeen(done.earned);
      setQueue((q) => (q[0]?.key === key ? q.slice(1) : q));
    },
    [markSeen],
  );

  return { current, push, finish };
}
