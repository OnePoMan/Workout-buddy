import { dayLabel } from '../../domain/dates';
import { EXERCISE_LABEL } from '../../domain/schedule';
import { isComplete } from '../../domain/sessions';
import { sessionDetail } from '../format';
import { useSave } from '../hooks/useStore';

export function Stats() {
  const { sessions } = useSave();
  const history = [...sessions].sort((a, b) => (a.slot < b.slot ? 1 : -1));

  return (
    <div className="screen">
      <header className="slab slab-title">
        <h1>STATS</h1>
      </header>
      <section className="card">
        <p className="hint">Heatmap, stat ranks and personal bests arrive in later milestones.</p>
      </section>
      <section className="card">
        <h2 className="card-kicker">HISTORY</h2>
        {history.length === 0 ? (
          <p className="hint">No sessions logged yet.</p>
        ) : (
          <ul className="history">
            {history.map((s) => (
              <li key={s.id} className={isComplete(s) ? 'is-done' : ''}>
                <span>
                  {dayLabel(s.slot)} • {EXERCISE_LABEL[s.exercise]}
                  {s.loggedOn !== s.slot && <span className="chip-tag">MAKE-UP</span>}
                </span>
                <span className="mono">{sessionDetail(s)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
