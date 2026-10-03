import { useMemo } from 'react';
import { changeCounter, toggleNothingToday } from '../actions';
import { COUNTERS, counterTotal, dayHasEntries } from '../../domain/counters';
import { dayLabel, weekdayLabel } from '../../domain/dates';
import { characterMood } from '../../domain/mood';
import { FREEZE_CAP } from '../../domain/rules';
import { EXERCISE_LABEL, formatTarget, slotFor, type Slot } from '../../domain/schedule';
import { completionFraction, findSession, isComplete, pendingMakeups, targetFor } from '../../domain/sessions';
import type { LogicalDay } from '../../domain/types';
import { ProgressBar } from '../components/ProgressBar';
import { progressText } from '../format';
import { RoomView } from '../components/RoomView';
import { useProgress } from '../hooks/useProgress';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useSave, useStoreApi } from '../hooks/useStore';

interface Props {
  today: LogicalDay;
  onLog(slot: Slot): void;
}

export function Home({ today, onLog }: Props) {
  const save = useSave();
  const { settings } = save;
  const mood = useMemo(() => characterMood(save, today), [save, today]);
  const reduceMotion = useReducedMotion(settings.reduceMotion);

  return (
    <div className="screen">
      <header className="slab slab-title">
        <h1>WORKOUT BUDDY</h1>
        <p className="slab-sub">{dayLabel(today)}</p>
      </header>

      <RoomView mood={mood} reduceMotion={reduceMotion} />

      <TodayCard today={today} onLog={onLog} />

      {today >= settings.seasonStart && <Streak />}

      {today >= settings.seasonStart && today <= settings.seasonEnd && (
        <Makeups today={today} onLog={onLog} />
      )}

      <Counters today={today} />
    </div>
  );
}

function TodayCard({ today, onLog }: Props) {
  const { settings, sessions } = useSave();

  if (today < settings.seasonStart) {
    return (
      <section className="card">
        <p className="card-kicker">FALL 2026</p>
        <h2 className="card-title">SEASON STARTS {dayLabel(settings.seasonStart)}</h2>
      </section>
    );
  }
  if (today > settings.seasonEnd) {
    return (
      <section className="card">
        <p className="card-kicker">FALL 2026</p>
        <h2 className="card-title">SEASON COMPLETE</h2>
      </section>
    );
  }

  const slot = slotFor(today, settings);
  if (!slot) {
    return (
      <section className="card">
        <p className="card-kicker">{weekdayLabel(today)}</p>
        <h2 className="card-title">REST DAY</h2>
      </section>
    );
  }

  const session = findSession(sessions, slot.day);
  const target = targetFor(slot, session, settings);
  const done = isComplete(session);

  return (
    <section className={`card${done ? ' is-done' : ''}`}>
      <p className="card-kicker">{weekdayLabel(today)} • TODAY</p>
      <h2 className="card-title">{formatTarget(slot.exercise, target)}</h2>
      <ProgressBar fraction={completionFraction(session)} label={`${EXERCISE_LABEL[slot.exercise]} progress`} />
      <div className="card-row">
        <span className="mono">{done ? 'CLEAR!' : progressText(slot.exercise, session, target)}</span>
        <button type="button" className="btn btn-primary" onClick={() => onLog(slot)}>
          {session ? 'EDIT' : 'LOG'}
        </button>
      </div>
    </section>
  );
}

function Streak() {
  const { today: snap } = useProgress();
  return (
    <section className="card streak" aria-label="Streak">
      <div className="streak-main">
        <span className="streak-num mono">{snap.streak}</span>
        <span className="streak-label">STREAK</span>
      </div>
      <dl className="streak-meta">
        <div>
          <dt>BEST</dt>
          <dd className="mono">{snap.longestStreak}</dd>
        </div>
        <div>
          <dt>FREEZES</dt>
          <dd className="mono">
            {snap.freezesBanked}/{FREEZE_CAP}
          </dd>
        </div>
        <div>
          <dt>PERFECT WEEKS</dt>
          <dd className="mono">{snap.perfectWeeks}</dd>
        </div>
      </dl>
    </section>
  );
}

function Makeups({ today, onLog }: Props) {
  const { settings, sessions } = useSave();
  const pending = pendingMakeups(today, settings, sessions);
  if (pending.length === 0) return null;
  return (
    <section className="makeups" aria-label="Make-up sessions">
      {pending.map((slot) => (
        <button key={slot.day} type="button" className="chip" onClick={() => onLog(slot)}>
          <span className="chip-tag">MAKE-UP</span>
          {weekdayLabel(slot.day)} {EXERCISE_LABEL[slot.exercise]}
        </button>
      ))}
    </section>
  );
}

function Counters({ today }: { today: LogicalDay }) {
  const store = useStoreApi();
  const { settings, counters, confirmedZeroDays } = useSave();
  const hasEntries = dayHasEntries(counters, today);
  const confirmedZero = confirmedZeroDays.includes(today);

  return (
    <section className="card" aria-label="Daily counters">
      <p className="card-kicker">TODAY'S INTAKE</p>
      {COUNTERS.map((c) => {
        const total = counterTotal(counters, c.id, today);
        const cap = settings.caps[c.id] ?? c.defaultCap;
        const over = total > cap;
        return (
          <div key={c.id} className={`counter${over ? ' is-over' : ''}`}>
            <span className="counter-label">{c.label}</span>
            <span className="counter-value mono" aria-live="polite">
              {total} / {cap}
            </span>
            <button
              type="button"
              className="btn btn-square"
              aria-label={`Remove one ${c.unit}`}
              disabled={total === 0}
              onClick={() => changeCounter(store, c.id, today, -1)}
            >
              −
            </button>
            <button
              type="button"
              className="btn btn-square"
              aria-label={`Add one ${c.unit}`}
              onClick={() => changeCounter(store, c.id, today, 1)}
            >
              +
            </button>
          </div>
        );
      })}
      <button
        type="button"
        className={`btn btn-wide${confirmedZero && !hasEntries ? ' is-active' : ''}`}
        aria-pressed={confirmedZero && !hasEntries}
        disabled={hasEntries}
        onClick={() => toggleNothingToday(store, today)}
      >
        {confirmedZero && !hasEntries ? 'NOTHING TODAY ✓' : 'NOTHING TODAY'}
      </button>
    </section>
  );
}
