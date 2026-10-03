export function ProgressBar({ fraction, label }: { fraction: number; label: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div className={`progress-fill${pct >= 100 ? ' is-full' : ''}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
