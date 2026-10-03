import { createContext, useContext } from 'react';
import type { RewardItem } from '../../domain/rewards';

export interface RewardsApi {
  /** Queues an item ahead of achievement rewards (used for session-cleared toasts). */
  push(item: RewardItem): void;
}

export const RewardsContext = createContext<RewardsApi>({ push() {} });

export function useRewards(): RewardsApi {
  return useContext(RewardsContext);
}
