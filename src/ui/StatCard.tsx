import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
  /** Accent ambre sur la valeur (KPI mis en avant : marge, TRI). */
  emphasis?: boolean;
}

/** Tuile KPI — surface verre subtile, label discret, valeur en avant. */
export function StatCard({ label, children, hint, emphasis = false }: StatCardProps) {
  return (
    <div className="ax-card ax-card--subtle p-4">
      <div className="text-[11px] uppercase tracking-wide text-ink-3">{label}</div>
      <div
        className="mt-1.5 text-lg"
        style={{ fontWeight: 500, color: emphasis ? 'var(--ax-accent-strong)' : 'var(--ax-text)' }}
      >
        {children}
      </div>
      {hint && <div className="mt-1 text-[11px] text-ink-3">{hint}</div>}
    </div>
  );
}
