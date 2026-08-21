import type { ReactNode } from 'react';

interface ProgressProps {
  /** Ratio 0–1. */
  value: number;
  label?: ReactNode;
}

export function Progress({ value, label }: ProgressProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div>
      <div
        className="ax-progress"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="ax-progress__bar" style={{ width: `${pct}%` }} />
      </div>
      {label && <div className="mt-1.5 text-[11px] text-ink-3">{label}</div>}
    </div>
  );
}
