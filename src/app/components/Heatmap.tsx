import { useMemo, useState } from 'react';
import { COUNTERS, WEEKLY_COUNTERS, counterTotal, weekTotal } from '../../domain/counters';
import { dayLabel } from '../../domain/dates';
import { STATE_LABEL, buildHeatmap, type HeatCell } from '../../domain/heatmap';
import { DISCIPLINE_POINTS } from '../../domain/rules';
import { EXERCISE_LABEL, formatTarget } from '../../domain/schedule';
import { findSession } from '../../domain/sessions';
import { sessionDetail } from '../format';
import { useProgress } from '../hooks/useProgress';
import { useSave } from '../hooks/useStore';

const ROW_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function cellLabel(c: HeatCell): string {
  const what = c.exercise ? `${EXERCISE_LABEL[c.exercise]}, ` : '';
  const pct = c.exercise && c.state !== 'future' ? `${Math.round(c.fraction * 100)}%, ` : '';
  return `${dayLabel(c.day)}: ${what}${pct}${STATE_LABEL[c.state]}`;
}

function Snowflake() {
  return (
    <svg className="heat-icon" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M5 0v10M0 5h10M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function Heatmap() {
  const save = useSave();
  const { today: snap } = useProgress();
  const today = snap.asOf;
  const weeks = useMemo(() => buildHeatmap(snap, save.settings, today), [snap, save.settings, today]);
  const inSeasonDays = weeks.flatMap((w) => w.cells).filter((c) => c.state !== 'outside');
  const fallback = inSeasonDays.find((c) => c.isToday)?.day ?? inSeasonDays[0]?.day ?? today;
  const [selected, setSelected] = useState(fallback);
  const cell = inSeasonDays.find((c) => c.day === selected);

  return (
    <section className="card" aria-label="Season heatmap">
      <h2 className="card-kicker">FALL 2026</h2>
      <div className="heat" style={{ gridTemplateColumns: `14px repeat(${weeks.length}, 1fr)` }}>
        <span />
        {weeks.map((w) => (
          <span key={w.start} className="heat-month">
            {w.month ?? ''}
          </span>
        ))}
        {ROW_LABELS.map((label, row) => (
          <Row key={row} label={label} row={row} weeks={weeks} selected={selected} onSelect={setSelected} />
        ))}
      </div>

      <ul className="heat-legend" aria-label="Legend">
        <li>
          <span className="heat-swatch lvl-0" /> 0%
        </li>
        <li>
          <span className="heat-swatch lvl-1" /> &lt;50%
        </li>
        <li>
          <span className="heat-swatch lvl-2" /> &lt;100%
        </li>
        <li>
          <span className="heat-swatch lvl-3" /> DONE
        </li>
        <li>
          <span className="heat-swatch is-frozen">
            <Snowflake />
          </span>{' '}
          FREEZE
        </li>
        <li>
          <span className="heat-swatch is-rest" /> REST
        </li>
      </ul>

      {cell && <DayDetail cell={cell} />}
    </section>
  );
}

interface RowProps {
  label: string;
  row: number;
  weeks: ReturnType<typeof buildHeatmap>;
  selected: string;
  onSelect(day: string): void;
}

function Row({ label, row, weeks, selected, onSelect }: RowProps) {
  return (
    <>
      <span className="heat-row-label" aria-hidden="true">
        {label}
      </span>
      {weeks.map((w) => {
        const c = w.cells[row]!;
        if (c.state === 'outside') return <span key={c.day} className="heat-cell is-outside" />;
        const cls = [
          'heat-cell',
          `lvl-${c.level}`,
          `is-${c.state}`,
          c.isToday ? 'is-today' : '',
          c.day === selected ? 'is-selected' : '',
        ].join(' ');
        const label = cellLabel(c);
        return (
          <button
            key={c.day}
            type="button"
            className={cls}
            aria-label={label}
            title={label}
            aria-pressed={c.day === selected}
            onClick={() => onSelect(c.day)}
          >
            {c.state === 'frozen' && <Snowflake />}
          </button>
        );
      })}
    </>
  );
}

function DayDetail({ cell }: { cell: HeatCell }) {
  const save = useSave();
  const { today: snap } = useProgress();
  const session = findSession(save.sessions, cell.day);
  const decided = cell.day < snap.asOf;
  const qualified = snap.disciplineDays.includes(cell.day);
  const confirmedZero = save.confirmedZeroDays.includes(cell.day);

  return (
    <div className="heat-detail" aria-live="polite">
      <p className="card-kicker">
        {dayLabel(cell.day)}
        {cell.isToday && <span className="chip-tag">TODAY</span>}
      </p>
      <ul className="history">
        <li className={cell.state === 'done' ? 'is-done' : ''}>
          <span>
            {cell.exercise ? formatTarget(cell.exercise, session?.target ?? save.settings.targets[cell.exercise]) : 'REST DAY'}
            <small className="ach-desc">{STATE_LABEL[cell.state]}</small>
          </span>
          <span className="mono">{session ? sessionDetail(session) : '—'}</span>
        </li>
        {COUNTERS.map((c) => {
          const total = counterTotal(save.counters, c.id, cell.day);
          const cap = save.settings.caps[c.id] ?? c.defaultCap;
          return (
            <li key={c.id}>
              <span>{c.label}</span>
              <span className={`mono${total > cap ? ' is-over-text' : ''}`}>
                {total} / {cap}
              </span>
            </li>
          );
        })}
        {WEEKLY_COUNTERS.map((c) => {
          const week = weekTotal(save.counters, c.id, cell.day);
          const cap = save.settings.caps[c.id] ?? c.defaultCap;
          return (
            <li key={c.id}>
              <span>
                {c.label}
                <small className="ach-desc">This day: {counterTotal(save.counters, c.id, cell.day)}</small>
              </span>
              <span className={`mono${week > cap ? ' is-over-text' : ''}`}>
                WEEK {week} / {cap}
              </span>
            </li>
          );
        })}
        <li>
          <span>
            DISCIPLINE
            {confirmedZero && <small className="ach-desc">“Nothing today” confirmed</small>}
          </span>
          <span className="mono">{!decided ? 'TBD' : qualified ? `+${DISCIPLINE_POINTS}` : '0'}</span>
        </li>
      </ul>
    </div>
  );
}
