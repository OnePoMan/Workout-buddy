import type { SeasonRecap } from '../../domain/rewards';
import { STATS, STAT_LABEL } from '../../domain/rules';

/** Season totals and final ranks; used by the finale's summary card and the Stats screen. */
export function SeasonSummary({ recap }: { recap: SeasonRecap }) {
  const rows: [string, string][] = [
    ['SESSIONS COMPLETED', String(recap.sessions)],
    ['PERFECT WEEKS', String(recap.perfectWeeks)],
    ['LONGEST STREAK', String(recap.longestStreak)],
    ['BEST MILE PACE', recap.bestPace ?? '—'],
    ['ACHIEVEMENTS', String(recap.achievements)],
  ];
  return (
    <>
      <ul className="history">
        {rows.map(([label, value]) => (
          <li key={label}>
            <span>{label}</span>
            <span className="mono">{value}</span>
          </li>
        ))}
      </ul>
      <p className="card-kicker">FINAL RANKS</p>
      <ul className="history">
        {STATS.map((st) => (
          <li key={st}>
            <span>{STAT_LABEL[st]}</span>
            <span className="mono">RANK {recap.ranks[st]}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
