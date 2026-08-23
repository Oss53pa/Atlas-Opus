import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
  /** Accent terre cuite sur la valeur — signale un problème / une décision. */
  emphasis?: boolean;
}

/**
 * Tuile KPI autonome (handoff) — cadre crème, label mono 10px majuscules,
 * valeur mono 23px. Pour la rangée à cadre unique, préférer `KpiRow`.
 */
export function StatCard({ label, children, hint, emphasis = false }: StatCardProps) {
  return (
    <div className="ax-card" style={{ padding: '15px 18px' }}>
      <div className="ax-kpi__label">{label}</div>
      <div className="ax-kpi__value mono" style={emphasis ? { color: 'var(--ax-accent)' } : undefined}>
        {children}
      </div>
      {hint && <div className="ax-kpi__sub">{hint}</div>}
    </div>
  );
}
