import { useCallback, useEffect, useMemo, useState } from 'react';
import { unlockAudio } from '../audio/sfx';
import type { Earned } from '../domain/achievements';
import type { Slot } from '../domain/schedule';
import type { LoadStatus } from '../storage/storage';
import { computeUnlocks } from '../domain/unlocks';
import { markEarnedSeen } from './actions';
import { outfitFor } from './hooks/useUnlocks';
import { ProgressContext, useComputedProgress } from './hooks/useProgress';
import { useReducedMotion } from './hooks/useReducedMotion';
import { useSave, useStoreApi } from './hooks/useStore';
import { RewardOverlay } from './rewards/RewardOverlay';
import { RewardsContext } from './rewards/RewardsContext';
import { useRewardQueue } from './rewards/useRewardQueue';
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
  const progress = useComputedProgress(save, today);
  const reduceMotion = useReducedMotion(save.settings.reduceMotion);
  const markSeen = useCallback((earned: Earned[]) => markEarnedSeen(store, earned), [store]);
  const rewards = useRewardQueue(progress, save.seen, markSeen);
  const rewardsApi = useMemo(() => ({ push: rewards.push }), [rewards.push]);
  const outfitKey = JSON.stringify(outfitFor(computeUnlocks(progress), save.settings.hair));
  const outfit = useMemo(() => JSON.parse(outfitKey) as ReturnType<typeof outfitFor>, [outfitKey]);
  // Browsers start audio only after a user gesture.
  useEffect(() => {
    if (!save.settings.sound) return;
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [save.settings.sound]);
  const openAchievements = useCallback(() => {
    setLogSlot(null);
    setTab('stats');
    window.setTimeout(() => document.getElementById('achievements')?.scrollIntoView({ block: 'start' }), 0);
  }, []);

  const unsaved = loadStatus.kind === 'unavailable' || !store.isPersisting();

  return (
    <ProgressContext.Provider value={progress}>
      <RewardsContext.Provider value={rewardsApi}>
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

          <RewardOverlay
            current={rewards.current}
            outfit={outfit}
            sound={save.settings.sound}
            reduceMotion={reduceMotion}
            onFinish={rewards.finish}
            onOpenAchievements={openAchievements}
          />
        </div>
      </RewardsContext.Provider>
    </ProgressContext.Provider>
  );
}
