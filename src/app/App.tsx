import { useState } from 'react';
import type { Slot } from '../domain/schedule';
import type { LoadStatus } from '../storage/storage';
import { useSave, useStoreApi } from './hooks/useStore';
import { useToday } from './hooks/useToday';
import { Home } from './screens/Home';
import { LogSheet } from './screens/LogSheet';
import { Settings } from './screens/Settings';
import { Stats } from './screens/Stats';

type Tab = 'home' | 'stats' | 'settings';

const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'HOME' },
  { id: 'stats', label: 'STATS' },
  { id: 'settings', label: 'SETTINGS' },
];

export function App({ loadStatus }: { loadStatus: LoadStatus }) {
  const store = useStoreApi();
  const save = useSave();
  const today = useToday(save.settings.rolloverHour);
  const [tab, setTab] = useState<Tab>('home');
  const [logSlot, setLogSlot] = useState<Slot | null>(null);
  const [recoveredDismissed, setRecoveredDismissed] = useState(false);

  const unsaved = loadStatus.kind === 'unavailable' || !store.isPersisting();

  return (
    <div className="app">
      {unsaved && (
        <div className="banner banner-warn" role="alert">
          STORAGE UNAVAILABLE — DATA WON'T BE SAVED ON THIS DEVICE.
        </div>
      )}
      {loadStatus.kind === 'recovered' && !recoveredDismissed && (
        <div className="banner banner-warn" role="alert">
          <span>
            Saved data could not be read ({loadStatus.reason}). A copy was kept under the storage key “
            {loadStatus.backupKey}”. Starting fresh.
          </span>
          <button type="button" className="btn btn-square" aria-label="Dismiss" onClick={() => setRecoveredDismissed(true)}>
            ×
          </button>
        </div>
      )}

      <main className="main">
        {tab === 'home' && <Home today={today} onLog={setLogSlot} />}
        {tab === 'stats' && <Stats />}
        {tab === 'settings' && <Settings today={today} />}
      </main>

      <nav className="tabbar" aria-label="Main">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab${tab === t.id ? ' is-active' : ''}`}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {logSlot && <LogSheet key={logSlot.day} slot={logSlot} today={today} onClose={() => setLogSlot(null)} />}
    </div>
  );
}
