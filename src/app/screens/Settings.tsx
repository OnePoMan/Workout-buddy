import { useRef, useState } from 'react';
import { replaceAll, resetAll, updateSettings } from '../actions';
import { CAP_MAX, CAP_MIN, COUNTERS } from '../../domain/counters';
import { fullDate, isValidDay, weekdayLabel } from '../../domain/dates';
import { EXERCISE_LABEL } from '../../domain/schedule';
import { TARGET_LIMITS, isValidCap, isValidTarget } from '../../domain/settings';
import { EXERCISES, type HairSetting, type LogicalDay, type ReduceMotion } from '../../domain/types';
import { resolveHair } from '../../domain/unlocks';
import { useUnlocks } from '../hooks/useUnlocks';
import { exportFileName, parseImport, serialize } from '../../storage/exportImport';
import { useSave, useStoreApi } from '../hooks/useStore';

interface NumberFieldProps {
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  isValid(n: number): boolean;
  onCommit(n: number): void;
}

/** Edits as text, commits on blur or Enter, and reverts if the value is invalid. */
function NumberField({ label, value, step, min, max, isValid, onCommit }: NumberFieldProps) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const commit = () => {
    if (text === null) return;
    const n = Number(text);
    if (text.trim() !== '' && isValid(n)) {
      if (n !== value) onCommit(n);
      setError(false);
    } else {
      setError(true);
    }
    setText(null);
  };
  return (
    <label className={`field${error ? ' has-error' : ''}`}>
      <span>{label}</span>
      <input
        type="number"
        inputMode={step < 1 ? 'decimal' : 'numeric'}
        step={step}
        min={min}
        max={max}
        value={text ?? String(value)}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
      {error && <small className="field-error">Must be {min}–{max}. Reverted.</small>}
    </label>
  );
}

export function Settings({ today }: { today: LogicalDay }) {
  const store = useStoreApi();
  const save = useSave();
  const { settings } = save;
  const unlocks = useUnlocks();
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const doExport = () => {
    const blob = new Blob([serialize(save)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFileName(today);
    a.click();
    URL.revokeObjectURL(url);
    setMessage({ kind: 'ok', text: `Exported ${a.download}.` });
  };

  const doImport = async (file: File) => {
    try {
      const imported = parseImport(await file.text());
      if (!window.confirm('Replace ALL current data with this file? This cannot be undone.')) return;
      replaceAll(store, imported);
      setMessage({ kind: 'ok', text: `Imported ${imported.sessions.length} sessions.` });
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Import failed.' });
    }
  };

  const doReset = () => {
    const typed = window.prompt('This erases all data. Type RESET to confirm.');
    if (typed !== 'RESET') return;
    resetAll(store, today);
    setMessage({ kind: 'ok', text: 'All data erased.' });
  };

  return (
    <div className="screen">
      <header className="slab slab-title">
        <h1>SETTINGS</h1>
      </header>

      <section className="card">
        <h2 className="card-kicker">TARGETS</h2>
        <p className="hint">Applies to sessions not logged yet. Logged sessions keep their target.</p>
        {EXERCISES.map((ex) => {
          const lim = TARGET_LIMITS[ex];
          return (
            <NumberField
              key={ex}
              label={ex === 'run' ? `${EXERCISE_LABEL[ex]} (MI)` : `${EXERCISE_LABEL[ex]} (REPS)`}
              value={settings.targets[ex]}
              step={lim.step}
              min={lim.min}
              max={lim.max}
              isValid={(n) => isValidTarget(ex, n)}
              onCommit={(n) => updateSettings(store, { targets: { ...settings.targets, [ex]: n } })}
            />
          );
        })}
      </section>

      <section className="card">
        <h2 className="card-kicker">DAILY SOFT CAPS</h2>
        {COUNTERS.map((c) => (
          <NumberField
            key={c.id}
            label={c.label}
            value={settings.caps[c.id] ?? c.defaultCap}
            step={1}
            min={CAP_MIN}
            max={CAP_MAX}
            isValid={isValidCap}
            onCommit={(n) => updateSettings(store, { caps: { ...settings.caps, [c.id]: n } })}
          />
        ))}
      </section>

      <section className="card">
        <h2 className="card-kicker">SEASON</h2>
        <label className="field">
          <span>START</span>
          <input
            type="date"
            value={settings.seasonStart}
            max={settings.seasonEnd}
            onChange={(e) => {
              const v = e.target.value;
              if (isValidDay(v) && v <= settings.seasonEnd) updateSettings(store, { seasonStart: v });
            }}
          />
        </label>
        <p className="hint">
          Ends {weekdayLabel(settings.seasonEnd)} {fullDate(settings.seasonEnd)}.
        </p>
        <label className="field">
          <span>DAY ENDS AT</span>
          <select
            value={settings.rolloverHour}
            onChange={(e) => updateSettings(store, { rolloverHour: Number(e.target.value) })}
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, '0')}:00
              </option>
            ))}
          </select>
        </label>
        <p className="hint">Anything logged before this hour counts toward the previous day.</p>
      </section>

      <section className="card">
        <h2 className="card-kicker">PRESENTATION</h2>
        <label className="field field-inline">
          <span>SOUND</span>
          <input
            type="checkbox"
            checked={settings.sound}
            onChange={(e) => updateSettings(store, { sound: e.target.checked })}
          />
        </label>
        <label className="field">
          <span>REDUCE MOTION</span>
          <select
            value={settings.reduceMotion}
            onChange={(e) => updateSettings(store, { reduceMotion: e.target.value as ReduceMotion })}
          >
            <option value="system">FOLLOW SYSTEM</option>
            <option value="on">ON</option>
            <option value="off">OFF</option>
          </select>
        </label>
        <p className="hint">Sound plays with reward animations. It starts after your first tap.</p>
        {unlocks.has.has('ponytail') && (
          <label className="field">
            <span>HAIR</span>
            <select
              value={resolveHair(settings.hair, unlocks)}
              onChange={(e) => updateSettings(store, { hair: e.target.value as HairSetting })}
            >
              <option value="ponytail">PONYTAIL</option>
              <option value="down">DOWN</option>
            </select>
          </label>
        )}
      </section>

      <section className="card">
        <h2 className="card-kicker">DATA</h2>
        <p className="hint">Data is stored only on this device.</p>
        <div className="button-col">
          <button type="button" className="btn btn-wide" onClick={doExport}>
            EXPORT JSON
          </button>
          <button type="button" className="btn btn-wide" onClick={() => fileInput.current?.click()}>
            IMPORT JSON
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void doImport(file);
            }}
          />
          <button type="button" className="btn btn-wide btn-danger" onClick={doReset}>
            RESET ALL DATA
          </button>
        </div>
        {message && (
          <p className={message.kind === 'error' ? 'field-error' : 'hint'} role="status">
            {message.text}
          </p>
        )}
      </section>
    </div>
  );
}
