import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { StoreContext } from './app/hooks/useStore';
import { logicalDay } from './domain/dates';
import { DEFAULT_ROLLOVER_HOUR } from './domain/settings';
import { browserStore, load, persist } from './storage/storage';
import { createStore } from './storage/store';
import './styles.css';

const now = new Date();
const kv = browserStore();
const { save, status } = load(kv, logicalDay(now, DEFAULT_ROLLOVER_HOUR), now);
const store = createStore(save, (s) => persist(kv, s));
// Persist a brand-new save straight away so the season start is fixed at first launch.
if (status.kind === 'new' || status.kind === 'recovered') persist(kv, save);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreContext.Provider value={store}>
      <App loadStatus={status} />
    </StoreContext.Provider>
  </StrictMode>,
);
