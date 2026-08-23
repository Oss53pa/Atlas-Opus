import type { ReactNode } from 'react';

export type FactSeverity = 'accent' | 'neutral' | 'danger';

export interface Fact {
  label: ReactNode;
  value?: ReactNode;
  sub?: ReactNode;
  /** Barre verticale 3px de sévérité en tête de ligne. */
  severity?: FactSeverity;
  onClick?: () => void;
}

const BAR: Record<FactSeverity, string> = {
  accent: 'var(--ax-accent)',
  neutral: 'var(--ax-border)',
  danger: 'var(--ax-danger)',
};

/**
 * Liste de faits (handoff) — motif dominant de la colonne de droite. Chaque ligne :
 * barre de sévérité optionnelle (3px), libellé à gauche, valeur mono à droite,
 * sous-titre optionnel en dessous.
 */
export function FactList({ items }: { items: Fact[] }) {
  return (
    <ul className="ax-facts">
      {items.map((f, i) => (
        <li
          key={i}
          className={['ax-fact', f.onClick && 'is-clickable'].filter(Boolean).join(' ')}
          onClick={f.onClick}
          role={f.onClick ? 'button' : undefined}
          tabIndex={f.onClick ? 0 : undefined}
          onKeyDown={f.onClick ? (e) => { if (e.key === 'Enter') f.onClick!(); } : undefined}
        >
          {f.severity && <span className="ax-fact__bar" style={{ background: BAR[f.severity] }} aria-hidden="true" />}
          <div className="min-w-0 flex-1">
            <div className="ax-fact__label">{f.label}</div>
            {f.sub != null && <div className="ax-fact__sub">{f.sub}</div>}
          </div>
          {f.value != null && <div className="ax-fact__value mono">{f.value}</div>}
        </li>
      ))}
    </ul>
  );
}
