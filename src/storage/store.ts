import type { SaveFile } from '../domain/types';

export interface Store {
  getState(): SaveFile;
  subscribe(listener: () => void): () => void;
  /** Applies an update and persists it. */
  update(fn: (prev: SaveFile) => SaveFile): void;
  /** Whether the last write succeeded. */
  isPersisting(): boolean;
}

export function createStore(initial: SaveFile, write: (save: SaveFile) => boolean): Store {
  let state = initial;
  let persisting = true;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(fn) {
      const next = fn(state);
      if (next === state) return;
      state = next;
      persisting = write(state);
      listeners.forEach((l) => l());
    },
    isPersisting: () => persisting,
  };
}
