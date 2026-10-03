import { LOCKABLE, formatPbValue, metricLabel } from '../../domain/achievements';
import { dayLabel } from '../../domain/dates';
import { RANK_THRESHOLDS, STATS, STAT_LABEL } from '../../domain/rules';
import { EXERCISE_LABEL } from '../../domain/schedule';
import { isComplete } from '../../domain/sessions';
import { ProgressBar } from '../components/ProgressBar';
import { sessionDetail } from '../format';
import { useProgress } from '../hooks/useProgress';
import { useSave } from '../hooks/useStore';

export function Stats() {
  const { sessions } = useSave();
  const { today: snap, earned } = useProgress();
  const history = [...sessions].sort((a, b) => (a.slot < b.slot ? 1 : -1));
  const bests = Object.values(snap.bests).sort((a, b) => (a.metric < b.metric ? -1 : 1));
  const earnedSorted = [...earned].sort((a, b) => (a.lastOn < b.lastOn ? 1 : a.lastOn > b.lastOn ? -1 : 0));
  const earnedIds = new Set(earned.map((e) => e.def.id));
  const locked = LOCKABLE.filter((d) => !earnedIds.has(d.id));

  return (
    <div className="screen">
      <header className="slab slab-title">
        <h1>STATS</h1>
      </header>

      <section className="card" aria-label="Stat ranks">
        <h2 className="card-kicker">RANKS</h2>
        {STATS.map((st) => {
          const s = snap.stats[st];
          const floor = RANK_THRESHOLDS[s.rank - 1] ?? 0;
          const fraction = s.next === null ? 1 : (s.points - floor) / (s.next - floor);
          return (
            <div key={st} className="stat">
              <div className="card-row">
                <span className="stat-label">{STAT_LABEL[st]}</span>
                <span className="mono">
                  RANK {s.rank} • {s.points}
                  {s.next !== null ? ` / ${s.next}` : ' MAX'}
                </span>
              </div>
              <ProgressBar fraction={fraction} label={`${STAT_LABEL[st]} progress to next rank`} />
            </div>
          );
        })}
      </section>

      <section className="card" aria-label="Personal bests">
        <h2 className="card-kicker">PERSONAL BESTS</h2>
        <ul className="history">
          <li>
            <span>LONGEST STREAK</span>
            <span className="mono">{snap.longestStreak}</span>
          </li>
          <li>
            <span>PERFECT WEEKS IN A ROW</span>
            <span className="mono">{snap.longestPerfectWeekRun}</span>
          </li>
          {bests.map((ev) => (
            <li key={ev.metric}>
              <span>{metricLabel(ev)}</span>
              <span className="mono">
                {formatPbValue(ev)} • {dayLabel(ev.day)}
                {ev.previous !== null && <span className="pb-prev"> (was {formatPbValue({ kind: ev.kind, value: ev.previous })})</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card" aria-label="Achievements" id="achievements">
        <h2 className="card-kicker">ACHIEVEMENTS</h2>
        {earnedSorted.length === 0 && <p className="hint">None yet.</p>}
        <ul className="history">
          {earnedSorted.map((e) => (
            <li key={e.def.id} className="is-done">
              <span>
                {e.def.name}
                {e.count > 1 && <span className="chip-tag">×{e.count}</span>}
                <small className="ach-desc">{e.def.description}</small>
              </span>
              <span className="mono">{dayLabel(e.lastOn)}</span>
            </li>
          ))}
        </ul>
        {locked.length > 0 && (
          <>
            <h3 className="card-kicker">LOCKED</h3>
            <ul className="history is-locked">
              {locked.map((d) => (
                <li key={d.id}>
                  <span>
                    {d.name}
                    <small className="ach-desc">{d.description}</small>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="card" aria-label="History">
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
