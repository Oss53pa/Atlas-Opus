import type { ReactNode } from 'react';

export type CellAlign = 'left' | 'right';

export interface Column {
  label: ReactNode;
  align?: CellAlign;
}

export interface TableRowData {
  cells: ReactNode[];
  onClick?: () => void;
}

interface DataTableProps {
  /** `grid-template-columns` (ex. « 1.6fr 1fr 1fr auto »). */
  template: string;
  columns: Column[];
  rows: TableRowData[];
  /** Ligne de total (fond crème appuyé, 14px/600). */
  total?: { cells: ReactNode[] };
  /** Message vide (aucune ligne). */
  empty?: ReactNode;
}

/**
 * Tableau (handoff) — pas de `<table>` : une grille CSS par ligne, mêmes fractions
 * sur l'en-tête et les lignes. En-tête mono 10px, filets 1px, alignement à droite
 * pour les nombres, ligne de total optionnelle.
 */
export function DataTable({ template, columns, rows, total, empty }: DataTableProps) {
  return (
    <div className="ax-table">
      <div className="ax-table__head" style={{ gridTemplateColumns: template }}>
        {columns.map((c, i) => (
          <div key={i} className={c.align === 'right' ? 'text-right' : undefined}>
            {c.label}
          </div>
        ))}
      </div>
      {rows.length === 0 ? (
        empty != null && <div className="ax-table__empty">{empty}</div>
      ) : (
        rows.map((r, ri) => (
          <div
            key={ri}
            className={['ax-table__row', r.onClick && 'is-clickable'].filter(Boolean).join(' ')}
            style={{ gridTemplateColumns: template }}
            onClick={r.onClick}
            role={r.onClick ? 'button' : undefined}
            tabIndex={r.onClick ? 0 : undefined}
            onKeyDown={r.onClick ? (e) => { if (e.key === 'Enter') r.onClick!(); } : undefined}
          >
            {r.cells.map((cell, ci) => (
              <div key={ci} className={columns[ci]?.align === 'right' ? 'text-right' : undefined}>
                {cell}
              </div>
            ))}
          </div>
        ))
      )}
      {total && (
        <div className="ax-table__total" style={{ gridTemplateColumns: template }}>
          {total.cells.map((cell, i) => (
            <div key={i} className={columns[i]?.align === 'right' ? 'text-right' : undefined}>
              {cell}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
