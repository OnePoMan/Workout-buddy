import { useEffect, useRef } from 'react';
import { undoCounterEntry } from '../actions';
import { counterEntries, isWeeklyCounter, weekCounterEntries, type CounterDef } from '../../domain/counters';
import { dayLabel, weekStart, weekdayLabel } from '../../domain/dates';
import type { LogicalDay } from '../../domain/types';
import { useSave, useStoreApi } from '../hooks/useStore';

interface Props {
  counter: CounterDef;
  day: LogicalDay;
  onClose(): void;
}

function timeOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Today's entries for one counter (this week's for a weekly counter), with undo of the latest. */
export function CounterHistory({ counter, day, onClose }: Props) {
  const store = useStoreApi();
  const { counters } = useSave();
  const weekly = isWeeklyCounter(counter.id);
  const entries = weekly ? weekCounterEntries(counters, counter.id, day) : counterEntries(counters, counter.id, day);
  const closeRef = useRef<HTMLButtonElement>(null);
  let running = 0;
  const rows = entries.map((e) => {
    running = Math.max(0, running + e.delta);
    return { e, total: running };
  });
  const last = entries.at(-1);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (ev: KeyboardEvent) => ev.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-scrim" onPointerDown={onClose}>
      <div
        className="card modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="counter-history-title"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <p className="card-kicker">{weekly ? `WEEK OF ${dayLabel(weekStart(day))}` : dayLabel(day)}</p>
        <h2 id="counter-history-title" className="card-title">
          {counter.label}
        </h2>
        {rows.length === 0 ? (
          <p className="hint">{weekly ? 'Nothing logged this week.' : 'Nothing logged today.'}</p>
        ) : (
          <ol className="history">
            {rows.map(({ e, total }) => (
              <li key={e.id}>
                <span className="mono">
                  {weekly && `${weekdayLabel(e.day)} `}
                  {timeOf(e.at)}
                </span>
                <span className="mono">
                  {e.delta > 0 ? '+1' : '−1'} → {total}
                </span>
              </li>
            ))}
          </ol>
        )}
        <div className="card-row">
          <button type="button" className="btn" ref={closeRef} onClick={onClose}>
            CLOSE
          </button>
          <button
            type="button"
            className="btn btn-danger btn-grow"
            disabled={!last}
            onClick={() => last && undoCounterEntry(store, last.id)}
          >
            UNDO LAST
          </button>
        </div>
      </div>
    </div>
  );
}
