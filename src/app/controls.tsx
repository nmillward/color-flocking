import type { CSSProperties, ReactNode } from 'react';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** 'log' spreads small values out (useful for cell size). */
  scale?: 'linear' | 'log';
  format?: (v: number) => string;
  hint?: string;
  disabled?: boolean;
  onChange: (v: number) => void;
}

const LOG_STEPS = 1000;

export function Slider({ label, value, min, max, step = 0.01, scale = 'linear', format, hint, disabled, onChange }: SliderProps) {
  const isLog = scale === 'log';
  const toRaw = (v: number) => (isLog ? (Math.log(v / min) / Math.log(max / min)) * LOG_STEPS : v);
  const fromRaw = (r: number) => {
    const v = isLog ? min * Math.pow(max / min, r / LOG_STEPS) : r;
    const snapped = Math.round(v / step) * step;
    return Math.min(max, Math.max(min, Number(snapped.toFixed(4))));
  };
  const raw = toRaw(value);
  const lo = isLog ? 0 : min;
  const hi = isLog ? LOG_STEPS : max;
  const pct = ((raw - lo) / (hi - lo)) * 100;

  return (
    <label className={`ctl ctl-slider${disabled ? ' is-disabled' : ''}`} title={hint}>
      <span className="ctl-row">
        <span className="ctl-label">{label}</span>
        <span className="ctl-value">{format ? format(value) : trimNumber(value)}</span>
      </span>
      <input
        type="range"
        min={lo}
        max={hi}
        step={isLog ? 1 : step}
        value={raw}
        disabled={disabled}
        style={{ '--fill': `${pct}%` } as CSSProperties}
        onChange={(e) => onChange(fromRaw(Number(e.target.value)))}
      />
    </label>
  );
}

interface SegmentedProps<T extends string | number> {
  label?: string;
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (v: T) => void;
  hint?: string;
}

export function Segmented<T extends string | number>({ label, value, options, onChange, hint }: SegmentedProps<T>) {
  return (
    <div className="ctl" title={hint}>
      {label && (
        <span className="ctl-row">
          <span className="ctl-label">{label}</span>
        </span>
      )}
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            className={o.value === value ? 'is-active' : ''}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <div className="ctl ctl-toggle" title={hint}>
      <span className="ctl-label">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        className={`switch${value ? ' is-on' : ''}`}
        onClick={() => onChange(!value)}
      >
        <span />
      </button>
    </div>
  );
}

export function Section({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <section className="panel-section">
      <h3>{title}</h3>
      {note && <p className="section-note">{note}</p>}
      {children}
    </section>
  );
}

export function trimNumber(v: number) {
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(Math.abs(v) < 0.1 ? 3 : 2).replace(/0+$/, '').replace(/\.$/, '');
}
