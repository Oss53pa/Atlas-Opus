import type { ReactNode } from 'react';

export interface KpiItem {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** Valeur en terre cuite — signale un problème / une décision (≤ 2 par rangée). */
  accent?: boolean;
}

/**
 * Rangée d'indicateurs (handoff) — cellules égales dans un cadre unique, filets
 * verticaux 1px, label mono 10px, valeur mono 23px. L'accent est rare et signifiant.
 */
export function KpiRow({ items }: { items: KpiItem[] }) {
  return (
    <div className="ax-kpirow" style={{ ['--kpi-cols' as string]: String(items.length) }}>
      {items.map((it, i) => (
        <div key={i} className="ax-kpi">
          <div className="ax-kpi__label">{it.label}</div>
          <div className="ax-kpi__value mono" style={it.accent ? { color: 'var(--ax-accent)' } : undefined}>
            {it.value}
          </div>
          {it.sub != null && <div className="ax-kpi__sub">{it.sub}</div>}
        </div>
      ))}
    </div>
  );
}
