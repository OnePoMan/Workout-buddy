import { createContext, useContext, useSyncExternalStore } from 'react';
import type { SaveFile } from '../../domain/types';
import type { Store } from '../../storage/store';

export const StoreContext = createContext<Store | null>(null);

export function useStoreApi(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('StoreContext missing');
  return store;
}

export function useSave(): SaveFile {
  const store = useStoreApi();
  return useSyncExternalStore(store.subscribe, store.getState);
}
