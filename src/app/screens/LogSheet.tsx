import { useEffect, useRef, useState } from 'react';
import { deleteSession, saveSession } from '../actions';
import { dayLabel, formatDuration } from '../../domain/dates';
import { newId } from '../../domain/ids';
import { EXERCISE_LABEL, formatTarget, type Slot } from '../../domain/schedule';
import { MAX_REPS_PER_SET } from '../../domain/settings';
import { completionFraction, findSession, isEditable, sameContent, targetFor, totalReps } from '../../domain/sessions';
import type { LogicalDay, SessionLog } from '../../domain/types';
import { ProgressBar } from '../components/ProgressBar';
import { Stepper } from '../components/Stepper';
import { useStopwatch, type Stopwatch } from '../hooks/useStopwatch';
import { useSave, useStoreApi } from '../hooks/useStore';

interface Props {
  slot: Slot;
  today: LogicalDay;
  onClose(): void;
}

export function LogSheet({ slot, today, onClose }: Props) {
  const store = useStoreApi();
  const { sessions, settings } = useSave();
  const existing = findSession(sessions, slot.day);
  const target = targetFor(slot, existing, settings);
  const isRun = slot.exercise === 'run';
  const isMakeup = slot.day !== today;

  const [sets, setSets] = useState<number[]>(existing?.sets ?? []);
  const [editing, setEditing] = useState<number | null>(null);
  const [reps, setReps] = useState(() => Math.max(1, Math.min(target, MAX_REPS_PER_SET)));
  const [distance, setDistance] = useState(String(existing?.distance ?? target));
  const [minutes, setMinutes] = useState(existing?.durationSec !== undefined && isRun ? String(Math.floor(existing.durationSec / 60)) : '');
  const [seconds, setSeconds] = useState(existing?.durationSec !== undefined && isRun ? String(Math.floor(existing.durationSec % 60)) : '');
  const stopwatch = useStopwatch(!isRun ? (existing?.durationSec ?? 0) : 0);

  const repsDone = totalReps(sets);

  // Strength: the stopwatch stops itself on the set that reaches the target.
  const { running, stop } = stopwatch;
  useEffect(() => {
    if (!isRun && running && repsDone >= target) stop();
  }, [isRun, running, repsDone, target, stop]);

  const distanceNum = Number.parseFloat(distance);
  const timePart = (text: string) => Math.max(0, Number.parseInt(text || '0', 10) || 0);
  const runSec = timePart(minutes) * 60 + timePart(seconds);

  const draft: SessionLog = {
    id: existing?.id ?? newId(),
    slot: slot.day,
    loggedOn: existing?.loggedOn ?? today,
    exercise: slot.exercise,
    target,
    updatedAt: existing?.updatedAt ?? '',
  };
  if (isRun) {
    draft.distance = Number.isFinite(distanceNum) ? Math.max(0, Math.round(distanceNum * 100) / 100) : 0;
    if (runSec > 0) draft.durationSec = runSec;
  } else {
    draft.sets = sets;
    if (stopwatch.elapsed > 0) draft.durationSec = Math.round(stopwatch.elapsed * 10) / 10;
  }

  const canSave = isRun ? (draft.distance ?? 0) > 0 : sets.length > 0;
  const dirty = existing
    ? !sameContent(draft, existing)
    : sets.length > 0 || (isRun && runSec > 0) || stopwatch.elapsed > 0;

  const close = () => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    onClose();
  };

  // Escape closes the sheet like the × button.
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const commitSet = () => {
    if (editing !== null) {
      setSets(sets.map((v, i) => (i === editing ? reps : v)));
      setEditing(null);
    } else {
      const next = [...sets, reps];
      setSets(next);
      // Pre-fill the next set with what is left, so finishing takes one tap.
      const left = target - totalReps(next);
      if (left > 0) setReps(Math.min(left, MAX_REPS_PER_SET));
    }
  };

  const save = () => {
    if (!isEditable(slot.day, today)) {
      window.alert('That week has ended, so this session can no longer be changed.');
      onClose();
      return;
    }
    const final: SessionLog = { ...draft, updatedAt: new Date().toISOString() };
    if (stopwatch.running) {
      const sec = stopwatch.stop();
      final.durationSec = isRun ? Math.round(sec) : Math.round(sec * 10) / 10;
    }
    saveSession(store, final);
    onClose();
  };

  const remove = () => {
    if (!window.confirm(`Delete the ${EXERCISE_LABEL[slot.exercise]} log for ${dayLabel(slot.day)}?`)) return;
    deleteSession(store, slot.day);
    onClose();
  };

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="log-title">
      <header className="sheet-head">
        <div>
          <p className="card-kicker">
            {dayLabel(slot.day)}
            {isMakeup && <span className="chip-tag">MAKE-UP</span>}
          </p>
          <h2 id="log-title" className="card-title">
            {formatTarget(slot.exercise, target)}
          </h2>
        </div>
        <button type="button" className="btn btn-square" aria-label="Close" onClick={close}>
          ×
        </button>
      </header>

      <div className="sheet-body">
        <ProgressBar fraction={completionFraction(draft)} label="Progress" />

        {isRun ? (
          <section className="card">
            <label className="field">
              <span>DISTANCE (MI)</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
              />
            </label>
            <div className="field">
              <span>TIME</span>
              <div className="time-inputs">
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  placeholder="mm"
                  aria-label="Minutes"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                />
                <span>:</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="59"
                  placeholder="ss"
                  aria-label="Seconds"
                  value={seconds}
                  onChange={(e) => setSeconds(e.target.value)}
                />
              </div>
            </div>
            <StopwatchPanel
              stopwatch={stopwatch}
              onStop={(sec) => {
                setMinutes(String(Math.floor(sec / 60)));
                setSeconds(String(Math.floor(sec % 60)));
              }}
            />
          </section>
        ) : (
          <>
            <section className="card">
              <p className="card-kicker">
                {editing !== null ? `EDIT SET ${editing + 1}` : `SET ${sets.length + 1}`}
              </p>
              <Stepper value={reps} min={1} max={MAX_REPS_PER_SET} onChange={setReps} label="Reps" />
              <div className="card-row">
                {editing !== null && (
                  <button type="button" className="btn" onClick={() => setEditing(null)}>
                    CANCEL
                  </button>
                )}
                <button type="button" className="btn btn-primary btn-grow" onClick={commitSet}>
                  {editing !== null ? 'UPDATE SET' : '+ SET'}
                </button>
              </div>
              <p className="mono total">
                {repsDone} / {target}
              </p>
              {sets.length > 0 && (
                <ol className="sets">
                  {sets.map((n, i) => (
                    <li key={i} className={editing === i ? 'is-editing' : ''}>
                      <button
                        type="button"
                        className="set-pick"
                        onClick={() => {
                          setEditing(i);
                          setReps(n);
                        }}
                      >
                        SET {i + 1} — <span className="mono">{n}</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-square"
                        aria-label={`Delete set ${i + 1}`}
                        onClick={() => {
                          setSets(sets.filter((_, j) => j !== i));
                          setEditing(null);
                        }}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </section>
            <section className="card">
              <StopwatchPanel stopwatch={stopwatch} />
            </section>
          </>
        )}
      </div>

      <footer className="sheet-foot">
        {existing && (
          <button type="button" className="btn btn-danger" onClick={remove}>
            DELETE
          </button>
        )}
        <button type="button" className="btn btn-primary btn-grow btn-big" disabled={!canSave} onClick={save}>
          DONE
        </button>
      </footer>
    </div>
  );
}

function StopwatchPanel({ stopwatch, onStop }: { stopwatch: Stopwatch; onStop?(sec: number): void }) {
  return (
    <div className="stopwatch">
      <span className="stopwatch-time mono" aria-live="off">
        {formatDuration(stopwatch.elapsed, true)}
      </span>
      {stopwatch.running ? (
        <button type="button" className="btn" onClick={() => onStop?.(stopwatch.stop())}>
          STOP
        </button>
      ) : (
        <button type="button" className="btn" onClick={stopwatch.start}>
          {stopwatch.elapsed > 0 ? 'RESUME' : 'START'}
        </button>
      )}
      <button type="button" className="btn" disabled={stopwatch.running || stopwatch.elapsed === 0} onClick={stopwatch.reset}>
        RESET
      </button>
    </div>
  );
}
