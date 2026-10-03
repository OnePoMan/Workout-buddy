interface Props {
  value: number;
  min: number;
  max: number;
  onChange(value: number): void;
  label: string;
}

export function Stepper({ value, min, max, onChange, label }: Props) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" className="btn btn-square" onClick={() => onChange(clamp(value - 1))} aria-label="Decrease">
        −
      </button>
      <input
        className="stepper-value"
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        aria-label={label}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10);
          if (Number.isFinite(n)) onChange(clamp(n));
        }}
      />
      <button type="button" className="btn btn-square" onClick={() => onChange(clamp(value + 1))} aria-label="Increase">
        +
      </button>
    </div>
  );
}
