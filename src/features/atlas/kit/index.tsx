/**
 * Kit de primitives Atlas Opus — composants document réutilisables.
 * Aucune valeur de design en dur : tout passe par les classes .ao-* (index.css).
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { FactItem, Kpi, TableCell, TableCol } from '../data';

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ');

// ── Wordmark ─────────────────────────────────────────────────────────────────
export function Wordmark({ size = 21 }: { size?: number }) {
  return (
    <span className="ao-wordmark">
      <span className="ao-wordmark__square" />
      <span className="ao-wordmark__text" style={{ fontSize: size }}>Atlas Opus</span>
    </span>
  );
}

// ── Boutons ──────────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'ghost';
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: BtnVariant; block?: boolean; }
export function Button({ variant = 'secondary', block, className, children, ...rest }: BtnProps) {
  return (
    <button className={cx('ao-btn', `ao-btn--${variant}`, block && 'ao-btn--block', className)} {...rest}>
      {children}
    </button>
  );
}

// ── Badge de statut ──────────────────────────────────────────────────────────
export function Badge({ label, kind = 'neutral' }: { label: string; kind?: NonNullable<TableCell['badge']>['kind'] }) {
  return <span className={cx('ao-badge', `ao-badge--${kind}`)}>{label}</span>;
}

// ── Pastille de phase ────────────────────────────────────────────────────────
export function PhaseChip({ label, current }: { label: string; current?: boolean }) {
  return <span className={cx('ao-phase', current && 'is-current')}>{label}</span>;
}

// ── Rangée d'indicateurs (KPI) ───────────────────────────────────────────────
export function Kpis({ items }: { items: Kpi[] }) {
  return (
    <div className="ao-kpis" style={{ ['--ao-kpi-cols' as string]: String(items.length) }}>
      {items.map((k, i) => (
        <div className="ao-kpi" key={i}>
          <div className="ao-kpi__label">{k.label}</div>
          <div className={cx('ao-kpi__value', k.accent && 'ao-kpi__value--accent')}>{k.value}</div>
          {k.sub && <div className="ao-kpi__sub">{k.sub}</div>}
        </div>
      ))}
    </div>
  );
}

// ── Carte ────────────────────────────────────────────────────────────────────
export function Card({ title, meta, children, right }: { title?: string; meta?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="ao-card">
      {(title || meta) && (
        <header className="ao-card__head">
          <span className="ao-card__title">{title}</span>
          {right ?? (meta && <span className="ao-card__meta">{meta}</span>)}
        </header>
      )}
      {children}
    </section>
  );
}

// ── Tableau (grille CSS) ─────────────────────────────────────────────────────
function gridTemplate(cols: TableCol[]): string {
  return cols.map((c) => (c.grow ? `${c.grow}fr` : '1fr')).join(' ');
}
function Cell({ cell }: { cell: TableCell }) {
  if (cell.num !== undefined) return <div className={cx('ao-cell--num', cell.accentNum && 'ao-cell--num-accent', cell.mutedNum && 'ao-cell--num-muted')}>{cell.num}</div>;
  if (cell.badge) return <div><Badge label={cell.badge.label} kind={cell.badge.kind} /></div>;
  if (cell.phase) return <div><PhaseChip label={cell.phase.label} current={cell.phase.current} /></div>;
  if (cell.sec !== undefined) return <div className="ao-cell--sec">{cell.sec}</div>;
  return (
    <div>
      <div className="ao-cell__title">{cell.text}</div>
      {cell.sub && <div className="ao-cell__sub">{cell.sub}</div>}
    </div>
  );
}
export function DataTable({ cols, rows, onRow }: { cols: TableCol[]; rows: TableCell[][]; onRow?: (i: number) => void }) {
  const style = { ['--ao-cols' as string]: gridTemplate(cols) };
  return (
    <div className="ao-table" style={style}>
      <div className="ao-thead">
        {cols.map((c, i) => (
          <div className={cx('ao-th', c.num && 'ao-th--num')} key={i}>{c.label}</div>
        ))}
      </div>
      {rows.map((row, ri) =>
        onRow ? (
          <button className="ao-row" key={ri} onClick={() => onRow(ri)}>
            {row.map((cell, ci) => <Cell cell={cell} key={ci} />)}
          </button>
        ) : (
          <div className="ao-row" key={ri}>
            {row.map((cell, ci) => <Cell cell={cell} key={ci} />)}
          </div>
        ),
      )}
    </div>
  );
}

// ── Liste de faits (carte latérale) ──────────────────────────────────────────
export function FactList({ items }: { items: FactItem[] }) {
  return (
    <div className="ao-facts">
      {items.map((f, i) => (
        <div className="ao-fact" key={i}>
          <span className={cx('ao-fact__sev', f.sev === 'accent' && 'ao-fact__sev--accent', f.sev === 'danger' && 'ao-fact__sev--danger')} />
          <div className="ao-fact__main">
            <div className="ao-fact__label">{f.label}</div>
            {f.sub && <div className="ao-fact__sub">{f.sub}</div>}
          </div>
          {f.value && <div className="ao-fact__value">{f.value}</div>}
        </div>
      ))}
    </div>
  );
}

// ── Champ de formulaire (lecture) ────────────────────────────────────────────
export function ReadField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="ao-field">
      <div className="ao-field__label">{label}</div>
      <div className="ao-field__box">{value}</div>
    </div>
  );
}

// ── Barre d'avancement fine ──────────────────────────────────────────────────
export function Bar({ value }: { value: number }) {
  return (
    <div className="ao-bar">
      <div className="ao-bar__fill" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

// ── États d'écran (réf écran 28) ─────────────────────────────────────────────
export function StateBlock({ title, desc, action }: { title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="ao-state">
      <div className="ao-state__title">{title}</div>
      {desc && <div className="ao-state__desc">{desc}</div>}
      {action}
    </div>
  );
}

export { cx };
